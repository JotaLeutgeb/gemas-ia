import * as Plot from "@observablehq/plot";

const PLOT_OPTIONS = {
  style: { background: "transparent", color: "#e6edf5", width: "100%", height: 340 },
  margin: 0,
};

export async function loadDataset() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/dataset.json`);
  if (!response.ok) return null;
  return response.json();
}

function clear(el) {
  el.replaceChildren();
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
      urlSlug: m.urlSlug,
    }));
  if (points.length < 3) return false;
  clear(el);
  el.append(
    Plot.plot({
      ...PLOT_OPTIONS,
      x: { label: "precio entrada US$/1M (escala log)", tickFormat: (d) => `$${10 ** d >= 1 ? 10 ** d : 10 ** d.toFixed(1)}` },
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
      color: { domain: [false, true], range: ["#34d399", "#f87171"] },
    })
  );
  return true;
}

export function renderDownloadsSeries(el, model) {
  const series = (model.series.downloads ?? []).map((p) => ({ date: new Date(p.date), value: p.value }));
  if (series.length < 2) return false;
  clear(el);
  const forecast = model.metrics.forecastDownloads180d;
  const marks = [
    Plot.areaY(series, { x: "date", y: "value", fill: "#34d399", fillOpacity: 0.12 }),
    Plot.line(series, { x: "date", y: "value", stroke: "#34d399", strokeWidth: 2 }),
    Plot.dot(series, { x: "date", y: "value", fill: "#34d399", r: 3, title: (d) => `${d.date.toISOString().slice(0, 10)}: ${d.value.toLocaleString("es")}` }),
  ];
  if (forecast) {
    const lastDate = series[series.length - 1].date;
    marks.push(
      Plot.line(
        [
          { ...series[series.length - 1], date: lastDate },
          { date: new Date(lastDate.getTime() + 90 * 86400000), value: forecast.center },
          { date: new Date(lastDate.getTime() + 180 * 86400000), value: forecast.center },
        ],
        { x: "date", y: "value", stroke: "#fbbf24", strokeWidth: 1.5, strokeDasharray: "4,4" }
      )
    );
    marks.push(
      Plot.areaY(
        [
          series[series.length - 1],
          { date: new Date(lastDate.getTime() + 180 * 86400000), value: forecast.high },
          { date: new Date(lastDate.getTime() + 180 * 86400000), value: forecast.low },
        ],
        { x: "date", y: "value", y1: "low", y2: "high", fill: "#fbbf24", fillOpacity: 0.15 }
      )
    );
  }
  el.append(Plot.plot({ ...PLOT_OPTIONS, y: { label: "descargas diarias (HuggingFace)", grid: true }, marks }));
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
