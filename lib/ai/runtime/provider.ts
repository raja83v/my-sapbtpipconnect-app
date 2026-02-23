import OpenAI from "openai";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import type { AIError, AIModelKind, AIProvider } from "./types";
import {
  getModelForKind,
  GOOGLE_DEFAULT_MODEL,
  GOOGLE_FAST_MODEL,
  GOOGLE_ORCHESTRATOR_MODEL,
} from "./models";

function getDefaultProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "llmlite").toLowerCase();
  return provider === "google" ? "google" : "llmlite";
}

export function resolveProvider(providerOverride?: AIProvider): AIProvider {
  return providerOverride || getDefaultProvider();
}

export function getGoogleModelForKind(kind: AIModelKind = "default") {
  if (kind === "fast") return google(GOOGLE_FAST_MODEL);
  if (kind === "orchestrator") return google(GOOGLE_ORCHESTRATOR_MODEL);
  return google(GOOGLE_DEFAULT_MODEL);
}

export function getGoogleModelNameForKind(kind: AIModelKind = "default") {
  if (kind === "fast") return GOOGLE_FAST_MODEL;
  if (kind === "orchestrator") return GOOGLE_ORCHESTRATOR_MODEL;
  return GOOGLE_DEFAULT_MODEL;
}

export function getOpenAIModelForKind(kind: AIModelKind = "default") {
  return getModelForKind(kind);
}

export function createLLMLiteClient() {
  const baseURL = process.env.LLMLITE_BASE_URL;
  const apiKey = process.env.LLMLITE_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "LLMLite is not configured. Set LLMLITE_BASE_URL and LLMLITE_API_KEY."
    );
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

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
