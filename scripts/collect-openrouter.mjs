import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, fetchJson, log, todayISO, writeJson } from "./lib/util.js";

const ENDPOINT = "https://openrouter.ai/api/v1/models";
const SOURCE = "openrouter";
const USD_PER_TOKEN = 1_000_000;

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function slimModel(model) {
  const outputModalities = model?.architecture?.output_modalities;
  if (Array.isArray(outputModalities) && !outputModalities.includes("text")) return null;
  const pricing = model.pricing ?? {};
  return {
    id: model.id,
    name: model.name ?? model.id,
    createdAt: typeof model.created === "number" ? new Date(model.created * 1000).toISOString() : null,
    contextLength: typeof model.context_length === "number" ? model.context_length : null,
    promptUsdPerM: toNumber(pricing.prompt) !== null ? round6(toNumber(pricing.prompt) * USD_PER_TOKEN) : null,
    completionUsdPerM: toNumber(pricing.completion) !== null ? round6(toNumber(pricing.completion) * USD_PER_TOKEN) : null,
    modality: model?.architecture?.modality ?? null,
  };
}

export async function run({ force = false } = {}) {
  const outPath = path.join(ROOT, "data", "snapshots", SOURCE, `${todayISO()}.json`);
  if (!force) {
    try {
      await fs.access(outPath);
      log(SOURCE, `snapshot ${todayISO()} ya existe, se conserva (append-only; usá --force para reemplazar)`);
      return { source: SOURCE, ok: true, skipped: true, count: null, errors: [] };
    } catch {}
  }
  const errors = [];
  let models = [];
  try {
    const payload = await fetchJson(ENDPOINT);
    if (!payload || !Array.isArray(payload.data)) throw new Error("unexpected payload: data[] expected");
    models = payload.data.map(slimModel).filter(Boolean);
    log(SOURCE, `collected ${models.length} text-capable models`);
  } catch (error) {
    errors.push(String(error?.message ?? error));
    log(SOURCE, `FAILED: ${errors[0]}`);
  }
  const snapshot = {
    _meta: { source: SOURCE, endpoint: ENDPOINT, fetchedAt: new Date().toISOString(), date: todayISO(), errors, count: models.length },
    models,
  };
  await writeJson(outPath, snapshot);
  return { source: SOURCE, ok: errors.length === 0, count: models.length, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
