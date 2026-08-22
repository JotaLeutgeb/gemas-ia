export const SITE = {
  name: "Gemas IA",
  tagline: "El radar de las joyas ocultas de la IA",
  description:
    "Observatorio estático de LLMs: detectamos modelos poco conocidos con la mejor relación calidad/precio y proyectamos su evolución con datos propios.",
  author: "JotaLeutgeb",
  repoUrl: "https://github.com/JotaLeutgeb/gemas-ia",
  sources: [
    { label: "OpenRouter", url: "https://openrouter.ai" },
    { label: "HuggingFace", url: "https://huggingface.co" },
  ],
};

export const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/joyas/", label: "Joyas" },
  { href: "/movimientos/", label: "Movimientos" },
  { href: "/modelos/", label: "Modelos" },
  { href: "/metodologia/", label: "Metodología" },
  { href: "/blog/", label: "Blog" },
];

export const BASE = import.meta.env.BASE_URL;

export function withBase(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE.replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
}
