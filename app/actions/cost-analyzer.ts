"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { ActionResult } from "@/types/actions";
import { streamText } from "ai";
import { aiModel } from "@/lib/ai/client";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";
import * as prompts from "@/lib/ai/prompts";
import {
    DEFAULT_PRICING_CONFIG,
    calculateCost,
    calculateROIScore,
    type IFlowForCostAnalyzer,
    type IFlowCostBreakdown,
    type CostDriver,
    type CostOptimization,
    type CostForecast,
    type CostSummaryStats,
    type CostAnalysisResult,
    type CostPricingConfig,
    type CostInsights,
    type CostAnalysisParams,
} from "@/types/cost-analyzer";

// Re-export types for consumers
export type {
    IFlowForCostAnalyzer,
    IFlowCostBreakdown,
    CostDriver,
    CostOptimization,
    CostForecast,
    CostSummaryStats,
    CostAnalysisResult,
    CostPricingConfig,
    CostInsights,
    CostAnalysisParams,
};

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get iFlows for Cost Analyzer - fetches directly from SAP CPI API
 */
export async function getIFlowsForCostAnalyzer(params: {
    tenantId: string;
}): Promise<ActionResult<IFlowForCostAnalyzer[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId } = params;

        // Validate tenant access
        const membership = await convex.query(api.tenants.getMembership, {
            tenantId: tenantId as any,
            userId: currentUser.id as any,
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await convex.query(api.tenants.getById, {
            id: tenantId as any,
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Build OAuth token URL
        let effectiveTokenUrl = tenant.tokenUrl;
        if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
            if (tenant.authenticationUrl) {
                effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
            } else if (tenant.tenantUrl) {
                const url = new URL(tenant.tenantUrl);
                effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
            }
        }

        // Check credentials
        const hasOAuthCredentials = tenant.authType === "OAUTH" &&
            tenant.clientId &&
            tenant.clientSecret &&
            effectiveTokenUrl;

        const hasBasicAuthCredentials = tenant.authType === "BASIC_AUTH" &&
            tenant.username &&
            tenant.password;

        if (!hasOAuthCredentials && !hasBasicAuthCredentials) {
            return { success: false, error: "SAP CPI credentials not configured for this tenant" };
        }

        // Create SAP CPI client
        const cpiCredentials: SAPCPICredentials = {
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as any,
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            username: tenant.username,
            password: tenant.password,
            tokenUrl: effectiveTokenUrl,
        };

        const cpiClient = createSAPCPIClient(cpiCredentials);

        // Fetch deployed iFlows from SAP CPI API (already sorted by name ascending)
        const deployedIFlows = await cpiClient.listDeployedIFlows();

        // Transform to the format needed
        const simplifiedIFlows: IFlowForCostAnalyzer[] = deployedIFlows.map((iflow) => ({
            id: iflow.Id,
            name: iflow.Name,
            status: iflow.Status,
            version: iflow.Version,
        }));

        return { success: true, data: simplifiedIFlows };
    } catch (error) {
        console.error("Error fetching iFlows for cost analyzer:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch iFlows",
        };
    }
}

/**
 * Get cost metrics for all iFlows in a tenant
 */
export async function getCostMetrics(params: {
    tenantId: string;
    daysBack?: number;
    pricingConfig?: Partial<CostPricingConfig>;
}): Promise<ActionResult<CostAnalysisResult>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, daysBack = 30, pricingConfig: customPricing } = params;

        // Merge custom pricing with defaults, ensuring all values are valid numbers
        const pricingConfig: CostPricingConfig = {
            costPerExecution: Number.isFinite(customPricing?.costPerExecution) 
                ? customPricing.costPerExecution 
                : DEFAULT_PRICING_CONFIG.costPerExecution,
            costPerMBTransferred: Number.isFinite(customPricing?.costPerMBTransferred) 
                ? customPricing.costPerMBTransferred 
                : DEFAULT_PRICING_CONFIG.costPerMBTransferred,
            costPerMinuteRuntime: Number.isFinite(customPricing?.costPerMinuteRuntime) 
                ? customPricing.costPerMinuteRuntime 
                : DEFAULT_PRICING_CONFIG.costPerMinuteRuntime,
            currency: customPricing?.currency || DEFAULT_PRICING_CONFIG.currency,
            monthlyBaseCost: Number.isFinite(customPricing?.monthlyBaseCost) 
                ? customPricing.monthlyBaseCost 
                : DEFAULT_PRICING_CONFIG.monthlyBaseCost,
        };

        // Validate tenant access
        const membership = await convex.query(api.tenants.getMembership, {
            tenantId: tenantId as any,
            userId: currentUser.id as any,
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details
        const tenant = await convex.query(api.tenants.getById, {
            id: tenantId as any,
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Build OAuth token URL
        let effectiveTokenUrl = tenant.tokenUrl;
        if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
            if (tenant.authenticationUrl) {
                effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
            } else if (tenant.tenantUrl) {
                const url = new URL(tenant.tenantUrl);
                effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
            }
        }

        // Check credentials
        const hasOAuthCredentials = tenant.authType === "OAUTH" &&
            tenant.clientId &&
            tenant.clientSecret &&
            effectiveTokenUrl;

        const hasBasicAuthCredentials = tenant.authType === "BASIC_AUTH" &&
            tenant.username &&
            tenant.password;

        if (!hasOAuthCredentials && !hasBasicAuthCredentials) {
            return { success: false, error: "SAP CPI credentials not configured for this tenant" };
        }

        // Create SAP CPI client
        const cpiCredentials: SAPCPICredentials = {
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as any,
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            username: tenant.username,
            password: tenant.password,
            tokenUrl: effectiveTokenUrl,
        };

        const cpiClient = createSAPCPIClient(cpiCredentials);

        // Fetch deployed iFlows
        const deployedIFlows = await cpiClient.listDeployedIFlows();

        // Calculate date range
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

        // Gather metrics for each iFlow
        const iflowBreakdowns: IFlowCostBreakdown[] = [];
        let totalCost = 0;
        let totalExecutions = 0;
        let totalRuntimeMs = 0;

        for (const iflow of deployedIFlows) {
            try {
                // Get message processing logs for this iFlow
                const logs = await cpiClient.getMessageProcessingLogs({
                    iFlowId: iflow.Id,
                    fromDate,
                    toDate,
                    top: 1000,
                });

                const executionCount = logs.length;
                const successCount = logs.filter(l => l.Status === "COMPLETED").length;
                const failedCount = logs.filter(l => l.Status === "FAILED").length;

                // Calculate durations
                const durations = logs
                    .filter(l => l.LogStart && l.LogEnd)
                    .map(l => new Date(l.LogEnd!).getTime() - new Date(l.LogStart).getTime());

                const totalRuntime = durations.reduce((sum, d) => sum + d, 0);
                const avgDuration = durations.length > 0 ? totalRuntime / durations.length : 0;

                // Estimate data volume (rough estimate based on execution count and avg duration)
                // In reality, this would come from actual payload sizes
                const estimatedDataVolume = (executionCount * 0.1); // Assume 0.1 MB per execution

                // Calculate costs
                const runtimeMinutes = totalRuntime / (1000 * 60);
                const costs = calculateCost(executionCount, runtimeMinutes, estimatedDataVolume, pricingConfig);

                const breakdown: IFlowCostBreakdown = {
                    iflowId: iflow.Id,
                    iflowName: iflow.Name,
                    executionCount,
                    successCount,
                    failedCount,
                    avgDuration: Math.round(avgDuration),
                    totalRuntime,
                    estimatedDataVolume,
                    costBreakdown: {
                        executionCost: costs.executionCost,
                        runtimeCost: costs.runtimeCost,
                        dataTransferCost: costs.dataTransferCost,
                    },
                    estimatedCost: costs.total,
                    percentOfTotal: 0, // Will calculate after totals
                    trend: "stable",
                    trendPercent: 0,
                    errorRate: executionCount > 0 ? (failedCount / executionCount) * 100 : 0,
                };

                iflowBreakdowns.push(breakdown);
                totalCost += costs.total;
                totalExecutions += executionCount;
                totalRuntimeMs += totalRuntime;
            } catch (error) {
                console.warn(`Failed to get metrics for iFlow ${iflow.Name}:`, error);
                // Continue with other iFlows
            }
        }

        // Calculate percentages
        iflowBreakdowns.forEach(breakdown => {
            breakdown.percentOfTotal = totalCost > 0 ? (breakdown.estimatedCost / totalCost) * 100 : 0;
        });

        // Sort by cost descending
        iflowBreakdowns.sort((a, b) => b.estimatedCost - a.estimatedCost);

        // Identify cost drivers
        const costDrivers = identifyCostDrivers(iflowBreakdowns, pricingConfig);

        // Generate optimization recommendations
        const optimizations = generateOptimizations(iflowBreakdowns, costDrivers);

        // Calculate forecast
        const forecast = calculateForecast(iflowBreakdowns, totalCost, daysBack);

        // Build summary
        const totalRuntimeHours = totalRuntimeMs / (1000 * 60 * 60);
        const summary: CostSummaryStats = {
            totalCost,
            iflowCount: deployedIFlows.length,
            totalExecutions,
            totalRuntimeHours,
            avgCostPerExecution: totalExecutions > 0 ? totalCost / totalExecutions : 0,
            avgCostPerIFlow: deployedIFlows.length > 0 ? totalCost / deployedIFlows.length : 0,
            periodStart: fromDate.toISOString(),
            periodEnd: toDate.toISOString(),
            periodTrend: "stable",
            periodTrendPercent: 0,
        };

        const result: CostAnalysisResult = {
            summary,
            iflowBreakdown: iflowBreakdowns,
            costDrivers,
            optimizations,
            forecast,
            pricingConfig,
            generatedAt: new Date().toISOString(),
            periodDays: daysBack,
            tenantId,
        };

        return { success: true, data: result };
    } catch (error) {
        console.error("Error getting cost metrics:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get cost metrics",
        };
    }
}

/**
 * Analyze costs with AI-powered insights
 */
export async function analyzeCostsWithAI(params: {
    tenantId: string;
    costAnalysis: CostAnalysisResult;
    budgetThreshold?: number;
}): Promise<ActionResult<CostInsights>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, costAnalysis, budgetThreshold } = params;

        // Validate tenant access
        const membership = await convex.query(api.tenants.getMembership, {
            tenantId: tenantId as any,
            userId: currentUser.id as any,
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Build the analysis context for AI
        const contextPrompt = buildCostAnalysisPrompt(costAnalysis, budgetThreshold);

        // Generate AI insights
        const result = await streamText({
            model: aiModel,
            system: prompts.COST_ANALYZER_PROMPT,
            prompt: contextPrompt,
            temperature: 0.4,
        });

        // Collect the response
        let fullText = "";
        for await (const chunk of result.textStream) {
            fullText += chunk;
        }

        // Get token usage
        const usage = await result.usage;
        const totalTokens = usage?.totalTokens || 0;

        // Track execution in database
        const durationMs = Date.now() - startTime;
        await convex.mutation(api.aiAgentMutations.trackExecution, {
            agentType: "COST_ANALYZER",
            tenantId: tenantId,
            userId: currentUser.id as any,
            tokensUsed: totalTokens,
            duration: durationMs,
            success: true,
            input: JSON.stringify({
                periodDays: costAnalysis.periodDays,
                iflowCount: costAnalysis.summary.iflowCount,
                totalCost: costAnalysis.summary.totalCost,
                budgetThreshold,
            }),
            output: fullText.substring(0, 500), // Store summary
        });

        // Parse AI response into structured insights
        const insights: CostInsights = {
            executiveSummary: fullText,
            keyFindings: [],
            topRecommendations: [],
            riskAssessment: "",
            actionItems: [],
            generatedAt: new Date().toISOString(),
            tokensUsed: totalTokens,
        };

        return { success: true, data: insights };
    } catch (error) {
        console.error("Error analyzing costs with AI:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to analyze costs",
        };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Identify cost drivers from iFlow breakdowns
 */
function identifyCostDrivers(
    breakdowns: IFlowCostBreakdown[],
    _pricingConfig: CostPricingConfig
): CostDriver[] {
    const drivers: CostDriver[] = [];

    // High volume iFlows (top 20% by execution count contribute to 80% of executions)
    const sortedByVolume = [...breakdowns].sort((a, b) => b.executionCount - a.executionCount);
    const totalExecutions = breakdowns.reduce((sum, b) => sum + b.executionCount, 0);
    let cumulativeExecutions = 0;
    const highVolumeIFlows: string[] = [];

    for (const breakdown of sortedByVolume) {
        cumulativeExecutions += breakdown.executionCount;
        highVolumeIFlows.push(breakdown.iflowName);
        if (cumulativeExecutions >= totalExecutions * 0.8) break;
    }

    if (highVolumeIFlows.length > 0 && highVolumeIFlows.length <= breakdowns.length * 0.3) {
        const impactedCost = sortedByVolume
            .filter(b => highVolumeIFlows.includes(b.iflowName))
            .reduce((sum, b) => sum + b.estimatedCost, 0);

        drivers.push({
            type: "high-volume",
            name: "High Volume iFlows",
            description: `${highVolumeIFlows.length} iFlow(s) account for 80% of all executions`,
            affectedIFlows: highVolumeIFlows.slice(0, 5),
            costImpact: impactedCost,
            severity: highVolumeIFlows.length <= 3 ? "high" : "medium",
            potentialSavings: impactedCost * 0.15, // 15% potential savings through optimization
        });
    }

    // Long-running iFlows (avg duration > 30 seconds)
    const longRunningIFlows = breakdowns.filter(b => b.avgDuration > 30000);
    if (longRunningIFlows.length > 0) {
        const impactedCost = longRunningIFlows.reduce((sum, b) => sum + b.costBreakdown.runtimeCost, 0);

        drivers.push({
            type: "long-running",
            name: "Long-Running Integrations",
            description: `${longRunningIFlows.length} iFlow(s) have average execution time > 30 seconds`,
            affectedIFlows: longRunningIFlows.map(b => b.iflowName).slice(0, 5),
            costImpact: impactedCost,
            severity: longRunningIFlows.length >= 3 ? "high" : "medium",
            potentialSavings: impactedCost * 0.25, // 25% potential savings
        });
    }

    // High error rate iFlows (> 10% error rate)
    const highErrorIFlows = breakdowns.filter(b => b.errorRate > 10 && b.executionCount > 10);
    if (highErrorIFlows.length > 0) {
        const wastedCost = highErrorIFlows.reduce(
            (sum, b) => sum + (b.estimatedCost * (b.errorRate / 100)),
            0
        );

        drivers.push({
            type: "high-error-rate",
            name: "High Error Rate",
            description: `${highErrorIFlows.length} iFlow(s) have error rates exceeding 10%`,
            affectedIFlows: highErrorIFlows.map(b => b.iflowName).slice(0, 5),
            costImpact: wastedCost,
            severity: highErrorIFlows.some(b => b.errorRate > 30) ? "critical" : "high",
            potentialSavings: wastedCost * 0.8, // 80% of wasted cost can be saved
        });
    }

    // Sort by cost impact
    drivers.sort((a, b) => b.costImpact - a.costImpact);

    return drivers;
}

/**
 * Generate optimization recommendations
 */
function generateOptimizations(
    breakdowns: IFlowCostBreakdown[],
    drivers: CostDriver[]
): CostOptimization[] {
    const optimizations: CostOptimization[] = [];
    let optimizationId = 1;

    // Based on high-volume driver
    const highVolumeDriver = drivers.find(d => d.type === "high-volume");
    if (highVolumeDriver) {
        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Implement Message Batching",
            description: "Batch multiple messages into single executions to reduce per-execution overhead",
            category: "batching",
            affectedIFlows: highVolumeDriver.affectedIFlows,
            estimatedSavings: highVolumeDriver.potentialSavings * 0.5,
            effort: "medium",
            priority: 1,
            implementationSteps: [
                "Analyze message patterns for batch compatibility",
                "Implement content-based aggregator pattern",
                "Configure batch size and timeout parameters",
                "Test with production-like volumes",
                "Monitor performance after deployment",
            ],
            risk: "medium",
            roiScore: 0,
        });

        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Optimize Polling Schedules",
            description: "Adjust polling intervals based on actual business requirements",
            category: "scheduling",
            affectedIFlows: highVolumeDriver.affectedIFlows,
            estimatedSavings: highVolumeDriver.potentialSavings * 0.3,
            effort: "low",
            priority: 2,
            implementationSteps: [
                "Review current polling frequencies",
                "Identify over-polled endpoints",
                "Adjust scheduler configurations",
                "Consider event-driven alternatives",
            ],
            risk: "low",
            roiScore: 0,
        });
    }

    // Based on long-running driver
    const longRunningDriver = drivers.find(d => d.type === "long-running");
    if (longRunningDriver) {
        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Optimize Script Performance",
            description: "Review and optimize Groovy scripts to reduce execution time",
            category: "design",
            affectedIFlows: longRunningDriver.affectedIFlows,
            estimatedSavings: longRunningDriver.potentialSavings * 0.4,
            effort: "high",
            priority: 3,
            implementationSteps: [
                "Profile script execution to identify bottlenecks",
                "Replace inefficient algorithms",
                "Minimize logging in production",
                "Cache frequently accessed data",
                "Use streaming for large payloads",
            ],
            risk: "medium",
            roiScore: 0,
        });

        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Implement Response Caching",
            description: "Cache external service responses to reduce redundant calls",
            category: "caching",
            affectedIFlows: longRunningDriver.affectedIFlows,
            estimatedSavings: longRunningDriver.potentialSavings * 0.3,
            effort: "medium",
            priority: 4,
            implementationSteps: [
                "Identify cacheable external calls",
                "Implement content-based caching strategy",
                "Configure appropriate TTL values",
                "Add cache invalidation logic",
            ],
            risk: "low",
            roiScore: 0,
        });
    }

    // Based on high-error driver
    const highErrorDriver = drivers.find(d => d.type === "high-error-rate");
    if (highErrorDriver) {
        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Improve Error Handling",
            description: "Implement proper error handling to prevent unnecessary retries and wasted executions",
            category: "error-handling",
            affectedIFlows: highErrorDriver.affectedIFlows,
            estimatedSavings: highErrorDriver.potentialSavings,
            effort: "medium",
            priority: 1,
            implementationSteps: [
                "Analyze error patterns and root causes",
                "Implement intelligent retry logic",
                "Add circuit breaker patterns",
                "Configure appropriate timeout values",
                "Set up error alerting and monitoring",
            ],
            risk: "low",
            roiScore: 0,
        });
    }

    // General optimization: Enable monitoring
    if (breakdowns.length > 5) {
        optimizations.push({
            id: `opt-${optimizationId++}`,
            title: "Implement Cost Monitoring Dashboard",
            description: "Set up ongoing cost monitoring to track trends and identify anomalies",
            category: "monitoring",
            affectedIFlows: [],
            estimatedSavings: breakdowns.reduce((sum, b) => sum + b.estimatedCost, 0) * 0.05,
            effort: "low",
            priority: 5,
            implementationSteps: [
                "Define cost KPIs and thresholds",
                "Set up regular cost reports",
                "Configure budget alerts",
                "Create trend analysis dashboards",
            ],
            risk: "low",
            roiScore: 0,
        });
    }

    // Calculate ROI scores
    optimizations.forEach(opt => {
        opt.roiScore = calculateROIScore(opt.estimatedSavings, opt.effort);
    });

    // Sort by ROI score descending
    optimizations.sort((a, b) => b.roiScore - a.roiScore);

    // Re-assign priorities based on ROI
    optimizations.forEach((opt, idx) => {
        opt.priority = idx + 1;
    });

    return optimizations;
}

/**
 * Calculate cost forecast
 */
function calculateForecast(
    breakdowns: IFlowCostBreakdown[],
    totalCost: number,
    daysBack: number
): CostForecast {
    // Ensure we have valid numbers
    const safeTotalCost = Number.isFinite(totalCost) ? totalCost : 0;
    const safeDaysBack = Number.isFinite(daysBack) && daysBack > 0 ? daysBack : 30;
    
    // Calculate daily rate
    const dailyRate = safeTotalCost / safeDaysBack;
    const monthlyRate = dailyRate * 30;

    // Simple linear projection (in production, would use more sophisticated forecasting)
    const growthRate = 5; // Assume 5% monthly growth by default
    const monthlyProjections: CostForecast["monthlyProjections"] = [];

    for (let i = 1; i <= 6; i++) {
        const projectedCost = monthlyRate * Math.pow(1 + growthRate / 100, i);
        const variance = projectedCost * 0.1; // 10% variance

        const date = new Date();
        date.setMonth(date.getMonth() + i);

        monthlyProjections.push({
            month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
            projectedCost,
            lowerBound: projectedCost - variance,
            upperBound: projectedCost + variance,
        });
    }

    return {
        periodDays: daysBack,
        currentMonthlyRate: monthlyRate,
        projectedCost: monthlyProjections[0]?.projectedCost || monthlyRate,
        confidence: 0.75, // 75% confidence for simple projection
        growthTrend: growthRate > 2 ? "increasing" : growthRate < -2 ? "decreasing" : "stable",
        growthRate,
        monthlyProjections,
    };
}

/**
 * Build the cost analysis prompt for AI
 */
function buildCostAnalysisPrompt(
    analysis: CostAnalysisResult,
    budgetThreshold?: number
): string {
    const { summary, iflowBreakdown, costDrivers, optimizations, forecast, pricingConfig } = analysis;

    // Top 10 iFlows by cost
    const topIFlows = iflowBreakdown.slice(0, 10);

    let prompt = `
## Cost Analysis Context

**Analysis Period:** ${summary.periodStart.split('T')[0]} to ${summary.periodEnd.split('T')[0]} (${analysis.periodDays} days)

### Summary Statistics
- **Total Estimated Cost:** ${pricingConfig.currency} ${summary.totalCost.toFixed(2)}
- **Total iFlows Analyzed:** ${summary.iflowCount}
- **Total Executions:** ${summary.totalExecutions.toLocaleString()}
- **Total Runtime:** ${summary.totalRuntimeHours.toFixed(2)} hours
- **Average Cost per Execution:** ${pricingConfig.currency} ${summary.avgCostPerExecution.toFixed(4)}
- **Average Cost per iFlow:** ${pricingConfig.currency} ${summary.avgCostPerIFlow.toFixed(2)}

### Pricing Configuration Used
- Cost per Execution: ${pricingConfig.currency} ${pricingConfig.costPerExecution}
- Cost per Minute Runtime: ${pricingConfig.currency} ${pricingConfig.costPerMinuteRuntime}
- Cost per MB Transferred: ${pricingConfig.currency} ${pricingConfig.costPerMBTransferred}

### Top ${topIFlows.length} iFlows by Cost

| iFlow | Executions | Avg Duration | Error Rate | Est. Cost | % of Total |
|-------|------------|--------------|------------|-----------|------------|
${topIFlows.map(iflow => 
    `| ${iflow.iflowName} | ${iflow.executionCount.toLocaleString()} | ${(iflow.avgDuration / 1000).toFixed(1)}s | ${iflow.errorRate.toFixed(1)}% | ${pricingConfig.currency} ${iflow.estimatedCost.toFixed(2)} | ${iflow.percentOfTotal.toFixed(1)}% |`
).join('\n')}

### Identified Cost Drivers

${costDrivers.map(driver => `
**${driver.name}** (${driver.severity} severity)
- ${driver.description}
- Affected iFlows: ${driver.affectedIFlows.join(', ')}
- Cost Impact: ${pricingConfig.currency} ${driver.costImpact.toFixed(2)}
- Potential Savings: ${pricingConfig.currency} ${driver.potentialSavings.toFixed(2)}
`).join('\n')}

### Generated Optimization Opportunities

${optimizations.map(opt => `
**#${opt.priority}: ${opt.title}** (${opt.effort} effort, ${opt.risk} risk)
- ${opt.description}
- Estimated Savings: ${pricingConfig.currency} ${opt.estimatedSavings.toFixed(2)}/month
- ROI Score: ${opt.roiScore.toFixed(2)}
`).join('\n')}

### Cost Forecast

- **Current Monthly Run Rate:** ${pricingConfig.currency} ${forecast.currentMonthlyRate.toFixed(2)}
- **Growth Trend:** ${forecast.growthTrend} (${forecast.growthRate > 0 ? '+' : ''}${forecast.growthRate}%)
- **6-Month Projection:** ${pricingConfig.currency} ${forecast.monthlyProjections[5]?.projectedCost.toFixed(2) || 'N/A'}

${budgetThreshold ? `
### Budget Alert
- **Monthly Budget:** ${pricingConfig.currency} ${budgetThreshold}
- **Current Utilization:** ${((forecast.currentMonthlyRate / budgetThreshold) * 100).toFixed(1)}%
` : ''}

---

Based on this cost analysis data, please provide:

1. **Executive Summary**: A brief overview of the cost situation
2. **Key Findings**: The most important insights from the data
3. **Top 3 Recommendations**: Prioritized actions with estimated ROI
4. **Risk Assessment**: Any concerns or risks identified
5. **Action Plan**: Specific next steps with timelines

Focus on actionable, high-ROI recommendations that can be implemented quickly.
`;

    return prompt;
}
