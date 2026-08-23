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

function paretoFrontKeys(models) {
  const eligible = models.filter(
    (m) => Number.isFinite(m.blendedUsdPerM) && m.blendedUsdPerM > 0 && m.quality !== null
  );
  eligible.sort((a, b) => a.blendedUsdPerM - b.blendedUsdPerM || b.quality.index - a.quality.index);
  const front = new Set();
  let bestQuality = -Infinity;
  for (const model of eligible) {
    if (model.quality.index > bestQuality) {
      front.add(model.matchKey);
      bestQuality = model.quality.index;
    }
  }
  return front;
}

export function renderQualityScatter(el, models) {
  const visible = models.filter(
    (m) => m.quality !== null && Number.isFinite(m.blendedUsdPerM) && m.blendedUsdPerM > 0
  );
  if (visible.length < 3) return false;

  const frontierKeys = paretoFrontKeys(visible);
  const points = visible.map((m) => ({
    name: m.name,
    labId: m.labId,
    labLabel: m.labLabel,
    x: Math.log10(m.blendedUsdPerM),
    y: m.quality.index,
    frontier: frontierKeys.has(m.matchKey),
    priceLabel: `$${m.blendedUsdPerM >= 1 ? m.blendedUsdPerM.toFixed(2) : m.blendedUsdPerM.toFixed(3)}/1M`,
  }));

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
      marginBottom: 56,
      x: { label: "precio mezclado US$/1M (escala log)", tickFormat: fmtPriceTick, grid: true },
      y: { label: "índice de código (0–100)", grid: true },
      marks,
      color: { domain: Object.keys(LAB_COLORS), range: Object.values(LAB_COLORS) },
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

function buildLabFilter(container, labs, models, selected, onChange) {
  container.replaceChildren();
  const counts = {};
  for (const model of models) {
    if (model.quality === null || !Number.isFinite(model.blendedUsdPerM) || model.blendedUsdPerM <= 0) continue;
    counts[model.labId] = (counts[model.labId] ?? 0) + 1;
  }
  for (const lab of labs) {
    const button = document.createElement("button");
    button.type = "button";
    const isActive = selected.has(lab.id);
    button.className = `lab-chip${isActive ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(isActive));

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = LAB_COLORS[lab.id] ?? THEME.inkSoft;
    swatch.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = lab.label;

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(counts[lab.id] ?? 0);

    button.append(swatch, label, count);
    button.addEventListener("click", () => {
      const nowActive = !selected.has(lab.id);
      if (nowActive) selected.add(lab.id);
      else selected.delete(lab.id);
      button.classList.toggle("active", nowActive);
      button.setAttribute("aria-pressed", String(nowActive));
      onChange();
    });
    container.append(button);
  }
}

export async function mountDashboard() {
  const el = document.getElementById("scatter-quality");
  if (!el) return;
  const dataset = await loadDataset();
  if (!dataset) return renderEmpty(el);

  const selected = new Set((dataset.labs ?? []).map((lab) => lab.id));
  const filterEl = document.getElementById("lab-filter");

  const render = () => {
    const visible = dataset.models.filter((model) => selected.has(model.labId));
    if (!renderQualityScatter(el, visible)) {
      renderEmpty(el, visible.length === 0 ? "Seleccioná al menos un laboratorio." : undefined);
    }
  };

  if (filterEl) buildLabFilter(filterEl, dataset.labs ?? [], dataset.models, selected, render);
  render();
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
