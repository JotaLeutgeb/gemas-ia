export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function linearFit(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function clampOutliers(series) {
  if (series.length < 5) return series;
  const cap = Math.max(median(series.map((p) => p.value)) * 3, 1);
  return series.map((p) => (p.value > cap ? { ...p, value: cap } : p));
}

export function logPoints(series) {
  return series.filter((p) => Number.isFinite(p.value) && p.value > 0);
}

export function growthRate(series, windowDays) {
  const positive = logPoints(clampOutliers(series));
  if (positive.length < 4) return null;
  const lastDate = Date.parse(positive[positive.length - 1].date);
  const cutoff = lastDate - windowDays * 86400000;
  const window = positive.filter((p) => Date.parse(p.date) >= cutoff);
  if (window.length < 4 || window.length < Math.ceil(windowDays * 0.25)) return null;
  const dayZero = Date.parse(window[0].date);
  const fit = linearFit(
    window.map((p) => ({ x: (Date.parse(p.date) - dayZero) / 86400000, y: Math.log(p.value) }))
  );
  if (!fit) return null;
  return { dailySlope: fit.slope, accumulated: fit.slope * windowDays };
}

export function momentum(downloadsSeries) {
  const rate7 = growthRate(downloadsSeries, 7);
  const rate28 = growthRate(downloadsSeries, 28);
  if (rate28 === null) {
    if (rate7 === null) return null;
    return rate7.accumulated;
  }
  if (rate7 === null) return rate28.accumulated;
  return 0.6 * rate7.accumulated + 0.4 * rate28.accumulated;
}

const MIN_POINTS_FOR_FORECAST = 4;

export function project(series, horizonDays) {
  const positive = logPoints(clampOutliers(series));
  if (positive.length < MIN_POINTS_FOR_FORECAST) return null;
  const dayZero = Date.parse(positive[0].date);
  const points = positive.map((p) => ({ x: (Date.parse(p.date) - dayZero) / 86400000, y: Math.log(p.value) }));
  const fit = linearFit(points);
  if (!fit) return null;
  const lastX = points[points.length - 1].x;
  const dof = Math.max(points.length - 2, 1);
  const residualStd = Math.sqrt(
    points.reduce((acc, p) => acc + (p.y - (fit.intercept + fit.slope * p.x)) ** 2, 0) / dof
  );
  const targetX = lastX + horizonDays;
  const center = Math.exp(fit.intercept + fit.slope * targetX);
  const band = Math.exp(residualStd);
  return { center, low: center / band, high: center * band };
}

export function normalizeScores(values) {
  const valid = values.filter((v) => v !== null && Number.isFinite(v));
  if (valid.length === 0) return () => null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return () => 0.5;
  return (v) => (v === null || !Number.isFinite(v) ? null : (v - min) / (max - min));
}
