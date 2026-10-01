import "server-only";
import { randomBytes } from "node:crypto";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The real file type from its first bytes (never trust the file name or browser-sent type).
export function detectImage(bytes: Buffer): { ext: "jpg" | "png" | "webp"; type: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (bytes.length > 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

// A new, unguessable key per upload, so URLs can be cached forever.
export function imageKey(prefix: string, ext: string) {
  return `${prefix}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
}
