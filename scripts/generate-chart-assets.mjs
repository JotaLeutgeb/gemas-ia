import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Plot from "@observablehq/plot";
import { Resvg } from "@resvg/resvg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET = path.join(ROOT, "public", "data", "dataset.json");
const OUT_DIR = path.join(ROOT, "public", "charts");
const DAY_MS = 86400000;
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

function svgToString(svg) {
  if (typeof svg === "string") return svg;
  if (svg?.outerHTML) return svg.outerHTML;
  throw new Error("Plot no devolvió SVG utilizable en Node");
}

async function savePng(svgString, outFile, width) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
    background: T.paper,
    font: { loadSystemFonts: true },
  });
  await fs.writeFile(outFile, resvg.render().asPng());
}

function isGemEligible(m) {
  return !m.famous && m.gemScore !== null && (m.downloads ?? 0) <= 5_000_000;
}

function pickModels(dataset) {
  const candidates = dataset.models.filter((m) => (m.series.downloads ?? []).length >= 2);
  const gems = candidates.filter(isGemEligible).slice(0, TOP_N);
  if (gems.length > 0) return gems;
  return candidates.filter((m) => !m.famous).slice(0, TOP_N);
}

function seriesChart(model) {
  const points = (model.series.downloads ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  const f90 = model.metrics.forecastDownloads90d;
  const f180 = model.metrics.forecastDownloads180d;
  const marks = [
    Plot.areaY(points, { x: "date", y: "value", fill: T.green, fillOpacity: 0.14 }),
    Plot.line(points, { x: "date", y: "value", stroke: T.green, strokeWidth: 2.5 }),
  ];

  if (f180 && points.length >= 4) {
    const lastPoint = points[points.length - 1];
    const projection = [lastPoint];
    if (f90) projection.push({ date: new Date(lastPoint.date.getTime() + 90 * DAY_MS), value: f90.center });
    projection.push({ date: new Date(lastPoint.date.getTime() + 180 * DAY_MS), value: f180.center });
    marks.push(
      Plot.line(projection, { x: "date", y: "value", stroke: T.gold, strokeWidth: 2, strokeDasharray: "5,5" })
    );
  }
  return Plot.plot({
    width: 1000,
    height: 480,
    margin: 48,
    background: T.paper,
    color: T.ink,
    style: { fontFamily: "DejaVu Sans, Segoe UI, sans-serif", fontSize: "13px" },
    y: { label: "descargas acumuladas", grid: true },
    marks,
  });
}

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function weekCard(dataset, picks) {
  const dateLabel = dataset.generatedAt.slice(0, 10);
  const rows = picks.slice(0, 3).map((m, i) => {
    const y = 300 + i * 96;
    const price = m.promptUsdPerM == null ? "precio n/d" : m.promptUsdPerM === 0 ? "gratis" : `$${m.promptUsdPerM.toFixed(2)}/1M`;
    const score = m.gemScore !== null ? m.gemScore.toFixed(2) : "n/d";
    return `
    <text x="90" y="${y}" font-family="Georgia, 'DejaVu Serif', serif" font-size="44" fill="${T.gold}">${i + 1}.</text>
    <text x="150" y="${y}" font-family="Georgia, 'DejaVu Serif', serif" font-size="34" font-weight="bold" fill="${T.ink}">${esc(truncate(m.name, 30))}</text>
    <text x="1110" y="${y}" text-anchor="end" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="24" fill="${T.green}">score ${score}</text>
    <text x="150" y="${y + 38}" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="19" fill="${T.inkSoft}">${esc(price)} · ${Math.round((m.contextLength ?? 0) / 1000)}k contexto</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${T.paper}"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="${T.rule}" stroke-width="1"/>
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="${T.ink}" stroke-width="2"/>
  <text x="80" y="105" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="17" letter-spacing="3" fill="${T.inkSoft}">◆ GEMAS IA · OBSERVATORIO DE LLMS</text>
  <text x="1120" y="105" text-anchor="end" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="17" fill="${T.inkFaint}">${dateLabel}</text>
  <line x1="80" y1="128" x2="1120" y2="128" stroke="${T.ink}" stroke-width="2"/>
  <text x="80" y="205" font-family="Georgia, 'DejaVu Serif', serif" font-size="52" font-style="italic" fill="${T.ink}">Las joyas ocultas de la semana</text>
  <text x="80" y="250" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="18" fill="${T.inkSoft}">mejor tendencia · fuera del mainstream · datos propios</text>
  ${rows}
  <line x1="80" y1="560" x2="1120" y2="560" stroke="${T.rule}" stroke-width="1"/>
  <text x="80" y="588" font-family="'DejaVu Sans Mono', Consolas, monospace" font-size="16" fill="${T.inkSoft}">metodología abierta → jotaleutgeb.github.io/gemas-ia</text>
</svg>`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
    if ((model.series.downloads ?? []).length < 2) continue;
    try {
      const svg = svgToString(seriesChart(model));
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
