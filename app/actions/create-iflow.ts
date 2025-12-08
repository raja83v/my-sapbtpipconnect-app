"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { createSAPCPIClient } from "@/lib/sap-cpi/client";
import { BPMN2Generator } from "@/lib/sap-cpi/bpmn2-generator";
import type { IFlowDesign, PackageSelection, CreationResult } from "@/components/ai/v2/specialized/iflow-creator/types";

// Extend CreationResult to include generated XML
export interface CreationResultWithXML extends CreationResult {
    generatedXML?: string;
}

export async function createIFlowInSAPCPI(
    tenantId: string,
    packageSelection: PackageSelection,
    design: IFlowDesign
): Promise<CreationResultWithXML> {
    try {
        // 1. Authenticate user
        const user = await getCurrentUser();
        if (!user) {
            return {
                success: false,
                iflowId: '',
                packageId: '',
                errors: ['User not authenticated'],
            };
        }

        // 2. Get tenant credentials
        const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });
        if (!tenant) {
            return {
                success: false,
                iflowId: '',
                packageId: '',
                errors: ['Tenant not found or invalid credentials'],
            };
        }

        // 3. Verify user has access to this tenant
        const membership = await convex.query(api.tenants.getMembership, {
            userId: user.id as any,
            tenantId: tenantId as any,
        });

        if (!membership) {
            return {
                success: false,
                iflowId: '',
                packageId: '',
                errors: ['You do not have access to this tenant'],
            };
        }

        // 4. Initialize SAP CPI client
        // Note: Pass encrypted credentials - the client will decrypt them internally
        const sapCpiClient = createSAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as "OAUTH" | "BASIC_AUTH",
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret, // Pass encrypted, client will decrypt
            username: tenant.username,
            password: tenant.password, // Pass encrypted, client will decrypt
            tokenUrl: tenant.authenticationUrl,
        });

        const warnings: string[] = [];
        const packageId = packageSelection.packageId || '';

        // Determine if we should create a new iFlow or update an existing one
        // createNewIFlow = true: Create new iFlow with AI-generated name (even in existing package)
        // createNewIFlow = false/undefined with iflowId: Update the selected iFlow
        const shouldCreateNew = packageSelection.createNewIFlow || 
            (packageSelection.mode === 'new') ||
            !packageSelection.iflowId;

        // Use AI-generated ID/Name for new iFlows, selected ID/Name for updates
        const iflowId = shouldCreateNew 
            ? design.metadata.id 
            : packageSelection.iflowId!;

        const iflowName = shouldCreateNew 
            ? design.metadata.name 
            : packageSelection.iflowName!;

        console.log('📋 Using iFlow details:', {
            mode: packageSelection.mode,
            createNewIFlow: packageSelection.createNewIFlow,
            shouldCreateNew,
            selectedIFlowId: packageSelection.iflowId,
            aiGeneratedId: design.metadata.id,
            finalIFlowId: iflowId,
            finalIFlowName: iflowName
        });

        // 6. Create or verify package
        if (packageSelection.mode === 'new') {
            try {
                await sapCpiClient.createIntegrationPackage(
                    packageId,
                    packageSelection.packageName || 'New Package',
                    packageSelection.packageDescription
                );
            } catch (error) {
                // Package might already exist, which is okay
                if (error instanceof Error && !error.message.includes('already exists')) {
                    return {
                        success: false,
                        iflowId,
                        packageId,
                        errors: [`Failed to create package: ${error.message}`],
                    };
                }
                warnings.push('Package already exists, using existing package');
            }
        }

        // 7. Generate BPMN2 XML
        const generator = new BPMN2Generator();
        const bpmn2Xml = generator.generate(design);

        console.log(`✅ Generated BPMN2 XML (${bpmn2Xml.length} characters)`);

        // 8. Prepare script files if any
        const scriptFiles = design.scripts
            .filter(script => script.scriptContent)
            .map(script => ({
                path: script.scriptPath,
                content: script.scriptContent!,
            }));

        // 9. Upload iFlow to SAP CPI
        try {
            await sapCpiClient.uploadIFlow(
                packageId,
                iflowId,
                iflowName,
                bpmn2Xml,
                scriptFiles.length > 0 ? scriptFiles : undefined,
                shouldCreateNew
            );
        } catch (error) {
            return {
                success: false,
                iflowId,
                packageId,
                errors: [
                    `Failed to upload iFlow: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ],
            };
        }

        // 10. Deploy iFlow to runtime
        try {
            await sapCpiClient.deployIFlow(iflowId);
        } catch (error) {
            // Deployment failure is not critical - iFlow is created but not deployed
            warnings.push(
                `iFlow created but deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        // 11. Return success result with generated XML and design
        return {
            success: true,
            iflowId,
            packageId,
            deploymentUrl: `${tenant.tenantUrl}/itspaces/shell/monitoring/Messages?iflowId=${iflowId}`,
            warnings: warnings.length > 0 ? warnings : undefined,
            generatedXML: bpmn2Xml, // Include the generated XML
            design, // Include the design for ZIP generation
        };
    } catch (error) {
        console.error('Error creating iFlow:', error);
        return {
            success: false,
            iflowId: design.metadata.id,
            packageId: packageSelection.packageId || '',
            errors: [
                `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ],
        };
    }
}