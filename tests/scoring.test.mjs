import test from "node:test";
import assert from "node:assert/strict";
import {
  clampOutliers,
  linearFit,
  growthRate,
  momentum,
  project,
  normalizeScores,
  scarcityFactor,
} from "../scripts/lib/scoring.js";

const DAY = 86400000;

function series(values, startISO = "2026-07-20") {
  const start = Date.parse(`${startISO}T00:00:00Z`);
  return values.map((value, i) => ({
    date: new Date(start + i * DAY).toISOString().slice(0, 10),
    value,
  }));
}

test("linearFit recupera pendiente e intersección exactas", () => {
  const fit = linearFit([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
  assert.ok(fit);
  assert.equal(fit.slope, 2);
  assert.equal(fit.intercept, 1);
});

test("linearFit devuelve null con menos de 2 puntos", () => {
  assert.equal(linearFit([{ x: 1, y: 1 }]), null);
});

test("growthRate exige al menos 4 puntos", () => {
  assert.equal(growthRate(series([100, 110, 120]), 7), null);
});

test("growthRate de serie plana es ~0", () => {
  const rate = growthRate(series(Array.from({ length: 20 }, () => 500)), 28);
  assert.ok(rate !== null);
  assert.ok(Math.abs(rate.dailySlope) < 1e-9);
});

test("growthRate de crecimiento diario constante 5% acumula ln(1.05)*N", () => {
  let v = 1000;
  const s = series(Array.from({ length: 28 }, () => (v *= 1.05)));
  const rate = growthRate(s, 28);
  assert.ok(Math.abs(rate.accumulated - Math.log(1.05) * 28) < 1e-6);
});

test("momentum cae a tasa 7d cuando no hay 28d de historia", () => {
  const s = series([100, 105, 111, 118, 125]);
  const expected = growthRate(s, 7).accumulated;
  assert.ok(Math.abs(momentum(s) - expected) < 1e-9);
});

test("momentum con historia completa combina 60/40 ambas tasas", () => {
  let v = 1000;
  const s = series(Array.from({ length: 30 }, () => (v *= 1.05)));
  const r7 = growthRate(s, 7).accumulated;
  const r28 = growthRate(s, 28).accumulated;
  assert.ok(Math.abs(momentum(s) - (0.6 * r7 + 0.4 * r28)) < 1e-9);
});

test("project sobre serie log-lineal perfecta no tiene banda", () => {
  const s = series(Array.from({ length: 10 }, (_, i) => 100 * Math.exp(0.1 * i)));
  const p = project(s, 90);
  assert.ok(p);
  const expected = 100 * Math.exp(0.1 * 99);
  assert.ok(Math.abs(p.center / expected - 1) < 1e-6);
  assert.ok(Math.abs(p.high - p.center) < 1e-6);
  assert.ok(Math.abs(p.low - p.center) < 1e-6);
});

test("project exige mínimo 4 puntos", () => {
  assert.equal(project(series([100, 110, 120]), 90), null);
});

test("scarcityFactor respeta los umbrales documentados", () => {
  assert.equal(scarcityFactor(null), 1);
  assert.equal(scarcityFactor(499_999), 1);
  assert.equal(scarcityFactor(600_000), 0.5);
  assert.equal(scarcityFactor(5_000_001), 0);
});

test("normalizeScores mapea min->0 max->1 y preserva nulls", () => {
  const norm = normalizeScores([10, 20, 30]);
  assert.equal(norm(10), 0);
  assert.equal(norm(30), 1);
  assert.ok(Math.abs(norm(20) - 0.5) < 1e-9);
  assert.equal(norm(null), null);
  assert.equal(normalizeScores([])(5), null);
});

test("clampOutliers recorta al cap sin perder puntos", () => {
  const s = series([10, 10, 11, 10, 10_000]);
  const clamped = clampOutliers(s);
  assert.equal(clamped.length, s.length);
  const med = 10;
  assert.ok(clamped.every((p) => p.value <= Math.max(med * 3, 1)));
});

test("momentum usa solo tasa 28d cuando la ventana 7d queda vacía", () => {
  const start = Date.parse("2026-07-01T00:00:00Z");
  let v = 100;
  const s = Array.from({ length: 9 }, (_, i) => ({
    date: new Date(start + i * 3 * DAY).toISOString().slice(0, 10),
    value: (v *= 1.05),
  }));
  const r28 = growthRate(s, 28).accumulated;
  assert.equal(growthRate(s, 7), null);
  assert.ok(Math.abs(momentum(s) - r28) < 1e-9);
});

test("growthRate solo considera los últimos N días", () => {
  const flatOld = Array.from({ length: 12 }, () => 1000);
  let v = 1000;
  const recentGrowth = Array.from({ length: 7 }, () => (v *= 1.1));
  const s = series([...flatOld, ...recentGrowth], "2026-06-15");
  const rate = growthRate(s, 7);
  assert.ok(rate !== null);
  assert.ok(Math.abs(rate.accumulated - Math.log(1.1) * 7) < 0.05 * Math.abs(rate.accumulated));
});
