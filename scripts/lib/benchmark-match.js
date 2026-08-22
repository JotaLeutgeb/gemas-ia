export function normalizeBenchModel(version) {
  const base = String(version)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return base.replace(/(max|xhigh|high|medium|low|minimal)$/, "").replace(/\d{6,8}$/, "");
}

export function buildBenchmarkIndex(tables) {
  const index = [];
  for (const table of Object.values(tables ?? {})) {
    for (const record of table.records ?? []) {
      const normalized = normalizeBenchModel(record.modelVersion);
      if (normalized.length < 5) continue;
      index.push({ normalized, benchmark: table.benchmark, source: table.source, ...record });
    }
  }
  return index;
}

export function matchBenchmarks({ aliases, index }) {
  const matches = new Map();
  const normalizedAliases = aliases.map((a) => a.toLowerCase());
  for (const entry of index) {
    for (const alias of normalizedAliases) {
      if (alias.length < 8) continue;
      if (alias.includes(entry.normalized) || entry.normalized.includes(alias)) {
        const key = `${entry.benchmark}|${entry.modelVersion}`;
        if (!matches.has(key)) {
          matches.set(key, {
            benchmark: entry.benchmark,
            score: entry.score,
            releaseDate: entry.releaseDate,
            organization: entry.organization,
            source: entry.source,
            matchedVia: alias === entry.normalized ? "exact" : "substring",
          });
        }
        break;
      }
    }
  }
  return [...matches.values()];
}
