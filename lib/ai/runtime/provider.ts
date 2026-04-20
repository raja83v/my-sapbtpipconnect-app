import OpenAI from "openai";
import { generateText } from "ai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIError, AIModelKind, AIProvider } from "./types";
import {
  getModelForKind,
  setDBModels,
  GOOGLE_DEFAULT_MODEL,
  GOOGLE_FAST_MODEL,
  GOOGLE_ORCHESTRATOR_MODEL,
} from "./models";
import type { AIConfigInternal } from "@/lib/ai-config";

// ============================================================================
// Cached DB config — loaded once per request via ensureConfig()
// ============================================================================

let _cachedConfig: AIConfigInternal | null | undefined = undefined; // undefined = not loaded yet

async function loadDBConfig(): Promise<AIConfigInternal | null> {
  try {
    const { getAIConfigurationInternal } = await import("@/lib/ai-config");
    return await getAIConfigurationInternal();
  } catch {
    return null;
  }
}

export async function ensureConfig(): Promise<AIConfigInternal | null> {
  if (_cachedConfig === undefined) {
    _cachedConfig = await loadDBConfig();
    if (_cachedConfig) {
      setDBModels({
        default: _cachedConfig.defaultModel,
        fast: _cachedConfig.fastModel,
        orchestrator: _cachedConfig.orchestratorModel,
      });
    }
  }
  return _cachedConfig;
}

/** Reset cache (useful after config change) */
export function resetProviderCache() {
  _cachedConfig = undefined;
}

// ============================================================================
// Provider resolution
// ============================================================================

function getDefaultProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "llmlite").toLowerCase();
  return provider === "google" ? "google" : "llmlite";
}

export async function resolveProviderAsync(providerOverride?: AIProvider): Promise<AIProvider> {
  if (providerOverride) return providerOverride;
  const config = await ensureConfig();
  if (config) return config.provider as AIProvider;
  return getDefaultProvider();
}

/** Sync version — uses cached value or falls back to env */
export function resolveProvider(providerOverride?: AIProvider): AIProvider {
  if (providerOverride) return providerOverride;
  if (_cachedConfig) return _cachedConfig.provider as AIProvider;
  return getDefaultProvider();
}

// ============================================================================
// Google helpers
// ============================================================================

export function getGoogleModelForKind(kind: AIModelKind = "default") {
  // If DB config is for gemini, use its models with its API key
  if (_cachedConfig?.provider === "gemini") {
    const g = createGoogleGenerativeAI({ apiKey: _cachedConfig.apiKey });
    const model = getModelForKind(kind);
    return g(model);
  }
  if (kind === "fast") return google(GOOGLE_FAST_MODEL);
  if (kind === "orchestrator") return google(GOOGLE_ORCHESTRATOR_MODEL);
  return google(GOOGLE_DEFAULT_MODEL);
}

export function getGoogleModelNameForKind(kind: AIModelKind = "default") {
  if (_cachedConfig?.provider === "gemini") {
    return getModelForKind(kind);
  }
  if (kind === "fast") return GOOGLE_FAST_MODEL;
  if (kind === "orchestrator") return GOOGLE_ORCHESTRATOR_MODEL;
  return GOOGLE_DEFAULT_MODEL;
}

// ============================================================================
// OpenAI-compatible client (LiteLLM, OpenAI direct)
// ============================================================================

export function getOpenAIModelForKind(kind: AIModelKind = "default") {
  return getModelForKind(kind);
}

export function createLLMLiteClient(): OpenAI {
  // DB config for litellm or openai
  if (_cachedConfig && (_cachedConfig.provider === "litellm" || _cachedConfig.provider === "openai")) {
    return new OpenAI({
      apiKey: _cachedConfig.apiKey,
      baseURL: _cachedConfig.provider === "litellm" ? (_cachedConfig.baseUrl || undefined) : undefined,
    });
  }

  // Fallback to env vars
  const baseURL = process.env.LLMLITE_BASE_URL;
  const apiKey = process.env.LLMLITE_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "AI provider is not configured. Complete the AI setup in Settings or set LLMLITE_BASE_URL and LLMLITE_API_KEY."
    );
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

// ============================================================================
// Claude (Anthropic) client
// ============================================================================

export async function createClaudeClient() {
  if (!_cachedConfig || _cachedConfig.provider !== "claude") {
    throw new Error("Claude provider is not configured.");
  }
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  return createAnthropic({ apiKey: _cachedConfig.apiKey });
}

// ============================================================================
// Error handling
// ============================================================================

export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { status?: number; code?: string };
  const status = maybe.status;
  const code = maybe.code || "";
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code.includes("timeout") ||
    code.includes("rate_limit")
  );
}

export function toAIError(provider: AIProvider, error: unknown): AIError {
  const err = error as {
    message?: string;
    code?: string;
    status?: number;
  };

  const aiError = new Error(
    err?.message || "AI provider call failed"
  ) as AIError;
  aiError.provider = provider;
  aiError.code = err?.code;
  aiError.status = err?.status;
  aiError.retryable = isRetryableError(error);
  return aiError;
}

export async function runGoogleFallback(params: {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  modelKind?: AIModelKind;
}) {
  return generateText({
    model: getGoogleModelForKind(params.modelKind || "default"),
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxTokens,
  });
}
