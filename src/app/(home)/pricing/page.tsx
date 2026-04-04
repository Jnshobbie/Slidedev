"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useTRPC } from "@/trpc/client";
import Link from "next/link";

const CHECKOUT_LINK = "https://slidedevteam.lemonsqueezy.com/checkout/buy/5627e94d-d244-4233-9ac3-23528c0bbc4c";

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const { isSignedIn } = useAuth();
  const trpc = useTRPC();
  const { data: subscription } = useQuery(trpc.usage.subscription.queryOptions());

  const currentPlan = subscription?.plan || "free";

  const getCheckoutLink = () => {
    return `${CHECKOUT_LINK}${isYearly ? "?variant=yearly" : ""}`;
  };

  const compareFeatures = [
    { name: "AI Tools", free: false, pro: true },
    { name: "Premium Templates", free: false, pro: true },
    { name: "Unlimited Projects", free: false, pro: true },
    { name: "Community Support", free: true, pro: true },
    { name: "Figma Import", free: false, pro: true },
    { name: "Smart Export (Figma→Code)", free: "2/mo", pro: "10/mo" },
    { name: "Project Export", free: false, pro: true },
    { name: "Better AI models", free: false, pro: true },
  ];

  const plans = [
    {
      name: "Free",
      price: "0",
      desc: "Perfect for getting started and testing ideas.",
      features: ["1 project", "Basic templates", "Community support", "Limited figma import", "2 Smart Exports/month", "Limited project export"],
    },
    {
      name: "Pro",
      price: isYearly ? "170" : "14.99",
      desc: "For startups and creators who want full power.",
      features: ["100 credits", "Unlimited projects", "Premium templates", "Priority support", "Unlimited figma import", "10 Smart Exports/month", "Unlimited project export", "Better AI models"],
      highlighted: true,
    },
  ];

  const renderButton = (plan: typeof plans[0]) => {
    // Pro plan button
    if (plan.name === "Pro") {
      if (currentPlan === "pro") {
        return (
          <button className="mt-10 py-3 rounded-xl font-medium bg-gray-800 text-gray-400 cursor-default w-full">
            Your current plan
          </button>
        );
      }
      return (
        <Link href={getCheckoutLink()} target="_blank" rel="noopener noreferrer" className="w-full">
          <button className="mt-10 py-3 rounded-xl font-medium w-full transition bg-gradient-to-r from-[#0071ff] via-[#0055ff] to-[#0033aa] text-white hover:opacity-90">
            Upgrade to Pro
          </button>
        </Link>
      );
    }

    // Free plan button
    if (!isSignedIn) {
      return (
        <Link href="https://app.slidedevai.com" className="w-full">
          <button className="mt-10 py-3 rounded-xl font-medium w-full transition bg-gray-800 text-white hover:bg-gray-700">
            Start for free
          </button>
        </Link>
      );
    }

    // Logged in = always on free plan (even if not upgraded)
    return (
      <button className="mt-10 py-3 rounded-xl font-medium bg-gray-800 text-gray-400 cursor-default w-full">
        Your current plan
      </button>
    );
  };

  return (
    <section className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#0A0A0A] via-[#0B1220] to-[#050505] text-white z-[9999]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,_rgba(0,102,255,0.4),_transparent_70%)] blur-3xl -translate-x-1/2" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: "45px", fontWeight: 700 }}
          className="text-5xl md:text-6xl font-bold"
        >
          Pricing
        </motion.h1>

        <p style={{ fontSize: "35px", fontWeight: 200 }} className="text-gray-400 mb-10 text-lg">
          Choose a plan that fits your goals. Cancel anytime.
        </p>

        {/* Toggle */}
        <div className="flex justify-center mb-16">
          <div
            className="relative flex items-center bg-gray-800 rounded-full w-44 h-10 cursor-pointer"
            onClick={() => setIsYearly(!isYearly)}
            role="switch"
            aria-checked={isYearly}
          >
            <motion.div
              initial={false}
              animate={{ x: isYearly ? "100%" : "0%" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute left-0 top-1 w-1/2 h-8 rounded-full bg-gradient-to-r from-[#0071ff] via-[#0055ff] to-[#0033aa]"
            />
            <div className="relative z-10 w-full grid grid-cols-2 text-sm font-medium select-none">
              <div className={`flex items-center justify-center ${!isYearly ? "text-white" : "text-gray-400"}`}>Monthly</div>
              <div className={`flex items-center justify-center ${isYearly ? "text-white" : "text-gray-400"}`}>Yearly</div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className={`relative rounded-2xl overflow-hidden ${
                plan.highlighted
                  ? "p-[2px] bg-gradient-to-b from-[#0071ff] via-[#0055ff] to-[#111]"
                  : "bg-gray-900 border border-gray-800"
              }`}
            >
              <div className="bg-gray-900 rounded-2xl p-8 h-full flex flex-col justify-between text-left">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">{plan.name}</h2>
                    {plan.highlighted && (
                      <span className="text-xs px-3 py-1 bg-gradient-to-r from-[#0071ff] via-[#0055ff] to-[#0033aa] rounded-full">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 mb-6">{plan.desc}</p>
                  <div className="text-5xl font-bold mb-2">
                    ${plan.price}
                    <span className="text-lg font-normal text-gray-400">/{isYearly ? "yr" : "mo"}</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-gray-300">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="text-blue-400">✔</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {renderButton(plan)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mt-24 text-left max-w-3xl mx-auto">
          <h3 className="text-2xl font-semibold mb-6">Compare Features</h3>
          <div className="grid grid-cols-3 text-gray-400 border-t border-gray-800 pt-4">
            <div className="text-left font-bold">Plan</div>
            <div className="text-left font-bold">Free</div>
            <div className="text-left font-bold">Pro</div>
            {compareFeatures.map((feature) => (
              <React.Fragment key={feature.name}>
                <div className="py-4">{feature.name}</div>
                <div className="py-4 text-left">{feature.free ? "✔" : "-"}</div>
                <div className="py-4 text-left">{feature.pro ? "✔" : "-"}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}