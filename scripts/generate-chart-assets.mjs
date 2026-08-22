import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET = path.join(ROOT, "public", "data", "dataset.json");
const OUT_DIR = path.join(ROOT, "public", "charts");
const TOP_N = 10;

const T = {
  paper: "#f7f4ec",
  ink: "#1c1a16",
  inkSoft: "#5d5748",
  inkFaint: "#8a8271",
  rule: "#d9d2bf",
  green: "#0e7255",
  gold: "#96700f",
  rust: "#ab4032",
};

async function savePng(svgString, outFile, width) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
    background: T.paper,
    font: { loadSystemFonts: true },
  });
  await fs.writeFile(outFile, resvg.render().asPng());
}

function pickModels(dataset) {
  return dataset.models
    .filter((m) => m.valueScore !== null && m.valueRank !== null)
    .sort((a, b) => a.valueRank - b.valueRank)
    .slice(0, TOP_N);
}

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fmtPrice(p) {
  if (p == null) return "precio n/d";
  if (p === 0) return "gratis";
  return `$${p >= 1 ? p.toFixed(2) : p.toFixed(3)}/1M`;
}

function fmtTokens(value) {
  if (!Number.isFinite(value)) return "n/d";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(Math.round(value));
}

function usageChart(model) {
  const series = (model.series.usageTokens ?? []).map((p) => ({ date: p.date, value: Number(p.value) }));
  if (series.length < 2) throw new Error("serie de uso insuficiente");

  const W = 1000;
  const H = 480;
  const M = { top: 110, right: 72, bottom: 72, left: 108 };
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const values = series.map((p) => p.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(0, ...values);
  const span = maxValue - minValue || 1;

  const x = (i) => M.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v) => M.top + (1 - (v - minValue) / span) * innerH;

  const linePoints = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const baseY = y(minValue).toFixed(1);
  const areaPath = `M ${M.left},${baseY} L ${linePoints.split(" ").join(" L ")} L ${(M.left + innerW).toFixed(1)},${baseY} Z`;

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const value = minValue + (span * i) / 4;
    const gy = y(value).toFixed(1);
    gridLines.push(
      `<line x1="${M.left}" y1="${gy}" x2="${W - M.right}" y2="${gy}" stroke="${T.rule}" stroke-width="1"/>`,
      `<text x="${M.left - 14}" y="${Number(gy) + 5}" text-anchor="end" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="15" fill="${T.inkFaint}">${fmtTokens(value)}</text>`
    );
  }

  const midIndex = Math.floor((series.length - 1) / 2);
  const dateLabels = [
    { label: series[0].date, anchor: "start", xPos: M.left },
    { label: series[midIndex].date, anchor: "middle", xPos: M.left + innerW / 2 },
    { label: series[series.length - 1].date, anchor: "end", xPos: W - M.right },
  ]
    .map(
      ({ label, anchor, xPos }) =>
        `<text x="${xPos}" y="${H - M.bottom + 36}" text-anchor="${anchor}" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="15" fill="${T.inkFaint}">${label}</text>`
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${T.paper}"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${T.rule}" stroke-width="1"/>
  <text x="${M.left}" y="56" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="16" letter-spacing="2" fill="${T.inkSoft}">◆ TOKENS POR DÍA · OPENROUTER</text>
  <text x="${M.left}" y="88" font-family="Georgia, 'DejaVu Serif', serif" font-size="26" font-style="italic" fill="${T.ink}">${esc(truncate(model.name, 52))}</text>
  ${gridLines.join("\n  ")}
  <path d="${areaPath}" fill="${T.gold}" fill-opacity="0.14"/>
  <polyline points="${linePoints}" fill="none" stroke="${T.gold}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${x(series.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="4" fill="${T.gold}"/>
  ${dateLabels}
</svg>`;
}

function weekCard(dataset, picks) {
  const dateLabel = dataset.generatedAt.slice(0, 10);
  const rows = picks.slice(0, 3).map((m, i) => {
    const yPos = 300 + i * 96;
    const quality = m.quality?.index != null ? `código ${m.quality.index.toFixed(1)}` : "código n/d";
    const value = m.valueScore != null ? `${Math.round(m.valueScore).toLocaleString("es")} pts × $` : "n/d";
    return `
    <text x="90" y="${yPos}" font-family="Georgia, 'DejaVu Serif', serif" font-size="44" fill="${T.gold}">${i + 1}.</text>
    <text x="150" y="${yPos}" font-family="Georgia, 'DejaVu Serif', serif" font-size="34" font-weight="bold" fill="${T.ink}">${esc(truncate(m.name, 30))}</text>
    <text x="1110" y="${yPos}" text-anchor="end" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="24" fill="${T.green}">${esc(value)}</text>
    <text x="150" y="${yPos + 38}" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="19" fill="${T.inkSoft}">${esc(truncate(m.labLabel ?? "", 24))} · ${esc(fmtPrice(m.blendedUsdPerM))} · ${quality}</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${T.paper}"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="${T.rule}" stroke-width="1"/>
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="${T.ink}" stroke-width="2"/>
  <text x="80" y="105" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="17" letter-spacing="3" fill="${T.inkSoft}">◆ GEMAS IA · OBSERVATORIO DE LLMS</text>
  <text x="1120" y="105" text-anchor="end" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="17" fill="${T.inkFaint}">${dateLabel}</text>
  <line x1="80" y1="128" x2="1120" y2="128" stroke="${T.ink}" stroke-width="2"/>
  <text x="80" y="205" font-family="Georgia, 'DejaVu Serif', serif" font-size="50" font-style="italic" fill="${T.ink}">La frontera calidad-precio de la semana</text>
  <text x="80" y="250" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="18" fill="${T.inkSoft}">modelos líderes · máxima calidad por dólar · datos propios</text>
  ${rows}
  <line x1="80" y1="560" x2="1120" y2="560" stroke="${T.rule}" stroke-width="1"/>
  <text x="80" y="588" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="16" fill="${T.inkSoft}">metodología abierta → jotaleutgeb.github.io/gemas-ia</text>
</svg>`;
}

export async function generateAssets() {
  let dataset;
  try {
    dataset = JSON.parse(await fs.readFile(DATASET, "utf8"));
  } catch {
    console.log("[charts] no hay dataset todavía, se omite generación de assets");
    return { generated: 0 };
  }
  await fs.mkdir(OUT_DIR, { recursive: true });

  const picks = pickModels(dataset);
  let generated = 0;

  for (const model of picks) {
    try {
      const svg = usageChart(model);
      await fs.writeFile(path.join(OUT_DIR, `${model.urlSlug}.svg`), svg, "utf8");
      await savePng(svg, path.join(OUT_DIR, `${model.urlSlug}.png`), 1000);
      generated++;
    } catch (error) {
      console.log(`[charts] fallo ${model.urlSlug}: ${error.message}`);
    }
  }

  try {
    const card = weekCard(dataset, picks);
    await savePng(card, path.join(OUT_DIR, "semana.png"), 1200);
    await fs.writeFile(path.join(OUT_DIR, "semana.svg"), card, "utf8");
    generated++;
  } catch (error) {
    console.log(`[charts] fallo tarjeta semanal: ${error.message}`);
  }

  console.log(`[charts] ${generated} assets generados en public/charts`);
  return { generated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateAssets();
}
