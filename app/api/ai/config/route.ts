import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/user";
import {
  getAIConfiguration,
  setAIConfiguration,
  testAIConnection,
} from "@/lib/ai-config";
import { resetProviderCache } from "@/lib/ai/runtime/provider";
import type { AIProvider } from "@/lib/db/schema";

const VALID_PROVIDERS: AIProvider[] = ["litellm", "openai", "claude", "gemini"];

function isValidProvider(p: unknown): p is AIProvider {
  return typeof p === "string" && VALID_PROVIDERS.includes(p as AIProvider);
}

/**
 * Check whether the user is allowed to modify AI configuration.
 * Admins always can; non-admins can during onboarding (before it's completed).
 */
function canConfigureAI(user: { role: string; onboardingCompleted: boolean }): boolean {
  return user.role === "admin" || !user.onboardingCompleted;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAIConfiguration();
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canConfigureAI(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { provider, apiKey, baseUrl, defaultModel, fastModel, orchestratorModel } = body;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  if (!defaultModel || typeof defaultModel !== "string") {
    return NextResponse.json({ error: "Default model is required" }, { status: 400 });
  }

  const config = await setAIConfiguration({
    provider,
    apiKey,
    baseUrl: typeof baseUrl === "string" ? baseUrl : undefined,
    defaultModel,
    fastModel: typeof fastModel === "string" ? fastModel : undefined,
    orchestratorModel: typeof orchestratorModel === "string" ? orchestratorModel : undefined,
  });

  resetProviderCache();

  return NextResponse.json({ config });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canConfigureAI(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "test") {
    const { provider, apiKey, baseUrl, model } = body;
    if (!isValidProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }
    const result = await testAIConnection(
      provider,
      apiKey,
      typeof baseUrl === "string" ? baseUrl : undefined,
      typeof model === "string" && model ? model : undefined,
    );

    // Fetch available models from the provider on successful test
    let models: { id: string; name: string }[] | undefined;
    if (result.success) {
      try {
        if (provider === "litellm" || provider === "openai") {
          // OpenAI-compatible /v1/models endpoint
          const modelsUrl = provider === "litellm" && baseUrl
            ? `${baseUrl.replace(/\/+$/, "")}/models`
            : "https://api.openai.com/v1/models";
          const modelsRes = await fetch(modelsUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.data && Array.isArray(modelsData.data)) {
              models = modelsData.data
                .map((m: { id: string }) => ({ id: m.id, name: m.id }))
                .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
            }
          }
        } else if (provider === "claude") {
          // Anthropic /v1/models endpoint
          const modelsRes = await fetch("https://api.anthropic.com/v1/models?limit=100", {
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            signal: AbortSignal.timeout(10000),
          });
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.data && Array.isArray(modelsData.data)) {
              models = modelsData.data
                .map((m: { id: string; display_name?: string }) => ({
                  id: m.id,
                  name: m.display_name || m.id,
                }))
                .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
            }
          }
        } else if (provider === "gemini") {
          // Google Generative AI /v1beta/models endpoint
          const modelsRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
            { signal: AbortSignal.timeout(10000) },
          );
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.models && Array.isArray(modelsData.models)) {
              models = modelsData.models
                .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
                  // Only include models that support content generation
                  m.supportedGenerationMethods?.includes("generateContent"),
                )
                .map((m: { name: string; displayName?: string }) => ({
                  // name is "models/gemini-2.5-flash" — strip the "models/" prefix
                  id: m.name.replace(/^models\//, ""),
                  name: m.displayName || m.name.replace(/^models\//, ""),
                }))
                .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
            }
          }
        }
      } catch {
        // Model listing is non-critical — ignore failures
      }
    }

    return NextResponse.json({ ...result, models });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
