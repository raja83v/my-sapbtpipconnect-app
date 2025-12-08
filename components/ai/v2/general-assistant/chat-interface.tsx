"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    MessageSquare,
    Send,
    Sparkles,
    Loader2,
    RefreshCw,
    Download,
    Trash2,
    Settings,
    ChevronDown,
    Lightbulb,
    Code,
    FileText,
    AlertCircle,
    Zap,
    Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getChatHistory, clearChatHistory } from "@/app/actions/ai-agents-v2";
import { sendChatMessageWithTools } from "@/app/actions/ai-agents-tools";
import { ToolExecutionDisplay, ToolCallSummary, type ToolCall } from "@/components/ai/tool-execution-display";
import { 
    ActionConfirmationDialog, 
    useConfirmationDialog,
    type ConfirmationRequest 
} from "@/components/ai/action-confirmation-dialog";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
    tokensUsed?: number;
    toolCalls?: ToolCall[];
}

interface ChatInterfaceProps {
    tenantId?: string;
    iflowId?: string;
}

const SUGGESTED_PROMPTS = [
    {
        icon: Lightbulb,
        title: "Show me the top 10 deployed iFlows",
        category: "Data Retrieval",
    },
    {
        icon: Code,
        title: "What errors occurred in the last 24 hours?",
        category: "Monitoring",
    },
    {
        icon: FileText,
        title: "Give me an overview of this tenant",
        category: "Analytics",
    },
    {
        icon: AlertCircle,
        title: "Show recent failed message executions",
        category: "Troubleshooting",
    },
];

export function ChatInterface({ tenantId, iflowId }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [totalTokensUsed, setTotalTokensUsed] = useState(0);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    
    // Confirmation dialog state
    const {
        confirmationRequest,
        isOpen: isConfirmationOpen,
        setIsOpen: setConfirmationOpen,
        requestConfirmation,
        clearConfirmation,
    } = useConfirmationDialog();

    useEffect(() => {
        loadChatHistory();
    }, [tenantId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadChatHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const result = await getChatHistory({ tenantId, limit: 50 });
            if (result.success && result.data) {
                const historyMessages: Message[] = result.data.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp),
                }));
                setMessages(historyMessages);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const scrollToBottom = () => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        // Check if tenant is selected for tool-enabled queries
        if (!tenantId) {
            toast.error("Please select a tenant first", {
                description: "Tool-enabled queries require a tenant to be selected.",
            });
            return;
        }

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Add placeholder for assistant response
        const assistantMessageId = `assistant-${Date.now()}`;
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
        };
        setMessages(prev => [...prev, assistantMessage]);

        try {
            // Use the tool-enabled version
            const result = await sendChatMessageWithTools({
                message: userMessage.content,
                tenantId,
                iflowId,
                conversationHistory: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                enableTools: true,
            });

            if (result.success && result.data) {
                // Convert tool calls to our format
                const toolCalls: ToolCall[] = result.data.toolCalls?.map(tc => ({
                    id: tc.id,
                    toolName: tc.toolName,
                    parameters: tc.parameters,
                    status: tc.status as "completed" | "failed",
                    result: tc.result,
                    error: tc.error,
                    duration: tc.duration,
                    cached: tc.cached,
                    timestamp: new Date(),
                })) || [];

                // Check for confirmation requirement
                if (result.data.requiresConfirmation) {
                    requestConfirmation(result.data.requiresConfirmation);
                }

                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: result.data.response,
                                isStreaming: false,
                                tokensUsed: result.data.tokensUsed,
                                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                            }
                            : msg
                    )
                );
                setTotalTokensUsed(prev => prev + result.data.tokensUsed);
            } else {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: result.error || "I apologize, but I encountered an error. Please try again.",
                                isStreaming: false,
                            }
                            : msg
                    )
                );
                toast.error("Failed to get response", {
                    description: result.error,
                });
            }
        } catch (error) {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: "I apologize, but I encountered an error. Please try again.",
                            isStreaming: false,
                        }
                        : msg
                )
            );
            toast.error("Failed to send message");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm("Are you sure you want to clear the chat history?")) return;

        try {
            const result = await clearChatHistory({ tenantId });
            if (result.success) {
                setMessages([]);
                toast.success("Chat history cleared");
            } else {
                toast.error("Failed to clear history");
            }
        } catch (error) {
            toast.error("Failed to clear history");
        }
    };

    const handleSuggestedPrompt = (prompt: string) => {
        setInput(prompt);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl h-[calc(100vh-8rem)]">
            <div className="flex flex-col h-full gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                                    <MessageSquare className="h-8 w-8 text-indigo-500" />
                                </div>
                                AI Assistant
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Ask me anything about SAP CPI, integrations, or get help with any task
                            </p>
                            {totalTokensUsed > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                        <Zap className="mr-1 h-3 w-3" />
                                        {totalTokensUsed.toLocaleString()} tokens used this session
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={loadChatHistory} disabled={isLoadingHistory}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingHistory && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearHistory} disabled={messages.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Chat Container */}
                <Card className="flex-1 flex flex-col overflow-hidden">
                    {/* Messages Area */}
                    <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
                        {isLoadingHistory ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-20 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-8">
                                <div className="text-center space-y-3">
                                    <div className="flex justify-center">
                                        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                                            <Sparkles className="h-12 w-12 text-indigo-500" />
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-semibold">How can I help you today?</h3>
                                    <p className="text-muted-foreground max-w-md">
                                        I'm your AI assistant for SAP CPI. Ask me anything about integrations, troubleshooting, or best practices.
                                    </p>
                                </div>

                                {/* Suggested Prompts */}
                                <div className="w-full max-w-2xl">
                                    <p className="text-sm font-medium mb-3 text-muted-foreground">Try asking:</p>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {SUGGESTED_PROMPTS.map((prompt, index) => {
                                            const Icon = prompt.icon;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSuggestedPrompt(prompt.title)}
                                                    className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left group"
                                                >
                                                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                                        <Icon className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium line-clamp-2">{prompt.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{prompt.category}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {messages.map((message) => (
                                    <MessageBubble key={message.id} message={message} />
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <Separator />

                    {/* Input Area */}
                    <div className="p-4">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={tenantId ? "Ask me anything about SAP CPI..." : "Select a tenant to enable AI tools..."}
                                    className="w-full min-h-[60px] max-h-[200px] p-3 pr-12 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                    disabled={isLoading || !tenantId}
                                />
                                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                                    {input.length > 0 && `${input.length} chars`}
                                </div>
                            </div>
                            <Button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading || !tenantId}
                                size="lg"
                                className="h-[60px] px-6"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            {tenantId ? (
                                <>Press Enter to send, Shift+Enter for new line • <Wrench className="inline h-3 w-3" /> Tools enabled</>
                            ) : (
                                "Select a tenant from the sidebar to enable AI tools"
                            )}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Confirmation Dialog */}
            <ActionConfirmationDialog
                open={isConfirmationOpen}
                onOpenChange={setConfirmationOpen}
                request={confirmationRequest}
                onConfirm={async (token) => {
                    // Handle confirmation - this would trigger the action
                    toast.success("Action confirmed", {
                        description: "Executing the requested action...",
                    });
                    clearConfirmation();
                }}
                onCancel={() => {
                    clearConfirmation();
                }}
            />
        </div>
    );
}

function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === "user";

    return (
        <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <div className="shrink-0">
                    <div className="h-8 w-8 rounded-full bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                    </div>
                </div>
            )}
            <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "items-end")}>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        {isUser ? "You" : "AI Assistant"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {message.tokensUsed && (
                        <Badge variant="outline" className="text-xs py-0">
                            <Zap className="mr-1 h-2.5 w-2.5" />
                            {message.tokensUsed}
                        </Badge>
                    )}
                </div>

                {/* Tool calls display */}
                {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mb-2">
                        <ToolExecutionDisplay toolCalls={message.toolCalls} />
                    </div>
                )}

                <div
                    className={cn(
                        "rounded-2xl px-4 py-3 text-sm",
                        isUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                    )}
                >
                    {message.isStreaming ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">
                                {message.toolCalls && message.toolCalls.length > 0 
                                    ? "Analyzing data..." 
                                    : "Thinking..."}
                            </span>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
                    )}
                </div>

                {/* Tool call summary */}
                {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
                    <ToolCallSummary toolCalls={message.toolCalls} />
                )}
            </div>
            {isUser && (
                <div className="shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                </div>
            )}
        </div>
    );
}