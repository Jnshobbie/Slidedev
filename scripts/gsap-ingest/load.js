// load.js — Day 1 (part 4): embed each tagged snippet and insert
// it into the gsap_animation_patterns table (see schema_and_load.sql).
//
// Requires: ANTHROPIC_API_KEY (or your embedding provider's key),
// DATABASE_URL (your existing Postgres connection string)
// npm install pg
//
// Note: swap EMBED_URL/EMBED_MODEL for whichever embedding provider
// you're already using — Voyage AI pairs naturally with Claude/Anthropic
// stacks (voyage-3), OpenAI's text-embedding-3-small also works fine.
// This stub shows the shape; plug in real credentials before running.

import fs from "fs";
import { Client } from "pg";

async function embed(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: "voyage-4-lite",
      input_type: "document", // asymmetric mode: document vs query — must be "document" here, "query" in gsap-patterns.ts
      output_dimension: 1024, // must match the vector(1024) column in schema.prisma
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  const snippets = JSON.parse(fs.readFileSync("output/snippets.tagged.json", "utf-8"));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const s of snippets) {
    const searchText = `${s.technique} ${s.mood} ${s.description}`;
    const embedding = await embed(searchText);

    await client.query(
      `INSERT INTO "GsapAnimationPattern"
         (id, technique, mood, framework, description, code, params, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         technique = EXCLUDED.technique,
         mood = EXCLUDED.mood,
         description = EXCLUDED.description,
         code = EXCLUDED.code,
         params = EXCLUDED.params,
         embedding = EXCLUDED.embedding`,
      [s.id, s.technique, s.mood, s.framework, s.description, s.code, s.params, JSON.stringify(embedding)]
    );
    console.log(`Loaded ${s.id}`);
    await new Promise((r) => setTimeout(r, 21000)); // respect Voyage's 3 RPM limit (no card on file)
  }

  await client.end();
  console.log(`\nLoaded ${snippets.length} patterns into gsap_animation_patterns`);
}

main();