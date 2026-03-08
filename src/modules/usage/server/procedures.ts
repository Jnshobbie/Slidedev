import { getUsageStatus, getUserSubscription } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { auth } from "@clerk/nextjs/server";

export const usageRouter = createTRPCRouter({
  status: protectedProcedure.query(async () => {
    try {
      const result = await getUsageStatus();
      return result;
    } catch {
      return null;
    }
  }),

  subscription: protectedProcedure.query(async () => {
    try {
      const { userId } = await auth();
      if (!userId) return null;
      const result = await getUserSubscription(userId);
      return result;
    } catch {
      return null;
    }
  }),
});