import { NextRequest, NextResponse } from 'next/server';
import { FigmaClient } from '@/lib/figma/client';

export async function POST(req: NextRequest) {
  const { fileUrl } = await req.json();
  
  // Clean the URL - remove query parameters like ?node-id=1-2&t=...
  const cleanUrl = fileUrl.split('?')[0];
  
  // Extract file key from cleaned URL
  const fileKey = cleanUrl.match(/(?:file|design)\/([^/?]+)/)?.[1];
  if (!fileKey) {
    return NextResponse.json({ 
      error: 'Invalid Figma URL. Please use the file URL, not a frame-specific URL.' 
    }, { status: 400 });
  }

  const token = req.cookies.get('figma_token')?.value;
  if (!token) {
    return NextResponse.json({ 
      error: 'Not authenticated. Please connect to Figma first.' 
    }, { status: 401 });
  }

  try {
    console.log('📥 Fetching Figma file:', fileKey);
    console.log('🔗 Original URL:', fileUrl);
    console.log('🧹 Cleaned URL:', cleanUrl);
    
    const client = new FigmaClient(token);
    const file = await client.getFile(fileKey);
    
    console.log('✅ File fetched:', file.name);
    console.log('📄 Pages:', file.document.children?.length || 0);
    
    // Get all frames from first page
    const firstPage = file.document.children[0];
    if (!firstPage || !firstPage.children) {
      return NextResponse.json({ 
        error: 'No frames found in Figma file. Make sure your file has at least one page with frames.' 
      }, { status: 400 });
    }
    
    console.log('📦 Children on first page:', firstPage.children.length);
    
    // Find all frames (and also check for COMPONENT and INSTANCE)
    const frames = firstPage.children
      .filter((node: { type: string }) => 
        node.type === 'FRAME' || 
        node.type === 'COMPONENT' || 
        node.type === 'INSTANCE'
      )
      .slice(0, 5);
    
    console.log('🖼️ Frames found:', frames.length);
    
    if (frames.length === 0) {
      return NextResponse.json({ 
        error: 'No frames found. Please add at least one Frame to your Figma file (press F to create a frame).' 
      }, { status: 400 });
    }

    // Export frames as images
    const frameIds = frames.map((f: { id: string }) => f.id);
    console.log('🎨 Exporting frame IDs:', frameIds);
    
    const images = await client.getImages(fileKey, frameIds, 'png');
    console.log('🖼️ Images exported:', Object.keys(images.images).length);
    
    // Return image URLs
    const frameImages = frames.map((frame: { id: string; name: string }) => ({
      id: frame.id,
      name: frame.name,
      imageUrl: images.images[frame.id]
    }));

    console.log('✅ Import successful!');
    return NextResponse.json({ 
      fileName: file.name,
      frames: frameImages
    });
    
  } catch (error) {
    const err = error as Error;
    console.error('❌ Import error:', err);
    console.error('❌ Error stack:', err.stack);
    
    // Better error messages
    if (err.message.includes('403') || err.message.includes('Forbidden')) {
      return NextResponse.json({ 
        error: 'Access denied. Make sure this file is in your Figma account or shared with you.' 
      }, { status: 403 });
    }
    
    if (err.message.includes('404') || err.message.includes('Not Found')) {
      return NextResponse.json({ 
        error: 'File not found. Please check the URL is correct.' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: err.message || 'Failed to import from Figma' 
    }, { status: 500 });
  }
}