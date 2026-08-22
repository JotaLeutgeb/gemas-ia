import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, log } from "./lib/util.js";

const DATASET = path.join(ROOT, "public", "data", "dataset.json");
const OUT_DIR = path.join(ROOT, "content", "linkedin");
const SITE_URL = "https://jotaleutgeb.github.io/gemas-ia";
const MAX_GEMS = 3;

function fmtPct(value) {
  if (!Number.isFinite(value)) return "n/d";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function fmtPrice(model) {
  if (model.promptUsdPerM == null) return "precio n/d";
  if (model.promptUsdPerM === 0) return "gratis";
  return `US$${model.promptUsdPerM.toFixed(2)}/1M tokens de entrada`;
}

function fmtContext(model) {
  if (!model.contextLength) return "contexto n/d";
  return `${Math.round(model.contextLength / 1000)}k de contexto`;
}

function growth28d(model) {
  const series = model.series.downloads ?? [];
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const past = series.find((p) => Date.parse(last.date) - Date.parse(p.date) >= 21 * 86400000);
  if (!past || !past.value) return null;
  return last.value / past.value - 1;
}

function pickGems(dataset) {
  return dataset.models
    .filter((m) => !m.famous && m.gemScore !== null)
    .filter((m) => (m.downloads ?? 0) <= 5_000_000)
    .slice(0, MAX_GEMS);
}

function pickBiggestMover(dataset) {
  const withGrowth = dataset.models
    .filter((m) => !m.famous && m.metrics.momentum !== null)
    .map((m) => ({ model: m, growth: growth28d(m) }))
    .filter((x) => x.growth !== null)
    .sort((a, b) => b.growth - a.growth);
  return withGrowth[0] ?? null;
}

function gemSection(model, index, baseUrl) {
  const lines = [
    `**${index}. ${model.name}**`,
    `- Tamaño/contexto: ${fmtContext(model)} · ${fmtPrice(model)}`,
    `- Downloads acumulados: ${model.downloads?.toLocaleString("es") ?? "n/d"} · Score de joya: ${model.gemScore ?? "n/d"}/1`,
    `- Ficha completa con evolución y proyección: ${baseUrl}/modelos/${model.urlSlug}/`,
  ];
  return lines.join("\n");
}

export async function generateDraft({ date = new Date(), force = false } = {}) {
  const dataset = JSON.parse(await fs.readFile(DATASET, "utf8"));
  const gems = pickGems(dataset);
  const mover = pickBiggestMover(dataset);

  if (gems.length === 0) {
    log("draft", "no hay modelos elegibles todavía (se necesitan al menos 4 snapshots para momentum)");
    if (!force) return null;
  }

  const isoDate = date.toISOString().slice(0, 10);
  const outPath = path.join(OUT_DIR, `${isoDate}.md`);
  try {
    await fs.access(outPath);
    if (!force) {
      log("draft", `el borrador ${isoDate}.md ya existe, no se sobreescribe (usá --force)`);
      return null;
    }
  } catch {}

  const snapshotInfo = Object.entries(dataset.sources)
    .map(([source, info]) => `${source}: ${info.lastSnapshot}`)
    .join(" · ");

  const body = `---
date: ${isoDate}
published: false
gems: [${gems.map((g) => g.urlSlug).join(", ")}]
---

# Borrador LinkedIn — Joyas ocultas de la semana (${isoDate})

> Datos hasta: ${snapshotInfo} · Modelos analizados: ${dataset.totals.models}
> Recordatorio: editá los bloques \`[TU OPINIÓN AQUÍ]\` antes de publicar. Nada sale sin tu criterio.

---

${mover ? `El mercado se mueve rápido: **${mover.model.name}** creció **${fmtPct(mover.growth)}** en descargas en las últimas semanas, y casi nadie está hablando de eso.` : "Todavía no hay suficiente historia para hablar de crecimiento (necesitamos ~4 semanas de datos). Pero ya hay señales."}

## Las 3 joyas de la semana

${gems.map((gem, i) => gemSection(gem, i + 1, SITE_URL)).join("\n\n")}

## Lo que esto significa

[TU OPINIÓN AQUÍ — conectá los hallazgos con una tesis: eficiencia costo/calidad, swarm economics, hacia dónde va el mercado]

Mi lectura: [TU OPINIÓN AQUÍ]

## Metodología en una línea

Los datos vienen de OpenRouter y HuggingFace, se toman snapshots diarios y se calculan scores de momentum y eficiencia. Todo el cálculo está explicado sin cajas negras en la web del proyecto.

---

Esto es parte de **Gemas IA**, mi proyecto abierto para encontrar las joyas ocultas de la IA y proyectar su evolución con datos propios.

🔎 Metodología completa y ranking actualizado: ${SITE_URL}/joyas/

#IA #LLM #MachineLearning #OpenSource`;

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(outPath, body, "utf8");
  log("draft", `borrador generado -> content/linkedin/${path.basename(outPath)}`);
  return outPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  await generateDraft({ force });
}
