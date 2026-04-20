"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  IconBrain,
  IconCheck,
  IconLoader2,
  IconPlugConnected,
  IconAlertCircle,
  IconSparkles,
} from "@tabler/icons-react";
import type { AIProvider } from "@/lib/db/schema";

interface ProviderOption {
  id: AIProvider;
  label: string;
  description: string;
  recommended?: boolean;
  requiresBaseUrl: boolean;
  models: { value: string; label: string; recommended?: boolean }[];
}

const providers: ProviderOption[] = [
  {
    id: "litellm",
    label: "LiteLLM",
    description: "OpenAI-compatible proxy supporting 100+ models. Self-hosted or cloud.",
    recommended: true,
    requiresBaseUrl: true,
    models: [
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", recommended: true },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Direct OpenAI API. GPT-4.1 family models.",
    requiresBaseUrl: false,
    models: [
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", recommended: true },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "o4-mini", label: "o4-mini" },
    ],
  },
  {
    id: "claude",
    label: "Claude (Anthropic)",
    description: "Direct Anthropic API. Claude Sonnet, Opus, and Haiku models.",
    requiresBaseUrl: false,
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", recommended: true },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
    ],
  },
  {
    id: "gemini",
    label: "Gemini (Google)",
    description: "Google AI SDK. Gemini 2.5 family models.",
    requiresBaseUrl: false,
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", recommended: true },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
];

interface AIModelSelectionStepProps {
  onComplete: () => void;
  onBack?: () => void;
}

export function AIModelSelectionStep({ onComplete, onBack }: AIModelSelectionStepProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [error, setError] = useState("");
  const [fetchedModels, setFetchedModels] = useState<{ value: string; label: string }[] | null>(null);

  const provider = providers.find((p) => p.id === selectedProvider);
  // For LiteLLM, only show models after a successful test; other providers use their known model lists
  const availableModels = fetchedModels || (provider && !provider.requiresBaseUrl ? provider.models : []);

  const handleProviderSelect = (id: AIProvider) => {
    setSelectedProvider(id);
    setApiKey("");
    setBaseUrl("");
    setTestResult(null);
    setError("");
    setFetchedModels(null);
    // For providers with known model lists, pre-select the recommended model
    // For LiteLLM (requiresBaseUrl), leave empty until test fetches models
    const p = providers.find((pr) => pr.id === id);
    if (p && !p.requiresBaseUrl) {
      const defaultModel = p.models.find((m) => m.recommended)?.value || p.models[0]?.value || "";
      setSelectedModel(defaultModel);
    } else {
      setSelectedModel("");
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setError("");

    try {
      const res = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || undefined,
          model: selectedModel || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);

      // If models were returned (LiteLLM/OpenAI), populate the dropdown
      if (data.success && data.models && Array.isArray(data.models)) {
        const dynamicModels = data.models.map((m: { id: string; name: string }) => ({
          value: m.id,
          label: m.name,
        }));
        setFetchedModels(dynamicModels);
        // If current selection isn't in the fetched list, select the first one
        if (!dynamicModels.some((m: { value: string }) => m.value === selectedModel)) {
          setSelectedModel(dynamicModels[0]?.value || "");
        }
      }
    } catch {
      setTestResult({ success: false, error: "Failed to test connection" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim() || !selectedModel) return;
    setIsSaving(true);
    setError("");

    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || undefined,
          defaultModel: selectedModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save configuration");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configure AI Provider
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose your AI provider for intelligent SAP CPI automation
        </p>
      </div>

      {/* Provider Selection Cards */}
      <div className="grid grid-cols-2 gap-3">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleProviderSelect(p.id)}
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedProvider === p.id
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            {p.recommended && (
              <Badge variant="default" className="absolute -top-2 right-2 text-[10px] px-1.5 py-0">
                Recommended
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <IconBrain className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">{p.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {p.description}
            </p>
            {selectedProvider === p.id && (
              <div className="absolute top-2 left-2">
                <IconCheck className="h-4 w-4 text-primary" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Configuration Form */}
      {provider && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <IconSparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {provider.label} Configuration
            </span>
          </div>

          {/* Base URL (LiteLLM only) */}
          {provider.requiresBaseUrl && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="http://localhost:4000/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoComplete="url"
              />
              <p className="text-xs text-muted-foreground">
                Your LiteLLM proxy endpoint
              </p>
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={`Enter your ${provider.label} API key…`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Default Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={availableModels.length === 0}>
              <SelectTrigger id="model">
                <SelectValue placeholder={availableModels.length === 0 ? "Test connection to load models…" : "Select a model…"} />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                    {"recommended" in m && m.recommended ? " (Recommended)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fetchedModels ? (
              <p className="text-xs text-muted-foreground">
                {fetchedModels.length} model{fetchedModels.length !== 1 ? "s" : ""} available from your provider
              </p>
            ) : provider.requiresBaseUrl ? (
              <p className="text-xs text-muted-foreground">
                Click &ldquo;Test Connection&rdquo; to fetch available models
              </p>
            ) : null}
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!apiKey.trim() || isTesting || (provider.requiresBaseUrl && !baseUrl.trim())}
            >
              {isTesting ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconPlugConnected className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            {testResult && (
              <span
                className={cn(
                  "text-sm flex items-center gap-1",
                  testResult.success ? "text-green-600" : "text-destructive"
                )}
              >
                {testResult.success ? (
                  <>
                    <IconCheck className="h-4 w-4" /> Connected
                  </>
                ) : (
                  <>
                    <IconAlertCircle className="h-4 w-4" /> {testResult.error}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!selectedProvider || !apiKey.trim() || !selectedModel || isSaving || (provider?.requiresBaseUrl && !baseUrl.trim())}
          className="flex-1"
        >
          {isSaving ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Continue
        </Button>
      </div>
    </>
  );
}
