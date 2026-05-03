import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { contentTypeFor, safeUploadPath } from "../../../server/uploads";

export const runtime = "nodejs";

// Replaces the Express `app.use("/uploads", express.static(...))` line. We
// validate the path segments to prevent traversal outside the uploads
// directory, then stream the file back with the correct content-type.
type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { path: segments } = await params;
  const resolved = safeUploadPath(segments);
  if (!resolved) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypeFor(resolved);
  if (!contentType) {
    // Only serve known image types — no arbitrary file types leak out.
    return new Response("Not found", { status: 404 });
  }

  let size: number;
  try {
    const s = await stat(resolved);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    size = s.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const nodeStream = createReadStream(resolved);
  const webStream = Readable.toWeb(nodeStream) as unknown as WebReadableStream<Uint8Array>;

  return new Response(webStream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      // Uploads are immutable once written (random UUID filename), so cache
      // aggressively. If the user replaces their photo, the Neo4j record
      // points at a new URL anyway.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
