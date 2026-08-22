import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export const EDITIONS_DIR = path.resolve("src/content/ediciones");

export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim().replace(/^"|"$/g, "");
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    data[m[1]] = value;
  }
  return { meta: data, body: match[2] };
}

export function renderEditionHtml(body, baseUrl) {
  return marked.parse(String(body).replaceAll('src="/charts/', `src="${baseUrl}charts/`));
}

function excerptFrom(body) {
  return String(body)
    .replace(/<[^>]+>/g, "")
    .replace(/[#*>\[\]]/g, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .slice(0, 180);
}

export async function readEditions({ includeDrafts = false } = {}) {
  const files = (await fs.readdir(EDITIONS_DIR).catch(() => [])).filter((f) => f.endsWith(".md"));
  const editions = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(EDITIONS_DIR, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const published = String(meta.published) === "true";
    if (published === false && !includeDrafts) continue;
    editions.push({
      slug: file.replace(/\.md$/, ""),
      title: meta.title ?? file,
      date: String(meta.date ?? file),
      gems: Array.isArray(meta.gems) ? meta.gems : [],
      cover: typeof meta.cover === "string" ? meta.cover : "",
      published,
      body,
      excerpt: excerptFrom(body),
    });
  }
  return editions.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function loadPublishedEditions() {
  return readEditions({ includeDrafts: false });
}
