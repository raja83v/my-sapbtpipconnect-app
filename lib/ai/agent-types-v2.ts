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
    MessageSquare,
    type LucideIcon,
} from "lucide-react";

export type AIAgentTypeV2 =
    | "GENERAL_ASSISTANT"
    | "IFLOW_CREATOR"
    | "SMART_MONITOR"
    | "PERFORMANCE_OPTIMIZER"
    | "ERROR_DIAGNOSTICIAN"
    | "SECURITY_AUDITOR"
    | "DOCUMENTATION_GENERATOR"
    | "TEST_CASE_GENERATOR"
    | "COST_ANALYZER"
    | "PREDICTIVE_INSIGHTS";

export type AgentUIType = "chat" | "dashboard" | "wizard" | "report" | "builder";

export interface AgentConfigV2 {
    type: AIAgentTypeV2;
    name: string;
    slug: string;
    description: string;
    longDescription: string;
    icon: {
        name: string;
        component: LucideIcon;
    };
    color: string;
    uiType: AgentUIType;
    capabilities: string[];
    useCases: string[];
    requiresTenant: boolean;
    requiresIFlow: boolean;
    category: "general" | "creation" | "monitoring" | "optimization" | "analysis";
    priority: "high" | "medium" | "low";
}

export const agentConfigsV2: Record<AIAgentTypeV2, AgentConfigV2> = {
    GENERAL_ASSISTANT: {
        type: "GENERAL_ASSISTANT",
        name: "AI Assistant",
        slug: "assistant",
        description: "Ask me anything about SAP CPI, integrations, or get help with any task.",
        longDescription:
            "Your general-purpose AI assistant for SAP CPI. Ask questions, get explanations, troubleshoot issues, or receive guidance on best practices. I can help with anything related to your integrations.",
        icon: { name: "MessageSquare", component: MessageSquare },
        color: "indigo",
        uiType: "chat",
        capabilities: [
            "Answer any SAP CPI questions",
            "Explain integration concepts",
            "Provide troubleshooting guidance",
            "Recommend best practices",
            "Guide through complex tasks",
            "Natural language understanding",
        ],
        useCases: [
            "How do I configure OAuth in SAP CPI?",
            "Explain this error message",
            "What's the best way to handle large payloads?",
            "Guide me through creating an iFlow",
        ],
        requiresTenant: false,
        requiresIFlow: false,
        category: "general",
        priority: "high",
    },
    ERROR_DIAGNOSTICIAN: {
        type: "ERROR_DIAGNOSTICIAN",
        name: "Error Diagnostician",
        slug: "error-diagnostician",
        description: "Get intelligent root cause analysis and step-by-step solutions for iFlow execution errors.",
        longDescription:
            "The Error Diagnostician provides enhanced error analysis with root cause trees, ranked solutions by effort/impact, and related knowledge. Select an error to get detailed diagnosis with actionable fixes.",
        icon: { name: "AlertCircle", component: AlertCircle },
        color: "red",
        uiType: "report",
        capabilities: [
            "Root cause tree generation",
            "Error clustering and grouping",
            "Ranked solutions by effort/impact",
            "Related issues identification",
            "One-click fixes where possible",
            "Export to ticketing system",
        ],
        useCases: [
            "Diagnose connection timeout errors",
            "Understand authentication failures",
            "Resolve mapping errors",
            "Fix integration failures",
        ],
        requiresTenant: true,
        requiresIFlow: false,
        category: "analysis",
        priority: "high",
    },
    PERFORMANCE_OPTIMIZER: {
        type: "PERFORMANCE_OPTIMIZER",
        name: "Performance Optimizer",
        slug: "performance-optimizer",
        description: "Analyze iFlow performance and get AI-powered recommendations to improve speed and efficiency.",
        longDescription:
            "The Performance Optimizer analyzes your iFlow configurations and execution metrics to identify bottlenecks, inefficient mappings, and optimization opportunities. Get specific, actionable recommendations with impact analysis.",
        icon: { name: "Zap", component: Zap },
        color: "yellow",
        uiType: "report",
        capabilities: [
            "Bottleneck identification",
            "Performance score calculation",
            "Impact analysis for each issue",
            "Code examples for fixes",
            "Before/after comparison",
            "Optimization opportunity detection",
        ],
        useCases: [
            "Optimize slow-running iFlows",
            "Improve mapping performance",
            "Reduce resource consumption",
            "Increase throughput capacity",
        ],
        requiresTenant: true,
        requiresIFlow: false,
        category: "optimization",
        priority: "high",
    },
    SMART_MONITOR: {
        type: "SMART_MONITOR",
        name: "Smart Monitor",
        slug: "smart-monitor",
        description: "Detect anomalies and unusual patterns in your iFlow executions with AI-powered monitoring.",
        longDescription:
            "The Smart Monitor continuously analyzes your iFlow execution patterns to detect anomalies, performance degradation, and unusual behavior. Get real-time alerts with severity-based grouping and one-click investigation.",
        icon: { name: "Activity", component: Activity },
        color: "green",
        uiType: "dashboard",
        capabilities: [
            "Real-time anomaly detection",
            "Severity-based grouping",
            "Pattern visualization",
            "Alert configuration",
            "Historical comparison",
            "Trend analysis",
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
        priority: "high",
    },
    IFLOW_CREATOR: {
        type: "IFLOW_CREATOR",
        name: "iFlow Creator",
        slug: "iflow-creator",
        description: "Generate SAP CPI iFlow designs from natural language descriptions and deploy them to your tenants.",
        longDescription:
            "The iFlow Creator uses advanced AI to understand your integration requirements and automatically generates complete SAP CPI iFlow configurations. Use the wizard to define, configure, map, and deploy your integration.",
        icon: { name: "Sparkles", component: Sparkles },
        color: "indigo",
        uiType: "wizard",
        capabilities: [
            "Natural language to iFlow conversion",
            "Multi-step wizard interface",
            "AI-powered suggestions",
            "Visual flow builder",
            "Template library",
            "One-click deployment",
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
        priority: "medium",
    },
    SECURITY_AUDITOR: {
        type: "SECURITY_AUDITOR",
        name: "Security Auditor",
        slug: "security-auditor",
        description: "Scan your integration landscape for security vulnerabilities, credential issues, and compliance gaps.",
        longDescription:
            "The Security Auditor performs comprehensive security analysis of your SAP CPI environment. Get security scores, severity-based issue grouping, compliance status tracking, and automated remediation suggestions.",
        icon: { name: "Shield", component: Shield },
        color: "purple",
        uiType: "dashboard",
        capabilities: [
            "Security score calculation",
            "Vulnerability scanning",
            "Compliance status tracking",
            "Automated remediation suggestions",
            "Scheduled scanning",
            "Audit trail",
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
        priority: "medium",
    },
    DOCUMENTATION_GENERATOR: {
        type: "DOCUMENTATION_GENERATOR",
        name: "Documentation Generator",
        slug: "documentation-generator",
        description: "Automatically generate comprehensive integration documentation from your iFlow configurations.",
        longDescription:
            "The Documentation Generator analyzes your iFlow designs and creates professional documentation with architecture diagrams, data flow descriptions, and operational guides. Choose from multiple documentation types and export formats.",
        icon: { name: "FileText", component: FileText },
        color: "blue",
        uiType: "builder",
        capabilities: [
            "Multiple documentation types",
            "Customizable sections",
            "Live preview",
            "Multiple export formats",
            "Template library",
            "Auto-generated diagrams",
        ],
        useCases: [
            "Document existing integrations",
            "Create onboarding guides",
            "Generate compliance documentation",
            "Build integration catalogs",
        ],
        requiresTenant: true,
        requiresIFlow: false,
        category: "analysis",
        priority: "medium",
    },
    TEST_CASE_GENERATOR: {
        type: "TEST_CASE_GENERATOR",
        name: "Test Case Generator",
        slug: "test-case-generator",
        description: "Generate comprehensive test cases, payloads, and assertions for your iFlow integrations.",
        longDescription:
            "The Test Case Generator creates complete test suites for your integrations with auto-generated test cases, test payload builder, coverage visualization, and one-click test execution.",
        icon: { name: "TestTube", component: TestTube },
        color: "cyan",
        uiType: "builder",
        capabilities: [
            "Auto-generated test cases",
            "Test payload builder",
            "Coverage visualization",
            "One-click test execution",
            "Test suite export",
            "Scheduled regression testing",
        ],
        useCases: [
            "Create integration test suites",
            "Generate realistic test data",
            "Build error scenario tests",
            "Automate regression testing",
        ],
        requiresTenant: true,
        requiresIFlow: false,
        category: "creation",
        priority: "low",
    },
    COST_ANALYZER: {
        type: "COST_ANALYZER",
        name: "Cost Analyzer",
        slug: "cost-analyzer",
        description: "Analyze runtime costs and get recommendations to optimize your SAP CPI resource consumption.",
        longDescription:
            "The Cost Analyzer examines your integration runtime patterns and provides cost breakdowns, optimization recommendations, savings calculator, and cost forecasting to help reduce your SAP CPI spend.",
        icon: { name: "DollarSign", component: DollarSign },
        color: "emerald",
        uiType: "dashboard",
        capabilities: [
            "Cost breakdown by iFlow",
            "Optimization recommendations",
            "Savings calculator",
            "Cost forecasting",
            "Budget alerts",
            "Historical trends",
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
        priority: "medium",
    },
    PREDICTIVE_INSIGHTS: {
        type: "PREDICTIVE_INSIGHTS",
        name: "Predictive Insights",
        slug: "predictive-insights",
        description: "Forecast integration failures, capacity needs, and performance trends using AI-powered predictions.",
        longDescription:
            "The Predictive Insights agent uses machine learning to analyze historical patterns and predict future integration behavior. Get failure probability predictions, capacity forecasting, and proactive alerts.",
        icon: { name: "TrendingUp", component: TrendingUp },
        color: "orange",
        uiType: "dashboard",
        capabilities: [
            "Failure probability prediction",
            "Capacity forecasting",
            "Trend analysis",
            "Proactive alerts",
            "Confidence scores",
            "Historical pattern matching",
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
        priority: "low",
    },
};

export const agentCategoriesV2 = {
    general: {
        name: "General Assistant",
        description: "Get help with any question or task",
    },
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

export function getAgentBySlugV2(slug: string): AgentConfigV2 | undefined {
    return Object.values(agentConfigsV2).find((agent) => agent.slug === slug);
}

export function getAgentsByCategoryV2(category: AgentConfigV2["category"]): AgentConfigV2[] {
    return Object.values(agentConfigsV2).filter((agent) => agent.category === category);
}

export function getAgentsByPriority(priority: AgentConfigV2["priority"]): AgentConfigV2[] {
    return Object.values(agentConfigsV2).filter((agent) => agent.priority === priority);
}

export function getHighPriorityAgents(): AgentConfigV2[] {
    return getAgentsByPriority("high");
}