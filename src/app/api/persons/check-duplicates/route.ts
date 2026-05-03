import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "../../../../server/neo4j";
import { checkDuplicates } from "../../../../server/personService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const name = req.nextUrl.searchParams.get("name") || "";
    if (name.length < 2) {
      return NextResponse.json(
        { error: "name must be at least 2 characters" },
        { status: 400 }
      );
    }
    const phone = req.nextUrl.searchParams.get("phone") || undefined;
    const email = req.nextUrl.searchParams.get("email") || undefined;
    const results = await checkDuplicates(name, phone, email);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Error checking duplicates:", err);
    return NextResponse.json(
      { error: "Duplicate check failed" },
      { status: 500 }
    );
  }
}
