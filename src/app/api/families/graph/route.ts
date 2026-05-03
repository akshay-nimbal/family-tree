import { NextResponse } from "next/server";
import { ensureSchema } from "../../../../server/neo4j";
import { getFullGraph } from "../../../../server/personService";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSchema();
    const graph = await getFullGraph();
    return NextResponse.json(graph);
  } catch (err) {
    console.error("Error fetching graph:", err);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}
