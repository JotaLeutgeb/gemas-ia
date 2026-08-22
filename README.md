# gemas-ia

> El radar de las joyas ocultas de la IA.

Observatorio estático de modelos LLM que persigue tres cosas:

1. **Encontrar joyas ocultas**: modelos poco conocidos con la mejor relación calidad/precio del mercado.
2. **Proyectar su evolución**: forecasting de tendencias construido sobre series temporales propias (snapshots diarios versionados en este mismo repo).
3. **Contar la historia**: cada semana, un análisis listo para LinkedIn con cifras citables y gráficos.

## Cómo funciona

Un cron diario consulta las APIs públicas de [OpenRouter](https://openrouter.ai) y [HuggingFace](https://huggingface.co), guarda un snapshot inmutable y regenera el dataset que alimenta el sitio. La historia se acumula sola: hoy es un punto, en tres meses es una tendencia, en un año es un mapa del mercado.

- Dashboard: panorama general del mercado LLM.
- Ranking de joyas: modelos fuera del radar mainstream ordenados por score.
- Fichas por modelo: evolución histórica y proyección a 3–6 meses con banda de confianza.
- Metodología: cómo se calcula todo (sin cajas negras).

## Stack

Astro + Observable Plot + GitHub Actions. Sin backend: los datos viven como JSON versionado y el sitio es 100% estático servido por GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev
```

La documentación operativa completa — decisiones, scoring, rutinas — vive en [AGENTS.md](AGENTS.md).
