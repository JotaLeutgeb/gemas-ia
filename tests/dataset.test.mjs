import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = path.join(ROOT, "public", "data", "dataset.json");
const hasDataset = existsSync(DATASET_PATH);

const dataset = hasDataset ? JSON.parse(readFileSync(DATASET_PATH, "utf8")) : null;

test("dataset existe (corré npm run build:dataset)", () => {
  assert.ok(hasDataset, `no se encontró ${DATASET_PATH}`);
});

if (hasDataset) {
  test("dataset tiene schema v1 y modelos", () => {
    assert.equal(dataset.schemaVersion, 1);
    assert.ok(Array.isArray(dataset.models));
    assert.ok(dataset.models.length > 0);
  });

  test("cada modelo tiene identidad mínima válida", () => {
    for (const model of dataset.models) {
      assert.ok(typeof model.matchKey === "string" && model.matchKey.length > 0, `matchKey inválido: ${JSON.stringify(model)}`);
      assert.ok(typeof model.urlSlug === "string" && model.urlSlug.length > 0);
      assert.equal(typeof model.famous, "boolean");
      assert.ok(model.gemScore === null || (model.gemScore >= 0 && model.gemScore <= 1));
    }
  });

  test("urlSlugs únicos en todo el dataset", () => {
    const slugs = dataset.models.map((m) => m.urlSlug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test("series ordenadas cronológicamente", () => {
    for (const model of dataset.models) {
      for (const key of Object.keys(model.series ?? {})) {
        const dates = model.series[key].map((p) => p.date);
        const sorted = [...dates].sort();
        assert.deepEqual(dates, sorted, `${model.matchKey}.${key} desordenada`);
      }
    }
  });

  test("regresión: no existen modelos fantasma de claves de documentación", () => {
    const phantom = dataset.models.filter((m) => /clave\s*=|Ejemplo:|_usage/.test(m.matchKey));
    assert.equal(phantom.length, 0, `fantasmas detectados: ${phantom.map((m) => m.matchKey).join(" | ")}`);
  });

  test("modelos famosos no compiten con gemScore", () => {
    const famousWithScore = dataset.models.filter((m) => m.famous && m.gemScore !== null);
    assert.equal(famousWithScore.length, 0, famousWithScore.map((m) => m.urlSlug).join(", "));
  });
}
