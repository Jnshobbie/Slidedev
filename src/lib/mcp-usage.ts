import { RateLimiterPrisma } from "rate-limiter-flexible";
import { prisma } from "@/lib/db";

const MCP_FREE_POINTS = 10;
const MCP_PRO_POINTS = 500;
const DURATION = 30 * 24 * 60 * 60; // 30 days
const SEARCH_COST = 1;

export async function getMcpUserPlan(userId: string): Promise<"pro" | "free"> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || subscription.plan !== "mcp" || subscription.status !== "active") {
    return "free";
  }

  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    await prisma.subscription.update({
      where: { userId },
      data: { plan: "free", status: "inactive" },
    });
    return "free";
  }

  return "pro";
}

export async function consumeMcpSearchCredit(userId: string) {
  const plan = await getMcpUserPlan(userId);

  const tracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "usage",
    points: plan === "pro" ? MCP_PRO_POINTS : MCP_FREE_POINTS,
    duration: DURATION,
    keyPrefix: plan === "pro" ? "mcp-pro" : "mcp-free",
  });

  try {
    await tracker.consume(userId, SEARCH_COST);
    return { allowed: true as const };
  } catch {
    return { allowed: false as const, plan };
  }
}