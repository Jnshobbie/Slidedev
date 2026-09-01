// src/app/.well-known/oauth-protected-resource/mcp/route.ts
import { protectedResourceHandlerClerk } from "@clerk/mcp-tools/next";

const handler = protectedResourceHandlerClerk();

export { handler as GET };