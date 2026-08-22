import test from "node:test";
import assert from "node:assert/strict";
import { detectAltas, detectBajas, detectPriceDrops } from "../scripts/lib/movements.js";

const DAY = 86400000;
const day = (offset, base = "2026-08-20") => new Date(Date.parse(base) + offset * DAY).toISOString().slice(0, 10);

function presence(entries) {
  return new Map(entries.map(([date, keys]) => [date, new Set(keys)]));
}

test("detectAltas marca modelos vistos por primera vez dentro de la ventana", () => {
  const p = presence([
    ["2026-07-05", ["viejo"]],
    ["2026-08-19", ["viejo", "nuevo"]],
  ]);
  const altas = detectAltas(p);
  assert.deepEqual(altas.map((a) => a.matchKey), ["nuevo"]);
  assert.equal(altas[0].firstSeen, "2026-08-19");
});

test("detectAltas ignora lo visto fuera de la ventana", () => {
  const p = presence([["2026-07-01", ["viejo"]], ["2026-08-20", ["viejo"]]]);
  assert.deepEqual(detectAltas(p), []);
});

test("detectAltas con historial vacío devuelve vacío", () => {
  assert.deepEqual(detectAltas(new Map()), []);
});

test("detectBajas detecta desaparecidos recientes sin duplicar", () => {
  const p = presence([
    ["2026-08-15", ["a", "b"]],
    ["2026-08-17", ["a"]],
    ["2026-08-20", ["a", "c"]],
  ]);
  const bajas = detectBajas(p);
  assert.deepEqual(bajas.map((b) => b.matchKey), ["b"]);
  assert.equal(bajas[0].lastSeen, "2026-08-15");
});

test("detectBajas exige al menos dos fechas", () => {
  const p = presence([["2026-08-20", ["a"]]]);
  assert.deepEqual(detectBajas(p), []);
});

test("detectPriceDrops dispara con caída >= umbral", () => {
  const s = [
    { date: day(-2), value: 10 },
    { date: day(0), value: 7 },
  ];
  const events = detectPriceDrops(s);
  assert.equal(events.length, 1);
  assert.ok(Math.abs(events[0].pctChange + 0.3) < 1e-9);
  assert.equal(events[0].oldPrice, 10);
  assert.equal(events[0].newPrice, 7);
});

test("detectPriceDrops marca el paso a gratis aunque el previo sea chico", () => {
  const s = [
    { date: day(-1), value: 0.5 },
    { date: day(0), value: 0 },
  ];
  const events = detectPriceDrops(s);
  assert.equal(events.length, 1);
  assert.equal(events[0].wentFree, true);
});

test("detectPriceDrops ignora caídas leves y precios nulos", () => {
  const s = [
    { date: day(-3), value: 10 },
    { date: day(-2), value: null },
    { date: day(-1), value: 9.5 },
  ];
  assert.deepEqual(detectPriceDrops(s), []);
});
