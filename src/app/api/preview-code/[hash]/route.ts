// src/app/api/preview-code/[hash]/route.ts
import { NextResponse } from "next/server";
import { getPreview } from "@/lib/preview-store";

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const entry = await getPreview(hash);
  if (!entry) {
    return NextResponse.json({ code: "", entry: "App" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  return NextResponse.json(
    { code: entry.code, entry: entry.entry, updatedAt: entry.updatedAt },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
  );
}