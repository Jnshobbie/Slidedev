import { NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

const LEMON_SECRET = process.env.LEMONSQUEEZY_SIGNING_SECRET as string;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-signature") || "";

    const hmac = crypto.createHmac("sha256", LEMON_SECRET);
    const digest = hmac.update(body).digest("hex");

    if (digest !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.meta?.event_name;
    const customerEmail = event.data?.attributes?.user_email;
    const lsSubscriptionId = event.data?.id as string;
    const endsAt = event.data?.attributes?.ends_at as string | null;

    if (!customerEmail) {
      return NextResponse.json({ error: "Missing customer email" }, { status: 400 });
    }

    const clerk = await clerkClient();
    const usersResponse = await clerk.users.getUserList({ emailAddress: [customerEmail] });
    if (!usersResponse.data || usersResponse.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = usersResponse.data[0];

    switch (eventType) {
      case "subscription_created":
      case "subscription_resumed":
      case "subscription_payment_success": {
        const variantId = event.data?.attributes?.variant_id as number | null;

        // Get your variant IDs from LemonSqueezy dashboard
        const YEARLY_VARIANT_ID = process.env.LS_YEARLY_VARIANT_ID
          ? parseInt(process.env.LS_YEARLY_VARIANT_ID)
          : null;

        // If LemonSqueezy provides ends_at use it, otherwise calculate from variant
        let expiresAt: Date | null = null;
        if (endsAt) {
          expiresAt = new Date(endsAt);
        } else if (variantId && YEARLY_VARIANT_ID && variantId === YEARLY_VARIANT_ID) {
          // Yearly plan — expire in 1 year
          expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          // Monthly plan — expire in 30 days
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
        }

        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            plan: "pro",
            status: "active",
            lsSubscriptionId,
            expiresAt,
          },
          create: {
            userId: user.id,
            plan: "pro",
            status: "active",
            lsSubscriptionId,
            expiresAt,
          },
        });
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_payment_failed":
      case "subscription_payment_refunded":
        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            plan: "free",
            status: "inactive",
            expiresAt: endsAt ? new Date(endsAt) : null,
          },
          create: {
            userId: user.id,
            plan: "free",
            status: "inactive",
            expiresAt: null,
          },
        });
        break;

      default:
        console.log("Unhandled event:", eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}