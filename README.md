# gemas-ia

> El radar de las joyas ocultas de la IA.

Observatorio estático de modelos LLM que persigue tres cosas:

1. **Encontrar joyas ocultas**: modelos poco conocidos con la mejor relación crecimiento/escasez del mercado.
2. **Proyectar su evolución**: forecasting con bandas de confianza sobre series temporales propias (snapshots diarios versionados en este mismo repo).
3. **Contar la historia**: cada semana, un análisis listo para LinkedIn con cifras citables e imágenes generadas automáticamente.

[![deploy](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/deploy.yml/badge.svg)](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/deploy.yml)
[![snapshot diario](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/snapshot.yml/badge.svg)](https://github.com/JotaLeutgeb/gemas-ia/actions/workflows/snapshot.yml)

## Cómo funciona

Un cron diario consulta las APIs públicas de [OpenRouter](https://openrouter.ai) y [HuggingFace](https://huggingface.co), guarda un snapshot inmutable y regenera el dataset que alimenta el sitio. La historia se acumula sola: hoy es un punto, en tres meses es una tendencia, en un año es un mapa del mercado.

- **Dashboard**: panorama del mercado (precio vs momentum), estado de recolección en vivo.
- **Ranking de joyas**: modelos fuera del radar mainstream ordenados por score.
- **Fichas por modelo**: evolución histórica y proyección a 90/180 días con banda de confianza.
- **Metodología**: cómo se calcula todo, sin cajas negras, con aviso legal.
- **Blog**: análisis con tesis, no crónicas de lanzamiento.

## Stack

Astro 7 + Observable Plot + GitHub Actions + resvg (export PNG para LinkedIn). Sin backend, sin cookies, sin tracking: los datos viven como JSON versionado y el sitio es 100% estático.

## Desarrollo

```bash
npm install
npm run dev        # sitio local
npm test           # 21 tests (scoring + dataset)
npm run pipeline   # collect + dataset + imágenes
```

La documentación operativa completa — decisiones, scoring, rutinas, auditorías — vive en [AGENTS.md](AGENTS.md).
