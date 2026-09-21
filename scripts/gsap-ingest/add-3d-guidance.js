// Inserts hand-written guidance patterns for using free CC0 3D models
// (Poly Haven / Poly Pizza) so they surface through the normal
// search_design_patterns retrieval flow — active, not passive.
// Run once: node add-3d-guidance.js (requires VOYAGE_API_KEY, DATABASE_URL)

import { Client } from "pg";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  console.error("Set VOYAGE_API_KEY before running this script.");
  process.exit(1);
}

async function embed(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text, model: "voyage-3" }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

const PATTERNS = [
  {
    id: "3d-model-poly-haven",
    category: "3d",
    technique: "adding a real 3D model to a website using free CC0 assets",
    mood: "minimal-snappy",
    framework: "react",
    description:
      "How to add or swap a real 3D model into a website or app — including an existing project, not just from scratch — using free, CC0-licensed models from Poly Haven with Three.js / react-three-fiber. No hosting or bundling required.",
    usageNote:
      "Works for both new 3D sites and adding/replacing a single 3D element in an already-built project.",
    code: `import { useGLTF } from "@react-three/drei";

// Fetch an asset's files at https://api.polyhaven.com/files/{asset_id}
// then point useGLTF directly at the returned glTF URL — no download/hosting needed.
function Model() {
  const { scene } = useGLTF(
    "https://dl.polyhaven.com/file/ph-assets/Models/gltf/1k/wooden_stool_02.gltf"
  );
  return <primitive object={scene} />;
}`,
    constraints:
      "Best for props, furniture, and general objects rather than characters — Poly Haven's catalog leans toward real-world scanned objects.",
    antiPatterns:
      "Don't download and re-host the file in the project's own repo/bundle — link directly to the Poly Haven CDN URL to avoid bloating the app and to stay in sync with the source.",
    accessibilityNotes:
      "Provide a static image fallback or alt description for users on reduced-motion settings or slow connections, since 3D assets can be heavy.",
    motionBudget: "moderate",
    sourceRepo: null,
    license: "CC0",
  },
  {
    id: "3d-model-poly-pizza",
    category: "3d",
    technique: "adding a stylized low-poly 3D model using free assets",
    mood: "playful-bouncy",
    framework: "react",
    description:
      "How to add a stylized, low-poly 3D model to a website or app using Poly Pizza's free model library — a larger, more varied catalog than Poly Haven, useful when a more illustrative/game-like look fits better than a photorealistic scan.",
    usageNote:
      "Licensing is mixed per-model on Poly Pizza (CC0 or CC-BY) — check each model's listed license before using; if CC-BY, add a small attribution credit somewhere on the page (e.g. a footer line). Prefer Poly Haven when a suitable model exists there, since it needs no attribution handling at all.",
    code: `import { useGLTF } from "@react-three/drei";

// Browse models at https://poly.pizza — each model page shows its license
// and a direct download URL. Use the glTF URL the same way as any other asset.
function Model() {
  const { scene } = useGLTF("https://poly.pizza/m/<model-id>/model.glb");
  return <primitive object={scene} />;
}`,
    constraints: "Check license per-model before use — not all are CC0.",
    antiPatterns:
      "Don't assume every Poly Pizza model is attribution-free like Poly Haven — verify each one individually.",
    accessibilityNotes:
      "Same as any 3D asset: provide a fallback for reduced-motion or low-end devices.",
    motionBudget: "moderate",
    sourceRepo: null,
    license: "mixed — verify per model",
  },
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const p of PATTERNS) {
    const embedding = await embed(`${p.technique} ${p.description}`);
    await client.query(
      `INSERT INTO "GsapAnimationPattern"
         (id, category, technique, mood, framework, description, "usageNote", code, params, embedding,
          constraints, "antiPatterns", "accessibilityNotes", "motionBudget", "sourceRepo", license)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description,
         "usageNote" = EXCLUDED."usageNote",
         code = EXCLUDED.code,
         embedding = EXCLUDED.embedding,
         constraints = EXCLUDED.constraints,
         "antiPatterns" = EXCLUDED."antiPatterns",
         "accessibilityNotes" = EXCLUDED."accessibilityNotes",
         "motionBudget" = EXCLUDED."motionBudget",
         "sourceRepo" = EXCLUDED."sourceRepo",
         license = EXCLUDED.license`,
      [
        p.id, p.category, p.technique, p.mood, p.framework,
        p.description, p.usageNote, p.code, null, JSON.stringify(embedding),
        p.constraints, p.antiPatterns, p.accessibilityNotes, p.motionBudget,
        p.sourceRepo, p.license,
      ]
    );
    console.log(`Inserted/updated: ${p.id}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});