export interface LocalLlmHealth {
  provider: "ollama";
  configured: boolean;
  reachable: boolean;
  fallbackAvailable: boolean;
  baseUrl: string;
  model: string;
  availableModels: string[];
  message: string;
}

export interface ProjectInsightResult {
  source: "ollama" | "fallback";
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  operatorNotes: string;
}
