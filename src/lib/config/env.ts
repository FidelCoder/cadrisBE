import path from "node:path";
import { z } from "zod";

function booleanFromEnv(value: unknown, defaultValue: boolean) {
  if (value == null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function csvFromEnv(value: unknown, fallback: string[]) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const rawEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  APP_ENV: z.string().optional(),
  APP_VERSION: z.string().optional(),
  APP_RELEASE: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  PUBLIC_API_ORIGIN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).optional(),
  STORAGE_LOCAL_ROOT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  ENABLE_LOCAL_LLM: z.string().optional(),
  LOCAL_LLM_BASE_URL: z.string().optional(),
  LOCAL_LLM_MODEL: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX_WRITE_REQUESTS: z.coerce.number().int().positive().optional()
});

export interface ServerEnv {
  nodeEnv: string;
  appEnv: string;
  appVersion: string;
  appRelease: string | null;
  port: number;
  publicApiOrigin: string;
  allowedCorsOrigins: string[];
  mongodbUri: string;
  mongodbDbName: string;
  storageProvider: "local" | "s3";
  storageLocalRoot: string;
  s3Bucket: string | null;
  s3Region: string;
  s3Endpoint: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  s3PublicBaseUrl: string | null;
  s3ForcePathStyle: boolean;
  enableLocalLlm: boolean;
  localLlmBaseUrl: string;
  localLlmModel: string;
  rateLimitWindowMs: number;
  rateLimitMaxWriteRequests: number;
}

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const raw = rawEnvSchema.parse(process.env);
  const port = raw.PORT ?? 4000;
  const storageProvider = raw.STORAGE_PROVIDER ?? "local";
  const publicApiOrigin = (raw.PUBLIC_API_ORIGIN || `http://localhost:${port}`).replace(/\/$/, "");
  const allowedCorsOrigins = csvFromEnv(raw.CORS_ORIGIN, ["http://localhost:3000"]);
  const appVersion = raw.APP_VERSION || process.env.npm_package_version || "0.1.0";

  cachedEnv = {
    nodeEnv: raw.NODE_ENV || "development",
    appEnv: raw.APP_ENV || raw.NODE_ENV || "development",
    appVersion,
    appRelease: raw.APP_RELEASE || null,
    port,
    publicApiOrigin,
    allowedCorsOrigins,
    mongodbUri: raw.MONGODB_URI || "mongodb://127.0.0.1:27017",
    mongodbDbName: raw.MONGODB_DB_NAME || "cadris",
    storageProvider,
    storageLocalRoot: raw.STORAGE_LOCAL_ROOT
      ? path.resolve(process.cwd(), raw.STORAGE_LOCAL_ROOT)
      : path.join(process.cwd(), "storage"),
    s3Bucket: raw.S3_BUCKET || null,
    s3Region: raw.S3_REGION || "auto",
    s3Endpoint: raw.S3_ENDPOINT?.replace(/\/$/, "") || null,
    s3AccessKeyId: raw.S3_ACCESS_KEY_ID || null,
    s3SecretAccessKey: raw.S3_SECRET_ACCESS_KEY || null,
    s3PublicBaseUrl: raw.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") || null,
    s3ForcePathStyle: booleanFromEnv(raw.S3_FORCE_PATH_STYLE, true),
    enableLocalLlm: booleanFromEnv(raw.ENABLE_LOCAL_LLM, true),
    localLlmBaseUrl: (raw.LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    localLlmModel: raw.LOCAL_LLM_MODEL || "llama3.2:1b",
    rateLimitWindowMs: raw.RATE_LIMIT_WINDOW_MS ?? 60_000,
    rateLimitMaxWriteRequests: raw.RATE_LIMIT_MAX_WRITE_REQUESTS ?? 60
  };

  if (cachedEnv.storageProvider === "s3") {
    const missingKeys = [
      !cachedEnv.s3Bucket ? "S3_BUCKET" : null,
      !cachedEnv.s3Endpoint ? "S3_ENDPOINT" : null,
      !cachedEnv.s3AccessKeyId ? "S3_ACCESS_KEY_ID" : null,
      !cachedEnv.s3SecretAccessKey ? "S3_SECRET_ACCESS_KEY" : null
    ].filter(Boolean);

    if (missingKeys.length) {
      throw new Error(`S3 storage is enabled but missing required env vars: ${missingKeys.join(", ")}`);
    }
  }

  return cachedEnv;
}
