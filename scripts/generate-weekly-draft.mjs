import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, log } from "./lib/util.js";

const DATASET = path.join(ROOT, "public", "data", "dataset.json");
const OUT_DIR = path.join(ROOT, "content", "linkedin");
const EDITIONS_DIR = path.join(ROOT, "src", "content", "ediciones");
const CHARTS_DIR = path.join(ROOT, "public", "charts");
const SITE_URL = "https://jotaleutgeb.github.io/gemas-ia";
const MAX_GEMS = 3;
const LINKEDIN_CHAR_LIMIT = 3000;

function fmtPct(value) {
  if (!Number.isFinite(value)) return "n/d";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function fmtBlended(model) {
  const p = model.blendedUsdPerM;
  if (p == null) return "precio n/d";
  if (p === 0) return "gratis";
  return `US$${p >= 1 ? p.toFixed(2) : p.toFixed(3)}/1M mezclados`;
}

function fmtContext(model) {
  if (!model.contextLength) return "contexto n/d";
  return `${Math.round(model.contextLength / 1000)}k de contexto`;
}

function ratioVsLeader(model, leader) {
  if (!leader?.quality || !model.quality) return null;
  if (!model.blendedUsdPerM || !leader.blendedUsdPerM) return null;
  return {
    qualityPct: (100 * model.quality.index) / leader.quality.index,
    pricePct: (100 * model.blendedUsdPerM) / leader.blendedUsdPerM,
  };
}

function fmtRatioPct(value) {
  if (!Number.isFinite(value)) return "n/d";
  if (value <= 0) return "0%";
  if (value < 1) return "<1%";
  return `${value.toFixed(0)}%`;
}

function bestValueModels(dataset) {
  return dataset.models
    .filter((m) => m.valueScore !== null && m.valueRank !== null)
    .sort((a, b) => a.valueRank - b.valueRank);
}

async function availableChartImages() {
  try {
    return (await fs.readdir(CHARTS_DIR)).filter((f) => f.endsWith(".png"));
  } catch {
    return [];
  }
}

async function freezeEditionCharts(isoDate) {
  const outDir = path.join(CHARTS_DIR, "ediciones", isoDate);
  let copied = 0;
  try {
    for (const file of await fs.readdir(CHARTS_DIR)) {
      if (!file.endsWith(".png")) continue;
      const target = path.join(outDir, file);
      try {
        await fs.access(target);
        continue;
      } catch {}
      await fs.copyFile(path.join(CHARTS_DIR, file), target);
      copied++;
    }
  } catch {}
  return copied;
}

async function writeEdition({ dataset, gems, leader, altasSemana, dropsSemana, isoDate, force }) {
  const editionPath = path.join(EDITIONS_DIR, `${isoDate}.md`);
  if (!force) {
    try {
      await fs.access(editionPath);
      log("draft", `la edición ${isoDate}.md ya existe en src/content/ediciones, no se pisa`);
      return null;
    } catch {}
  }

  await freezeEditionCharts(isoDate);
  const chartBase = `/charts/ediciones/${isoDate}`;
  const hasCard = await fs
    .access(path.join(ROOT, "public", chartBase, "semana.png"))
    .then(() => true)
    .catch(() => false);

  const gemParagraphs = gems.map((gem) => {
    const ratio = ratioVsLeader(gem, leader);
    const ratioText = ratio
      ? ` Te da el **${fmtRatioPct(ratio.qualityPct)} de la calidad** del líder absoluto por el **${fmtRatioPct(ratio.pricePct)} de su precio**.`
      : "";
    return `### ${gem.name} (${gem.labLabel})

${fmtContext(gem)} · ${fmtBlended(gem)} · calidad **${gem.quality?.index?.toFixed(1) ?? "n/d"}** (#${gem.valueRank} en mejor valor).${ratioText}

[SU HISTORIA AQUÍ — por qué este líder es la compra de la semana]`;
  });

  const movementsBlock = [];
  if (altasSemana.length > 0 || dropsSemana.length > 0) {
    movementsBlock.push("## Movimientos entre los grandes", "");
    if (altasSemana.length > 0) {
      movementsBlock.push(`**Lanzaron modelos nuevos:** ${altasSemana.map((a) => a.name).join(", ")}.`, "");
    }
    if (dropsSemana.length > 0) {
      movementsBlock.push("**La guerra de precios:**", "");
      for (const drop of dropsSemana) {
        movementsBlock.push(`- ${drop.name}: ${fmtBlended({ blendedUsdPerM: drop.oldPrice })} → ${fmtBlended({ blendedUsdPerM: drop.newPrice })} (${drop.field})`);
      }
      movementsBlock.push("");
    }
    movementsBlock.push("[LECTURA DEL MOVIMIENTO AQUÍ]");
  }

  const body = [
    `<img src="${chartBase}/semana.png" alt="La frontera calidad-precio de la semana" width="600" />`,
    "",
    leader
      ? `Esta es la edición semanal de Gemas IA, el comparador de eficiencia entre los modelos líderes. El rey de la calidad sigue siendo **${leader.name}**, pero el ranking de mejor valor cuenta otra historia.`
      : "Edición semanal de Gemas IA: lo que dicen los datos propios del observatorio sobre la relación calidad-precio entre los líderes.",
    "",
    "## Los líderes con mejor relación calidad-precio",
    "",
    ...gemParagraphs,
    "",
    ...movementsBlock,
    "",
    "## Lo que esto significa",
    "",
    "[TU ANÁLISIS AQUÍ — la tesis de la semana: eficiencia costo/calidad entre flagships, hacia dónde se mueve la frontera, qué implica para quien construye]",
    "",
    "---",
    "",
    "*Los datos de esta edición salen de snapshots diarios propios (OpenRouter y Epoch AI) con metodología abierta y trazable.*",
  ].join("\n");

  const frontmatter = [
    "---",
    `title: "Mejor valor #${editionNumber(isoDate)} — ${gems[0]?.name ?? "arranque"}"`,
    `date: "${isoDate}"`,
    "published: false",
    `gems: [${gems.map((g) => `"${g.urlSlug}"`).join(", ")}]`,
    `cover: "${hasCard ? `${chartBase}/semana.png` : ""}"`,
    "---",
    "",
  ].join("\n");

  await fs.mkdir(EDITIONS_DIR, { recursive: true });
  await fs.writeFile(editionPath, `${frontmatter}${body}\n`, "utf8");
  log("draft", `edición pública generada -> src/content/ediciones/${isoDate}.md (published: false; editá y pasala a true)`);
  return editionPath;
}

function editionNumber(isoDate) {
  const jan1 = new Date(`${isoDate.slice(0, 4)}-01-01T00:00:00Z`);
  const week = Math.ceil((Date.parse(isoDate) - jan1.getTime()) / (7 * 86400000));
  return week;
}

export async function generateDraft({ date = new Date(), force = false } = {}) {
  const dataset = JSON.parse(await fs.readFile(DATASET, "utf8"));
  const gems = bestValueModels(dataset).slice(0, MAX_GEMS);
  const leader = dataset.models.find((m) => m.performanceRank === 1) ?? null;
  const frontierCount = dataset.models.filter((m) => m.onEfficiencyFrontier).length;
  const mover = dataset.models
    .filter((m) => Number.isFinite(m.metrics.momentumUsage) && m.links?.openrouter)
    .sort((a, b) => b.metrics.momentumUsage - a.metrics.momentumUsage)[0] ?? null;

  if (gems.length === 0) {
    log("draft", "no hay modelos con score de calidad contra precio todavía (faltan benchmarks o precios)");
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
  const images = await availableChartImages();
  const altasSemana = (dataset.movements?.altas ?? []).slice(0, 5);
  const dropsSemana = (dataset.movements?.priceDrops ?? []).slice(0, 3);

  const gemSections = gems.map((gem, i) => {
    const ratio = ratioVsLeader(gem, leader);
    const imageNote = images.includes(`${gem.urlSlug}.png`)
      ? `\n- Imagen lista para adjuntar: \`public/charts/${gem.urlSlug}.png\``
      : "";
    return `**${i + 1}. ${gem.name}** (${gem.labLabel})
- ${fmtContext(gem)} · ${fmtBlended(gem)}
- Calidad: ${gem.quality?.index?.toFixed(1) ?? "n/d"} · Rank #${gem.valueRank} en mejor valor · ${Math.round(gem.valueScore).toLocaleString("es")} pts de calidad por dólar${ratio ? ` · el ${fmtRatioPct(ratio.qualityPct)} de la calidad del líder por el ${fmtRatioPct(ratio.pricePct)} de su precio` : ""}
- Ficha completa: ${SITE_URL}/modelos/${gem.urlSlug}/${imageNote}`;
  }).join("\n\n");

  const movementsSection = [];
  if (altasSemana.length > 0 || dropsSemana.length > 0) {
    movementsSection.push("## Movimientos entre los grandes", "");
    if (altasSemana.length > 0) {
      movementsSection.push(
        `Lanzamientos detectados: ${altasSemana.map((a) => `**${a.name}** (${a.labLabel ?? a.source}, ${a.firstSeen})`).join(" · ")}.`,
      );
    }
    if (dropsSemana.length > 0) {
      movementsSection.push(
        "",
        "Y la guerra de precios sigue:",
        ...dropsSemana.map((p) => `- ${p.name}: $${p.oldPrice} → $${p.newPrice} (${p.field})`),
        "",
        "[TU OPINIÓN AQUÍ — ¿qué significa esta guerra de precios para quién construye productos?]",
      );
    }
  }

  const postBody = [
    mover
      ? `El líder en tracción real está clarísimo: **${mover.name}** crece **${fmtPct(mover.metrics.momentumUsage)}** semanal en tokens procesados. Pero tracción no es eficiencia.`
      : "Los precios de los líderes se mueven todos los días. Los benchmarks, más lento. La eficiencia cambia cuando ambos lo hacen.",
    "",
    "## Los líderes con mejor valor",
    "",
    gemSections,
    "",
    ...movementsSection,
    ...(movementsSection.length > 0 ? [""] : []),
    "## Lo que esto significa",
    "",
    `[TU OPINIÓN AQUÍ — conectá los hallazgos con una tesis: la frontera eficiente son ${frontierCount} modelos hoy, swarm economics, hacia dónde va el mercado]`,
    "",
    "Mi lectura: [TU OPINIÓN AQUÍ]",
    "",
    "---",
    "",
    "Esto es parte de **Gemas IA**, mi proyecto abierto que compara a los modelos líderes en calidad y precio, con datos propios día a día.",
    "",
    `🔎 Metodología completa y ranking actualizado: ${SITE_URL}/joyas/`,
    "",
    "#IA #LLM #MachineLearning",
  ].join("\n");

  const topGemRatio = gems[0] ? ratioVsLeader(gems[0], leader) : null;
  const hookOptions = [
    leader
      ? `El mejor modelo del mundo cuesta US$${leader.blendedUsdPerM?.toFixed(2)}/1M. Pero casi nadie necesita pagar eso.`
      : "Comparé a los modelos líderes en calidad por dólar. El podio no es el que esperás.",
    topGemRatio
      ? `Hay un modelo de ${gems[0].labLabel} que te da el ${fmtRatioPct(topGemRatio.qualityPct)} de la calidad del mejor del mundo por el ${fmtRatioPct(topGemRatio.pricePct)} de su precio.`
      : "Solo 9 labs compiten en la frontera. Comparé a todos sus modelos en calidad y precio.",
    mover
      ? `${mover.name} crece ${fmtPct(mover.metrics.momentumUsage).replace("+", "")} semanal en uso real. ¿Es la compra inteligente del momento? Miré los números.`
      : "Todos publican benchmarks. Casi nadie publica calidad dividido precio.",
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
    `# Borrador LinkedIn — Mejor valor entre líderes (${isoDate})`,
    "",
    "> Datos hasta: " + snapshotInfo + " · Modelos comparados: " + dataset.totals.models,
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

  await writeEdition({ dataset, gems, leader, altasSemana, dropsSemana, isoDate, force });

  return outPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  await generateDraft({ force });
}
