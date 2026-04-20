"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { SAPCPIClient } from "@/lib/sap-cpi/client";
import { decrypt } from "@/lib/encryption";
import { runText } from "@/lib/ai/runtime/text";
import { IFlowDescription, IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";
import { createIFlowDesignPrompt, IFLOW_CREATOR_SYSTEM_PROMPT } from "@/lib/ai/prompts-iflow-creator";
import { extractCatalogPatterns, type PatternExtractionResult } from "@/lib/sap-cpi/catalog-pattern-extractor";
import type { CatalogPatternReference } from "@/types/catalog";

export interface SAPCPIPackage {
    Id: string;
    Name: string;
    Description: string;
    Version: string;
    Vendor?: string;
    CreatedBy?: string;
    CreatedAt?: string;
    ModifiedBy?: string;
    ModifiedAt?: string;
}

/**
 * Get SAP CPI integration packages for a tenant
 */
export async function getIntegrationPackages(tenantId: string): Promise<ActionResult<SAPCPIPackage[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Get tenant details
        const tenant = await db.query.cpiTenants.findFirst({ where: eq(cpiTenants.id, tenantId) });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check if user has access to this tenant
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Validate tenant configuration
        if (!tenant.tenantUrl) {
            return { success: false, error: "Tenant URL is not configured" };
        }

        // Get authentication token
        if (tenant.authType !== "OAUTH") {
            return { success: false, error: "Only OAuth authentication is currently supported" };
        }

        if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured" };
        }

        const decryptedClientSecret = await decrypt(tenant.clientSecret);

        // Create SAP CPI client
        const sapCpiClient = new SAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: "OAUTH",
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret, // Pass encrypted, client will decrypt
            tokenUrl: tenant.authenticationUrl,
        });

        // Fetch integration packages
        const endpoint = `/api/v1/IntegrationPackages?$format=json`;
        const url = `${tenant.tenantUrl}${endpoint}`;

        // Get auth header from client
        const authHeader = await (sapCpiClient as any).getAuthHeader();

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": authHeader,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch packages: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const packages: SAPCPIPackage[] = data.d?.results || [];

        return { success: true, data: packages };
    } catch (error) {
        console.error("Error fetching integration packages:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch packages"
        };
    }
}

/**
 * Get iFlows for a specific package
 */
export async function getPackageIFlows(tenantId: string, packageId: string): Promise<ActionResult<any[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Get tenant details
        const tenant = await db.query.cpiTenants.findFirst({ where: eq(cpiTenants.id, tenantId) });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check if user has access to this tenant
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Validate tenant configuration
        if (!tenant.tenantUrl) {
            return { success: false, error: "Tenant URL is not configured" };
        }

        // Create SAP CPI client
        const sapCpiClient = new SAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as "OAUTH" | "BASIC_AUTH",
            clientId: tenant.clientId || undefined,
            clientSecret: tenant.clientSecret || undefined,
            username: tenant.username || undefined,
            password: tenant.password || undefined,
            tokenUrl: tenant.authenticationUrl || undefined,
        });

        // Fetch iFlows for the package
        const endpoint = `/api/v1/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts?$format=json`;
        const url = `${tenant.tenantUrl}${endpoint}`;

        // Get auth header from client
        const authHeader = await (sapCpiClient as any).getAuthHeader();

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": authHeader,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch iFlows: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const iflows = data.d?.results || [];

        return { success: true, data: iflows };
    } catch (error) {
        console.error("Error fetching iFlows:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch iFlows"
        };
    }
}

/**
 * Generate iFlow design using AI
 */
export async function generateIFlowDesign(
    description: IFlowDescription,
    catalogPatterns?: CatalogPatternReference[]
): Promise<ActionResult<IFlowDesign>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Validate description
        if (!description.description || description.description.length < 100) {
            return { success: false, error: "Description must be at least 100 characters" };
        }

        // Check if AI is configured
        if (!process.env.LLMLITE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            return { success: false, error: "AI service not configured" };
        }

        // Create prompt (with optional catalog reference patterns)
        const userPrompt = createIFlowDesignPrompt(description, catalogPatterns);


        // Call AI runtime (LLMLite/OpenAI primary with Google fallback)
        const result = await runText({
            system: IFLOW_CREATOR_SYSTEM_PROMPT,
            prompt: userPrompt,
            maxTokens: 8000,
            temperature: 0.7,
            modelKind: "orchestrator",
        });
        const text = result.text;

        // Log the raw AI response

        // Helper function to clean AI-generated JSON
        const cleanAIJson = (rawText: string): string => {
            let json = rawText.trim();

            // Step 1: Extract JSON from markdown code blocks (most common AI pattern)
            // Handle both ```json and plain ``` blocks
            const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                json = codeBlockMatch[1].trim();
            }

            // Step 2: If the response doesn't start with { or [, try to find the JSON
            if (!json.startsWith('{') && !json.startsWith('[')) {
                const jsonStart = json.search(/[\[{]/);
                if (jsonStart !== -1) {
                    json = json.substring(jsonStart);
                }
            }

            // Step 3: If response has trailing text after JSON, trim it
            // Find the last } or ] that closes the root object/array
            let depth = 0;
            let inString = false;
            let escapeNext = false;
            let jsonEndIndex = -1;

            for (let i = 0; i < json.length; i++) {
                const char = json[i];

                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    escapeNext = true;
                    continue;
                }

                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char === '{' || char === '[') {
                        depth++;
                    } else if (char === '}' || char === ']') {
                        depth--;
                        if (depth === 0) {
                            jsonEndIndex = i;
                            break;
                        }
                    }
                }
            }

            if (jsonEndIndex !== -1 && jsonEndIndex < json.length - 1) {
                json = json.substring(0, jsonEndIndex + 1);
            }

            // Step 4: Fix broken URLs that span multiple lines
            // AI sometimes generates: "key": "https:\n      //example.com"
            json = json.replace(/"(https?:)\s*\n\s*(\/\/[^"]+)"/g, '"$1$2"');

            // Step 5: Replace literal newlines inside string values with escaped newlines
            // But preserve newlines in the JSON structure itself
            json = json.replace(/"([^"]*?)"/g, (match, content) => {
                // Replace unescaped newlines/carriage returns in string values
                const cleaned = content
                    .replace(/\r\n/g, '\\n')
                    .replace(/\r/g, '\\n')
                    .replace(/\n/g, '\\n')
                    .replace(/\t/g, '\\t');
                return `"${cleaned}"`;
            });

            // Step 6: Remove control characters outside of strings (but keep structural whitespace)
            // Only remove truly problematic control characters
            json = json.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

            // Step 7: Fix common JSON syntax issues

            // Fix trailing commas before } or ]
            json = json.replace(/,(\s*[}\]])/g, '$1');

            // Fix multiple consecutive commas
            json = json.replace(/,(\s*,)+/g, ',');

            // Remove comments (// style)
            // Only outside strings - we need to be careful here
            const lines = json.split('\n');
            const cleanedLines = lines.map(line => {
                // Simple approach: if line has // and it's not inside a string, remove it
                let inStr = false;
                let esc = false;
                for (let i = 0; i < line.length - 1; i++) {
                    const c = line[i];
                    if (esc) { esc = false; continue; }
                    if (c === '\\') { esc = true; continue; }
                    if (c === '"') { inStr = !inStr; continue; }
                    if (!inStr && c === '/' && line[i + 1] === '/') {
                        return line.substring(0, i).trimEnd();
                    }
                }
                return line;
            });
            json = cleanedLines.join('\n');

            // Step 8: Pre-process scriptContent and other code fields
            // The AI generates code with unescaped double quotes that break JSON
            // This is a complex fix that needs to handle multi-line script content
            
            // First, find all "scriptContent": " patterns and fix the content until the closing quote
            // We need to be smarter about finding the real end of the scriptContent value
            const fixCodeFields = (input: string): string => {
                // Look for patterns like containsKey("Name") and escape the inner quotes
                // Also handle other common Groovy patterns with unescaped quotes
                
                // Pattern: method("stringArg") -> method(\"stringArg\")
                // But we need to be inside a JSON string value
                
                let result = input;
                
                // Fix common Groovy patterns that have unescaped quotes
                // containsKey("Name") -> containsKey(\"Name\")
                result = result.replace(/(containsKey|containsValue|get|put|equals|startsWith|endsWith|matches|split|indexOf)\s*\(\s*"([^"\\]*)"\s*\)/g, 
                    (match, method, arg) => `${method}(\\"${arg}\\")`);
                
                // Fix getProperty("name") patterns
                result = result.replace(/(getProperty|setProperty|getHeader|setHeader)\s*\(\s*"([^"\\]*)"\s*\)/g,
                    (match, method, arg) => `${method}(\\"${arg}\\")`);
                
                // Fix println "text" or log.info "text"
                result = result.replace(/(println|log\.info|log\.debug|log\.error|log\.warn)\s+"([^"\\]*)"/g,
                    (match, method, arg) => `${method} \\"${arg}\\"`);
                
                // Fix String comparisons: == "value"
                result = result.replace(/==\s*"([^"\\]*)"/g, '== \\"$1\\"');
                result = result.replace(/!=\s*"([^"\\]*)"/g, '!= \\"$1\\"');
                
                // Fix new String("value") patterns
                result = result.replace(/new\s+(?:String|StringBuilder|StringBuffer)\s*\(\s*"([^"\\]*)"\s*\)/g,
                    (match, arg) => `new String(\\"${arg}\\")`);
                    
                return result;
            };
            
            json = fixCodeFields(json);

            // Additional step: Look for scriptContent values and fix remaining issues
            json = json.replace(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (match, content) => {
                // Don't process if it's already a simple placeholder
                if (content.includes('Script content removed') || content.length < 50) {
                    return match;
                }
                
                // Fix common Groovy patterns that break JSON
                let fixed = content
                    // Fix the specific pattern: .append('\"').append(value.replaceAll('\\\"', '\\\\\"'))
                    // These single-quoted strings with escaped quotes break JSON
                    .replace(/\\'\\\\*\\"/g, '\\\\"') // \'\" -> \"
                    .replace(/\\\\{3,}/g, '\\\\') // Reduce 3+ backslashes to 2
                    .replace(/replaceAll\s*\(\s*'\\\\/g, 'replaceAll("\\\\') // replaceAll('\ -> replaceAll("\
                    .replace(/'\s*,\s*'\\\\/g, '", "\\\\') // ', '\ -> ", "\
                    .replace(/\\\\'\s*\)/g, '")')  // \') -> ")
                    .replace(/\(\s*'([^'\\]*)'\s*\)/g, '("$1")'); // ('text') -> ("text")
                
                return `"scriptContent": "${fixed}"`;
            });

            return json;
        };

        let designJson = cleanAIJson(text);


        // Parse the JSON response
        let design!: IFlowDesign;
        try {
            design = JSON.parse(designJson);
        } catch (parseError) {
            console.error("❌ JSON Parse Error:", parseError);

            // Extract error position if available
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            const positionMatch = errorMessage.match(/position\s+(\d+)/i);
            const errorPos = positionMatch ? parseInt(positionMatch[1]) : -1;

            if (errorPos >= 0) {
                console.error(`📄 Problematic JSON around position ${errorPos}:`);
                const start = Math.max(0, errorPos - 100);
                const end = Math.min(designJson.length, errorPos + 100);
                const context = designJson.substring(start, end);
                const markerPos = errorPos - start;
                console.error(context.substring(0, markerPos) + ">>>HERE<<<" + context.substring(markerPos));
            }
            console.error("Full JSON length:", designJson.length);

            // Try progressive JSON repair
            let repairedJson = designJson;
            let parsed = false;

            // Repair attempt 1: Remove all trailing commas more aggressively
            const repairs = [
                {
                    name: "Fix unescaped quotes in Groovy method calls",
                    fn: (s: string) => {
                        // Fix patterns like containsKey("Name") where quotes are unescaped
                        let result = s;
                        result = result.replace(/(containsKey|containsValue|get|put|equals|startsWith|endsWith|matches|split|indexOf)\s*\(\s*"([^"\\]*)"\s*\)/g, 
                            (match, method, arg) => `${method}(\\"${arg}\\")`);
                        result = result.replace(/(getProperty|setProperty|getHeader|setHeader)\s*\(\s*"([^"\\]*)"\s*\)/g,
                            (match, method, arg) => `${method}(\\"${arg}\\")`);
                        result = result.replace(/(println|log\.info|log\.debug|log\.error|log\.warn)\s+"([^"\\]*)"/g,
                            (match, method, arg) => `${method} \\"${arg}\\"`);
                        result = result.replace(/==\s*"([^"\\]*)"/g, '== \\"$1\\"');
                        result = result.replace(/!=\s*"([^"\\]*)"/g, '!= \\"$1\\"');
                        return result;
                    }
                },
                {
                    name: "Simplify complex Groovy script content",
                    fn: (s: string) => {
                        // The AI generates complex Groovy with .append() chains and replaceAll() 
                        // with escape sequences that break JSON parsing
                        // Look for scriptContent fields and simplify them
                        return s.replace(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*(?:\.append|replaceAll)[^"]*(?:[^"\\]|\\.)*)"/gi, (match, content) => {
                            // If script has complex patterns like .append('\"') or replaceAll('\\\"')
                            // Replace with a simplified placeholder
                            if (/\.append\s*\(\s*'\\/.test(content) || /replaceAll\s*\(\s*'\\{2,}/.test(content)) {
                                return '"scriptContent": "// Complex script - see script file\\nimport com.sap.gateway.ip.core.customdev.util.Message\\n\\ndef Message processData(Message message) {\\n    def body = message.getBody(String)\\n    // TODO: Implement script logic\\n    message.setBody(body)\\n    return message\\n}"';
                            }
                            return match;
                        });
                    }
                },
                {
                    name: "Remove trailing commas",
                    fn: (s: string) => s.replace(/,(\s*[}\]])/g, '$1')
                },
                {
                    name: "Fix multiple commas",
                    fn: (s: string) => s.replace(/,(\s*,)+/g, ',')
                },
                {
                    name: "Remove BOM and zero-width chars",
                    fn: (s: string) => s.replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
                },
                {
                    name: "Normalize quotes",
                    fn: (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
                },
                {
                    name: "Fix single quotes in script content",
                    fn: (s: string) => {
                        // Find scriptContent fields and convert single quotes to escaped form
                        // Pattern: "scriptContent": "...code with 'quotes'..."
                        return s.replace(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (match, content) => {
                            // Replace single quotes with a placeholder that won't break JSON
                            // Also fix improperly escaped sequences
                            let fixed = content
                                // Fix triple+ backslash sequences that break parsing
                                .replace(/\\{4,}/g, '\\\\')
                                // Fix unescaped single quotes that appear after backslash patterns
                                .replace(/\\+'(?=[^'])/g, "\\'")
                                // Replace actual newlines
                                .replace(/\n/g, '\\n')
                                .replace(/\r/g, '\\r')
                                .replace(/\t/g, '\\t');
                            return `"scriptContent": "${fixed}"`;
                        });
                    }
                },
                {
                    name: "Fix Groovy replaceAll patterns",
                    fn: (s: string) => {
                        // AI generates Groovy like: replaceAll('\"', '\\\"')
                        // This breaks JSON because of the quotes and backslashes
                        // Replace problematic patterns with safer alternatives
                        return s
                            // Fix patterns like: replaceAll('\\\"', '\\\\\\"')
                            .replace(/replaceAll\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g, (match, p1, p2) => {
                                // Escape for JSON: replace backslashes and quotes
                                const safeP1 = p1.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                                const safeP2 = p2.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                                return `replaceAll("${safeP1}", "${safeP2}")`;
                            })
                            // Fix Groovy single-quoted strings that might break JSON
                            .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, content) => {
                                // Only replace if we're likely inside a scriptContent value
                                // Convert to escaped double quotes
                                const escaped = content.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
                                return `"${escaped}"`;
                            });
                    }
                },
                {
                    name: "Escape unescaped newlines in strings",
                    fn: (s: string) => {
                        // More aggressive string content fixing
                        return s.replace(/"([^"]*)"/g, (match, content) => {
                            const fixed = content
                                .replace(/(?<!\\)\n/g, '\\n')
                                .replace(/(?<!\\)\r/g, '\\r')
                                .replace(/(?<!\\)\t/g, '\\t');
                            return `"${fixed}"`;
                        });
                    }
                },
                {
                    name: "Remove problematic script content entirely",
                    fn: (s: string) => {
                        // Last resort: replace complex scriptContent with placeholder
                        return s.replace(/"scriptContent"\s*:\s*"(?:[^"\\]|\\.)*"/g, '"scriptContent": "// Script content removed due to parsing issues - regenerate or add manually"');
                    }
                },
            ];

            for (const repair of repairs) {
                repairedJson = repair.fn(repairedJson);
                try {
                    design = JSON.parse(repairedJson);
                    parsed = true;
                    break;
                } catch {
                    // Continue to next repair
                }
            }

            if (!parsed) {
                // Last resort: try to use JSON5-like parsing by fixing common issues
                try {
                    // Try to find and fix the specific character at error position
                    if (errorPos >= 0 && errorPos < repairedJson.length) {
                        const charAtError = repairedJson[errorPos];
                        const prevChar = errorPos > 0 ? repairedJson[errorPos - 1] : '';

                        // If error is at a comma that shouldn't be there
                        if (charAtError === ',' && (prevChar === ',' || prevChar === '{' || prevChar === '[')) {
                            repairedJson = repairedJson.slice(0, errorPos) + repairedJson.slice(errorPos + 1);
                            design = JSON.parse(repairedJson);
                            parsed = true;
                        }
                    }
                } catch {
                    // Final fallback failed
                }
            }

            if (!parsed) {
                throw new Error(`Failed to parse AI response: ${errorMessage}`);
            }
        }

        // Ensure all required arrays exist with defaults
        design = {
            ...design,
            adapters: design.adapters || [],
            scripts: design.scripts || [],
            mappings: design.mappings || [],
            errorHandlers: design.errorHandlers || [],
            routers: design.routers || [],
            multicasts: design.multicasts || [],
            splitters: design.splitters || [],
            aggregators: design.aggregators || [],
            converters: design.converters || [],
            contentModifiers: design.contentModifiers || [],
            encryptors: design.encryptors || [],
            decryptors: design.decryptors || [],
            signers: design.signers || [],
            verifiers: design.verifiers || [],
            dataStores: design.dataStores || [],
            variables: design.variables || [],
            exceptionSubprocesses: design.exceptionSubprocesses || [],
            localProcesses: design.localProcesses || [],
            flowDiagram: design.flowDiagram || [],
            performanceNotes: design.performanceNotes || [],
            securityNotes: design.securityNotes || [],
        };


        // Validate the design has required components
        if (!design.metadata || !design.adapters || design.adapters.length === 0) {
            throw new Error("Invalid design: missing required components (metadata or adapters)");
        }

        return { success: true, data: design };
    } catch (error) {
        console.error("Error generating iFlow design:", error);

        // Provide more specific error messages
        if (error instanceof SyntaxError) {
            return {
                success: false,
                error: "Failed to parse AI response. Please try again."
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate iFlow design"
        };
    }
}

/**
 * Search the SAP content catalog for reference patterns matching the user's
 * iFlow description. Returns extracted patterns that can be passed to
 * generateIFlowDesign() to inform the AI.
 *
 * This is a non-blocking, best-effort operation — if the catalog is
 * unreachable or returns no results the caller can proceed without patterns.
 */
export async function searchCatalogForPatterns(
    tenantId: string,
    description: IFlowDescription
): Promise<ActionResult<PatternExtractionResult>> {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const tenant = await db.query.cpiTenants.findFirst({ where: eq(cpiTenants.id, tenantId) });
        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });
        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        if (!tenant.tenantUrl) {
            return { success: false, error: "Tenant URL is not configured" };
        }

        const sapCpiClient = new SAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as "OAUTH" | "BASIC_AUTH",
            clientId: tenant.clientId || undefined,
            clientSecret: tenant.clientSecret || undefined,
            username: tenant.username || undefined,
            password: tenant.password || undefined,
            tokenUrl: tenant.authenticationUrl || undefined,
        });

        const result = await extractCatalogPatterns(sapCpiClient, description);
        return { success: true, data: result };
    } catch (error) {
        console.error("Error searching catalog for patterns:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to search catalog",
        };
    }
}
