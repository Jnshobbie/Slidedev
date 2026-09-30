import { NextResponse } from "next/server";
import { deleteStalePreviews } from "@/lib/preview-store";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await deleteStalePreviews(24);
  return NextResponse.json({ deleted: result.count });
}