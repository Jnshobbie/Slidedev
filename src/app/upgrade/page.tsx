// src/app/upgrade/page.tsx
// Protected automatically by middleware.ts (not in isPublicRoute),
// so Clerk forces sign-in before this ever runs.

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const STORE = process.env.LEMONSQUEEZY_STORE_SLUG; // e.g. "slidedev"

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
  const variantId =
    plan === "yearly"
      ? process.env.LS_MCP_YEARLY_VARIANT_ID
      : process.env.LS_MCP_VARIANT_ID;

  const checkoutUrl =
    `https://${STORE}.lemonsqueezy.com/checkout/buy/${variantId}` +
    `?checkout[email]=${encodeURIComponent(email)}` +
    `&checkout[custom][user_id]=${encodeURIComponent(userId)}`;

  redirect(checkoutUrl);
}