import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../server/neo4j";
import {
  getPersonById,
  updatePerson,
} from "../../../../server/personService";
import { isValidUUID } from "../../../../server/validation";

export const runtime = "nodejs";

// In Next.js 15 dynamic params arrive as a Promise and must be awaited.
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
    const person = await getPersonById(id);
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json(person);
  } catch (err) {
    console.error("Error fetching person:", err);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { errors: ["id must be a valid UUID"] },
        { status: 400 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const person = await updatePerson(id, body);
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }
    return NextResponse.json(person);
  } catch (err) {
    console.error("Error updating person:", err);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}
