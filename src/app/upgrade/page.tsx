// src/app/upgrade/page.tsx
// Protected automatically by middleware.ts (not in isPublicRoute),
// so Clerk forces sign-in before this ever runs.

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // never cache/pre-render this — env vars + user identity must be read fresh every request

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  const { plan } = await searchParams;
  const store = process.env.LEMONSQUEEZY_STORE_SLUG;
  const variantId =
    plan === "yearly"
      ? process.env.LS_MCP_YEARLY_VARIANT_ID
      : process.env.LS_MCP_VARIANT_ID;

  if (!store || !variantId) {
    throw new Error(
      `Upgrade misconfigured: store=${store ?? "MISSING"} variantId=${variantId ?? "MISSING"}`
    );
  }

  const checkoutUrl =
    `https://${store}.lemonsqueezy.com/checkout/buy/${variantId}` +
    `?checkout[email]=${encodeURIComponent(email)}` +
    `&checkout[custom][user_id]=${encodeURIComponent(userId)}`;

  redirect(checkoutUrl);
}