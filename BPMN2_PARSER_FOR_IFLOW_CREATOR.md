# BPMN2 Parser Documentation for iFlow Creator AI Agent

## Overview
This document details the BPMN2 XML parsing implementation used in the Performance Optimizer agent. **These same parsing capabilities will be needed for the iFlow Creator AI Agent** to generate valid SAP CPI iFlow packages.

## Key Files
- **Parser Library**: [`lib/sap-cpi/bpmn2-parser.ts`](lib/sap-cpi/bpmn2-parser.ts)
- **SAP CPI Client**: [`lib/sap-cpi/client.ts`](lib/sap-cpi/client.ts) (contains `extractBPMN2FromPackage()`)
- **Usage Example**: [`app/actions/ai-agents-v2.ts`](app/actions/ai-agents-v2.ts) (Performance Optimizer action)

---

## SAP CPI BPMN2 Structure

### File Format
- **Extension**: `.iflw` (BPMN2 XML with SAP CPI-specific extension)
- **Package Format**: ZIP file containing `.iflw` files
- **Namespace**: Uses `ifl:` prefix for SAP-specific elements

### Critical XML Structure

#### 1. **Adapters** (Message Flows)
Located in: `<bpmn2:collaboration>` → `<bpmn2:messageFlow>`

```xml
<bpmn2:collaboration id="collaboration">
    <bpmn2:messageFlow id="MessageFlow_123" name="SOAP Sender" sourceRef="Sender" targetRef="StartEvent_1">
        <bpmn2:extensionElements>
            <ifl:property>
                <key>ComponentType</key>
                <value>SOAP</value>
            </ifl:property>
            <ifl:property>
                <key>TransportProtocol</key>
                <value>HTTP</value>
            </ifl:property>
            <ifl:property>
                <key>MessageProtocol</key>
                <value>SOAP 1.x</value>
            </ifl:property>
            <ifl:property>
                <key>requestTimeout</key>
                <value>60000</value>
            </ifl:property>
            <ifl:property>
                <key>connectionTimeout</key>
                <value>60000</value>
            </ifl:property>
            <ifl:property>
                <key>poolSize</key>
                <value>50</value>
            </ifl:property>
            <ifl:property>
                <key>Direction</key>
                <value>Sender</value>
            </ifl:property>
        </bpmn2:extensionElements>
    </bpmn2:messageFlow>
</bpmn2:collaboration>
```

**Key Properties for Adapters**:
- `ComponentType`: SOAP, XI, HTTPS, SFTP, etc.
- `TransportProtocol`: HTTP, HTTPS, TCP, etc.
- `MessageProtocol`: SOAP 1.x, XI, AS2, etc.
- `Address`: Endpoint URL
- `requestTimeout`: Request timeout in milliseconds
- `connectionTimeout`: Connection timeout in milliseconds
- `poolSize`: Connection pool size
- `Direction`: "Sender" or "Receiver"

#### 2. **Scripts** (Call Activities)
Located in: `<bpmn2:process>` → `<bpmn2:callActivity>`

```xml
<bpmn2:callActivity id="CallActivity_449067" name="Data Validation">
    <bpmn2:extensionElements>
        <ifl:property>
            <key>activityType</key>
            <value>Script</value>
        </ifl:property>
        <ifl:property>
            <key>subActivityType</key>
            <value>GroovyScript</value>
        </ifl:property>
        <ifl:property>
            <key>script</key>
            <value>src/main/resources/script/DataValidation.groovy</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:incoming>SequenceFlow_1</bpmn2:incoming>
    <bpmn2:outgoing>SequenceFlow_2</bpmn2:outgoing>
</bpmn2:callActivity>
```

**Key Properties for Scripts**:
- `activityType`: Must be "Script"
- `subActivityType`: "GroovyScript", "JavaScriptScript", or "XSLTScript"
- `script`: Path to script file in package

#### 3. **Mappings** (Call Activities)
Located in: `<bpmn2:process>` → `<bpmn2:callActivity>`

```xml
<bpmn2:callActivity id="CallActivity_123" name="Message Mapping">
    <bpmn2:extensionElements>
        <ifl:property>
            <key>activityType</key>
            <value>Enricher</value>
        </ifl:property>
        <ifl:property>
            <key>mappingType</key>
            <value>MessageMapping</value>
        </ifl:property>
    </bpmn2:extensionElements>
</bpmn2:callActivity>
```

**Key Properties for Mappings**:
- `activityType`: "Enricher", "Splitter", "Aggregator", etc.
- `mappingType`: "MessageMapping", "XSLTMapping", etc.

#### 4. **Error Handlers** (Boundary Events)
Located in: `<bpmn2:process>` → `<bpmn2:boundaryEvent>`

```xml
<bpmn2:boundaryEvent id="BoundaryEvent_1" name="Error Handler" attachedToRef="CallActivity_1">
    <bpmn2:extensionElements>
        <ifl:property>
            <key>errorType</key>
            <value>Exception</value>
        </ifl:property>
        <ifl:property>
            <key>retryCount</key>
            <value>3</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:errorEventDefinition/>
</bpmn2:boundaryEvent>
```

---

## Parser Implementation

### Property Parsing (Critical!)

SAP CPI uses a **specific property format** with child elements:

```typescript
function parseIflProperties(extensionElements: any): Record<string, string> {
    const properties: Record<string, string> = {};
    
    if (!extensionElements?.['ifl:property']) {
        return properties;
    }

    const props = Array.isArray(extensionElements['ifl:property'])
        ? extensionElements['ifl:property']
        : [extensionElements['ifl:property']];

    for (const prop of props) {
        // SAP CPI format: <key> and <value> are child elements, not attributes
        const key = prop.key;
        const value = prop.value;
        
        if (key && value !== undefined) {
            properties[key] = String(value);
        }
    }

    return properties;
}
```

**Important**: Properties are NOT attributes (`@_key`, `@_value`). They are child elements (`<key>`, `<value>`).

### Adapter Extraction

```typescript
private extractAdapters(parsedXml: any): AdapterConfig[] {
    const adapters: AdapterConfig[] = [];
    
    // Navigate to collaboration section
    const collaboration = parsedXml['bpmn2:definitions']?.['bpmn2:collaboration'];
    if (!collaboration) return adapters;

    // Get all messageFlow elements
    const messageFlows = Array.isArray(collaboration['bpmn2:messageFlow'])
        ? collaboration['bpmn2:messageFlow']
        : collaboration['bpmn2:messageFlow']
        ? [collaboration['bpmn2:messageFlow']]
        : [];

    console.log(`[BPMN2Parser] 🔍 Found ${messageFlows.length} messageFlow elements`);

    for (const flow of messageFlows) {
        const adapter = this.parseMessageFlowAdapter(flow);
        if (adapter) {
            adapters.push(adapter);
        }
    }

    return adapters;
}
```

### Script Extraction

```typescript
private extractScripts(parsedXml: any): ScriptConfig[] {
    const scripts: ScriptConfig[] = [];
    
    // Navigate to process section
    const process = parsedXml['bpmn2:definitions']?.['bpmn2:process'];
    if (!process) return scripts;

    // Get all callActivity elements
    const callActivities = Array.isArray(process['bpmn2:callActivity'])
        ? process['bpmn2:callActivity']
        : process['bpmn2:callActivity']
        ? [process['bpmn2:callActivity']]
        : [];

    console.log(`[BPMN2Parser] 🔍 Found ${callActivities.length} callActivity elements in process`);

    for (const activity of callActivities) {
        const script = this.parseCallActivityScript(activity);
        if (script) {
            scripts.push(script);
        }
    }

    return scripts;
}
```

---

## Performance Anti-Patterns Detected

The parser identifies these performance issues:

### 1. **Missing Timeouts**
```typescript
if (!adapter.timeout || adapter.timeout === 0) {
    issues.push('Missing or zero timeout configuration');
}
```

### 2. **Small Connection Pools**
```typescript
if (adapter.poolSize && adapter.poolSize < 10) {
    issues.push(`Small connection pool size: ${adapter.poolSize}`);
}
```

### 3. **Long Timeouts**
```typescript
if (adapter.timeout && adapter.timeout > 300000) { // 5 minutes
    issues.push(`Very long timeout: ${adapter.timeout}ms`);
}
```

### 4. **Complex Scripts**
```typescript
// Detect complexity based on script type
if (script.type === 'groovy' || script.type === 'javascript') {
    issues.push('Complex script - consider optimization');
}
```

---

## Usage in Performance Optimizer

### 1. **Download iFlow Package**
```typescript
const packageBuffer = await sapCpiClient.downloadIFlowPackage(iflowId);
```

### 2. **Extract BPMN2 XML**
```typescript
const bpmn2Xml = sapCpiClient.extractBPMN2FromPackage(packageBuffer);
```

### 3. **Parse BPMN2**
```typescript
const parser = new BPMN2Parser();
const bpmn2ParseResult = parser.parse(bpmn2Xml);
```

### 4. **Access Parsed Data**
```typescript
const {
    metadata,      // iFlow name, version, description
    adapters,      // All adapter configurations
    scripts,       // All script configurations
    mappings,      // All mapping configurations
    errorHandlers, // All error handlers
} = bpmn2ParseResult;
```

---

## For iFlow Creator AI Agent

### What You'll Need

The iFlow Creator will need to **generate** the same BPMN2 structure that the parser **reads**:

1. **Generate `<bpmn2:collaboration>` section** with `<bpmn2:messageFlow>` for each adapter
2. **Generate `<bpmn2:process>` section** with:
   - `<bpmn2:callActivity>` for scripts
   - `<bpmn2:callActivity>` for mappings
   - `<bpmn2:boundaryEvent>` for error handlers
3. **Generate properties** in SAP CPI format (`<key>` and `<value>` child elements)
4. **Package as ZIP** with `.iflw` extension

### Reverse Engineering Approach

```typescript
// Instead of parsing existing BPMN2:
const bpmn2ParseResult = parser.parse(bpmn2Xml);

// You'll be generating new BPMN2:
const bpmn2Xml = generator.generate({
    adapters: [
        {
            id: 'MessageFlow_1',
            name: 'SOAP Sender',
            type: 'SOAP',
            direction: 'Sender',
            protocol: 'HTTP',
            timeout: 60000,
            // ... other properties
        }
    ],
    scripts: [
        {
            id: 'CallActivity_1',
            name: 'Data Validation',
            type: 'groovy',
            scriptPath: 'src/main/resources/script/DataValidation.groovy',
        }
    ],
    // ... mappings, error handlers, etc.
});
```

### Key Considerations

1. **ID Generation**: Each element needs a unique ID (e.g., `MessageFlow_123`, `CallActivity_456`)
2. **Sequence Flows**: Connect elements with `<bpmn2:sequenceFlow>` elements
3. **Start/End Events**: Every process needs `<bpmn2:startEvent>` and `<bpmn2:endEvent>`
4. **Namespace Declarations**: Include all required namespaces in `<bpmn2:definitions>`
5. **Property Format**: Always use `<key>` and `<value>` child elements, never attributes

---

## Testing

### Validation Checklist

When implementing iFlow Creator, validate generated BPMN2 by:

1. ✅ Parse it with the existing BPMN2Parser
2. ✅ Verify all adapters are extracted correctly
3. ✅ Verify all scripts are extracted correctly
4. ✅ Verify all properties are in correct format
5. ✅ Import into SAP CPI and verify it deploys successfully

### Example Test

```typescript
// Generate BPMN2
const generatedBpmn2 = iflowCreator.generateBPMN2(config);

// Validate by parsing
const parser = new BPMN2Parser();
const parseResult = parser.parse(generatedBpmn2);

// Verify
expect(parseResult.adapters).toHaveLength(config.adapters.length);
expect(parseResult.scripts).toHaveLength(config.scripts.length);
```

---

## Summary

The BPMN2 parser provides a **complete understanding** of SAP CPI's BPMN2 structure. When building the iFlow Creator:

1. **Reuse the parser** to validate generated BPMN2
2. **Mirror the structure** that the parser expects
3. **Follow SAP CPI conventions** for property format and element placement
4. **Test thoroughly** by round-tripping: generate → parse → verify

This ensures the iFlow Creator generates **valid, deployable** SAP CPI iFlow packages.