import test from "node:test";
import assert from "node:assert/strict";
import { classifyLab, isExcludedSlug, loadLabs } from "../scripts/lib/labs.js";

test("loadLabs lee la config real con 9 labs y fragments slugificados", async () => {
  const { labs, excludeFragments } = await loadLabs();
  assert.equal(labs.length, 9);
  const ids = labs.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const lab of labs) {
    assert.ok(lab.label);
    assert.ok((lab.prefixes ?? []).length > 0);
  }
  assert.ok(excludeFragments.includes("gpt4"));
});

test("classifyLab matchea por prefix de OpenRouter para cada lab", async () => {
  const { labs } = await loadLabs();
  const cases = [
    ["anthropic/claude-opus-5", "anthropic"],
    ["google/gemini-3.7-flash", "google"],
    ["openai/gpt-5.6-luna", "openai"],
    ["deepseek/deepseek-v4-pro", "deepseek"],
    ["qwen/qwen3.8-max", "alibaba"],
    ["moonshotai/kimi-k3", "moonshot"],
    ["z-ai/glm-5.2", "zhipu"],
    ["thudm/glm-4.6", "zhipu"],
    ["minimax/minimax-m3", "minimax"],
    ["x-ai/grok-4.6", "xai"],
  ];
  for (const [id, expected] of cases) {
    assert.equal(classifyLab(labs, { id })?.id ?? null, expected, id);
  }
});

test("classifyLab es case-insensitive y devuelve null fuera del whitelist", async () => {
  const { labs } = await loadLabs();
  assert.equal(classifyLab(labs, { id: "ANTHROPIC/Claude-Opus-5" }).id, "anthropic");
  assert.equal(classifyLab(labs, { id: "meta-llama/llama-4" }), null);
  assert.equal(classifyLab(labs, { id: "mistralai/mistral-large" }), null);
  assert.equal(classifyLab(labs, { id: null }), null);
  assert.equal(classifyLab(labs, {}), null);
});

test("isExcludedSlug detecta generaciones muertas sin tocar las vigentes", () => {
  const excluded = ["gpt4", "claude3", "qwen25"].map((f) => f);
  assert.equal(isExcludedSlug(excluded, ["openaigpt4o"]), true);
  assert.equal(isExcludedSlug(excluded, ["openaigpt35turbo"]), false);
  assert.equal(isExcludedSlug(["gpt35"], ["openaigpt35turbo"]), true);
  assert.equal(isExcludedSlug(excluded, ["anthropicclaudesonnets45"]), false);
  assert.equal(isExcludedSlug(excluded, ["qwenqwen3max"]), false);
  assert.equal(isExcludedSlug([], ["loquesea"]), false);
});
