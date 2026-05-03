import { NextResponse } from "next/server";
import { ensureSchema } from "../../../server/neo4j";
import { getAllFamilies } from "../../../server/personService";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSchema();
    const families = await getAllFamilies();
    return NextResponse.json(families);
  } catch (err) {
    console.error("Error fetching families:", err);
    return NextResponse.json(
      { error: "Failed to fetch families" },
      { status: 500 }
    );
  }
}
