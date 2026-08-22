import path from "node:path";
import { ROOT, readJson, slugify } from "./util.js";

export async function loadLabs() {
  try {
    const raw = await readJson(path.join(ROOT, "config", "labs.json"));
    const labs = Array.isArray(raw?.labs) ? raw.labs : [];
    const excludeFragments = Array.isArray(raw?.excludeSlugFragments)
      ? raw.excludeSlugFragments.map((f) => slugify(f))
      : [];
    return { labs, excludeFragments };
  } catch {
    return { labs: [], excludeFragments: [] };
  }
}

export function classifyLab(labs, { id }) {
  if (typeof id !== "string" || !id) return null;
  const lower = id.toLowerCase();
  for (const lab of labs) {
    if ((lab.prefixes ?? []).some((prefix) => lower.startsWith(prefix.toLowerCase()))) return lab;
  }
  return null;
}

export function isExcludedSlug(excludeFragments, aliases) {
  return aliases.some((alias) => excludeFragments.some((fragment) => alias.includes(fragment)));
}
