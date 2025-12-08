# BPMN2 Parser & Advanced iFlow Analysis - Feature Specification

## Overview

Enhance the Performance Optimizer to parse SAP CPI iFlow BPMN2 XML packages and extract detailed configuration information for deeper performance analysis.

## Current State

The Performance Optimizer currently analyzes:
- ✅ iFlow metadata (name, package, version, status)
- ✅ Runtime deployment information
- ✅ Execution metrics (response times, throughput, error rates)
- ✅ 7-day performance trends from monitoring logs

**Gap:** No analysis of actual iFlow design/configuration (adapters, mappings, scripts, routing logic)

## Proposed Enhancement

Parse BPMN2 XML from SAP CPI iFlow packages to extract and analyze:

### 1. Adapter Configurations
Extract and analyze all adapter settings:

#### Sender Adapters
- **HTTP/REST Adapters**
  - Connection timeout
  - Response timeout
  - Thread pool size
  - Max connections
  - Keep-alive settings
  
- **SOAP Adapters**
  - SOAP version (1.1 vs 1.2)
  - WS-Security settings
  - Connection pooling
  - Timeout configurations

- **SFTP/FTP Adapters**
  - Connection timeout
  - Max connections
  - File polling interval
  - Batch size

- **OData Adapters**
  - Batch size
  - Pagination settings
  - Query timeout

- **JDBC Adapters**
  - Connection pool size
  - Query timeout
  - Transaction isolation level
  - Batch processing settings

#### Receiver Adapters
- Same categories as sender adapters
- Additional: Retry configuration, error handling

### 2. Message Mappings
Analyze transformation complexity:

#### Message Mapping Types
- **Graphical Mappings**
  - Number of source/target fields
  - Number of transformation functions
  - Use of user-defined functions
  - Complexity score (simple/medium/complex)

- **XSLT Mappings**
  - File size
  - Number of templates
  - Use of complex XPath expressions
  - Recursive templates

- **Groovy Script Mappings**
  - Lines of code
  - Cyclomatic complexity
  - Use of external libraries
  - Database calls within scripts
  - API calls within scripts

- **JavaScript Mappings**
  - Similar analysis to Groovy

### 3. Content Modifiers & Scripts
Analyze all script steps:

#### Script Analysis
- **Groovy Scripts**
  - Lines of code
  - Complexity metrics
  - External dependencies
  - Database queries
  - HTTP calls
  - File I/O operations
  - Loop complexity
  - Memory-intensive operations

- **JavaScript**
  - Same metrics as Groovy

#### Content Modifiers
- Number of headers modified
- Body modifications
- Use of dynamic expressions

### 4. Routing & Flow Control
Analyze flow logic:

#### Router Steps
- Number of routes
- Condition complexity
- Default route handling

#### Splitter Steps
- Splitter type (iterating, general)
- Parallel processing configuration
- Aggregation strategy

#### Multicast Steps
- Number of parallel branches
- Aggregation strategy
- Timeout settings

#### Exception Subprocess
- Error handling strategy
- Retry configuration
- Escalation paths

### 5. Resource Limits & Configuration
Extract resource settings:

#### Runtime Configuration
- Memory allocation
- CPU limits
- Thread pool sizes
- Queue sizes
- Timeout configurations

#### Processing Settings
- Transaction handling
- Persistence settings
- Quality of Service (QoS)
- Delivery assurance

### 6. Anti-Pattern Detection
Identify common performance issues:

#### Synchronous Processing Anti-Patterns
- ❌ Synchronous HTTP calls in loops
- ❌ Database queries in message loops
- ❌ Blocking I/O operations
- ❌ Missing timeout configurations
- ❌ Unbounded loops

#### Payload Anti-Patterns
- ❌ Large payload processing without streaming
- ❌ XML parsing of multi-MB documents
- ❌ In-memory aggregation of large datasets
- ❌ Missing payload size limits

#### Mapping Anti-Patterns
- ❌ Complex nested loops in mappings
- ❌ Recursive transformations without limits
- ❌ Database lookups in mapping functions
- ❌ API calls in transformation logic

#### Connection Anti-Patterns
- ❌ Small connection pool sizes
- ❌ Missing connection timeouts
- ❌ No connection pooling
- ❌ Excessive connection creation

#### Script Anti-Patterns
- ❌ Synchronous sleep() calls
- ❌ Unbounded while loops
- ❌ Memory leaks (unclosed resources)
- ❌ Inefficient string concatenation
- ❌ Excessive logging in loops

## Technical Implementation

### Phase 1: BPMN2 XML Parser

#### Dependencies
```json
{
  "dependencies": {
    "fast-xml-parser": "^4.3.0",
    "jszip": "^3.10.1"
  }
}
```

#### File Structure
```
lib/sap-cpi/
├── client.ts (existing)
├── bpmn2-parser.ts (new)
├── adapter-analyzer.ts (new)
├── script-analyzer.ts (new)
├── anti-pattern-detector.ts (new)
└── types/
    ├── bpmn2.ts (new)
    ├── adapters.ts (new)
    └── analysis.ts (new)
```

#### Core Parser (`lib/sap-cpi/bpmn2-parser.ts`)
```typescript
export interface BPMN2ParseResult {
  iflowId: string;
  name: string;
  version: string;
  
  // Flow elements
  startEvents: StartEvent[];
  endEvents: EndEvent[];
  serviceTasks: ServiceTask[];
  scriptTasks: ScriptTask[];
  routers: Router[];
  splitters: Splitter[];
  multicasts: Multicast[];
  
  // Adapters
  senderAdapters: AdapterConfig[];
  receiverAdapters: AdapterConfig[];
  
  // Mappings
  messageMappings: MappingConfig[];
  
  // Scripts
  groovyScripts: ScriptConfig[];
  javascriptScripts: ScriptConfig[];
  
  // Resources
  resourceFiles: ResourceFile[];
  
  // Configuration
  runtimeConfig: RuntimeConfig;
}

export class BPMN2Parser {
  async parseIFlowPackage(zipBuffer: Buffer): Promise<BPMN2ParseResult>;
  async parseIFlowXML(xmlContent: string): Promise<BPMN2ParseResult>;
  private extractAdapters(bpmn: any): AdapterConfig[];
  private extractMappings(bpmn: any): MappingConfig[];
  private extractScripts(bpmn: any): ScriptConfig[];
  private extractRouters(bpmn: any): Router[];
}
```

#### Adapter Analyzer (`lib/sap-cpi/adapter-analyzer.ts`)
```typescript
export interface AdapterAnalysis {
  adapterId: string;
  type: string;
  direction: 'sender' | 'receiver';
  
  // Performance metrics
  connectionPoolSize?: number;
  connectionTimeout?: number;
  responseTimeout?: number;
  maxConnections?: number;
  
  // Issues detected
  issues: AdapterIssue[];
  recommendations: AdapterRecommendation[];
  
  // Scoring
  performanceScore: number; // 0-100
  configurationScore: number; // 0-100
}

export class AdapterAnalyzer {
  analyzeAdapter(adapter: AdapterConfig): AdapterAnalysis;
  detectAdapterIssues(adapter: AdapterConfig): AdapterIssue[];
  generateRecommendations(analysis: AdapterAnalysis): AdapterRecommendation[];
}
```

#### Script Analyzer (`lib/sap-cpi/script-analyzer.ts`)
```typescript
export interface ScriptAnalysis {
  scriptId: string;
  type: 'groovy' | 'javascript';
  
  // Metrics
  linesOfCode: number;
  cyclomaticComplexity: number;
  
  // Detected patterns
  databaseCalls: number;
  httpCalls: number;
  fileOperations: number;
  loops: LoopAnalysis[];
  
  // Issues
  antiPatterns: AntiPattern[];
  performanceIssues: PerformanceIssue[];
  
  // Scoring
  complexityScore: number; // 0-100
  performanceScore: number; // 0-100
}

export class ScriptAnalyzer {
  analyzeScript(script: ScriptConfig): ScriptAnalysis;
  detectAntiPatterns(script: ScriptConfig): AntiPattern[];
  calculateComplexity(code: string): number;
  detectSynchronousCalls(code: string): SynchronousCall[];
}
```

#### Anti-Pattern Detector (`lib/sap-cpi/anti-pattern-detector.ts`)
```typescript
export interface AntiPattern {
  id: string;
  type: AntiPatternType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string; // Element ID where detected
  description: string;
  impact: string;
  recommendation: string;
  codeExample?: string;
}

export enum AntiPatternType {
  SYNCHRONOUS_IN_LOOP = 'synchronous_in_loop',
  LARGE_PAYLOAD_NO_STREAMING = 'large_payload_no_streaming',
  MISSING_TIMEOUT = 'missing_timeout',
  SMALL_CONNECTION_POOL = 'small_connection_pool',
  DATABASE_IN_MAPPING = 'database_in_mapping',
  UNBOUNDED_LOOP = 'unbounded_loop',
  MEMORY_LEAK = 'memory_leak',
  INEFFICIENT_STRING_CONCAT = 'inefficient_string_concat',
  EXCESSIVE_LOGGING = 'excessive_logging',
}

export class AntiPatternDetector {
  detectAll(parseResult: BPMN2ParseResult): AntiPattern[];
  detectSynchronousAntiPatterns(parseResult: BPMN2ParseResult): AntiPattern[];
  detectPayloadAntiPatterns(parseResult: BPMN2ParseResult): AntiPattern[];
  detectMappingAntiPatterns(parseResult: BPMN2ParseResult): AntiPattern[];
  detectConnectionAntiPatterns(parseResult: BPMN2ParseResult): AntiPattern[];
  detectScriptAntiPatterns(parseResult: BPMN2ParseResult): AntiPattern[];
}
```

### Phase 2: Integration with Performance Optimizer

#### Enhanced Analysis Flow
```typescript
// In app/actions/ai-agents-v2.ts - analyzeIFlowPerformance()

// 1. Download iFlow package from SAP CPI
const iflowPackage = await cpiClient.downloadIFlowConfiguration(iflow.iFlowId);

// 2. Parse BPMN2 XML
const parser = new BPMN2Parser();
const parseResult = await parser.parseIFlowPackage(Buffer.from(iflowPackage));

// 3. Analyze adapters
const adapterAnalyzer = new AdapterAnalyzer();
const adapterAnalyses = parseResult.senderAdapters
  .concat(parseResult.receiverAdapters)
  .map(adapter => adapterAnalyzer.analyzeAdapter(adapter));

// 4. Analyze scripts
const scriptAnalyzer = new ScriptAnalyzer();
const scriptAnalyses = parseResult.groovyScripts
  .concat(parseResult.javascriptScripts)
  .map(script => scriptAnalyzer.analyzeScript(script));

// 5. Detect anti-patterns
const antiPatternDetector = new AntiPatternDetector();
const antiPatterns = antiPatternDetector.detectAll(parseResult);

// 6. Build enhanced context for AI
const enhancedContext = `
${performanceContext}

**iFlow Configuration Analysis:**

**Adapters (${adapterAnalyses.length}):**
${adapterAnalyses.map(a => `
- ${a.type} (${a.direction}): Score ${a.performanceScore}/100
  - Connection Pool: ${a.connectionPoolSize || 'Not configured'}
  - Timeout: ${a.connectionTimeout || 'Not configured'}ms
  - Issues: ${a.issues.length}
`).join('\n')}

**Scripts (${scriptAnalyses.length}):**
${scriptAnalyses.map(s => `
- ${s.type}: ${s.linesOfCode} LOC, Complexity ${s.cyclomaticComplexity}
  - Database Calls: ${s.databaseCalls}
  - HTTP Calls: ${s.httpCalls}
  - Anti-patterns: ${s.antiPatterns.length}
`).join('\n')}

**Anti-Patterns Detected (${antiPatterns.length}):**
${antiPatterns.map(ap => `
- [${ap.severity.toUpperCase()}] ${ap.type}
  Location: ${ap.location}
  Impact: ${ap.impact}
`).join('\n')}

**Mappings (${parseResult.messageMappings.length}):**
${parseResult.messageMappings.map(m => `
- ${m.type}: Complexity ${m.complexity}
`).join('\n')}
`;
```

### Phase 3: Enhanced AI Prompts

Update `PERFORMANCE_OPTIMIZER_SYSTEM_PROMPT` to include:

```typescript
When analyzing iFlow configuration:

1. **Adapter Analysis**
   - Check connection pool sizes (recommend 20-50 for high-volume)
   - Verify timeout configurations (connection: 30s, response: 60s)
   - Ensure connection pooling is enabled
   - Check for retry configurations

2. **Script Analysis**
   - Flag scripts with >100 LOC (recommend refactoring)
   - Identify synchronous calls in loops
   - Detect database/HTTP calls (recommend async)
   - Check for proper resource cleanup

3. **Mapping Analysis**
   - Evaluate complexity (simple: <10 fields, complex: >50 fields)
   - Flag database lookups in mappings
   - Recommend streaming for large payloads
   - Check for recursive transformations

4. **Anti-Pattern Detection**
   - Prioritize by severity (critical > high > medium > low)
   - Provide specific code examples for fixes
   - Estimate performance impact of each issue
   - Suggest architectural improvements

5. **Resource Configuration**
   - Verify memory allocations
   - Check thread pool sizes
   - Validate timeout settings
   - Review QoS settings
```

## Sample Output

### Enhanced Performance Analysis Report

```json
{
  "metrics": {
    "score": 62,
    "avgResponseTime": 8200,
    "p95ResponseTime": 12500,
    "throughput": 45,
    "errorRate": 2.3
  },
  "configuration": {
    "adapters": [
      {
        "id": "http-sender-1",
        "type": "HTTP",
        "direction": "sender",
        "performanceScore": 45,
        "issues": [
          {
            "severity": "high",
            "type": "small_connection_pool",
            "description": "Connection pool size is 5, recommended 20-50 for high-volume",
            "impact": "May cause connection exhaustion under load",
            "recommendation": "Increase pool size to 30"
          },
          {
            "severity": "medium",
            "type": "missing_timeout",
            "description": "No connection timeout configured",
            "impact": "Connections may hang indefinitely",
            "recommendation": "Set connection timeout to 30000ms"
          }
        ]
      }
    ],
    "scripts": [
      {
        "id": "groovy-script-1",
        "type": "groovy",
        "linesOfCode": 156,
        "cyclomaticComplexity": 12,
        "performanceScore": 55,
        "antiPatterns": [
          {
            "type": "synchronous_in_loop",
            "severity": "critical",
            "location": "Line 45-67",
            "description": "HTTP call inside for loop (23 iterations)",
            "impact": "Sequential processing causing 23x latency",
            "recommendation": "Use parallel processing or batch API calls",
            "codeExample": "// Instead of:\nfor (item in items) {\n  http.get(url + item.id)\n}\n\n// Use:\ndef futures = items.collect { item ->\n  CompletableFuture.supplyAsync { http.get(url + item.id) }\n}\nfutures*.join()"
          }
        ]
      }
    ],
    "antiPatterns": [
      {
        "id": "ap-1",
        "type": "large_payload_no_streaming",
        "severity": "high",
        "location": "Message Mapping 'OrderTransform'",
        "description": "Processing 5MB XML payload without streaming",
        "impact": "High memory consumption, potential OutOfMemoryError",
        "recommendation": "Enable streaming for payloads >1MB"
      }
    ]
  },
  "bottlenecks": [
    {
      "id": "b1",
      "title": "Synchronous HTTP Calls in Loop",
      "category": "cpu",
      "severity": "critical",
      "impact": 45,
      "currentValue": "23 sequential calls",
      "targetValue": "Parallel processing",
      "description": "Groovy script makes 23 HTTP calls sequentially, causing 8.2s average response time",
      "recommendations": [...]
    }
  ]
}
```

## Testing Requirements

### Test Data Needed
1. Sample BPMN2 XML files from real SAP CPI iFlows
2. Various adapter configurations (HTTP, SOAP, SFTP, OData, JDBC)
3. Different mapping types (graphical, XSLT, Groovy, JavaScript)
4. Scripts with known anti-patterns
5. iFlows with good and bad configurations

### Test Cases
1. Parse simple iFlow (1 sender, 1 receiver, 1 mapping)
2. Parse complex iFlow (multiple adapters, routers, scripts)
3. Detect all anti-pattern types
4. Analyze adapter configurations
5. Calculate script complexity
6. Generate accurate recommendations

## Success Criteria

1. ✅ Successfully parse 95%+ of SAP CPI iFlow packages
2. ✅ Detect all defined anti-patterns with <5% false positives
3. ✅ Provide actionable recommendations for each issue
4. ✅ Performance analysis completes in <10 seconds
5. ✅ AI generates specific, code-level recommendations
6. ✅ Configuration scores accurately reflect performance impact

## Estimated Effort

- **BPMN2 Parser**: 4-6 hours
- **Adapter Analyzer**: 2-3 hours
- **Script Analyzer**: 3-4 hours
- **Anti-Pattern Detector**: 3-4 hours
- **Integration & Testing**: 4-6 hours
- **Documentation**: 2 hours

**Total**: 18-25 hours

## Dependencies

- Access to real SAP CPI iFlow packages for testing
- BPMN2 schema documentation
- SAP CPI adapter configuration reference
- Sample anti-pattern examples

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| BPMN2 XML variations | High | Test with diverse iFlow samples |
| SAP CPI version differences | Medium | Support multiple BPMN2 schema versions |
| Large iFlow packages | Medium | Implement streaming parser, size limits |
| Complex script analysis | High | Start with basic metrics, enhance iteratively |
| False positive anti-patterns | Medium | Tune detection rules with real data |

## Future Enhancements

1. Visual iFlow diagram generation
2. Comparative analysis (before/after optimization)
3. Automated fix suggestions with code generation
4. Integration with SAP CPI deployment API
5. Historical configuration tracking
6. Benchmark against industry best practices