import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileName, nodes, images, importId: existingImportId, batchIndex, totalBatches } = body;

    const importId = existingImportId || nanoid();

    const imageUrlMap: Record<string, string> = {};
    if (images && Object.keys(images).length > 0) {
      for (const [nodeId, base64] of Object.entries(images)) {
        try {
          const url = await uploadImageToCloudinary(
            base64 as string,
            importId,
            `image-${nodeId}`
          );
          imageUrlMap[nodeId] = url;
        } catch (err) {
          console.error(`Failed to upload image for node ${nodeId}:`, err);
        }
      }
    }

    if (batchIndex === totalBatches - 1) {
      await prisma.figmaImport.upsert({
        where: { importId },
        update: {
          designData: JSON.stringify({ fileName, nodes }),
          imageUrls: JSON.stringify(imageUrlMap),
          updatedAt: new Date(),
        },
        create: {
          importId,
          userId: "anonymous",
          fileName,
          designData: JSON.stringify({ fileName, nodes }),
          imageUrls: JSON.stringify(imageUrlMap),
        },
      });
    }

    return NextResponse.json({ importId, imageUrlMap }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    console.error("Smart import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}