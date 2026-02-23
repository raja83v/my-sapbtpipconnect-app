import { z } from "zod";
import type {
  AIToolCallRecord,
  AIToolRequest,
  AIToolResponse,
  AIUsage,
} from "./types";
import {
  createLLMLiteClient,
  getOpenAIModelForKind,
  getGoogleModelForKind,
  resolveProvider,
  toAIError,
} from "./provider";
import { generateText } from "ai";

function normalizeUsage(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): AIUsage {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  const totalTokens = usage?.total_tokens || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function normalizeUsageAI(usage?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): AIUsage {
  const inputTokens = usage?.inputTokens || 0;
  const outputTokens = usage?.outputTokens || 0;
  const totalTokens = usage?.totalTokens || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function toJsonSchema(schema: unknown) {
  if (!schema) return { type: "object", properties: {} };
  if (typeof schema === "object" && "_def" in (schema as Record<string, unknown>)) {
    return z.toJSONSchema(schema as z.ZodTypeAny);
  }
  return schema as Record<string, unknown>;
}

export async function runWithTools(
  request: AIToolRequest
): Promise<AIToolResponse> {
  const provider = resolveProvider(request.providerOverride);
  const modelKind = request.modelKind || "default";

  if (provider === "google") {
    const result = await generateText({
      model: getGoogleModelForKind(modelKind),
      system: request.system,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      tools: request.tools as any,
    });

    const toolCalls: AIToolCallRecord[] = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const toolCall of step.toolCalls) {
            const toolResult = step.toolResults?.find(
              (r: { toolCallId: string }) => r.toolCallId === toolCall.toolCallId
            );
            toolCalls.push({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args:
                ((toolCall as { args?: Record<string, unknown> }).args as Record<
                  string,
                  unknown
                >) || {},
              result: (toolResult as { result?: unknown })?.result,
            });
          }
        }
      }
    }

    return {
      text: result.text,
      usage: normalizeUsageAI(result.usage),
      provider: "google",
      model: "google-fallback",
      toolCalls,
    };
  }

  try {
    const client = createLLMLiteClient();
    const model = getOpenAIModelForKind(modelKind);
    const messages: Array<Record<string, unknown>> = [
      ...(request.system
        ? [{ role: "system" as const, content: request.system }]
        : []),
      { role: "user" as const, content: request.prompt },
    ];

    const tools = Object.entries(request.tools).map(([name, tool]) => ({
      type: "function" as const,
      function: {
        name,
        description: tool.description,
        parameters: toJsonSchema(tool.parameters),
      },
    }));

    const maxRounds = request.maxToolRounds || 5;
    const executedToolCalls: AIToolCallRecord[] = [];
    let finalText = "";
    let usage: AIUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for (let i = 0; i < maxRounds; i++) {
      const completion = await client.chat.completions.create({
        model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: messages as any,
        tools: tools as any,
        tool_choice: "auto",
      });

      const choice = completion.choices?.[0];
      const message = choice?.message;
      usage = normalizeUsage(completion.usage || {});

      const toolCalls = message?.tool_calls || [];
      if (toolCalls.length === 0) {
        finalText = message?.content || "";
        break;
      }

      messages.push({
        role: "assistant",
        content: message?.content || "",
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const fnCall = (toolCall as any).function as
          | { name?: string; arguments?: string }
          | undefined;
        const toolName = fnCall?.name || "";
        const tool = request.tools[toolName];
        if (!tool) continue;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(fnCall?.arguments || "{}");
        } catch {
          args = {};
        }

        const toolResult = await tool.execute(args);
        executedToolCalls.push({
          toolCallId: toolCall.id,
          toolName,
          args,
          result: toolResult,
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    return {
      text: finalText,
      usage,
      provider: "llmlite",
      model,
      toolCalls: executedToolCalls,
    };
  } catch (error) {
    const aiError = toAIError("llmlite", error);
    if (aiError.retryable && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const fallback = await generateText({
        model: getGoogleModelForKind(modelKind),
        system: request.system,
        prompt: request.prompt,
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        tools: request.tools as any,
      });
      return {
        text: fallback.text,
        usage: normalizeUsageAI(fallback.usage),
        provider: "google",
        model: "google-fallback",
        toolCalls: [],
      };
    }
    throw aiError;
  }
}
