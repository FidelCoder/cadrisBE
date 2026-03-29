import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { getProjectInsights } from "@/lib/ai/insights";
import { getLocalLlmHealth, probeLocalLlm } from "@/lib/ai/provider";
import { projectStatuses, type ProjectStatus } from "@/lib/domain/cadris";
import { buildExportPreview, createProject, getProjectById, listProjects, persistProjectRecording, updateProjectStatus } from "@/lib/projects/service";
import { getStorageAdapter } from "@/lib/storage";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1_024 * 1_024 * 1_024
  }
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) || "*"
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "cadris-backend"
  });
});

app.get("/api/ai/health", async (_request, response) => {
  const health = await getLocalLlmHealth();
  response.json(health);
});

app.post("/api/ai/probe", async (_request, response) => {
  const health = await getLocalLlmHealth();

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
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : "Unexpected server error"
  });
});

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Cadris backend listening on http://localhost:${port}`);
});
