// load-3d.js: loads tagged three.js snippets into GsapAnimationPattern,
// including sourceRepo, license and imageUrl (load.js does not write these).
// Idempotent (ON CONFLICT DO UPDATE), safe to re-run.
//
// Requires: VOYAGE_API_KEY, DATABASE_URL, and the imageUrl column (prisma db push first)
// Optional: PREVIEW_BASE_URL (default https://app.slidedevai.com/pattern-previews/)
// Usage:    node load-3d.js

import fs from "fs";
import { Client } from "pg";

const DELAY_MS = 300;
const MAX_RETRIES = 4;
const BASE_URL = process.env.PREVIEW_BASE_URL || "https://app.slidedevai.com/pattern-previews/";
const SOURCE_REPO = "mrdoob/three.js";
const LICENSE = "MIT";

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
    if (!res.ok) throw new Error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const backoff = 1000 * 2 ** (attempt - 1);
    console.log(`  retrying embed (attempt ${attempt + 1}/${MAX_RETRIES}) after ${backoff}ms: ${err.message}`);
    await new Promise((r) => setTimeout(r, backoff));
    return embed(text, attempt + 1);
  }
}

async function main() {
  const snippets = JSON.parse(fs.readFileSync("output/snippets-3d.tagged.json", "utf-8"));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const failed = [];

  for (const s of snippets) {
    const searchText = `${s.category} ${s.technique} ${s.mood} ${s.description}`;
    const imageUrl = s.imageFile ? BASE_URL + s.imageFile : null;
    try {
      const embedding = await embed(searchText);

      await client.query(
        `INSERT INTO "GsapAnimationPattern"
           (id, category, technique, mood, framework, description, "usageNote", code, params, embedding,
            constraints, "antiPatterns", "accessibilityNotes", "motionBudget", "sourceRepo", license, "imageUrl")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           technique = EXCLUDED.technique,
           mood = EXCLUDED.mood,
           framework = EXCLUDED.framework,
           description = EXCLUDED.description,
           "usageNote" = EXCLUDED."usageNote",
           code = EXCLUDED.code,
           params = EXCLUDED.params,
           embedding = EXCLUDED.embedding,
           constraints = EXCLUDED.constraints,
           "antiPatterns" = EXCLUDED."antiPatterns",
           "accessibilityNotes" = EXCLUDED."accessibilityNotes",
           "motionBudget" = EXCLUDED."motionBudget",
           "sourceRepo" = EXCLUDED."sourceRepo",
           license = EXCLUDED.license,
           "imageUrl" = EXCLUDED."imageUrl"`,
        [
          s.id, s.category, s.technique, s.mood, s.framework,
          s.description, s.usageNote || null, s.code, s.params,
          JSON.stringify(embedding),
          s.constraints || null, s.antiPatterns || null,
          s.accessibilityNotes || null, s.motionBudget || null,
          SOURCE_REPO, LICENSE, imageUrl,
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
  console.log(`\nLoaded ${snippets.length - failed.length}/${snippets.length} patterns`);
  if (failed.length) console.log(`Failed (${failed.length}): ${failed.join(", ")} (re-run is safe)`);
}

main();