import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileKey, nodeIds, fileName } = body;

    if (!fileKey || !nodeIds || nodeIds.length === 0) {
      return NextResponse.json({ error: "Missing fileKey or nodeIds" }, { status: 400 });
    }

    // Get Figma token from cookie
    const cookieStore = await cookies();
    const figmaToken = cookieStore.get('figma_token')?.value;

    if (!figmaToken) {
      return NextResponse.json({ 
        error: "Figma not connected. Please connect your Figma account first." 
      }, { status: 401 });
    }

    // Call Figma API server-side — instant, no timeout
    const nodeIdsParam = nodeIds.join(',');
    console.log(`🎨 Fetching Figma nodes: ${nodeIdsParam}`);

    const figmaRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeIdsParam)}`,
      {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!figmaRes.ok) {
      const err = await figmaRes.text();
      console.error('Figma API error:', err);
      return NextResponse.json({ 
        error: "Failed to fetch from Figma API. Token may be expired." 
      }, { status: 400 });
    }

    const figmaData = await figmaRes.json();
    console.log(`✅ Figma API returned ${Object.keys(figmaData.nodes || {}).length} nodes`);

    // Also fetch images for the nodes
    const imageUrlMap: Record<string, string> = {};
    try {
      const imagesRes = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeIdsParam)}&format=png&scale=2`,
        {
          headers: { 'Authorization': `Bearer ${figmaToken}` }
        }
      );
      if (imagesRes.ok) {
        const imagesData = await imagesRes.json();
        Object.assign(imageUrlMap, imagesData.images || {});
        console.log(`✅ Got ${Object.keys(imageUrlMap).length} image URLs from Figma`);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    }

    // Store in DB
    const importId = nanoid();
    await prisma.figmaImport.create({
      data: {
        importId,
        userId: "anonymous",
        fileName: fileName || figmaData.name || 'Figma Design',
        designData: JSON.stringify(figmaData.nodes),
        imageUrls: JSON.stringify(imageUrlMap),
      }
    });

    console.log(`✅ Smart import saved: ${importId}`);

    return NextResponse.json({ importId, imageUrlMap }, {
      headers: { "Access-Control-Allow-Origin": "*" }
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
      "Access-Control-Allow-Origin": "https://www.figma.com",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}