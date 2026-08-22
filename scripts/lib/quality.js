export const BLENDED_INPUT_WEIGHT = 0.75;
export const ECI_BENCHMARK = "epoch_capabilities_index";
export const MIN_BENCHMARKS_FOR_COMPOSITE = 2;

export const QUALITY_FALLBACK_WEIGHTS = {
  swe_bench_verified: 0.3,
  gpqa_diamond: 0.25,
  math_level_5: 0.15,
  hle: 0.15,
  terminalbench: 0.1,
  mmlu: 0.05,
};

export const CODE_QUALITY_WEIGHTS = {
  swe_bench_verified: 0.4,
  terminalbench: 0.25,
  cursorbench: 0.15,
  scicode: 0.15,
  frontiercode: 0.05,
};

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

export function blendedPrice(promptUsdPerM, completionUsdPerM) {
  if (!Number.isFinite(promptUsdPerM) || !Number.isFinite(completionUsdPerM)) return null;
  if (promptUsdPerM < 0 || completionUsdPerM < 0) return null;
  return round6(
    BLENDED_INPUT_WEIGHT * promptUsdPerM + (1 - BLENDED_INPUT_WEIGHT) * completionUsdPerM
  );
}

export function latestByBenchmark(benchmarks) {
  const byName = new Map();
  for (const entry of benchmarks ?? []) {
    if (!entry?.benchmark || !Number.isFinite(entry.score)) continue;
    const prev = byName.get(entry.benchmark);
    if (!prev || String(entry.releaseDate ?? "") > String(prev.releaseDate ?? "")) {
      byName.set(entry.benchmark, entry);
    }
  }
  return byName;
}

export function computeQuality(benchmarks) {
  const byName = latestByBenchmark(benchmarks);
  const eci = byName.get(ECI_BENCHMARK);
  if (eci) return { index: round6(eci.score), source: "epoch_capabilities_index" };

  return compositeFrom(byName, QUALITY_FALLBACK_WEIGHTS, "composite");
}

export function computeCodeQuality(benchmarks) {
  const byName = latestByBenchmark(benchmarks);
  const code = compositeFrom(byName, CODE_QUALITY_WEIGHTS, "code-composite");
  if (code === null) return null;
  const general = computeQuality(benchmarks);
  return { ...code, general };
}

function compositeFrom(byName, weights, source) {
  let weightedSum = 0;
  let weightSum = 0;
  let used = 0;
  for (const [name, weight] of Object.entries(weights)) {
    const entry = byName.get(name);
    if (!entry) continue;
    weightedSum += weight * entry.score;
    weightSum += weight;
    used += 1;
  }
  if (used < MIN_BENCHMARKS_FOR_COMPOSITE || weightSum <= 0) return null;
  return { index: round6(weightedSum / weightSum), source };
}

export function valueScore(qualityIndex, blendedUsdPerM) {
  if (!Number.isFinite(qualityIndex) || !Number.isFinite(blendedUsdPerM)) return null;
  if (blendedUsdPerM <= 0) return null;
  return round6(qualityIndex / blendedUsdPerM);
}

export function efficiencyFrontier(models) {
  const eligible = (models ?? []).filter(
    (m) => Number.isFinite(m.blendedUsdPerM) && m.blendedUsdPerM > 0 && Number.isFinite(m.qualityIndex)
  );
  eligible.sort((a, b) => a.blendedUsdPerM - b.blendedUsdPerM || b.qualityIndex - a.qualityIndex);
  const front = new Set();
  let bestQuality = -Infinity;
  for (const model of eligible) {
    if (model.qualityIndex > bestQuality) {
      front.add(model.matchKey);
      bestQuality = model.qualityIndex;
    }
  }
  return front;
}
