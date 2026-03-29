export const recordingModes = ["podcast", "interview"] as const;
export const framingStyles = ["calm", "dynamic"] as const;
export const projectStatuses = ["draft", "recording", "processing", "ready", "exported"] as const;
export const shotTypes = ["wide", "medium", "close"] as const;

export type RecordingMode = (typeof recordingModes)[number];
export type FramingStyle = (typeof framingStyles)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export type ShotType = (typeof shotTypes)[number];

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DirectorFrameDimensions {
  width: number;
  height: number;
}

export interface ProjectSummary {
  id: string;
  userId: string | null;
  title: string;
  mode: RecordingMode;
  style: FramingStyle;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingSummary {
  id: string;
  projectId: string;
  originalVideoUrl: string;
  directedPreviewVideoUrl: string | null;
  durationMs: number;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ShotEventSummary {
  id: string;
  projectId: string;
  timestampMs: number;
  shotType: ShotType;
  targetTrackId: string | null;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  confidence: number;
  notes: string | null;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  recordings: RecordingSummary[];
  shotEvents: ShotEventSummary[];
}
