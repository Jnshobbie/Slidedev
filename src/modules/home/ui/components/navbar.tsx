"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { UserControl } from "@/components/user-control";

export const Navbar = () => {
  return (
    <nav className="p-4 bg-transparent fixed top-0 left-0 right-0 z-50 border-b border-transparent">
      <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Slide" width={24} height={24} />
          <span className="font-semibold text-lg">Slide</span>
        </Link>

        <SignedOut>
          <div className="flex gap-2">
            <SignUpButton>
              <button
                style={{
                  backgroundColor: "rgba(68,102,167,0.1)",
                  border: "1px solid #4466A7",
                  color: "#fff",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(68,102,167,0.2)";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(68,102,167,0.1)";
                }}
              >
                Sign up
              </button>
            </SignUpButton>

            <SignInButton>
              <button
                style={{
                  backgroundColor: "#4466A7",
                  color: "#fff",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#365189";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#4466A7";
                }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <UserControl showName />
        </SignedIn>
      </div>
    </nav>
  );
};
