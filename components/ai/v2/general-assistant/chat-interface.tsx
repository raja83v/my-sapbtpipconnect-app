"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
    ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ToolExecutionDisplay, ToolCallSummary, type ToolCall } from "@/components/ai/tool-execution-display";
import { 
    ActionConfirmationDialog, 
    useConfirmationDialog,
    type ConfirmationRequest 
} from "@/components/ai/action-confirmation-dialog";
import { ChatSidebar } from "./chat-sidebar";
import {
    createConversation,
    getConversationMessages,
    autoTitleConversation,
} from "@/app/actions/ai-conversations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [totalTokensUsed, setTotalTokensUsed] = useState(0);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const isFirstMessageRef = useRef(false);
    
    // Confirmation dialog state
    const {
        confirmationRequest,
        isOpen: isConfirmationOpen,
        setIsOpen: setConfirmationOpen,
        requestConfirmation,
        clearConfirmation,
    } = useConfirmationDialog();

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadConversationMessages = async (convId: string) => {
        setIsLoadingHistory(true);
        try {
            const result = await getConversationMessages({ conversationId: convId });
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
            console.error("Failed to load conversation messages:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSelectConversation = async (convId: string) => {
        if (convId === conversationId) return;
        setConversationId(convId);
        setTotalTokensUsed(0);
        isFirstMessageRef.current = false;
        await loadConversationMessages(convId);
    };

    const handleNewChat = () => {
        setConversationId(null);
        setMessages([]);
        setInput("");
        setTotalTokensUsed(0);
        isFirstMessageRef.current = false;
        inputRef.current?.focus();
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

        if (!tenantId) {
            toast.error("Please select a tenant first", {
                description: "Tool-enabled queries require a tenant to be selected.",
            });
            return;
        }

        const messageText = input.trim();

        // If no conversation yet, create one
        let currentConversationId = conversationId;
        if (!currentConversationId) {
            const result = await createConversation({ tenantId });
            if (!result.success || !result.data) {
                toast.error("Failed to create conversation");
                return;
            }
            currentConversationId = result.data.id;
            setConversationId(currentConversationId);
            isFirstMessageRef.current = true;
        }

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: messageText,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        const assistantMessageId = `assistant-${Date.now()}`;
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
            toolCalls: [],
        };
        setMessages(prev => [...prev, assistantMessage]);

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageText,
                    tenantId,
                    iflowId,
                    conversationId: currentConversationId,
                    conversationHistory: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Request failed" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response stream");

            const decoder = new TextDecoder();
            let buffer = "";

            const updateAssistant = (updater: (prev: Message) => Partial<Message>) => {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, ...updater(msg) }
                            : msg
                    )
                );
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                let eventType = "";
                let eventData = "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        eventData = line.slice(6);

                        if (!eventType || !eventData) continue;

                        try {
                            const data = JSON.parse(eventData);

                            if (eventType === "tool_start") {
                                updateAssistant((prev) => ({
                                    toolCalls: [
                                        ...(prev.toolCalls || []),
                                        {
                                            id: data.id,
                                            toolName: data.toolName,
                                            parameters: data.parameters || {},
                                            status: "executing" as const,
                                            timestamp: new Date(),
                                        },
                                    ],
                                }));
                            } else if (eventType === "tool_call") {
                                updateAssistant((prev) => ({
                                    toolCalls: (prev.toolCalls || []).map(tc =>
                                        tc.id === data.id
                                            ? {
                                                ...tc,
                                                status: data.status as "completed" | "failed",
                                                result: data.result,
                                                error: data.error,
                                                duration: data.duration,
                                            }
                                            : tc
                                    ),
                                }));
                            } else if (eventType === "text") {
                                updateAssistant((prev) => ({
                                    content: prev.content + data,
                                }));
                            } else if (eventType === "done") {
                                updateAssistant(() => ({
                                    isStreaming: false,
                                    tokensUsed: data.tokensUsed,
                                }));
                                if (data.tokensUsed) {
                                    setTotalTokensUsed(prev => prev + data.tokensUsed);
                                }
                                // Auto-title on first message and refresh sidebar
                                if (isFirstMessageRef.current && currentConversationId) {
                                    isFirstMessageRef.current = false;
                                    autoTitleConversation({
                                        conversationId: currentConversationId,
                                        firstMessage: messageText,
                                    }).then(() => {
                                        (window as any).__refreshChatSidebar?.();
                                    });
                                } else {
                                    (window as any).__refreshChatSidebar?.();
                                }
                            } else if (eventType === "error") {
                                updateAssistant(() => ({
                                    content: data.message || "An error occurred.",
                                    isStreaming: false,
                                }));
                                toast.error("AI Error", { description: data.message });
                            }
                        } catch {
                            // text events may just be a raw string chunk
                            if (eventType === "text") {
                                updateAssistant((prev) => ({
                                    content: prev.content + eventData,
                                }));
                            }
                        }

                        eventType = "";
                        eventData = "";
                    }
                }
            }

            // Ensure streaming flag is cleared
            updateAssistant((prev) => {
                if (prev.isStreaming) return { isStreaming: false };
                return {};
            });
        } catch (error) {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: error instanceof Error ? error.message : "An error occurred. Please try again.",
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
            <div className="flex h-full gap-0 rounded-xl border overflow-hidden bg-card shadow-sm">
                {/* Sidebar */}
                <ChatSidebar
                    tenantId={tenantId}
                    activeConversationId={conversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewChat={handleNewChat}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                />

                {/* Main Chat Area */}
                <div className="flex flex-col flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-3 border-b">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-1.5 rounded-lg bg-linear-to-br from-indigo-500/20 to-purple-500/20">
                                <MessageSquare className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
                                <p className="text-xs text-muted-foreground truncate">
                                    Ask me anything about SAP CPI
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {totalTokensUsed > 0 && (
                                <Badge variant="outline" className="text-xs">
                                    <Zap className="mr-1 h-3 w-3" />
                                    {totalTokensUsed.toLocaleString()} tokens
                                </Badge>
                            )}
                        </div>
                    </div>
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
                                        <div className="p-4 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-500/20">
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
                        <div className="relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={tenantId ? "Ask me anything about SAP CPI..." : "Select a tenant to enable AI tools..."}
                                className="w-full min-h-14 max-h-[200px] px-4 pt-3 pb-12 rounded-2xl bg-transparent resize-none focus:outline-none text-sm"
                                disabled={isLoading || !tenantId}
                                rows={1}
                            />
                            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {tenantId ? (
                                        <>
                                            <Wrench className="h-3 w-3" />
                                            <span>Tools enabled</span>
                                            {input.length > 0 && (
                                                <>
                                                    <span className="text-muted-foreground/50">·</span>
                                                    <span>{input.length} chars</span>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <span>Select a tenant to enable AI tools</span>
                                    )}
                                </div>
                                <Button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading || !tenantId}
                                    size="icon"
                                    className={cn(
                                        "h-8 w-8 rounded-lg shrink-0 transition-all",
                                        input.trim() && !isLoading && tenantId
                                            ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ArrowUp className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Press Enter to send, Shift+Enter for new line
                        </p>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <ActionConfirmationDialog
                open={isConfirmationOpen}
                onOpenChange={setConfirmationOpen}
                request={confirmationRequest}
                onConfirm={async (token) => {
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
                    {message.isStreaming && !message.content ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">
                                {message.toolCalls && message.toolCalls.length > 0 
                                    ? "Analyzing data..." 
                                    : "Thinking..."}
                            </span>
                        </div>
                    ) : isUser ? (
                        <div className="whitespace-pre-wrap wrap-break-word">{message.content}</div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:text-sm [&_thead]:bg-muted-foreground/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/50 [&_tr:last-child_td]:border-b-0 [&_tr:hover]:bg-muted-foreground/5 [&_code]:bg-muted-foreground/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-muted-foreground/10 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                            </ReactMarkdown>
                            {message.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                            )}
                        </div>
                    )}
                </div>

                {/* Tool call summary */}
                {!isUser && message.toolCalls && message.toolCalls.length > 0 && !message.isStreaming && (
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