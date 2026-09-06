import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`SELECT id, category FROM "GsapAnimationPattern" LIMIT 5;`);
  console.log(res.rows);
  await client.end();
}

main();