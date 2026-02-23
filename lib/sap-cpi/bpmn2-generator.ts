/**
 * BPMN2 XML Generator for SAP CPI iFlows
 * 
 * This generator creates valid BPMN2 XML that can be deployed to SAP CPI.
 * It follows the exact structure expected by SAP CPI runtime.
 * 
 * Supports:
 * - 50+ adapter types (Cloud Connectors, Messaging, Cloud Apps, Infrastructure)
 * - Flow Control (Router, Multicast, Splitter, Aggregator, Join, Gather, Filter)
 * - Message Transformers (Converters, Content Modifiers, XML Validators)
 * - Security Components (Encryptor, Decryptor, Signer, Verifier)
 * - Persistence (Data Store, Variables, Persist Message)
 * - Timer/Scheduler Start Events
 * - Exception Subprocesses
 * - Local Integration Processes
 */

import {
    IFlowDesign,
    AdapterConfig,
    ScriptConfig,
    MappingConfig,
    ErrorHandlerConfig,
    RouterConfig,
    MulticastConfig,
    SplitterConfig,
    AggregatorConfig,
    JoinConfig,
    GatherConfig,
    FilterConfig,
    ConverterConfig,
    ContentModifierConfig,
    XMLValidatorConfig,
    EncryptorConfig,
    DecryptorConfig,
    SignerConfig,
    VerifierConfig,
    DataStoreConfig,
    VariableConfig,
    PersistMessageConfig,
    RequestReplyConfig,
    ContentEnricherConfig,
    TimerStartEventConfig,
    ExceptionSubprocessConfig,
    LocalIntegrationProcessConfig,
    FlowStep
} from "@/components/ai/v2/specialized/iflow-creator/types";

export class BPMN2Generator {
    private idCounter = 1;
    private elementPositions: Map<string, { x: number; y: number }> = new Map();

    /**
     * Generate the cmdVariantUri property for a callActivity element.
     * For FlowstepVariant we include a 3-part version suffix (x.y.z) to match SAP designer metadata lookup.
     */
    private getCmdVariantUri(subActivityType: string, componentVersion: string): string {
        return `ctype::FlowstepVariant/cname::${subActivityType}/version::${this.toThreePartVersion(componentVersion)}`;
    }

    /**
     * Generate the standard cmdVariantUri ifl:property block for a callActivity
     */
    private generateCmdVariantProperty(subActivityType: string, componentVersion: string): string {
        return `                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>${this.getCmdVariantUri(subActivityType, componentVersion)}</value>
                </ifl:property>`;
    }

    /**
     * Convert "1.6" -> "1.6.0", keep "1.0.3" as-is.
     */
    private toThreePartVersion(version: string): string {
        const raw = (version || '1.0').trim();
        const parts = raw.split('.');
        if (parts.length >= 3) return raw;
        if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
        return `${parts[0] || '1'}.0.0`;
    }

    /**
     * Get the correct component version for SAP CPI components
     * SAP CPI requires specific version numbers for each component type
     */
    private getComponentVersion(componentType: string): string {
        const versionMap: Record<string, string> = {
            // Message Transformers
            'ContentModifier': '1.6',
            'Converter': '1.5',
            'JSONToXML': '1.5',
            'XMLToJSON': '1.5',
            'CSVToXML': '1.2',
            'XMLToCSV': '1.2',
            'Base64Encoder': '1.1',
            'Base64Decoder': '1.1',

            // Validators
            'XMLValidator': '1.2',

            // Security
            'Encryptor': '1.2',
            'Decryptor': '1.2',
            'Signer': '1.2',
            'Verifier': '1.2',

            // Flow Control
            'Router': '1.0',
            'Multicast': '1.0',
            'Splitter': '1.3',
            'Aggregator': '1.0',
            'Join': '1.0',
            'Filter': '1.0',

            // Scripting
            'Script': '1.2',
            'MessageMapping': '1.3',

            // Persistence
            'DataStore': '1.1',
            'Variable': '1.0',
            'RequestReply': '1.0',
            'ContentEnricher': '1.0',

            // Start/End Events
            'StartEvent': '1.1',
            'EndEvent': '1.1',
            'Timer': '1.0',

            // Subprocess
            'SubProcess': '1.0',
            'LocalProcess': '1.0',
        };

        return versionMap[componentType] || '1.0';
    }

    /**
     * Get the correct adapter version (ComponentSWCVId) for SAP CPI adapters
     * Different adapter types require specific Software Component Version IDs
     */
    private getAdapterVersion(adapterType: string): string {
        const adapterVersions: Record<string, string> = {
            // HTTP/SOAP Adapters
            'HTTP': '1.6.0',
            'HTTPS': '1.6.0',
            'SOAP': '1.9.0',
            'SOAP_SAP_RM': '1.2.0',
            'REST': '1.0.0',

            // OData Adapters
            'OData': '1.0.17',
            'OData_V2': '1.0.17',
            'OData_V4': '1.0.17',

            // File Transfer Adapters
            'SFTP': '1.5.0',
            'FTP': '1.3.0',
            'FTPS': '1.3.0',

            // Mail Adapters
            'Mail': '1.13.0',
            'IMAP': '1.13.0',
            'POP3': '1.13.0',
            'SMTP': '1.13.0',

            // SAP Adapters
            'IDoc': '1.10.0',
            'RFC': '1.0.0',
            'XI': '1.0.0',

            // Messaging
            'JMS': '1.7.0',
            'AMQP': '1.6.0',
            'Kafka': '1.2.0',
            'SAP_Event_Mesh': '1.0.0',
            'AzureServiceBus': '1.0.0',

            // Cloud Apps
            'Salesforce': '1.0.0',
            'SuccessFactors': '1.6.0',
            'SuccessFactors_SOAP': '1.6.0',
            'SuccessFactors_REST': '1.6.0',
            'SuccessFactors_OData': '1.6.0',
            'Ariba': '1.0.0',
            'Ariba_Network': '1.0.0',
            'Workday': '1.0.0',
            'ServiceNow': '1.0.0',
            'MicrosoftDynamics': '1.0.0',
            'MicrosoftDynamics365': '1.0.0',
            'Twitter': '1.0.0',
            'Facebook': '1.0.0',
            'Slack': '1.0.0',
            'Dropbox': '1.0.0',
            'GoogleDrive': '1.0.0',
            'Box': '1.0.0',
            'SAP_Concur': '1.0.0',
            'SAP_FieldGlass': '1.0.0',
            'SAP_IBP': '1.0.0',
            'SAP_C4C': '1.0.0',

            // Infrastructure
            'ProcessDirect': '1.2.0',
            'DataStore': '1.0.0',
            'DataStoreSelect': '1.0.0',
            'AmazonS3': '1.0.0',
            'AmazonSQS': '1.0.0',
            'AmazonSNS': '1.0.0',
            'AmazonDynamoDB': '1.0.0',
            'AzureBlob': '1.0.0',
            'AzureCosmosDB': '1.0.0',
            'OpenConnectors': '1.0.0',
            'ELSTER': '1.0.0',
            'MDI': '1.0.0',

            // JDBC (uses SAP Cloud Connector adapter)
            'JDBC': '1.0.0',

            // B2B Adapters
            'AS2': '1.0.0',
            'AS4': '1.0.0',
        };

        return adapterVersions[adapterType] || '1.0.0';
    }

    /**
     * Collect all valid element IDs in the design
     */
    private collectValidElementIds(design: IFlowDesign): Set<string> {
        const ids = new Set<string>();

        // Add end event ID - always valid target
        ids.add('EndEvent_1');

        // Add all step IDs
        if (design.steps) {
            design.steps.forEach(step => ids.add(step.id));
        }

        // Add local process IDs
        if (design.localProcesses) {
            design.localProcesses.forEach(lp => ids.add(lp.id));
        }

        // Add all component IDs
        if (design.converters) design.converters.forEach(c => ids.add(c.id));
        if (design.contentModifiers) design.contentModifiers.forEach(c => ids.add(c.id));
        if (design.xmlValidators) design.xmlValidators.forEach(x => ids.add(x.id));
        if (design.decryptors) design.decryptors.forEach(d => ids.add(d.id));
        if (design.verifiers) design.verifiers.forEach(v => ids.add(v.id));
        if (design.scripts) design.scripts.forEach(s => ids.add(s.id));
        if (design.routers) design.routers.forEach(r => ids.add(r.id));
        if (design.splitters) design.splitters.forEach(s => ids.add(s.id));
        if (design.multicasts) design.multicasts.forEach(m => ids.add(m.id));
        if (design.mappings) design.mappings.forEach(m => ids.add(m.id));
        if (design.aggregators) design.aggregators.forEach(a => ids.add(a.id));
        if (design.joins) design.joins.forEach(j => ids.add(j.id));
        if (design.filters) design.filters.forEach(f => ids.add(f.id));
        if (design.dataStores) design.dataStores.forEach(d => ids.add(d.id));
        if (design.variables) design.variables.forEach(v => ids.add(v.id));
        if (design.requestReplies) design.requestReplies.forEach(r => ids.add(r.id));
        if (design.contentEnrichers) design.contentEnrichers.forEach(c => ids.add(c.id));
        if (design.signers) design.signers.forEach(s => ids.add(s.id));
        if (design.encryptors) design.encryptors.forEach(e => ids.add(e.id));
        
        // NOTE: Do NOT include flowSteps or flowDiagram directly - they may contain
        // elements with unrecognized types that won't be generated.
        // Only component arrays contain elements that will actually exist in the BPMN2 XML.

        return ids;
    }

    /**
     * Normalize design by extracting elements from flowSteps into the appropriate arrays
     * This ensures the generator can process elements regardless of how the AI structured them
     */
    private normalizeDesign(design: IFlowDesign): IFlowDesign {
        const normalized = { ...design };
        
        // Initialize arrays if not present
        if (!normalized.scripts) normalized.scripts = [];
        if (!normalized.mappings) normalized.mappings = [];
        if (!normalized.routers) normalized.routers = [];
        if (!normalized.converters) normalized.converters = [];
        if (!normalized.contentModifiers) normalized.contentModifiers = [];
        if (!normalized.xmlValidators) normalized.xmlValidators = [];
        if (!normalized.splitters) normalized.splitters = [];
        if (!normalized.aggregators) normalized.aggregators = [];
        if (!normalized.multicasts) normalized.multicasts = [];
        if (!normalized.dataStores) normalized.dataStores = [];
        if (!normalized.variables) normalized.variables = [];
        if (!normalized.requestReplies) normalized.requestReplies = [];
        if (!normalized.contentEnrichers) normalized.contentEnrichers = [];
        if (!normalized.encryptors) normalized.encryptors = [];
        if (!normalized.decryptors) normalized.decryptors = [];
        if (!normalized.signers) normalized.signers = [];
        if (!normalized.verifiers) normalized.verifiers = [];
        if (!normalized.joins) normalized.joins = [];
        if (!normalized.filters) normalized.filters = [];
        if (!normalized.localProcesses) normalized.localProcesses = [];
        
        // Extract elements from flowSteps into appropriate arrays
        if (design.flowSteps && design.flowSteps.length > 0) {
            console.log(`[BPMN2Generator] Normalizing ${design.flowSteps.length} flowSteps into component arrays`);
            
            for (const step of design.flowSteps) {
                const config = step.config as any;
                const existsInArray = (arr: any[], id: string) => arr.some(item => item.id === id);
                
                switch (step.type) {
                    case 'script':
                        if (!existsInArray(normalized.scripts!, step.id)) {
                            normalized.scripts!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'mapping':
                        if (!existsInArray(normalized.mappings!, step.id)) {
                            normalized.mappings!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'router':
                        if (!existsInArray(normalized.routers!, step.id)) {
                            normalized.routers!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'converter':
                        if (!existsInArray(normalized.converters!, step.id)) {
                            normalized.converters!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'contentModifier':
                        if (!existsInArray(normalized.contentModifiers!, step.id)) {
                            normalized.contentModifiers!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'xmlValidator':
                        if (!existsInArray(normalized.xmlValidators!, step.id)) {
                            normalized.xmlValidators!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'splitter':
                        if (!existsInArray(normalized.splitters!, step.id)) {
                            normalized.splitters!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'aggregator':
                        if (!existsInArray(normalized.aggregators!, step.id)) {
                            normalized.aggregators!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'multicast':
                        if (!existsInArray(normalized.multicasts!, step.id)) {
                            normalized.multicasts!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'dataStore':
                        if (!existsInArray(normalized.dataStores!, step.id)) {
                            normalized.dataStores!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'variable':
                        if (!existsInArray(normalized.variables!, step.id)) {
                            normalized.variables!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'requestReply':
                        if (!existsInArray(normalized.requestReplies!, step.id)) {
                            normalized.requestReplies!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'contentEnricher':
                        if (!existsInArray(normalized.contentEnrichers!, step.id)) {
                            normalized.contentEnrichers!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'encryptor':
                        if (!existsInArray(normalized.encryptors!, step.id)) {
                            normalized.encryptors!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'decryptor':
                        if (!existsInArray(normalized.decryptors!, step.id)) {
                            normalized.decryptors!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'signer':
                        if (!existsInArray(normalized.signers!, step.id)) {
                            normalized.signers!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'verifier':
                        if (!existsInArray(normalized.verifiers!, step.id)) {
                            normalized.verifiers!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'join':
                        if (!existsInArray(normalized.joins!, step.id)) {
                            normalized.joins!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'filter':
                        if (!existsInArray(normalized.filters!, step.id)) {
                            normalized.filters!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    case 'localProcess':
                        if (!existsInArray(normalized.localProcesses!, step.id)) {
                            normalized.localProcesses!.push({ id: step.id, name: step.name, ...config });
                        }
                        break;
                    // Handle adapter types - these become request-reply calls in the process
                    case 'adapter':
                    case 'odata':
                    case 'http':
                    case 'soap':
                    case 'rest':
                    case 'sftp':
                    case 'jdbc':
                        // Adapters/connection calls are processed via requestReply pattern
                        if (!existsInArray(normalized.requestReplies!, step.id)) {
                            normalized.requestReplies!.push({ 
                                id: step.id, 
                                name: step.name, 
                                adapterId: config?.adapterId || step.id + '_adapter',
                                adapterType: step.type.toUpperCase(),
                                ...config 
                            });
                        }
                        break;
                    // Handle logging/error handling as content modifiers
                    case 'log':
                    case 'trace':
                    case 'error':
                        if (!existsInArray(normalized.scripts!, step.id)) {
                            normalized.scripts!.push(this.createGeneratedScriptFromStep(
                                step.id,
                                step.name,
                                String(step.type),
                                config
                            ));
                        }
                        break;
                    default:
                        // Skip unknown step types to avoid generating unsupported components.
                        console.warn(`[BPMN2Generator] Unknown step type "${step.type}" for step "${step.id}", skipping`);
                }
            }
        }

        // Also extract steps from localProcesses' internal steps
        if (normalized.localProcesses) {
            for (const localProcess of normalized.localProcesses) {
                if (localProcess.steps && localProcess.steps.length > 0) {
                    // These steps are handled separately in generateLocalIntegrationProcess
                    // but we need to ensure the IDs are tracked
                    console.log(`[BPMN2Generator] Local process "${localProcess.id}" has ${localProcess.steps.length} internal steps`);
                }
            }
        }
        
        // Sanitize adapters - convert Mail/IMAP/POP3 Receiver to SMTP
        if (normalized.adapters) {
            normalized.adapters = normalized.adapters.map(adapter => {
                if (['Mail', 'IMAP', 'POP3'].includes(adapter.type) && adapter.direction === 'Receiver') {
                    console.warn(`[BPMN2Generator] Converting ${adapter.type} Receiver to SMTP for adapter "${adapter.id}"`);
                    return {
                        ...adapter,
                        type: 'SMTP' as any,
                        protocol: 'HTTPS' as any,
                        messageProtocol: 'SMTP'
                    };
                }
                return adapter;
            });
        }
        
        return normalized;
    }

    /**
     * Build a conservative Groovy script step from non-portable/unsupported step types.
     */
    private createGeneratedScriptFromStep(
        id: string,
        name: string,
        sourceType: string,
        config?: Record<string, unknown>
    ): ScriptConfig {
        const safeName = (name || id || 'GeneratedStep').trim();
        const safePathId = (id || safeName || 'generated_step')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        const summary = config ? this.escapeXml(JSON.stringify(config).slice(0, 300)) : '';

        const scriptContent = `import com.sap.gateway.ip.core.customdev.util.Message

def Message processData(Message message) {
    def body = message.getBody(String)
    // Generated from unsupported/non-portable step type: ${sourceType}
    // Original step: ${safeName}
    ${summary ? `// Original config (truncated): ${summary}` : '// No original config provided'}
    message.setBody(body)
    return message
}`;

        return {
            id,
            name: safeName,
            type: 'groovy',
            purpose: `Auto-converted from ${sourceType}`,
            scriptPath: `src/main/resources/script/${safePathId}.groovy`,
            scriptContent,
            complexity: 'low',
        };
    }

    /**
     * Public access to sanitizeDesign for pre-validation in the pipeline orchestrator.
     * Fixes invalid references (e.g., router targets pointing to non-existent elements)
     * and normalizes the design structure.
     */
    sanitizeDesignPublic(design: IFlowDesign): IFlowDesign {
        return this.sanitizeDesign(design);
    }

    /**
     * Sanitize design to fix invalid references (e.g., router targets pointing to non-existent elements)
     */
    private sanitizeDesign(design: IFlowDesign): IFlowDesign {
        // First normalize the design to extract elements from flowSteps
        const normalized = this.normalizeDesign(design);
        
        const validIds = this.collectValidElementIds(normalized);

        // Fix router targets that reference non-existent elements
        if (normalized.routers) {
            normalized.routers = normalized.routers
                // Drop trivial routers that do not provide real branching logic.
                .filter(router => {
                    const routeCount = router.routingConditions?.length ?? 0;
                    if (routeCount < 2) {
                        console.warn(`[BPMN2Generator] Removing trivial router "${router.id}" (only ${routeCount} route condition)`);
                        return false;
                    }
                    return true;
                })
                .map(router => ({
                    ...router,
                    routingConditions: router.routingConditions ? router.routingConditions.map(condition => {
                    if (!validIds.has(condition.targetId)) {
                        console.warn(`[BPMN2Generator] Router condition "${condition.name}" targets non-existent element "${condition.targetId}", redirecting to EndEvent_1`);
                        return { ...condition, targetId: 'EndEvent_1' };
                    }
                    return condition;
                }) : [],
                // Fix default route if it references non-existent element
                defaultRoute: router.defaultRoute && !validIds.has(router.defaultRoute)
                    ? (console.warn(`[BPMN2Generator] Router default route targets non-existent element "${router.defaultRoute}", redirecting to EndEvent_1`), 'EndEvent_1')
                    : router.defaultRoute
            }));
        }

        // Fix multicast targets
        if (normalized.multicasts) {
            normalized.multicasts = normalized.multicasts.map(multicast => ({
                ...multicast,
                branches: multicast.branches ? multicast.branches.map(branch => {
                    if (!validIds.has(branch.targetId)) {
                        console.warn(`[BPMN2Generator] Multicast branch "${branch.name}" targets non-existent element "${branch.targetId}", redirecting to EndEvent_1`);
                        return { ...branch, targetId: 'EndEvent_1' };
                    }
                    return branch;
                }) : []
            }));
        }

        return normalized;
    }

    /**
     * Generate complete BPMN2 XML from iFlow design
     */
    generate(design: IFlowDesign): string {
        // Reset counters for fresh generation
        this.idCounter = 1;
        this.elementPositions.clear();

        // Sanitize design to fix invalid references
        const sanitizedDesign = this.sanitizeDesign(design);

        // Generate unique IDs for all elements
        const processId = `Process_${this.generateUUID()}`;
        const collaborationId = `Collaboration_1`;

        // Determine if this is a timer-triggered flow
        // IMPORTANT: Mail/IMAP/POP3 sender adapters have built-in scheduling via the
        // scheduleKey property — they should NOT create a separate timer start event.
        const hasMailSender = sanitizedDesign.adapters.some(a => 
            a.direction === 'Sender' && ['Mail', 'IMAP', 'POP3'].includes(a.type)
        );
        const isTimerTriggered = !hasMailSender && !!(sanitizedDesign.triggerType === 'timer' || sanitizedDesign.timerConfig);

        const xml = `<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1">
${this.generateCollaboration(sanitizedDesign, collaborationId, processId)}
${this.generateProcess(sanitizedDesign, processId, isTimerTriggered)}
${this.generateLocalProcesses(sanitizedDesign)}
${this.generateBPMNDiagram(sanitizedDesign, collaborationId, processId)}
</bpmn2:definitions>`;

        return xml;
    }

    /**
     * Generate local integration processes
     */
    private generateLocalProcesses(design: IFlowDesign): string {
        if (!design.localProcesses || design.localProcesses.length === 0) {
            return '';
        }

        return design.localProcesses.map(localProcess => {
            return `    <bpmn2:process id="${localProcess.id}" name="${this.escapeXml(localProcess.name)}" isExecutable="false">
        <bpmn2:extensionElements>
            <ifl:property>
                <key>componentVersion</key>
                <value>1.0</value>
            </ifl:property>
            <ifl:property>
                <key>processType</key>
                <value>local</value>
            </ifl:property>
        </bpmn2:extensionElements>
${this.generateLocalProcessContent(localProcess)}
    </bpmn2:process>`;
        }).join('\n');
    }

    /**
     * Generate content for local integration process
     */
    private generateLocalProcessContent(localProcess: LocalIntegrationProcessConfig): string {
        const activities: string[] = [];
        const sequenceFlows: string[] = [];

        // Start event for local process
        activities.push(`        <bpmn2:startEvent id="${localProcess.id}_Start" name="Start">
            <bpmn2:outgoing>${localProcess.id}_Flow_1</bpmn2:outgoing>
        </bpmn2:startEvent>`);

        let previousId = `${localProcess.id}_Start`;
        let flowCounter = 1;

        // Generate activities for each step in the local process
        if (localProcess.steps && localProcess.steps.length > 0) {
            localProcess.steps.forEach((step, index) => {
                const incomingFlow = `${localProcess.id}_Flow_${flowCounter}`;
                flowCounter++;
                const outgoingFlow = `${localProcess.id}_Flow_${flowCounter}`;

                // Generate the step activity based on its type
                const activity = this.generateStepActivity(step, incomingFlow, outgoingFlow);
                if (activity) {
                    activities.push(activity);
                    sequenceFlows.push(`        <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${step.id}"/>`);
                    previousId = step.id;
                }
            });
        }

        // End event for local process
        const finalFlow = `${localProcess.id}_Flow_${flowCounter}`;
        activities.push(`        <bpmn2:endEvent id="${localProcess.id}_End" name="End">
            <bpmn2:incoming>${finalFlow}</bpmn2:incoming>
        </bpmn2:endEvent>`);

        // Final sequence flow
        sequenceFlows.push(`        <bpmn2:sequenceFlow id="${finalFlow}" sourceRef="${previousId}" targetRef="${localProcess.id}_End"/>`);

        return [...activities, ...sequenceFlows].join('\n');
    }

    /**
     * Generate activity for a flow step (used in local processes and exception subprocesses)
     */
    private generateStepActivity(step: FlowStep, incoming: string, outgoing: string): string {
        // Map step type to appropriate generator
        switch (step.type) {
            case 'script':
                return step.config ? this.generateScript(step.config as ScriptConfig, incoming, outgoing) : '';
            case 'mapping':
                return step.config ? this.generateMapping(step.config as MappingConfig, incoming, outgoing) : '';
            case 'contentModifier':
                return step.config ? this.generateContentModifierStep(step.config as ContentModifierConfig, incoming, outgoing) : '';
            case 'converter':
                return step.config ? this.generateConverter(step.config as ConverterConfig, incoming, outgoing) : '';
            case 'xmlValidator':
                return step.config ? this.generateXMLValidator(step.config as XMLValidatorConfig, incoming, outgoing) : '';
            // 'start' and 'end' steps are implicit in local/exception subprocesses — skip them
            case 'start':
            case 'startEvent':
            case 'end':
            case 'endEvent':
                return '';
            default:
                console.warn(`[BPMN2Generator] Unknown step type: ${step.type}`);
                return '';
        }
    }

    /**
     * Generate collaboration section with participants and message flows
     */
    private generateCollaboration(design: IFlowDesign, collaborationId: string, processId: string): string {
        const senderAdapters = design.adapters.filter(a => a.direction === 'Sender');
        const receiverAdapters = design.adapters.filter(a => a.direction === 'Receiver');

        // Collaboration-level extension elements (required by SAP CPI)
        const collaborationExtensions = `        <bpmn2:extensionElements>
            <ifl:property>
                <key>namespaceMapping</key>
                <value/>
            </ifl:property>
            <ifl:property>
                <key>allowedHeaderList</key>
                <value/>
            </ifl:property>
            <ifl:property>
                <key>ServerTrace</key>
                <value/>
            </ifl:property>
            <ifl:property>
                <key>returnExceptionToSender</key>
                <value/>
            </ifl:property>
            <ifl:property>
                <key>log</key>
                <value>All events</value>
            </ifl:property>
            <ifl:property>
                <key>cmdVariantUri</key>
                <value>ctype::IFlowVariant/cname::IFlowConfiguration</value>
            </ifl:property>
        </bpmn2:extensionElements>`;

        // Build participants
        // IntegrationProcess participant has EMPTY extensionElements (properties go on the <bpmn2:process> element)
        let participants = `        <bpmn2:participant id="Participant_1" ifl:type="EndpointSender" name="Sender">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>enableBasicAuthentication</key>
                    <value>false</value>
                </ifl:property>
                <ifl:property>
                    <key>ifl:type</key>
                    <value>EndpointSender</value>
                </ifl:property>
            </bpmn2:extensionElements>
        </bpmn2:participant>
        <bpmn2:participant id="Participant_Process" ifl:type="IntegrationProcess" name="${this.escapeXml(design.metadata.name)}" processRef="${processId}">
            <bpmn2:extensionElements/>
        </bpmn2:participant>
        <bpmn2:participant id="Participant_2" ifl:type="EndpointReceiver" name="Receiver">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>ifl:type</key>
                    <value>EndpointReceiver</value>
                </ifl:property>
            </bpmn2:extensionElements>
        </bpmn2:participant>`;

        // Build message flows
        // NOTE: Sender message flow targetRef should be the StartEvent (not the participant)
        // to match SAP CPI reference format
        let messageFlows = '';

        // Sender message flow
        if (senderAdapters.length > 0) {
            const adapter = senderAdapters[0];
            messageFlows += this.generateMessageFlow(adapter, 'Participant_1', 'StartEvent_1');
        } else {
            // Default HTTP sender
            messageFlows += `        <bpmn2:messageFlow id="MessageFlow_1" name="HTTP" sourceRef="Participant_1" targetRef="StartEvent_1">
            <bpmn2:extensionElements>
${this.generateDefaultSenderProperties()}
            </bpmn2:extensionElements>
        </bpmn2:messageFlow>`;
        }

        // Receiver message flow
        if (receiverAdapters.length > 0) {
            const adapter = receiverAdapters[0];
            messageFlows += '\n' + this.generateMessageFlow(adapter, 'Participant_Process', 'Participant_2');
        } else {
            // Default HTTP receiver
            messageFlows += `
        <bpmn2:messageFlow id="MessageFlow_2" name="HTTP" sourceRef="Participant_Process" targetRef="Participant_2">
            <bpmn2:extensionElements>
${this.generateDefaultReceiverProperties()}
            </bpmn2:extensionElements>
        </bpmn2:messageFlow>`;
        }

        return `    <bpmn2:collaboration id="${collaborationId}" name="${this.escapeXml(design.metadata.name)}">
${collaborationExtensions}
${participants}
${messageFlows}
    </bpmn2:collaboration>`;
    }

    /**
     * Generate default sender adapter properties (HTTP)
     */
    private generateDefaultSenderProperties(): string {
        return `                <ifl:property>
                    <key>Description</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentNS</key>
                    <value>sap</value>
                </ifl:property>
                <ifl:property>
                    <key>Name</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocolVersion</key>
                    <value>1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVName</key>
                    <value>external</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocol</key>
                    <value>None</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVId</key>
                    <value>1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>direction</key>
                    <value>Sender</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentType</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.6</value>
                </ifl:property>
                <ifl:property>
                    <key>system</key>
                    <value>Sender</value>
                </ifl:property>
                <ifl:property>
                    <key>Address</key>
                    <value>/http/test</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocol</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>ctype::AdapterVariant/cname::sap:HTTP/tp::HTTP/mp::None/direction::Sender/version::1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocolVersion</key>
                    <value>1.6.0</value>
                </ifl:property>`;
    }

    /**
     * Generate default receiver adapter properties (HTTP)
     */
    private generateDefaultReceiverProperties(): string {
        return `                <ifl:property>
                    <key>Description</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentNS</key>
                    <value>sap</value>
                </ifl:property>
                <ifl:property>
                    <key>Name</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocolVersion</key>
                    <value>1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVName</key>
                    <value>external</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentType</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVId</key>
                    <value>1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocol</key>
                    <value>None</value>
                </ifl:property>
                <ifl:property>
                    <key>direction</key>
                    <value>Receiver</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.6</value>
                </ifl:property>
                <ifl:property>
                    <key>system</key>
                    <value>Receiver</value>
                </ifl:property>
                <ifl:property>
                    <key>httpMethod</key>
                    <value>POST</value>
                </ifl:property>
                <ifl:property>
                    <key>Address</key>
                    <value>https://target-system.example.com/api</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocol</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>ctype::AdapterVariant/cname::sap:HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.6.0</value>
                </ifl:property>
                <ifl:property>
                    <key>authenticationMethod</key>
                    <value>None</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocolVersion</key>
                    <value>1.6.0</value>
                </ifl:property>`;
    }

    /**
     * Generate a single message flow (adapter)
     */
    private generateMessageFlow(adapter: AdapterConfig, sourceRef: string, targetRef: string): string {
        // Sanitize adapter for SAP CPI compatibility
        const sanitizedAdapter = this.sanitizeAdapter(adapter);

        return `        <bpmn2:messageFlow id="${sanitizedAdapter.id}" name="${this.escapeXml(sanitizedAdapter.name)}" sourceRef="${sourceRef}" targetRef="${targetRef}">
            <bpmn2:extensionElements>
${this.generateAdapterProperties(sanitizedAdapter)}
            </bpmn2:extensionElements>
        </bpmn2:messageFlow>`;
    }

    /**
     * Sanitize adapter configuration for SAP CPI compatibility
     * Fixes common issues with AI-generated adapter configs
     */
    private sanitizeAdapter(adapter: AdapterConfig): AdapterConfig {
        const sanitized = { ...adapter };

        // Mail adapter rules:
        // - Mail/IMAP/POP3 can ONLY be Sender (polling inbox)
        // - For sending emails, use SMTP as Receiver
        if (['Mail', 'IMAP', 'POP3'].includes(adapter.type)) {
            if (adapter.direction === 'Receiver') {
                // AI incorrectly specified Mail as Receiver - convert to SMTP
                console.warn(`[BPMN2 Generator] Mail/IMAP/POP3 cannot be Receiver adapter. Converting to SMTP.`);
                sanitized.type = 'SMTP' as any;
                sanitized.protocol = 'HTTPS' as any;
                sanitized.messageProtocol = 'SMTP';

                // Fix address: convert imap://... to smtp://...
                if (sanitized.address) {
                    if (sanitized.address.startsWith('imap://') || sanitized.address.startsWith('imaps://')) {
                        // Extract host and port from IMAP address
                        const match = sanitized.address.match(/^imaps?:\/\/([^:\/]+)(?::(\d+))?/);
                        if (match) {
                            const host = match[1];
                            const port = match[2] || '587'; // Default SMTP port
                            sanitized.address = `smtp://${host}:${port}`;
                            console.warn(`[BPMN2 Generator] Fixed address from ${adapter.address} to ${sanitized.address}`);
                        }
                    } else if (sanitized.address.startsWith('pop3://') || sanitized.address.startsWith('pop3s://')) {
                        const match = sanitized.address.match(/^pop3s?:\/\/([^:\/]+)(?::(\d+))?/);
                        if (match) {
                            const host = match[1];
                            const port = match[2] || '587';
                            sanitized.address = `smtp://${host}:${port}`;
                            console.warn(`[BPMN2 Generator] Fixed address from ${adapter.address} to ${sanitized.address}`);
                        }
                    }
                }

                // Remove IMAP-specific properties
                if (sanitized.properties) {
                    delete sanitized.properties['mail.store.protocol'];
                    delete sanitized.properties['mail.imap.ssl.enable'];
                    delete sanitized.properties['mail.imap.starttls.enable'];
                    delete sanitized.properties['mail.imap.connectiontimeout'];
                    delete sanitized.properties['mail.imap.timeout'];
                    delete sanitized.properties['read.mode'];
                    delete sanitized.properties['search.criteria'];
                    delete sanitized.properties['mail.imap.use.ssl'];
                    delete sanitized.properties['mail.imap.quit.wait'];
                    delete sanitized.properties['process.mode'];
                }
            } else {
                // Sender Mail adapter - ensure correct protocol settings
                // For IMAP/POP3/Mail sender, SAP CPI uses IMAP/POP3 as TransportProtocol
                // and "Not Applicable" as MessageProtocol
                sanitized.protocol = (adapter.type === 'POP3' ? 'POP3' : 'IMAP') as any;
                sanitized.messageProtocol = 'Not Applicable';
                    
                // Ensure correct component type for SAP CPI
                // SAP CPI expects 'Mail' as the component type for mail sender
                if (adapter.type === 'IMAP' || adapter.type === 'POP3') {
                    sanitized.type = 'Mail' as any;
                }
            }
        }

        // OData adapter - ensure correct type format
        if (adapter.type === 'OData') {
            sanitized.type = 'OData_V2' as any;
        }

        // Ensure protocol is set
        if (!sanitized.protocol) {
            sanitized.protocol = 'HTTPS' as any;
        }

        return sanitized;
    }

    /**
     * Get the transport protocol for an adapter type.
     * SAP CPI uses specific transport protocol names per adapter.
     */
    private getAdapterTransportProtocol(adapterType: string, protocol?: string): string {
        const transportMap: Record<string, string> = {
            'HTTP': 'HTTP',
            'HTTPS': 'HTTPS',
            'SOAP': 'HTTP',
            'SOAP_SAP_RM': 'HTTP',
            'REST': 'HTTP',
            'OData': 'HTTP',
            'OData_V2': 'HTTP',
            'OData_V4': 'HTTP',
            'SFTP': 'SFTP',
            'FTP': 'FTP',
            'FTPS': 'FTPS',
            'Mail': 'IMAP',
            'IMAP': 'IMAP',
            'POP3': 'POP3',
            'SMTP': 'SMTP',
            'IDoc': 'HTTP',
            'RFC': 'RFC',
            'XI': 'XI',
            'JMS': 'JMS',
            'AMQP': 'AMQP',
            'Kafka': 'Kafka',
            'ProcessDirect': 'ProcessDirect',
            'SuccessFactors': 'HTTP',
            'SuccessFactors_SOAP': 'HTTP',
            'SuccessFactors_REST': 'HTTP',
            'SuccessFactors_OData': 'HTTP',
            'Salesforce': 'HTTP',
            'Ariba': 'HTTP',
            'ServiceNow': 'HTTP',
        };
        return transportMap[adapterType] || protocol || 'HTTP';
    }

    /**
     * Get the message protocol for an adapter type.
     * SAP CPI uses specific message protocol names per adapter.
     */
    private getAdapterMessageProtocol(adapterType: string, messageProtocol?: string): string {
        const msgProtocolMap: Record<string, string> = {
            'HTTP': 'None',
            'HTTPS': 'None',
            'SOAP': 'SOAP 1.x',
            'SOAP_SAP_RM': 'SAP RM',
            'REST': 'None',
            'OData': 'OData',
            'OData_V2': 'OData',
            'OData_V4': 'ODataV4',
            'SFTP': 'Not Applicable',
            'FTP': 'Not Applicable',
            'FTPS': 'Not Applicable',
            'Mail': 'Not Applicable',
            'IMAP': 'Not Applicable',
            'POP3': 'Not Applicable',
            'SMTP': 'Not Applicable',
            'IDoc': 'IDoc',
            'RFC': 'RFC',
            'XI': 'XI 3.0',
            'JMS': 'Not Applicable',
            'AMQP': 'Not Applicable',
            'Kafka': 'Not Applicable',
            'ProcessDirect': 'Not Applicable',
            'SuccessFactors': 'REST',
            'SuccessFactors_SOAP': 'SOAP 1.x',
            'SuccessFactors_REST': 'REST',
            'SuccessFactors_OData': 'OData',
            'Salesforce': 'REST',
            'Ariba': 'REST',
            'ServiceNow': 'REST',
        };
        return msgProtocolMap[adapterType] || messageProtocol || 'None';
    }

    /**
     * Get the short component version (e.g., "1.13.0" -> "1.13") for adapter cmdVariantUri
     */
    private getShortComponentVersion(adapterType: string): string {
        const fullVersion = this.getAdapterVersion(adapterType);
        // Remove trailing ".0" for the short version (e.g., "1.13.0" -> "1.13")
        return fullVersion.replace(/\.0$/, '');
    }

    /**
     * Generate the cmdVariantUri for an adapter.
     * Pattern: ctype::AdapterVariant/cname::sap:<ComponentType>/tp::<TransportProtocol>/mp::<MessageProtocol>/direction::<direction>/version::<ComponentSWCVId>
     */
    private getAdapterCmdVariantUri(adapter: AdapterConfig): string {
        const componentType = adapter.type;
        const transportProtocol = this.getAdapterTransportProtocol(adapter.type, adapter.protocol);
        const messageProtocol = this.getAdapterMessageProtocol(adapter.type, adapter.messageProtocol);
        const direction = adapter.direction;
        const version = this.getAdapterVersion(adapter.type);
        return `ctype::AdapterVariant/cname::sap:${componentType}/tp::${transportProtocol}/mp::${messageProtocol}/direction::${direction}/version::${version}`;
    }

    /**
     * Generate adapter properties in SAP CPI format
     */
    private generateAdapterProperties(adapter: AdapterConfig): string {
        const adapterVersion = this.getAdapterVersion(adapter.type);
        const transportProtocol = this.getAdapterTransportProtocol(adapter.type, adapter.protocol);
        const messageProtocol = this.getAdapterMessageProtocol(adapter.type, adapter.messageProtocol);
        const shortVersion = this.getShortComponentVersion(adapter.type);

        const properties: [string, string][] = [];

        // Add adapter-specific properties FIRST (before common properties) for Mail
        // This matches the SAP CPI reference format where adapter properties come first
        if (['Mail', 'IMAP', 'POP3', 'SMTP'].includes(adapter.type)) {
            this.addMailProperties(properties, adapter as any);
        }

        // Common adapter properties (these go after adapter-specific for Mail, matching reference)
        properties.push(
            ['Description', ''],
            ['ComponentNS', 'sap'],
            ['Name', adapter.name || adapter.type],
            ['TransportProtocolVersion', adapterVersion],
            ['ComponentSWCVName', 'external'],
            ['MessageProtocol', messageProtocol],
            ['ComponentSWCVId', adapterVersion],
            ['direction', adapter.direction],
            ['ComponentType', adapter.type],
            ['componentVersion', shortVersion],
            ['system', adapter.direction === 'Sender' ? 'Sender' : 'Receiver'],
        );

        if (adapter.address) {
            properties.push(['Address', adapter.address]);
        }

        // Add TransportProtocol and cmdVariantUri near the end (matching reference order)
        properties.push(
            ['TransportProtocol', transportProtocol],
            ['cmdVariantUri', this.getAdapterCmdVariantUri(adapter)],
            ['MessageProtocolVersion', adapterVersion],
        );

        if (adapter.timeout) {
            properties.push(['requestTimeout', adapter.timeout.toString()]);
        }
        if (adapter.connectionTimeout) {
            properties.push(['connectionTimeout', adapter.connectionTimeout.toString()]);
        }
        if (adapter.authentication?.type) {
            properties.push(['authenticationMethod', adapter.authentication.type]);
        }

        // Add RFC-specific properties
        if (adapter.type === 'RFC') {
            this.addRFCProperties(properties, adapter as any);
        }

        // Add IDoc-specific properties
        if (adapter.type === 'IDoc') {
            this.addIDocProperties(properties, adapter as any);
        }

        // Add XI-specific properties
        if (adapter.type === 'XI') {
            this.addXIProperties(properties, adapter as any);
        }

        // Add custom properties
        if (adapter.properties) {
            Object.entries(adapter.properties).forEach(([key, value]) => {
                properties.push([key, String(value)]);
            });
        }

        return properties.map(([key, value]) =>
            `                <ifl:property>
                    <key>${this.escapeXml(key)}</key>
                    <value>${this.escapeXml(value)}</value>
                </ifl:property>`
        ).join('\n');
    }

    /**
     * Add RFC adapter specific properties
     */
    private addRFCProperties(properties: [string, string][], adapter: any): void {
        // RFC Connection Settings
        if (adapter.rfcDestination) {
            properties.push(['rfcDestination', adapter.rfcDestination]);
        }
        if (adapter.sapClient) {
            properties.push(['sapClient', adapter.sapClient]);
        }
        if (adapter.sapLanguage) {
            properties.push(['sapLanguage', adapter.sapLanguage]);
        }

        // Function Module Settings
        if (adapter.functionModule) {
            properties.push(['functionModule', adapter.functionModule]);
        }

        // Transaction Settings
        if (adapter.transactionCommit !== undefined) {
            properties.push(['transactionCommit', adapter.transactionCommit.toString()]);
        }
        if (adapter.queueName) {
            properties.push(['queueName', adapter.queueName]);
        }

        // RFC Type
        if (adapter.rfcType) {
            properties.push(['rfcType', adapter.rfcType]);
        }
        if (adapter.trfcEnabled !== undefined) {
            properties.push(['trfcEnabled', adapter.trfcEnabled.toString()]);
        }
        if (adapter.qrfcEnabled !== undefined) {
            properties.push(['qrfcEnabled', adapter.qrfcEnabled.toString()]);
        }

        // Set transport protocol for RFC
        properties.push(['TransportProtocol', 'RFC']);
        properties.push(['MessageProtocol', 'RFC']);
    }

    /**
     * Add IDoc adapter specific properties
     */
    private addIDocProperties(properties: [string, string][], adapter: any): void {
        // IDoc Connection Settings
        if (adapter.idocDestination) {
            properties.push(['idocDestination', adapter.idocDestination]);
        }
        if (adapter.sapClient) {
            properties.push(['sapClient', adapter.sapClient]);
        }
        if (adapter.sapLanguage) {
            properties.push(['sapLanguage', adapter.sapLanguage]);
        }

        // IDoc Settings
        if (adapter.idocType) {
            properties.push(['idocType', adapter.idocType]);
        }
        if (adapter.idocExtension) {
            properties.push(['idocExtension', adapter.idocExtension]);
        }
        if (adapter.messageType) {
            properties.push(['messageType', adapter.messageType]);
        }
        if (adapter.basicType) {
            properties.push(['basicType', adapter.basicType]);
        }

        // Partner Settings
        if (adapter.senderPartnerNumber) {
            properties.push(['senderPartnerNumber', adapter.senderPartnerNumber]);
        }
        if (adapter.senderPartnerType) {
            properties.push(['senderPartnerType', adapter.senderPartnerType]);
        }
        if (adapter.receiverPartnerNumber) {
            properties.push(['receiverPartnerNumber', adapter.receiverPartnerNumber]);
        }
        if (adapter.receiverPartnerType) {
            properties.push(['receiverPartnerType', adapter.receiverPartnerType]);
        }
        if (adapter.senderPort) {
            properties.push(['senderPort', adapter.senderPort]);
        }
        if (adapter.receiverPort) {
            properties.push(['receiverPort', adapter.receiverPort]);
        }

        // Control Record Settings
        if (adapter.sendrprn) properties.push(['sendrprn', adapter.sendrprn]);
        if (adapter.sndpor) properties.push(['sndpor', adapter.sndpor]);
        if (adapter.rcvprn) properties.push(['rcvprn', adapter.rcvprn]);
        if (adapter.rcvpor) properties.push(['rcvpor', adapter.rcvpor]);
        if (adapter.mestyp) properties.push(['mestyp', adapter.mestyp]);
        if (adapter.idoctyp) properties.push(['idoctyp', adapter.idoctyp]);
        if (adapter.cimtyp) properties.push(['cimtyp', adapter.cimtyp]);

        // Processing Settings
        if (adapter.idocVersion) {
            properties.push(['idocVersion', adapter.idocVersion]);
        }
        if (adapter.testMode !== undefined) {
            properties.push(['testMode', adapter.testMode.toString()]);
        }
        if (adapter.serialization) {
            properties.push(['serialization', adapter.serialization]);
        }
        if (adapter.packageSize) {
            properties.push(['packageSize', adapter.packageSize.toString()]);
        }
        if (adapter.contentType) {
            properties.push(['contentType', adapter.contentType]);
        }

        // Set transport protocol for IDoc
        properties.push(['TransportProtocol', 'IDoc']);
        properties.push(['MessageProtocol', 'IDoc']);
    }

    /**
     * Add XI adapter specific properties
     */
    private addXIProperties(properties: [string, string][], adapter: any): void {
        // XI Connection Settings
        if (adapter.xiUrl) {
            properties.push(['xiUrl', adapter.xiUrl]);
        }
        if (adapter.senderService) {
            properties.push(['senderService', adapter.senderService]);
        }
        if (adapter.senderParty) {
            properties.push(['senderParty', adapter.senderParty]);
        }
        if (adapter.senderAgency) {
            properties.push(['senderAgency', adapter.senderAgency]);
        }
        if (adapter.senderScheme) {
            properties.push(['senderScheme', adapter.senderScheme]);
        }

        // Receiver Settings
        if (adapter.receiverService) {
            properties.push(['receiverService', adapter.receiverService]);
        }
        if (adapter.receiverParty) {
            properties.push(['receiverParty', adapter.receiverParty]);
        }
        if (adapter.receiverAgency) {
            properties.push(['receiverAgency', adapter.receiverAgency]);
        }
        if (adapter.receiverScheme) {
            properties.push(['receiverScheme', adapter.receiverScheme]);
        }

        // Interface Settings
        if (adapter.interfaceNamespace) {
            properties.push(['interfaceNamespace', adapter.interfaceNamespace]);
        }
        if (adapter.interfaceName) {
            properties.push(['interfaceName', adapter.interfaceName]);
        }
        if (adapter.operationName) {
            properties.push(['operationName', adapter.operationName]);
        }

        // Quality of Service
        if (adapter.qualityOfService) {
            properties.push(['qualityOfService', adapter.qualityOfService]);
        }
        if (adapter.queueId) {
            properties.push(['queueId', adapter.queueId]);
        }

        // Message Settings
        if (adapter.communicationChannel) {
            properties.push(['communicationChannel', adapter.communicationChannel]);
        }
        if (adapter.communicationComponent) {
            properties.push(['communicationComponent', adapter.communicationComponent]);
        }

        // Advanced Settings
        if (adapter.deliveryAssurance) {
            properties.push(['deliveryAssurance', adapter.deliveryAssurance]);
        }
        if (adapter.temporaryStorage) {
            properties.push(['temporaryStorage', adapter.temporaryStorage]);
        }
        if (adapter.acknowledgmentMode) {
            properties.push(['acknowledgmentMode', adapter.acknowledgmentMode]);
        }

        // Retry Settings
        if (adapter.retryInterval) {
            properties.push(['retryInterval', adapter.retryInterval.toString()]);
        }
        if (adapter.maxRetries) {
            properties.push(['maxRetries', adapter.maxRetries.toString()]);
        }
        if (adapter.exponentialBackoff !== undefined) {
            properties.push(['exponentialBackoff', adapter.exponentialBackoff.toString()]);
        }

        // Set transport protocol for XI
        properties.push(['TransportProtocol', 'XI']);
        properties.push(['MessageProtocol', 'XI']);
    }

    /**
     * Add Mail adapter specific properties matching SAP CPI reference format.
     * Supports IMAP (Sender), POP3 (Sender), and SMTP (Receiver) adapters.
     * Property names and values match exactly what SAP CPI expects.
     * 
     * Based on reference iFlow analysis: the Mail sender adapter has built-in scheduling
     * via the `scheduleKey` property — NO separate timer start event is needed.
     */
    private addMailProperties(properties: [string, string][], adapter: any): void {
        const isSender = adapter.direction === 'Sender';
        
        // Helper to get value from adapter properties with fallback
        const getProp = (keys: string[], defaultVal: string = ''): string => {
            for (const key of keys) {
                if (adapter.properties?.[key] !== undefined) return String(adapter.properties[key]);
            }
            return defaultVal;
        };
        
        // Extract server from address if not directly provided
        let server = adapter.mailServer || adapter.properties?.server || '';
        if (!server && adapter.address) {
            const match = adapter.address.match(/^(?:imaps?|pop3s?|smtp):\/\/([^:\/]+)/i);
            if (match) server = match[1];
        }
        
        if (isSender) {
            // === IMAP/POP3 Sender adapter properties (matches SAP CPI reference exactly) ===
            properties.push(['server', server]);
            properties.push(['disconnect', getProp(['disconnect'], '1')]);
            properties.push(['archiveMailFolder', getProp(['archiveMailFolder'], '')]);
            
            // Authentication - SAP CPI uses specific auth values
            const authType = adapter.authentication?.type;
            let auth = 'loginEncrypted';
            if (authType === 'OAuth2' || authType === 'OAuth2ClientCredentials') {
                auth = 'OAuth2ClientCredentials';
            } else if (authType === 'None') {
                auth = 'none';
            }
            properties.push(['auth', getProp(['auth'], auth)]);
            
            // Read flag selection  
            properties.push(['selectionReadFlag', getProp(['selectionReadFlag'], 'unread')]);
            
            // SSL/TLS settings
            properties.push(['ssl', getProp(['ssl', 'protection'], 'starttls_mandatory')]);
            
            // Timeout
            properties.push(['timeout', getProp(['timeout'], '3000')]);
            
            // Proxy settings
            properties.push(['proxyPort', getProp(['proxyPort'], '8080')]);
            
            // Post-processing action (what to do with email after reading)
            properties.push(['postProcessing', getProp(['postProcessing'], 'delete')]);
            
            // Location ID (for Cloud Connector)
            properties.push(['locationId', getProp(['locationId'], '')]);
            
            // MIME decode headers
            properties.push(['mimeDecodeHeaders', getProp(['mimeDecodeHeaders'], '1')]);
            
            // Max messages per poll
            properties.push(['maxMessagesPerPoll', getProp(['maxMessagesPerPoll', 'maxMessagesToProcess'], '20')]);
            
            // Lock duration (to prevent parallel processing)
            properties.push(['lockDuration', getProp(['lockDuration'], '60')]);
            
            // Proxy settings
            properties.push(['proxyProtocol', getProp(['proxyProtocol'], 'socks5')]);
            properties.push(['proxyType', getProp(['proxyType'], 'none')]);
            properties.push(['proxyAlias', getProp(['proxyAlias'], '')]);
            
            // Remove attachments flag
            properties.push(['removeAttachments', getProp(['removeAttachments'], '0')]);
            
            // Proxy host
            properties.push(['proxyHost', getProp(['proxyHost'], '')]);
            
            // Forward original mail
            properties.push(['forwardOriginalMail', getProp(['forwardOriginalMail'], '0')]);
            
            // Mail folder to read from
            properties.push(['folder', getProp(['folder', 'folderName'], 'INBOX')]);
            
            // Schedule key - built-in scheduler for mail polling
            // This is the KEY property that enables scheduling without a separate timer start event
            // Use raw angle brackets — escapeXml() will convert them to &lt; &gt; automatically
            const defaultScheduleKey = '<row><cell>dayValue</cell><cell></cell></row><row><cell>monthValue</cell><cell></cell></row><row><cell>yearValue</cell><cell></cell></row><row><cell>dateType</cell><cell>DAILY</cell></row><row><cell>secondValue</cell><cell>0</cell></row><row><cell>minutesValue</cell><cell></cell></row><row><cell>hourValue</cell><cell></cell></row><row><cell>toInterval</cell><cell>24</cell></row><row><cell>fromInterval</cell><cell>0</cell></row><row><cell>OnEverySecond</cell><cell>10</cell></row><row><cell>timeType</cell><cell>TIME_SECOND_INTERVAL</cell></row><row><cell>timeZone</cell><cell>( UTC 0:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0/10</cell></row><row><cell>minute</cell><cell>*</cell></row><row><cell>hour</cell><cell>0-24</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isRunOnceRequired,isScheduleOnDayRequired,isScheduleRecurRequired</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0/10+*+0-23+?+*+*+*&amp;trigger.timeZone=Etc/GMT</cell></row>';
            properties.push(['scheduleKey', getProp(['scheduleKey'], defaultScheduleKey)]);
            
            // Token credential (for OAuth2)
            properties.push(['tokenCredential', getProp(['tokenCredential'], '')]);
            
            // User credential
            if (adapter.authentication?.credentialName) {
                properties.push(['user', adapter.authentication.credentialName]);
            } else {
                properties.push(['user', getProp(['user'], '')]);
            }
        } else {
            // === SMTP Receiver adapter properties ===
            properties.push(['server', server]);
            
            // Authentication
            const authType = adapter.authentication?.type;
            let auth = 'loginEncrypted';
            if (authType === 'None') auth = 'none';
            properties.push(['auth', getProp(['auth'], auth)]);
            
            // SSL/TLS
            properties.push(['ssl', getProp(['ssl', 'protection'], 'starttls_mandatory')]);
            
            // Timeout
            properties.push(['timeout', getProp(['timeout'], '3000')]);
            
            // From / To / CC / BCC / Subject
            if (adapter.properties?.from) properties.push(['from', adapter.properties.from]);
            if (adapter.properties?.to) properties.push(['to', adapter.properties.to]);
            if (adapter.properties?.cc) properties.push(['cc', adapter.properties.cc]);
            if (adapter.properties?.bcc) properties.push(['bcc', adapter.properties.bcc]);
            if (adapter.properties?.subject) properties.push(['subject', adapter.properties.subject]);
            
            // Content type
            properties.push(['mailContentType', getProp(['mailContentType'], 'text/plain')]);
            
            // Proxy settings
            properties.push(['proxyType', getProp(['proxyType'], 'none')]);
            properties.push(['proxyHost', getProp(['proxyHost'], '')]);
            properties.push(['proxyPort', getProp(['proxyPort'], '8080')]);
            properties.push(['proxyProtocol', getProp(['proxyProtocol'], 'socks5')]);
            properties.push(['locationId', getProp(['locationId'], '')]);
            
            // User credential
            if (adapter.authentication?.credentialName) {
                properties.push(['user', adapter.authentication.credentialName]);
            } else {
                properties.push(['user', getProp(['user'], '')]);
            }
        }
    }

    /**
     * Generate process section with activities
     */
    private generateProcess(design: IFlowDesign, processId: string, isTimerTriggered: boolean = false): string {
        const activities: string[] = [];
        const sequenceFlows: string[] = [];

        // Determine the start event ID - must be consistent across process and diagram
        const startEventId = isTimerTriggered && design.timerConfig?.id
            ? design.timerConfig.id
            : 'StartEvent_1';

        // Start event - either message or timer based
        if (isTimerTriggered && design.timerConfig) {
            activities.push(this.generateTimerStartEvent(design.timerConfig));
        } else {
            activities.push(`        <bpmn2:startEvent id="${startEventId}" name="Start 1">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>ctype::FlowstepVariant/cname::MessageStartEvent</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:outgoing>SequenceFlow_1</bpmn2:outgoing>
            <bpmn2:messageEventDefinition/>
        </bpmn2:startEvent>`);
        }

        let sequenceCounter = 1;
        let previousId = startEventId;  // Use the determined start event ID
        const allElements: { id: string; type: string }[] = [];

        // Collect all elements in order based on flow design
        // Process converters first (often used early in the flow)
        if (design.converters) {
            design.converters.forEach(conv => allElements.push({ id: conv.id, type: 'converter' }));
        }

        // Process content modifiers
        if (design.contentModifiers) {
            design.contentModifiers.forEach(cm => allElements.push({ id: cm.id, type: 'contentModifier' }));
        }

        // Process XML validators
        if (design.xmlValidators) {
            design.xmlValidators.forEach(xv => allElements.push({ id: xv.id, type: 'xmlValidator' }));
        }

        // Process security components (decryptors/verifiers first for incoming)
        if (design.decryptors) {
            design.decryptors.forEach(dec => allElements.push({ id: dec.id, type: 'decryptor' }));
        }
        if (design.verifiers) {
            design.verifiers.forEach(ver => allElements.push({ id: ver.id, type: 'verifier' }));
        }

        // Process scripts
        design.scripts.forEach(script => allElements.push({ id: script.id, type: 'script' }));

        // Process routers (may branch the flow)
        if (design.routers) {
            design.routers.forEach(router => allElements.push({ id: router.id, type: 'router' }));
        }

        // Process splitters
        if (design.splitters) {
            design.splitters.forEach(splitter => allElements.push({ id: splitter.id, type: 'splitter' }));
        }

        // Process multicasts
        if (design.multicasts) {
            design.multicasts.forEach(multicast => allElements.push({ id: multicast.id, type: 'multicast' }));
        }

        // Process mappings
        design.mappings.forEach(mapping => allElements.push({ id: mapping.id, type: 'mapping' }));

        // Process aggregators
        if (design.aggregators) {
            design.aggregators.forEach(agg => allElements.push({ id: agg.id, type: 'aggregator' }));
        }

        // Process joins
        if (design.joins) {
            design.joins.forEach(join => allElements.push({ id: join.id, type: 'join' }));
        }

        // Process filters
        if (design.filters) {
            design.filters.forEach(filter => allElements.push({ id: filter.id, type: 'filter' }));
        }

        // Process data stores
        if (design.dataStores) {
            design.dataStores.forEach(ds => allElements.push({ id: ds.id, type: 'dataStore' }));
        }

        // Process variables
        if (design.variables) {
            design.variables.forEach(v => allElements.push({ id: v.id, type: 'variable' }));
        }

        // Process request-reply calls
        if (design.requestReplies) {
            design.requestReplies.forEach(rr => allElements.push({ id: rr.id, type: 'requestReply' }));
        }

        // Process content enrichers
        if (design.contentEnrichers) {
            design.contentEnrichers.forEach(ce => allElements.push({ id: ce.id, type: 'contentEnricher' }));
        }

        // Process security components (encryptors/signers last for outgoing)
        if (design.signers) {
            design.signers.forEach(sig => allElements.push({ id: sig.id, type: 'signer' }));
        }
        if (design.encryptors) {
            design.encryptors.forEach(enc => allElements.push({ id: enc.id, type: 'encryptor' }));
        }

        // If no process elements exist, connect start event directly to end event.

        // Generate activities based on element type
        for (const element of allElements) {
            const currentId = element.id;
            const incomingFlow = `SequenceFlow_${sequenceCounter}`;
            const outgoingFlow = `SequenceFlow_${sequenceCounter + 1}`;

            switch (element.type) {
                case 'script':
                    const script = design.scripts.find(s => s.id === element.id);
                    if (script) {
                        activities.push(this.generateScript(script, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'mapping':
                    const mapping = design.mappings.find(m => m.id === element.id);
                    if (mapping) {
                        activities.push(this.generateMapping(mapping, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'router':
                    const router = design.routers?.find(r => r.id === element.id);
                    if (router) {
                        activities.push(this.generateRouter(router, incomingFlow));
                        // Generate sequence flows for each route
                        router.routingConditions.forEach((condition, idx) => {
                            sequenceFlows.push(this.generateRoutingSequenceFlow(condition, router.id));
                        });
                        // Add default route if exists
                        if (router.defaultRoute) {
                            sequenceFlows.push(`        <bpmn2:sequenceFlow id="${router.id}_default" name="Default" sourceRef="${router.id}" targetRef="${router.defaultRoute}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>expressionType</key>
                    <value>Default</value>
                </ifl:property>
            </bpmn2:extensionElements>
        </bpmn2:sequenceFlow>`);
                        }
                    }
                    break;

                case 'multicast':
                    const multicast = design.multicasts?.find(m => m.id === element.id);
                    if (multicast) {
                        activities.push(this.generateMulticast(multicast, incomingFlow));
                        // Generate sequence flows for each branch
                        multicast.branches.forEach(branch => {
                            sequenceFlows.push(`        <bpmn2:sequenceFlow id="${branch.id}_flow" sourceRef="${multicast.id}" targetRef="${branch.targetId}"/>`);
                        });
                    }
                    break;

                case 'splitter':
                    const splitter = design.splitters?.find(s => s.id === element.id);
                    if (splitter) {
                        activities.push(this.generateSplitter(splitter, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'aggregator':
                    const aggregator = design.aggregators?.find(a => a.id === element.id);
                    if (aggregator) {
                        activities.push(this.generateAggregator(aggregator, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'join':
                    const join = design.joins?.find(j => j.id === element.id);
                    if (join) {
                        activities.push(this.generateJoin(join, outgoingFlow));
                    }
                    break;

                case 'filter':
                    const filter = design.filters?.find(f => f.id === element.id);
                    if (filter) {
                        activities.push(this.generateFilter(filter, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'converter':
                    const converter = design.converters?.find(c => c.id === element.id);
                    if (converter) {
                        activities.push(this.generateConverter(converter, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'contentModifier':
                    const cm = design.contentModifiers?.find(c => c.id === element.id);
                    if (cm) {
                        activities.push(this.generateContentModifierStep(cm, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'xmlValidator':
                    const xv = design.xmlValidators?.find(x => x.id === element.id);
                    if (xv) {
                        activities.push(this.generateXMLValidator(xv, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'encryptor':
                    const enc = design.encryptors?.find(e => e.id === element.id);
                    if (enc) {
                        activities.push(this.generateEncryptor(enc, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'decryptor':
                    const dec = design.decryptors?.find(d => d.id === element.id);
                    if (dec) {
                        activities.push(this.generateDecryptor(dec, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'signer':
                    const sig = design.signers?.find(s => s.id === element.id);
                    if (sig) {
                        activities.push(this.generateSigner(sig, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'verifier':
                    const ver = design.verifiers?.find(v => v.id === element.id);
                    if (ver) {
                        activities.push(this.generateVerifier(ver, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'dataStore':
                    const ds = design.dataStores?.find(d => d.id === element.id);
                    if (ds) {
                        activities.push(this.generateDataStore(ds, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'variable':
                    const variable = design.variables?.find(v => v.id === element.id);
                    if (variable) {
                        activities.push(this.generateVariable(variable, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'requestReply':
                    const rr = design.requestReplies?.find(r => r.id === element.id);
                    if (rr) {
                        activities.push(this.generateRequestReply(rr, incomingFlow, outgoingFlow));
                    }
                    break;

                case 'contentEnricher':
                    const ce = design.contentEnrichers?.find(c => c.id === element.id);
                    if (ce) {
                        activities.push(this.generateContentEnricher(ce, incomingFlow, outgoingFlow));
                    }
                    break;
            }

            // Add sequence flow connecting previous element to current
            // Routers, multicasts, joins need their incoming flow defined
            // but they generate their own outgoing flows
            if (element.type === 'router' || element.type === 'multicast') {
                // These have their own outgoing sequence flows, but still need incoming
                sequenceFlows.push(`        <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${currentId}"/>`);
            } else if (element.type !== 'join') {
                // Normal elements get a sequence flow from previous element
                sequenceFlows.push(`        <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${currentId}"/>`);
            }
            // Join elements typically converge multiple flows - they use the incoming flows defined by their sources

            previousId = currentId;
            sequenceCounter++;
        }

        // Final sequence flow to end
        sequenceFlows.push(`        <bpmn2:sequenceFlow id="SequenceFlow_${sequenceCounter}" sourceRef="${previousId}" targetRef="EndEvent_1"/>`);

        // End event with message event definition
        activities.push(`        <bpmn2:endEvent id="EndEvent_1" name="End 1">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>ctype::FlowstepVariant/cname::MessageEndEvent</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:incoming>SequenceFlow_${sequenceCounter}</bpmn2:incoming>
            <bpmn2:messageEventDefinition/>
        </bpmn2:endEvent>`);

        // Add exception subprocesses
        if (design.exceptionSubprocesses) {
            design.exceptionSubprocesses.forEach(esp => {
                activities.push(this.generateExceptionSubprocess(esp));
            });
        }

        // Combine all elements
        const allProcessContent = [...activities, ...sequenceFlows];

        return `    <bpmn2:process id="${processId}" name="${this.escapeXml(design.metadata.name)}">
        <bpmn2:extensionElements>
            <ifl:property>
                <key>cmdVariantUri</key>
                <value>ctype::FlowElementVariant/cname::IntegrationProcess</value>
            </ifl:property>
        </bpmn2:extensionElements>
${allProcessContent.join('\n')}
    </bpmn2:process>`;
    }

    /**
     * Generate a content modifier activity
     */
    private generateContentModifier(id: string, name: string, incoming: string, outgoing: string): string {
        const emptyCm: ContentModifierConfig = { id, name };
        const tableProps = this.generateContentModifierTableProperties(emptyCm);
        const wrapContent = '';

        return `        <bpmn2:callActivity id="${id}" name="${this.escapeXml(name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>bodyType</key>
                    <value>constant</value>
                </ifl:property>
${tableProps}
                <ifl:property>
                    <key>wrapContent</key>
                    <value>${wrapContent}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('ContentModifier')}</value>
                </ifl:property>
${this.generateCmdVariantProperty('Enricher', this.getComponentVersion('ContentModifier'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate script activity (callActivity)
     */
    private generateScript(script: ScriptConfig, incoming: string, outgoing: string): string {
        const scriptType = script.type === 'groovy' ? 'GroovyScript'
            : script.type === 'javascript' ? 'JavaScriptScript'
                : 'XSLTScript';

        // SAP CPI expects a resource path here, not inline script content.
        const scriptValue = this.escapeXml(this.normalizeScriptPath(script));

        return `        <bpmn2:callActivity id="${script.id}" name="${this.escapeXml(script.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Script</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${scriptType}</value>
                </ifl:property>
                <ifl:property>
                    <key>script</key>
                    <value>${scriptValue}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Script')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(scriptType, this.getComponentVersion('Script'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate mapping activity (callActivity)
     * Note: MessageMapping requires a separate .mmap resource file to be created
     * For AI-generated flows, we include a placeholder that shows what mapping is needed
     */
    private generateMapping(mapping: MappingConfig, incoming: string, outgoing: string): string {
        if (mapping.type === 'ContentModifier') {
            return this.generateContentModifier(mapping.id, mapping.name, incoming, outgoing);
        }
        if (mapping.type === 'Enricher') {
            return this.generateContentModifier(mapping.id, mapping.name, incoming, outgoing);
        }

        // For MessageMapping, we need to specify the mapping resource
        // The resource file needs to be created separately
        const isMessageMapping = mapping.type === 'MessageMapping';
        const isXsltMapping = mapping.type === 'XSLTMapping';
        const subType = isXsltMapping ? 'XSLTMapping' : 'MessageMapping';
        const resourceName = `${mapping.id}_mapping`;
        
        // Build property list for mappings
        let mappingProperties = `                <ifl:property>
                    <key>activityType</key>
                    <value>Mapping</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${subType}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('MessageMapping')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(subType, this.getComponentVersion('MessageMapping'))}`;
        
        // For MessageMapping, add resource reference if we have mapping details
        if (isMessageMapping || isXsltMapping) {
            // Include mapping resource name - this helps SAP CPI know what resource to look for
            // The actual .mmap file needs to be created separately
            const mappingPath = isXsltMapping
                ? `src/main/resources/mapping/${resourceName}`
                : `mapping/${resourceName}.mmap`;
            mappingProperties += `
                <ifl:property>
                    <key>mappingname</key>
                    <value>${resourceName}</value>
                </ifl:property>
                <ifl:property>
                    <key>mappingpath</key>
                    <value>${mappingPath}</value>
                </ifl:property>
                <ifl:property>
                    <key>mappingType</key>
                    <value>${subType}</value>
                </ifl:property>`;
                
            // Add source/target type hints if available
            if (mapping.sourceFields && mapping.sourceFields.length > 0) {
                mappingProperties += `
                <ifl:property>
                    <key>sourceFields</key>
                    <value>${this.escapeXml(mapping.sourceFields.join(','))}</value>
                </ifl:property>`;
            }
            if (mapping.targetFields && mapping.targetFields.length > 0) {
                mappingProperties += `
                <ifl:property>
                    <key>targetFields</key>
                    <value>${this.escapeXml(mapping.targetFields.join(','))}</value>
                </ifl:property>`;
            }
            if (mapping.transformations && mapping.transformations.length > 0) {
                mappingProperties += `
                <ifl:property>
                    <key>transformationNotes</key>
                    <value>${this.escapeXml(mapping.transformations.join('; '))}</value>
                </ifl:property>`;
            }
        }
        
        return `        <bpmn2:callActivity id="${mapping.id}" name="${this.escapeXml(mapping.name)}">
            <bpmn2:extensionElements>
${mappingProperties}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Ensure script reference points to the path used inside the ZIP package.
     */
    private normalizeScriptPath(script: ScriptConfig): string {
        const extension = script.type === 'javascript' ? '.js'
            : script.type === 'xslt' ? '.xslt'
                : '.groovy';

        const fallbackFileName = script.name.endsWith(extension)
            ? script.name
            : `${script.name}${extension}`;

        const rawPath = (script.scriptPath || fallbackFileName).trim().replace(/\\/g, '/');
        if (!rawPath) {
            return `script/${fallbackFileName}`;
        }

        // SAP CPI BPMN2 expects bundle-relative paths (e.g., script/name.groovy)
        // NOT full ZIP entry paths (src/main/resources/script/name.groovy).
        // The ZIP structure uses src/main/resources/ prefix, but the BPMN2 reference
        // must be relative to the bundle root for SAP CPI runtime to resolve it.
        if (rawPath.startsWith('src/main/resources/')) {
            return rawPath.replace('src/main/resources/', '');
        }
        if (rawPath.startsWith('script/')) {
            return rawPath;
        }
        if (rawPath.startsWith('src/')) {
            // Handle other src/ paths by stripping prefix
            return rawPath.replace(/^src\/main\/resources\//, '');
        }
        // Bare filename — prefix with script/ folder
        return `script/${rawPath}`;
    }

    // ========================================================================
    // TIMER / SCHEDULER COMPONENTS
    // ========================================================================

    /**
     * Generate timer start event
     */
    private generateTimerStartEvent(config: TimerStartEventConfig): string {
        const timerDefinition = config.scheduleType === 'RunOnce'
            ? '<bpmn2:timeDate>2024-01-01T00:00:00Z</bpmn2:timeDate>'
            : `<bpmn2:timeCycle>${this.escapeXml(config.cronExpression || '0 0 * * * ?')}</bpmn2:timeCycle>`;

        // Use config.id if provided, otherwise fall back to StartEvent_1
        const startEventId = config.id || 'StartEvent_1';

        return `        <bpmn2:startEvent id="${startEventId}" name="${this.escapeXml(config.name || 'Timer Start')}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Timer')}</value>
                </ifl:property>
                <ifl:property>
                    <key>scheduleType</key>
                    <value>${config.scheduleType}</value>
                </ifl:property>
                ${config.scheduleType === 'Schedule' ? `<ifl:property>
                    <key>scheduleKey</key>
                    <value>timer_${startEventId}</value>
                </ifl:property>` : ''}
                ${config.runOnDeployment ? `<ifl:property>
                    <key>runOnDeployment</key>
                    <value>true</value>
                </ifl:property>` : ''}
                ${config.timezone ? `<ifl:property>
                    <key>timezone</key>
                    <value>${this.escapeXml(config.timezone)}</value>
                </ifl:property>` : ''}
${this.generateCmdVariantProperty('Timer', this.getComponentVersion('Timer'))}
            </bpmn2:extensionElements>
            <bpmn2:outgoing>SequenceFlow_1</bpmn2:outgoing>
            <bpmn2:timerEventDefinition>
                ${timerDefinition}
            </bpmn2:timerEventDefinition>
        </bpmn2:startEvent>`;
    }

    // ========================================================================
    // FLOW CONTROL COMPONENTS
    // ========================================================================

    /**
     * Generate router (exclusive gateway)
     */
    private generateRouter(router: RouterConfig, incoming: string): string {
        const outgoingFlows = router.routingConditions.map(c => c.id).join('</bpmn2:outgoing>\n            <bpmn2:outgoing>');
        const defaultAttr = router.defaultRoute ? ` default="${router.id}_default"` : '';

        return `        <bpmn2:exclusiveGateway id="${router.id}" name="${this.escapeXml(router.name)}"${defaultAttr}>
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Router')}</value>
                </ifl:property>
                <ifl:property>
                    <key>activityType</key>
                    <value>Router</value>
                </ifl:property>
                ${router.throwExceptionOnNoMatch ? `<ifl:property>
                    <key>throwExceptionOnNoMatch</key>
                    <value>true</value>
                </ifl:property>` : ''}
${this.generateCmdVariantProperty('Router', this.getComponentVersion('Router'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoingFlows}</bpmn2:outgoing>
            ${router.defaultRoute ? `<bpmn2:outgoing>${router.id}_default</bpmn2:outgoing>` : ''}
        </bpmn2:exclusiveGateway>`;
    }

    /**
     * Generate routing sequence flow with condition
     */
    private generateRoutingSequenceFlow(condition: RoutingCondition, routerId: string): string {
        return `        <bpmn2:sequenceFlow id="${condition.id}" name="${this.escapeXml(condition.name)}" sourceRef="${routerId}" targetRef="${condition.targetId}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>expressionType</key>
                    <value>${condition.expressionType}</value>
                </ifl:property>
                <ifl:property>
                    <key>expression</key>
                    <value>${this.escapeXml(condition.expression)}</value>
                </ifl:property>
                ${condition.order !== undefined ? `<ifl:property>
                    <key>order</key>
                    <value>${condition.order}</value>
                </ifl:property>` : ''}
            </bpmn2:extensionElements>
        </bpmn2:sequenceFlow>`;
    }

    /**
     * Generate multicast (parallel gateway)
     */
    private generateMulticast(multicast: MulticastConfig, incoming: string): string {
        const outgoingFlows = multicast.branches.map(b => `${b.id}_flow`).join('</bpmn2:outgoing>\n            <bpmn2:outgoing>');

        return `        <bpmn2:parallelGateway id="${multicast.id}" name="${this.escapeXml(multicast.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Multicast')}</value>
                </ifl:property>
                <ifl:property>
                    <key>activityType</key>
                    <value>Multicast</value>
                </ifl:property>
                <ifl:property>
                    <key>parallelProcessing</key>
                    <value>${multicast.type === 'ParallelMulticast' ? 'true' : 'false'}</value>
                </ifl:property>
                ${multicast.stopOnException ? `<ifl:property>
                    <key>stopOnException</key>
                    <value>true</value>
                </ifl:property>` : ''}
                ${multicast.timeout ? `<ifl:property>
                    <key>timeout</key>
                    <value>${multicast.timeout}</value>
                </ifl:property>` : ''}
${this.generateCmdVariantProperty('Multicast', this.getComponentVersion('Multicast'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoingFlows}</bpmn2:outgoing>
        </bpmn2:parallelGateway>`;
    }

    /**
     * Generate splitter
     */
    private generateSplitter(splitter: SplitterConfig, incoming: string, outgoing: string): string {
        const splitterType = this.getSplitterSubType(splitter.type);

        return `        <bpmn2:callActivity id="${splitter.id}" name="${this.escapeXml(splitter.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Splitter</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${splitterType}</value>
                </ifl:property>
                <ifl:property>
                    <key>expressionType</key>
                    <value>${splitter.expressionType}</value>
                </ifl:property>
                ${splitter.expression ? `<ifl:property>
                    <key>expression</key>
                    <value>${this.escapeXml(splitter.expression)}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>parallelProcessing</key>
                    <value>${splitter.parallelProcessing ? 'true' : 'false'}</value>
                </ifl:property>
                ${splitter.groupSize ? `<ifl:property>
                    <key>groupSize</key>
                    <value>${splitter.groupSize}</value>
                </ifl:property>` : ''}
                ${splitter.stopOnException ? `<ifl:property>
                    <key>stopOnException</key>
                    <value>true</value>
                </ifl:property>` : ''}
                ${splitter.streaming ? `<ifl:property>
                    <key>streaming</key>
                    <value>true</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Splitter')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(splitterType, this.getComponentVersion('Splitter'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    private getSplitterSubType(type: SplitterConfig['type']): string {
        switch (type) {
            case 'IteratingSplitter': return 'IteratingSplitter';
            case 'GeneralSplitter': return 'GeneralSplitter';
            case 'ParallelSplitter': return 'ParallelMulticastSplitter';
            case 'TokenizerSplitter': return 'TokenizerSplitter';
            default: return 'IteratingSplitter';
        }
    }

    /**
     * Generate aggregator
     */
    private generateAggregator(aggregator: AggregatorConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${aggregator.id}" name="${this.escapeXml(aggregator.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Aggregator</value>
                </ifl:property>
                <ifl:property>
                    <key>correlationExpression</key>
                    <value>${this.escapeXml(aggregator.correlationExpression)}</value>
                </ifl:property>
                <ifl:property>
                    <key>correlationExpressionType</key>
                    <value>${aggregator.correlationExpressionType}</value>
                </ifl:property>
                <ifl:property>
                    <key>completionConditionType</key>
                    <value>${aggregator.completionCondition.type}</value>
                </ifl:property>
                <ifl:property>
                    <key>completionConditionValue</key>
                    <value>${aggregator.completionCondition.value}</value>
                </ifl:property>
                <ifl:property>
                    <key>aggregationStrategy</key>
                    <value>${aggregator.aggregationStrategy}</value>
                </ifl:property>
                ${aggregator.timeout ? `<ifl:property>
                    <key>timeout</key>
                    <value>${aggregator.timeout}</value>
                </ifl:property>` : ''}
                ${aggregator.throwExceptionOnTimeout ? `<ifl:property>
                    <key>throwExceptionOnTimeout</key>
                    <value>true</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Aggregator')}</value>
                </ifl:property>
${this.generateCmdVariantProperty('Aggregator', this.getComponentVersion('Aggregator'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate join (converging gateway)
     */
    private generateJoin(join: JoinConfig, outgoing: string): string {
        const incomingFlows = join.incomingBranches.join('</bpmn2:incoming>\n            <bpmn2:incoming>');
        const gatewayType = join.type === 'AND' ? 'parallelGateway' : 'exclusiveGateway';

        return `        <bpmn2:${gatewayType} id="${join.id}" name="${this.escapeXml(join.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Join')}</value>
                </ifl:property>
                <ifl:property>
                    <key>gatewayType</key>
                    <value>Join</value>
                </ifl:property>
${this.generateCmdVariantProperty('Join', this.getComponentVersion('Join'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incomingFlows}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:${gatewayType}>`;
    }

    /**
     * Generate filter
     */
    private generateFilter(filter: FilterConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${filter.id}" name="${this.escapeXml(filter.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Filter</value>
                </ifl:property>
                <ifl:property>
                    <key>expressionType</key>
                    <value>${filter.expressionType}</value>
                </ifl:property>
                <ifl:property>
                    <key>expression</key>
                    <value>${this.escapeXml(filter.expression)}</value>
                </ifl:property>
                ${filter.removeOnMismatch ? `<ifl:property>
                    <key>removeOnMismatch</key>
                    <value>true</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Filter')}</value>
                </ifl:property>
${this.generateCmdVariantProperty('Filter', this.getComponentVersion('Filter'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    // ========================================================================
    // MESSAGE TRANSFORMER COMPONENTS
    // ========================================================================

    /**
     * Generate converter (XML/JSON, CSV, EDI, encoding)
     */
    private generateConverter(converter: ConverterConfig, incoming: string, outgoing: string): string {
        const converterMapping = this.getConverterSubType(converter.type);

        return `        <bpmn2:callActivity id="${converter.id}" name="${this.escapeXml(converter.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>${converterMapping.activityType}</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${converterMapping.subType}</value>
                </ifl:property>
                ${converter.options ? this.generateConverterOptions(converter.options) : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Converter')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(converterMapping.subType, this.getComponentVersion('Converter'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    private getConverterSubType(type: ConverterConfig['type']): { activityType: string; subType: string } {
        const mapping: Record<string, { activityType: string; subType: string }> = {
            'XMLToJSON': { activityType: 'Converter', subType: 'XMLToJSON' },
            'JSONToXML': { activityType: 'Converter', subType: 'JSONToXML' },
            'CSVToXML': { activityType: 'Converter', subType: 'CSVToXML' },
            'XMLToCSV': { activityType: 'Converter', subType: 'XMLToCSV' },
            'EDIToXML': { activityType: 'Converter', subType: 'EDIToXML' },
            'XMLToEDI': { activityType: 'Converter', subType: 'XMLToEDI' },
            'Base64Encoder': { activityType: 'Encoder', subType: 'Base64Encode' },
            'Base64Decoder': { activityType: 'Decoder', subType: 'Base64Decode' },
            'GZIPCompressor': { activityType: 'Encoder', subType: 'GZIPCompress' },
            'GZIPDecompressor': { activityType: 'Decoder', subType: 'GZIPDecompress' },
            'ZIPCompressor': { activityType: 'Encoder', subType: 'ZIPCompress' },
            'ZIPDecompressor': { activityType: 'Decoder', subType: 'ZIPDecompress' },
            'MIMEMultipartEncoder': { activityType: 'Encoder', subType: 'MIMEMultipartEncode' },
            'MIMEMultipartDecoder': { activityType: 'Decoder', subType: 'MIMEMultipartDecode' },
        };
        return mapping[type] || { activityType: 'Converter', subType: type };
    }

    private generateConverterOptions(options: ConverterConfig['options']): string {
        if (!options) return '';

        const props: string[] = [];
        if (options.delimiter) {
            props.push(`                <ifl:property>
                    <key>delimiter</key>
                    <value>${this.escapeXml(options.delimiter)}</value>
                </ifl:property>`);
        }
        if (options.headerLine !== undefined) {
            props.push(`                <ifl:property>
                    <key>headerLine</key>
                    <value>${options.headerLine}</value>
                </ifl:property>`);
        }
        if (options.jsonPrefix) {
            props.push(`                <ifl:property>
                    <key>jsonPrefix</key>
                    <value>${this.escapeXml(options.jsonPrefix)}</value>
                </ifl:property>`);
        }
        if (options.suppressEmptyElements !== undefined) {
            props.push(`                <ifl:property>
                    <key>suppressEmptyElements</key>
                    <value>${options.suppressEmptyElements}</value>
                </ifl:property>`);
        }
        if (options.ediStandard) {
            props.push(`                <ifl:property>
                    <key>ediStandard</key>
                    <value>${options.ediStandard}</value>
                </ifl:property>`);
        }
        return props.join('\n');
    }

    /**
     * Generate content modifier step
     */
    private generateContentModifierStep(cm: ContentModifierConfig, incoming: string, outgoing: string): string {
        const bodyType = cm.bodyAction
            ? (cm.bodyAction.type === 'XPath' ? 'xpath' : cm.bodyAction.type === 'Expression' ? 'expression' : 'constant')
            : 'constant';
        const wrapContent = this.escapeXml(cm.bodyAction?.value || '');
        const tableProps = this.generateContentModifierTableProperties(cm);

        return `        <bpmn2:callActivity id="${cm.id}" name="${this.escapeXml(cm.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>bodyType</key>
                    <value>${bodyType}</value>
                </ifl:property>
${tableProps}
                <ifl:property>
                    <key>wrapContent</key>
                    <value>${wrapContent}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('ContentModifier')}</value>
                </ifl:property>
${this.generateCmdVariantProperty('Enricher', this.getComponentVersion('ContentModifier'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    private generateContentModifierTableProperties(cm: ContentModifierConfig): string {
        const toCellType = (type?: string): string => {
            if (!type) return 'constant';
            const normalized = type.toLowerCase();
            if (normalized.includes('xpath')) return 'xpath';
            if (normalized.includes('expression')) return 'expression';
            if (normalized.includes('header')) return 'header';
            if (normalized.includes('property')) return 'property';
            return 'constant';
        };

        const toRow = (
            action: string,
            type: string,
            value: string,
            name: string,
            dataType?: string
        ): string => this.escapeXml(`<row><cell id='Action'>${action}</cell><cell id='Type'>${type}</cell><cell id='Value'>${value}</cell><cell id='Default'></cell><cell id='Name'>${name}</cell><cell id='Datatype'>${dataType || ''}</cell></row>`);

        const headerRows = (cm.headerActions || []).map(h =>
            toRow(
                h.action || 'Create',
                toCellType(h.type),
                h.value || '',
                h.name || '',
                h.dataType
            )
        ).join('');

        const propertyRows = (cm.propertyActions || []).map(p =>
            toRow(
                p.action || 'Create',
                toCellType(p.type),
                p.value || '',
                p.name || '',
                p.dataType
            )
        ).join('');

        return `                <ifl:property>
                    <key>propertyTable</key>
                    <value>${propertyRows}</value>
                </ifl:property>
                <ifl:property>
                    <key>headerTable</key>
                    <value>${headerRows}</value>
                </ifl:property>`;
    }

    /**
     * Generate XML validator
     */
    private generateXMLValidator(xv: XMLValidatorConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${xv.id}" name="${this.escapeXml(xv.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Validator</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>XMLValidator</value>
                </ifl:property>
                <ifl:property>
                    <key>schemaSource</key>
                    <value>${xv.schemaSource}</value>
                </ifl:property>
                ${xv.schemaPath ? `<ifl:property>
                    <key>schemaPath</key>
                    <value>${this.escapeXml(xv.schemaPath)}</value>
                </ifl:property>` : ''}
                ${xv.throwExceptionOnFailure !== undefined ? `<ifl:property>
                    <key>throwExceptionOnFailure</key>
                    <value>${xv.throwExceptionOnFailure}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('XMLValidator')}</value>
                </ifl:property>
${this.generateCmdVariantProperty('XMLValidator', this.getComponentVersion('XMLValidator'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    // ========================================================================
    // SECURITY COMPONENTS
    // ========================================================================

    /**
     * Generate encryptor
     */
    private generateEncryptor(enc: EncryptorConfig, incoming: string, outgoing: string): string {
        const encType = enc.type === 'PGPEncryptor' ? 'PGPEncrypt'
            : enc.type === 'PKCS7Encryptor' ? 'PKCS7Encrypt'
                : 'XMLEncrypt';

        return `        <bpmn2:callActivity id="${enc.id}" name="${this.escapeXml(enc.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Security</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${encType}</value>
                </ifl:property>
                ${enc.keyAlias ? `<ifl:property>
                    <key>keyAlias</key>
                    <value>${this.escapeXml(enc.keyAlias)}</value>
                </ifl:property>` : ''}
                ${enc.algorithm ? `<ifl:property>
                    <key>algorithm</key>
                    <value>${enc.algorithm}</value>
                </ifl:property>` : ''}
                ${enc.signMessage !== undefined ? `<ifl:property>
                    <key>signMessage</key>
                    <value>${enc.signMessage}</value>
                </ifl:property>` : ''}
                ${enc.asciiArmor !== undefined ? `<ifl:property>
                    <key>asciiArmor</key>
                    <value>${enc.asciiArmor}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Encryptor')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(encType, this.getComponentVersion('Encryptor'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate decryptor
     */
    private generateDecryptor(dec: DecryptorConfig, incoming: string, outgoing: string): string {
        const decType = dec.type === 'PGPDecryptor' ? 'PGPDecrypt'
            : dec.type === 'PKCS7Decryptor' ? 'PKCS7Decrypt'
                : 'XMLDecrypt';

        return `        <bpmn2:callActivity id="${dec.id}" name="${this.escapeXml(dec.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Security</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${decType}</value>
                </ifl:property>
                ${dec.keyAlias ? `<ifl:property>
                    <key>keyAlias</key>
                    <value>${this.escapeXml(dec.keyAlias)}</value>
                </ifl:property>` : ''}
                ${dec.verifySignature !== undefined ? `<ifl:property>
                    <key>verifySignature</key>
                    <value>${dec.verifySignature}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Decryptor')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(decType, this.getComponentVersion('Decryptor'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate signer
     */
    private generateSigner(sig: SignerConfig, incoming: string, outgoing: string): string {
        const sigType = sig.type === 'PKCS7Signer' ? 'PKCS7Sign'
            : sig.type === 'XMLDigitalSigner' ? 'XMLDigitalSign'
                : 'SimpleSign';

        return `        <bpmn2:callActivity id="${sig.id}" name="${this.escapeXml(sig.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Security</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${sigType}</value>
                </ifl:property>
                ${sig.keyAlias ? `<ifl:property>
                    <key>keyAlias</key>
                    <value>${this.escapeXml(sig.keyAlias)}</value>
                </ifl:property>` : ''}
                ${sig.signatureAlgorithm ? `<ifl:property>
                    <key>signatureAlgorithm</key>
                    <value>${sig.signatureAlgorithm}</value>
                </ifl:property>` : ''}
                ${sig.digestAlgorithm ? `<ifl:property>
                    <key>digestAlgorithm</key>
                    <value>${sig.digestAlgorithm}</value>
                </ifl:property>` : ''}
                ${sig.includeSignerCert !== undefined ? `<ifl:property>
                    <key>includeSignerCert</key>
                    <value>${sig.includeSignerCert}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Signer')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(sigType, this.getComponentVersion('Signer'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate verifier
     */
    private generateVerifier(ver: VerifierConfig, incoming: string, outgoing: string): string {
        const verType = ver.type === 'PKCS7Verifier' ? 'PKCS7Verify'
            : ver.type === 'XMLDigitalVerifier' ? 'XMLDigitalVerify'
                : 'SimpleVerify';

        return `        <bpmn2:callActivity id="${ver.id}" name="${this.escapeXml(ver.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Security</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${verType}</value>
                </ifl:property>
                ${ver.publicKeyAlias ? `<ifl:property>
                    <key>publicKeyAlias</key>
                    <value>${this.escapeXml(ver.publicKeyAlias)}</value>
                </ifl:property>` : ''}
                ${ver.throwExceptionOnFailure !== undefined ? `<ifl:property>
                    <key>throwExceptionOnFailure</key>
                    <value>${ver.throwExceptionOnFailure}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Verifier')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(verType, this.getComponentVersion('Verifier'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    // ========================================================================
    // PERSISTENCE COMPONENTS
    // ========================================================================

    /**
     * Generate data store operation
     */
    private generateDataStore(ds: DataStoreConfig, incoming: string, outgoing: string): string {
        const operationMapping: Record<string, string> = {
            'Write': 'DataStoreWrite',
            'Get': 'DataStoreGet',
            'Delete': 'DataStoreDelete',
            'Select': 'DataStoreSelect'
        };

        return `        <bpmn2:callActivity id="${ds.id}" name="${this.escapeXml(ds.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>DataStore</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${operationMapping[ds.operation]}</value>
                </ifl:property>
                <ifl:property>
                    <key>dataStoreName</key>
                    <value>${this.escapeXml(ds.dataStoreName)}</value>
                </ifl:property>
                <ifl:property>
                    <key>visibility</key>
                    <value>${ds.visibility}</value>
                </ifl:property>
                ${ds.entryId ? `<ifl:property>
                    <key>entryId</key>
                    <value>${this.escapeXml(ds.entryId)}</value>
                </ifl:property>` : ''}
                ${ds.retentionPeriod ? `<ifl:property>
                    <key>retentionPeriod</key>
                    <value>${ds.retentionPeriod}</value>
                </ifl:property>` : ''}
                ${ds.overwriteExisting !== undefined ? `<ifl:property>
                    <key>overwriteExisting</key>
                    <value>${ds.overwriteExisting}</value>
                </ifl:property>` : ''}
                ${ds.selectCondition ? `<ifl:property>
                    <key>selectCondition</key>
                    <value>${this.escapeXml(ds.selectCondition)}</value>
                </ifl:property>` : ''}
                ${ds.numberOfPolledMessages ? `<ifl:property>
                    <key>numberOfPolledMessages</key>
                    <value>${ds.numberOfPolledMessages}</value>
                </ifl:property>` : ''}
                ${ds.deleteOnCompletion !== undefined ? `<ifl:property>
                    <key>deleteOnCompletion</key>
                    <value>${ds.deleteOnCompletion}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('DataStore')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(operationMapping[ds.operation], this.getComponentVersion('DataStore'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate variable operation
     */
    private generateVariable(variable: VariableConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${variable.id}" name="${this.escapeXml(variable.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Variables</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${variable.operation === 'Write' ? 'WriteVariables' : 'ReadVariables'}</value>
                </ifl:property>
                <ifl:property>
                    <key>variableName</key>
                    <value>${this.escapeXml(variable.variableName)}</value>
                </ifl:property>
                ${variable.type ? `<ifl:property>
                    <key>variableType</key>
                    <value>${variable.type}</value>
                </ifl:property>` : ''}
                ${variable.value ? `<ifl:property>
                    <key>variableValue</key>
                    <value>${this.escapeXml(variable.value)}</value>
                </ifl:property>` : ''}
                ${variable.expirationPeriod ? `<ifl:property>
                    <key>expirationPeriod</key>
                    <value>${variable.expirationPeriod}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('Variable')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(variable.operation === 'Write' ? 'WriteVariables' : 'ReadVariables', this.getComponentVersion('Variable'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    // ========================================================================
    // EXTERNAL CALL COMPONENTS
    // ========================================================================

    /**
     * Generate request-reply step
     */
    private generateRequestReply(rr: RequestReplyConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${rr.id}" name="${this.escapeXml(rr.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>ExternalCall</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${rr.externalCallType || 'RequestReply'}</value>
                </ifl:property>
                <ifl:property>
                    <key>adapterRef</key>
                    <value>${rr.adapterId}</value>
                </ifl:property>
                ${rr.timeout ? `<ifl:property>
                    <key>timeout</key>
                    <value>${rr.timeout}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('RequestReply')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(rr.externalCallType || 'RequestReply', this.getComponentVersion('RequestReply'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate content enricher step
     */
    private generateContentEnricher(ce: ContentEnricherConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${ce.id}" name="${this.escapeXml(ce.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${ce.type === 'PollEnrich' ? 'PollEnrich' : 'ContentEnricher'}</value>
                </ifl:property>
                <ifl:property>
                    <key>adapterRef</key>
                    <value>${ce.adapterId}</value>
                </ifl:property>
                ${ce.pathToNode ? `<ifl:property>
                    <key>pathToNode</key>
                    <value>${this.escapeXml(ce.pathToNode)}</value>
                </ifl:property>` : ''}
                ${ce.aggregationStrategy ? `<ifl:property>
                    <key>aggregationStrategy</key>
                    <value>${ce.aggregationStrategy}</value>
                </ifl:property>` : ''}
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('ContentEnricher')}</value>
                </ifl:property>
${this.generateCmdVariantProperty(ce.type === 'PollEnrich' ? 'PollEnrich' : 'ContentEnricher', this.getComponentVersion('ContentEnricher'))}
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    // ========================================================================
    // EXCEPTION HANDLING
    // ========================================================================

    /**
     * Generate exception subprocess
     */
    private generateExceptionSubprocess(esp: ExceptionSubprocessConfig): string {
        const activities: string[] = [];
        const sequenceFlows: string[] = [];

        // Start event
        activities.push(`            <bpmn2:startEvent id="${esp.id}_ErrorStart" name="Error Start">
                <bpmn2:outgoing>${esp.id}_Flow_1</bpmn2:outgoing>
                <bpmn2:errorEventDefinition>
                    <bpmn2:extensionElements>
                        <ifl:property>
                            <key>cmdVariantUri</key>
                            <value>ctype::FlowstepVariant/cname::ErrorStartEvent</value>
                        </ifl:property>
                        <ifl:property>
                            <key>activityType</key>
                            <value>StartErrorEvent</value>
                        </ifl:property>
                    </bpmn2:extensionElements>
                </bpmn2:errorEventDefinition>
            </bpmn2:startEvent>`);

        let previousId = `${esp.id}_ErrorStart`;
        let flowCounter = 1;

        // Generate activities for each step in the exception subprocess
        if (esp.steps && esp.steps.length > 0) {
            esp.steps.forEach((step, index) => {
                const incomingFlow = `${esp.id}_Flow_${flowCounter}`;
                flowCounter++;
                const outgoingFlow = `${esp.id}_Flow_${flowCounter}`;

                // Generate the step activity based on its type
                const activity = this.generateStepActivity(step, incomingFlow, outgoingFlow);
                if (activity) {
                    // Indent the activity for proper XML structure
                    activities.push(activity.replace(/^        /gm, '            '));
                    sequenceFlows.push(`            <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${step.id}"/>`);
                    previousId = step.id;
                }
            });
        }

        // End event
        const finalFlow = `${esp.id}_Flow_${flowCounter}`;
        activities.push(`            <bpmn2:endEvent id="${esp.id}_ErrorEnd" name="Error End">
                <bpmn2:incoming>${finalFlow}</bpmn2:incoming>
                <bpmn2:errorEventDefinition>
                    <bpmn2:extensionElements>
                        <ifl:property>
                            <key>cmdVariantUri</key>
                            <value>ctype::FlowstepVariant/cname::ErrorEndEvent</value>
                        </ifl:property>
                        <ifl:property>
                            <key>activityType</key>
                            <value>EndErrorEvent</value>
                        </ifl:property>
                    </bpmn2:extensionElements>
                </bpmn2:errorEventDefinition>
            </bpmn2:endEvent>`);

        // Final sequence flow
        sequenceFlows.push(`            <bpmn2:sequenceFlow id="${finalFlow}" sourceRef="${previousId}" targetRef="${esp.id}_ErrorEnd"/>`);

        return `        <bpmn2:subProcess id="${esp.id}" name="${this.escapeXml(esp.name)}" triggeredByEvent="true">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>${this.getComponentVersion('SubProcess')}</value>
                </ifl:property>
                <ifl:property>
                    <key>activityType</key>
                    <value>ErrorEventSubProcessTemplate</value>
                </ifl:property>
                ${esp.sendToDeadLetter ? `<ifl:property>
                    <key>sendToDeadLetter</key>
                    <value>true</value>
                </ifl:property>` : ''}
${this.generateCmdVariantProperty('ErrorEventSubProcessTemplate', this.getComponentVersion('SubProcess')).replace(/^                /gm, '                ')}
            </bpmn2:extensionElements>
${activities.join('\n')}
${sequenceFlows.join('\n')}
        </bpmn2:subProcess>`;
    }

    /**
     * Generate BPMN diagram (visual layout) - Required for SAP CPI
     * CRITICAL: Every element in the process MUST have a corresponding BPMNShape
     * otherwise the SAP CPI editor will fail to load the iFlow.
     */
    private generateBPMNDiagram(design: IFlowDesign, collaborationId: string, processId: string): string {
        // Calculate positions - start from left and move right
        let xPos = 160;
        const yPos = 200;
        const elementSpacing = 100;
        const shapes: string[] = [];
        const edges: string[] = [];

        // Calculate if we need extra height for exception subprocesses
        const hasExceptionSubprocesses = design.exceptionSubprocesses && design.exceptionSubprocesses.length > 0;
        // Main flow needs ~100px, exception subprocess needs ~100px with proper margins
        const processHeight = hasExceptionSubprocesses ? 280 : 200;
        // Exception subprocess Y position - must be inside process participant
        const exceptionSubprocessY = 250; // Within process bounds (150 + 100 = 250)
        // Receiver Y position - adjust based on process height
        const receiverY = 150 + processHeight + 50; // 50px gap below process

        // Track all element IDs for proper sequence flow matching
        const allElementIds: string[] = [];

        // Sender participant shape
        shapes.push(`            <bpmndi:BPMNShape id="Participant_1_gui" bpmnElement="Participant_1">
                <dc:Bounds x="50" y="50" width="100" height="60"/>
            </bpmndi:BPMNShape>`);

        // Collect all elements in processing order (same as generateProcess)
        // to ensure consistent sequence flow numbering
        if (design.converters) {
            design.converters.forEach(c => allElementIds.push(c.id));
        }
        if (design.contentModifiers) {
            design.contentModifiers.forEach(c => allElementIds.push(c.id));
        }
        if (design.xmlValidators) {
            design.xmlValidators.forEach(x => allElementIds.push(x.id));
        }
        if (design.decryptors) {
            design.decryptors.forEach(d => allElementIds.push(d.id));
        }
        if (design.verifiers) {
            design.verifiers.forEach(v => allElementIds.push(v.id));
        }
        if (design.scripts) {
            design.scripts.forEach(s => allElementIds.push(s.id));
        }
        if (design.routers) {
            design.routers.forEach(r => allElementIds.push(r.id));
        }
        if (design.splitters) {
            design.splitters.forEach(s => allElementIds.push(s.id));
        }
        if (design.multicasts) {
            design.multicasts.forEach(m => allElementIds.push(m.id));
        }
        if (design.mappings) {
            design.mappings.forEach(m => allElementIds.push(m.id));
        }
        if (design.aggregators) {
            design.aggregators.forEach(a => allElementIds.push(a.id));
        }
        if (design.joins) {
            design.joins.forEach(j => allElementIds.push(j.id));
        }
        if (design.filters) {
            design.filters.forEach(f => allElementIds.push(f.id));
        }
        if (design.dataStores) {
            design.dataStores.forEach(d => allElementIds.push(d.id));
        }
        if (design.variables) {
            design.variables.forEach(v => allElementIds.push(v.id));
        }
        if (design.requestReplies) {
            design.requestReplies.forEach(r => allElementIds.push(r.id));
        }
        if (design.contentEnrichers) {
            design.contentEnrichers.forEach(c => allElementIds.push(c.id));
        }
        if (design.signers) {
            design.signers.forEach(s => allElementIds.push(s.id));
        }
        if (design.encryptors) {
            design.encryptors.forEach(e => allElementIds.push(e.id));
        }

        // Calculate required width for process participant
        const processWidth = Math.max(700, 200 + (allElementIds.length + 1) * elementSpacing);

        // Process participant shape - adjust width and height based on elements
        shapes.push(`            <bpmndi:BPMNShape id="Participant_Process_gui" bpmnElement="Participant_Process" isHorizontal="true">
                <dc:Bounds x="50" y="150" width="${processWidth}" height="${processHeight}"/>
            </bpmndi:BPMNShape>`);

        // Receiver participant shape - position based on process height
        shapes.push(`            <bpmndi:BPMNShape id="Participant_2_gui" bpmnElement="Participant_2">
                <dc:Bounds x="50" y="${receiverY}" width="100" height="60"/>
            </bpmndi:BPMNShape>`);

        // Determine start event ID based on trigger type
        // MUST match the ID used in generateTimerStartEvent / generateProcess
        // IMPORTANT: Mail/IMAP/POP3 sender adapters have built-in scheduling and should NOT
        // create timer start events — they use a normal MessageStartEvent
        const hasMailSenderAdapter = design.adapters?.some(a => 
            a.direction === 'Sender' && ['Mail', 'IMAP', 'POP3'].includes(a.type)
        );
        const isTimerTriggeredDiag = !hasMailSenderAdapter && !!(design.triggerType === 'timer' || design.timerConfig);
        const startEventId = isTimerTriggeredDiag && design.timerConfig?.id
            ? design.timerConfig.id
            : 'StartEvent_1';

        // Start event shape
        shapes.push(`            <bpmndi:BPMNShape id="${startEventId}_gui" bpmnElement="${startEventId}">
                <dc:Bounds x="${xPos}" y="${yPos}" width="32" height="32"/>
            </bpmndi:BPMNShape>`);
        xPos += elementSpacing;

        // Generate shapes for all elements
        let seqNum = 1;
        allElementIds.forEach((elementId) => {
            shapes.push(`            <bpmndi:BPMNShape id="${elementId}_gui" bpmnElement="${elementId}">
                <dc:Bounds x="${xPos}" y="${yPos - 10}" width="48" height="48"/>
            </bpmndi:BPMNShape>`);
            edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + 32}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);
            xPos += elementSpacing;
            seqNum++;
        });

        // End event shape
        shapes.push(`            <bpmndi:BPMNShape id="EndEvent_1_gui" bpmnElement="EndEvent_1">
                <dc:Bounds x="${xPos}" y="${yPos}" width="32" height="32"/>
            </bpmndi:BPMNShape>`);

        // Final sequence flow edge to end event
        edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + 48}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);

        // Router routing condition edges (for content-based routing)
        // These are separate sequence flows from the router to target elements
        if (design.routers) {
            design.routers.forEach((router) => {
                // Find router position in the element array
                const routerIndex = allElementIds.indexOf(router.id);
                const routerXPos = routerIndex >= 0 ? 160 + (routerIndex + 1) * elementSpacing : 260;

                router.routingConditions.forEach((condition, idx) => {
                    // Create edge from router to target (simplified - all go to same Y with offset)
                    const targetYOffset = (idx + 1) * 30;
                    edges.push(`            <bpmndi:BPMNEdge id="${condition.id}_gui" bpmnElement="${condition.id}">
                <di:waypoint x="${routerXPos + 24}" y="${yPos + 24}"/>
                <di:waypoint x="${routerXPos + 100}" y="${yPos + targetYOffset}"/>
            </bpmndi:BPMNEdge>`);
                });

                // Default route edge
                if (router.defaultRoute) {
                    edges.push(`            <bpmndi:BPMNEdge id="${router.id}_default_gui" bpmnElement="${router.id}_default">
                <di:waypoint x="${routerXPos + 24}" y="${yPos + 24}"/>
                <di:waypoint x="${routerXPos + 100}" y="${yPos - 30}"/>
            </bpmndi:BPMNEdge>`);
                }
            });
        }

        // Exception subprocess shapes (if any) - positioned within process participant bounds
        if (design.exceptionSubprocesses) {
            let espXPos = 200;
            // Use the calculated exception subprocess Y position (within process bounds)
            design.exceptionSubprocesses.forEach((esp) => {
                // Calculate width based on number of steps
                const espStepCount = esp.steps ? esp.steps.length : 0;
                const espWidth = Math.max(200, 100 + (espStepCount * 120));

                shapes.push(`            <bpmndi:BPMNShape id="${esp.id}_gui" bpmnElement="${esp.id}" isExpanded="true">
                <dc:Bounds x="${espXPos}" y="${exceptionSubprocessY}" width="${espWidth}" height="80"/>
            </bpmndi:BPMNShape>`);
                shapes.push(`            <bpmndi:BPMNShape id="${esp.id}_ErrorStart_gui" bpmnElement="${esp.id}_ErrorStart">
                <dc:Bounds x="${espXPos + 20}" y="${exceptionSubprocessY + 25}" width="28" height="28"/>
            </bpmndi:BPMNShape>`);

                // Generate shapes for steps inside exception subprocess
                let stepXPos = espXPos + 70;
                if (esp.steps) {
                    esp.steps.forEach((step) => {
                        shapes.push(`            <bpmndi:BPMNShape id="${step.id}_gui" bpmnElement="${step.id}">
                <dc:Bounds x="${stepXPos}" y="${exceptionSubprocessY + 15}" width="100" height="50"/>
            </bpmndi:BPMNShape>`);
                        stepXPos += 120;
                    });
                }

                shapes.push(`            <bpmndi:BPMNShape id="${esp.id}_ErrorEnd_gui" bpmnElement="${esp.id}_ErrorEnd">
                <dc:Bounds x="${espXPos + espWidth - 40}" y="${exceptionSubprocessY + 25}" width="28" height="28"/>
            </bpmndi:BPMNShape>`);
                edges.push(`            <bpmndi:BPMNEdge id="${esp.id}_Flow_1_gui" bpmnElement="${esp.id}_Flow_1">
                <di:waypoint x="${espXPos + 48}" y="${exceptionSubprocessY + 39}"/>
                <di:waypoint x="${espXPos + espWidth - 40}" y="${exceptionSubprocessY + 39}"/>
            </bpmndi:BPMNEdge>`);
                espXPos += espWidth + 20;
            });
        }

        // Message flow edges - use adapter IDs if available, otherwise default
        const senderAdapters = design.adapters?.filter(a => a.direction === 'Sender') || [];
        const receiverAdapters = design.adapters?.filter(a => a.direction === 'Receiver') || [];

        const senderFlowId = senderAdapters.length > 0 ? senderAdapters[0].id : 'MessageFlow_1';
        const receiverFlowId = receiverAdapters.length > 0 ? receiverAdapters[0].id : 'MessageFlow_2';

        // Sender message flow: from sender participant to start event
        edges.push(`            <bpmndi:BPMNEdge id="${senderFlowId}_gui" bpmnElement="${senderFlowId}" sourceElement="Participant_1_gui" targetElement="StartEvent_1_gui">
                <di:waypoint x="100" y="110"/>
                <di:waypoint x="100" y="150"/>
            </bpmndi:BPMNEdge>`);
        // Receiver message flow: from bottom of process to top of receiver participant
        // Use dynamic positions based on processHeight and receiverY
        const processBottomY = 150 + processHeight;
        edges.push(`            <bpmndi:BPMNEdge id="${receiverFlowId}_gui" bpmnElement="${receiverFlowId}" sourceElement="Participant_Process_gui" targetElement="Participant_2_gui">
                <di:waypoint x="100" y="${processBottomY}"/>
                <di:waypoint x="100" y="${receiverY}"/>
            </bpmndi:BPMNEdge>`);

        // Local process shapes (if any)
        if (design.localProcesses) {
            let lpXPos = processWidth + 100;
            design.localProcesses.forEach((lp) => {
                // Calculate width based on number of steps
                const lpStepCount = lp.steps ? lp.steps.length : 0;
                const lpWidth = Math.max(300, 140 + (lpStepCount * 120));

                shapes.push(`            <bpmndi:BPMNShape id="${lp.id}_gui" bpmnElement="${lp.id}" isHorizontal="true">
                <dc:Bounds x="${lpXPos}" y="150" width="${lpWidth}" height="120"/>
            </bpmndi:BPMNShape>`);
                shapes.push(`            <bpmndi:BPMNShape id="${lp.id}_Start_gui" bpmnElement="${lp.id}_Start">
                <dc:Bounds x="${lpXPos + 30}" y="195" width="28" height="28"/>
            </bpmndi:BPMNShape>`);

                // Generate shapes for steps inside local process
                let stepXPos = lpXPos + 80;
                if (lp.steps) {
                    lp.steps.forEach((step) => {
                        shapes.push(`            <bpmndi:BPMNShape id="${step.id}_gui" bpmnElement="${step.id}">
                <dc:Bounds x="${stepXPos}" y="185" width="100" height="60"/>
            </bpmndi:BPMNShape>`);
                        stepXPos += 120;
                    });
                }

                shapes.push(`            <bpmndi:BPMNShape id="${lp.id}_End_gui" bpmnElement="${lp.id}_End">
                <dc:Bounds x="${lpXPos + lpWidth - 50}" y="195" width="28" height="28"/>
            </bpmndi:BPMNShape>`);
                edges.push(`            <bpmndi:BPMNEdge id="${lp.id}_Flow_1_gui" bpmnElement="${lp.id}_Flow_1">
                <di:waypoint x="${lpXPos + 58}" y="209"/>
                <di:waypoint x="${lpXPos + lpWidth - 50}" y="209"/>
            </bpmndi:BPMNEdge>`);
                lpXPos += lpWidth + 20;
            });
        }

        // Post-process all shapes and edges for SAP CPI compatibility:
        // 1. Convert integer coordinates to float format (e.g., "50" -> "50.0")
        // 2. Reorder dc:Bounds attributes to match SAP CPI expected format (height, width, x, y)
        // 3. Add xsi:type="dc:Point" to all di:waypoint elements
        // SAP CPI's graphical editor requires these exact formats to render the integration flow.
        const postProcessDI = (line: string): string => {
            // Convert dc:Bounds: x,y,width,height -> height,width,x,y with float values
            line = line.replace(
                /<dc:Bounds\s+x="([^"]*)"\s+y="([^"]*)"\s+width="([^"]*)"\s+height="([^"]*)"/g,
                (_m, x, y, w, h) =>
                    `<dc:Bounds height="${parseFloat(h).toFixed(1)}" width="${parseFloat(w).toFixed(1)}" x="${parseFloat(x).toFixed(1)}" y="${parseFloat(y).toFixed(1)}"`
            );
            // Add xsi:type="dc:Point" to waypoints and convert coords to float
            line = line.replace(
                /<di:waypoint\s+x="([^"]*)"\s+y="([^"]*)"/g,
                (_m, x, y) =>
                    `<di:waypoint x="${parseFloat(x).toFixed(1)}" xsi:type="dc:Point" y="${parseFloat(y).toFixed(1)}"`
            );
            return line;
        };

        const processedShapes = shapes.map(postProcessDI);
        const processedEdges = edges.map(postProcessDI);

        return `    <bpmndi:BPMNDiagram id="BPMNDiagram_1" name="Default Collaboration Diagram">
        <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collaborationId}">
${processedShapes.join('\n')}
${processedEdges.join('\n')}
        </bpmndi:BPMNPlane>
    </bpmndi:BPMNDiagram>`;
    }

    /**
     * Escape XML special characters
     */
    private escapeXml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Generate UUID for unique IDs
     */
    private generateUUID(): string {
        return Math.random().toString(36).substring(2, 9);
    }
}

/**
 * Create BPMN2 generator instance
 */
export function createBPMN2Generator(): BPMN2Generator {
    return new BPMN2Generator();
}
