/**
 * BPMN2 XML Generator for SAP CPI iFlows
 * 
 * This generator creates valid BPMN2 XML that can be deployed to SAP CPI.
 * It follows the exact structure expected by SAP CPI runtime.
 */

import { IFlowDesign, AdapterConfig, ScriptConfig, MappingConfig, ErrorHandlerConfig } from "@/components/ai/v2/specialized/iflow-creator/types";

export class BPMN2Generator {
    private idCounter = 1;

    /**
     * Generate complete BPMN2 XML from iFlow design
     */
    generate(design: IFlowDesign): string {
        // Generate unique IDs for all elements
        const processId = `Process_${this.generateUUID()}`;
        const collaborationId = `Collaboration_1`;
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://www.sap.com/xi/BPMN2">
${this.generateCollaboration(design, collaborationId, processId)}
${this.generateProcess(design, processId)}
${this.generateBPMNDiagram(design, collaborationId, processId)}
</bpmn2:definitions>`;

        return xml;
    }

    /**
     * Generate collaboration section with participants and message flows
     */
    private generateCollaboration(design: IFlowDesign, collaborationId: string, processId: string): string {
        const senderAdapters = design.adapters.filter(a => a.direction === 'Sender');
        const receiverAdapters = design.adapters.filter(a => a.direction === 'Receiver');
        
        // Build participants
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
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>transactionTimeout</key>
                    <value>30</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.1</value>
                </ifl:property>
                <ifl:property>
                    <key>transactionalHandling</key>
                    <value>Not Required</value>
                </ifl:property>
                <ifl:property>
                    <key>cmdVariantUri</key>
                    <value>ctype::IFlowVariant/cname::${this.escapeXml(design.metadata.name)}/version::1.0.0</value>
                </ifl:property>
            </bpmn2:extensionElements>
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
        let messageFlows = '';
        
        // Sender message flow
        if (senderAdapters.length > 0) {
            const adapter = senderAdapters[0];
            messageFlows += this.generateMessageFlow(adapter, 'Participant_1', 'Participant_Process');
        } else {
            // Default HTTP sender
            messageFlows += `        <bpmn2:messageFlow id="MessageFlow_1" name="HTTP" sourceRef="Participant_1" targetRef="Participant_Process">
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
${participants}
${messageFlows}
    </bpmn2:collaboration>`;
    }

    /**
     * Generate default sender adapter properties (HTTP)
     */
    private generateDefaultSenderProperties(): string {
        return `                <ifl:property>
                    <key>ComponentType</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentNS</key>
                    <value>sap</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVId</key>
                    <value>1.0.0</value>
                </ifl:property>
                <ifl:property>
                    <key>Description</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocol</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocolVersion</key>
                    <value>1.1</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocol</key>
                    <value>None</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocolVersion</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>direction</key>
                    <value>Sender</value>
                </ifl:property>
                <ifl:property>
                    <key>system</key>
                    <value>Sender</value>
                </ifl:property>
                <ifl:property>
                    <key>Address</key>
                    <value>/http/test</value>
                </ifl:property>`;
    }

    /**
     * Generate default receiver adapter properties (HTTP)
     */
    private generateDefaultReceiverProperties(): string {
        return `                <ifl:property>
                    <key>ComponentType</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentNS</key>
                    <value>sap</value>
                </ifl:property>
                <ifl:property>
                    <key>ComponentSWCVId</key>
                    <value>1.0.0</value>
                </ifl:property>
                <ifl:property>
                    <key>Description</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocol</key>
                    <value>HTTP</value>
                </ifl:property>
                <ifl:property>
                    <key>TransportProtocolVersion</key>
                    <value>1.1</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocol</key>
                    <value>None</value>
                </ifl:property>
                <ifl:property>
                    <key>MessageProtocolVersion</key>
                    <value></value>
                </ifl:property>
                <ifl:property>
                    <key>direction</key>
                    <value>Receiver</value>
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
                    <key>authenticationMethod</key>
                    <value>None</value>
                </ifl:property>`;
    }

    /**
     * Generate a single message flow (adapter)
     */
    private generateMessageFlow(adapter: AdapterConfig, sourceRef: string, targetRef: string): string {
        return `        <bpmn2:messageFlow id="${adapter.id}" name="${this.escapeXml(adapter.name)}" sourceRef="${sourceRef}" targetRef="${targetRef}">
            <bpmn2:extensionElements>
${this.generateAdapterProperties(adapter)}
            </bpmn2:extensionElements>
        </bpmn2:messageFlow>`;
    }

    /**
     * Generate adapter properties in SAP CPI format
     */
    private generateAdapterProperties(adapter: AdapterConfig): string {
        const properties: [string, string][] = [
            ['ComponentType', adapter.type],
            ['ComponentNS', 'sap'],
            ['ComponentSWCVId', '1.0.0'],
            ['Description', ''],
            ['TransportProtocol', adapter.protocol || 'HTTP'],
            ['TransportProtocolVersion', '1.1'],
            ['MessageProtocol', adapter.messageProtocol || 'None'],
            ['MessageProtocolVersion', ''],
            ['direction', adapter.direction],
            ['system', adapter.direction === 'Sender' ? 'Sender' : 'Receiver'],
        ];

        if (adapter.address) {
            properties.push(['Address', adapter.address]);
        }
        if (adapter.timeout) {
            properties.push(['requestTimeout', adapter.timeout.toString()]);
        }
        if (adapter.connectionTimeout) {
            properties.push(['connectionTimeout', adapter.connectionTimeout.toString()]);
        }
        if (adapter.authentication?.type) {
            properties.push(['authenticationMethod', adapter.authentication.type]);
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
     * Generate process section with activities
     */
    private generateProcess(design: IFlowDesign, processId: string): string {
        const activities: string[] = [];
        const sequenceFlows: string[] = [];

        // Start event with message event definition
        activities.push(`        <bpmn2:startEvent id="StartEvent_1" name="Start">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.0</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:outgoing>SequenceFlow_1</bpmn2:outgoing>
            <bpmn2:messageEventDefinition/>
        </bpmn2:startEvent>`);

        let sequenceCounter = 1;
        let previousId = 'StartEvent_1';
        const allElements: { id: string; type: string }[] = [];

        // Collect all elements in order
        design.scripts.forEach(script => allElements.push({ id: script.id, type: 'script' }));
        design.mappings.forEach(mapping => allElements.push({ id: mapping.id, type: 'mapping' }));

        // If no scripts or mappings, add a simple content modifier
        if (allElements.length === 0) {
            const contentModifierId = `CallActivity_${this.generateUUID()}`;
            activities.push(this.generateContentModifier(contentModifierId, 'Content Modifier', `SequenceFlow_${sequenceCounter}`, `SequenceFlow_${sequenceCounter + 1}`));
            sequenceFlows.push(`        <bpmn2:sequenceFlow id="SequenceFlow_${sequenceCounter}" sourceRef="${previousId}" targetRef="${contentModifierId}"/>`);
            previousId = contentModifierId;
            sequenceCounter++;
        }

        // Add scripts
        design.scripts.forEach((script, index) => {
            const currentId = script.id;
            const incomingFlow = `SequenceFlow_${sequenceCounter}`;
            const outgoingFlow = `SequenceFlow_${sequenceCounter + 1}`;

            activities.push(this.generateScript(script, incomingFlow, outgoingFlow));
            sequenceFlows.push(`        <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${currentId}"/>`);

            previousId = currentId;
            sequenceCounter++;
        });

        // Add mappings
        design.mappings.forEach((mapping, index) => {
            const currentId = mapping.id;
            const incomingFlow = `SequenceFlow_${sequenceCounter}`;
            const outgoingFlow = `SequenceFlow_${sequenceCounter + 1}`;

            activities.push(this.generateMapping(mapping, incomingFlow, outgoingFlow));
            sequenceFlows.push(`        <bpmn2:sequenceFlow id="${incomingFlow}" sourceRef="${previousId}" targetRef="${currentId}"/>`);

            previousId = currentId;
            sequenceCounter++;
        });

        // Final sequence flow to end
        sequenceFlows.push(`        <bpmn2:sequenceFlow id="SequenceFlow_${sequenceCounter}" sourceRef="${previousId}" targetRef="EndEvent_1"/>`);

        // End event with message event definition
        activities.push(`        <bpmn2:endEvent id="EndEvent_1" name="End">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.0</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:incoming>SequenceFlow_${sequenceCounter}</bpmn2:incoming>
            <bpmn2:messageEventDefinition/>
        </bpmn2:endEvent>`);

        // Combine all elements
        const allProcessContent = [...activities, ...sequenceFlows];

        return `    <bpmn2:process id="${processId}" name="${this.escapeXml(design.metadata.name)}" isExecutable="true">
        <bpmn2:extensionElements>
            <ifl:property>
                <key>transactionTimeout</key>
                <value>30</value>
            </ifl:property>
            <ifl:property>
                <key>componentVersion</key>
                <value>1.1</value>
            </ifl:property>
            <ifl:property>
                <key>cmdVariantUri</key>
                <value>ctype::IFlowVariant/cname::${this.escapeXml(design.metadata.name)}/version::1.0.0</value>
            </ifl:property>
        </bpmn2:extensionElements>
${allProcessContent.join('\n')}
    </bpmn2:process>`;
    }

    /**
     * Generate a content modifier activity
     */
    private generateContentModifier(id: string, name: string, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${id}" name="${this.escapeXml(name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>ContentModifier</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.0</value>
                </ifl:property>
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
                    <value>${this.escapeXml(script.scriptPath)}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.0</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate mapping activity (callActivity)
     */
    private generateMapping(mapping: MappingConfig, incoming: string, outgoing: string): string {
        return `        <bpmn2:callActivity id="${mapping.id}" name="${this.escapeXml(mapping.name)}">
            <bpmn2:extensionElements>
                <ifl:property>
                    <key>activityType</key>
                    <value>Enricher</value>
                </ifl:property>
                <ifl:property>
                    <key>subActivityType</key>
                    <value>${mapping.type === 'MessageMapping' ? 'MessageMapping' : 'ContentModifier'}</value>
                </ifl:property>
                <ifl:property>
                    <key>componentVersion</key>
                    <value>1.0</value>
                </ifl:property>
            </bpmn2:extensionElements>
            <bpmn2:incoming>${incoming}</bpmn2:incoming>
            <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
        </bpmn2:callActivity>`;
    }

    /**
     * Generate BPMN diagram (visual layout) - Required for SAP CPI
     */
    private generateBPMNDiagram(design: IFlowDesign, collaborationId: string, processId: string): string {
        // Calculate positions
        let xPos = 160;
        const yPos = 200;
        const elementWidth = 30;
        const elementSpacing = 100;
        const shapes: string[] = [];
        const edges: string[] = [];

        // Sender participant shape
        shapes.push(`            <bpmndi:BPMNShape id="Participant_1_gui" bpmnElement="Participant_1">
                <dc:Bounds x="50" y="50" width="100" height="60"/>
            </bpmndi:BPMNShape>`);

        // Process participant shape
        shapes.push(`            <bpmndi:BPMNShape id="Participant_Process_gui" bpmnElement="Participant_Process" isHorizontal="true">
                <dc:Bounds x="50" y="150" width="700" height="200"/>
            </bpmndi:BPMNShape>`);

        // Receiver participant shape
        shapes.push(`            <bpmndi:BPMNShape id="Participant_2_gui" bpmnElement="Participant_2">
                <dc:Bounds x="50" y="400" width="100" height="60"/>
            </bpmndi:BPMNShape>`);

        // Start event shape
        shapes.push(`            <bpmndi:BPMNShape id="StartEvent_1_gui" bpmnElement="StartEvent_1">
                <dc:Bounds x="${xPos}" y="${yPos}" width="32" height="32"/>
            </bpmndi:BPMNShape>`);
        xPos += elementSpacing;

        // Script shapes
        let seqNum = 1;
        design.scripts.forEach((script) => {
            shapes.push(`            <bpmndi:BPMNShape id="${script.id}_gui" bpmnElement="${script.id}">
                <dc:Bounds x="${xPos}" y="${yPos - 10}" width="48" height="48"/>
            </bpmndi:BPMNShape>`);
            edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + elementWidth}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);
            xPos += elementSpacing;
            seqNum++;
        });

        // Mapping shapes
        design.mappings.forEach((mapping) => {
            shapes.push(`            <bpmndi:BPMNShape id="${mapping.id}_gui" bpmnElement="${mapping.id}">
                <dc:Bounds x="${xPos}" y="${yPos - 10}" width="48" height="48"/>
            </bpmndi:BPMNShape>`);
            edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + 48}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);
            xPos += elementSpacing;
            seqNum++;
        });

        // If no elements, add content modifier shape
        if (design.scripts.length === 0 && design.mappings.length === 0) {
            shapes.push(`            <bpmndi:BPMNShape id="CallActivity_gui" bpmnElement="CallActivity_1">
                <dc:Bounds x="${xPos}" y="${yPos - 10}" width="48" height="48"/>
            </bpmndi:BPMNShape>`);
            edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + 32}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);
            xPos += elementSpacing;
            seqNum++;
        }

        // End event shape
        shapes.push(`            <bpmndi:BPMNShape id="EndEvent_1_gui" bpmnElement="EndEvent_1">
                <dc:Bounds x="${xPos}" y="${yPos}" width="32" height="32"/>
            </bpmndi:BPMNShape>`);
        
        // Final sequence flow edge
        edges.push(`            <bpmndi:BPMNEdge id="SequenceFlow_${seqNum}_gui" bpmnElement="SequenceFlow_${seqNum}">
                <di:waypoint x="${xPos - elementSpacing + 48}" y="${yPos + 16}"/>
                <di:waypoint x="${xPos}" y="${yPos + 16}"/>
            </bpmndi:BPMNEdge>`);

        // Message flow edges
        edges.push(`            <bpmndi:BPMNEdge id="MessageFlow_1_gui" bpmnElement="MessageFlow_1">
                <di:waypoint x="100" y="110"/>
                <di:waypoint x="100" y="150"/>
            </bpmndi:BPMNEdge>`);
        edges.push(`            <bpmndi:BPMNEdge id="MessageFlow_2_gui" bpmnElement="MessageFlow_2">
                <di:waypoint x="100" y="350"/>
                <di:waypoint x="100" y="400"/>
            </bpmndi:BPMNEdge>`);

        return `    <bpmndi:BPMNDiagram id="BPMNDiagram_1" name="Default Collaboration Diagram">
        <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collaborationId}">
${shapes.join('\n')}
${edges.join('\n')}
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