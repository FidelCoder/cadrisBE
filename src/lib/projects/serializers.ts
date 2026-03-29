import type { ProjectDetail } from "@/lib/domain/cadris";
import type { ProjectDocument } from "@/lib/db/mongo";

export function serializeProject(project: ProjectDocument): ProjectDetail {
  return {
    id: project.id,
    userId: project.userId,
    title: project.title,
    mode: project.mode,
    style: project.style,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    recordings: [...project.recordings]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((recording) => ({
        ...recording,
        directedPreviewVideoUrl: recording.directedPreviewVideoUrl ?? null,
        createdAt: recording.createdAt.toISOString(),
        updatedAt: recording.updatedAt.toISOString()
      })),
    shotEvents: [...project.shotEvents]
      .sort((left, right) => left.timestampMs - right.timestampMs)
      .map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
      }))
  };
}
