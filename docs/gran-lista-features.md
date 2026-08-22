# Gran Lista de Features — gemas-ia

> Brainstorm priorizado para llevar el MVP a producto excepcional. Cada item tiene impacto
> esperado y esfuerzo estimado (S < 1 sesión · M = 1-2 sesiones · L = proyecto). Lo votado
> entra al roadmap de AGENTS.md §11; lo descartado queda documentado con motivo.
> Última revisión: 2026-08-22.

---

## A · Motor de datos (interno)

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| A1 | **Rankings de uso real de OpenRouter** | Tokens procesados por modelo (señal mucho más fuerte que downloads de HF): quién se USA de verdad, no solo descargado | ⭐⭐⭐ | M |
| A2 | **Artificial Analysis API** | Índice de calidad + velocidad + latencia → activa el gemScore v2 calidad-por-dólar prometido en metodología | ⭐⭐⭐ | M |
| A3 | **Epoch AI benchmarks históricos** | CSVs abiertos → predicción de hitos ("¿cuándo el open-source alcanza a GPT-5-class?") | ⭐⭐⭐ | M |
| A4 | **Altas de la semana** | Diff entre snapshots: modelos que APARECEN por primera vez en OpenRouter/HF | ⭐⭐⭐ | S |
| A5 | **Radar de bajas** | Modelos que desaparecen o se deprecian (contenido: "X murió, sus alternativas") | ⭐⭐ | S |
| A6 | **Alertas de cambio de precio** | Drops >20% día a día = gancho editorial automático ("guerra de precios") | ⭐⭐⭐ | S |
| A7 | **Extracción de parámetros** | Parsear 7B/13B/70B del nombre/tags HF → categorías de tamaño reales (necesario para gemScore v2) | ⭐⭐⭐ | S |
| A8 | **Licencia por modelo** | Tags de HF (apache-2.0, llama-community...) → filtro "comercialmente usable" | ⭐⭐ | S |
| A9 | **LMArena Elo histórico** | Ya en roadmap v1.1; dataset comunitario o scraping tolerante | ⭐⭐⭐ | M-L |
| A10 | **Backfill histórico HF** | Datasets comunitarios con series pasadas de downloads → acelerar 6 meses de historia propia | ⭐⭐ | M |
| A11 | **Contexto como serie** | Trackear evolución de context_length (la carrera de ventanas es contenido) | ⭐⭐ | S |

## B · Scoring y análisis

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| B1 | **gemScore v2 calidad/precio** | Diseñado en AGENTS §6; se desbloquea con A2+A7 | ⭐⭐⭐ | M |
| B2 | **Score de estabilidad** | Penalizar crecimiento espasmódico (varianza alta) → menos falsas joyas | ⭐⭐ | S |
| B3 | **Segmentación por tarea** | Corta/media/larga/agéntica usando contexto + benchmarks; fichas muestran "para qué sirve" | ⭐⭐⭐ | M |
| B4 | **Swarm economics score** | La tesis del dueño: costo de N subagentes baratos vs 1 premium; página de análisis editorial | ⭐⭐⭐ | M |
| B5 | **Índice de concentración del mercado** | Share top-5 vs resto, mensual; métrica macro citable para posts | ⭐⭐ | S |
| B6 | **Detector de clones/rebrands** | Matching difuso entre modelos casi idénticos re-publicados | ⭐ | M |

## C · Sitio y UX (externo)

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| C1 | **Comparador A/B** | Elegir 2-4 modelos → tabla y gráficos side-by-side compartible por URL | ⭐⭐⭐ | M |
| C2 | **Share de mercado apilado** | Área apilada temporal: share de downloads por familia (DeepSeek vs Qwen vs ...) | ⭐⭐⭐ | M |
| C3 | **RSS feeds** | Blog + joyas semanales; sindicación cuesta poco y suma alcance | ⭐⭐ | S |
| C4 | **OG image dinámica por ficha** | satori/resvg al build: preview rico al compartir cualquier modelo en redes | ⭐⭐⭐ | M |
| C5 | **URLs de datos crudos estables** | `/data/modelo/<slug>.json` perenne para que devs citen datos directos (backlinks orgánicos) | ⭐⭐ | S |
| C6 | **Búsqueda y filtros en catálogo** | Client-side: por tamaño, precio, licencia, tendencia | ⭐⭐ | S-M |
| C7 | **Página "Mercado"** | Agregados mensuales: inflación de precios IA, contexto mediano, conteo de altas | ⭐⭐ | M |
| C8 | **Widgets embebibles** | Iframe/SVG auto-actualizado ("top 5 joyas hoy") para que otros blogs te citen | ⭐⭐ | M |
| C9 | **Dark mode fiel al sistema editorial** | Solo con `prefers-color-scheme`, mismos tokens invertidos — nunca default genérico | ⭐ | S |
| C10 | **i18n inglés** | v3; duplicar alcance pero también competencia directa | ⭐⭐ | L |

## D · Workflow LinkedIn (distribución)

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| D1 | **Carrusel automático (PDF)** | LinkedIn premia documentos; generar PDF de 6-8 slides con los datos de la semana (resvg→imágenes→pdf) | ⭐⭐⭐ | M |
| D2 | **Variantes por audiencia** | El mismo análisis reescrito para devs / PMs / founders (tonos y hooks distintos) | ⭐⭐ | S |
| D3 | **Plantillas de post versionadas** | `content/templates/*.md`: formato listicle, contrarian, data-story; el draft elige plantilla | ⭐⭐ | S |
| D4 | **Log de performance** | CSV manual (`posts.csv`: fecha, formato, impresiones, reacciones) → página privada de lecciones; feedback loop real | ⭐⭐⭐ | S |
| D5 | **Derivado para X/Twitter** | Thread automático desde el mismo dataset (multi-plataforma gratis) | ⭐⭐ | S-M |
| D6 | **Calendario editorial** | `content/linkedin/calendar.yml` con temas planificados por semana; el generador respeta el tema | ⭐ | S |

## E · Comunidad y crecimiento

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| E1 | **"Nomina una gema"** | GitHub Discussions + template: lectores proponen modelos; alimenta curación y comunidad | ⭐⭐ | S |
| E2 | **Issues como research queue** | Labels `fuente-nueva`, `bug-dato`, `idea-post`; el board público ES el roadmap | ⭐⭐ | S |
| E3 | **CONTRIBUTING.md** | Guía para agregar colectores/fuentes siguiendo AGENTS §9 | ⭐ | S |
| E4 | **Changelog público mensual** | Post de blog con lo aprendido/mejorado; transparencia como marketing | ⭐⭐ | S |

## F · Infraestructura y ops

| # | Feature | Descripción | Impacto | Esfuerzo |
|---|---|---|---|---|
| F1 | **Webhook de fallo a Telegram/Discord** | Curl al secret del chat si snapshot.yml falla; observabilidad proactiva sin SaaS | ⭐⭐⭐ | S |
| F2 | **Status page `/estado`** | Historial de corridas del cron (últimos 90 días desde los propios snapshots) | ⭐⭐ | S-M |
| F3 | **Pin actions por SHA** | Gold standard supply-chain; hoy cubierto por Dependabot (decisión documentada en AGENTS §8) | ⭐⭐ | S |
| F4 | **Backup semanal del dataset** | Rama `archive` con tag por semana; seguro ante corrupción accidental | ⭐⭐ | S |
| F5 | **Lighthouse budget en CI** | Fallar deploy si performance/accessibility cae de umbral | ⭐ | M |
| F6 | **Link checker semanal** | Workflow que valida links internos y fuentes externas vivas | ⭐⭐ | S |

---

## Top 10 por ROI (si tuviera que elegir)

1. **A4+A5+A6** (altas/bajas/alertas de precio) — contenido semanal automático con mínimo esfuerzo
2. **D1 Carrusel PDF** — formato que LinkedIn más premiara; nadie en español lo hace con datos propios
3. **A1 Rankings de uso OpenRouter** — cambia la conversación de "descargado" a "usado"
4. **A2+B1 Calidad-por-dólar real** — cumple la promesa original del proyecto
5. **D4 Log de performance** — sin feedback loop no hay mejora editorial
6. **F1 Webhook de fallo** — el pipeline es el negocio; enterarse tarde sale caro
7. **C4 OG images dinámicas** — cada link compartido pasa a ser un mini-anuncio
8. **C1 Comparador** — pieza de link-building natural ("mirá esta comparación")
9. **A7 Parámetros** — desbloquea segmentación y credibilidad técnica
10. **C3 RSS** — sindicación barata para el largo plazo

## Descartados conscientemente (con motivo)

- **Newsletter propia** — requiere tercer servicio + mantenimiento; RSS (C3) cubre el 80% a costo 0. Revisar a partir de 1k lectores.
- **Backend/API propia** — rompe el principio 100%-estático; las URLs de datos crudos (C5) cubren el caso de uso.
- **Analytics con cookies** — contradice el compromiso de privacidad del aviso legal; si algún día hace falta, Plausible self-host o nada.
