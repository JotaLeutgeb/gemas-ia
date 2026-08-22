import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, fetchJson, log, todayISO, writeJson } from "./lib/util.js";

const ENDPOINT = "https://huggingface.co/api/models?sort=downloads&direction=-1&limit=1000&full=true";
const SOURCE = "huggingface";
const MAX_MODELS = 500;

function slimModel(model) {
  if (model.pipeline_tag !== "text-generation") return null;
  return {
    id: model.id,
    downloads: typeof model.downloads === "number" ? model.downloads : null,
    likes: typeof model.likes === "number" ? model.likes : null,
    createdAt: model.createdAt ?? null,
    trendingScore: model.trendingScore ?? null,
  };
}

export async function run() {
  const errors = [];
  let models = [];
  try {
    const payload = await fetchJson(ENDPOINT);
    if (!Array.isArray(payload)) throw new Error("unexpected payload: array expected");
    models = payload.map(slimModel).filter(Boolean).slice(0, MAX_MODELS);
    log(SOURCE, `collected ${models.length} text-generation models`);
  } catch (error) {
    errors.push(String(error?.message ?? error));
    log(SOURCE, `FAILED: ${errors[0]}`);
  }
  const snapshot = {
    _meta: { source: SOURCE, endpoint: ENDPOINT, fetchedAt: new Date().toISOString(), date: todayISO(), errors, count: models.length },
    models,
  };
  await writeJson(path.join(ROOT, "data", "snapshots", SOURCE, `${todayISO()}.json`), snapshot);
  return { source: SOURCE, ok: errors.length === 0, count: models.length, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
