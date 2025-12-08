// ============================================================================
// Cost Analyzer Types
// ============================================================================

/**
 * Pricing configuration for cost estimation
 * SAP CPI doesn't expose billing APIs, so we estimate based on execution metrics
 */
export interface CostPricingConfig {
    /** Cost per message execution ($ per execution) */
    costPerExecution: number;
    /** Cost per MB of data transferred ($ per MB) */
    costPerMBTransferred: number;
    /** Cost per minute of runtime ($ per minute) */
    costPerMinuteRuntime: number;
    /** Currency code */
    currency: string;
    /** Monthly base cost (license/subscription) */
    monthlyBaseCost: number;
}

/**
 * Default pricing configuration based on typical SAP CPI pricing tiers
 * Users can override based on their specific contract
 */
export const DEFAULT_PRICING_CONFIG: CostPricingConfig = {
    costPerExecution: 0.001,        // $0.001 per execution
    costPerMBTransferred: 0.05,     // $0.05 per MB
    costPerMinuteRuntime: 0.02,     // $0.02 per minute of processing
    currency: "USD",
    monthlyBaseCost: 0,             // Not included by default
};

/**
 * iFlow item for selection
 */
export interface IFlowForCostAnalyzer {
    id: string;
    name: string;
    status: string;
    version: string;
}

/**
 * Cost breakdown for a single iFlow
 */
export interface IFlowCostBreakdown {
    /** iFlow ID */
    iflowId: string;
    /** iFlow name */
    iflowName: string;
    /** Total execution count in period */
    executionCount: number;
    /** Successful execution count */
    successCount: number;
    /** Failed execution count */
    failedCount: number;
    /** Average duration in milliseconds */
    avgDuration: number;
    /** Total runtime in milliseconds */
    totalRuntime: number;
    /** Estimated data volume in MB */
    estimatedDataVolume: number;
    /** Breakdown of costs */
    costBreakdown: {
        executionCost: number;
        runtimeCost: number;
        dataTransferCost: number;
    };
    /** Total estimated cost */
    estimatedCost: number;
    /** Percentage of total tenant cost */
    percentOfTotal: number;
    /** Trend compared to previous period */
    trend: "up" | "down" | "stable";
    /** Trend percentage change */
    trendPercent: number;
    /** Error rate percentage */
    errorRate: number;
}

/**
 * Cost driver - identifies what contributes most to costs
 */
export interface CostDriver {
    /** Driver type */
    type: "high-volume" | "long-running" | "high-error-rate" | "frequent-retries" | "large-payloads" | "inefficient-scheduling";
    /** Driver name/title */
    name: string;
    /** Description of the cost driver */
    description: string;
    /** Affected iFlows */
    affectedIFlows: string[];
    /** Estimated monthly cost impact */
    costImpact: number;
    /** Severity level */
    severity: "low" | "medium" | "high" | "critical";
    /** Potential savings if addressed */
    potentialSavings: number;
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimization {
    /** Unique ID */
    id: string;
    /** Optimization title */
    title: string;
    /** Detailed description */
    description: string;
    /** Category of optimization */
    category: "scheduling" | "batching" | "caching" | "error-handling" | "resource-sizing" | "design" | "monitoring";
    /** Affected iFlows */
    affectedIFlows: string[];
    /** Estimated monthly savings */
    estimatedSavings: number;
    /** Implementation effort */
    effort: "low" | "medium" | "high";
    /** Priority (1 = highest) */
    priority: number;
    /** Implementation steps */
    implementationSteps: string[];
    /** Risk level */
    risk: "low" | "medium" | "high";
    /** ROI score (savings / effort) */
    roiScore: number;
}

/**
 * Cost forecast for future periods
 */
export interface CostForecast {
    /** Forecast period in days */
    periodDays: number;
    /** Current monthly run rate */
    currentMonthlyRate: number;
    /** Projected cost for next period */
    projectedCost: number;
    /** Confidence level (0-1) */
    confidence: number;
    /** Growth trend */
    growthTrend: "increasing" | "stable" | "decreasing";
    /** Growth rate percentage */
    growthRate: number;
    /** Monthly projections */
    monthlyProjections: Array<{
        month: string;
        projectedCost: number;
        lowerBound: number;
        upperBound: number;
    }>;
    /** Budget warning threshold reached */
    budgetWarning?: {
        threshold: number;
        projectedExceedDate?: string;
        message: string;
    };
}

/**
 * Summary statistics for the analysis period
 */
export interface CostSummaryStats {
    /** Total estimated cost for the period */
    totalCost: number;
    /** Number of iFlows analyzed */
    iflowCount: number;
    /** Total execution count */
    totalExecutions: number;
    /** Total runtime in hours */
    totalRuntimeHours: number;
    /** Average cost per execution */
    avgCostPerExecution: number;
    /** Average cost per iFlow */
    avgCostPerIFlow: number;
    /** Period start date */
    periodStart: string;
    /** Period end date */
    periodEnd: string;
    /** Cost trend compared to previous period */
    periodTrend: "up" | "down" | "stable";
    /** Trend percentage */
    periodTrendPercent: number;
}

/**
 * Complete cost analysis result
 */
export interface CostAnalysisResult {
    /** Summary statistics */
    summary: CostSummaryStats;
    /** Cost breakdown by iFlow */
    iflowBreakdown: IFlowCostBreakdown[];
    /** Identified cost drivers */
    costDrivers: CostDriver[];
    /** Optimization recommendations */
    optimizations: CostOptimization[];
    /** Cost forecast */
    forecast: CostForecast;
    /** Pricing configuration used */
    pricingConfig: CostPricingConfig;
    /** Analysis generated timestamp */
    generatedAt: string;
    /** Period analyzed in days */
    periodDays: number;
    /** Tenant ID */
    tenantId: string;
}

/**
 * AI-generated cost insights
 */
export interface CostInsights {
    /** Executive summary */
    executiveSummary: string;
    /** Key findings */
    keyFindings: string[];
    /** Top recommendations */
    topRecommendations: string[];
    /** Risk assessment */
    riskAssessment: string;
    /** Action items */
    actionItems: Array<{
        action: string;
        priority: "high" | "medium" | "low";
        estimatedSavings: number;
    }>;
    /** Generated timestamp */
    generatedAt: string;
    /** Tokens used */
    tokensUsed: number;
}

/**
 * Cost analysis request parameters
 */
export interface CostAnalysisParams {
    tenantId: string;
    daysBack?: number;
    pricingConfig?: Partial<CostPricingConfig>;
    includeForecasting?: boolean;
    budgetThreshold?: number;
}

/**
 * Historical cost data point for trend analysis
 */
export interface HistoricalCostPoint {
    date: string;
    totalCost: number;
    executionCount: number;
    avgCostPerExecution: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
    /** Monthly budget limit */
    monthlyBudget: number;
    /** Warning threshold percentage (e.g., 0.8 = 80%) */
    warningThreshold: number;
    /** Critical threshold percentage (e.g., 0.95 = 95%) */
    criticalThreshold: number;
    /** Enable notifications */
    enableNotifications: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency value with NaN/undefined safety
 */
export function formatCurrency(value: number, currency: string = "USD"): string {
    // Handle NaN, undefined, null, or non-finite values
    const safeValue = Number.isFinite(value) ? value : 0;
    
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeValue);
}

/**
 * Format large numbers with K/M/B suffixes (NaN-safe)
 */
export function formatCompactNumber(value: number): string {
    // Handle NaN, undefined, null, or non-finite values
    const safeValue = Number.isFinite(value) ? value : 0;
    
    if (safeValue >= 1_000_000_000) {
        return `${(safeValue / 1_000_000_000).toFixed(1)}B`;
    }
    if (safeValue >= 1_000_000) {
        return `${(safeValue / 1_000_000).toFixed(1)}M`;
    }
    if (safeValue >= 1_000) {
        return `${(safeValue / 1_000).toFixed(1)}K`;
    }
    return safeValue.toFixed(0);
}

/**
 * Calculate cost from metrics
 * Includes defensive handling for undefined/NaN values
 */
export function calculateCost(
    executionCount: number,
    runtimeMinutes: number,
    dataMB: number,
    config: CostPricingConfig
): { executionCost: number; runtimeCost: number; dataTransferCost: number; total: number } {
    // Ensure all values are valid numbers with fallback to defaults
    const safeExecCount = Number.isFinite(executionCount) ? executionCount : 0;
    const safeRuntime = Number.isFinite(runtimeMinutes) ? runtimeMinutes : 0;
    const safeDataMB = Number.isFinite(dataMB) ? dataMB : 0;
    
    // Ensure config values have defaults
    const costPerExec = Number.isFinite(config?.costPerExecution) ? config.costPerExecution : DEFAULT_PRICING_CONFIG.costPerExecution;
    const costPerMinute = Number.isFinite(config?.costPerMinuteRuntime) ? config.costPerMinuteRuntime : DEFAULT_PRICING_CONFIG.costPerMinuteRuntime;
    const costPerMB = Number.isFinite(config?.costPerMBTransferred) ? config.costPerMBTransferred : DEFAULT_PRICING_CONFIG.costPerMBTransferred;
    
    const executionCost = safeExecCount * costPerExec;
    const runtimeCost = safeRuntime * costPerMinute;
    const dataTransferCost = safeDataMB * costPerMB;
    const total = executionCost + runtimeCost + dataTransferCost;
    
    return { executionCost, runtimeCost, dataTransferCost, total };
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: "low" | "medium" | "high" | "critical"): string {
    const colors = {
        low: "text-green-500",
        medium: "text-yellow-500",
        high: "text-orange-500",
        critical: "text-red-500",
    };
    return colors[severity];
}

/**
 * Get trend icon name
 */
export function getTrendIcon(trend: "up" | "down" | "stable"): string {
    const icons = {
        up: "TrendingUp",
        down: "TrendingDown",
        stable: "Minus",
    };
    return icons[trend];
}

/**
 * Calculate ROI score for an optimization
 */
export function calculateROIScore(estimatedSavings: number, effort: "low" | "medium" | "high"): number {
    const effortMultiplier = {
        low: 1,
        medium: 0.5,
        high: 0.25,
    };
    return estimatedSavings * effortMultiplier[effort];
}
