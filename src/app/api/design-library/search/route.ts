// src/app/api/design-library/search/route.ts
// TEMPORARY, UNAUTHENTICATED test endpoint — for validating the
// retrieval loop only. Do NOT leave this open once real users can
// reach it; the real product wraps this same searchDesignPatterns
// call in the MCP protocol handler with Clerk OAuth (next step).

import { NextRequest, NextResponse } from "next/server";
import { searchDesignPatterns, type Category } from "@/lib/design-library";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, category, framework, mood, limit } = body as {
      query: string;
      category?: Category;
      framework?: string;
      mood?: string;
      limit?: number;
    };

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchDesignPatterns(query, { category, framework, mood, limit });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("design-library search error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
