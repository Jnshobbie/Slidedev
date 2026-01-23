import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    
    if (!code) {
      console.error('❌ No code in callback');
      return NextResponse.redirect(new URL('/?error=no_code', req.url));
    }

    console.log('🔑 Exchanging code for token...');
    console.log('📋 Code received:', code);

    const params = new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      redirect_uri: process.env.FIGMA_REDIRECT_URI!,
      code: code,
      grant_type: 'authorization_code'
    });

    console.log('📤 Sending request to Figma...');
    
    const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    console.log('📡 Response status:', tokenRes.status);
    
    const responseText = await tokenRes.text();
    console.log('📄 Response body:', responseText);

    if (!tokenRes.ok) {
      console.error('❌ Token exchange failed');
      return NextResponse.redirect(new URL(`/?error=figma_api_error`, req.url));
    }

    const tokens = JSON.parse(responseText);

    if (!tokens.access_token) {
      console.error('❌ No access token');
      return NextResponse.redirect(new URL('/?error=no_token', req.url));
    }

    console.log('✅ Token received successfully');

    const response = NextResponse.redirect(new URL('/?figma_connected=true', req.url));
    
    // Set httpOnly cookie for actual API calls (secure)
    response.cookies.set('figma_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });

    // Set a readable flag cookie for JavaScript (not the actual token!)
    response.cookies.set('figma_connected', 'true', {
      httpOnly: false, // JavaScript can read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });

    return response;

  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(new URL('/?error=exception', req.url));
  }
}