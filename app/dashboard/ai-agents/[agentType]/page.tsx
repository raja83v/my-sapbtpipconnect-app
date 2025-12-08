import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/user";
import { getUserTenants } from "@/app/actions/tenant";
import { getAgentBySlugV2 } from "@/lib/ai/agent-types-v2";
import { ErrorDiagnostician } from "@/components/ai/v2/specialized/error-diagnostician/error-diagnostician-v2";
import { PerformanceOptimizer } from "@/components/ai/v2/specialized/performance-optimizer/performance-optimizer-v2";
import { SmartMonitor } from "@/components/ai/v2/specialized/smart-monitor/smart-monitor-v2";
import { TestCaseGenerator } from "@/components/ai/v2/specialized/test-case-generator/test-case-generator";
import { DocumentationGenerator } from "@/components/ai/v2/specialized/documentation-generator";
import { CostAnalyzer } from "@/components/ai/v2/specialized/cost-analyzer";
import { ChatInterface } from "@/components/ai/v2/general-assistant/chat-interface";
import { IFlowCreator } from "@/components/ai/v2/specialized/iflow-creator/iflow-creator";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface AgentPageProps {
    params: Promise<{ agentType: string }>;
    searchParams: Promise<{ tenantId?: string; iflowId?: string }>;
}

export default async function AgentPage({ params, searchParams }: AgentPageProps) {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const { agentType } = await params;
    const searchParamsData = await searchParams;

    const agent = getAgentBySlugV2(agentType);

    if (!agent) {
        notFound();
    }

    // Get user's tenants
    const tenantsResult = await getUserTenants();
    const tenants = tenantsResult.success && tenantsResult.data ? tenantsResult.data : [];

    // Use tenant from URL params, or fall back to first available tenant
    const tenantId = searchParamsData.tenantId || (tenants.length > 0 ? tenants[0].id : undefined);
    const iflowId = searchParamsData.iflowId;

    // Check if tenant is required but not available
    if (agent.requiresTenant && !tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center gap-4">
                            <AlertCircle className="h-12 w-12 text-yellow-500" />
                            <div>
                                <h3 className="text-lg font-semibold mb-2">No Tenants Available</h3>
                                <p className="text-sm text-muted-foreground">
                                    This agent requires a tenant to be configured. Please add a tenant in your
                                    settings before using this agent.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Check if iFlow is required but not provided
    if (agent.requiresIFlow && !iflowId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center gap-4">
                            <AlertCircle className="h-12 w-12 text-yellow-500" />
                            <div>
                                <h3 className="text-lg font-semibold mb-2">iFlow Required</h3>
                                <p className="text-sm text-muted-foreground">
                                    This agent requires an iFlow to be selected. Please select an iFlow from the
                                    dashboard and try again.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Route to appropriate agent component based on type
    switch (agent.type) {
        case "ERROR_DIAGNOSTICIAN":
            return <ErrorDiagnostician tenantId={tenantId!} iflowId={iflowId} />;

        case "PERFORMANCE_OPTIMIZER":
            return <PerformanceOptimizer tenantId={tenantId!} iflowId={iflowId} />;

        case "SMART_MONITOR":
            return <SmartMonitor tenantId={tenantId!} iflowId={iflowId} />;

        case "GENERAL_ASSISTANT":
            return <ChatInterface tenantId={tenantId} iflowId={iflowId} />;

        case "IFLOW_CREATOR":
            return <IFlowCreator tenantId={tenantId!} />;

        case "TEST_CASE_GENERATOR":
            return <TestCaseGenerator tenantId={tenantId!} iflowId={iflowId} />;

        case "DOCUMENTATION_GENERATOR":
            return <DocumentationGenerator tenantId={tenantId!} iflowId={iflowId} />;

        case "COST_ANALYZER":
            return <CostAnalyzer tenantId={tenantId!} iflowId={iflowId} />;

        default:
            return (
                <div className="p-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center text-center gap-4">
                                <AlertCircle className="h-12 w-12 text-gray-500" />
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                                    <p className="text-sm text-muted-foreground">
                                        This agent is currently under development.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
    }
}