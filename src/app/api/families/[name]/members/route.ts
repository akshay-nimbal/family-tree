import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../../server/neo4j";
import { getFamilyMembers } from "../../../../../server/personService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureSchema();
    const { name } = await params;
    const decoded = decodeURIComponent(name);
    const members = await getFamilyMembers(decoded);
    return NextResponse.json(members);
  } catch (err) {
    console.error("Error fetching family members:", err);
    return NextResponse.json(
      { error: "Failed to fetch family members" },
      { status: 500 }
    );
  }
}
