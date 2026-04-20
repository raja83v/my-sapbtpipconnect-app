"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  IconBrain,
  IconCheck,
  IconLoader2,
  IconPlugConnected,
  IconAlertCircle,
  IconSparkles,
  IconSettings,
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
    description: "OpenAI-compatible proxy supporting 100+ models.",
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
    description: "Direct OpenAI API.",
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
    description: "Direct Anthropic API.",
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
    description: "Google AI SDK.",
    requiresBaseUrl: false,
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", recommended: true },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
];

interface AIConfig {
  id: string;
  provider: AIProvider;
  baseUrl: string | null;
  defaultModel: string;
  fastModel: string | null;
  orchestratorModel: string | null;
  isActive: boolean;
}

export function AIConfigurationTab() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [fetchedModels, setFetchedModels] = useState<{ value: string; label: string }[] | null>(null);

  const provider = providers.find((p) => p.id === selectedProvider);
  // For LiteLLM, only show models after a successful test; other providers use their known model lists
  const availableModels = fetchedModels || (provider && !provider.requiresBaseUrl ? provider.models : []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/ai/config");
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      } catch {
        // Config not set yet
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const startEditing = () => {
    if (config) {
      setSelectedProvider(config.provider);
      setBaseUrl(config.baseUrl || "");
      setSelectedModel(config.defaultModel);
    }
    setApiKey("");
    setTestResult(null);
    setIsEditing(true);
  };

  const handleProviderSelect = (id: AIProvider) => {
    setSelectedProvider(id);
    setApiKey("");
    setBaseUrl("");
    setTestResult(null);
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
        throw new Error(data.error || "Failed to save");
      }
      setConfig(data.config);
      setIsEditing(false);
      setApiKey("");
      toast.success("AI configuration updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // View mode — show current config
  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBrain className="h-5 w-5 text-primary" />
              <CardTitle>AI Configuration</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={startEditing}>
              <IconSettings className="mr-2 h-4 w-4" />
              {config ? "Change Provider" : "Configure"}
            </Button>
          </div>
          <CardDescription>
            Configure the AI provider used for all intelligent features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <IconSparkles className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {providers.find((p) => p.id === config.provider)?.label || config.provider}
                    </span>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Model: {config.defaultModel}
                    {config.baseUrl && ` · ${config.baseUrl}`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <IconBrain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No AI provider configured yet.</p>
              <p className="text-xs mt-1">Click &ldquo;Configure&rdquo; to set up your AI provider.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconBrain className="h-5 w-5 text-primary" />
          <CardTitle>AI Configuration</CardTitle>
        </div>
        <CardDescription>
          Select your AI provider and enter credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderSelect(p.id)}
              className={cn(
                "relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
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
              <span className="font-medium text-sm">{p.label}</span>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Configuration Form */}
        {provider && (
          <div className="space-y-4 pt-2">
            {provider.requiresBaseUrl && (
              <div className="space-y-2">
                <Label htmlFor="settings-baseUrl">Base URL</Label>
                <Input
                  id="settings-baseUrl"
                  type="url"
                  placeholder="http://localhost:4000/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  autoComplete="url"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="settings-apiKey">API Key</Label>
              <Input
                id="settings-apiKey"
                type="password"
                placeholder={`Enter your ${provider.label} API key…`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-model">Default Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={availableModels.length === 0}>
                <SelectTrigger id="settings-model">
                  <SelectValue placeholder={availableModels.length === 0 ? "Test connection to load models…" : "Select a model…"} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}{"recommended" in m && m.recommended ? " (Recommended)" : ""}
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
                  Click &ldquo;Test&rdquo; to fetch available models
                </p>
              ) : null}
            </div>

            {/* Test + Actions */}
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
                Test
              </Button>
              {testResult && (
                <span
                  className={cn(
                    "text-sm flex items-center gap-1",
                    testResult.success ? "text-green-600" : "text-destructive"
                  )}
                >
                  {testResult.success ? (
                    <><IconCheck className="h-4 w-4" /> Connected</>
                  ) : (
                    <><IconAlertCircle className="h-4 w-4" /> {testResult.error}</>
                  )}
                </span>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsEditing(false); setApiKey(""); setTestResult(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!apiKey.trim() || !selectedModel || isSaving || (provider.requiresBaseUrl && !baseUrl.trim())}
                className="flex-1"
              >
                {isSaving && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
