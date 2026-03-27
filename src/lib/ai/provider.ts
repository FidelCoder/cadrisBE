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
  return (process.env.LOCAL_LLM_BASE_URL || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function getModel() {
  return process.env.LOCAL_LLM_MODEL || process.env.OLLAMA_MODEL || "llama3.2:1b";
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

export async function getLocalLlmHealth(): Promise<LocalLlmHealth> {
  const baseUrl = getBaseUrl();
  const model = getModel();

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
      format: "json",
      options: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Local LLM request failed with ${response.status}.`);
  }

  const payload = await safeJson<OllamaGenerateResponse>(response);
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
