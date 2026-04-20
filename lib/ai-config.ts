import { db } from "@/lib/db";
import { aiConfigurations } from "@/lib/db/schema";
import type { AIProvider } from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

// ============================================================================
// Types
// ============================================================================

export interface AIConfigInput {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  fastModel?: string;
  orchestratorModel?: string;
}

export interface AIConfigPublic {
  id: string;
  provider: AIProvider;
  baseUrl: string | null;
  defaultModel: string;
  fastModel: string | null;
  orchestratorModel: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfigInternal extends AIConfigPublic {
  apiKey: string; // decrypted
}

// ============================================================================
// Provider model catalogs
// ============================================================================

export const PROVIDER_MODELS: Record<AIProvider, { label: string; models: { value: string; label: string; recommended?: boolean }[] }> = {
  litellm: {
    label: "LiteLLM",
    models: [
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", recommended: true },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", recommended: true },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "o4-mini", label: "o4-mini" },
    ],
  },
  claude: {
    label: "Claude (Anthropic)",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", recommended: true },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
    ],
  },
  gemini: {
    label: "Gemini (Google)",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", recommended: true },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
};

export const PROVIDER_INFO: Record<AIProvider, { label: string; description: string; requiresBaseUrl: boolean }> = {
  litellm: {
    label: "LiteLLM",
    description: "OpenAI-compatible proxy supporting 100+ models. Self-hosted or cloud.",
    requiresBaseUrl: true,
  },
  openai: {
    label: "OpenAI",
    description: "Direct OpenAI API. GPT-4.1 family models.",
    requiresBaseUrl: false,
  },
  claude: {
    label: "Claude (Anthropic)",
    description: "Direct Anthropic API. Claude Sonnet, Opus, and Haiku models.",
    requiresBaseUrl: false,
  },
  gemini: {
    label: "Gemini (Google)",
    description: "Google AI SDK. Gemini 2.5 family models.",
    requiresBaseUrl: false,
  },
};

// ============================================================================
// Database operations
// ============================================================================

/**
 * Get the active AI configuration (public — no decrypted key)
 */
export async function getAIConfiguration(): Promise<AIConfigPublic | null> {
  const config = await db.query.aiConfigurations.findFirst({
    where: eq(aiConfigurations.isActive, true),
    orderBy: desc(aiConfigurations.updatedAt),
  });

  if (!config) return null;

  return {
    id: config.id,
    provider: config.provider,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    fastModel: config.fastModel,
    orchestratorModel: config.orchestratorModel,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Get the active AI configuration with decrypted API key (internal use only)
 */
export async function getAIConfigurationInternal(): Promise<AIConfigInternal | null> {
  const config = await db.query.aiConfigurations.findFirst({
    where: eq(aiConfigurations.isActive, true),
    orderBy: desc(aiConfigurations.updatedAt),
  });

  if (!config) return null;

  const decryptedKey = await decrypt(config.apiKey);

  return {
    id: config.id,
    provider: config.provider,
    apiKey: decryptedKey,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    fastModel: config.fastModel,
    orchestratorModel: config.orchestratorModel,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Save AI configuration (deactivates previous configs, encrypts key)
 */
export async function setAIConfiguration(input: AIConfigInput): Promise<AIConfigPublic> {
  const encryptedKey = await encrypt(input.apiKey);

  // Deactivate all existing configs, then create new one
  const config = await db.transaction(async (tx) => {
    await tx.update(aiConfigurations).set({ isActive: false }).where(eq(aiConfigurations.isActive, true));

    const [created] = await tx.insert(aiConfigurations).values({
      provider: input.provider,
      apiKey: encryptedKey,
      baseUrl: input.baseUrl || null,
      defaultModel: input.defaultModel,
      fastModel: input.fastModel || null,
      orchestratorModel: input.orchestratorModel || null,
      isActive: true,
    }).returning();

    return created;
  });

  return {
    id: config.id,
    provider: config.provider,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    fastModel: config.fastModel,
    orchestratorModel: config.orchestratorModel,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Test connectivity to an AI provider with given credentials
 */
export async function testAIConnection(
  provider: AIProvider,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case "litellm": {
        // If no model specified, verify connectivity via /models endpoint
        if (!model) {
          const modelsUrl = baseUrl
            ? `${baseUrl.replace(/\/+$/, "")}/models`
            : "http://localhost:4000/v1/models";
          const res = await fetch(modelsUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return { success: false, error: `LiteLLM returned ${res.status}: ${text}`.trim() };
          }
          return { success: true };
        }
        // With a model, do a chat completion test
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey, baseURL: baseUrl });
        await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: "Say hi" }],
          max_tokens: 5,
        });
        return { success: true };
      }

      case "openai": {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey });
        await client.chat.completions.create({
          model: model || "gpt-4.1-mini",
          messages: [{ role: "user", content: "Say hi" }],
          max_tokens: 5,
        });
        return { success: true };
      }

      case "claude": {
        const { generateText } = await import("ai");
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        const anthropic = createAnthropic({ apiKey });
        await generateText({
          model: anthropic(model || "claude-sonnet-4-20250514"),
          prompt: "Say hi",
          maxTokens: 5,
        });
        return { success: true };
      }

      case "gemini": {
        const { generateText } = await import("ai");
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        const google = createGoogleGenerativeAI({ apiKey });
        await generateText({
          model: google(model || "gemini-2.5-flash"),
          prompt: "Say hi",
          maxTokens: 5,
        });
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    return { success: false, error: message };
  }
}
