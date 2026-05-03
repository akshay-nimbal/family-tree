import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../../../server/neo4j";
import { findRelationshipPaths } from "../../../../../../server/personService";
import { isValidUUID } from "../../../../../../server/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; otherId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { id, otherId } = await params;
    if (!isValidUUID(id) || !isValidUUID(otherId)) {
      return NextResponse.json(
        { errors: ["id and otherId must be valid UUIDs"] },
        { status: 400 }
      );
    }
    const paths = await findRelationshipPaths(id, otherId);
    return NextResponse.json(paths);
  } catch (err) {
    console.error("Error finding paths:", err);
    return NextResponse.json(
      { error: "Failed to find relationship paths" },
      { status: 500 }
    );
  }
}
