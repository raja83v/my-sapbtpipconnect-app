"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Sparkles, User, Bot, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { DiagramRenderer } from "./diagram-renderer";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AgentChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  agentName?: string;
}

export function AgentChat({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Describe what you'd like me to help you with...",
  agentName = "AI Agent",
}: AgentChatProps) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-6 p-4 pr-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6 bg-indigo-500/10">
                <Bot className="h-8 w-8 text-indigo-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {agentName}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                {placeholder}
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                <Badge variant="outline" className="text-xs">Ask clarifying questions</Badge>
                <Badge variant="outline" className="text-xs">Generate documentation</Badge>
                <Badge variant="outline" className="text-xs">Create diagrams</Badge>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                    <Bot className="h-5 w-5 text-indigo-500" />
                  </div>
                )}
                
                {message.role === "user" ? (
                  // User message - simple bubble
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <Card className="px-4 py-3 bg-primary text-primary-foreground rounded-2xl rounded-tr-sm">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </Card>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                ) : (
                  // Assistant message - enhanced card design
                  <div className="flex-1 max-w-full">
                    <Card className="overflow-hidden border-0 shadow-sm bg-muted/40">
                      {/* Response Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-medium">{agentName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="h-8 px-2"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Response Content */}
                      <div className="p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => (
                                <h1 className="text-xl font-bold mt-6 mb-3 first:mt-0 text-foreground flex items-center gap-2">
                                  <div className="h-1 w-1 rounded-full bg-primary" />
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground flex items-center gap-2">
                                  <div className="h-1 w-1 rounded-full bg-primary/70" />
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                              ),
                              p: ({ children, node }) => {
                                // Check if this paragraph contains any block-level elements
                                // If so, render as div to avoid hydration errors
                                const hasBlockChildren = node?.children?.some((child: any) => 
                                  child.tagName === 'pre' || 
                                  child.tagName === 'div' ||
                                  (child.type === 'element' && child.tagName === 'code' && 
                                    (child.properties?.className?.some((c: string) => c.startsWith('language-')) ||
                                     String(child.children?.[0]?.value || '').includes('\n')))
                                );
                                
                                if (hasBlockChildren) {
                                  return <div className="mb-3 leading-relaxed text-foreground/90">{children}</div>;
                                }
                                return <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>;
                              },
                              ul: ({ children }) => (
                                <ul className="mb-4 space-y-2 list-none pl-0">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-4 space-y-2 list-decimal pl-5">{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li className="flex items-start gap-2 text-foreground/90">
                                  <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-primary/50" />
                                  <span>{children}</span>
                                </li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-foreground">{children}</strong>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/50 rounded-r-lg italic">
                                  {children}
                                </blockquote>
                              ),
                              // Handle code blocks - pre wraps code for block code
                              pre: ({ children }) => {
                                return <>{children}</>;
                              },
                              code: ({ node, className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeContent = String(children).trim();
                                // Check if this is a block code (has className with language or is multiline)
                                const isBlock = match || codeContent.includes('\n') || (node?.position?.start?.line !== node?.position?.end?.line);
                                
                                if (isBlock && match) {
                                  if (match[1] === 'mermaid') {
                                    return <DiagramRenderer code={codeContent} type="mermaid" />;
                                  }
                                }
                                
                                if (isBlock && (codeContent.includes('+---') || codeContent.includes('|   |'))) {
                                  return <DiagramRenderer code={codeContent} type="ascii" />;
                                }
                                
                                // Inline code
                                if (!isBlock) {
                                  return (
                                    <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary" {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                                
                                // Block code
                                return (
                                  <div className="relative group my-4">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => copyToClipboard(codeContent, `code-${message.id}`)}
                                        className="h-7 px-2"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <pre className="overflow-x-auto bg-zinc-950 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                      <code className="text-xs font-mono text-zinc-100" {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  </div>
                                );
                              },
                              hr: () => <Separator className="my-6" />,
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-4 rounded-lg border">
                                  <table className="w-full text-sm">{children}</table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="bg-muted/50 px-4 py-2 text-left font-semibold border-b">{children}</th>
                              ),
                              td: ({ children }) => (
                                <td className="px-4 py-2 border-b border-border/50">{children}</td>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                <Bot className="h-5 w-5 text-indigo-500" />
              </div>
              <Card className="px-4 py-4 bg-muted/30 border-0 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce bg-primary" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce bg-primary" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce bg-primary" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {agentName} is thinking...
                  </span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background/95 backdrop-blur p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="min-h-[60px] max-h-[200px] resize-none pr-12 rounded-xl bg-muted/50 border-muted-foreground/20 focus:border-primary"
                rows={2}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="absolute bottom-2 right-2 h-9 w-9 rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘</kbd> +{" "}
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Enter</kbd> to send
          </p>
        </form>
      </div>
    </div>
  );
}
