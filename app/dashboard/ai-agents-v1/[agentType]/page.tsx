import { notFound, redirect } from "next/navigation";
import { getAgentBySlug } from "@/lib/ai/agent-types";
import { getAgentBySlugV2 } from "@/lib/ai/agent-types-v2";
import AgentPageClient from "./agent-page-client";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentType: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Auth is handled by the layout, no need to check here
  const { agentType } = await params;
  const search = await searchParams;

  // Check if this agent has a v2 specialized UI
  const agentV2 = getAgentBySlugV2(agentType);
  if (agentV2 && agentV2.uiType !== "chat") {
    // Redirect to v2 specialized UI with query params
    const queryString = new URLSearchParams(search as Record<string, string>).toString();
    redirect(`/dashboard/ai-agents-v2/${agentType}${queryString ? `?${queryString}` : ""}`);
  }

  const agent = getAgentBySlug(agentType);

  if (!agent) {
    notFound();
  }

  // Serialize agent config for client component (remove icon component)
  const serializedAgent = {
    type: agent.type,
    name: agent.name,
    slug: agent.slug,
    description: agent.description,
    longDescription: agent.longDescription,
    color: agent.color,
    capabilities: agent.capabilities,
    useCases: agent.useCases,
    requiresTenant: agent.requiresTenant,
    requiresIFlow: agent.requiresIFlow,
    category: agent.category,
  };

  return <AgentPageClient agent={serializedAgent} />;
}
