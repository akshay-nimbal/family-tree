import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../server/neo4j";
import {
  createRelationship,
  removeRelationship,
} from "../../../../server/personService";
import { validateRelationshipInput } from "../../../../server/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json().catch(() => null);
    const errors = validateRelationshipInput(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    await createRelationship(body);
    return NextResponse.json(
      { message: "Relationship created" },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating relationship:", err);
    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json().catch(() => null);
    const errors = validateRelationshipInput(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    await removeRelationship(body.fromPersonId, body.toPersonId, body.type);
    return NextResponse.json({ message: "Relationship removed" });
  } catch (err) {
    console.error("Error removing relationship:", err);
    return NextResponse.json(
      { error: "Failed to remove relationship" },
      { status: 500 }
    );
  }
}
