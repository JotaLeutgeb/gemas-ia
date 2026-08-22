import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, log } from "./lib/util.js";

const DATASET = path.join(ROOT, "public", "data", "dataset.json");
const OUT_DIR = path.join(ROOT, "content", "linkedin");
const SITE_URL = "https://jotaleutgeb.github.io/gemas-ia";
const MAX_GEMS = 3;
const LINKEDIN_CHAR_LIMIT = 3000;
const CHARTS_DIR = path.join(ROOT, "public", "charts");

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

function isGemEligible(model) {
  return !model.famous && model.gemScore !== null && (model.downloads ?? 0) <= 5_000_000;
}

function cheapestFamousPrice(dataset) {
  return dataset.models
    .filter((m) => m.famous && m.promptUsdPerM != null && m.promptUsdPerM > 0)
    .map((m) => m.promptUsdPerM)
    .sort((a, b) => a - b)[0] ?? null;
}

async function availableChartImages() {
  try {
    return (await fs.readdir(CHARTS_DIR)).filter((f) => f.endsWith(".png"));
  } catch {
    return [];
  }
}

export async function generateDraft({ date = new Date(), force = false } = {}) {
  const dataset = JSON.parse(await fs.readFile(DATASET, "utf8"));
  const gems = dataset.models.filter(isGemEligible).slice(0, MAX_GEMS);
  const mover = dataset.models
    .filter((m) => !m.famous && m.metrics.momentum !== null)
    .map((m) => ({ model: m, growth: growth28d(m) }))
    .filter((x) => x.growth !== null)
    .sort((a, b) => b.growth - a.growth)[0] ?? null;

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
  const famousRef = cheapestFamousPrice(dataset);
  const images = await availableChartImages();

  const gemSections = gems.map((gem, i) => {
    const ratio =
      famousRef && gem.promptUsdPerM > 0
        ? ` · cuesta el ${(100 * (gem.promptUsdPerM / famousRef)).toFixed(0)}% del modelo top más barato`
        : "";
    const imageNote = images.includes(`${gem.urlSlug}.png`)
      ? `\n- Imagen lista para adjuntar: \`public/charts/${gem.urlSlug}.png\``
      : "";
    return `**${i + 1}. ${gem.name}**
- ${fmtContext(gem)} · ${fmtPrice(gem)}${ratio}
- Downloads acumulados: ${gem.downloads?.toLocaleString("es") ?? "n/d"} · Score de joya: ${gem.gemScore ?? "n/d"}
- Ficha completa: ${SITE_URL}/modelos/${gem.urlSlug}/${imageNote}`;
  }).join("\n\n");

  const postBody = [
    mover
      ? `El mercado se mueve rápido: **${mover.model.name}** creció **${fmtPct(mover.growth)}** en descargas en las últimas semanas y casi nadie lo está mirando.`
      : "Todavía no hay suficiente historia para hablar de crecimiento. Pero ya hay señales en los datos.",
    "",
    "## Las joyas",
    "",
    gemSections,
    "",
    "## Lo que esto significa",
    "",
    "[TU OPINIÓN AQUÍ — conectá los hallazgos con una tesis: eficiencia costo/calidad, swarm economics, hacia dónde va el mercado]",
    "",
    "Mi lectura: [TU OPINIÓN AQUÍ]",
    "",
    "---",
    "",
    "Esto es parte de **Gemas IA**, mi proyecto abierto para encontrar las joyas ocultas de la IA y proyectar su evolución con datos propios.",
    "",
    `🔎 Metodología completa y ranking actualizado: ${SITE_URL}/joyas/`,
    "",
    "#IA #LLM #MachineLearning #OpenSource",
  ].join("\n");

  const hookOptions = [
    `Un modelo que casi nadie conoce está creciendo ${mover ? fmtPct(mover.growth).replace("+", "") : "a ritmo récord"} semanal.`,
    "Todos hablan de GPT y Claude. Yo miro otros 3 modelos.",
    gems[0]?.promptUsdPerM != null && famousRef
      ? `Hay un LLM que hace este trabajo por el ${(100 * (gems[0].promptUsdPerM / famousRef)).toFixed(0)}% del precio del más barato de los gigantes.`
      : "Encontré 3 modelos que rompen la relación calidad/precio.",
  ];

  const meta = [
    "---",
    `date: ${isoDate}`,
    "published: false",
    `gems: [${gems.map((g) => g.urlSlug).join(", ")}]`,
    `caracteres_del_post: ${postBody.length}${postBody.length > LINKEDIN_CHAR_LIMIT ? " ⚠ EXCEDE EL LÍMITE DE LINKEDIN (3000)" : ""}`,
    `imagen_portada: public/charts/semana.png`,
    "---",
    "",
    `# Borrador LinkedIn — Joyas ocultas (${isoDate})`,
    "",
    "> Datos hasta: " + snapshotInfo + " · Modelos analizados: " + dataset.totals.models,
    "> Post actual: " + postBody.length + "/3000 caracteres.",
    images.length > 0
      ? "> Imágenes disponibles para arrastrar al post: " + images.map((f) => `public/charts/${f}`).join(", ")
      : "> Todavía no hay imágenes generadas (corren solas con el pipeline diario).",
    "",
    "## Hooks alternativos (elegí uno)",
    "",
    ...hookOptions.map((h, i) => `${i + 1}. ${h}`),
    "",
    "---",
    "",
  ].join("\n");

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(outPath, `${meta}${postBody}\n`, "utf8");
  log("draft", `borrador generado -> content/linkedin/${path.basename(outPath)} (${postBody.length} caracteres)`);
  return outPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  await generateDraft({ force });
}
