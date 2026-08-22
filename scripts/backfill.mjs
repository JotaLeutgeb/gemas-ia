import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, fetchJson, log, loadEnv, dateRange, writeJson } from "./lib/util.js";
import { collectUsageWindow } from "./lib/openrouter-usage.js";

const DAY_MS = 86400000;
const MAX_CHUNK_DAYS = 366;
const DATASET_START = process.env.BACKFILL_FROM ?? "2025-01-01";

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from") opts.from = args[++i];
    if (args[i] === "--to") opts.to = args[++i];
    if (args[i] === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

function chunkedRange(fromISO, toISO) {
  const chunks = [];
  let cursor = Date.parse(fromISO);
  const end = Date.parse(toISO);
  while (cursor <= end) {
    const chunkEnd = Math.min(cursor + (MAX_CHUNK_DAYS - 1) * DAY_MS, end);
    chunks.push([new Date(cursor).toISOString().slice(0, 10), new Date(chunkEnd).toISOString().slice(0, 10)]);
    cursor = chunkEnd + DAY_MS;
  }
  return chunks;
}

export async function backfillOpenRouterUsage({ from = DATASET_START, to, dryRun = false } = {}) {
  loadEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log("backfill", "sin OPENROUTER_API_KEY: backfill de uso imposible");
    process.exitCode = 1;
    return;
  }
  const endDate = to ?? new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "data", "snapshots", "openrouter-usage");
  await fs.mkdir(outDir, { recursive: true });

  const existing = new Set((await fs.readdir(outDir).catch(() => [])).map((f) => f.replace(".json", "")));
  const wanted = dateRange(from < DATASET_START ? DATASET_START : from, endDate);
  const pending = wanted.filter((date) => !existing.has(date));
  if (pending.length === 0) {
    log("backfill", "uso de OpenRouter ya completo, nada que hacer");
    return;
  }

  const firstPending = pending[0];
  const lastPending = pending[pending.length - 1];
  const chunks = chunkedRange(firstPending, lastPending).filter(([cFrom, cTo]) => {
    return dateRange(cFrom, cTo).some((d) => !existing.has(d));
  });

  log("backfill", `uso OpenRouter: ${pending.length} fechas pendientes en ${chunks.length} request(s)`);

  let writtenFiles = 0;
  for (const [chunkFrom, chunkTo] of chunks) {
    if (dryRun) {
      log("backfill", `[dry-run] pediría ${chunkFrom} → ${chunkTo}`);
      continue;
    }
    const payload = await fetchJson(
      `https://openrouter.ai/api/v1/datasets/rankings-daily?start_date=${chunkFrom}&end_date=${chunkTo}`,
      { retries: 3, timeoutMs: 120000, headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const byDate = new Map();
    for (const row of payload?.data ?? []) {
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date).push(row);
    }
    for (const [date, rows] of byDate) {
      if (existing.has(date)) continue;
      await collectUsageWindow({ outDir, date, rows });
      writtenFiles++;
    }
    log("backfill", `chunk ${chunkFrom}→${chunkTo}: ${byDate.size} fechas recibidas`);
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  log("backfill", `uso OpenRouter listo: ${writtenFiles} snapshots nuevos escritos`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , command, ...args] = process.argv;
  const opts = parseArgs(args);
  if (command === "openrouter-usage") {
    await backfillOpenRouterUsage(opts);
  } else {
    console.log("subcomandos: openrouter-usage [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--dry-run]");
    process.exitCode = command ? 1 : 0;
  }
}
