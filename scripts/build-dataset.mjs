import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, log, readJson, slugify, writeJson } from "./lib/util.js";
import { momentum, normalizeScores, project, scarcityFactor } from "./lib/scoring.js";

const SNAPSHOT_DIR = path.join(ROOT, "data", "snapshots");
const OUTPUT = path.join(ROOT, "public", "data", "dataset.json");

async function listSnapshots(source) {
  const dir = path.join(SNAPSHOT_DIR, source);
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {
    return [];
  }
}

function lastPerDate(series) {
  const byDate = new Map();
  for (const point of series) byDate.set(point.date, point.value);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

function kebabSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadModelMap() {
  try {
    const raw = await readJson(path.join(ROOT, "scripts", "model-map.json"));
    const map = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      if (!key.startsWith("_") && typeof value === "string") map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

async function loadFamousFragments() {
  try {
    const config = await readJson(path.join(ROOT, "config", "famous-models.json"));
    return Array.isArray(config) ? config.map((f) => slugify(f)) : [];
  } catch {
    return [];
  }
}

function isFamous(aliases, famousFragments) {
  return aliases.some((alias) => famousFragments.some((fragment) => alias.includes(fragment)));
}

export async function build() {
  const modelMap = await loadModelMap();
  const famousFragments = await loadFamousFragments();
  const modelsByKey = new Map();

  const ensureModel = (matchKey) => {
    if (!modelsByKey.has(matchKey)) {
      modelsByKey.set(matchKey, { matchKey, aliases: [], openrouter: {}, huggingface: {} });
    }
    return modelsByKey.get(matchKey);
  };

  for (const alias of Object.keys(modelMap)) {
    const canonical = modelMap[alias];
    if (canonical && canonical !== alias) ensureModel(canonical).aliases.push(alias);
  }

  const sourcesSummary = {};

  const orFiles = await listSnapshots("openrouter");
  for (const file of orFiles) {
    const date = file.replace(".json", "");
    let snapshot;
    try {
      snapshot = await readJson(path.join(SNAPSHOT_DIR, "openrouter", file));
    } catch (error) {
      log("build-dataset", `skipping corrupt snapshot ${file}: ${error.message}`);
      continue;
    }
    for (const record of snapshot.models ?? []) {
      const key = modelMap[slugify(record.id)] ?? slugify(record.id);
      const model = ensureModel(key);
      model.aliases.push(slugify(record.id));
      const or = model.openrouter;
      or.id ??= record.id;
      or.name ??= record.name;
      or.provider ??= typeof record.id === "string" ? record.id.split("/")[0] : null;
      or.createdAt = minIso(or.createdAt, record.createdAt);
      if (record.contextLength != null) or.contextLength = record.contextLength;
      if (record.promptUsdPerM != null) (or.promptUsdPerMSeries ||= []).push({ date, value: record.promptUsdPerM });
      if (record.completionUsdPerM != null) (or.completionUsdPerMSeries ||= []).push({ date, value: record.completionUsdPerM });
    }
    sourcesSummary.openrouter = { lastSnapshot: date, modelsInSnapshot: snapshot._meta?.count ?? null };
  }

  const hfFiles = await listSnapshots("huggingface");
  for (const file of hfFiles) {
    const date = file.replace(".json", "");
    let snapshot;
    try {
      snapshot = await readJson(path.join(SNAPSHOT_DIR, "huggingface", file));
    } catch (error) {
      log("build-dataset", `skipping corrupt snapshot ${file}: ${error.message}`);
      continue;
    }
    for (const record of snapshot.models ?? []) {
      const key = modelMap[slugify(record.id)] ?? slugify(record.id);
      const model = ensureModel(key);
      model.aliases.push(slugify(record.id));
      const hf = model.huggingface;
      hf.id ??= record.id;
      hf.provider ??= typeof record.id === "string" ? record.id.split("/")[0] : null;
      hf.createdAt = minIso(hf.createdAt, record.createdAt);
      if (record.downloads != null) (hf.downloadsSeries ||= []).push({ date, value: record.downloads });
      if (record.likes != null) (hf.likesSeries ||= []).push({ date, value: record.likes });
      if (record.trendingScore != null) hf.trendingScore = record.trendingScore;
    }
    sourcesSummary.huggingface = { lastSnapshot: date, modelsInSnapshot: snapshot._meta?.count ?? null };
  }

  const usedUrlSlugs = new Map();
  const models = [];
  for (const entry of modelsByKey.values()) {
    const aliases = [...new Set(entry.aliases)];
    const primaryId = entry.openrouter.id ?? entry.huggingface.id;
    const displayName =
      entry.openrouter.name ??
      entry.huggingface.id ??
      primaryId ??
      entry.matchKey;
    const provider = entry.openrouter.provider ?? entry.huggingface.provider ?? null;
    const downloadsSeries = lastPerDate(entry.huggingface.downloadsSeries ?? []);
    const likesSeries = lastPerDate(entry.huggingface.likesSeries ?? []);
    const promptSeries = lastPerDate(entry.openrouter.promptUsdPerMSeries ?? []);
    const completionSeries = lastPerDate(entry.openrouter.completionUsdPerMSeries ?? []);
    const latestDownloads = downloadsSeries.at(-1)?.value ?? null;
    const totalLikes = likesSeries.at(-1)?.value ?? null;
    const mom = momentum(downloadsSeries);

    let urlSlug = kebabSlug(primaryId || displayName) || entry.matchKey;
    if (usedUrlSlugs.has(urlSlug)) urlSlug = `${urlSlug}-${entry.matchKey.slice(-6)}`;
    usedUrlSlugs.set(urlSlug, true);

    models.push({
      matchKey: entry.matchKey,
      urlSlug,
      name: displayName,
      provider,
      createdAt: minIso(entry.openrouter.createdAt, entry.huggingface.createdAt),
      contextLength: entry.openrouter.contextLength ?? null,
      promptUsdPerM: promptSeries.at(-1)?.value ?? null,
      completionUsdPerM: completionSeries.at(-1)?.value ?? null,
      downloads: latestDownloads,
      likes: totalLikes,
      trendingScore: entry.huggingface.trendingScore ?? null,
      famous: isFamous(aliases, famousFragments),
      links: buildLinks(entry),
      series: {
        downloads: downloadsSeries,
        likes: likesSeries,
        promptUsdPerM: promptSeries,
        completionUsdPerM: completionSeries,
      },
      metrics: {
        momentum: mom,
        forecastDownloads90d: project(downloadsSeries, 90),
        forecastDownloads180d: project(downloadsSeries, 180),
      },
    });
  }

  const momentumNorm = normalizeScores(models.map((m) => m.metrics.momentum));
  for (const model of models) {
    const factor = scarcityFactor(model.downloads);
    const norm = momentumNorm(model.metrics.momentum);
    model.metrics.scarcityFactor = factor;
    model.gemScore = !model.famous && norm !== null ? round6(norm * factor) : null;
  }

  models.sort((a, b) => (b.gemScore ?? -1) - (a.gemScore ?? -1) || (b.downloads ?? 0) - (a.downloads ?? 0));

  const dataset = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    sources: sourcesSummary,
    totals: { models: models.length },
    models,
  };
  await writeJson(OUTPUT, dataset);
  log("build-dataset", `dataset written with ${models.length} models -> ${path.relative(ROOT, OUTPUT)}`);
  return dataset;
}

function minIso(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function buildLinks(entry) {
  const links = {};
  if (entry.huggingface.id) links.huggingface = `https://huggingface.co/${entry.huggingface.id}`;
  if (entry.openrouter.id) links.openrouter = `https://openrouter.ai/${entry.openrouter.id}`;
  return links;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
