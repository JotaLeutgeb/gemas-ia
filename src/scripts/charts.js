import * as Plot from "@observablehq/plot";

const HEIGHT = 340;
const THEME = {
  ink: "#eae4d5",
  inkSoft: "#b3ab97",
  grid: "rgba(234, 228, 213, 0.12)",
  green: "#4fbf94",
  gold: "#d4a72c",
  rust: "#e0725f",
};

const LAB_COLORS = {
  anthropic: "#e08a7a",
  openai: "#63c9a0",
  google: "#dfb84f",
  deepseek: "#7da7cc",
  alibaba: "#b394cf",
  moonshot: "#82b5b3",
  zhipu: "#cd9878",
  minimax: "#a8a294",
  xai: "#d6d1c2",
};

export async function loadDataset() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/dataset.json`);
  if (!response.ok) return null;
  return response.json();
}

function clear(el) {
  el.replaceChildren();
}

function plotBase(el) {
  return {
    width: Math.max(el.clientWidth || 720, 320),
    height: HEIGHT,
    style: { background: "transparent", color: THEME.ink, font: "inherit" },
    marks: [],
  };
}

function fmtPriceTick(exponent) {
  const value = 10 ** exponent;
  const label = value >= 100 ? String(Math.round(value)) : value >= 1 ? value.toFixed(0) : value.toFixed(2);
  return `$${label}`;
}

export function renderEmpty(el, message = "Todavía no hay datos suficientes. Volvé en unos días.") {
  clear(el);
  const div = document.createElement("div");
  div.className = "chart-empty";
  div.textContent = message;
  el.append(div);
}

export function renderQualityScatter(el, models) {
  const points = models
    .filter((m) => m.quality !== null && Number.isFinite(m.blendedUsdPerM) && m.blendedUsdPerM > 0)
    .map((m) => ({
      name: m.name,
      labId: m.labId,
      labLabel: m.labLabel,
      x: Math.log10(m.blendedUsdPerM),
      y: m.quality.index,
      frontier: m.onEfficiencyFrontier === true,
      priceLabel: `$${m.blendedUsdPerM >= 1 ? m.blendedUsdPerM.toFixed(2) : m.blendedUsdPerM.toFixed(3)}/1M`,
    }));
  if (points.length < 3) return false;

  const regular = points.filter((p) => !p.frontier);
  const frontierDots = points.filter((p) => p.frontier);
  const dotTitle = (d) => `${d.name} · ${d.labLabel}\ncódigo ${d.y.toFixed(1)} · ${d.priceLabel}`;

  const marks = [
    Plot.dot(regular, { x: "x", y: "y", fill: "labId", r: 4.5, title: dotTitle }),
    Plot.dot(frontierDots, {
      x: "x",
      y: "y",
      fill: "labId",
      stroke: THEME.ink,
      strokeWidth: 1.5,
      r: 6,
      title: (d) => `${dotTitle(d)}\n★ frontera eficiente`,
    }),
  ];
  const frontierLine = points.filter((p) => p.frontier).sort((a, b) => a.x - b.x);
  if (frontierLine.length >= 2) {
    marks.unshift(
      Plot.line(frontierLine, {
        x: "x",
        y: "y",
        stroke: THEME.inkSoft,
        strokeWidth: 1.2,
        strokeDasharray: "2,3",
      })
    );
  }

  el.append(
    Plot.plot({
      ...plotBase(el),
      x: { label: "precio mezclado US$/1M — 75% entrada / 25% salida (escala log)", tickFormat: fmtPriceTick, grid: true },
      y: { label: "índice de código (0–100)", grid: true },
      marks,
      color: { domain: Object.keys(LAB_COLORS), range: Object.values(LAB_COLORS), legend: true },
    })
  );
  return true;
}

export function renderPriceSeries(el, model) {
  const input = (model.series.promptUsdPerM ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  const output = (model.series.completionUsdPerM ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  if (input.length < 2 && output.length < 2) return false;
  clear(el);
  const marks = [];
  if (input.length >= 2) {
    marks.push(
      Plot.line(input, { x: "date", y: "value", stroke: THEME.green, strokeWidth: 2 }),
      Plot.dot(input, { x: "date", y: "value", fill: THEME.green, r: 2.5, title: (d) => `${d.date.toISOString().slice(0, 10)}\nentrada $${d.value}/1M` })
    );
  }
  if (output.length >= 2) {
    marks.push(
      Plot.line(output, { x: "date", y: "value", stroke: THEME.gold, strokeWidth: 2 }),
      Plot.dot(output, { x: "date", y: "value", fill: THEME.gold, r: 2.5, title: (d) => `${d.date.toISOString().slice(0, 10)}\nsalida $${d.value}/1M` })
    );
  }
  el.append(
    Plot.plot({
      ...plotBase(el),
      y: { label: "US$ / 1M tokens", grid: true },
      marks,
    })
  );
  return true;
}

export function renderUsageSeries(el, model) {
  const series = (model.series.usageTokens ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  if (series.length < 2) return false;
  clear(el);
  const marks = [
    Plot.areaY(series, { x: "date", y: "value", fill: THEME.gold, fillOpacity: 0.14 }),
    Plot.line(series, { x: "date", y: "value", stroke: THEME.gold, strokeWidth: 2 }),
  ];
  el.append(
    Plot.plot({
      ...plotBase(el),
      y: { label: "tokens por día (OpenRouter)", grid: true },
      marks,
    })
  );
  return true;
}

export async function mountDashboard() {
  const el = document.getElementById("scatter-quality");
  if (!el) return;
  const dataset = await loadDataset();
  if (!dataset || !renderQualityScatter(el, dataset.models)) {
    renderEmpty(el);
  }
}

function parseModelPayload(el) {
  if (!el?.dataset.model) return null;
  try {
    return JSON.parse(el.dataset.model);
  } catch {
    return null;
  }
}

export async function mountModelPage() {
  const pricesEl = document.getElementById("chart-prices");
  const pricesModel = parseModelPayload(pricesEl);
  if (pricesEl && (!pricesModel || !renderPriceSeries(pricesEl, pricesModel))) {
    renderEmpty(pricesEl, "La serie de precios necesita al menos dos snapshots. Volvé mañana.");
  }
  const usageEl = document.getElementById("chart-usage");
  const usageModel = parseModelPayload(usageEl);
  if (usageEl && usageModel && !renderUsageSeries(usageEl, usageModel)) {
    renderEmpty(usageEl);
  }
}
