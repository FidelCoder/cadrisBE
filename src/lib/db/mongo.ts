import { MongoClient } from "mongodb";
import { getServerEnv } from "@/lib/config/env";
import type { ProjectStatus, RecordingMode, FramingStyle, ShotType } from "@/lib/domain/cadris";

export interface RecordingDocument {
  id: string;
  projectId: string;
  originalVideoUrl: string;
  directedPreviewVideoUrl: string | null;
  durationMs: number;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShotEventDocument {
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
  createdAt: Date;
}

export interface ProjectDocument {
  id: string;
  userId: string | null;
  title: string;
  mode: RecordingMode;
  style: FramingStyle;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  recordings: RecordingDocument[];
  shotEvents: ShotEventDocument[];
}

const globalForMongo = globalThis as unknown as {
  mongoClient?: MongoClient;
  mongoClientPromise?: Promise<MongoClient>;
  mongoIndexesPromise?: Promise<void>;
};

function getMongoConfig() {
  const env = getServerEnv();

  return {
    uri: env.mongodbUri,
    dbName: env.mongodbDbName
  };
}

function createMongoClient() {
  const { uri } = getMongoConfig();
  return new MongoClient(uri, {
    ignoreUndefined: true
  });
}

async function getMongoClient() {
  if (globalForMongo.mongoClient) {
    return globalForMongo.mongoClient;
  }

  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = createMongoClient().connect();
  }

  const client = await globalForMongo.mongoClientPromise;
  globalForMongo.mongoClient = client;
  return client;
}

async function ensureIndexes() {
  if (!globalForMongo.mongoIndexesPromise) {
    globalForMongo.mongoIndexesPromise = (async () => {
      const client = await getMongoClient();
      const { dbName } = getMongoConfig();
      const collection = client.db(dbName).collection<ProjectDocument>("projects");
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ updatedAt: -1 });
    })();
  }

  await globalForMongo.mongoIndexesPromise;
}

export async function getProjectsCollection() {
  const client = await getMongoClient();
  await ensureIndexes();
  const { dbName } = getMongoConfig();
  return client.db(dbName).collection<ProjectDocument>("projects");
}
