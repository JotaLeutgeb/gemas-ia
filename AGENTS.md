# AGENTS.md — gemas-ia

> **Este documento es el cerebro del proyecto.** Cualquier agente (o humano) que toque este repo DEBE leerlo completo antes de escribir código, y DEBE actualizarlo cuando cambien decisiones, arquitectura o procesos. Si este documento y el código se contradicen, es un bug: arreglá uno de los dos.

---

## 1. Identidad del proyecto

| Campo | Valor |
|---|---|
| Nombre | **gemas-ia** |
| Tagline | Calidad y precio entre los modelos líderes de la IA |
| Tipo | Sitio 100% estático + pipeline de datos automatizado |
| Idioma del contenido | Español (términos técnicos en inglés) |
| Autor / marca personal | JotaLeutgeb (dueño del proyecto; todo contenido termina atribuyéndole) |

**Propósito en una frase:** comparar SOLO los modelos frontera de los labs líderes (Anthropic, OpenAI, Google DeepMind, DeepSeek, Alibaba/Qwen, Moonshot/Kimi, Z.ai/Zhipu, MiniMax, xAI) para encontrar los de mejor relación calidad/precio ("joyas de eficiencia"), proyectar su tracción con datos históricos propios, y convertir esos hallazgos en contenido analítico para LinkedIn.

**Lo que NO es este proyecto:** un medio de noticias ni un catálogo exhaustivo. No listamos todos los modelos que existen; comparamos entre pares directos y publicamos análisis con tesis: *"estos 3 líderes rompen la relación calidad/precio, y esto implica..."*.

---

## 2. Decisiones fundacionales

### 2026-08-21 — sesión original "grill-me" (parcialmente derogada por el pivote)

1. ~~Objetivo núcleo: joyas ocultas + generación de contenido LinkedIn~~ → DEROGADA: el objetivo sigue siendo eficiencia calidad/precio + LinkedIn, pero DENTRO del universo de labs líderes (ver pivote 2026-08-22).
2. **Alcance v1:** solo LLMs (texto/código). Imagen/video/audio quedan fuera hasta v2. ✓ VIGENTE.
3. ~~Fuentes: OpenRouter + HuggingFace primero; LMArena/Elo + Artificial Analysis/Epoch después~~ → SUSTITUIDA: OpenRouter (catálogo + usage) + Epoch AI benchmarks. HuggingFace FUERA del pipeline.
4. **Recolección:** GitHub Actions cron diario toma snapshots de las APIs y los commitea al repo. Las series temporales son PROPIAS. ✓ VIGENTE.
5. **Forecasting v1:** extrapolación log-lineal sobre últimas semanas, horizonte 3–6 meses, siempre con banda. ✓ VIGENTE (aplica a series de uso).
6. ~~Definición de "joya oculta": momentum + escasez~~ → SUSTITUIDA: score de valor = calidad ÷ precio mezclado; frontera eficiente de Pareto como concepto estrella.
7. **Stack:** Astro 7 + Observable Plot 0.6. Sin Tailwind, sin React. ✓ VIGENTE.
8. **Deploy:** GitHub Pages, repo público, rama `main`. ✓ VIGENTE.
9. **Secciones v1:** dashboard, fichas por modelo, ranking, metodología, blog. ✓ VIGENTE (ranking reconvertido a "mejor valor").
10. **LinkedIn:** borrador semanal automático. Analítico, no noticioso, con cifras citables. ✓ VIGENTE.
11. **Tono:** divulgativo pero defendible; toda cifra rastreable hasta un snapshot. ✓ VIGENTE.

### 2026-08-22 — PIVOTE SOTA (sesión con el dueño; decisiones cerradas)

El proyecto dio una vuelta de 180°: antes EXCLUÍA a los famosos (`config/famous-models.json`); ahora SOLO mira famosos. Motivación: miles de modelos irrelevantes no daban información útil.

1. **Universo:** whitelist de 9 labs en `config/labs.json` — Anthropic, Google DeepMind, OpenAI, DeepSeek, Alibaba (Qwen), Moonshot AI (Kimi), Z.ai (Zhipu), MiniMax, xAI. Entrada automática por prefijo de ID de OpenRouter (`anthropic/`, `qwen/`, `z-ai/`, ...). Todo lo que publique un lab entra solo; las generaciones muertas se sacan con `excludeSlugFragments` editable.
2. **Fuente de calidad:** Epoch AI Benchmarking Hub (ya integrado). Índice propio = ECI cuando existe; si no, compuesto ponderado propio (SWE-bench 30%, GPQA Diamond 25%, MATH L5 15%, HLE 15%, Terminal-Bench 10%, MMLU 5%; mínimo 2 benchmarks).
3. **Precio KPI:** mezcla 3:1 estándar del sector: `blended = 0.75 × entrada + 0.25 × salida` por 1M tokens.
4. **Score:** `valueScore = quality.index ÷ blendedUsdPerM`. Además: `performanceRank` (calidad pura), `valueRank` (valor), `onEfficiencyFrontier` (frente de Pareto calidad-precio). El viejo `gemScore = momentum × escasez` murió junto con `scarcityFactor`.
5. **HuggingFace fuera:** descargas medían curiosidad open-weights y nunca cubrieron a los líderes cerrados. La señal de tracción es usage real de OpenRouter (tokens/día).
6. **Marca:** se mantiene `gemas-ia`. Las "joyas" ahora son de eficiencia entre líderes, no oscuras.
7. **Variantes:** los IDs de OpenRouter con sufijo `:batch`/`:free`/etc. se ignoran (son variantes de routing del mismo modelo); sufijos de fecha en IDs de usage (`-20260731`) se canonicalizan al modelo base.
8. Los snapshots históricos NO se tocan: el filtro es retroactivo en build-dataset (dataset derivado).

---

## 3. Arquitectura y flujo de datos

```
                  ┌────────────────────────── GitHub Actions ──────────────────────────┐
                  │                                                                    │
    DIARIO (cron) │        SEMANAL (domingo)          SEMANAL (lunes)   EN CADA PUSH   │
    snapshot.yml  │        weekly-draft.yml           benchmarks.yml     deploy.yml     │
                  │                                                                    │
 OpenRouter API ─┤→ scripts/collect-all.mjs                                          
 (catálogo+usage)┘        │                                                           │
                          ▼                                                           │
              data/snapshots/<fuente>/<fecha>.json      (historial inmutable, versionado)
                          │                                                           │
                          ├── data/snapshots/benchmarks/ (Epoch AI, lunes, retención 8)
                          ▼                                                           │
              scripts/build-dataset.mjs                                               │
               (filtra por config/labs.json → universo SOTA)                          │
                          │                                                           │
                          ├──► public/data/dataset.json    (serie temporal completa)  │
                          │         │                                                  ▼
   scripts/generate-weekly-draft.mjs    Astro build  ──────────────►  GitHub Pages
                          │                                           https://<user>.github.io/gemas-ia/
                          ▼
              content/linkedin/<semana>.md  (borrador para editar y publicar)
```

Principios inviolables:
- Los snapshots son **append-only**: nunca se edita ni borra un archivo de `data/snapshots/` pasado. Si una corrida falla, ese día simplemente no existe. **Única excepción:** `data/snapshots/benchmarks/` conserva solo los últimos 8 archivos (es dato de referencia, no historia de mercado).
- `public/data/dataset.json` es un artefacto derivado. Nunca editarlo a mano.
- Todo dato mostrado en el sitio debe provenir de `dataset.json`, que a su vez proviene de snapshots commiteados. Trazabilidad total.
- El universo SOTA es una decisión de build, NO de colecta: los snapshots guardan el catálogo crudo completo; el filtro por labs vive en `config/labs.json` y se aplica retroactivamente en `build-dataset.mjs`. Cambiar la whitelist no requiere tocar datos.
- Los backfills (`scripts/backfill.mjs`) escriben SOLO fechas que no existen en disco; los snapshots propios jamás se pisan.

---

## 4. Mapa del repositorio

```
gemas-ia/
├── AGENTS.md                  ← este documento
├── README.md                  ← cara pública
├── astro.config.mjs           ← site + base '/gemas-ia/'
├── package.json               ← comandos npm (ver §7)
├── config/
│   └── labs.json              ← whitelist de labs líderes + exclusiones legacy (pivote 2026-08-22)
├── data/
│   └── snapshots/
│       ├── openrouter/        ← YYYY-MM-DD.json (append-only; catálogo crudo COMPLETO)
│       ├── openrouter-usage/  ← tokens reales procesados por día
│       ├── huggingface/       ← HISTÓRICO congelado (fuente retirada en el pivote; no se borra)
│       └── benchmarks/        ← Epoch AI semanal (retención máx 8)
├── content/
│   ├── linkedin/              ← borradores semanales privados (hooks, cifras para copiar)
│   └── posts → src/content    (los ensayos del blog viven en src/content/posts)
├── scripts/
│   ├── collect-openrouter.mjs
│   ├── collect-openrouter-usage.mjs
│   ├── collect-benchmarks.mjs
│   ├── collect-all.mjs        ← orquestador diario (tolerante a fallos parciales)
│   ├── build-dataset.mjs      ← snapshots → dataset.json (universo + series + scores v3)
│   ├── generate-weekly-draft.mjs
│   ├── generate-chart-assets.mjs  ← PNG/SVG para LinkedIn (SVG manual estilo print, sin DOM)
│   ├── backfill.mjs           ← subcomando openrouter-usage (repone huecos históricos)
│   ├── model-map.json         ← overrides de matching cross-fuente (claves `_` son docs)
│   └── lib/
│       ├── scoring.js         ← regresión, momentum de uso, proyección con banda
│       ├── quality.js         ← blendedPrice, computeQuality, valueScore, efficiencyFrontier
│       ├── labs.js            ← carga config/labs.json, classifyLab, isExcludedSlug
│       ├── movements.js       ← altas, bajas, price drops (funciones puras)
│       ├── benchmark-match.js ← normalización + matching heurístico Epoch → slugs
│       ├── openrouter-usage.js← slim de rankings diarios + escritura compartida
│       └── util.js            ← slugs, fechas, fetch con retry
├── tests/
│   ├── scoring.test.mjs       ← unit tests de scoring (node:test)
│   ├── labs.test.mjs          ← clasificación de labs y exclusiones
│   ├── quality.test.mjs       ← calidad, precio mezclado, valor, frontera
│   └── dataset.test.mjs       ← smoke del dataset.json + guards de regresión
├── src/
│   ├── config/site.js         ← constantes de marca y URLs
│   ├── lib/ediciones.js       ← frontmatter parser + carga/rendeo de ediciones (compartido)
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   ├── content/
│   │   ├── posts/             ← ensayos del blog
│   │   └── ediciones/         ← ediciones semanales PÚBLICAS (published: true/false)
│   ├── pages/                 ← index, joyas (mejor valor), movimientos, modelos/, metodologia, ediciones/, blog/, rss.xml
│   ├── scripts/charts.js      ← gráficos Observable Plot del lado cliente (scatter calidad-precio, precios, usage)
│   └── styles/global.css
├── public/
│   ├── data/dataset.json      ← generado, nunca manual (schema v3)
│   └── charts/ediciones/<fecha>/ ← gráficos congelados por edición
└── .github/workflows/         ← snapshot.yml, benchmarks.yml, weekly-draft.yml, deploy.yml
```

---

## 5. Fuentes de datos

### Activas hoy

| Fuente | Endpoint | Qué da | Frecuencia | Auth |
|---|---|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1/models` | catálogo completo crudo, precios prompt/completion (USD/token), contexto, modalidad | diaria | ninguna |
| OpenRouter Data API | `https://openrouter.ai/api/v1/datasets/rankings-daily` | tokens reales procesados por día, top-50 (tracción genuina) | diaria | secret `OPENROUTER_API_KEY` |
| Epoch AI | `https://epoch.ai/data/benchmark_data.zip` | ~66 benchmarks curados + externos (GPQA, MATH L5, SWE-bench, HLE, ECI...), CSVs con organización por score | semanal (workflow benchmarks.yml) | ninguna |

Notas duras ganadas a fuerza de golpes:
- Ninguna devuelve series históricas. La historia ES este repositorio; lo histórico se rellenó con backfills y sigue creciendo un punto por día.
- El dataset de uso de OpenRouter arranca en 2025-01-01, permite ventanas ≤366 días por request y **exige citación exacta**: "Source: OpenRouter (openrouter.ai/rankings), as of {as_of}" (CC BY 4.0). Rate limits: 30 req/min, 500 req/día.
- Los benchmarks de Epoch AI son snapshots de referencia con retención de 8 archivos; el matching a nuestros slugs es heurístico (`scripts/lib/benchmark-match.js`, substring bidireccional con mínimo de largo) — los no matcheados se descartan sin inventar nada. El campo `organization` permite auditar a qué lab pertenece cada score.
- **HuggingFace fue retirada en el pivote 2026-08-22** (descargas medían curiosidad open-weights; nunca cubrió líderes cerrados). Sus snapshots históricos quedan congelados en disco; el colector y el subcomando de backfill fueron eliminados.

### Matching entre fuentes

Un mismo modelo puede aparecer con IDs distintos (`deepseek/deepseek-v4-flash` vs `deepseek/deepseek-v4-flash-20260731` del usage). Reglas:
1. Canonización: quitar sufijo de variante (`:batch`, `:free`, ...) y sufijos de fecha (`-20260731`, `-2025-04-16`) → modelo base.
2. Normalizar slug: minúsculas, sin separadores (`llama3370binstruct`).
3. Si hay override manual en `scripts/model-map.json`, gana el override.
4. Si no matchea con nadie, vive como modelo independiente hasta que alguien lo case a mano.

---

## 6. Scoring (definiciones exactas)

Implementación única y autoritativa: `scripts/lib/quality.js` (calidad/precio/valor/frontera), `scripts/lib/benchmark-match.js` (normalización de escala) y `scripts/build-dataset.mjs` (ranks e integración). La página `/metodologia` explica lo mismo en lenguaje humano. Si cambiás una fórmula, cambiá AMBOS lugares.

### Universo (pivote 2026-08-22)

- Un modelo entra si su ID de OpenRouter empieza con un prefijo de `config/labs.json` Y no matchea ningún fragment de `excludeSlugFragments`.
- Se ignoran IDs con sufijo de variante (`:`), modelos sin salida de texto (imagen/audio) y registros fuera de la whitelist.
- El momentum/forecast usa la serie de tokens reales de OpenRouter (usage); los precios usan la serie del catálogo.

### Normalización de escala de benchmarks

Las tablas de Epoch mezclan convenciones: la mayoría guarda fracciones (0.48 = 48%), otras porcentajes u otros índices (ECI ~100–160). `buildBenchmarkIndex` detecta la escala por tabla (si el máximo de la tabla ≤1.5 → fracción → ×100) y normaliza TODOS los scores a porcentaje, conservando `rawScore`. Sin esto, los compuestos mezclan magnitudes incomparables (bug original de qwen-plus/turbo con calidad 0.55).

### Índice de código (KPI principal, refinamiento 2026-08-22 PM)

El foco del sitio es eficiencia PARA PROGRAMAR. El índice primario es media ponderada exclusivamente de benchmarks de código:

```
índice_código = Σ(peso × benchmark_normalizado_0_100) / Σ(pesos disponibles)
SWE-bench Verified 0.40 · Terminal-Bench 0.25 · Cursor Bench 0.15 · SciCode 0.15 · FrontierCode 0.05
```

- Exige ≥2 benchmarks disponibles; si no llega, `quality = null` (visible pero fuera de rankings).
- Cuando Epoch reporta varias versiones del mismo benchmark, se usa la de releaseDate más reciente.
- NO usa ECI como backbone: la escala queda 0–100 consistente para todos los modelos.
- Schema: `quality = {index, source: "code-composite", general}` donde `general = {index, source}` es el índice GENERAL de referencia (ECI si existe, si no compuesto GPQA/MATH/HLE/etc.) — solo display, nunca alimenta rankings.
- Cobertura esperada: ~77 de ~211 modelos (los lanzamientos frescos tardan en tener benches).

### Precio mezclado

```
blendedUsdPerM = 0.75 × promptUsdPerM + 0.25 × completionUsdPerM
```

Último valor observado en OpenRouter. Modelos con precio $0 quedan fuera del ranking de valor (evita infinitos) pero visibles en el resto del sitio.

### Score de valor, ranks y frontera

- `valueScore = quality.index ÷ blendedUsdPerM` (puntos de CÓDIGO por dólar), redondeado a 6 decimales.
- `valueRank`: posición por valueScore desc (solo modelos con quality Y precio > 0).
- `performanceRank`: posición por quality.index desc (ignora precio; leaderboard de código estilo arena).
- `onEfficiencyFrontier`: true si nadie programa mejor por ese precio o menos (frente de Pareto). Implementación: ordenar por precio asc / calidad desc y conservar récords de calidad estrictamente crecientes.
- Momentum de uso (secundario): regresión log-lineal 0.6×tasa7d + 0.4×tasa28d sobre tokens/día, con recorte anti-outliers (>3× mediana local) y fallbacks documentados. Proyecciones 90/180d con banda ±1σ (n−2 dof). Jamás publicar proyección sin banda.

---

## 7. Comandos

```bash
npm install                # setup inicial
npm run collect            # snapshot HOY de catálogo OpenRouter (crudo completo)
npm run collect:usage      # snapshot de uso real (últimos 3 días faltantes; requiere key)
npm run benchmarks         # refresco de benchmarks Epoch AI (snapshot de referencia)
npm run build:dataset      # regenera public/data/dataset.json desde todos los snapshots
npm run draft              # genera borrador semanal en content/linkedin/
npm run test               # node:test: scoring + labs + quality + movements + smoke de dataset
npm run pipeline           # collect + collect:usage + build:dataset + charts (flujo diario completo)
npm run backfill           # runner one-off: subcomando openrouter-usage
npm run dev                # sitio en localhost:4321
npm run build              # build de producción a dist/
npm run preview            # sirve el build
```

Orden correcto tras recolectar: `collect` → `collect:usage` → `build:dataset` → `test` → (`draft` opcional) → commit.

---

## 8. Convenciones obligatorias

- **Idioma:** UI y contenido en español rioplatense neutro. Código, IDs y commits en inglés.
- **Links internos:** SIEMPRE vía `withBase()` de `src/config/site.js`. Jamás escribir `/seccion/` crudo: GitHub Pages sirve bajo subpath `/gemas-ia/` y rompería la navegación. En markdown usar rutas relativas (`../../metodologia/`).
- **Fechas:** siempre ISO `YYYY-MM-DD` UTC. Snapshots usan la fecha UTC del momento.
- **Slugs:** normalización definida en §5. El slug canónico es la identidad del modelo en TODO el sistema.
- **Sin secretos:** las fuentes de fase 1 no requieren keys en código; `OPENROUTER_API_KEY` vive como secret de GitHub (CI) y en `.env` local (gitignored, parser tolera `KEY = valor` y `KEY=valor`). Nunca commitear keys ni loggearlas. Si una key aparece en chat/issues, rotarla.
- **Commits:** prefijos `data:` (snapshots/dataset), `content:` (blog/linkedin), `site:` (UI), `pipeline:` (scripts), `docs:` (este archivo y README).
- **Código sin comentarios explicativos:** los nombres deben bastar; la documentación conceptual vive acá y en `/metodologia`.
- **Sistema visual (2026-08-22, edición nocturna):** el tema "boletín técnico impreso" pasó a oscuro por decisión del dueño el mismo día del pivote — papel cálido casi negro `#16140f`, tinta clara `#eae4d5`, filetes de 1-2px, esquinas casi rectas, cero sombras/gradientes (`color-scheme: dark`, sin toggle: tema único). Tipografía auto-hospedada: Fraunces Variable (display serif), IBM Plex Sans (cuerpo), IBM Plex Mono (todo dato numérico, tabular). Los gráficos de cliente usan tokens `THEME` + mapa `LAB_COLORS` de `src/scripts/charts.js` (un tono claro-apagado por lab, legibles sobre fondo oscuro); los assets PNG del pipeline (`generate-chart-assets.mjs`) comparten la MISMA paleta oscura y son SVG manual estilo print sin Observable Plot ni DOM en Node (Plot requiere `document`; en Node puro falla con `documentElement undefined` — lección del pivote). Jamás hex crueles en marks. Nada de Google Fonts CDN (privacidad/GDPR). Cambiar la identidad visual = actualizar este párrafo + `global.css` + `THEME`/`LAB_COLORS` + favicon + `<meta name="theme-color">`. **Excepción deliberada heredada del v2 nocturno:** los PNG exportados para LinkedIn (`public/charts/`) se generan sobre papel claro porque el feed de LinkedIn es blanco; no "arreglar" eso.
- **Seguridad:** CSP por meta tag (GH Pages no setea headers): `script-src 'self'`, sin inline scripts; estilos con `'unsafe-inline'` necesario para atributos SVG de Plot. Dependencias vigiladas por Dependabot (npm + github-actions, semanal). Sin secrets en fase 1; cuando entre Artificial Analysis usar secret `AA_API_KEY`. XSS revisado: nombres de modelos solo fluyen vía expresiones Astro (escapadas) y `textContent` de Plot — nunca `innerHTML` manual.
- **Liability:** aviso legal en `/metodologia#aviso-legal` (sin garantías, proyecciones ≠ consejos, marcas de sus dueños, sin tracking). Código MIT (`LICENSE`), datos CC BY 4.0 (`LICENSE-DATA.md`) citando Gemas IA + fuentes upstream.
- **Observabilidad:** el dataset expone `sources.<fuente>.{ok, errors, fetchedAt}` agregado desde `_meta` de snapshots; el dashboard lo muestra como health-strip con estados ok/stale/unknown. Los errores de colecta NUNCA se ocultan: quedan en el snapshot y se reflejan en la web. Badge de CI en README. Decisión consciente: sin SaaS de monitoring (solo owner); los emails de falla de Actions alcanzan para v1.
- **Actualización de este documento:** toda PR que cambie arquitectura, scoring, fuentes o procesos debe incluir los cambios correspondientes en AGENTS.md. Un agente que detecte desalineación doc↔código debe corregirla en la misma PR.

---

## 9. Rutinas para agentes futuros

### Agregar un lab nuevo a la comparación
1. Agregar una entrada en `config/labs.json` con `id`, `label` y `prefixes` (prefijos de ID de OpenRouter, ej. `mistralai/`). Opcionalmente un color apagado en `LAB_COLORS` (`src/scripts/charts.js`).
2. Si el lab tiene generaciones viejas que no querés comparar, sumar fragments a `excludeSlugFragments`.
3. Correr `npm run build:dataset` y verificar que los modelos nuevos tengan lab asignado.
4. Actualizar §1/§2 de este documento si la lista oficial de labs cambió.

### Agregar una fuente nueva (ej. Artificial Analysis)
1. Crear `scripts/collect-<fuente>.mjs` siguiendo el patrón de los existentes: fetch con retry, filtrado mínimo INMUTABLE (guardar crudo, procesar después), escritura atómica a `data/snapshots/<fuente>/<fecha>.json`.
2. Sumarlo a `collect-all.mjs`.
3. Extender `build-dataset.mjs` para fusionar la nueva fuente (matching según §5).
4. Actualizar §5, §6 y `/metodologia` en la misma PR.

### Depurar un número raro en el sitio
1. Buscar el slug en `public/data/dataset.json` → ver qué snapshot lo originó.
2. Inspeccionar el snapshot crudo del día en `data/snapshots/`.
3. Si un modelo esperado no aparece: verificar en orden — ¿está en el snapshot crudo? ¿su prefijo está en `labs.json`? ¿matchea algún fragment excluido? ¿es variante `:` o no-texto? ¿tiene quality null (sin benchmarks)?

### Generar y publicar contenido semanal (rutina del dueño)
El motor de contenido produce DOS artefactos cada semana con `npm run draft` (o cron del domingo):
1. **Borrador privado** `content/linkedin/<fecha>.md` — hooks alternativos, cifras citables, contador de caracteres para copy-paste en LinkedIn.
2. **Edición pública** `src/content/ediciones/<fecha>.md` con `published: false` — el artículo web con gráficos congelados en `public/charts/ediciones/<fecha>/`.

Flujo de publicación:
1. Editar la EDICIÓN pública: completar los marcadores `[SU HISTORIA AQUÍ]` y `[TU ANÁLISIS AQUÍ]` con criterio propio. Ajustar el título si hace falta.
2. Cambiar `published: false` → `true` y commitear (`content:`). El sitio publica `/ediciones/<fecha>/` con protagonistas linkeando a sus fichas.
3. Copiar al post de LinkedIn el texto del borrador privado + adjuntar `public/charts/ediciones/<fecha>/semana.png`.
4. En el post, linkear la URL pública de la edición (cada página tiene botón de compartir a LinkedIn).
5. El blog (`/blog/`) muestra mezcladas ediciones y ensayos ordenados por fecha; el dashboard tiene tarjeta de última edición; hay feed RSS en `/rss.xml`.

REGLA: nunca publicar una edición con placeholders sin reemplazar. Los archivos de ediciones ya existentes NUNCA se sobreescriben por el generador salvo `--force`.

### Publicar por primera vez en GitHub Pages
> **HECHO 2026-08-22:** usuario real `JotaLeutgeb`, remote configurado, placeholders reemplazados.
> Lección: la rutina original listaba 4 lugares y había 9 (faltaban BaseLayout canonical fallback, metodologia.astro, util.js User-Agent, AGENTS.md identidad). Cuando agregues URLs hardcodeadas, sumalas acá.

Pasos:
1. ~~Crear repo público llamado exactamente `gemas-ia` bajo la cuenta del dueño.~~ ✓
2. ~~Hacer el reemplazo de usuario en los 4 lugares y commitear (`docs:`).~~ ✓ (fueron 9)
3. `git remote add origin https://github.com/JotaLeutgeb/gemas-ia.git && git push -u origin main`.
4. En GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
5. Verificar que corra deploy.yml (verde) y que `https://jotaleutgeb.github.io/gemas-ia/` responda.
6. Confirmar que snapshot.yml quedó habilitado (pestaña Actions → scheduled workflow).

### Checklist de release de features grandes
- [ ] `npm test` pasa (42 tests: scoring + labs + quality + movements + smoke de dataset)
- [ ] Build pasa (`npm run build`)
- [ ] `dataset.json` regenerado sin errores
- [ ] AGENTS.md actualizado
- [ ] Página `/metodologia` consistente con el código
- [ ] Probado con datos vacíos (primer día de un modelo nuevo) y con datos completos

---

## 10. Registro de auditorías

### 2026-08-22 — auditoría v0.1 (post-scaffold)
Hallazgos corregidos, dejados como guards donde aplica:
1. **Modelo fantasma** desde la clave `_usage` de `model-map.json` → `loadModelMap` filtra claves `_`; guard de regresión en `tests/dataset.test.mjs`.
2. **Links internos absolutos** rotos bajo el subpath `/gemas-ia/` → convención `withBase()` en todo el sitio.
3. **Nav nunca activo** porque no descontaba la base del pathname → corregido en BaseLayout.
4. **`margin: 0` en Observable Plot** recortaba ejes → `plotBase(el)` con ancho del contenedor; banda de forecast reescrita con claves `y1/y2` (`low/high`).
5. **Ruido float en precios** (0.4499999…) → redondeo a 6 decimales en colector OpenRouter.
6. **Guard de ejecución directa** de scripts no matcheaba rutas Windows → `fileURLToPath` + `path.resolve`.
7. KPI "joyas en la mira" contaba lista recortada a 8 → ahora cuenta elegibles totales.
8. Tabla de proyecciones de ficha tenía celda huérfana → reestructurada.

Lecciones operativas: `node --test <dir>` no funciona igual en Windows (usar rutas explícitas); versiones actuales: astro ^7.2.4, @observablehq/plot ^0.6.17.

### 2026-08-22 — auditoría externa (agente auditor) + hardening
1. **Línea de forecast con quiebre falso**: punto a 90 días usaba `center` de 180d → ahora usa `forecastDownloads90d` cuando existe.
2. **Re-run pisaba snapshot del día** (violaba espíritu append-only; una API caída reemplazaba datos buenos por vacío) → guard de existencia en colectores; `--force` para override consciente.
3. **Doc↔código §6 desalineado** (fallbacks de momentum no documentados, outliers "recortados" pero filtrados en código, famosos sin efecto en score) → código alineado a spec: clamp recorta (cap), famosos con `gemScore=null`, fallbacks oficiales escritos.
4. **gemScore round2 generaba empates masivos** con ~600 modelos → precisión 6 decimales; elegibilidad unificada (incluye cap de downloads) compartida por dashboard/joyas/borrador.
5. σ residual con n−2 grados de libertad; proyecciones usan mismo clamp que momentum.
6. Labels corregidos: HF downloads es ACUMULADO, no diario ("descargas diarias" engañaba).
7. Fragments de famosos peligrosos por substring (`"o3"`, `"kimi"`) → `"openaio3"`, `"kimik2"`.
8. CI: `timeout-minutes` en jobs, grupo de concurrencia unificado `data-pipeline` (snapshot y draft ya se pisan entre sí), `.nojekyll` agregado, aria-labels en contenedores de gráficos.
9. Tests 16→21: clamp por recorte, fallback tasa28-sola, corte de ventana 7d, guard de famosos sin score, skip grácil si falta dataset.json.

Veredicto auditor previo a fixes: "REVISAR — base sólida y publicable"; los 4 hallazgos IMPORTANTE quedaron resueltos y verificados (`npm test` 21/21, build 631 páginas).

### 2026-08-22 — publicación + rediseño editorial + seguridad/observabilidad
1. **Publicado** en https://jotaleutgeb.github.io/gemas-ia/ — lección: la rutina de placeholders listaba 4 lugares, había 9 (ver §9).
2. **Rediseño anti-AI-slop**: dark-mode genérico → tema "boletín técnico impreso" (tokens y tipografía documentados en §8 Sistema visual).
3. **Observabilidad de pipeline**: health-strip en dashboard alimentado por `sources.*.{ok,errors,fetchedAt}`; los fallos de colecta son visibles en el sitio, no solo en logs.
4. **Assets LinkedIn**: `npm run charts` genera SVG+PNG (resvg) + tarjeta semanal 1200×630 en `public/charts/`; el borrador semanal las lista para adjuntar. Motivación: LinkedIn no acepta SVG ni markdown. Corrección del pivote: los PNG por modelo NUNCA se generaron en CI (Plot requiere DOM en Node); solo la tarjeta (SVG manual) funcionó jamás.
5. **Borrador v2**: hooks alternativos, comparación precio-vs-gigantes, contador de caracteres contra límite 3000.
6. **Seguridad**: CSP meta (`script-src 'self'`), referrer-policy, Dependabot npm+actions, `npm audit` limpio. Pendiente deliberado: pin actions por SHA (Dependabot cubre updates; revisar si el proyecto crece).
7. **Liability**: aviso legal en metodología + `LICENSE-DATA.md` (CC BY 4.0).

### 2026-08-22 — PIVOTE SOTA (refactor mayor)
Inversión de tesis documentada en §2. Hallazgos y lecciones del refactor:
1. **El filtro es de build, no de colecta**: los snapshots siguen guardando el catálogo crudo completo (~420 modelos/día); `config/labs.json` filtra retroactivamente en build-dataset. Cero migración de datos.
2. **Los fragments de exclusión deben matchear el slug completo normalizado**: `"gpto1"` NUNCA matcheó porque `openai/o1` → slug `openaio1` (sin "g" adyacente). Regla vigente: probar cada fragment contra los slugs reales del dataset antes de commitear.
3. **IDs con sufijo de fecha en usage** (`deepseek/deepseek-v4-flash-20260731`) creaban modelos paralelos al catálogo → canonización automática (`canonicalUsageId`): quita sufijos `:` y fechas `-YYYYMMDD`/`-YYYY-MM-DD` plausibles.
4. **Variantes de routing de OpenRouter** (`:batch`, `:free`, ...) se excluyen de catálogo: son el mismo modelo con otro precio; el paso a "gratis" de una variante free contaminaría valueScore con un infinito.
5. **Modelos solo-usage** (aparecen en rankings pero aún no en catálogo) entran sin precio/quality: visibles, fuera de rankings. El mover del draft semanal exige `links.openrouter` para no terminar citando un matchKey como nombre.
6. **Observable Plot NO funciona en Node puro** (falla con `documentElement undefined`, requiere DOM). Los PNG por modelo nunca se generaron en CI — el commit histórico solo contenía la tarjeta semanal (SVG manual). Solución: assets del pipeline = SVG manual estilo print, sin Plot ni dependencias nuevas.
7. **Schema v3**: modelo pierde `downloads/likes/famous/gemScore/metrics.momentum/forecastDownloads*`; gana `labId/labLabel/blendedUsdPerM/quality{index,source}/valueScore/onEfficiencyFrontier/performanceRank/valueRank`. Top-level gana `labs[]` y `totals.withQuality`. Tests invertidos: ahora guardan que TODO modelo pertenece a la whitelist.
8. **Ratios flagship-vs-flagship**: el viejo hook comparaba gema vs famoso más barato y daba absurdos tipo "+4118%". Nuevo formato: "% de la calidad del líder por % de su precio", con formateo "<1%" para evitar ceros redondeados.
9. Tests 21→42: labs (4), quality (9), guards de schema v3, ranks sin huecos, frontera ⊆ quality+precio>0.
10. Verificación final: `npm test` 43/43 · build 221 páginas (antes 631) · dataset.json ~2.2MB (antes 6.4MB) · frontera eficiente real: 7 modelos entre Qwen3.7 Flash ($0.055) y Claude Fable 5 ($20).
11. **Scatter invisible (fix post-release):** pasarle a `Plot.dot` un `strokeWidth` FUNCIONAL (constante por-datum) produce `stroke-width="NaN"` y el navegador no pinta ningún punto — quedaba solo la línea punteada de la frontera. Además, `stroke: "campoBooleano"` mete booleans por la escala de color declarada para labs (fuera de dominio). Regla: en Plot, las constantes visuales son valores literales; lo por-datum van SOLO por canales válidos (`x`, `y`, `fill`, `r`, `title`). Solución: capas de marks separadas (una para puntos regulares, otra para frontera).
12. **Edición nocturna:** flip completo a tema oscuro único (`#16140f`/`#eae4d5`), sin toggle (CSP `script-src 'self'` complicaría un switch inline y el dueño prefirió oscuro directo). Paleta completa sincronizada en 4 lugares: `global.css`, `THEME`+`LAB_COLORS` (charts.js), `T` (generate-chart-assets.mjs), favicon + theme-color meta.
13. **Exclusión qwen-plus / qwen-turbo + bug de escala latente:** los benchmarks de Epoch mezclan escalas — algunas tablas guardan fracciones (gpqa 0.48 = 48%) y otras porcentajes. Los modelos SIN ECI que caen al compuesto propio y matchean tablas en fracción reciben calidad ~0.5 en vez de ~50, aplastando el scatter. Afectó a `qwenplus` (0.55) y `qwenturbo` (0.47), excluidos por decisión del dueño (`excludeSlugFragments`). La normalización por tabla del refinamiento posterior (item 14) corrige la causa raíz.
14. **Refinamiento: foco código (2026-08-22 PM):** a pedido del dueño, el KPI principal pasó de capacidad general a CAPACIDAD DE CÓDIGO. Cambios: (a) normalización de escala por tabla en `buildBenchmarkIndex` (fracción→porcentaje vía máximo ≤1.5, conserva rawScore) — corrige el bug raíz del item 13; (b) nuevo índice primario `computeCodeQuality` = media ponderada solo de benchmarks de código (SWE-bench 40/Terminal 25/Cursor 15/SciCode 15/FrontierCode 5), sin ECI como backbone → escala 0–100 consistente; (c) el índice general anterior queda anidado como `quality.general` solo display; (d) valueScore/ranks/frontera/scatter ahora miden eficiencia para programar. Cobertura: ~77 modelos con score. UI: labels "índice de código", fichas con KPI "índice general (ref.)", tabla de benchmarks ordenada code-first. Tests 42→47 (nuevos: code quality + normalización). Verificado: leaderboard liderado por GPT-5.3-Codex; mejor valor Qwen3.7 Flash (69.5 pts de código a $0.055/1M).

---

## 11. Roadmap

- [x] v0.1 — scaffold, docs, pipeline fase 1, sitio base, tests, sitemap, OG tags, favicon
- [x] v0.2-pivote — PIVOTE SOTA: universo whitelist 9 labs, índice de calidad Epoch, valueScore, frontera eficiente, HF fuera
- [ ] v0.3 — primera semana real de snapshots del pivote; validar momentum de uso con ≥4 puntos; altas reales de lanzamientos
- [ ] v0.4 — validar visualmente scatter calidad-precio y fichas con series de precios acumuladas
- [ ] v1.0 — primer borrador semanal del nuevo concepto publicado + edición web
- [ ] v1.1 — segmentación por tipo de tarea (corta/media/larga, código agéntico) usando benchmarks específicos
- [ ] v1.2 — Artificial Analysis API (velocidad/tokens-seg y calidad alternativa) o LMArena Elo si aparece fuente estable
- [ ] v1.x — og:image para previews ricos al compartir en LinkedIn
- [ ] v2.x — análisis editorial "swarm economics" (N subagentes baratos vs 1 líder caro) — ahora computable con datos reales

---

## 12. Riesgos y limitaciones conocidas

- **Series jóvenes:** tras el pivote, las series de precios arrancan casi de cero en este checkout (1 snapshot OR local). Las proyecciones necesitan ≥4 puntos; empty states implementados.
- **Benchmarks tardíos:** un lanzamiento puede tardar días/semanas en tener ECI; hasta entonces figura sin score. Las altas lo anuncian igual.
- **Variantes menores de labs grandes:** Qwen publica decenas de tamaños y entran todos por decisión de diseño ("todo el lab automático"). Mitigado con exclusiones legacy editables y filtros por lab/columnas en UI. Si molesta más, curar `excludeSlugFragments`.
- **Matching imperfecto cross-fuente:** el matching heurístico de benchmarks puede fallar en nombres raros; los overrides manuales viven en `model-map.json`.
- **Comparabilidad ECI vs compuesto propio:** la mayoría tiene ECI; los pocos con fallback usan escalas distintas. Los ranks se calculan sobre el número tal cual — documentado en metodología.
- **Endpoints no contractuales:** OpenRouter/Epoch pueden cambiar formatos. Los colectores validan campos esperados y registran errores en `_meta.errors` sin romper la corrida.
- **Rate limits:** usage API permite 500 req/día; la corrida diaria usa 1–2.
- **GitHub Actions gratuito:** repo público = minutos ilimitados. Si el repo se vuelve privado, revisar costos ANTES de mantener los crons.

---

## 13. Reglas de contenido LinkedIn (para borradores generados)

1. Gancho con cifra concreta o contradicción ("el 95% de la calidad del mejor del mundo por menos del 1% de su precio").
2. Máximo 3 protagonistas por edición (top mejor valor), con: lab, contexto, precio mezclado, calidad, pts×$, link a su ficha.
3. Mención del líder absoluto de calidad como contrapunto (arena-style).
4. Un párrafo de análisis cruzado que conecte los hallazgos con una tesis (eficiencia, guerra de precios, swarm economics) — esto requiere edición humana, la máquina solo sugiere.
5. Cierre SIEMPRE: mención del proyecto + invitación a ver el sitio con la metodología.
6. Jamás afirmar cosas que los datos no respalden; si el dato es débil, decirlo.
