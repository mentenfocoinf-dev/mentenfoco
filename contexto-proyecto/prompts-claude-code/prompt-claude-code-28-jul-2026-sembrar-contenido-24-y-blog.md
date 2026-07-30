# Prompt para Claude Code — Sembrar contenido a 24 piezas + tiers + blog público

Contexto: ya sembraste las primeras 12 piezas y aplicaste el modelo sin candados. Ahora **doblamos a 24**
(para que los planes pagos se diferencien de verdad) y damos cuerpo al blog público. Todo el contenido
nuevo ya está redactado en `contexto-proyecto/contenido-plataforma/` con frontmatter YAML. El índice
autoritativo (slugs, tiers definitivos, briefs de imagen, decisión de blog) es
`contexto-proyecto/contenido-plataforma/MANIFIESTO_SIEMBRA.md` — léelo primero, y el plan/razonamiento está
en `PLAN_CONTENIDO_24_Y_TIERS.md`.

## 1. Sembrar las 12 piezas nuevas + reasignar tiers de las 12 existentes

Corre tu `seed_content_items.cjs` sobre las 5 carpetas (`articulos/`, `programas/`, `herramientas/`,
`audio/`, `blog/`), upsert por `slug`. Además, **aplica la tabla definitiva de `min_plan`** del manifiesto
(varias piezas existentes cambian de tier: p. ej. `programa-calma`→free, `diario-de-pensamientos`→esencial,
`meditacion-suelta-el-dia`→premium). El resultado debe dar la escalera: **Free 8 · Primeros Pasos 12 · Mi
Equilibrio 16 · Mi Mundo en Foco 24** piezas de biblioteca (todos los tipos representados en cada tier).
Nuevas: 3 artículos, 3 programas, 3 herramientas, 3 audios (audio con url null → "Audio próximamente"), y 2
artículos de blog.

Los programas nuevos traen `program_steps` en el frontmatter (enlazan a artículos/herramientas por slug —
todos existen). Verifica que los enlaces cruzados resuelvan.

## 2. Blog público (resuelve el solapamiento que notó el usuario)

El usuario observó que "Blog y artículos" y "Contenido" mostraban artículos y confunde. Definición limpia:
- **`/contenido`** (con sesión) = biblioteca del miembro, filtrada por plan, sin candados (ya está).
- **`/blog`** (público, sin login, SEO) = muestra los **artículos gratuitos**: los que traen
  `es_blog: true` **más** los `content_type='articulo'` con `min_plan='free'`. Detalle en `/blog/$slug`.
  Es la vitrina pública / top del embudo.

Cambios que esto pide:
- Añade la columna `es_blog boolean default false` a `content_items` (migración). Las 2 piezas de `blog/`
  vienen con `es_blog: true` en su frontmatter.
- Implementa `/blog` (y `/blog/$slug`) como vista pública que lista esos artículos free — reutilizando el
  render markdown existente. Enlázalo desde el menú "Recursos ▾ → Blog y artículos" (ya existe el ítem).
- El blog NO tiene candados ni planes (es todo free/público). Nunca muestra piezas premium.

## 3. Imágenes

Briefs completos en el manifiesto (26 filas). Reutiliza de `public/guias/` donde lo indico (copiar con el
nuevo nombre); el resto de Pexels/Unsplash (libre, sin marca de agua, criterio no estigmatizante). Van en
`public/contenido/<slug>.jpg`.

## 4. Verificación (recórrela y repórtame conteos)

- `admin@test.com` → "Todo el contenido" lista las 24 piezas de biblioteca + las 2 de blog, todas publicadas.
- Sin candados en ningún plan. Conteos de biblioteca por plan: **Free 8 · Primeros Pasos 12 · Mi Equilibrio
  16 · Mi Mundo en Foco 24**. Confírmame que un paciente Free ve al menos 1 de cada tipo (artículo,
  programa, herramienta, audio) y que un premium ve las 24 — sin que aparezca ni un candado.
- `/blog` sin sesión muestra los 4 artículos free (2 de blog + 2 de contenido free), con su detalle, sin login.
- Los programas nuevos abren y sus pasos enlazan bien; los audios muestran "Audio próximamente" + su enlace.
- Repórtame los conteos finales por plan y cualquier slug/imagen/enlace que no cuadre.
