// load.js — v3: adds retry-with-backoff for transient network errors
// (ECONNRESET etc.) so one flaky request doesn't kill a 350-item run,
// and drops the 21s delay now that a Voyage payment method is on file
// (still paced gently to avoid bursting).
//
// Requires: VOYAGE_API_KEY, DATABASE_URL
// npm install pg

import fs from "fs";
import { Client } from "pg";

const DELAY_MS = 300; // gentle pacing now that rate limit is lifted
const MAX_RETRIES = 4;

async function embed(text, attempt = 1) {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: "voyage-4-lite",
        input_type: "document",
        output_dimension: 1024,
      }),
    });

    if (!res.ok) {
      throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const backoff = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s, 8s
    console.log(`  retrying embed (attempt ${attempt + 1}/${MAX_RETRIES}) after ${backoff}ms: ${err.message}`);
    await new Promise((r) => setTimeout(r, backoff));
    return embed(text, attempt + 1);
  }
}

async function main() {
  const snippets = JSON.parse(fs.readFileSync("output/snippets.tagged.json", "utf-8"));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const failed = [];

  for (const s of snippets) {
    const searchText = `${s.category} ${s.technique} ${s.mood} ${s.description}`;
    try {
      const embedding = await embed(searchText);

      await client.query(
        `INSERT INTO "GsapAnimationPattern"
           (id, category, technique, mood, framework, description, "usageNote", code, params, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           technique = EXCLUDED.technique,
           mood = EXCLUDED.mood,
           description = EXCLUDED.description,
           "usageNote" = EXCLUDED."usageNote",
           code = EXCLUDED.code,
           params = EXCLUDED.params,
           embedding = EXCLUDED.embedding`,
        [
          s.id, s.category, s.technique, s.mood, s.framework,
          s.description, s.usageNote || null, s.code, s.params,
          JSON.stringify(embedding),
        ]
      );
      console.log(`Loaded ${s.id} (${s.category})`);
    } catch (err) {
      console.error(`FAILED ${s.id}: ${err.message}`);
      failed.push(s.id);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  await client.end();
  console.log(`\nLoaded ${snippets.length - failed.length}/${snippets.length} patterns into GsapAnimationPattern`);
  if (failed.length) {
    console.log(`Failed (${failed.length}): ${failed.join(", ")}`);
    console.log("Re-run load.js — it's idempotent (ON CONFLICT DO UPDATE), already-loaded rows are just re-updated harmlessly.");
  }
}

main();