import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../../../server/neo4j";
import { mergePersonRecords } from "../../../../../../server/personService";
import { isValidUUID } from "../../../../../../server/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; mergeId: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { id, mergeId } = await params;
    if (!isValidUUID(id) || !isValidUUID(mergeId)) {
      return NextResponse.json(
        { errors: ["id and mergeId must be valid UUIDs"] },
        { status: 400 }
      );
    }
    const result = await mergePersonRecords(id, mergeId);
    if (!result) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error merging records:", err);
    return NextResponse.json(
      { error: "Failed to merge records" },
      { status: 500 }
    );
  }
}
