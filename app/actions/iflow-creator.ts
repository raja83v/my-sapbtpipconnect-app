"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { ActionResult } from "@/types/actions";
import { SAPCPIClient } from "@/lib/sap-cpi/client";
import { decrypt } from "@/lib/encryption";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { IFlowDescription, IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";
import { createIFlowDesignPrompt, IFLOW_CREATOR_SYSTEM_PROMPT } from "@/lib/ai/prompts-iflow-creator";

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
        const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check if user has access to this tenant
        const membership = await convex.query(api.tenants.getMembership, {
            userId: currentUser.id as any,
            tenantId: tenantId as any,
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
        const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check if user has access to this tenant
        const membership = await convex.query(api.tenants.getMembership, {
            userId: currentUser.id as any,
            tenantId: tenantId as any,
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
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            username: tenant.username,
            password: tenant.password,
            tokenUrl: tenant.authenticationUrl,
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
    description: IFlowDescription
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
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return { success: false, error: "AI service not configured" };
        }

        // Create prompt
        const userPrompt = createIFlowDesignPrompt(description);

        console.log("🤖 Generating iFlow design with AI (Gemini Flash 2.0)...");
        console.log("Description length:", description.description.length);

        // Call Gemini API using Vercel AI SDK
        const { text } = await generateText({
            model: google("gemini-2.5-flash-lite"),
            system: IFLOW_CREATOR_SYSTEM_PROMPT,
            prompt: userPrompt,
            maxTokens: 8000,
            temperature: 0.7,
        });

        // Log the raw AI response
        console.log("=".repeat(80));
        console.log("🤖 RAW AI RESPONSE (first 1000 chars):");
        console.log("=".repeat(80));
        console.log(text.substring(0, 1000));
        console.log("=".repeat(80));
        console.log("📊 Response Stats:");
        console.log(`   Total length: ${text.length} characters`);
        console.log(`   Has markdown blocks: ${text.includes('```')}`);
        console.log(`   Has newlines: ${text.includes('\n')}`);
        console.log(`   Has control chars: ${/[\x00-\x1F\x7F]/.test(text)}`);
        console.log("=".repeat(80));

        // Helper function to clean AI-generated JSON
        const cleanAIJson = (rawText: string): string => {
            let json = rawText.trim();

            // Step 1: Extract JSON from markdown code blocks (most common AI pattern)
            // Handle both ```json and plain ``` blocks
            const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                console.log("✂️ Extracted JSON from markdown code block");
                json = codeBlockMatch[1].trim();
            }

            // Step 2: If the response doesn't start with { or [, try to find the JSON
            if (!json.startsWith('{') && !json.startsWith('[')) {
                const jsonStart = json.search(/[\[{]/);
                if (jsonStart !== -1) {
                    console.log(`✂️ Trimmed ${jsonStart} characters from start to find JSON`);
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
                console.log(`✂️ Trimmed ${json.length - jsonEndIndex - 1} characters from end`);
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

            return json;
        };

        let designJson = cleanAIJson(text);

        console.log("📝 JSON after cleaning (first 1000 chars):");
        console.log(designJson.substring(0, 1000));
        console.log("=".repeat(80));
        console.log("=".repeat(80));
        console.log("📊 Cleaned JSON Stats:");
        console.log(`   Total length: ${designJson.length} characters`);

        // Parse the JSON response
        let design: IFlowDesign;
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
            ];

            for (const repair of repairs) {
                repairedJson = repair.fn(repairedJson);
                try {
                    design = JSON.parse(repairedJson);
                    console.log(`✅ Parsed after repair: ${repair.name}`);
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
                        console.log(`Character at error position: "${charAtError}" (code: ${charAtError.charCodeAt(0)})`);
                        console.log(`Previous character: "${prevChar}" (code: ${prevChar.charCodeAt(0)})`);

                        // If error is at a comma that shouldn't be there
                        if (charAtError === ',' && (prevChar === ',' || prevChar === '{' || prevChar === '[')) {
                            repairedJson = repairedJson.slice(0, errorPos) + repairedJson.slice(errorPos + 1);
                            design = JSON.parse(repairedJson);
                            console.log("✅ Parsed after removing extra comma at error position");
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

        console.log("✅ Successfully generated iFlow design:");
        console.log(`   Name: ${design.metadata.name}`);
        console.log(`   Adapters: ${design.adapters.length}`);
        console.log(`   Scripts: ${design.scripts.length}`);
        console.log(`   Mappings: ${design.mappings.length}`);
        console.log(`   Error Handlers: ${design.errorHandlers.length}`);
        console.log(`   Complexity: ${design.estimatedComplexity}`);

        // Validate the design has required components
        if (!design.metadata || !design.adapters || design.adapters.length === 0) {
            throw new Error("Invalid design: missing required components");
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