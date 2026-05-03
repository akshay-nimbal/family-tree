import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../../server/neo4j";
import { getPersonRelationships } from "../../../../../server/personService";
import { isValidUUID } from "../../../../../server/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { errors: ["id must be a valid UUID"] },
        { status: 400 }
      );
    }
    const relationships = await getPersonRelationships(id);
    return NextResponse.json(relationships);
  } catch (err) {
    console.error("Error fetching relationships:", err);
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
      { status: 500 }
    );
  }
}
