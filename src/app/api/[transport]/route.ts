// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { z } from "zod";
import { consumeMcpSearchCredit } from "@/lib/mcp-usage";
import { searchDesignPatterns, type Category } from "@/lib/design-library";

const CATEGORIES: [Category, ...Category[]] = [
  "gsap",
  "mobile-ui",
  "landing-page",
  "motion",
];

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_design_patterns",
      "Search SlideDev's design pattern library for GSAP animations, UI components, and layout techniques matching a natural-language description. Returns code, a description, and a usageNote for each match — read the usageNote before adapting the code, since patterns are framework-specific and copying syntax across frameworks (React vs Vue vs vanilla) will break.",
      {
        query: z
          .string()
          .describe(
            "Natural-language description of the desired effect or component, e.g. 'staggered card entrance animation' or 'sticky navbar that hides on scroll'"
          ),
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe(
            "Optional filter: 'gsap' (scroll/entrance animations), 'mobile-ui' (mobile components), 'landing-page' (page-level layouts), or 'motion' (general motion patterns)"
          ),
        framework: z
          .string()
          .optional()
          .describe("Optional filter, e.g. 'react', 'vue', 'vanilla'"),
        mood: z
          .string()
          .optional()
          .describe("Optional filter for animation feel, e.g. 'minimal-snappy', 'playful-bouncy'"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Max number of patterns to return (default 3)"),
        excludeMoods: z
          .array(z.string())
          .optional()
          .describe("Optional: mood tags to exclude from results, e.g. ['playful-bouncy'] if that style doesn't fit"),
        context: z
          .string()
          .optional()
          .describe("Optional: describe existing design tokens/components in the target app (e.g. 'primary color token --brand-500, existing Button and Card components') so retrieval favors compatible patterns"),
      },
      async ({ query, category, framework, mood, limit, excludeMoods, context }, extra) => {
        const userId = extra.authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          return { content: [{ type: "text", text: "Authentication required." }], isError: true };
        }

        const usage = await consumeMcpSearchCredit(userId);
        if (!usage.allowed) {
          return {
            content: [{ type: "text", text: "Monthly search limit reached. Upgrade to Pro for more searches." }],
            isError: true,
          };
        }

        const results = await searchDesignPatterns(query, {
          category,
          framework,
          mood,
          limit,
          excludeMoods,
          context,
        });

        const formatted = results.map((r) => ({
          whyItFits: r.description,
          frameworkCompatibility: r.framework,
          mood: r.mood,
          technique: r.technique,
          usageNote: r.usageNote,
          code: r.code,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        };
      }
    );
  },
  {},
  {
    basePath: "/api",
    verboseLogs: true,
    maxDuration: 60,
  }
);

const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken) => {
    const clerkAuth = await auth({ acceptsToken: "oauth_token" });
    return verifyClerkToken(clerkAuth, bearerToken);
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
  }
);

export { handler as GET, handler as POST, handler as DELETE };