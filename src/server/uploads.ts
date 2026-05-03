import path from "node:path";
import { promises as fs } from "node:fs";

// Centralised config so the POST handler and the GET "serve" handler agree on
// the same directory, size caps, and MIME-type allow-list.

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Extension is derived from the MIME type, not the user-supplied filename,
// so a malicious .php masquerading as image/jpeg can't land on disk as .php.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function extensionFor(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export function contentTypeFor(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export function uploadsDir(): string {
  const dir = process.env.UPLOADS_DIR || "uploads";
  // Resolve relative to next-app root (the cwd in `next dev` / `next start`).
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

export async function ensureUploadsDir(): Promise<string> {
  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a user-supplied path *segment* to an absolute path inside the
 * uploads directory. Returns null if the resulting path escapes the
 * directory (path-traversal attempt) or contains anything unsafe.
 */
export function safeUploadPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  // Reject any segment that is absolute, empty, or contains separators/\0.
  for (const seg of segments) {
    if (
      !seg ||
      seg.includes("\0") ||
      seg.includes("/") ||
      seg.includes("\\")
    ) {
      return null;
    }
  }
  const base = uploadsDir();
  const joined = path.join(base, ...segments);
  const resolved = path.resolve(joined);
  // The resolved path must still live inside the uploads dir.
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}
