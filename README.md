# gemas-ia

> Calidad y precio entre los modelos líderes de la IA.

Comparador estático de LLMs frontera que persigue tres cosas:

1. **Comparar solo a los líderes**: Anthropic, OpenAI, Google DeepMind, DeepSeek, Alibaba (Qwen), Moonshot (Kimi), Z.ai (Zhipu), MiniMax y xAI — nada de catálogos infinitos.
2. **Medir eficiencia para programar**: índice de código (SWE-bench Verified, Terminal-Bench, Cursor Bench, SciCode y FrontierCode) contra precio mezclado por millón de tokens; ranking de mejor valor, frontera eficiente de Pareto y leaderboard absoluto de código.
3. **Contar la historia**: cada semana, un análisis listo para LinkedIn con cifras citables e imágenes generadas automáticamente.

[![deploy](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/deploy.yml/badge.svg)](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/deploy.yml)
[![snapshot diario](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/snapshot.yml/badge.svg)](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/snapshot.yml)

## Cómo funciona

Un cron diario consulta las APIs públicas de [OpenRouter](https://openrouter.ai) (catálogo, precios y tokens reales procesados), guarda un snapshot inmutable y regenera el dataset que alimenta el sitio. Los benchmarks vienen del hub de [Epoch AI](https://epoch.ai/benchmarks), refrescado semanalmente. La historia se acumula sola: hoy es un punto, en tres meses es una tendencia, en un año es el mapa de la guerra de precios entre los grandes.

- **Dashboard**: scatter calidad vs precio con la frontera eficiente marcada, leaderboard de calidad, movimientos.
- **Mejor valor**: qué líder da más puntos de calidad por dólar (`calidad ÷ precio mezclado`).
- **Modelos por lab**: la línea completa de cada laboratorio con fichas individuales (benchmarks, historial de precios, uso real).
- **Metodología**: cómo se calcula todo, sin cajas negras, con aviso legal.
- **Blog**: análisis con tesis, no crónicas de lanzamiento.

## Stack

Astro 7 + Observable Plot + GitHub Actions + resvg (export PNG para LinkedIn). Sin backend, sin cookies, sin tracking: los datos viven como JSON versionado y el sitio es 100% estático.

## Desarrollo

```bash
npm install
npm run dev        # sitio local
npm test           # 42 tests (scoring + labs + quality + dataset)
npm run pipeline   # collect + dataset + imágenes
```

La documentación operativa completa — decisiones, scoring, rutinas, auditorías — vive en [AGENTS.md](AGENTS.md).
