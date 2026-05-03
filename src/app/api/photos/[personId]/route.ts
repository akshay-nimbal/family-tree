import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSchema, getSession } from "../../../../server/neo4j";
import { isValidUUID } from "../../../../server/validation";
import {
  MAX_FILE_SIZE,
  ALLOWED_MIME,
  extensionFor,
  ensureUploadsDir,
} from "../../../../server/uploads";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ personId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { personId } = await params;
    if (!isValidUUID(personId)) {
      return NextResponse.json(
        { error: "personId must be a valid UUID" },
        { status: 400 }
      );
    }

    // Parse multipart/form-data via the Web FormData API (Next.js handles
    // streaming internally — no multer, no intermediate library).
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No photo file provided" },
        { status: 400 }
      );
    }

    // Validate size and MIME type before writing anything to disk.
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5 MB limit" },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    // Derive extension from the validated MIME type so a user-supplied
    // filename cannot smuggle an extension onto disk.
    const ext = extensionFor(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported image type" },
        { status: 400 }
      );
    }

    const safeName = randomUUID() + ext;
    const dir = await ensureUploadsDir();
    const dest = path.join(dir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buffer);

    const photoUrl = `/uploads/${safeName}`;

    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (p:Person {id: $id})
         SET p.photoUrl = $photoUrl, p.updatedAt = $now
         RETURN p.id AS id`,
        { id: personId, photoUrl, now: new Date().toISOString() }
      );
      if (result.records.length === 0) {
        // Person vanished between validation and write — clean up the file.
        await fs.unlink(dest).catch(() => void 0);
        return NextResponse.json(
          { error: "Person not found" },
          { status: 404 }
        );
      }
    } finally {
      await session.close();
    }

    return NextResponse.json({ photoUrl });
  } catch (err) {
    console.error("Error uploading photo:", err);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}
