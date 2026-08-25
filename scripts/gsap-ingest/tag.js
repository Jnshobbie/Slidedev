// tag.js — Day 1 (part 2): one-time batch job that sends each
// extracted snippet + its extracted params to Claude and asks for
// a mood/technique classification. Run once after extract.js.
//
// Requires: ANTHROPIC_API_KEY env var
// Usage: node tag.js
// Output: ./output/snippets.tagged.json

import fs from "fs";

const MOODS = [
  "minimal-snappy",
  "bold-elastic",
  "cinematic-slow",
  "playful-bouncy",
  "luxury-smooth",
];

async function classify(snippet) {
  const prompt = `You are classifying a GSAP animation snippet for a searchable pattern library.

Technique folder name: ${snippet.technique}
Framework: ${snippet.framework}
Extracted params: ${JSON.stringify(snippet.params)}

Code:
\`\`\`
${snippet.code.slice(0, 3000)}
\`\`\`

Respond ONLY with JSON, no markdown fences, no preamble:
{
  "technique": "<short canonical technique name, e.g. 'scroll-triggered card stagger reveal'>",
  "mood": "<one of: ${MOODS.join(", ")}>",
  "description": "<one sentence describing what this animation does, for search retrieval>"
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
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.find(c => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error(`Failed to parse tagging response for ${snippet.id}:`, text);
    return { technique: snippet.technique, mood: "minimal-snappy", description: "" };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY before running this script.");
    process.exit(1);
  }

  const snippets = JSON.parse(fs.readFileSync("output/snippets.json", "utf-8"));
  const tagged = [];

  for (const [i, snippet] of snippets.entries()) {
    process.stdout.write(`Tagging ${i + 1}/${snippets.length}: ${snippet.id}... `);
    const result = await classify(snippet);
    tagged.push({ ...snippet, ...result });
    console.log(`-> ${result.mood} / ${result.technique}`);
    await new Promise(r => setTimeout(r, 300)); // gentle rate limiting
  }

  fs.writeFileSync("output/snippets.tagged.json", JSON.stringify(tagged, null, 2));
  console.log(`\nTagged ${tagged.length} snippets -> output/snippets.tagged.json`);
}

main();