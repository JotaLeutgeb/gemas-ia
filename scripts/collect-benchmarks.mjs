import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { ROOT, fetchJsonBuffer, log, parseCsv, todayISO, writeJson } from "./lib/util.js";

const SOURCE = "benchmarks";
const ZIP_URL = "https://epoch.ai/data/benchmark_data.zip";
const OUT_DIR = path.join(ROOT, "data", "snapshots", SOURCE);
const RETENTION_FILES = 8;
const EXCLUDED_FILES = new Set(["README.md", "additional_eci_data/eci_benchmark_difficulties_and_slopes.csv"]);

export async function run() {
  const errors = [];
  let tables = {};
  let rowCount = 0;
  try {
    const buffer = await fetchJsonBuffer(ZIP_URL, { timeoutMs: 120000 });
    const zip = unzipSync(buffer);
    for (const [filePath, content] of Object.entries(zip)) {
      if (!filePath.endsWith(".csv") || EXCLUDED_FILES.has(filePath)) continue;
      const benchmark = path.basename(filePath, ".csv").replace(/_external$/, "");
      const rows = parseCsv(strFromU8(content));
      if (rows.length < 2) continue;
      const [headers, ...data] = rows;
      const idx = headerIndex(headers);
      const records = [];
      for (const row of data) {
        const modelVersion = row[idx.modelVersion];
        const score = Number.parseFloat(row[idx.score]);
        if (!modelVersion || !Number.isFinite(score)) continue;
        records.push({
          modelVersion,
          score,
          releaseDate: row[idx.releaseDate] || null,
          organization: row[idx.organization] || null,
        });
        rowCount++;
      }
      if (records.length > 0) tables[benchmark] = { benchmark, source: filePath.includes("_external") ? "external" : "epoch", records };
    }
    log(SOURCE, `${Object.keys(tables).length} benchmarks parseados, ${rowCount} scores`);
  } catch (error) {
    errors.push(String(error?.message ?? error));
    log(SOURCE, `FAILED: ${errors[0]}`);
  }

  const snapshot = {
    _meta: {
      source: SOURCE,
      endpoint: ZIP_URL,
      fetchedAt: new Date().toISOString(),
      date: todayISO(),
      errors,
      count: rowCount,
      referenceSnapshot: true,
    },
    tables,
  };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await writeJson(path.join(OUT_DIR, `${todayISO()}.json`), snapshot);

  const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith(".json")).sort();
  for (const old of files.slice(0, Math.max(files.length - RETENTION_FILES, 0))) {
    await fs.rm(path.join(OUT_DIR, old));
  }
  return { source: SOURCE, ok: errors.length === 0, count: rowCount, errors };
}

function headerIndex(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  let score = -1;
  for (const candidate of ["mean_score", "eci score", "average", "accuracy"]) {
    score = lower.findIndex((h) => h === candidate || h.includes(candidate));
    if (score >= 0 && !lower[score].includes("error")) break;
    score = -1;
  }
  if (score < 0) score = lower.findIndex((h) => h === "em");
  if (score < 0) score = lower.findIndex((h) => h.includes("score") && !h.includes("error"));
  return {
    modelVersion: lower.indexOf("model version") >= 0 ? lower.indexOf("model version") : 0,
    score,
    releaseDate: lower.findIndex((h) => h.includes("release date")),
    organization: lower.findIndex((h) => h.includes("organization")),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
