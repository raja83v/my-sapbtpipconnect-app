"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Download, Code2, FileText } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface AgentOutputProps {
  content: string;
  outputType?: "markdown" | "code" | "json" | "xml" | "mixed";
  title?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    timestamp?: Date;
  };
}

export function AgentOutput({
  content,
  outputType = "markdown",
  title = "Agent Response",
  metadata,
}: AgentOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-output-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (outputType) {
      case "code":
        return (
          <SyntaxHighlighter
            language="javascript"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            {content}
          </SyntaxHighlighter>
        );
      case "json":
        return (
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            {content}
          </SyntaxHighlighter>
        );
      case "xml":
        return (
          <SyntaxHighlighter
            language="xml"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            {content}
          </SyntaxHighlighter>
        );
      case "markdown":
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  return !isInline && match ? (
                    <SyntaxHighlighter
                      language={match[1]}
                      style={vscDarkPlus as any}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        );
      case "mixed":
        return (
          <Tabs defaultValue="rendered" className="w-full">
            <TabsList>
              <TabsTrigger value="rendered">
                <FileText className="h-4 w-4 mr-2" />
                Rendered
              </TabsTrigger>
              <TabsTrigger value="raw">
                <Code2 className="h-4 w-4 mr-2" />
                Raw
              </TabsTrigger>
            </TabsList>
            <TabsContent value="rendered" className="mt-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </TabsContent>
            <TabsContent value="raw" className="mt-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                <code>{content}</code>
              </pre>
            </TabsContent>
          </Tabs>
        );
      default:
        return (
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
            <code>{content}</code>
          </pre>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {metadata && (
              <div className="flex gap-2 text-xs text-muted-foreground">
                {metadata.tokensUsed && (
                  <Badge variant="secondary" className="text-xs">
                    {metadata.tokensUsed.toLocaleString()} tokens
                  </Badge>
                )}
                {metadata.duration && (
                  <Badge variant="secondary" className="text-xs">
                    {(metadata.duration / 1000).toFixed(2)}s
                  </Badge>
                )}
                {metadata.timestamp && (
                  <span>
                    {metadata.timestamp.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
