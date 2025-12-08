"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentChat, type ChatMessage } from "@/components/ai/agent-chat";
import { AgentOutput } from "@/components/ai/agent-output";
import { AgentSidebar, type ConversationHistoryItem } from "@/components/ai/agent-sidebar";
import { executeAgent, getAgentHistory, getConversationById } from "@/app/actions/ai-agents";
import { getUserTenantsForFilter, getIFlows } from "@/app/actions/iflows";
import { agentConfigs, type AIAgentType } from "@/lib/ai/agent-types";
import { ArrowLeft, Settings, Workflow } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface SerializedAgentConfig {
  type: AIAgentType;
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  color: string;
  capabilities: string[];
  useCases: string[];
  requiresTenant: boolean;
  requiresIFlow: boolean;
  category: "creation" | "monitoring" | "optimization" | "analysis";
}

interface AgentPageClientProps {
  agent: SerializedAgentConfig;
}

export default function AgentPageClient({ agent }: AgentPageClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedIFlow, setSelectedIFlow] = useState<string>("");
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [iFlows, setIFlows] = useState<Array<{ id: string; name: string; iFlowId: string }>>([]);
  const [isLoadingIFlows, setIsLoadingIFlows] = useState(false);
  const [conversations, setConversations] = useState<ConversationHistoryItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState(true);

  // Get the icon component from agentConfigs
  const agentConfig = agentConfigs[agent.type];
  const Icon = agentConfig.icon;

  useEffect(() => {
    loadTenants();
    loadHistory();
  }, []);

  // Load iFlows when tenant changes
  useEffect(() => {
    if (selectedTenant && agent.requiresIFlow) {
      loadIFlows(selectedTenant);
    } else {
      setIFlows([]);
      setSelectedIFlow("");
    }
  }, [selectedTenant, agent.requiresIFlow]);

  const loadTenants = async () => {
    const result = await getUserTenantsForFilter();
    if (result.success && result.data) {
      setTenants(result.data);
      if (result.data.length > 0 && !selectedTenant) {
        setSelectedTenant(result.data[0].id);
      }
    }
  };

  const loadIFlows = async (tenantId: string) => {
    setIsLoadingIFlows(true);
    try {
      const result = await getIFlows({ tenantId, pageSize: 100 });
      if (result.success && result.data) {
        setIFlows(result.data.iflows.map((iflow) => ({
          id: iflow.id,
          name: iflow.name,
          iFlowId: iflow.iFlowId,
        })));
        // Reset selected iFlow when tenant changes
        setSelectedIFlow("");
      }
    } catch (error) {
      console.error("Error loading iFlows:", error);
      toast.error("Failed to load iFlows");
    } finally {
      setIsLoadingIFlows(false);
    }
  };

  const loadHistory = async () => {
    const result = await getAgentHistory(agent.type);
    if (result.success && result.data) {
      const history: ConversationHistoryItem[] = result.data.map((exec: any) => ({
        id: exec.id,
        title: exec.inputPrompt.substring(0, 50) + "...",
        timestamp: new Date(exec.createdAt),
        messageCount: 2, // User message + agent response
        status: exec.status.toLowerCase() as "completed" | "in-progress" | "failed",
        preview: exec.outputData?.substring(0, 100),
      }));
      setConversations(history);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const result = await executeAgent({
        agentType: agent.type,
        prompt: messageContent,
        tenantId: agent.requiresTenant ? selectedTenant : undefined,
        iflowId: agent.requiresIFlow && selectedIFlow && selectedIFlow !== "none" ? selectedIFlow : undefined,
      });

      if (result.success && result.data) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        toast.success("Response generated successfully", {
          description: `Used ${result.data.tokensUsed} tokens in ${(result.data.duration / 1000).toFixed(2)}s`,
        });

        // Reload history
        await loadHistory();
      } else {
        toast.error("Failed to generate response", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("An error occurred while processing your request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setActiveConversationId("");
  };

  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    
    try {
      const result = await getConversationById(conversationId);
      
      if (result.success && result.data) {
        const userMessage: ChatMessage = {
          id: `${conversationId}-user`,
          role: "user",
          content: result.data.inputPrompt,
          timestamp: new Date(),
        };
        
        const assistantMessage: ChatMessage = {
          id: `${conversationId}-assistant`,
          role: "assistant",
          content: result.data.outputData,
          timestamp: new Date(),
        };
        
        setMessages([userMessage, assistantMessage]);
        toast.success("Conversation loaded");
      } else {
        toast.error("Failed to load conversation", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    toast.info("Delete functionality coming soon");
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/ai-agents">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${agent.color}-500/10`}
                >
                  <Icon className={`h-6 w-6 text-${agent.color}-500`} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                  <p className="text-muted-foreground">{agent.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {agent.capabilities.slice(0, 5).map((capability, idx) => (
                  <Badge key={idx} variant="secondary">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Tenant Selector (if required) */}
        {agent.requiresTenant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Tenant</CardTitle>
              <CardDescription>
                Choose which tenant this agent should work with
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* iFlow Selector (if required) */}
        {agent.requiresIFlow && selectedTenant && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Select iFlow (Optional)</CardTitle>
                  <CardDescription>
                    Select a specific iFlow for more targeted analysis and recommendations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Select 
                value={selectedIFlow} 
                onValueChange={setSelectedIFlow}
                disabled={isLoadingIFlows}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={isLoadingIFlows ? "Loading iFlows..." : "Select an iFlow (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All iFlows (no specific selection)</SelectItem>
                  {iFlows.map((iflow) => (
                    <SelectItem key={iflow.id} value={iflow.id}>
                      <div className="flex items-center gap-2">
                        <span>{iflow.name}</span>
                        <span className="text-xs text-muted-foreground">({iflow.iFlowId})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {iFlows.length === 0 && !isLoadingIFlows && (
                <p className="text-sm text-muted-foreground mt-2">
                  No iFlows found for this tenant. Deploy some iFlows first.
                </p>
              )}
              {selectedIFlow && selectedIFlow !== "none" && (
                <div className="mt-2">
                  <Badge variant="outline" className="gap-1">
                    <Workflow className="h-3 w-3" />
                    {iFlows.find(i => i.id === selectedIFlow)?.name}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          {showSidebar && (
            <div className="lg:col-span-3 h-[calc(100vh-320px)]">
              <AgentSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
                onNewConversation={handleNewConversation}
              />
            </div>
          )}

          {/* Chat Area */}
          <div className={showSidebar ? "lg:col-span-9" : "lg:col-span-12"}>
            <Card className="h-[calc(100vh-320px)] flex flex-col overflow-hidden">
              <AgentChat
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                placeholder={`Ask ${agent.name} anything about your integrations...`}
                agentName={agent.name}
              />
            </Card>
          </div>
        </div>

        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle>About {agent.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{agent.longDescription}</p>
            
            <div>
              <h4 className="font-medium mb-2">Capabilities</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {agent.capabilities.map((capability, idx) => (
                  <li key={idx}>{capability}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Use Cases</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {agent.useCases.map((useCase, idx) => (
                  <li key={idx}>{useCase}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
