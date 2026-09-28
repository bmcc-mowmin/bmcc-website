import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

// Uploaded files (timetable PDFs now, event photos later). Local folder in development,
// any S3-compatible bucket in production — chosen by STORAGE_DRIVER. Keys look like
// "timetables/2026-10.pdf" and never contain user-supplied path segments.

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;
function checkKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Unsafe storage key: ${key}`);
  return key;
}

const local: Storage = {
  async put(key, body) {
    const file = path.resolve(env.UPLOAD_DIR, checkKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  },
  async get(key) {
    try {
      return await readFile(path.resolve(env.UPLOAD_DIR, checkKey(key)));
    } catch {
      return null;
    }
  },
  async remove(key) {
    await rm(path.resolve(env.UPLOAD_DIR, checkKey(key)), { force: true });
  },
};

function s3(): Storage {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  const Bucket = env.S3_BUCKET!;
  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: checkKey(key), Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: checkKey(key) }));
        return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
      } catch {
        return null;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: checkKey(key) }));
    },
  };
}

export const storage: Storage = env.STORAGE_DRIVER === "s3" ? s3() : local;
