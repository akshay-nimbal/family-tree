import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../server/neo4j";
import { searchPersons } from "../../../../server/personService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const q = req.nextUrl.searchParams.get("q") || "";
    if (q.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }
    const family = req.nextUrl.searchParams.get("family") || undefined;
    const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") || "10", 10);
    const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 10, 50);
    const results = await searchPersons(q, family, limit);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Error searching persons:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
