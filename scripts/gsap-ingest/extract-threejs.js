// Extracts self-contained three.js example snippets + matching screenshot filenames.
// Usage: node extract-threejs.js <path-to-three.js/examples> <out-dir>
const fs = require("fs");
const path = require("path");

const EXAMPLES_DIR = process.argv[2];
const OUT_DIR = process.argv[3];
const MAX_CODE_CHARS = 30000;

function stripTags(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function dedent(code) {
  const lines = code.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
  let min = Infinity;
  for (const l of lines) {
    if (!l.trim()) continue;
    const m = l.match(/^\t*/)[0].length;
    if (m < min) min = m;
  }
  if (!isFinite(min)) min = 0;
  return lines.map((l) => l.slice(Math.min(min, (l.match(/^\t*/) || [""])[0].length))).join("\n");
}

const files = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".html")).sort();
const shotsDir = path.join(EXAMPLES_DIR, "screenshots");
const shots = new Set(fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir) : []);

const snippets = [];
const skipped = [];

for (const f of files) {
  const id = f.replace(/\.html$/, "");
  const html = fs.readFileSync(path.join(EXAMPLES_DIR, f), "utf8");

  const modMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!modMatch) { skipped.push({ id, reason: "no inline module script" }); continue; }
  const code = dedent(modMatch[1]);
  if (code.length > MAX_CODE_CHARS) { skipped.push({ id, reason: "code too large " + code.length }); continue; }
  if (code.length < 300) { skipped.push({ id, reason: "code too small" }); continue; }

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, id])[1].replace(/^three\.js\s*/i, "").trim();
  const infoMatch = html.match(/<div id="info">([\s\S]*?)<\/div>/);
  const info = infoMatch ? stripTags(infoMatch[1]).replace(/^three\.js\s*/i, "") : "";

  const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const addons = [...new Set(imports.filter((i) => i.startsWith("three/addons/")))];
  const renderer = /WebGPURenderer|three\/webgpu/.test(code) ? "webgpu" : "webgl";
  const usesTSL = /three\/tsl|TSL/.test(code);
  const localAssets = [...new Set([...code.matchAll(/['"`]((?:models|textures|sounds|fonts|files|jsm\/libs)\/[^'"`]+)['"`]/g)].map((m) => m[1]))].slice(0, 12);

  const shot = id + ".jpg";
  const prefix = id.split("_")[0]; // webgl, webgpu, css3d, misc, games ...

  // Shape matches scripts/gsap-ingest/output/snippets.json (what tag.js and load.js expect),
  // plus two extras (imageFile, group) used by tag-3d.js and load-3d.js.
  snippets.push({
    id: "threejs-" + id,
    technique: title || id,
    framework: "vanilla",
    category: "3d",
    sourceFile: "three.js/examples/" + f,
    code,
    params: { renderer, usesTSL, addons, localAssets },
    mood: null,
    description: info || null,
    usageNote: null,
    imageFile: shots.has(shot) ? shot : null,
    group: prefix,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "snippets-3d.json"), JSON.stringify(snippets, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "skipped-3d.json"), JSON.stringify(skipped, null, 2));

const withImg = snippets.filter((s) => s.imageFile).length;
const byGroup = {};
for (const s of snippets) byGroup[s.group] = (byGroup[s.group] || 0) + 1;
console.log("html files:", files.length, "| extracted:", snippets.length, "| skipped:", skipped.length, "| with screenshot:", withImg);
console.log("by group:", byGroup);
console.log("renderer:", { webgl: snippets.filter((s) => s.params.renderer === "webgl").length, webgpu: snippets.filter((s) => s.params.renderer === "webgpu").length });
const reasons = {};
for (const s of skipped) { const k = s.reason.split(" ").slice(0, 2).join(" "); reasons[k] = (reasons[k] || 0) + 1; }
console.log("skip reasons:", reasons);