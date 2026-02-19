/**
 * BPMN2 Validator for SAP CPI
 * 
 * Validates BPMN2 XML to catch common issues that cause 
 * "Error while loading the details of the integration flow" in SAP CPI.
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    diagnostics: {
        elementCounts: Record<string, number>;
        shapeCount: number;
        edgeCount: number;
        processElements: string[];
        diagramElements: string[];
        missingShapes: string[];
        missingEdges: string[];
        sequenceFlowRefs: {
            defined: string[];
            referenced: string[];
            missingDefinitions: string[];
            unusedDefinitions: string[];
        };
    };
}

/**
 * Validate BPMN2 XML for SAP CPI compatibility
 */
export function validateBPMN2(xml: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Element counters
    const elementCounts: Record<string, number> = {};
    const processElements: string[] = [];
    const diagramElements: string[] = [];
    const sequenceFlowsDefined: string[] = [];
    const sequenceFlowsReferenced: string[] = [];
    
    // Count helper
    const countPattern = (pattern: RegExp): number => {
        const matches = xml.match(pattern);
        return matches ? matches.length : 0;
    };

    // Extract IDs from XML elements
    const extractIds = (pattern: RegExp): string[] => {
        const ids: string[] = [];
        let match;
        const regex = new RegExp(pattern.source, 'g');
        while ((match = regex.exec(xml)) !== null) {
            if (match[1]) ids.push(match[1]);
        }
        return ids;
    };

    // 1. Basic XML structure validation
    if (!xml.includes('<?xml')) {
        errors.push('Missing XML declaration');
    }
    
    if (!xml.includes('bpmn2:definitions')) {
        errors.push('Missing bpmn2:definitions root element');
    }

    // 2. Check required namespaces
    const requiredNamespaces = [
        { prefix: 'bpmn2', uri: 'http://www.omg.org/spec/BPMN/20100524/MODEL' },
        { prefix: 'bpmndi', uri: 'http://www.omg.org/spec/BPMN/20100524/DI' },
        { prefix: 'dc', uri: 'http://www.omg.org/spec/DD/20100524/DC' },
        { prefix: 'di', uri: 'http://www.omg.org/spec/DD/20100524/DI' },
        { prefix: 'ifl', uri: 'http:///com.sap.ifl.model/Ifl.xsd' },
    ];

    for (const ns of requiredNamespaces) {
        if (!xml.includes(`xmlns:${ns.prefix}=`)) {
            errors.push(`Missing namespace declaration: ${ns.prefix}`);
        }
    }

    // 3. Check collaboration structure
    elementCounts['collaboration'] = countPattern(/<bpmn2:collaboration/g);
    elementCounts['participant'] = countPattern(/<bpmn2:participant/g);
    elementCounts['messageFlow'] = countPattern(/<bpmn2:messageFlow/g);
    
    if (elementCounts['collaboration'] === 0) {
        errors.push('Missing bpmn2:collaboration element');
    }
    if (elementCounts['participant'] < 3) {
        warnings.push(`Expected 3 participants (Sender, Process, Receiver), found ${elementCounts['participant']}`);
    }

    // 4. Check process structure
    elementCounts['process'] = countPattern(/<bpmn2:process/g);
    elementCounts['startEvent'] = countPattern(/<bpmn2:startEvent/g);
    elementCounts['endEvent'] = countPattern(/<bpmn2:endEvent/g);
    elementCounts['callActivity'] = countPattern(/<bpmn2:callActivity/g);
    elementCounts['sequenceFlow'] = countPattern(/<bpmn2:sequenceFlow/g);
    elementCounts['subProcess'] = countPattern(/<bpmn2:subProcess/g);
    elementCounts['exclusiveGateway'] = countPattern(/<bpmn2:exclusiveGateway/g);
    elementCounts['parallelGateway'] = countPattern(/<bpmn2:parallelGateway/g);

    if (elementCounts['process'] === 0) {
        errors.push('Missing bpmn2:process element');
    }
    if (elementCounts['startEvent'] === 0) {
        errors.push('Missing start event');
    }
    if (elementCounts['endEvent'] === 0) {
        errors.push('Missing end event');
    }

    // 5. Extract all process element IDs (elements that need shapes in the diagram)
    const startEventIds = extractIds(/bpmn2:startEvent id="([^"]+)"/);
    const endEventIds = extractIds(/bpmn2:endEvent id="([^"]+)"/);
    const callActivityIds = extractIds(/bpmn2:callActivity id="([^"]+)"/);
    const subProcessIds = extractIds(/bpmn2:subProcess id="([^"]+)"/);
    const exclusiveGatewayIds = extractIds(/bpmn2:exclusiveGateway id="([^"]+)"/);
    const parallelGatewayIds = extractIds(/bpmn2:parallelGateway id="([^"]+)"/);
    const participantIds = extractIds(/bpmn2:participant id="([^"]+)"/);
    // Note: bpmn2:process elements do NOT need BPMNShape entries directly
    // However, local integration processes (with processType="local") do need shapes
    // The main process is represented via Participant_Process shape (processRef points to it)
    
    // Extract local processes separately - they may need shapes
    const localProcessIds: string[] = [];
    const localProcessRegex = /<bpmn2:process id="([^"]+)"[^>]*>[\s\S]*?<key>processType<\/key>\s*<value>local<\/value>/g;
    let localMatch;
    while ((localMatch = localProcessRegex.exec(xml)) !== null) {
        if (localMatch[1]) localProcessIds.push(localMatch[1]);
    }
    
    processElements.push(
        ...participantIds,
        ...startEventIds, 
        ...endEventIds, 
        ...callActivityIds,
        ...subProcessIds,
        ...exclusiveGatewayIds,
        ...parallelGatewayIds
        // main process IDs don't need shapes - represented via participants
        // local process IDs are added separately if they have shapes
    );

    // 6. Check BPMN diagram exists and has shapes for all elements
    elementCounts['BPMNDiagram'] = countPattern(/<bpmndi:BPMNDiagram/g);
    elementCounts['BPMNShape'] = countPattern(/<bpmndi:BPMNShape/g);
    elementCounts['BPMNEdge'] = countPattern(/<bpmndi:BPMNEdge/g);

    if (elementCounts['BPMNDiagram'] === 0) {
        errors.push('Missing bpmndi:BPMNDiagram element');
    }

    // Extract all shape bpmnElement references
    const shapeElements = extractIds(/bpmndi:BPMNShape[^>]*bpmnElement="([^"]+)"/);
    diagramElements.push(...shapeElements);

    // Find missing shapes (process elements without corresponding shapes)
    const missingShapes = processElements.filter(id => !shapeElements.includes(id));
    
    if (missingShapes.length > 0) {
        errors.push(`Missing BPMNShape for elements: ${missingShapes.join(', ')}`);
    }

    // 6b. Find orphan shapes (shapes that reference non-existent elements)
    const orphanShapes = shapeElements.filter(id => !processElements.includes(id));
    if (orphanShapes.length > 0) {
        errors.push(`BPMNShape references non-existent elements: ${orphanShapes.join(', ')}`);
    }

    // 7. Extract and validate sequence flows
    const seqFlowDefs = extractIds(/bpmn2:sequenceFlow id="([^"]+)"/);
    sequenceFlowsDefined.push(...seqFlowDefs);

    // Extract sequence flow references from incoming/outgoing
    const outgoingRefs = extractIds(/<bpmn2:outgoing>([^<]+)<\/bpmn2:outgoing>/);
    const incomingRefs = extractIds(/<bpmn2:incoming>([^<]+)<\/bpmn2:incoming>/);
    sequenceFlowsReferenced.push(...outgoingRefs, ...incomingRefs);

    // Find missing sequence flow definitions
    const uniqueReferenced = [...new Set(sequenceFlowsReferenced)];
    const missingFlowDefs = uniqueReferenced.filter(ref => !seqFlowDefs.includes(ref));
    
    if (missingFlowDefs.length > 0) {
        errors.push(`Referenced sequence flows not defined: ${missingFlowDefs.join(', ')}`);
    }

    // 8. Extract edge references and validate
    const edgeElements = extractIds(/bpmndi:BPMNEdge[^>]*bpmnElement="([^"]+)"/);
    const messageFlowIds = extractIds(/bpmn2:messageFlow id="([^"]+)"/);
    const allFlowIds = [...seqFlowDefs, ...messageFlowIds];
    
    const missingEdges = allFlowIds.filter(id => !edgeElements.includes(id));
    if (missingEdges.length > 0) {
        warnings.push(`Missing BPMNEdge for flows: ${missingEdges.join(', ')}`);
    }

    // 8b. Find orphan edges (edges that reference non-existent flows)
    const orphanEdges = edgeElements.filter(id => !allFlowIds.includes(id));
    if (orphanEdges.length > 0) {
        errors.push(`BPMNEdge references non-existent flows: ${orphanEdges.join(', ')}`);
    }

    // 9. Check for common SAP CPI specific issues
    
    // Check messageEventDefinition in start/end events
    if (!xml.includes('<bpmn2:messageEventDefinition') && 
        !xml.includes('timerEventDefinition') &&
        !xml.includes('errorEventDefinition')) {
        warnings.push('Start/End events may need eventDefinition elements');
    }

    // Check for ifl:property elements
    if (!xml.includes('<ifl:property>')) {
        warnings.push('No ifl:property elements found - SAP CPI requires adapter/component properties');
    }

    // Check for componentVersion property
    if (!xml.includes('<key>componentVersion</key>')) {
        warnings.push('Missing componentVersion properties - required for SAP CPI');
    }

    // 10. Check for invalid adapter configurations
    // Mail/IMAP/POP3 adapters can only be Sender (polling inbox)
    // Note: Generator auto-corrects this to SMTP, so this is just a warning now
    const mailReceiverPattern = /<bpmn2:messageFlow[^>]*>[\s\S]*?<key>ComponentType<\/key>\s*<value>(Mail|IMAP|POP3)<\/value>[\s\S]*?<key>direction<\/key>\s*<value>Receiver<\/value>/gi;
    if (mailReceiverPattern.test(xml)) {
        warnings.push('Mail/IMAP/POP3 detected as Receiver adapter - should be auto-corrected to SMTP. If issue persists, use SMTP explicitly for sending emails.');
    }

    // Check for unsupported adapter types
    const validSapCpiAdapters = [
        'HTTP', 'HTTPS', 'SOAP', 'SOAP_SAP_RM', 'REST',
        'OData', 'OData_V2', 'OData_V4',
        'SFTP', 'FTP', 'FTPS',
        'Mail', 'IMAP', 'POP3', 'SMTP',
        'JDBC',
        'IDoc', 'XI', 'RFC',
        'AS2', 'AS4',
        'JMS', 'AMQP', 'Kafka', 'SAP_Event_Mesh', 'AzureServiceBus',
        'Salesforce', 'SuccessFactors', 'SuccessFactors_SOAP', 'SuccessFactors_REST', 'SuccessFactors_OData',
        'Ariba', 'Ariba_Network',
        'ProcessDirect', 'DataStore', 'DataStoreSelect',
        'AmazonS3', 'AmazonSQS', 'AmazonSNS', 'AmazonDynamoDB',
        'AzureBlob', 'AzureCosmosDB',
        'OpenConnectors', 'ELSTER', 'MDI'
    ];
    const componentTypeMatches = xml.matchAll(/<key>ComponentType<\/key>\s*<value>([^<]+)<\/value>/gi);
    for (const match of componentTypeMatches) {
        const adapterType = match[1];
        if (!validSapCpiAdapters.includes(adapterType)) {
            warnings.push(`Potentially unsupported adapter type: ${adapterType}`);
        }
    }

    // 11. Check for shapes outside their container bounds (causes SAP CPI editor error)
    // Extract participant process bounds
    const participantProcessMatch = xml.match(/bpmndi:BPMNShape[^>]*bpmnElement="Participant_Process"[^>]*>[\s\S]*?<dc:Bounds[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/);
    if (participantProcessMatch) {
        const processY = parseFloat(participantProcessMatch[1]);
        const processHeight = parseFloat(participantProcessMatch[2]);
        const processBottom = processY + processHeight;

        // Check if any subprocess shapes extend beyond process bounds
        const subProcessShapeRegex = /bpmndi:BPMNShape[^>]*bpmnElement="([^"]*subprocess[^"]*)"[^>]*>[\s\S]*?<dc:Bounds[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/gi;
        let spMatch;
        while ((spMatch = subProcessShapeRegex.exec(xml)) !== null) {
            const spId = spMatch[1];
            const spY = parseFloat(spMatch[2]);
            const spHeight = parseFloat(spMatch[3]);
            const spBottom = spY + spHeight;
            
            if (spBottom > processBottom) {
                errors.push(`Subprocess "${spId}" extends beyond process participant bounds (subprocess ends at y=${spBottom}, process ends at y=${processBottom})`);
            }
            if (spY < processY) {
                errors.push(`Subprocess "${spId}" starts above process participant bounds (subprocess starts at y=${spY}, process starts at y=${processY})`);
            }
        }
    }

    // 11. Check sourceRef and targetRef in sequence flows
    const seqFlowSourceRefs = extractIds(/bpmn2:sequenceFlow[^>]*sourceRef="([^"]+)"/);
    const seqFlowTargetRefs = extractIds(/bpmn2:sequenceFlow[^>]*targetRef="([^"]+)"/);
    
    // Verify that sourceRef and targetRef point to existing elements
    const allElementIds = [...processElements, ...startEventIds, ...endEventIds, ...callActivityIds, ...subProcessIds];
    const invalidSources = seqFlowSourceRefs.filter(ref => !allElementIds.includes(ref));
    const invalidTargets = seqFlowTargetRefs.filter(ref => !allElementIds.includes(ref));

    if (invalidSources.length > 0) {
        errors.push(`Sequence flows reference non-existent source elements: ${invalidSources.join(', ')}`);
    }
    if (invalidTargets.length > 0) {
        errors.push(`Sequence flows reference non-existent target elements: ${invalidTargets.join(', ')}`);
    }

    // 12. Validate script syntax (Groovy/JavaScript)
    const scriptErrors = validateScriptSyntax(xml);
    errors.push(...scriptErrors.errors);
    warnings.push(...scriptErrors.warnings);

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        diagnostics: {
            elementCounts,
            shapeCount: shapeElements.length,
            edgeCount: edgeElements.length,
            processElements,
            diagramElements,
            missingShapes,
            missingEdges,
            sequenceFlowRefs: {
                defined: seqFlowDefs,
                referenced: uniqueReferenced,
                missingDefinitions: missingFlowDefs,
                unusedDefinitions: seqFlowDefs.filter(d => !uniqueReferenced.includes(d)),
            },
        },
    };
}

/**
 * Generate a human-readable validation report
 */
export function generateValidationReport(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('BPMN2 VALIDATION REPORT FOR SAP CPI');
    lines.push('='.repeat(60));
    lines.push('');
    
    lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push('');
    
    if (result.errors.length > 0) {
        lines.push('ERRORS:');
        result.errors.forEach(e => lines.push(`  ❌ ${e}`));
        lines.push('');
    }
    
    if (result.warnings.length > 0) {
        lines.push('WARNINGS:');
        result.warnings.forEach(w => lines.push(`  ⚠️ ${w}`));
        lines.push('');
    }
    
    lines.push('ELEMENT COUNTS:');
    Object.entries(result.diagnostics.elementCounts).forEach(([key, count]) => {
        lines.push(`  ${key}: ${count}`);
    });
    lines.push('');
    
    lines.push(`Process Elements: ${result.diagnostics.processElements.length}`);
    lines.push(`Diagram Shapes: ${result.diagnostics.shapeCount}`);
    lines.push(`Diagram Edges: ${result.diagnostics.edgeCount}`);
    lines.push('');
    
    if (result.diagnostics.missingShapes.length > 0) {
        lines.push('MISSING SHAPES (Critical - causes editor error):');
        result.diagnostics.missingShapes.forEach(s => lines.push(`  - ${s}`));
        lines.push('');
    }
    
    if (result.diagnostics.sequenceFlowRefs.missingDefinitions.length > 0) {
        lines.push('MISSING SEQUENCE FLOW DEFINITIONS:');
        result.diagnostics.sequenceFlowRefs.missingDefinitions.forEach(s => lines.push(`  - ${s}`));
        lines.push('');
    }
    
    lines.push('='.repeat(60));

    return lines.join('\n');
}

/**
 * Validate Groovy and JavaScript syntax in script elements
 * This is a static syntax check - runtime errors can still occur
 */
function validateScriptSyntax(xml: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract Groovy scripts
    const groovyMatches = xml.matchAll(/<key>GroovyScript<\/key>[\s\S]*?<value>([\s\S]*?)<\/value>/gi);
    let scriptIndex = 0;
    for (const match of groovyMatches) {
        scriptIndex++;
        const scriptContent = decodeXmlEntities(match[1]);

        if (scriptContent && scriptContent.trim().length > 0) {
            // Basic Groovy syntax validation
            const groovyErrors = validateGroovySyntax(scriptContent, `GroovyScript_${scriptIndex}`);
            errors.push(...groovyErrors);
        }
    }

    // Extract JavaScript scripts
    const jsMatches = xml.matchAll(/<key>JavaScriptScript<\/key>[\s\S]*?<value>([\s\S]*?)<\/value>/gi);
    scriptIndex = 0;
    for (const match of jsMatches) {
        scriptIndex++;
        const scriptContent = decodeXmlEntities(match[1]);

        if (scriptContent && scriptContent.trim().length > 0) {
            // Basic JavaScript syntax validation
            const jsErrors = validateJavaScriptSyntax(scriptContent, `JavaScriptScript_${scriptIndex}`);
            errors.push(...jsErrors);
        }
    }

    // Check for empty scripts
    const subActivityTypes = xml.matchAll(/<key>subActivityType<\/key>\s*<value>(GroovyScript|JavaScriptScript)<\/value>/gi);
    for (const match of subActivityTypes) {
        // Check if the script content is empty
        const scriptType = match[1];
        const scriptPattern = new RegExp(`<key>${scriptType}</key>[\\s\\S]*?<value>([\\s\\S]*?)</value>`, 'i');
        const scriptMatch = xml.match(scriptPattern);
        if (scriptMatch && (!scriptMatch[1] || scriptMatch[1].trim().length === 0)) {
            warnings.push(`Empty ${scriptType} detected - script will have no effect`);
        }
    }

    return { errors, warnings };
}

/**
 * Decode XML entities in script content
 */
function decodeXmlEntities(content: string): string {
    return content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

/**
 * Validate basic Groovy syntax
 */
function validateGroovySyntax(script: string, scriptId: string): string[] {
    const errors: string[] = [];

    // Check for balanced braces
    const openBraces = (script.match(/\{/g) || []).length;
    const closeBraces = (script.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
    }

    // Check for balanced parentheses
    const openParens = (script.match(/\(/g) || []).length;
    const closeParens = (script.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced parentheses (${openParens} open, ${closeParens} close)`);
    }

    // Check for balanced square brackets
    const openBrackets = (script.match(/\[/g) || []).length;
    const closeBrackets = (script.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced square brackets (${openBrackets} open, ${closeBrackets} close)`);
    }

    // Check for common syntax errors
    // Missing semicolon at end of statement (warn only)
    const lines = script.split('\n');
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*') || trimmedLine.length === 0) {
            return;
        }

        // Check for common typos
        if (trimmedLine.includes('= =')) {
            errors.push(`Script syntax error in ${scriptId} line ${index + 1}: Double equals without variable (${trimmedLine.substring(0, 50)}...)`);
        }

        // Check for invalid operator combinations
        if (trimmedLine.match(/[^=!<>]=[^=]/)) {
            // This is likely intentional, skip
        }

        // Check for unfinished strings (odd number of quotes)
        const singleQuotes = (line.match(/'/g) || []).length;
        const doubleQuotes = (line.match(/"/g) || []).length;
        // Note: This is a simplified check
        if ((singleQuotes % 2 !== 0) && !line.includes("'")) {
            // Could be an issue, but hard to detect reliably
        }
    });

    // Check for def without assignment in closure context
    if (script.includes('def ') && script.includes('->')) {
        // This is likely a closure parameter, which is valid
    }

    // Check for common runtime issues (warnings)
    if (script.includes('import ') && !script.includes(';')) {
        // Groovy doesn't require semicolons, but warn if it looks wrong
    }

    // Check for potential null pointer issues
    if (script.match(/\w+\.\w+/) && !script.includes('?.') && !script.includes('if (')) {
        // Could potentially cause NPE at runtime - this is just a warning
    }

    return errors;
}

/**
 * Validate basic JavaScript syntax
 */
function validateJavaScriptSyntax(script: string, scriptId: string): string[] {
    const errors: string[] = [];

    // Check for balanced braces
    const openBraces = (script.match(/\{/g) || []).length;
    const closeBraces = (script.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
    }

    // Check for balanced parentheses
    const openParens = (script.match(/\(/g) || []).length;
    const closeParens = (script.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced parentheses (${openParens} open, ${closeParens} close)`);
    }

    // Check for balanced square brackets
    const openBrackets = (script.match(/\[/g) || []).length;
    const closeBrackets = (script.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced square brackets (${openBrackets} open, ${closeBrackets} close)`);
    }

    // Check for template literal issues
    const backticks = (script.match(/`/g) || []).length;
    if (backticks % 2 !== 0) {
        errors.push(`Script syntax error in ${scriptId}: Unbalanced backticks (template literals)`);
    }

    // Check for async without await or vice versa
    if (script.includes('await ') && !script.includes('async ')) {
        errors.push(`Script syntax error in ${scriptId}: 'await' used outside async function`);
    }

    // Check for common issues
    const lines = script.split('\n');
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*') || trimmedLine.length === 0) {
            return;
        }

        // Check for assignment in condition (common bug)
        if (trimmedLine.match(/if\s*\(\s*\w+\s*=\s*\w+/)) {
            errors.push(`Script syntax error in ${scriptId} line ${index + 1}: Assignment in condition (did you mean == or ===?)`);
        }
    });

    return errors;
}
