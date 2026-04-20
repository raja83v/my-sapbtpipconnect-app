"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, X, Loader2 } from "lucide-react";
import { diagnoseExecutionError } from "@/app/actions/iflows";
import ReactMarkdown from "react-markdown";

interface ErrorExplainerProps {
  messageId: string;
  iflowId: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  litellm: "LiteLLM",
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Google Gemini",
};

export function ErrorExplainer({ messageId, iflowId }: ErrorExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("AI");

  useEffect(() => {
    fetch("/api/ai/config")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.config) {
          const providerName = PROVIDER_LABELS[data.config.provider] || data.config.provider;
          const model = data.config.defaultModel || "";
          setModelLabel(model ? `${providerName} (${model})` : providerName);
        }
      })
      .catch(() => {/* keep default */});
  }, []);

  const handleExplain = async () => {
    setIsOpen(true);
    setIsLoading(true);
    setDiagnosis("");
    setError(null);

    try {
      const result = await diagnoseExecutionError(messageId, iflowId);

      if (result.success && result.data) {
        setDiagnosis(result.data.diagnosis);
      } else {
        setError(result.error || "Failed to analyze error");
      }
    } catch (err) {
      console.error("Error getting diagnosis:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleExplain}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Explain Error with AI
      </Button>

      {isOpen && (
        <Card className="mt-4 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Error Diagnosis
              </CardTitle>
              <CardDescription>
                {modelLabel} analyzing your integration error
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing error details...</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {diagnosis && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{diagnosis}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
