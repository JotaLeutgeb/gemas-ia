import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function log(scope, message) {
  console.log(`[${new Date().toISOString()}] [${scope}] ${message}`);
}

export function todayISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(path.dirname(dirPath), { recursive: true });
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function fetchJson(url, { retries = 3, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "gemas-ia/0.1 (+https://github.com/JotaLeutgeb/gemas-ia)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const waitMs = attempt * 2000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function daysBetween(isoA, isoB) {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000);
}
