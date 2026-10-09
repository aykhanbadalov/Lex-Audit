// Fails the build when a production bundle carries development leftovers or has grown past its budget.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const problems = [];

if (existsSync(join(dist, "mockServiceWorker.js"))) problems.push("dist/mockServiceWorker.js must not be deployed");

const assets = readdirSync(join(dist, "assets"));
for (const name of assets) {
  if (!/\.(js|mjs|css)$/.test(name)) continue;
  const text = readFileSync(join(dist, "assets", name), "utf8");
  for (const marker of ["lexaudit.test", "mockServiceWorker", "demo1234"]) {
    if (text.includes(marker)) problems.push(`assets/${name} contains "${marker}" (mock data leaked into the build)`);
  }
}

// What a first visit must download: the scripts and styles that index.html loads eagerly.
const html = readFileSync(join(dist, "index.html"), "utf8");
const eager = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
const eagerBytes = eager.reduce((sum, file) => sum + statSync(join(dist, file)).size, 0);
const BUDGET = 700 * 1024;
if (eagerBytes > BUDGET)
  problems.push(`first-load assets are ${Math.round(eagerBytes / 1024)} KB, budget is ${BUDGET / 1024} KB`);

if (problems.length > 0) {
  console.error(`check-dist failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`check-dist ok: ${eager.length} eager files, ${Math.round(eagerBytes / 1024)} KB`);
