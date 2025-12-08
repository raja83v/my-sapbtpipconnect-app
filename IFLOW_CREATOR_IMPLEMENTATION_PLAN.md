# iFlow Creator AI Agent - Implementation Plan

**Status**: Ready to Begin  
**Date**: December 6, 2024  
**Priority**: Phase 3 - Medium Priority Agent  
**Related Documentation**: [`BPMN2_PARSER_FOR_IFLOW_CREATOR.md`](BPMN2_PARSER_FOR_IFLOW_CREATOR.md)

---

## Overview

The iFlow Creator AI Agent is a **multi-step wizard** that guides users through creating SAP CPI integration flows using natural language descriptions. The AI analyzes requirements and generates complete, deployable iFlow packages.

### Key Features
- 🎯 Natural language iFlow description
- 🤖 AI-powered flow design generation
- 📋 Detailed component breakdown (adapters, scripts, mappings)
- ✅ User review and approval workflow
- 🚀 Direct deployment to SAP CPI tenant
- 📦 Package management (new or existing)

---

## User Workflow

### Step 1: Package Selection
**User chooses:**
- ✨ Create new integration package
- 📦 Add to existing package

**UI Elements:**
- Radio button selection
- If existing: Searchable dropdown of packages from SAP CPI
- If new: Input fields for package name, ID, description

### Step 2: iFlow Description
**User provides:**
- Natural language description of the integration flow
- Business requirements
- Source and target systems
- Data transformation needs

**UI Elements:**
- Large textarea with helpful prompts
- Example descriptions
- Character count (min 100 chars recommended)
- Suggested templates (e.g., "SOAP to REST", "File to Database", "EDI Processing")

### Step 3: AI Analysis & Design
**AI generates:**
- Complete flow architecture
- Adapter configurations (sender/receiver)
- Script requirements (Groovy/JavaScript)
- Mapping specifications
- Error handling strategy
- Performance recommendations

**UI Elements:**
- Loading state with progress indicator
- Detailed breakdown in expandable sections:
  - 📡 **Adapters**: Type, protocol, configuration
  - 📝 **Scripts**: Purpose, language, complexity
  - 🔄 **Mappings**: Type, source/target fields
  - ⚠️ **Error Handlers**: Retry logic, alerts
  - ⚙️ **Configuration**: Timeouts, pool sizes, etc.

### Step 4: Review & Approval
**User reviews:**
- Complete flow design
- All components and configurations
- Estimated complexity and performance

**User actions:**
- ✅ Approve and create
- ✏️ Request modifications (back to Step 2 with context)
- ❌ Cancel

**UI Elements:**
- Side-by-side comparison view
- Edit buttons for each section
- Approval checklist
- Warning for any potential issues

### Step 5: iFlow Creation
**System executes:**
- Generate BPMN2 XML structure
- Create script files (Groovy/JavaScript)
- Package as ZIP file
- Upload to SAP CPI via API
- Deploy (optional)

**UI Elements:**
- Progress steps with status
- Success confirmation with iFlow details
- Link to view in SAP CPI
- Option to create another iFlow

---

## Technical Architecture

### Component Structure

```
components/ai/v2/specialized/iflow-creator/
├── iflow-creator.tsx              # Main wizard component
├── steps/
│   ├── package-selection.tsx      # Step 1: Choose package
│   ├── description-input.tsx      # Step 2: Describe iFlow
│   ├── ai-design-review.tsx       # Step 3: AI-generated design
│   ├── approval-review.tsx        # Step 4: User approval
│   └── creation-progress.tsx      # Step 5: Creation status
├── components/
│   ├── adapter-card.tsx           # Display adapter config
│   ├── script-card.tsx            # Display script details
│   ├── mapping-card.tsx           # Display mapping info
│   ├── flow-diagram.tsx           # Visual flow representation
│   └── modification-dialog.tsx    # Edit component dialog
└── types.ts                       # TypeScript interfaces
```

### Data Flow

```typescript
// Step 1: Package Selection
interface PackageSelection {
    mode: 'new' | 'existing';
    packageId?: string;        // For existing
    packageName?: string;      // For new
    packageDescription?: string; // For new
}

// Step 2: User Input
interface IFlowDescription {
    description: string;       // Natural language
    sourceSystem?: string;
    targetSystem?: string;
    dataFormat?: string;
    requirements?: string[];
}

// Step 3: AI-Generated Design
interface IFlowDesign {
    metadata: {
        name: string;
        id: string;
        description: string;
        version: string;
    };
    adapters: AdapterConfig[];
    scripts: ScriptConfig[];
    mappings: MappingConfig[];
    errorHandlers: ErrorHandlerConfig[];
    flowDiagram: FlowNode[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    performanceNotes: string[];
}

// Step 4: User Modifications (optional)
interface UserModifications {
    adapters?: Partial<AdapterConfig>[];
    scripts?: Partial<ScriptConfig>[];
    mappings?: Partial<MappingConfig>[];
    additionalNotes?: string;
}

// Step 5: Creation Result
interface CreationResult {
    success: boolean;
    iflowId: string;
    packageId: string;
    deploymentUrl: string;
    errors?: string[];
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create wizard component structure
- [ ] Implement Step 1: Package Selection
- [ ] Implement Step 2: Description Input
- [ ] Create shared UI components (cards, dialogs)
- [ ] Set up state management (React Context or Zustand)

### Phase 2: AI Integration (Week 2)
- [ ] Create AI prompt for iFlow design generation
- [ ] Implement server action for AI analysis
- [ ] Implement Step 3: AI Design Review
- [ ] Add visual flow diagram component
- [ ] Handle AI response parsing and validation

### Phase 3: BPMN2 Generation (Week 3)
- [ ] Create BPMN2 XML generator (reverse of parser)
- [ ] Implement adapter XML generation
- [ ] Implement script XML generation
- [ ] Implement mapping XML generation
- [ ] Implement error handler XML generation
- [ ] Add XML validation against SAP CPI schema

### Phase 4: SAP CPI Integration (Week 4)
- [ ] Extend SAP CPI client with create operations
- [ ] Implement package creation API
- [ ] Implement iFlow upload API
- [ ] Implement deployment API (optional)
- [ ] Add error handling and rollback

### Phase 5: User Experience (Week 5)
- [ ] Implement Step 4: Approval Review
- [ ] Implement Step 5: Creation Progress
- [ ] Add modification dialog for editing components
- [ ] Add template library for common patterns
- [ ] Polish UI/UX and animations

### Phase 6: Testing & Refinement (Week 6)
- [ ] Unit tests for BPMN2 generator
- [ ] Integration tests with SAP CPI sandbox
- [ ] End-to-end wizard testing
- [ ] Performance optimization
- [ ] Documentation and examples

---

## Key Files to Create

### 1. Main Component
**File**: `components/ai/v2/specialized/iflow-creator/iflow-creator.tsx`
```typescript
export function IFlowCreator({ tenantId }: { tenantId: string }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [packageSelection, setPackageSelection] = useState<PackageSelection>();
    const [description, setDescription] = useState<IFlowDescription>();
    const [design, setDesign] = useState<IFlowDesign>();
    const [modifications, setModifications] = useState<UserModifications>();
    
    // Wizard navigation
    // Step rendering
    // State management
}
```

### 2. BPMN2 Generator
**File**: `lib/sap-cpi/bpmn2-generator.ts`
```typescript
export class BPMN2Generator {
    generate(design: IFlowDesign): string {
        // Generate complete BPMN2 XML
        // Use templates for each component type
        // Validate against schema
    }
    
    private generateCollaboration(adapters: AdapterConfig[]): string {
        // Generate <bpmn2:collaboration> with messageFlows
    }
    
    private generateProcess(scripts: ScriptConfig[], mappings: MappingConfig[]): string {
        // Generate <bpmn2:process> with callActivities
    }
    
    private generateProperties(props: Record<string, string>): string {
        // Generate SAP CPI property format
    }
}
```

### 3. Server Actions
**File**: `app/actions/iflow-creator.ts`
```typescript
export async function generateIFlowDesign(
    description: IFlowDescription
): Promise<IFlowDesign> {
    // Call AI to analyze description
    // Generate complete design
    // Return structured design object
}

export async function createIFlow(
    tenantId: string,
    packageSelection: PackageSelection,
    design: IFlowDesign,
    modifications?: UserModifications
): Promise<CreationResult> {
    // Generate BPMN2 XML
    // Create package if needed
    // Upload iFlow to SAP CPI
    // Return creation result
}
```

### 4. SAP CPI Client Extensions
**File**: `lib/sap-cpi/client.ts` (extend existing)
```typescript
// Add these methods to SAPCPIClient class

async createIntegrationPackage(
    name: string,
    id: string,
    description: string
): Promise<string> {
    // POST to /api/v1/IntegrationPackages
}

async uploadIFlow(
    packageId: string,
    iflowId: string,
    iflowName: string,
    bpmn2Xml: string,
    scripts?: { path: string; content: string }[]
): Promise<string> {
    // Create ZIP package
    // POST to /api/v1/IntegrationDesigntimeArtifacts
}

async deployIFlow(iflowId: string): Promise<void> {
    // POST to /api/v1/DeployIntegrationDesigntimeArtifact
}
```

---

## AI Prompt Design

### System Prompt
```
You are an expert SAP Cloud Platform Integration (CPI) architect. Your role is to design complete integration flows based on user requirements.

Given a natural language description, you must:
1. Identify source and target systems
2. Determine required adapters (SOAP, REST, SFTP, etc.)
3. Design data transformation logic
4. Specify script requirements (Groovy/JavaScript)
5. Define error handling strategy
6. Recommend performance optimizations

Output a complete, deployable iFlow design in JSON format.
```

### User Prompt Template
```
Design an SAP CPI integration flow with the following requirements:

Description: {user_description}

Source System: {source_system}
Target System: {target_system}
Data Format: {data_format}

Additional Requirements:
{requirements}

Provide a complete design including:
- Adapters (sender and receiver)
- Scripts (if needed for transformation/validation)
- Mappings (field mappings, transformations)
- Error handlers (retry logic, alerts)
- Performance recommendations (timeouts, pool sizes)

Format the response as a structured JSON object matching the IFlowDesign interface.
```

---

## BPMN2 XML Templates

### Adapter Template (MessageFlow)
```xml
<bpmn2:messageFlow id="{id}" name="{name}" sourceRef="{sourceRef}" targetRef="{targetRef}">
    <bpmn2:extensionElements>
        <ifl:property>
            <key>ComponentType</key>
            <value>{componentType}</value>
        </ifl:property>
        <ifl:property>
            <key>TransportProtocol</key>
            <value>{transportProtocol}</value>
        </ifl:property>
        <ifl:property>
            <key>MessageProtocol</key>
            <value>{messageProtocol}</value>
        </ifl:property>
        <ifl:property>
            <key>Address</key>
            <value>{address}</value>
        </ifl:property>
        <ifl:property>
            <key>requestTimeout</key>
            <value>{requestTimeout}</value>
        </ifl:property>
        <ifl:property>
            <key>Direction</key>
            <value>{direction}</value>
        </ifl:property>
    </bpmn2:extensionElements>
</bpmn2:messageFlow>
```

### Script Template (CallActivity)
```xml
<bpmn2:callActivity id="{id}" name="{name}">
    <bpmn2:extensionElements>
        <ifl:property>
            <key>activityType</key>
            <value>Script</value>
        </ifl:property>
        <ifl:property>
            <key>subActivityType</key>
            <value>{scriptType}Script</value>
        </ifl:property>
        <ifl:property>
            <key>script</key>
            <value>{scriptPath}</value>
        </ifl:property>
    </bpmn2:extensionElements>
    <bpmn2:incoming>{incomingFlow}</bpmn2:incoming>
    <bpmn2:outgoing>{outgoingFlow}</bpmn2:outgoing>
</bpmn2:callActivity>
```

---

## Validation Strategy

### Pre-Generation Validation
1. ✅ Description is not empty (min 100 chars)
2. ✅ At least one adapter specified
3. ✅ Valid adapter types and protocols
4. ✅ Script syntax is valid (if provided)
5. ✅ No conflicting configurations

### Post-Generation Validation
1. ✅ Parse generated BPMN2 with existing parser
2. ✅ Verify all components extracted correctly
3. ✅ Check for performance anti-patterns
4. ✅ Validate against SAP CPI schema
5. ✅ Test package structure (ZIP integrity)

### Round-Trip Testing
```typescript
// Generate BPMN2
const bpmn2Xml = generator.generate(design);

// Parse it back
const parser = new BPMN2Parser();
const parsed = parser.parse(bpmn2Xml);

// Verify
expect(parsed.adapters).toHaveLength(design.adapters.length);
expect(parsed.scripts).toHaveLength(design.scripts.length);
// ... more assertions
```

---

## Error Handling

### User-Facing Errors
- ❌ Invalid package selection
- ❌ Description too short or unclear
- ❌ AI generation failed
- ❌ Invalid component configuration
- ❌ SAP CPI API error
- ❌ Deployment failed

### Recovery Strategies
- 🔄 Retry AI generation with refined prompt
- 💾 Save draft state for later
- 📝 Provide detailed error messages
- 🔙 Allow going back to previous steps
- 📞 Suggest contacting support for API errors

---

## Success Metrics

### User Experience
- ⏱️ Time to create iFlow: < 5 minutes
- 🎯 First-time success rate: > 80%
- 😊 User satisfaction: > 4.5/5
- 🔄 Modification rate: < 30%

### Technical Performance
- 🚀 AI response time: < 10 seconds
- 📦 Package generation: < 5 seconds
- ☁️ Upload to SAP CPI: < 15 seconds
- ✅ Deployment success: > 95%

---

## Future Enhancements

### Phase 2 Features
- 📚 Template library (common patterns)
- 🔍 iFlow similarity search
- 🎨 Visual flow designer (drag-and-drop)
- 📊 Cost estimation before creation
- 🧪 Test data generation
- 📖 Auto-generated documentation

### Advanced Features
- 🤝 Collaborative editing
- 📜 Version control integration
- 🔄 Clone and modify existing iFlows
- 🎯 Best practice recommendations
- 📈 Performance prediction
- 🔐 Security scanning

---

## Dependencies

### Required Libraries
- `fast-xml-parser` - XML parsing/generation
- `jszip` - ZIP file creation
- `zod` - Schema validation
- `react-hook-form` - Form management
- `zustand` - State management

### SAP CPI APIs
- `GET /api/v1/IntegrationPackages` - List packages
- `POST /api/v1/IntegrationPackages` - Create package
- `POST /api/v1/IntegrationDesigntimeArtifacts` - Upload iFlow
- `POST /api/v1/DeployIntegrationDesigntimeArtifact` - Deploy iFlow

---

## Related Documentation

- [`BPMN2_PARSER_FOR_IFLOW_CREATOR.md`](BPMN2_PARSER_FOR_IFLOW_CREATOR.md) - BPMN2 structure reference
- [`AI_AGENT_IMPLEMENTATION_GUIDE.md`](AI_AGENT_IMPLEMENTATION_GUIDE.md) - Overall agent architecture
- [`lib/sap-cpi/bpmn2-parser.ts`](lib/sap-cpi/bpmn2-parser.ts) - Parser implementation (reference for generator)
- [`components/ai/v2/specialized/performance-optimizer/`](components/ai/v2/specialized/performance-optimizer/) - Similar agent pattern

---

## Next Steps

1. ✅ Review and approve this implementation plan
2. 🔄 Create initial component structure
3. 🔄 Implement Step 1: Package Selection
4. 🔄 Implement Step 2: Description Input
5. 🔄 Design AI prompt for iFlow generation
6. 🔄 Create BPMN2 generator foundation

**Estimated Timeline**: 6 weeks  
**Team Size**: 1-2 developers  
**Priority**: Medium (Phase 3)