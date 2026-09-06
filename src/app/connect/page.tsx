// src/app/connect/page.tsx
"use client";

import { useState } from "react";

const MCP_URL = "https://mcp.slidedevai.com/api/mcp"; // swap in your real final URL

export default function ConnectPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0E14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#11141D",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#F1F0F6", fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          Connect SlideDev MCP
        </h1>
        <p style={{ color: "#8A8CA0", fontSize: 15, lineHeight: 1.5, marginBottom: 28 }}>
          Copy the URL below and add it as a custom connector in Claude, ChatGPT,
          or any MCP-compatible AI client. You'll be asked to sign in the first
          time you connect.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0B0E14",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <code
            style={{
              flex: 1,
              color: "#F1F0F6",
              fontSize: 14,
              fontFamily: "monospace",
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {MCP_URL}
          </code>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#4DD9C2" : "#8A8CA0",
              color: "#0B0E14",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p style={{ color: "#8A8CA0", fontSize: 13, marginTop: 24 }}>
          In Claude: Settings → Connectors → Add custom connector.
        </p>
      </div>
    </div>
  );
}