import type { ZodTypeAny } from "zod";

export type AIProvider = "llmlite" | "google";

export type AIModelKind = "default" | "fast" | "orchestrator";

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIError extends Error {
  provider: AIProvider;
  code?: string;
  retryable: boolean;
  status?: number;
}

export interface AITextRequest {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  modelKind?: AIModelKind;
  providerOverride?: AIProvider;
}

export interface AITextResponse {
  text: string;
  usage: AIUsage;
  provider: AIProvider;
  model: string;
}

export interface AIStreamRequest extends AITextRequest {
  chunkSize?: number;
}

export interface AIStreamResponse {
  textStream: AsyncIterable<string>;
  provider: AIProvider;
  model: string;
}

export interface AIToolDefinition {
  description: string;
  parameters: ZodTypeAny | Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface AIToolRequest extends AITextRequest {
  tools: Record<string, AIToolDefinition>;
  maxToolRounds?: number;
}

export interface AIToolCallRecord {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AIToolResponse extends AITextResponse {
  toolCalls: AIToolCallRecord[];
}

