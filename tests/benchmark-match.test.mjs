import test from "node:test";
import assert from "node:assert/strict";
import { buildBenchmarkIndex, matchBenchmarks, normalizeBenchModel, tableScale } from "../scripts/lib/benchmark-match.js";

test("normalizeBenchModel quita sufijos de variante y fechas", () => {
  assert.equal(normalizeBenchModel("Grok-4.6_xhigh"), "grok46");
  assert.equal(normalizeBenchModel("gemini-3.7-flash_high"), "gemini37flash");
  assert.equal(normalizeBenchModel("claude-opus-5-20260723"), "claudeopus5");
});

test("tableScale detecta tablas en fracción y las marca x100", () => {
  assert.equal(tableScale([{ score: 0.83 }, { score: 0.41 }, { score: 0.95 }]), 100);
  assert.equal(tableScale([{ score: 82.35 }, { score: 40.1 }]), 1);
  assert.equal(tableScale([{ score: 155.94 }]), 1);
  assert.equal(tableScale([]), 1);
  assert.equal(tableScale([{ score: 0 }, { score: 0.9 }]), 100);
});

test("buildBenchmarkIndex normaliza scores a porcentaje y conserva el crudo", () => {
  const index = buildBenchmarkIndex({
    a: {
      benchmark: "swe_bench_verified",
      source: "epoch",
      records: [
        { modelVersion: "model-a", score: 0.835, releaseDate: "2026-01-01", organization: "OpenAI" },
      ],
    },
    b: {
      benchmark: "epoch_capabilities_index",
      source: "epoch",
      records: [{ modelVersion: "model-a", score: 155.94, releaseDate: "2026-01-02", organization: "OpenAI" }],
    },
  });
  const swe = index.find((e) => e.benchmark === "swe_bench_verified");
  assert.equal(swe.score, 83.5);
  assert.equal(swe.rawScore, 0.835);
  assert.equal(swe.scaled, true);
  const eci = index.find((e) => e.benchmark === "epoch_capabilities_index");
  assert.equal(eci.score, 155.94);
  assert.equal(eci.scaled, false);
});

test("matchBenchmarks matchea por substring y deduplica", () => {
  const index = buildBenchmarkIndex({
    a: {
      benchmark: "terminalbench",
      source: "external",
      records: [{ modelVersion: "gpt-53-codex_xhigh", score: 0.72, releaseDate: "2026-03-01" }],
    },
  });
  const matches = matchBenchmarks({ aliases: ["openaigpt53codex"], index });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].score, 72);
});
