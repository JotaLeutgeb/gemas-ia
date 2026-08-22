import test from "node:test";
import assert from "node:assert/strict";
import {
  BLENDED_INPUT_WEIGHT,
  blendedPrice,
  computeCodeQuality,
  computeQuality,
  efficiencyFrontier,
  latestByBenchmark,
  valueScore,
} from "../scripts/lib/quality.js";

test("blendedPrice aplica la mezcla 3:1 documentada", () => {
  assert.equal(blendedPrice(5, 25), BLENDED_INPUT_WEIGHT * 5 + 0.25 * 25);
  assert.equal(blendedPrice(0, 0), 0);
  assert.ok(Math.abs(blendedPrice(3, 15) - 6) < 1e-9);
});

test("blendedPrice devuelve null con datos inválidos", () => {
  assert.equal(blendedPrice(null, 10), null);
  assert.equal(blendedPrice(2, undefined), null);
  assert.equal(blendedPrice(-1, 5), null);
  assert.equal(blendedPrice(Number.NaN, Number.NaN), null);
});

test("latestByBenchmark conserva el registro más reciente por benchmark", () => {
  const byName = latestByBenchmark([
    { benchmark: "gpqa_diamond", score: 80, releaseDate: "2026-01-01" },
    { benchmark: "gpqa_diamond", score: 88, releaseDate: "2026-06-01" },
    { benchmark: "gpqa_diamond", score: 99, releaseDate: "2025-12-01" },
    { benchmark: "hle", score: Number.NaN, releaseDate: "2026-08-01" },
  ]);
  assert.equal(byName.size, 1);
  assert.equal(byName.get("gpqa_diamond").score, 88);
});

test("computeQuality usa ECI como backbone cuando está disponible", () => {
  const quality = computeQuality([
    { benchmark: "epoch_capabilities_index", score: 155.94, releaseDate: "2026-08-01" },
    { benchmark: "gpqa_diamond", score: 50, releaseDate: "2026-08-01" },
  ]);
  assert.equal(quality.source, "epoch_capabilities_index");
  assert.equal(quality.index, 155.94);
});

test("computeQuality cae a media ponderada sin ECI y exige mínimo de benchmarks", () => {
  const quality = computeQuality([
    { benchmark: "swe_bench_verified", score: 60, releaseDate: "2026-05-01" },
    { benchmark: "gpqa_diamond", score: 80, releaseDate: "2026-05-01" },
  ]);
  assert.equal(quality.source, "composite");
  const expected = (0.3 * 60 + 0.25 * 80) / (0.3 + 0.25);
  assert.ok(Math.abs(quality.index - expected) < 1e-5);

  assert.equal(computeQuality([{ benchmark: "gpqa_diamond", score: 80 }]), null);
  assert.equal(computeQuality([]), null);
  assert.equal(computeQuality(), null);
});

test("valueScore es calidad dividido precio blended y rechaza casos borde", () => {
  assert.equal(valueScore(100, 4), 25);
  assert.equal(valueScore(100, 0), null);
  assert.equal(valueScore(100, -1), null);
  assert.equal(valueScore(null, 4), null);
});

test("computeCodeQuality pondera solo benchmarks de código y exige mínimo", () => {
  const quality = computeCodeQuality([
    { benchmark: "swe_bench_verified", score: 80, releaseDate: "2026-05-01" },
    { benchmark: "terminalbench", score: 60, releaseDate: "2026-05-01" },
    { benchmark: "gpqa_diamond", score: 99, releaseDate: "2026-05-01" },
  ]);
  assert.equal(quality.source, "code-composite");
  const expected = (0.4 * 80 + 0.25 * 60) / (0.4 + 0.25);
  assert.ok(Math.abs(quality.index - expected) < 1e-5);

  const withGeneral = computeCodeQuality([
    { benchmark: "epoch_capabilities_index", score: 150, releaseDate: "2026-06-01" },
    { benchmark: "swe_bench_verified", score: 70 },
    { benchmark: "cursorbench", score: 50 },
    { benchmark: "scicode", score: 60 },
  ]);
  assert.ok(Math.abs(withGeneral.index - (0.4 * 70 + 0.15 * 50 + 0.15 * 60) / 0.7) < 1e-5);
  assert.equal(withGeneral.general.source, "epoch_capabilities_index");
  assert.equal(withGeneral.general.index, 150);

  assert.equal(computeCodeQuality([{ benchmark: "swe_bench_verified", score: 80 }]), null);
  assert.equal(computeCodeQuality([]), null);
});

function item(matchKey, price, quality) {
  return { matchKey, blendedUsdPerM: price, qualityIndex: quality };
}

test("efficiencyFrontier deja solo los modelos no dominados en precio-calidad", () => {
  const models = [
    item("caro-lider", 30, 160),
    item("barato-decente", 1, 120),
    item("barato-malo", 1.2, 90),
    item("medio-dominado", 10, 110),
    item("gratis", 0, 200),
    item("sin-quality", 5, null),
  ];
  const front = efficiencyFrontier(models);
  assert.deepEqual([...front].sort(), ["barato-decente", "caro-lider"]);
});

test("efficiencyFrontier desempata mismo precio por mayor calidad", () => {
  const front = efficiencyFrontier([item("a", 5, 100), item("b", 5, 140), item("c", 5, 140)]);
  assert.deepEqual([...front], ["b"]);
});
