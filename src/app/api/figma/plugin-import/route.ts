import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Type definitions
interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
  width: number;
  height: number;
  imageData: string;
  type: string;
}

interface FigmaPluginExport {
  fileName: string;
  context: string;
  pages?: Array<{ name: string; frameCount: number }>;
  frames: FigmaFrame[];
}

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
  metadata: {
    frameId: string;
    pageName: string;
    width: number;
    height: number;
    fileName: string;
  };
}

// In-memory storage for plugin exports (temporary)
// Key: importId, Value: export data
const pluginExports = new Map<string, { attachments: Attachment[]; timestamp: number }>();

// Clean up old exports (older than 10 minutes)
setInterval(() => {
  // In plugin-import/route.ts, line ~40
const tenMinutesAgo = Date.now() - (30 * 60 * 1000); // Changed from 10 to 30
  for (const [importId, data] of pluginExports.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      pluginExports.delete(importId);
      console.log('🗑️ Cleaned up expired import:', importId);
    }
  }
}, 60 * 1000); // Check every minute

// Generate random importId
function generateImportId(): string {
  return `imp_${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
}

// POST - Plugin uploads frames (NO AUTH REQUIRED)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FigmaPluginExport & { 
      importId?: string; 
      batchIndex?: number; 
      totalBatches?: number; 
    };
    
    console.log('📦 Received Figma plugin export:');
    console.log('  File:', body.fileName);
    console.log('  Context:', body.context);
    console.log('  Frames:', body.frames?.length);
    console.log('  Batch:', body.batchIndex, '/', body.totalBatches);

    const newAttachments: Attachment[] = body.frames.map((frame) => ({
      url: frame.imageData,
      name: `${frame.name} (${frame.pageName})`,
      type: 'image/png',
      size: 0,
      metadata: {
        frameId: frame.id,
        pageName: frame.pageName,
        width: frame.width,
        height: frame.height,
        fileName: body.fileName
      }
    }));

    let importId: string;

    if (body.importId && pluginExports.has(body.importId)) {
      // Append to existing import
      importId = body.importId;
      const existing = pluginExports.get(importId)!;
      existing.attachments.push(...newAttachments);
      existing.timestamp = Date.now();
      console.log(`✅ Appended ${newAttachments.length} frames to ${importId}, total: ${existing.attachments.length}`);
    } else {
      // First batch — create new import
      importId = generateImportId();
      pluginExports.set(importId, {
        attachments: newAttachments,
        timestamp: Date.now()
      });
      console.log('💾 Stored export with importId:', importId);
      console.log('📊 Current exports in memory:', pluginExports.size);
    }

    return NextResponse.json(
      {
        success: true,
        importId,
        message: 'Export stored successfully',
        frameCount: body.frames.length
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('❌ Plugin import POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process Figma export' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// GET - Browser retrieves stored export (AUTH REQUIRED)
export async function GET(req: NextRequest) {
  try {
    // Require Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ Unauthorized GET request');
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      );
    }

    // Get importId from query params
    const importId = req.nextUrl.searchParams.get('importId');
    
    if (!importId) {
      console.log('⚠️ Missing importId in GET request');
      return NextResponse.json(
        { error: 'Missing importId parameter' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching export for importId:', importId);
    console.log('👤 Authenticated user:', userId);

    const storedExport = pluginExports.get(importId);
    
    if (!storedExport) {
      console.log('⚠️ No export found for importId:', importId);
      return NextResponse.json(
        { error: 'Import not found or expired' },
        { status: 404 }
      );
    }

    console.log('✅ Found export:', storedExport.attachments.length, 'attachments');

    // Delete after fetching (one-time use)
    pluginExports.delete(importId);
    console.log('🗑️ Deleted import after retrieval:', importId);

    return NextResponse.json({
      success: true,
      attachments: storedExport.attachments
    });

  } catch (error) {
    console.error('❌ Plugin import GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}