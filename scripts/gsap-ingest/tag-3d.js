// tag-3d.js: tags the three.js example snippets for the Design Library.
// Reads  ./output/snippets-3d.json   (from extract-threejs.js)
// Writes ./output/snippets-3d.tagged.json
// Resumable: ids already present in the tagged file are skipped on re-run.
//
// Requires: ANTHROPIC_API_KEY
// Optional: INCLUDE_GROUPS="webgl,css3d,physics" (comma list; default below skips webgpu, webxr, webaudio)
// Usage:    node tag-3d.js

import fs from "fs";

const MOODS = ["minimal-snappy", "bold-elastic", "cinematic-slow", "playful-bouncy", "luxury-smooth"];
const MOTION_BUDGETS = ["none", "low", "moderate", "high"];
const DEFAULT_GROUPS = "webgl,css3d,css2d,physics,svg,misc,games";
const INCLUDE = new Set((process.env.INCLUDE_GROUPS || DEFAULT_GROUPS).split(",").map((g) => g.trim()));

const IN_PATH = "output/snippets-3d.json";
const OUT_PATH = "output/snippets-3d.tagged.json";

async function classify(s) {
  const prompt = `You are classifying an official three.js example for a searchable design pattern library. The library is queried by AI coding agents that are building websites and web apps for end users, so describe each example in terms of what a website could use it for, not as a three.js demo.

Example name: ${s.technique}
Renderer: ${s.params.renderer}${s.params.usesTSL ? " (uses TSL)" : ""}
Addons imported: ${s.params.addons.join(", ") || "none"}
Local asset paths referenced (these will NOT exist in the user's project): ${s.params.localAssets.join(", ") || "none"}

Code:
\`\`\`
${s.code.slice(0, 5000)}
\`\`\`

Respond ONLY with JSON, no markdown fences, no preamble:
{
  "technique": "<short canonical name for what this does visually, e.g. 'instanced particle field with mouse parallax'>",
  "mood": "<one of: ${MOODS.join(", ")}>",
  "description": "<one or two sentences: what the scene looks like and what kind of site or section it suits, written for search retrieval>",
  "usageNote": "<how the calling agent should adapt this snippet: it is vanilla three.js with an import map, so say how to port it into a React or Next.js app (for example useEffect plus a canvas ref, or react-three-fiber) and how to replace local asset paths>",
  "constraints": "<when this pattern fits or does not fit: performance cost, mobile support, renderer requirements>",
  "antiPatterns": "<common mistakes when adapting it, for example forgetting to dispose geometry, resizing, or hardcoding window size>",
  "accessibilityNotes": "<reduced motion fallback, static image fallback, keyboard or screen reader considerations>",
  "motionBudget": "<one of: ${MOTION_BUDGETS.join(", ")}>"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (!MOODS.includes(parsed.mood)) parsed.mood = "cinematic-slow";
    if (!MOTION_BUDGETS.includes(parsed.motionBudget)) parsed.motionBudget = "moderate";
    return parsed;
  } catch {
    console.error(`Failed to parse tagging response for ${s.id}:`, text.slice(0, 200));
    return null;
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY before running this script.");
    process.exit(1);
  }

  const all = JSON.parse(fs.readFileSync(IN_PATH, "utf-8"));
  const todo = all.filter((s) => INCLUDE.has(s.group));
  const tagged = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, "utf-8")) : [];
  const done = new Set(tagged.map((t) => t.id));

  console.log(`Groups: ${[...INCLUDE].join(", ")} | ${todo.length} snippets in scope, ${done.size} already tagged`);

  let n = 0;
  for (const s of todo) {
    if (done.has(s.id)) continue;
    n++;
    process.stdout.write(`Tagging ${s.id}... `);
    const result = await classify(s);
    if (!result) { console.log("skipped (parse failure, re-run to retry)"); continue; }
    tagged.push({ ...s, ...result });
    console.log(`${result.mood} / ${result.technique}`);
    if (n % 10 === 0) fs.writeFileSync(OUT_PATH, JSON.stringify(tagged, null, 2));
    await new Promise((r) => setTimeout(r, 300));
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(tagged, null, 2));
  console.log(`\nTagged total: ${tagged.length} -> ${OUT_PATH}`);
}

main();