import path from "node:path";
import { writeJson } from "./util.js";

const SOURCE = "openrouter-usage";

export function slimUsageRows(rows) {
  return rows
    .filter((r) => r.model_permaslug && r.model_permaslug !== "other")
    .map((r) => ({
      id: r.model_permaslug.replace(/:.*/, ""),
      variant: r.model_permaslug.includes(":") ? r.model_permaslug.split(":")[1] : null,
      totalTokens: Number(r.total_tokens),
    }))
    .filter((r) => Number.isFinite(r.totalTokens))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

export async function collectUsageWindow({ outDir, date, rows }) {
  const models = slimUsageRows(rows);
  await writeJson(path.join(outDir, `${date}.json`), {
    _meta: {
      source: SOURCE,
      endpoint: "https://openrouter.ai/api/v1/datasets/rankings-daily",
      fetchedAt: new Date().toISOString(),
      date,
      errors: [],
      count: models.length,
    },
    models,
  });
  return models.length;
}
