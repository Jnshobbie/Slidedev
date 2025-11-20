import { NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";

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

    if (!customerEmail) {
      return NextResponse.json({ error: "Missing customer email" }, { status: 400 });
    }

    // ✅ Get user by email
    const clerk = await clerkClient();
    const usersResponse = await clerk.users.getUserList({ emailAddress: [customerEmail] });
    if (!usersResponse.data || usersResponse.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = usersResponse.data[0];

    // Handle subscription events
    switch (eventType) {
      case "subscription_created":
      case "subscription_resumed":
      case "subscription_payment_success":
        await clerk.users.updateUser(user.id, {
          publicMetadata: { plan: "pro", credits: 100, billingStatus: "active" },
        });
        break;

      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_payment_failed":
      case "subscription_payment_refunded":
        await clerk.users.updateUser(user.id, {
          publicMetadata: { plan: "free", credits: 5, billingStatus: "inactive" },
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
