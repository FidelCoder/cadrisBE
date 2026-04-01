import { getServerEnv } from "@/lib/config/env";
import type { LocalLlmHealth, ProjectInsightResult } from "@/lib/ai/types";

interface OllamaGenerateResponse {
  response: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

function getBaseUrl() {
  return getServerEnv().localLlmBaseUrl;
}

function getModel() {
  return getServerEnv().localLlmModel;
}

async function safeJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Local LLM did not return JSON.");
  }

  return text.slice(start, end + 1);
}

async function ollamaGenerate(input: {
  prompt: string;
  format?: "json";
}) {
  const baseUrl = getBaseUrl();
  const model = getModel();

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      stream: false,
      ...(input.format ? { format: input.format } : {}),
      options: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Local LLM request failed with ${response.status}.`);
  }

  const payload = await safeJson<OllamaGenerateResponse>(response);

  return {
    baseUrl,
    model,
    response: String(payload.response || "").trim()
  };
}

export async function getLocalLlmHealth(): Promise<LocalLlmHealth> {
  const env = getServerEnv();
  const baseUrl = getBaseUrl();
  const model = getModel();

  if (!env.enableLocalLlm) {
    return {
      provider: "ollama",
      configured: false,
      reachable: false,
      fallbackAvailable: true,
      baseUrl,
      model,
      availableModels: [],
      message: "Local LLM support is disabled for this deployment."
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return {
        provider: "ollama",
        configured: true,
        reachable: false,
        fallbackAvailable: true,
        baseUrl,
        model,
        availableModels: [],
        message: `Ollama responded with ${response.status}. Built-in fallback review is still available for testing.`
      };
    }

    const payload = await safeJson<OllamaTagsResponse>(response);
    const availableModels = (payload.models || [])
      .map((entry) => entry.name || entry.model || "")
      .filter(Boolean);

    return {
      provider: "ollama",
      configured: true,
      reachable: availableModels.length > 0,
      fallbackAvailable: true,
      baseUrl,
      model,
      availableModels,
      message: availableModels.includes(model)
        ? "Local model is ready."
        : availableModels.length
          ? "Ollama is reachable but the configured model is not pulled yet."
          : "Ollama is reachable but no local models were reported."
    };
  } catch (error) {
    return {
      provider: "ollama",
      configured: true,
      reachable: false,
      fallbackAvailable: true,
      baseUrl,
      model,
      availableModels: [],
      message:
        error instanceof Error
          ? `${error.message} Built-in fallback review is still available for testing.`
          : "Ollama is not reachable. Built-in fallback review is still available for testing."
    };
  }
}

export async function generateLocalProjectInsights(input: {
  prompt: string;
}): Promise<ProjectInsightResult> {
  if (!getServerEnv().enableLocalLlm) {
    throw new Error("Local LLM support is disabled for this deployment.");
  }

  const payload = await ollamaGenerate({
    prompt: input.prompt,
    format: "json"
  });
  const rawJson = extractJsonObject(payload.response || "");
  const parsed = JSON.parse(rawJson) as Partial<ProjectInsightResult>;

  return {
    source: "ollama",
    summary: parsed.summary || "No summary returned.",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4).map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 4).map(String) : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 4).map(String) : [],
    operatorNotes: parsed.operatorNotes || "No operator notes returned."
  };
}

export async function probeLocalLlm() {
  if (!getServerEnv().enableLocalLlm) {
    throw new Error("Local LLM support is disabled for this deployment.");
  }

  const prompt = "What is 2 + 2? Reply with only the digit.";
  const payload = await ollamaGenerate({
    prompt
  });

  if (!payload.response) {
    throw new Error("Ollama returned an empty response.");
  }

  return {
    provider: "ollama" as const,
    baseUrl: payload.baseUrl,
    model: payload.model,
    prompt,
    response: payload.response,
    generatedAt: new Date().toISOString()
  };
}
