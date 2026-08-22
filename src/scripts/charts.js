import * as Plot from "@observablehq/plot";

const HEIGHT = 340;
const DAY_MS = 86400000;
const THEME = {
  ink: "#1c1a16",
  inkSoft: "#5d5748",
  grid: "rgba(28, 26, 22, 0.09)",
  green: "#0e7255",
  gold: "#96700f",
  rust: "#ab4032",
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

function fmtPriceTick(dayExponent) {
  const value = 10 ** dayExponent;
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

export function renderMomentumScatter(el, models) {
  const points = models
    .filter((m) => m.metrics.momentum !== null && m.promptUsdPerM !== null)
    .slice(0, 300)
    .map((m) => ({
      name: m.name,
      x: Math.log10(Math.max(m.promptUsdPerM, 0.001)),
      y: m.metrics.momentum * 100,
      famous: m.famous,
    }));
  if (points.length < 3) return false;
  clear(el);
  el.append(
    Plot.plot({
      ...plotBase(el),
      x: { label: "precio entrada US$/1M (escala log)", domain: [-4, 2.2], tickFormat: fmtPriceTick },
      y: { label: "momentum (% crec. semanal aprox.)", grid: true },
      marks: [
        Plot.ruleY([0]),
        Plot.dot(points, {
          x: "x",
          y: "y",
          fill: "famous",
          r: 4.5,
          title: (d) => `${d.name}\n${d.y.toFixed(1)}% / semana`,
        }),
      ],
      color: { domain: [false, true], range: [THEME.green, THEME.rust], legend: true },
    })
  );
  return true;
}

export function renderDownloadsSeries(el, model) {
  const series = (model.series.downloads ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  if (series.length < 2) return false;
  clear(el);
  const f90 = model.metrics.forecastDownloads90d;
  const f180 = model.metrics.forecastDownloads180d;
  const marks = [
    Plot.areaY(series, { x: "date", y: "value", fill: THEME.green, fillOpacity: 0.14 }),
    Plot.line(series, { x: "date", y: "value", stroke: THEME.green, strokeWidth: 2 }),
    Plot.dot(series, { x: "date", y: "value", fill: THEME.green, r: 3, title: (d) => `${d.date.toISOString().slice(0, 10)}: ${d.value.toLocaleString("es")}` }),
  ];
  if (f180 && series.length >= 4) {
    const lastPoint = series[series.length - 1];
    const lastDate = lastPoint.date;
    const projectionPoints = [lastPoint];
    if (f90) projectionPoints.push({ date: new Date(lastDate.getTime() + 90 * DAY_MS), value: f90.center });
    projectionPoints.push({ date: new Date(lastDate.getTime() + 180 * DAY_MS), value: f180.center });
    marks.push(
      Plot.line(projectionPoints, { x: "date", y: "value", stroke: THEME.gold, strokeWidth: 1.5, strokeDasharray: "4,4" })
    );
    marks.push(
      Plot.areaY(
        [
          { date: lastDate, low: lastPoint.value, high: lastPoint.value },
          { date: new Date(lastDate.getTime() + 180 * DAY_MS), low: f180.low, high: f180.high },
        ],
        { x: "date", y1: "low", y2: "high", fill: THEME.gold, fillOpacity: 0.18 }
      )
    );
  }
  el.append(Plot.plot({ ...plotBase(el), y: { label: "descargas acumuladas (HuggingFace)", grid: true }, marks }));
  return true;
}

export async function mountDashboard() {
  const el = document.getElementById("scatter-momentum");
  if (!el) return;
  const dataset = await loadDataset();
  if (!dataset || !renderMomentumScatter(el, dataset.models)) {
    renderEmpty(el);
  }
}

export async function mountModelPage() {
  const el = document.getElementById("chart-downloads");
  if (!el || !el.dataset.model) return;
  let model;
  try {
    model = JSON.parse(el.dataset.model);
  } catch {
    return renderEmpty(el);
  }
  if (!renderDownloadsSeries(el, model)) renderEmpty(el, "Aún no hay serie histórica para este modelo.");
}
