import {
  Sparkles,
  Activity,
  Zap,
  AlertCircle,
  Shield,
  FileText,
  TestTube,
  DollarSign,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type AIAgentType =
  | "IFLOW_CREATOR"
  | "SMART_MONITOR"
  | "PERFORMANCE_OPTIMIZER"
  | "ERROR_DIAGNOSTICIAN"
  | "SECURITY_AUDITOR"
  | "DOCUMENTATION_GENERATOR"
  | "TEST_CASE_GENERATOR"
  | "COST_ANALYZER"
  | "PREDICTIVE_INSIGHTS";

export interface AgentConfig {
  type: AIAgentType;
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  icon: LucideIcon;
  color: string;
  capabilities: string[];
  useCases: string[];
  requiresTenant: boolean;
  requiresIFlow: boolean;
  category: "creation" | "monitoring" | "optimization" | "analysis";
}

export const agentConfigs: Record<AIAgentType, AgentConfig> = {
  IFLOW_CREATOR: {
    type: "IFLOW_CREATOR",
    name: "iFlow Creator",
    slug: "iflow-creator",
    description: "Generate SAP CPI iFlow designs from natural language descriptions and deploy them to your tenants.",
    longDescription:
      "The iFlow Creator agent uses advanced AI to understand your integration requirements and automatically generates complete SAP CPI iFlow configurations. Simply describe your integration scenario in plain English, and the agent will create production-ready iFlow designs with adapters, mappings, and error handling.",
    icon: Sparkles,
    color: "indigo",
    capabilities: [
      "Natural language to iFlow conversion",
      "Multiple adapter support (REST, SOAP, SFTP, OData)",
      "Automatic mapping generation",
      "Error handling configuration",
      "Best practices implementation",
      "One-click deployment to tenants",
    ],
    useCases: [
      "Create REST to SFTP integrations",
      "Generate SOAP to OData bridges",
      "Build file-to-database flows",
      "Design API orchestration patterns",
    ],
    requiresTenant: true,
    requiresIFlow: false,
    category: "creation",
  },
  SMART_MONITOR: {
    type: "SMART_MONITOR",
    name: "Smart Monitor",
    slug: "smart-monitor",
    description: "Detect anomalies and unusual patterns in your iFlow executions with AI-powered monitoring.",
    longDescription:
      "The Smart Monitor agent continuously analyzes your iFlow execution patterns to detect anomalies, performance degradation, and unusual behavior. It learns normal operating patterns and alerts you when something deviates from expected behavior, helping you catch issues before they become critical.",
    icon: Activity,
    color: "green",
    capabilities: [
      "Anomaly detection in execution patterns",
      "Performance baseline learning",
      "Unusual error pattern identification",
      "Execution volume spike detection",
      "Response time trend analysis",
      "Proactive alerting",
    ],
    useCases: [
      "Detect sudden increase in failures",
      "Identify performance degradation",
      "Catch unusual execution patterns",
      "Monitor integration health trends",
    ],
    requiresTenant: true,
    requiresIFlow: false,
    category: "monitoring",
  },
  PERFORMANCE_OPTIMIZER: {
    type: "PERFORMANCE_OPTIMIZER",
    name: "Performance Optimizer",
    slug: "performance-optimizer",
    description: "Analyze iFlow performance and get AI-powered recommendations to improve speed and efficiency.",
    longDescription:
      "The Performance Optimizer agent analyzes your iFlow configurations and execution metrics to identify bottlenecks, inefficient mappings, and optimization opportunities. It provides specific, actionable recommendations to improve throughput, reduce latency, and optimize resource usage.",
    icon: Zap,
    color: "yellow",
    capabilities: [
      "Bottleneck identification",
      "Mapping efficiency analysis",
      "Resource utilization optimization",
      "Throughput improvement suggestions",
      "Latency reduction recommendations",
      "Best practice compliance checking",
    ],
    useCases: [
      "Optimize slow-running iFlows",
      "Improve mapping performance",
      "Reduce resource consumption",
      "Increase throughput capacity",
    ],
    requiresTenant: true,
    requiresIFlow: true,
    category: "optimization",
  },
  ERROR_DIAGNOSTICIAN: {
    type: "ERROR_DIAGNOSTICIAN",
    name: "Error Diagnostician",
    slug: "error-diagnostician",
    description: "Get intelligent root cause analysis and step-by-step solutions for iFlow execution errors.",
    longDescription:
      "The Error Diagnostician agent provides enhanced error analysis beyond basic diagnostics. It examines error messages, payloads, logs, and execution context to build a complete root cause tree, identify cascading failures, and provide detailed remediation steps with code examples and configuration fixes.",
    icon: AlertCircle,
    color: "red",
    capabilities: [
      "Root cause tree generation",
      "Cascading failure analysis",
      "Payload-aware diagnostics",
      "Step-by-step remediation guides",
      "Code fix examples",
      "Prevention strategies",
    ],
    useCases: [
      "Diagnose complex integration failures",
      "Understand mapping errors",
      "Resolve connectivity issues",
      "Fix authentication problems",
    ],
    requiresTenant: true,
    requiresIFlow: true,
    category: "analysis",
  },
  SECURITY_AUDITOR: {
    type: "SECURITY_AUDITOR",
    name: "Security Auditor",
    slug: "security-auditor",
    description: "Scan your integration landscape for security vulnerabilities, credential issues, and compliance gaps.",
    longDescription:
      "The Security Auditor agent performs comprehensive security analysis of your SAP CPI environment. It scans for exposed credentials, weak authentication, insecure connections, permission issues, and compliance violations. Get detailed security reports with prioritized remediation steps.",
    icon: Shield,
    color: "purple",
    capabilities: [
      "Credential exposure scanning",
      "Authentication strength analysis",
      "Connection security validation",
      "Permission audit",
      "Compliance gap identification",
      "Security best practices checking",
    ],
    useCases: [
      "Audit integration security posture",
      "Find exposed credentials",
      "Validate encryption usage",
      "Check compliance requirements",
    ],
    requiresTenant: true,
    requiresIFlow: false,
    category: "analysis",
  },
  DOCUMENTATION_GENERATOR: {
    type: "DOCUMENTATION_GENERATOR",
    name: "Documentation Generator",
    slug: "documentation-generator",
    description: "Automatically generate comprehensive integration documentation from your iFlow configurations.",
    longDescription:
      "The Documentation Generator agent analyzes your iFlow designs and creates professional, comprehensive documentation including architecture diagrams, data flow descriptions, configuration details, and operational guides. Perfect for compliance, knowledge transfer, and onboarding.",
    icon: FileText,
    color: "blue",
    capabilities: [
      "Architecture diagram generation",
      "Data flow documentation",
      "Configuration specification",
      "API endpoint documentation",
      "Error handling guide creation",
      "Operational runbook generation",
    ],
    useCases: [
      "Document existing integrations",
      "Create onboarding guides",
      "Generate compliance documentation",
      "Build integration catalogs",
    ],
    requiresTenant: true,
    requiresIFlow: true,
    category: "analysis",
  },
  TEST_CASE_GENERATOR: {
    type: "TEST_CASE_GENERATOR",
    name: "Test Case Generator",
    slug: "test-case-generator",
    description: "Generate comprehensive test cases, payloads, and assertions for your iFlow integrations.",
    longDescription:
      "The Test Case Generator agent creates complete test suites for your integrations. It generates realistic test payloads, edge cases, error scenarios, and automated assertions based on your iFlow configuration and expected behavior. Improve quality and reduce manual testing effort.",
    icon: TestTube,
    color: "cyan",
    capabilities: [
      "Test payload generation",
      "Edge case identification",
      "Error scenario creation",
      "Assertion definition",
      "Test data variation",
      "Regression test suite building",
    ],
    useCases: [
      "Create integration test suites",
      "Generate realistic test data",
      "Build error scenario tests",
      "Automate regression testing",
    ],
    requiresTenant: true,
    requiresIFlow: true,
    category: "creation",
  },
  COST_ANALYZER: {
    type: "COST_ANALYZER",
    name: "Cost Analyzer",
    slug: "cost-analyzer",
    description: "Analyze runtime costs and get recommendations to optimize your SAP CPI resource consumption.",
    longDescription:
      "The Cost Analyzer agent examines your integration runtime patterns, resource usage, and execution volumes to estimate costs and identify optimization opportunities. Get detailed breakdowns of cost drivers and actionable recommendations to reduce your SAP CPI spend.",
    icon: DollarSign,
    color: "emerald",
    capabilities: [
      "Runtime cost estimation",
      "Resource usage analysis",
      "Cost driver identification",
      "Optimization opportunity detection",
      "Capacity planning",
      "Budget forecasting",
    ],
    useCases: [
      "Estimate integration costs",
      "Identify cost optimization opportunities",
      "Plan capacity and budget",
      "Optimize resource allocation",
    ],
    requiresTenant: true,
    requiresIFlow: false,
    category: "analysis",
  },
  PREDICTIVE_INSIGHTS: {
    type: "PREDICTIVE_INSIGHTS",
    name: "Predictive Insights",
    slug: "predictive-insights",
    description: "Forecast integration failures, capacity needs, and performance trends using AI-powered predictions.",
    longDescription:
      "The Predictive Insights agent uses machine learning to analyze historical patterns and predict future integration behavior. Get early warnings about potential failures, capacity constraints, and performance issues before they impact your business operations.",
    icon: TrendingUp,
    color: "orange",
    capabilities: [
      "Failure probability prediction",
      "Capacity forecasting",
      "Performance trend analysis",
      "Seasonal pattern recognition",
      "Resource demand prediction",
      "Proactive issue alerting",
    ],
    useCases: [
      "Predict integration failures",
      "Forecast capacity requirements",
      "Plan infrastructure scaling",
      "Anticipate performance issues",
    ],
    requiresTenant: true,
    requiresIFlow: false,
    category: "analysis",
  },
};

export const agentCategories = {
  creation: {
    name: "Creation & Design",
    description: "Build and generate new integration components",
  },
  monitoring: {
    name: "Monitoring & Detection",
    description: "Track and detect issues in real-time",
  },
  optimization: {
    name: "Optimization & Tuning",
    description: "Improve performance and efficiency",
  },
  analysis: {
    name: "Analysis & Insights",
    description: "Understand and predict integration behavior",
  },
};

export function getAgentBySlug(slug: string): AgentConfig | undefined {
  return Object.values(agentConfigs).find((agent) => agent.slug === slug);
}

export function getAgentsByCategory(category: AgentConfig["category"]): AgentConfig[] {
  return Object.values(agentConfigs).filter((agent) => agent.category === category);
}
