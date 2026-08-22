export const SITE = {
  name: "Gemas IA",
  tagline: "Calidad y precio entre los modelos líderes de la IA",
  description:
    "Comparador estático de LLMs frontera: calidad, precios y eficiencia calidad-precio entre los labs líderes (Anthropic, OpenAI, Google DeepMind, DeepSeek, Alibaba, Moonshot, Z.ai, MiniMax, xAI), con datos propios trazables día a día.",
  author: "JotaLeutgeb",
  repoUrl: "https://github.com/JotaLeutgeb/gemas-ia",
  sources: [
    { label: "OpenRouter", url: "https://openrouter.ai" },
    { label: "Epoch AI", url: "https://epoch.ai/benchmarks" },
  ],
};

export const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/joyas/", label: "Mejor valor" },
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
