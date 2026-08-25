// src/lib/gsap-patterns.ts
// Retrieval layer for GSAP Mode — searches the pattern library
// populated by scripts/gsap-ingest/*.js and returns the closest
// matches for the code-gen model to use as reference.

import { prisma } from "@/lib/db"; // adjust to your existing db client export

export type Mood =
  | "minimal-snappy"
  | "bold-elastic"
  | "cinematic-slow"
  | "playful-bouncy"
  | "luxury-smooth";

interface AnimationPattern {
  id: string;
  technique: string;
  mood: string;
  framework: string;
  description: string;
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
      model: "voyage-4-lite", // cheapest tier, shares vector space with voyage-4/voyage-4-large
      input_type: "query", // asymmetric mode: query vs document, improves retrieval accuracy
      output_dimension: 1024, // must match the vector(1024) column in schema.prisma
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function searchAnimationPatterns(
  query: string,
  opts?: { mood?: Mood; framework?: "vanilla" | "react"; limit?: number }
): Promise<AnimationPattern[]> {
  const limit = opts?.limit ?? 3;
  const embedding = await embedQuery(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  // Raw SQL is required here — see the Unsupported("vector") note
  // in schema.prisma. <=> is pgvector's cosine distance operator.
  const rows = await prisma.$queryRawUnsafe<AnimationPattern[]>(
    `
    SELECT id, technique, mood, framework, description, code
    FROM "GsapAnimationPattern"
    WHERE ($1::text IS NULL OR mood = $1)
      AND ($2::text IS NULL OR framework = $2)
    ORDER BY embedding <=> $3::vector
    LIMIT $4
    `,
    opts?.mood ?? null,
    opts?.framework ?? null,
    vectorLiteral,
    limit
  );

  return rows;
}

// Deterministic per-project mood picker, so a given project stays
// visually consistent across regenerations instead of drifting
// randomly on every request.
const MOODS: Mood[] = [
  "minimal-snappy",
  "bold-elastic",
  "cinematic-slow",
  "playful-bouncy",
  "luxury-smooth",
];

export function pickMoodForProject(projectId: string): Mood {
  let hash = 0;
  for (const ch of projectId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return MOODS[hash % MOODS.length];
}