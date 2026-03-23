import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
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

    // Extract and upload images from nodes to Cloudinary
    const imageUrlMap: Record<string, string> = {};
    const sanitizedNodes = await extractAndUploadImages(nodes, importId, imageUrlMap);

    await prisma.figmaImport.upsert({
      where: { importId },
      update: {
        designData: JSON.stringify({
          ...(await getExistingNodes(importId)),
          ...flattenNodes(sanitizedNodes)
        }),
        imageUrls: JSON.stringify({
          ...(await getExistingImageUrls(importId)),
          ...imageUrlMap
        }),
        updatedAt: new Date(),
      },
      create: {
        importId,
        userId: "anonymous",
        fileName: fileName || 'Figma Design',
        designData: JSON.stringify(flattenNodes(sanitizedNodes)),
        imageUrls: JSON.stringify(imageUrlMap),
      }
    });

    console.log(`✅ Smart import batch ${batchIndex + 1}/${totalBatches} saved: ${importId}`);
    console.log(`🖼️ Uploaded ${Object.keys(imageUrlMap).length} images to Cloudinary`);

    return NextResponse.json({ importId, imageUrlMap }, { headers: corsHeaders });

  } catch (error) {
    console.error("Smart import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

// Walk nodes, upload any imageData to Cloudinary, replace with URL
async function extractAndUploadImages(
  nodes: unknown[],
  importId: string,
  imageUrlMap: Record<string, string>
): Promise<unknown[]> {
  if (!nodes || !Array.isArray(nodes)) return nodes;

  const result = [];
  for (const node of nodes) {
    const n = { ...(node as Record<string, unknown>) };

    if (n.imageData && typeof n.imageData === 'string') {
      try {
        const base64 = `data:image/png;base64,${n.imageData}`;
        const url = await uploadImageToCloudinary(base64, importId, `img-${n.id || nanoid()}`);
        imageUrlMap[n.id as string || nanoid()] = url;
        n.imageUrl = url; // replace base64 with real URL
        delete n.imageData; // remove base64 to save DB space
        console.log(`✅ Uploaded image for node: ${n.name}`);
      } catch (err) {
        console.error(`Failed to upload image for node ${n.name}:`, err);
        delete n.imageData; // remove even if failed to save space
      }
    }

    // Recurse into children
    if (n.children && Array.isArray(n.children)) {
      n.children = await extractAndUploadImages(n.children as unknown[], importId, imageUrlMap);
    }

    result.push(n);
  }
  return result;
}

async function getExistingNodes(importId: string) {
  try {
    const existing = await prisma.figmaImport.findUnique({ where: { importId } });
    return existing ? JSON.parse(existing.designData) : {};
  } catch {
    return {};
  }
}

async function getExistingImageUrls(importId: string) {
  try {
    const existing = await prisma.figmaImport.findUnique({ where: { importId } });
    return existing ? JSON.parse(existing.imageUrls) : {};
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