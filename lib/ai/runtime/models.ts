import type { AIModelKind } from "./types";

export function getModelForKind(kind: AIModelKind = "default"): string {
  const defaultModel = process.env.LLMLITE_MODEL_DEFAULT || "gpt-4.1-mini";
  const fastModel = process.env.LLMLITE_MODEL_FAST || "gpt-4.1-nano";
  const orchestratorModel =
    process.env.LLMLITE_MODEL_ORCHESTRATOR || "gpt-4.1-mini";

  if (kind === "fast") return fastModel;
  if (kind === "orchestrator") return orchestratorModel;
  return defaultModel;
}

export const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash";
export const GOOGLE_FAST_MODEL = "gemini-2.5-flash-lite";
export const GOOGLE_ORCHESTRATOR_MODEL = "gemini-2.5-flash-lite";

