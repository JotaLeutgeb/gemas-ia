const DAY_MS = 86400000;

export function detectAltas(presenceByDate, { windowDays = 7 } = {}) {
  const dates = [...presenceByDate.keys()].sort();
  if (dates.length === 0) return [];
  const lastDate = dates[dates.length - 1];
  const cutoff = Date.parse(lastDate) - windowDays * DAY_MS;
  const firstSeen = new Map();
  for (const date of dates) {
    for (const key of presenceByDate.get(date)) {
      if (!firstSeen.has(key)) firstSeen.set(key, date);
    }
  }
  return [...firstSeen.entries()]
    .filter(([, firstDate]) => Date.parse(firstDate) >= cutoff)
    .map(([matchKey, firstSeen]) => ({ matchKey, firstSeen }));
}

export function detectBajas(presenceByDate, { windowDays = 7 } = {}) {
  const dates = [...presenceByDate.keys()].sort();
  if (dates.length < 2) return [];
  const lastDate = dates[dates.length - 1];
  const cutoff = Date.parse(lastDate) - windowDays * DAY_MS;
  const current = presenceByDate.get(lastDate);
  const bajas = new Map();
  for (let i = dates.length - 2; i >= 0; i--) {
    const date = dates[i];
    if (Date.parse(date) < cutoff) break;
    for (const key of presenceByDate.get(date)) {
      if (!current.has(key) && !bajas.has(key)) bajas.set(key, date);
    }
  }
  return [...bajas.entries()].map(([matchKey, lastSeen]) => ({ matchKey, lastSeen }));
}

export function detectPriceDrops(series, { dropPct = 0.2, windowDays = 30 } = {}) {
  const events = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev.value == null || curr.value == null || prev.value <= 0) continue;
    if (Date.parse(curr.date) - Date.parse(prev.date) > windowDays * DAY_MS) continue;
    const change = (curr.value - prev.value) / prev.value;
    const wentFree = curr.value === 0;
    if (change <= -dropPct || wentFree) {
      events.push({
        date: curr.date,
        field: "price",
        oldPrice: prev.value,
        newPrice: curr.value,
        pctChange: change,
        wentFree,
      });
    }
  }
  return events;
}
