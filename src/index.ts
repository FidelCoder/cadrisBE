import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import multer from "multer";
import { getProjectInsights } from "@/lib/ai/insights";
import { getLocalLlmHealth, probeLocalLlm } from "@/lib/ai/provider";
import { getServerEnv } from "@/lib/config/env";
import { projectStatuses, type ProjectStatus } from "@/lib/domain/cadris";
import { createWriteRateLimit } from "@/lib/http/rate-limit";
import { buildExportPreview, createProject, getProjectById, listProjects, persistProjectRecording, updateProjectStatus } from "@/lib/projects/service";
import { getStorageAdapter } from "@/lib/storage";

const env = getServerEnv();
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1_024 * 1_024 * 1_024
  }
});

app.set("trust proxy", true);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedCorsOrigins.includes("*") || env.allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use((request, response, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();

  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);

  response.on("finish", () => {
    const logEvent = {
      level: response.statusCode >= 500 ? "error" : "info",
      event: "request.completed",
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      ip: request.ip
    };

    console.log(JSON.stringify(logEvent));
  });

  next();
});
app.use(
  createWriteRateLimit({
    windowMs: env.rateLimitWindowMs,
    maxRequests: env.rateLimitMaxWriteRequests
  })
);

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "cadris-backend",
    version: env.appVersion,
    release: env.appRelease,
    environment: env.appEnv,
    timestamp: new Date().toISOString(),
    storage: getStorageAdapter().getRuntimeSummary(),
    ai: {
      localLlmEnabled: env.enableLocalLlm,
      baseUrl: env.enableLocalLlm ? env.localLlmBaseUrl : null,
      model: env.enableLocalLlm ? env.localLlmModel : null
    },
    cors: {
      allowedOrigins: env.allowedCorsOrigins
    },
    limits: {
      writeRequests: {
        windowMs: env.rateLimitWindowMs,
        max: env.rateLimitMaxWriteRequests
      }
    }
  });
});

app.get("/api/ai/health", async (_request, response) => {
  const health = await getLocalLlmHealth();
  response.json(health);
});

app.post("/api/ai/probe", async (_request, response) => {
  const health = await getLocalLlmHealth();

  if (!health.configured) {
    response.status(503).json({
      error: "Local LLM support is disabled for this deployment.",
      health
    });
    return;
  }

  if (!health.reachable || !health.availableModels.includes(health.model)) {
    response.status(503).json({
      error: "Configured Ollama model is not ready.",
      health
    });
    return;
  }

  response.json(await probeLocalLlm());
});

app.get("/api/projects", async (_request, response) => {
  const projects = await listProjects();
  response.json(projects);
});

app.post("/api/projects", async (request, response) => {
  const project = await createProject(request.body);
  response.status(201).json({ project });
});

app.get("/api/projects/:projectId", async (request, response) => {
  const project = await getProjectById(String(request.params.projectId));

  if (!project) {
    response.status(404).json({ error: "Project not found" });
    return;
  }

  response.json(project);
});

app.patch("/api/projects/:projectId", async (request, response) => {
  const status = request.body?.status;
  const normalizedStatus = typeof status === "string" ? (status.toLowerCase() as ProjectStatus) : null;
  const allowedStatuses = new Set(projectStatuses);

  if (!normalizedStatus || !allowedStatuses.has(normalizedStatus)) {
    response.status(400).json({ error: "A valid status is required" });
    return;
  }

  const project = await updateProjectStatus(String(request.params.projectId), normalizedStatus);
  if (!project) {
    response.status(404).json({ error: "Project not found" });
    return;
  }
  response.json({ project });
});

app.post(
  "/api/projects/:projectId/recordings",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "directedVideo", maxCount: 1 }
  ]),
  async (request, response) => {
  const uploadedFiles = request.files as
    | {
        video?: Express.Multer.File[];
        directedVideo?: Express.Multer.File[];
      }
    | undefined;
  const rawVideo = uploadedFiles?.video?.[0];
  const directedVideo = uploadedFiles?.directedVideo?.[0];

  if (!rawVideo) {
    response.status(400).json({ error: "Video file is required" });
    return;
  }

  const result = await persistProjectRecording(String(request.params.projectId), {
    fileName: rawVideo.originalname,
    mimeType: rawVideo.mimetype,
    body: rawVideo.buffer,
    directedPreview: directedVideo
      ? {
          fileName: directedVideo.originalname,
          mimeType: directedVideo.mimetype,
          body: directedVideo.buffer
        }
      : null,
    durationMs: Number(request.body.durationMs || 0),
    metadataJson: request.body.metadataJson,
    shotEventsJson: request.body.shotEventsJson
  });

  response.status(201).json(result);
});

app.post("/api/projects/:projectId/export", async (request, response) => {
  const preview = await buildExportPreview(String(request.params.projectId));

  if (!preview) {
    response.status(404).json({ error: "Project not found" });
    return;
  }

  response.json(preview);
});

app.post("/api/projects/:projectId/insights", async (request, response) => {
  const result = await getProjectInsights(String(request.params.projectId));

  if (!result) {
    response.status(404).json({ error: "Project not found" });
    return;
  }

  response.json(result);
});

app.get("/api/storage/*", async (request, response) => {
  const assetPath = request.path.replace(/^\/api\/storage\//, "");
  const asset = await getStorageAdapter().readAsset(assetPath);

  if (!asset) {
    response.status(404).json({ error: "Asset not found" });
    return;
  }

  response.setHeader("Content-Type", asset.contentType);
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.send(asset.body);
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const statusCode = message.includes("not allowed by CORS") ? 403 : 500;

  console.error(
    JSON.stringify({
      level: "error",
      event: "request.failed",
      requestId: response.locals.requestId ?? null,
      message
    })
  );

  response.status(statusCode).json({
    requestId: response.locals.requestId ?? null,
    error: error instanceof Error ? error.message : "Unexpected server error"
  });
});

app.listen(env.port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "server.started",
      service: "cadris-backend",
      environment: env.appEnv,
      url: `http://localhost:${env.port}`,
      storageProvider: getStorageAdapter().provider,
      localLlmEnabled: env.enableLocalLlm
    })
  );
});
