import type { AIStreamRequest, AIStreamResponse } from "./types";
import {
  createLLMLiteClient,
  getOpenAIModelForKind,
  resolveProvider,
  toAIError,
} from "./provider";
import { runText } from "./text";

function chunkText(text: string, size = 64): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function runStreamText(
  request: AIStreamRequest
): Promise<AIStreamResponse> {
  const provider = resolveProvider(request.providerOverride);
  const modelKind = request.modelKind || "default";

  if (provider === "google") {
    const fallback = await runText({ ...request, providerOverride: "google" });
    const chunks = chunkText(fallback.text, request.chunkSize || 64);
    return {
      textStream: (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })(),
      provider: "google",
      model: fallback.model,
    };
  }

  try {
    const client = createLLMLiteClient();
    const model = getOpenAIModelForKind(modelKind);
    const stream = await client.chat.completions.create({
      model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
      messages: [
        ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
        { role: "user" as const, content: request.prompt },
      ],
    });

    return {
      textStream: (async function* () {
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      })(),
      provider: "llmlite",
      model,
    };
  } catch (error) {
    const aiError = toAIError("llmlite", error);
    if (aiError.retryable && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const fallback = await runText({ ...request, providerOverride: "google" });
      const chunks = chunkText(fallback.text, request.chunkSize || 64);
      return {
        textStream: (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
        provider: "google",
        model: fallback.model,
      };
    }
    throw aiError;
  }
}

