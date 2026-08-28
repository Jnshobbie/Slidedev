// src/lib/design-library.ts
// Generalized retrieval for the SlideDev Design Library (the MCP product).
// Separate from gsap-patterns.ts on purpose — that file powers the
// internal GSAP Mode tool inside generate-code.ts and should stay
// untouched. This one powers the external-facing API/MCP server.

import { prisma } from "@/lib/db";

export type Category = "gsap" | "mobile-ui" | "landing-page" | "motion";

interface DesignPatternResult {
  id: string;
  category: string;
  technique: string;
  mood: string;
  framework: string;
  description: string;
  usageNote: string | null;
  code: string;
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: "voyage-4-lite",
      input_type: "query",
      output_dimension: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function searchDesignPatterns(
  query: string,
  opts?: { category?: Category; framework?: string; mood?: string; limit?: number }
): Promise<DesignPatternResult[]> {
  const limit = opts?.limit ?? 3;
  const embedding = await embedQuery(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<DesignPatternResult[]>(
    `
    SELECT id, category, technique, mood, framework, description, "usageNote", code
    FROM "GsapAnimationPattern"
    WHERE ($1::text IS NULL OR category = $1)
      AND ($2::text IS NULL OR framework = $2)
      AND ($3::text IS NULL OR mood = $3)
    ORDER BY embedding <=> $4::vector
    LIMIT $5
    `,
    opts?.category ?? null,
    opts?.framework ?? null,
    opts?.mood ?? null,
    vectorLiteral,
    limit
  );

  return rows;
}
