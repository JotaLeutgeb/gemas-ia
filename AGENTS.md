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
| Autor / marca personal | joaqu (dueño del proyecto; todo contenido termina atribuyéndole) |

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
7. **Stack:** Astro 5 + Observable Plot. Sin Tailwind, sin React.
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
│   └── lib/
│       ├── scoring.js         ← momentum, gemScore, regresión lineal, proyección
│       └── util.js            ← slugs, fechas, fetch con retry
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
- Tasa de crecimiento: regresión lineal simple sobre `ln(valor)` de los últimos **28 días** (mínimo 4 puntos; si no alcanza, momentum = null y el modelo queda fuera de rankings).
- `momentum = 0.6 * tasa7d + 0.4 * tasa28d` donde `tasaNd = pendiente * Nd` (aprox. de crecimiento acumulado log-lineal).
- Amortiguación anti-outliers: si algún punto es 3× la mediana local, se recorta antes de ajustar.

### Filtro de fama
Los modelos en `config/famous-models.json` no pueden aparecer en `/joyas` ni en borradores de LinkedIn como "joyas" (sí pueden aparecer en dashboard y fichas). Mantener esa lista actualizada es tarea manual del dueño; revisarla cada ~mes.

### gemScore (evolución por fases)
- **v1.x (actual):** `gemScore = momentum_normalizado × factor_escasez`, donde `factor_escasez = 1` para modelos fuera de la lista famosa con < 500k downloads acumulados; 0.5 entre 500k y 5M; 0 arriba (no compiten).
- **v2 (cuando exista quality):** `gemScore = quality_score / precio_promedio_por_1M_tokens`, normalizado por categoría de tamaño (<8B, 8–34B, 34–70B, >70B). El momentum pasa a ser desempate.
- Proyección: extrapolación log-lineal a 90 y 180 días, con banda de confianza ± desviación estándar del residuo. Siempre mostrar la banda; jamás publicar proyección sin ella.

---

## 7. Comandos

```bash
npm install                # setup inicial
npm run collect            # un snapshot HOY de todas las fuentes (tolerante a fallo parcial)
npm run build:dataset      # regenera public/data/dataset.json desde todos los snapshots
npm run draft              # genera borrador semanal en content/linkedin/
npm run dev                # sitio en localhost:4321
npm run build              # build de producción a dist/
npm run preview            # sirve el build
```

Orden correcto tras recolectar: `collect` → `build:dataset` → (`draft` opcional) → commit.

---

## 8. Convenciones obligatorias

- **Idioma:** UI y contenido en español rioplatense neutro. Código, IDs y commits en inglés.
- **Fechas:** siempre ISO `YYYY-MM-DD` UTC. Snapshots usan la fecha UTC del momento.
- **Slugs:** normalización definida en §5. El slug canónico es la identidad del modelo en TODO el sistema.
- **Sin secretos:** las fuentes de fase 1 no requieren keys. Cuando Artificial Analysis entre (fase 2), usar `AA_API_KEY` como secret de Actions; nunca commitear keys.
- **Commits:** prefijos `data:` (snapshots/dataset), `content:` (blog/linkedin), `site:` (UI), `pipeline:` (scripts), `docs:` (este archivo y README).
- **Código sin comentarios explicativos:** los nombres deben bastar; la documentación conceptual vive acá y en `/metodologia`.
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

### Checklist de release de features grandes
- [ ] Build pasa (`npm run build`)
- [ ] `dataset.json` regenerado sin errores
- [ ] AGENTS.md actualizado
- [ ] Página `/metodologia` consistente con el código
- [ ] Probado con datos vacíos (primer día de un modelo nuevo) y con datos completos

---

## 10. Roadmap

- [x] v0.1 — scaffold, docs, pipeline fase 1, sitio base
- [ ] v0.2 — primera semana real de snapshots; validar momentum con ≥4 puntos
- [ ] v0.3 — gráficos de series en fichas de modelos + proyecciones con bandas
- [ ] v1.0 — ranking de joyas estable + primer borrador semanal publicado
- [ ] v1.1 — fuente LMArena/Elo (fase 2 empieza)
- [ ] v1.2 — quality-per-dollar real (Artificial Analysis o Epoch)
- [ ] v2.0 — segmentación por tipo de tarea (corta/media/larga, código agéntico)
- [ ] v2.x — análisis editorial "swarm economics" (N subagentes baratos vs 1 LLM caro)

---

## 11. Riesgos y limitaciones conocidas

- **Series jóvenes:** los primeros ~28 días no hay forecasting posible (mínimo 4 puntos). El sitio debe verse bien igual.
- **Matching imperfecto cross-fuente:** hasta tener overrides manuales, algunos modelos aparecerán duplicados entre fuentes. Es aceptable en v1; documentar en metodología.
- **Endpoints no contractuales:** OpenRouter/HF pueden cambiar formatos. Los colectores deben validar campos esperados y registrar errores en el JSON de salida (campo `_meta.errors`) en vez de romper toda la corrida.
- **Rate limits:** HF permite requests anónimos generosos pero no infinitos; un solo request grande por día está lejos del límite.
- **GitHub Actions gratuito:** repo público = minutos ilimitados para estos workflows. Si el repo se vuelve privado, revisar costos ANTES de mantener los crons.

---

## 12. Reglas de contenido LinkedIn (para borradores generados)

1. Gancho con cifra concreta o contradicción ("un modelo de 7B le gana en $/calidad a uno de 70B").
2. Máximo 3 joyas por edición, con: nombre, tamaño/contexto, precio por 1M tokens, crecimiento 28d, link a su ficha.
3. Un párrafo de análisis cruzado que conecte los hallazgos con una tesis (eficiencia, swarm economics, etc.) — esto requiere edición humana, la máquina solo sugiere.
4. Cierre SIEMPRE: mención del proyecto + invitación a ver el sitio con la metodología.
5. Jamás afirmar cosas que los datos no respalden; si el dato es débil, decirlo.
