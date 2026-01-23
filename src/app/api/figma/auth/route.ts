import { NextResponse } from 'next/server';

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID!;
const REDIRECT_URI = process.env.FIGMA_REDIRECT_URI!;

// ✅ FIXED: Use correct Figma OAuth scope names
const SCOPES = [
  'file_content:read',      // Read file contents
  'file_metadata:read',     // Read file metadata
  'file_versions:read',     // Read version history (ADDED)
  'library_assets:read',    // Read library assets
  'library_content:read',   // Read library content
  'current_user:read'       // Read user info
];

export async function GET() {
  const state = crypto.randomUUID();
  
  const authUrl = new URL('https://www.figma.com/oauth');
  authUrl.searchParams.set('client_id', FIGMA_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  console.log('🔐 Starting OAuth with scopes:', SCOPES.join(', '));
  console.log('🔗 Auth URL:', authUrl.toString());

  return NextResponse.redirect(authUrl.toString());
}