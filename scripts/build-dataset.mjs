import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, log, readJson, slugify, writeJson } from "./lib/util.js";
import { momentum, project } from "./lib/scoring.js";
import { detectAltas, detectBajas, detectPriceDrops } from "./lib/movements.js";
import { buildBenchmarkIndex, matchBenchmarks } from "./lib/benchmark-match.js";
import { classifyLab, isExcludedSlug, loadLabs } from "./lib/labs.js";
import {
  blendedPrice,
  computeCodeQuality,
  efficiencyFrontier,
  valueScore as computeValueScore,
} from "./lib/quality.js";

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

function isCatalogVariant(id) {
  return typeof id === "string" && id.includes(":");
}

function hasTextOutput(record) {
  if (typeof record.modality !== "string" || !record.modality.includes("->")) return true;
  const output = record.modality.split("->")[1] ?? "";
  return !/image|audio|video/i.test(output);
}

function canonicalUsageId(id) {
  if (typeof id !== "string") return id;
  return id
    .replace(/:[a-z-]+$/, "")
    .replace(/-((?:19|20)\d{6})$/, "")
    .replace(/-((?:19|20)\d{2}-\d{2}-\d{2})$/, "");
}

export async function build() {
  const modelMap = await loadModelMap();
  const { labs, excludeFragments } = await loadLabs();
  if (labs.length === 0) log("build-dataset", "ADVERTENCIA: config/labs.json vacío o ilegible");

  const modelsByKey = new Map();

  const ensureModel = (matchKey, labId) => {
    if (!modelsByKey.has(matchKey)) {
      modelsByKey.set(matchKey, {
        matchKey,
        aliases: [],
        openrouter: {},
        lab: labs.find((l) => l.id === labId) ?? null,
        excluded: false,
      });
    }
    return modelsByKey.get(matchKey);
  };

  for (const alias of Object.keys(modelMap)) {
    const canonical = modelMap[alias];
    if (canonical && canonical !== alias) ensureModel(canonical, null);
  }

  const sourcesSummary = {};
  const presenceOR = new Map();
  const presenceORU = new Map();

  function markPresence(presence, date, key) {
    if (!presence.has(date)) presence.set(date, new Set());
    presence.get(date).add(key);
  }

  const orFiles = await listSnapshots("openrouter");
  let skippedCatalog = 0;
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
      if (isCatalogVariant(record.id) || !hasTextOutput(record)) {
        skippedCatalog++;
        continue;
      }
      const lab = classifyLab(labs, { id: canonicalUsageId(record.id) });
      if (!lab) {
        skippedCatalog++;
        continue;
      }
      const canonicalId = canonicalUsageId(record.id);
      const key = modelMap[slugify(canonicalId)] ?? slugify(canonicalId);
      const model = ensureModel(key, lab.id);
      model.aliases.push(slugify(record.id), slugify(canonicalId));
      if (!model.excluded && isExcludedSlug(excludeFragments, [...new Set(model.aliases)])) {
        model.excluded = true;
        skippedCatalog++;
      }
      if (model.excluded) continue;
      markPresence(presenceOR, date, key);
      const or = model.openrouter;
      or.id ??= record.id;
      or.name ??= record.name;
      or.provider ??= typeof record.id === "string" ? record.id.split("/")[0] : null;
      or.createdAt = minIso(or.createdAt, record.createdAt);
      if (record.contextLength != null) or.contextLength = record.contextLength;
      if (record.promptUsdPerM != null) (or.promptUsdPerMSeries ||= []).push({ date, value: record.promptUsdPerM });
      if (record.completionUsdPerM != null) (or.completionUsdPerMSeries ||= []).push({ date, value: record.completionUsdPerM });
    }
    sourcesSummary.openrouter = {
      lastSnapshot: date,
      modelsInSnapshot: snapshot._meta?.count ?? null,
      ok: (snapshot._meta?.errors ?? []).length === 0,
      errors: snapshot._meta?.errors ?? [],
      fetchedAt: snapshot._meta?.fetchedAt ?? null,
    };
  }

  const usageFiles = await listSnapshots("openrouter-usage");
  const usageByDateModel = new Map();
  for (const file of usageFiles) {
    const date = file.replace(".json", "");
    let snapshot;
    try {
      snapshot = await readJson(path.join(SNAPSHOT_DIR, "openrouter-usage", file));
    } catch (error) {
      log("build-dataset", `skipping corrupt usage snapshot ${file}: ${error.message}`);
      continue;
    }
    for (const record of snapshot.models ?? []) {
      const canonicalId = canonicalUsageId(record.id);
      const lab = classifyLab(labs, { id: canonicalId });
      if (!lab) continue;
      const key = modelMap[slugify(canonicalId)] ?? slugify(canonicalId);
      const model = ensureModel(key, lab.id);
      model.aliases.push(slugify(canonicalId));
      if (!model.excluded && isExcludedSlug(excludeFragments, [...new Set(model.aliases)])) {
        model.excluded = true;
      }
      if (model.excluded) continue;
      markPresence(presenceORU, date, key);
      const cellKey = `${date}|${key}`;
      usageByDateModel.set(cellKey, (usageByDateModel.get(cellKey) ?? 0) + (record.totalTokens ?? 0));
    }
    sourcesSummary.openrouterUsage = {
      lastSnapshot: date,
      modelsInSnapshot: snapshot._meta?.count ?? null,
      ok: (snapshot._meta?.errors ?? []).length === 0,
      errors: snapshot._meta?.errors ?? [],
      fetchedAt: snapshot._meta?.fetchedAt ?? null,
    };
  }
  for (const [cellKey, total] of usageByDateModel) {
    const [date, key] = cellKey.split("|");
    const model = ensureModel(key);
    (model.openrouter.usageTokensSeries ||= []).push({ date, value: total });
  }

  const usedUrlSlugs = new Map();
  const models = [];
  for (const entry of modelsByKey.values()) {
    if (entry.lab === null || entry.excluded) continue;
    const primaryId = entry.openrouter.id ?? null;
    const displayName = entry.openrouter.name ?? primaryId ?? entry.matchKey;
    const usageSeries = lastPerDate(entry.openrouter.usageTokensSeries ?? []);
    const promptSeries = lastPerDate(entry.openrouter.promptUsdPerMSeries ?? []);
    const completionSeries = lastPerDate(entry.openrouter.completionUsdPerMSeries ?? []);
    const promptUsdPerM = promptSeries.at(-1)?.value ?? null;
    const completionUsdPerM = completionSeries.at(-1)?.value ?? null;

    let urlSlug = kebabSlug(primaryId || displayName) || entry.matchKey;
    if (usedUrlSlugs.has(urlSlug)) urlSlug = `${urlSlug}-${entry.matchKey.slice(-6)}`;
    usedUrlSlugs.set(urlSlug, true);

    models.push({
      matchKey: entry.matchKey,
      urlSlug,
      name: displayName,
      labId: entry.lab.id,
      labLabel: entry.lab.label,
      provider: entry.openrouter.provider ?? null,
      createdAt: minIso(entry.openrouter.createdAt, null),
      contextLength: entry.openrouter.contextLength ?? null,
      promptUsdPerM,
      completionUsdPerM,
      blendedUsdPerM: blendedPrice(promptUsdPerM, completionUsdPerM),
      links: buildLinks(entry),
      series: {
        usageTokens: usageSeries,
        promptUsdPerM: promptSeries,
        completionUsdPerM: completionSeries,
      },
      metrics: {
        momentumUsage: momentum(usageSeries),
        forecastUsage90d: project(usageSeries, 90),
        forecastUsage180d: project(usageSeries, 180),
      },
      quality: null,
      benchmarks: [],
      onEfficiencyFrontier: false,
      performanceRank: null,
      valueRank: null,
    });
  }

  let benchmarkIndex = [];
  let latestBenchFile = null;
  try {
    const benchDir = path.join(SNAPSHOT_DIR, "benchmarks");
    const benchFiles = (await fs.readdir(benchDir)).filter((f) => f.endsWith(".json") && f !== ".gitkeep").sort();
    latestBenchFile = benchFiles[benchFiles.length - 1] ?? null;
    if (latestBenchFile) {
      const benchSnapshot = await readJson(path.join(benchDir, latestBenchFile));
      benchmarkIndex = buildBenchmarkIndex(benchSnapshot.tables);
      sourcesSummary.benchmarks = {
        lastSnapshot: latestBenchFile.replace(".json", ""),
        ok: true,
        errors: [],
        fetchedAt: benchSnapshot._meta?.fetchedAt ?? null,
      };
    }
  } catch (error) {
    log("build-dataset", `benchmarks no disponibles: ${error.message}`);
    sourcesSummary.benchmarks = { lastSnapshot: null, ok: false, errors: [error.message], fetchedAt: null };
  }

  const byMatchKey = new Map(models.map((m) => [m.matchKey, m]));
  const aliasesByKey = new Map([...modelsByKey.values()].map((e) => [e.matchKey, [...new Set(e.aliases)]]));

  let matchedModels = 0;
  let matchedScores = 0;
  if (benchmarkIndex.length > 0) {
    for (const model of models) {
      const matches = matchBenchmarks({
        aliases: aliasesByKey.get(model.matchKey) ?? [model.matchKey],
        index: benchmarkIndex,
      });
      if (matches.length > 0) {
        model.benchmarks = matches.sort((a, b) => a.benchmark.localeCompare(b.benchmark));
        matchedModels++;
        matchedScores += matches.length;
      }
      model.quality = computeCodeQuality(model.benchmarks);
    }
    log("build-dataset", `benchmarks: ${matchedScores} scores para ${matchedModels} modelos (${latestBenchFile})`);
  }

  for (const model of models) {
    model.valueScore =
      model.quality !== null ? computeValueScore(model.quality.index, model.blendedUsdPerM) : null;
  }

  const frontier = efficiencyFrontier(
    models.map((m) => ({
      matchKey: m.matchKey,
      blendedUsdPerM: m.blendedUsdPerM,
      qualityIndex: m.quality?.index ?? Number.NaN,
    }))
  );
  for (const model of models) model.onEfficiencyFrontier = frontier.has(model.matchKey);

  assignRanks(models, "performanceRank", (m) => m.quality?.index ?? null);
  assignRanks(models, "valueRank", (m) => m.valueScore);

  models.sort(
    (a, b) =>
      (b.quality?.index ?? -1) - (a.quality?.index ?? -1) ||
      (b.valueScore ?? -1) - (a.valueScore ?? -1) ||
      a.name.localeCompare(b.name)
  );

  const toMovement = (source, dateField) => (ev) => ({
    urlSlug: byMatchKey.get(ev.matchKey)?.urlSlug ?? ev.matchKey,
    name: byMatchKey.get(ev.matchKey)?.name ?? ev.matchKey,
    labLabel: byMatchKey.get(ev.matchKey)?.labLabel ?? null,
    source,
    [dateField]: ev[dateField],
    qualityIndex: byMatchKey.get(ev.matchKey)?.quality?.index ?? null,
    promptUsdPerM: byMatchKey.get(ev.matchKey)?.promptUsdPerM ?? null,
  });

  const altas = [
    ...detectAltas(presenceOR).map(toMovement("openrouter", "firstSeen")),
    ...detectAltas(presenceORU).map(toMovement("openrouter-usage", "firstSeen")),
  ]
    .sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1))
    .slice(0, 50);

  const bajas = detectBajas(presenceOR)
    .map(toMovement("openrouter", "lastSeen"))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, 50);

  const priceDrops = [];
  for (const model of models) {
    for (const field of ["promptUsdPerMSeries", "completionUsdPerMSeries"]) {
      for (const event of detectPriceDrops(lastPerDate(model.series[field.replace(/Series$/, "")] ?? []))) {
        priceDrops.push({
          urlSlug: model.urlSlug,
          name: model.name,
          field: field === "promptUsdPerMSeries" ? "entrada" : "salida",
          ...event,
        });
      }
    }
  }
  priceDrops.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.pctChange - b.pctChange));
  const movements = {
    altas,
    bajas: bajas.filter((b) => !altas.some((a) => a.urlSlug === b.urlSlug)),
    priceDrops: priceDrops.slice(0, 50),
  };

  const labsSummary = {};
  for (const model of models) {
    labsSummary[model.labId] ??= { id: model.labId, label: model.labLabel, modelCount: 0 };
    labsSummary[model.labId].modelCount++;
  }

  const dataset = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 3,
    sources: sourcesSummary,
    totals: { models: models.length, withQuality: models.filter((m) => m.quality !== null).length },
    labs: Object.values(labsSummary).sort((a, b) => b.modelCount - a.modelCount),
    movements,
    models,
  };
  await writeJson(OUTPUT, dataset);
  log(
    "build-dataset",
    `dataset written with ${models.length} models (${skippedCatalog} registros de catálogo filtrados) -> ${path.relative(ROOT, OUTPUT)}`
  );
  return dataset;
}

function assignRanks(models, rankField, metricFn) {
  const eligible = models
    .filter((m) => metricFn(m) !== null && Number.isFinite(metricFn(m)))
    .sort((a, b) => metricFn(b) - metricFn(a));
  eligible.forEach((model, i) => {
    model[rankField] = i + 1;
  });
}

function minIso(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function buildLinks(entry) {
  const links = {};
  if (entry.openrouter.id) links.openrouter = `https://openrouter.ai/${entry.openrouter.id}`;
  return links;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
