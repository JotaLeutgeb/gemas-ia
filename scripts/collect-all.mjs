import { run as collectOpenRouter } from "./collect-openrouter.mjs";
import { run as collectHuggingFace } from "./collect-huggingface.mjs";

const results = [];
for (const collector of [collectOpenRouter, collectHuggingFace]) {
  results.push(await collector());
}
const succeeded = results.filter((r) => r.ok);
console.log(`collect-all finished: ${succeeded.length}/${results.length} sources OK`);
results.forEach((r) => console.log(`  ${r.ok ? "OK " : "ERR"} ${r.source}: ${r.count} models${r.errors.length ? ` | ${r.errors.join("; ")}` : ""}`));
if (succeeded.length === 0) process.exit(1);
