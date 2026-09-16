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
  opts?: {
    category?: Category;
    framework?: string;
    mood?: string;
    limit?: number;
    excludeMoods?: string[];
    context?: string;
  }
): Promise<DesignPatternResult[]> {
  const limit = opts?.limit ?? 3;
  // context (existing tokens/components the caller wants matched against)
  // is folded into the embedded text itself, not a filter — this biases
  // retrieval toward compatible patterns without needing new columns.
  const embedText = opts?.context ? `${query}\n\nExisting design context: ${opts.context}` : query;
  const embedding = await embedQuery(embedText);
  const vectorLiteral = `[${embedding.join(",")}]`;
  const excludeMoods = opts?.excludeMoods?.length ? opts.excludeMoods : null;

  const rows = await prisma.$queryRawUnsafe<DesignPatternResult[]>(
    `
    SELECT id, category, technique, mood, framework, description, "usageNote", code
    FROM "GsapAnimationPattern"
    WHERE ($1::text IS NULL OR category = $1)
      AND ($2::text IS NULL OR framework = $2)
      AND ($3::text IS NULL OR mood = $3)
      AND ($6::text[] IS NULL OR NOT (mood = ANY($6::text[])))
    ORDER BY embedding <=> $4::vector
    LIMIT $5
    `,
    opts?.category ?? null,
    opts?.framework ?? null,
    opts?.mood ?? null,
    vectorLiteral,
    limit,
    excludeMoods
  );

  return rows;
}