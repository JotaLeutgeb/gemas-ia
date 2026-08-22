# AGENTS.md — gemas-ia

> **Este documento es el cerebro del proyecto.** Cualquier agente (o humano) que toque este repo DEBE leerlo completo antes de escribir código, y DEBE actualizarlo cuando cambien decisiones, arquitectura o procesos. Si este documento y el código se contradicen, es un bug: arreglá uno de los dos.

---

## 1. Identidad del proyecto

| Campo | Valor |
|---|---|
| Nombre | **gemas-ia** |
| Tagline | El radar de las joyas ocultas de la IA |
| Tipo | Sitio 100% estático + pipeline de datos automatizado |
| Idioma del contenido | Español (términos técnicos en inglés) |
| Autor / marca personal | JotaLeutgeb (dueño del proyecto; todo contenido termina atribuyéndole) |

**Propósito en una frase:** detectar modelos LLM poco conocidos que ofrecen la mejor relación calidad/precio ("joyas ocultas"), proyectar su evolución con datos históricos propios, y convertir esos hallazgos en contenido analítico para LinkedIn.

**Lo que NO es este proyecto:** un medio de noticias. No publicamos "salió X". Publicamos análisis con tesis: *"estos 3 modelos rompen la relación calidad/precio, y esto implica..."*.

---

## 2. Decisiones fundacionales (2026-08-21)

Sesión de refinamiento tipo "grill-me" con el dueño. Estas decisiones están **cerradas**; no reabrir sin consultarlo:

1. **Objetivo núcleo:** joyas ocultas + generación de contenido LinkedIn. No es investigación académica seria.
2. **Alcance v1:** solo LLMs (texto/código). Imagen/video/audio quedan fuera hasta v2.
3. **Fuentes:** OpenRouter + HuggingFace Hub primero (fase 1). LMArena/Elo histórico + Artificial Analysis/Epoch AI después (fase 2).
4. **Recolección:** GitHub Actions cron diario toma snapshots de las APIs y los commitea al repo. Las series temporales son PROPIAS: casi ninguna fuente devuelve historia vía API.
5. **Forecasting v1:** extrapolación de tendencias (regresión lineal/log sobre últimas semanas), horizonte 3–6 meses. Nada de Prophet/ARIMA/redes por ahora.
6. **Definición de "joya oculta":** eficiencia costo/calidad. Score calidad-por-dólar cuando lleguen datos de calidad (fase 2); mientras tanto momentum + escasez. Segmentación por tarea (corta/media/larga, código agéntico) es extensión futura. La tesis "N subagentes baratos vs 1 LLM caro" es ángulo editorial/futuro, NO métrica v1.
7. **Stack:** Astro 7 + Observable Plot 0.6. Sin Tailwind, sin React.
8. **Deploy:** GitHub Pages, repo público, rama `main`.
9. **Secciones v1:** dashboard, fichas por modelo, ranking de joyas, metodología, blog.
10. **LinkedIn:** borrador semanal automático en markdown → `content/linkedin/`. Analítico, no noticioso, con cifras citables y atribución final al proyecto.
11. **Tono:** divulgativo pero defendible; toda cifra publicada debe poder rastrearse hasta un snapshot en `data/`.

---

## 3. Arquitectura y flujo de datos

```
                 ┌────────────────────────── GitHub Actions ──────────────────────────┐
                 │                                                                    │
   DIARIO (cron) │        SEMANAL (domingo)                    EN CADA PUSH           │
   snapshot.yml  │        weekly-draft.yml                     deploy.yml             │
                 │                                                                    │
 OpenRouter API ─┤→ scripts/collect-all.mjs                                           │
 HuggingFace API ┘        │                                                           │
                          ▼                                                           │
              data/snapshots/<fuente>/<fecha>.json      (historial inmutable, versionado)
                          │                                                           │
                          ▼                                                           │
              scripts/build-dataset.mjs                                                │
                          │                                                           │
                          ├──► public/data/dataset.json    (serie temporal completa)
                          │         │                                                  │
                          ▼         ▼                                                  ▼
   scripts/generate-weekly-draft.mjs    Astro build  ──────────────────►  GitHub Pages
                          │                                                  https://<user>.github.io/gemas-ia/
                          ▼
              content/linkedin/<semana>.md  (borrador para editar y publicar)
```

Principios inviolables:
- Los snapshots son **append-only**: nunca se edita ni borra un archivo de `data/snapshots/` pasado. Si una corrida falla, ese día simplemente no existe.
- `public/data/dataset.json` es un artefacto derivado. Nunca editarlo a mano.
- Todo dato mostrado en el sitio debe provenir de `dataset.json`, que a su vez proviene de snapshots commiteados. Trazabilidad total.

---

## 4. Mapa del repositorio

```
gemas-ia/
├── AGENTS.md                  ← este documento
├── README.md                  ← cara pública
├── astro.config.mjs           ← site + base '/gemas-ia/'
├── package.json               ← comandos npm (ver §7)
├── config/
│   └── famous-models.json     ← lista de modelos "famosos" excluidos del ranking de joyas
├── data/
│   └── snapshots/
│       ├── openrouter/        ← YYYY-MM-DD.json (append-only)
│       └── huggingface/       ← YYYY-MM-DD.json (append-only)
├── content/
│   └── linkedin/              ← borradores semanales generados + editados
├── scripts/
│   ├── collect-openrouter.mjs
│   ├── collect-huggingface.mjs
│   ├── collect-all.mjs        ← orquestador diario (tolerante a fallos parciales)
│   ├── build-dataset.mjs      ← snapshots → dataset.json (series + scores + forecast)
│   ├── generate-weekly-draft.mjs
│   ├── model-map.json         ← overrides de matching cross-fuente (claves `_` son docs, se ignoran)
│   └── lib/
│       ├── scoring.js         ← momentum, gemScore, regresión lineal, proyección
│       └── util.js            ← slugs, fechas, fetch con retry
├── tests/
│   ├── scoring.test.mjs       ← unit tests de scoring (node:test)
│   └── dataset.test.mjs       ← smoke del dataset.json + guards de regresión
├── src/
│   ├── config/site.js         ← constantes de marca y URLs
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   ├── pages/                 ← index, joyas, metodologia, modelos/, blog/
│   ├── scripts/charts.js      ← gráficos Observable Plot del lado cliente
│   └── styles/global.css
├── public/data/dataset.json   ← generado, nunca manual
└── .github/workflows/         ← snapshot.yml, weekly-draft.yml, deploy.yml
```

---

## 5. Fuentes de datos

### Fase 1 — activa hoy

| Fuente | Endpoint | Qué da | Frecuencia | Auth |
|---|---|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1/models` | catálogo de modelos, precios prompt/completion (USD/token), contexto, modalidades | diaria | ninguna |
| HuggingFace Hub | `https://huggingface.co/api/models?sort=downloads&direction=-1&limit=1000&full=true` | downloads, likes, createdAt, pipeline_tag | diaria | ninguna |

Notas duras ganadas a fuerza de golpes:
- Ninguna de las dos devuelve series históricas. La historia ES este repositorio.
- OpenRouter expone rankings de uso en su web pero no garantiza endpoint público estable; el colector intenta endpoints extra y si fallan, guarda igualmente lo obtenido. No depender de scraping HTML en fase 1.
- HuggingFace limita a ~1000 resultados por request sin paginar más profundo; suficiente para v1.

### Fase 2 — diseñada, no implementada

| Fuente | Plan |
|---|---|
| LMArena / Elo histórico | dataset comunitario o scraping tolerante; alimenta `quality.elo` |
| Artificial Analysis | API con key (pedirla) o datos públicos; alimenta `quality.index` y velocidad |
| Epoch AI | CSVs abiertos en GitHub (`epochai/data`); benchmarks históricos para predicción de hitos |

Cuando llegue calidad, el schema de modelo gana `quality: { elo?, aaIndex? }` y `gemScore` pasa a ser `calidad / precio`. Ver §6.

### Matching entre fuentes

Un mismo modelo aparece con IDs distintos por fuente (`meta-llama/llama-3.3-70b-instruct` vs `meta-llama/Llama-3.3-70B-Instruct`). Regla:
1. Normalizar slug: minúsculas, sin separadores (`llama3370binstruct`).
2. Si hay override manual en `scripts/model-map.json`, gana el override.
3. Si no matchea con nadie, vive como modelo independiente hasta que alguien lo case a mano.

---

## 6. Scoring (definiciones exactas)

Implementación única y autoritativa: `scripts/lib/scoring.js`. La página `/metodologia` explica lo mismo en lenguaje humano. Si cambiás una fórmula, cambiá AMBOS lugares.

### Momentum (v1)
- Serie: puntos diarios disponibles por modelo por métrica (downloads HF, likes HF).
- Tasa de crecimiento: regresión lineal sobre `ln(valor)` dentro de una ventana de N días. Una ventana es válida si tiene ≥4 puntos Y cubre ≥25% de los días de la ventana.
- Combinación: `momentum = 0.6 * tasa7d + 0.4 * tasa28d` donde `tasaNd = pendiente * Nd` (aprox. de crecimiento acumulado log-lineal).
- Fallbacks oficiales: ventana 28d inválida → usa tasa7d sola; ventana 7d inválida → tasa28d sola; ninguna válida (<4 puntos totales) → momentum = null y el modelo queda fuera de rankings.
- Amortiguación anti-outliers: valores >3× la mediana local se RECORTAN al cap (no se eliminan) antes de ajustar. Aplica también a las proyecciones.

### Filtro de fama
Los modelos en `config/famous-models.json` no compiten como joyas: su `gemScore` es null y en fichas muestran badge "modelo famoso". Mantener esa lista actualizada es tarea manual del dueño; revisarla cada ~mes. Los fragments se matchean contra el slug normalizado completo — evitar fragments cortos ambiciosos (ej. `"o3"` matcheaba IDs ajenos; usar `"openaio3"`).

### Movimientos del mercado (A4/A5/A6, 2026-08-22)
Implementación en `scripts/lib/movements.js` (funciones puras, testeada). `dataset.movements` con schema v2:
- **Altas**: primera aparición de un matchKey en snapshots por fuente, ventana ≤7 días desde el último snapshot. Se trackea OpenRouter y HuggingFace.
- **Bajas**: presente en snapshot previo y ausente hoy, SOLO catálogo OpenRouter (salir del top-N de HF es churn de ranking, no baja real). Ventana ≤7 días. Las bajas que también son altas se descartan (re-apariciones).
- **Price drops**: caída ≥20% entre puntos consecutivos de serie de precios (prompt o completion), incluido paso a gratis; transiciones null→valor NO cuentan (nueva info ≠ cambio). Ventana entre puntos ≤30 días.
- Umbrales como constantes en build-dataset.mjs; si cambian, actualizar `/movimientos` (los menciona en texto).

### gemScore (evolución por fases)
- **v1.x (actual):** `gemScore = momentum_normalizado × factor_escasez`, redondeado a 6 decimales para minimizar empates. `factor_escasez = 1` si downloads < 500k; 0.5 entre 500k y 5M; 0 arriba.
- Elegibilidad en rankings (única definición compartida por dashboard, `/joyas` y borrador semanal): `!famous && gemScore !== null && downloads <= 5M`.
- **v2 (cuando exista quality):** `gemScore = quality_score / precio_promedio_por_1M_tokens`, normalizado por categoría de tamaño (<8B, 8–34B, 34–70B, >70B). El momentum pasa a ser desempate.
- Proyección: extrapolación log-lineal a 90 y 180 días, banda ±1 desviación estándar del residuo (n−2 grados de libertad), sobre serie recortada igual que momentum. Siempre mostrar la banda; jamás publicar proyección sin ella.

---

## 7. Comandos

```bash
npm install                # setup inicial
npm run collect            # un snapshot HOY de todas las fuentes (tolerante a fallo parcial)
npm run build:dataset      # regenera public/data/dataset.json desde todos los snapshots
npm run draft              # genera borrador semanal en content/linkedin/
npm run test               # node:test: unit de scoring + smoke del dataset
npm run pipeline           # collect + build:dataset (flujo diario completo)
npm run dev                # sitio en localhost:4321
npm run build              # build de producción a dist/
npm run preview            # sirve el build
```

Orden correcto tras recolectar: `collect` → `build:dataset` → `test` → (`draft` opcional) → commit.

---

## 8. Convenciones obligatorias

- **Idioma:** UI y contenido en español rioplatense neutro. Código, IDs y commits en inglés.
- **Links internos:** SIEMPRE vía `withBase()` de `src/config/site.js`. Jamás escribir `/seccion/` crudo: GitHub Pages sirve bajo subpath `/gemas-ia/` y rompería la navegación. En markdown usar rutas relativas (`../../metodologia/`).
- **Fechas:** siempre ISO `YYYY-MM-DD` UTC. Snapshots usan la fecha UTC del momento.
- **Slugs:** normalización definida en §5. El slug canónico es la identidad del modelo en TODO el sistema.
- **Sin secretos:** las fuentes de fase 1 no requieren keys. Cuando Artificial Analysis entre (fase 2), usar `AA_API_KEY` como secret de Actions; nunca commitear keys.
- **Commits:** prefijos `data:` (snapshots/dataset), `content:` (blog/linkedin), `site:` (UI), `pipeline:` (scripts), `docs:` (este archivo y README).
- **Código sin comentarios explicativos:** los nombres deben bastar; la documentación conceptual vive acá y en `/metodologia`.
- **Sistema visual (2026-08-22):** tema "boletín técnico impreso" — papel cálido `#f7f4ec`, tinta `#1c1a16`, filetes de 1-2px, esquinas casi rectas, cero sombras/gradientes. Tipografía auto-hospedada: Fraunces Variable (display serif), IBM Plex Sans (cuerpo), IBM Plex Mono (todo dato numérico, tabular). Los gráficos usan tokens `THEME` de `src/scripts/charts.js` — jamás hex crueles en marks. Nada de Google Fonts CDN (privacidad/GDPR) ni dark-mode genérico: ese fue un error v0 deliberadamente corregido. Cambiar la identidad visual = actualizar este párrafo + `global.css` + `THEME` + favicon.
- **Seguridad:** CSP por meta tag (GH Pages no setea headers): `script-src 'self'`, sin inline scripts; estilos con `'unsafe-inline'` necesario para atributos SVG de Plot. Dependencias vigiladas por Dependabot (npm + github-actions, semanal). Sin secrets en fase 1; cuando entre Artificial Analysis usar secret `AA_API_KEY`. XSS revisado: nombres de modelos solo fluyen vía expresiones Astro (escapadas) y `textContent` de Plot — nunca `innerHTML` manual.
- **Liability:** aviso legal en `/metodologia#aviso-legal` (sin garantías, proyecciones ≠ consejos, marcas de sus dueños, sin tracking). Código MIT (`LICENSE`), datos CC BY 4.0 (`LICENSE-DATA.md`) citando Gemas IA + fuentes upstream.
- **Observabilidad:** el dataset expone `sources.<fuente>.{ok, errors, fetchedAt}` agregado desde `_meta` de snapshots; el dashboard lo muestra como health-strip con estados ok/stale/unknown. Los errores de colecta NUNCA se ocultan: quedan en el snapshot y se reflejan en la web. Badge de CI en README. Decisión consciente: sin SaaS de monitoring (solo owner); los emails de falla de Actions alcanzan para v1.
- **Actualización de este documento:** toda PR que cambie arquitectura, scoring, fuentes o procesos debe incluir los cambios correspondientes en AGENTS.md. Un agente que detecte desalineación doc↔código debe corregirla en la misma PR.

---

## 9. Rutinas para agentes futuros

### Agregar una fuente nueva (ej. LMArena)
1. Crear `scripts/collect-<fuente>.mjs` siguiendo el patrón de los existentes: fetch con retry, filtrado mínimo INMUTABLE (guardar crudo, procesar después), escritura atómica a `data/snapshots/<fuente>/<fecha>.json`.
2. Sumarlo a `collect-all.mjs`.
3. Extender `build-dataset.mjs` para fusionar la nueva fuente (matching según §5).
4. Actualizar §5, §6 y `/metodologia` en la misma PR.

### Depurar un número raro en el sitio
1. Buscar el slug en `public/data/dataset.json` → ver qué snapshot lo originó.
2. Inspeccionar el snapshot crudo del día en `data/snapshots/`.
3. Corregir SOLO hacia adelante: si fue bug de colector, arreglar colector; el histórico queda como está (append-only).

### Generar y publicar contenido semanal
1. `npm run draft` (o esperar el workflow del domingo).
2. Editar el markdown: agregar opinión propia donde dice `[TU OPINIÓN AQUÍ]`. NUNCA publicar sin ese paso.
3. Verificar que cada cifra tenga su número citable y que el cierre referencie el proyecto.
4. Publicar en LinkedIn, borrar/marcar el borrador como publicado en el frontmatter (`published: true`).

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
- [ ] `npm test` pasa (21 tests: scoring + smoke de dataset)
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
4. **Assets LinkedIn**: `npm run charts` genera SVG+PNG (resvg) de top joyas + tarjeta semanal 1200×630 en `public/charts/`; el borrador semanal las lista para adjuntar. Motivación: LinkedIn no acepta SVG ni markdown — sin PNGs el workflow no era usable de verdad.
5. **Borrador v2**: hooks alternativos, comparación precio-vs-gigantes, contador de caracteres contra límite 3000.
6. **Seguridad**: CSP meta (`script-src 'self'`), referrer-policy, Dependabot npm+actions, `npm audit` limpio. Pendiente deliberado: pin actions por SHA (Dependabot cubre updates; revisar si el proyecto crece).
7. **Liability**: aviso legal en metodología + `LICENSE-DATA.md` (CC BY 4.0).

---

## 11. Roadmap

- [x] v0.1 — scaffold, docs, pipeline fase 1, sitio base, tests, sitemap, OG tags, favicon
- [ ] v0.2 — primera semana real de snapshots; validar momentum con ≥4 puntos
- [ ] v0.3 — validar visualmente gráficos de series y bandas de proyección en fichas
- [ ] v0.4 — optimizar payload de fichas (hoy embeben la serie completa como data-attribute)
- [ ] v1.0 — ranking de joyas estable + primer borrador semanal publicado
- [ ] v1.1 — fuente LMArena/Elo (fase 2 empieza)
- [ ] v1.2 — quality-per-dollar real (Artificial Analysis o Epoch)
- [ ] v1.x — og:image para previews ricos al compartir en LinkedIn
- [ ] v2.0 — segmentación por tipo de tarea (corta/media/larga, código agéntico)
- [ ] v2.x — análisis editorial "swarm economics" (N subagentes baratos vs 1 LLM caro)

---

## 12. Riesgos y limitaciones conocidas

- **Series jóvenes:** los primeros días no hay forecasting posible. El sitio debe verse bien igual (empty states implementados).
- **Momentum con historia parcial:** con <7 días de datos usa solo tasa 7d; la ventana de 28d exige ≥7 puntos. Es más permisivo que "mínimo 4 puntos totales" y así funciona a propósito.
- **Matching imperfecto cross-fuente:** hasta tener overrides manuales, algunos modelos aparecerán duplicados entre fuentes. Aceptable en v1; documentado en metodología.
- **Payload creciente:** cada ficha embebe su serie completa en `data-model`; con ~1 año de snapshots diarios pesará cientos de KB por página → optimizar en v0.4.
- **Endpoints no contractuales:** OpenRouter/HF pueden cambiar formatos. Los colectores validan campos esperados y registran errores en `_meta.errors` sin romper la corrida.
- **Rate limits:** HF permite requests anónimos generosos pero no infinitos; un request diario grande está lejos del límite.
- **GitHub Actions gratuito:** repo público = minutos ilimitados. Si el repo se vuelve privado, revisar costos ANTES de mantener los crons.

---

## 13. Reglas de contenido LinkedIn (para borradores generados)

1. Gancho con cifra concreta o contradicción ("un modelo de 7B le gana en $/calidad a uno de 70B").
2. Máximo 3 joyas por edición, con: nombre, tamaño/contexto, precio por 1M tokens, crecimiento 28d, link a su ficha.
3. Un párrafo de análisis cruzado que conecte los hallazgos con una tesis (eficiencia, swarm economics, etc.) — esto requiere edición humana, la máquina solo sugiere.
4. Cierre SIEMPRE: mención del proyecto + invitación a ver el sitio con la metodología.
5. Jamás afirmar cosas que los datos no respalden; si el dato es débil, decirlo.
