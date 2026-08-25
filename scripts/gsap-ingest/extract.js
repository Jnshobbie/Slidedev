// extract.js — Day 1: walk ingested repos, pull out individual GSAP
// animation snippets, and save them as a structured JSON dataset
// ready for the LLM tagging pass (tag.js) and pgvector loading.
//
// Usage: node extract.js
// Output: ./output/snippets.json

import fs from "fs";
import path from "path";

const SOURCES = [
  {
    repoDir: "awesome-gsap/html/modules",
    framework: "vanilla",
    // each subfolder is a technique module, e.g. card-reveals/
    type: "module-dir",
  },
  {
    repoDir: "awesome-gsap/react/src/components",
    framework: "react",
    type: "component-dir",
  },
];

function slugToTechnique(slug) {
  // "card-reveals" -> "card-reveals" (kept as-is, used as initial
  // technique tag; refined further in the LLM tagging pass)
  return slug.toLowerCase();
}

function extractParams(code) {
  // Lightweight param extraction — good enough to hand to the LLM
  // tagging step as hints, not meant to be a full JS parser.
  const ease = [...code.matchAll(/ease:\s*["']([^"']+)["']/g)].map(m => m[1]);
  const duration = [...code.matchAll(/duration:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
  const stagger = [...code.matchAll(/stagger:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
  const usesScrollTrigger = /ScrollTrigger/.test(code);
  const usesTimeline = /gsap\.timeline/.test(code);
  return {
    ease: [...new Set(ease)],
    duration: duration.length ? duration : null,
    stagger: stagger.length ? stagger : null,
    usesScrollTrigger,
    usesTimeline,
  };
}

function walkModuleDir(baseDir, framework) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleDir = path.join(baseDir, entry.name);
    const files = fs.readdirSync(moduleDir);
    const codeFile = files.find(f => /\.(js|jsx|ts|tsx)$/.test(f));
    if (!codeFile) continue;

    const code = fs.readFileSync(path.join(moduleDir, codeFile), "utf-8");
    if (!/gsap/i.test(code)) continue; // skip non-GSAP files

    results.push({
      id: `${framework}-${entry.name}`,
      technique: slugToTechnique(entry.name),
      framework,
      sourceFile: path.join(moduleDir, codeFile),
      code,
      params: extractParams(code),
      // filled in by the tagging pass:
      mood: null,
      description: null,
    });
  }
  return results;
}

function walkComponentDir(baseDir, framework) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const compDir = path.join(baseDir, entry.name);
    const indexFile = ["index.tsx", "index.ts", "index.jsx"]
      .map(f => path.join(compDir, f))
      .find(f => fs.existsSync(f));
    if (!indexFile) continue;

    const code = fs.readFileSync(indexFile, "utf-8");
    if (!/gsap/i.test(code)) continue;

    results.push({
      id: `${framework}-${entry.name}`,
      technique: slugToTechnique(entry.name),
      framework,
      sourceFile: indexFile,
      code,
      params: extractParams(code),
      mood: null,
      description: null,
    });
  }
  return results;
}

function main() {
  let all = [];
  for (const src of SOURCES) {
    const walker = src.type === "module-dir" ? walkModuleDir : walkComponentDir;
    const found = walker(src.repoDir, src.framework);
    console.log(`Found ${found.length} snippets in ${src.repoDir}`);
    all = all.concat(found);
  }

  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync("output/snippets.json", JSON.stringify(all, null, 2));
  console.log(`\nTotal snippets extracted: ${all.length}`);
  console.log("Saved to output/snippets.json");
}

main();