import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getProjectsCollection } from "@/lib/db/mongo";
import { framingStyles, projectStatuses, recordingModes } from "@/lib/domain/cadris";
import { serializeProject } from "@/lib/projects/serializers";
import { getStorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/utils";

const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .transform((value) => value || `Session ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`),
  mode: z.enum(recordingModes),
  style: z.enum(framingStyles)
});

const persistRecordingSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional().default("video/webm"),
  body: z.instanceof(Buffer),
  durationMs: z.coerce.number().int().nonnegative(),
  metadataJson: z.union([z.string(), z.record(z.any()), z.array(z.any())]).transform((value) =>
    typeof value === "string" ? (JSON.parse(value) as unknown) : value
  ),
  shotEventsJson: z
    .union([
      z.string(),
      z.array(
        z.object({
          timestampMs: z.number(),
          shotType: z.enum(["wide", "medium", "close"]),
          targetTrackId: z.string().nullable(),
          cropBox: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
          }),
          confidence: z.number(),
          notes: z.string().nullable()
        })
      )
    ])
    .transform((value) =>
      typeof value === "string"
        ? (JSON.parse(value) as Array<{
            timestampMs: number;
            shotType: "wide" | "medium" | "close";
            targetTrackId: string | null;
            cropBox: {
              x: number;
              y: number;
              width: number;
              height: number;
            };
            confidence: number;
            notes: string | null;
          }>)
        : value
    )
});

export async function listProjects() {
  const collection = await getProjectsCollection();
  const projects = await collection.find({}, { sort: { updatedAt: -1 } }).toArray();

  return projects.map(serializeProject);
}

export async function getProjectById(projectId: string) {
  const collection = await getProjectsCollection();
  const project = await collection.findOne({ id: projectId });

  return project ? serializeProject(project) : null;
}

export async function createProject(input: unknown) {
  const parsed = createProjectSchema.parse(input);
  const collection = await getProjectsCollection();
  const now = new Date();
  const project = {
    id: randomUUID(),
    userId: null,
    title: parsed.title,
    mode: parsed.mode,
    style: parsed.style,
    status: "draft" as const,
    createdAt: now,
    updatedAt: now,
    recordings: [],
    shotEvents: []
  };

  await collection.insertOne(project);

  return serializeProject(project);
}

export async function updateProjectStatus(projectId: string, status: (typeof projectStatuses)[number]) {
  const collection = await getProjectsCollection();
  const result = await collection.findOneAndUpdate(
    { id: projectId },
    {
      $set: {
        status,
        updatedAt: new Date()
      }
    },
    {
      returnDocument: "after"
    }
  );

  return result ? serializeProject(result) : null;
}

export async function persistProjectRecording(
  projectId: string,
  input: {
    fileName: string;
    mimeType?: string;
    body: Buffer;
    durationMs: number;
    metadataJson: unknown;
    shotEventsJson: unknown;
  }
) {
  const parsed = persistRecordingSchema.parse(input);
  const collection = await getProjectsCollection();
  const existingProject = await collection.findOne({ id: projectId });

  if (!existingProject) {
    throw new Error("Project not found.");
  }

  const storage = getStorageAdapter();
  const storedAsset = await storage.saveRecording({
    projectId,
    fileName: parsed.fileName || `${slugify(projectId)}.webm`,
    mimeType: parsed.mimeType,
    body: parsed.body
  });

  const now = new Date();
  const recording = {
    id: randomUUID(),
    projectId,
    originalVideoUrl: storedAsset.publicUrl,
    durationMs: parsed.durationMs,
    metadataJson: parsed.metadataJson,
    createdAt: now,
    updatedAt: now
  };

  const shotEvents = parsed.shotEventsJson.map((event) => ({
    id: randomUUID(),
    projectId,
    timestampMs: event.timestampMs,
    shotType: event.shotType,
    targetTrackId: event.targetTrackId,
    cropX: event.cropBox.x,
    cropY: event.cropBox.y,
    cropWidth: event.cropBox.width,
    cropHeight: event.cropBox.height,
    confidence: event.confidence,
    notes: event.notes,
    createdAt: now
  }));

  const nextProject = {
    ...existingProject,
    status: "ready" as const,
    updatedAt: now,
    recordings: [recording, ...existingProject.recordings].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    shotEvents: [...existingProject.shotEvents, ...shotEvents].sort((left, right) => left.timestampMs - right.timestampMs)
  };

  await collection.updateOne(
    { id: projectId },
    {
      $set: {
        status: nextProject.status,
        updatedAt: nextProject.updatedAt,
        recordings: nextProject.recordings,
        shotEvents: nextProject.shotEvents
      }
    }
  );

  return {
    project: serializeProject(nextProject),
    recordingId: recording.id
  };
}

export async function buildExportPreview(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    return null;
  }

  const segments = project.shotEvents.map((event, index) => {
    const nextEvent = project.shotEvents[index + 1];
    return {
      id: event.id,
      shotType: event.shotType,
      targetTrackId: event.targetTrackId,
      startsAtMs: event.timestampMs,
      endsAtMs: nextEvent?.timestampMs ?? project.recordings[0]?.durationMs ?? event.timestampMs + 3_000,
      confidence: event.confidence,
      notes: event.notes
    };
  });

  return {
    project,
    segments
  };
}
