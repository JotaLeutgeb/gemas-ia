import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLabs } from "../scripts/lib/labs.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = path.join(ROOT, "public", "data", "dataset.json");
const hasDataset = existsSync(DATASET_PATH);

const dataset = hasDataset ? JSON.parse(readFileSync(DATASET_PATH, "utf8")) : null;

test("dataset existe (corré npm run build:dataset)", () => {
  assert.ok(hasDataset, `no se encontró ${DATASET_PATH}`);
});

if (hasDataset) {
  test("dataset tiene schema v3 y modelos", () => {
    assert.equal(dataset.schemaVersion, 3);
    assert.ok(Array.isArray(dataset.models));
    assert.ok(dataset.models.length > 0);
  });

  test("movimientos presentes con forma valida", () => {
    const mov = dataset.movements ?? {};
    for (const key of ["altas", "bajas", "priceDrops"]) {
      assert.ok(Array.isArray(mov[key]), `${key} debe ser array`);
    }
    for (const alta of mov.altas) {
      assert.ok(alta.matchKey || alta.urlSlug);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(alta.firstSeen));
    }
  });

  test("cada modelo pertenece a un lab del whitelist y tiene identidad mínima", async () => {
    const { labs } = await loadLabs();
    const labIds = new Set(labs.map((l) => l.id));
    for (const model of dataset.models) {
      assert.ok(typeof model.matchKey === "string" && model.matchKey.length > 0, `matchKey inválido: ${JSON.stringify(model)}`);
      assert.ok(typeof model.urlSlug === "string" && model.urlSlug.length > 0);
      assert.ok(labIds.has(model.labId), `${model.matchKey} con labId desconocido: ${model.labId}`);
      assert.ok(model.labLabel, `${model.matchKey} sin labLabel`);
      if (model.quality !== null) {
        assert.ok(Number.isFinite(model.quality.index), `${model.matchKey} quality.index no finito`);
        assert.equal(model.quality.source, "code-composite");
        if (model.quality.general) {
          assert.ok(["epoch_capabilities_index", "composite"].includes(model.quality.general.source));
        }
        assert.equal(Number.isFinite(model.valueScore), Number.isFinite(model.blendedUsdPerM) && model.blendedUsdPerM > 0);
      }
    }
  });

  test("ranks consistentes: performanceRank y valueRank sin huecos ni repetidos", () => {
    for (const field of ["performanceRank", "valueRank"]) {
      const ranks = dataset.models.map((m) => m[field]).filter((r) => r !== null);
      assert.deepEqual([...ranks].sort((a, b) => a - b), Array.from({ length: ranks.length }, (_, i) => i + 1), `${field} con huecos`);
    }
    const withQuality = dataset.models.filter((m) => m.quality !== null).length;
    const perfRanked = dataset.models.filter((m) => m.performanceRank !== null).length;
    assert.equal(perfRanked, withQuality);
    const withValue = dataset.models.filter((m) => m.valueScore !== null).length;
    const valueRanked = dataset.models.filter((m) => m.valueRank !== null).length;
    assert.equal(valueRanked, withValue);
  });

  test("la frontera de eficiencia es un subconjunto de modelos con quality y precio positivo", () => {
    for (const model of dataset.models) {
      if (!model.onEfficiencyFrontier) continue;
      assert.ok(model.quality !== null, `${model.matchKey} en frontera sin quality`);
      assert.ok(model.blendedUsdPerM > 0, `${model.matchKey} en frontera sin precio`);
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

  test("regresión: no existen modelos fantasma ni fuera del whitelist", () => {
    const phantom = dataset.models.filter(
      (m) => /clave\s*=|Ejemplo:|_usage|meta-llama|mistralai|huggingface/i.test(m.matchKey)
    );
    assert.equal(phantom.length, 0, `fantasmas detectados: ${phantom.map((m) => m.matchKey).join(" | ")}`);
  });
}
