import { RateLimiterPrisma } from "rate-limiter-flexible";
import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

const FREE_POINTS = 3;
const PRO_POINTS = 100;
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;
const SMART_FREE_POINTS = 2;
const SMART_PRO_POINTS = 10;
const SMART_PREMIUM_POINTS = 20; // coming soon

async function getUserPlan(userId: string): Promise<"pro" | "free"> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || subscription.plan !== "pro" || subscription.status !== "active") {
    return "free";
  }

  // Check if subscription has expired
  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    await prisma.subscription.update({
      where: { userId },
      data: { plan: "free", status: "inactive" },
    });
    return "free";
  }

  return "pro";
}

export async function getUsageTracker() {
  const { userId } = await auth();
  if (!userId) throw new Error("User not authenticated");

  const plan = await getUserPlan(userId);

  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "usage",
    points: plan === "pro" ? PRO_POINTS : FREE_POINTS,
    duration: DURATION,
    keyPrefix: plan === "pro" ? "pro" : "free",
  });

  return usageTracker;
}

export async function consumeCredits() {
  const { userId } = await auth();
  if (!userId) throw new Error("User not authenticated");

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.consume(userId, GENERATION_COST);
  return result;
}

export async function getUsageStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("User not authenticated");

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(userId);
  return result;
}

export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });
  return subscription;
}

export async function getSmartExportTracker() {
  const { userId } = await auth();
  if (!userId) throw new Error("User not authenticated");

  const plan = await getUserPlan(userId);

  const points = plan === "pro" ? SMART_PRO_POINTS : SMART_FREE_POINTS;

  const smartTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "usage",
    points,
    duration: DURATION,
    keyPrefix: `smart-${plan}`,
  });

  return { smartTracker, userId };
}

export async function consumeSmartExportCredit() {
  const { smartTracker, userId } = await getSmartExportTracker();
  const result = await smartTracker.consume(userId, 1);
  return result;
}

export async function getSmartExportStatus() {
  const { smartTracker, userId } = await getSmartExportTracker();
  const result = await smartTracker.get(userId);
  return result;
}