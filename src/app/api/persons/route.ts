import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../server/neo4j";
import { createPerson } from "../../../server/personService";
import { validatePersonInput } from "../../../server/validation";

// neo4j-driver needs the Node.js runtime (no Edge).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json().catch(() => null);
    const errors = validatePersonInput(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    const person = await createPerson(body);
    return NextResponse.json(person, { status: 201 });
  } catch (err) {
    console.error("Error creating person:", err);
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}
