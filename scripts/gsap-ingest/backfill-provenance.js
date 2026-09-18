import fs from "fs";
import { Client } from "pg";

// Folder name (first path segment of sourceFile) -> { repo, license }
// "unconfirmed" means no verified LICENSE file was found for that repo —
// do not represent these patterns as freely reusable to end users.
const REPO_MAP = {
  "awesome-gsap": { repo: "shubh-agrawal/awesome-gsap", license: "MIT" },
  "react-native-ui-lib": { repo: "wix/react-native-ui-lib", license: "MIT" },
  "react-native-ui-blueprint": { repo: "nidorx/react-native-ui-blueprint", license: "MIT" },
  "galio": { repo: "galio-org/galio", license: "MIT" },
  "motion": { repo: "motiondivision/motion", license: "MIT" },
  "framer-motion-template": { repo: "AJ1732/framer-motion-template", license: "unconfirmed" },
  "saas-landing-page-template": { repo: "karthikmudunuri/saas-landing-page-template", license: "MIT" },
};

function loadSnippets(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

async function main() {
  const original29 = loadSnippets("./snippets.json");
  const expansion350 = loadSnippets("./output/snippets.json");
  const all = [...original29, ...expansion350];

  if (all.length === 0) {
    console.error("No snippets found — check that snippets.json and output/snippets.json exist here.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let updated = 0;
  let unmapped = [];

  for (const s of all) {
    const folder = s.sourceFile ? s.sourceFile.split("/")[0] : null;
    const mapping = folder ? REPO_MAP[folder] : null;

    if (!mapping) {
      unmapped.push(s.id);
      continue;
    }

    const result = await client.query(
      `UPDATE "GsapAnimationPattern" SET "sourceRepo" = $1, "license" = $2 WHERE id = $3`,
      [mapping.repo, mapping.license, s.id]
    );
    if (result.rowCount > 0) updated++;
  }

  await client.end();

  console.log(`Backfilled sourceRepo/license on ${updated}/${all.length} patterns.`);
  if (unmapped.length > 0) {
    console.log(`Unmapped (no matching folder in REPO_MAP), left untouched:`, unmapped);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});