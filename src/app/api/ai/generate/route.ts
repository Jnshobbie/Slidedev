// src/app/api/ai/generate/route.ts
import { NextResponse } from "next/server";
import { runCodeAgentJob } from "@/lib/code-agent-runner";

export async function POST(req: Request) {
  const body = await req.json();
  const { projectId, value, projectType, attachments, figmaData } = body;

  // You can ignore projectType here if runCodeAgentJob looks it up from DB
  const result = await runCodeAgentJob({
    projectId,
    value,
    attachments,
    figmaData,
  });

  return NextResponse.json(result);
}