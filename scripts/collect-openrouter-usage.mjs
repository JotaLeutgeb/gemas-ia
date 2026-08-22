import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, fetchJson, log, loadEnv, writeJson } from "./lib/util.js";

const SOURCE = "openrouter-usage";
const ENDPOINT = "https://openrouter.ai/api/v1/datasets/rankings-daily";
const DAY_MS = 86400000;
const DATASET_START = "2025-01-01";

function slimRows(rows) {
  return rows
    .filter((r) => r.model_permaslug && r.model_permaslug !== "other")
    .map((r) => ({
      id: r.model_permaslug.replace(/:.*/, ""),
      variant: r.model_permaslug.includes(":") ? r.model_permaslug.split(":")[1] : null,
      totalTokens: Number(r.total_tokens),
    }))
    .filter((r) => Number.isFinite(r.totalTokens));
}

export async function run({ days = 3 } = {}) {
  loadEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log(SOURCE, "sin OPENROUTER_API_KEY en el entorno, se omite (el cron la tiene como secret)");
    return { source: SOURCE, ok: true, skipped: true, reason: "no-key", count: 0, errors: [] };
  }

  const errors = [];
  let written = 0;
  for (let i = days; i >= 1; i--) {
    const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    if (date < DATASET_START) continue;
    const outPath = path.join(ROOT, "data", "snapshots", SOURCE, `${date}.json`);
    try {
      await fs.access(outPath);
      continue;
    } catch {}
    try {
      const payload = await fetchJson(`${ENDPOINT}?start_date=${date}&end_date=${date}`, {
        retries: 3,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const models = slimRows(payload?.data ?? []);
      await writeJson(outPath, {
        _meta: { source: SOURCE, endpoint: ENDPOINT, fetchedAt: new Date().toISOString(), date, errors: [], count: models.length },
        models,
      });
      written++;
    } catch (error) {
      errors.push(`${date}: ${error.message}`);
    }
  }
  log(SOURCE, `${written} snapshots de uso escritos${errors.length ? `, ${errors.length} errores` : ""}`);
  return { source: SOURCE, ok: errors.length === 0, count: written, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run({ days: Number(process.argv[2] ?? 3) });
}
