"use client";

import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function BillingPage() {
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as string) || "free";

  // 🧾 Lemon Squeezy product variants
  const checkoutLinks = {
    monthly: `https://slidedevteam.lemonsqueezy.com/checkout/buy/5627e94d-d244-4233-9ac3-23528c0bbc4c`,
    yearly: `https://slidedevteam.lemonsqueezy.com/checkout/buy/5627e94d-d244-4233-9ac3-23528c0bbc4c`, //  yearly variant ID
  };

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full pt-[15vh] px-6">
      <Image src="/logo.png" alt="Logo" width={50} height={50} />
      <h1 className="text-3xl font-bold mt-6 text-center">Billing</h1>
      <p className="text-muted-foreground text-center mt-2">
        Manage your subscription and credits
      </p>

      <div className="w-full border rounded-lg p-6 mt-10 shadow-sm bg-background">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Current Plan</h2>
            <p className="text-muted-foreground text-sm capitalize">
              {plan} plan
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              plan === "pro"
                ? "bg-gradient-to-r from-blue-600 to-blue-800 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            {plan.toUpperCase()}
          </span>
        </div>

        {plan === "free" ? (
          <>
            <p className="text-sm mt-4 text-muted-foreground">
              Upgrade to unlock more credits and full access to all features.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
              <Link
                href={checkoutLinks.monthly}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-md hover:from-blue-700 hover:to-blue-900 transition-all duration-300">
                  $14.99 / month
                </button>
              </Link>

              <Link
                href={checkoutLinks.yearly}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="w-full py-2 bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-md hover:from-blue-800 hover:to-black transition-all duration-300">
                  $14.99 / month (billed yearly $170)
                </button>
              </Link>
            </div>
          </>
        ) : (
          <button
            onClick={() =>
              alert("To cancel, contact support or manage via Lemon Squeezy.")
            }
            className="mt-6 w-full py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition"
          >
            Manage Subscription
          </button>
        )}
      </div>
    </div>
  );
}
