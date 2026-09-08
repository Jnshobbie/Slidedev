// src/app/api/debug-env/route.ts
// TEMPORARY — delete this file once the env var issue is confirmed fixed.
// Never ship a route that echoes env vars to a real production app.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    slug: process.env.LEMONSQUEEZY_STORE_SLUG ?? "MISSING",
    monthlyVariant: process.env.LS_MCP_VARIANT_ID ?? "MISSING",
    yearlyVariant: process.env.LS_MCP_YEARLY_VARIANT_ID ?? "MISSING",
  });
}