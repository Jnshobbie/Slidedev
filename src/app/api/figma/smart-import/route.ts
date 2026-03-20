import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileName, nodes, images, importId: existingImportId, batchIndex, totalBatches } = body;

    const importId = existingImportId || nanoid();

    await prisma.figmaImport.upsert({
      where: { importId },
      update: {
        designData: JSON.stringify({ 
          ...(await getExistingNodes(importId)), 
          ...flattenNodes(nodes) 
        }),
        updatedAt: new Date(),
      },
      create: {
        importId,
        userId: "anonymous",
        fileName: fileName || 'Figma Design',
        designData: JSON.stringify(flattenNodes(nodes)),
        imageUrls: JSON.stringify(images || {}),
      }
    });

    console.log(`✅ Smart import batch ${batchIndex + 1}/${totalBatches} saved: ${importId}`);

    return NextResponse.json({ importId }, { headers: corsHeaders });

  } catch (error) {
    console.error("Smart import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

async function getExistingNodes(importId: string) {
  try {
    const existing = await prisma.figmaImport.findUnique({ where: { importId } });
    return existing ? JSON.parse(existing.designData) : {};
  } catch {
    return {};
  }
}

function flattenNodes(nodes: unknown[]) {
  if (!nodes || !Array.isArray(nodes)) return {};
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    if (n && n.id) {
      result[n.id as string] = n;
    }
  }
  return result;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}