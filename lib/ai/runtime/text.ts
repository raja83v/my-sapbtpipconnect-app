import { generateText } from "ai";
import type { AITextRequest, AITextResponse, AIUsage } from "./types";
import {
  createLLMLiteClient,
  createClaudeClient,
  getOpenAIModelForKind,
  getGoogleModelForKind,
  ensureConfig,
  resolveProviderAsync,
  resolveProvider,
  runGoogleFallback,
  toAIError,
} from "./provider";
import { getModelForKind } from "./models";

function normalizeUsageFromOpenAI(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): AIUsage {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  const totalTokens = usage?.total_tokens || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function normalizeUsageFromAISDK(usage?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): AIUsage {
  const inputTokens = usage?.inputTokens || 0;
  const outputTokens = usage?.outputTokens || 0;
  const totalTokens = usage?.totalTokens || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

export async function runText(request: AITextRequest): Promise<AITextResponse> {
  await ensureConfig();
  const provider = await resolveProviderAsync(request.providerOverride);
  const modelKind = request.modelKind || "default";

  // Google / Gemini path
  if (provider === "google" || provider === "gemini") {
    const result = await runGoogleFallback({
      prompt: request.prompt,
      system: request.system,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      modelKind,
    });
    return {
      text: result.text,
      usage: normalizeUsageFromAISDK(result.usage),
      provider,
      model: getModelForKind(modelKind),
    };
  }

  // Claude (Anthropic) path
  if (provider === "claude") {
    const anthropic = await createClaudeClient();
    const model = getModelForKind(modelKind);
    const result = await generateText({
      model: anthropic(model),
      system: request.system,
      prompt: request.prompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    return {
      text: result.text,
      usage: normalizeUsageFromAISDK(result.usage),
      provider: "claude",
      model,
    };
  }

  // OpenAI / LiteLLM path (OpenAI-compatible)
  try {
    const client = createLLMLiteClient();
    const model = getOpenAIModelForKind(modelKind);
    const completion = await client.chat.completions.create({
      model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages: [
        ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
        { role: "user" as const, content: request.prompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return {
      text,
      usage: normalizeUsageFromOpenAI(completion.usage),
      provider,
      model,
    };
  } catch (error) {
    const aiError = toAIError(provider, error);
    if (aiError.retryable && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const fallback = await runGoogleFallback({
        prompt: request.prompt,
        system: request.system,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        modelKind,
      });
      return {
        text: fallback.text,
        usage: normalizeUsageFromAISDK(fallback.usage),
        provider: "google",
        model: "google-fallback",
      };
    }
    throw aiError;
  }
}

