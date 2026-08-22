import { run as collectOpenRouter } from "./collect-openrouter.mjs";

const force = process.argv.includes("--force");
const results = [];
for (const collector of [collectOpenRouter]) {
  results.push(await collector({ force }));
}
const succeeded = results.filter((r) => r.ok);
console.log(`collect-all finished: ${succeeded.length}/${results.length} sources OK`);
results.forEach((r) => {
  const detail = r.skipped ? "skipped (ya existe)" : `${r.count} models`;
  console.log(`  ${r.ok ? "OK " : "ERR"} ${r.source}: ${detail}${r.errors.length ? ` | ${r.errors.join("; ")}` : ""}`);
});
if (succeeded.length === 0) process.exit(1);
