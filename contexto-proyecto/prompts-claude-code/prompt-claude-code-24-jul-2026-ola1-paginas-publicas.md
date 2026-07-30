# Prompt para Claude Code — Ola 1: enriquecer las páginas públicas (sin backend nuevo)

Contexto: tras el scrape profundo de 5 competidoras (Selia, Terapify, Terapi, BetterHelp,
PorqueQuieroEstarBien), diseñamos un plan para que Mente en Foco muestre muchísima más información sin
login, como esas plataformas, **sin quitar nada de lo que ya existe**. El plan completo está en
`contexto-proyecto/especificaciones-producto/09_plan_reestructuracion_paginas_publicas.md` y los datos de
respaldo en `contexto-proyecto/investigacion-competencia/scrape-2026-07-24/` — léelos antes de empezar.

Esta es **solo la Ola 1**: todo lo que se puede montar YA porque es contenido estático o lee tablas que
ya existen. **No incluye** tests públicos (necesitan tabla nueva, Ola 2) ni matching/directorio (fase
propia, Ola 3) — no los construyas en esta tanda.

Regla del proyecto, no negociable: **nada de frontend sin backend real detrás.** En esta ola eso se
cumple porque todo es estático o consume `clinical_guides_meta` / `crm_leads`, que ya existen. Si en algún
punto sientes que necesitas datos que no existen aún, para y avísame en vez de inventar una tabla.

## Alcance de la Ola 1

### 1. Navegación global (header) — menús desplegables
Reorganizar el header a menús agrupados (como Selia/Terapify) para que quepa todo sin saturar: **Servicios
▾**, **Guías ▾**, **Recursos ▾**, más los enlaces directos (Planes, Nosotros, Empresas, Ingresa) y el CTA
"Agendar cita". Los ítems que aún no tienen página (Evalúate/Tests, Programas, Encontrar especialista)
**no** se agregan todavía o se dejan como "Próximamente" deshabilitados — no enlaces rotos. Mantén la
línea gráfica glass/neon actual.

### 2. Inicio (`index.tsx`) — sumar secciones estáticas + guías reales
Mantener TODO lo actual (hero, 4 features, 4 disciplinas, stats, CTA). Añadir, en el orden del plan
(sección 1 de la spec): barra de confianza/reseñas, "Cómo funciona" (3–4 pasos), "Programas por lo que
estás viviendo" (tarjetas que por ahora enlazan a Asesoramiento o Guías, hasta que exista la página de
Programas), **diferenciador clínico** (la sección del foso defensivo: historia clínica real, valoración,
informe, CIE-11 — texto que redactas a partir de lo que ya hace la plataforma, sin inventar cifras), y
**guías destacadas** tiradas de `clinical_guides_meta` (3–6, con su candado si corresponde, reutilizando
la lógica de `guia.tsx`). Los 4 accesos rápidos pueden crecer a 6 sumando "Evalúate" y "Encontrar
especialista" apuntando a páginas "Próximamente" (o dejarlos para cuando existan — tu criterio).

### 3. Landings de servicios (`/servicios/$slug` o páginas sueltas)
Una landing por disciplina/servicio que hoy solo vive como texto en el home: Psicología clínica,
Neuropsicología, Psiquiatría, Fonoaudiología, Terapia de pareja, Orientación para padres. Contenido
estático (qué es, para quién, cómo ayuda, CTA a agendar). El texto clínico debe ser sobrio y verificable —
si no tienes base para afirmar algo, no lo afirmes.

### 4. Hub de Recursos
- `/recursos` (índice), `/blog` (puede arrancar reusando/listando las guías o vacío con "próximamente"
  bien hecho), `/faq` (preguntas frecuentes categorizadas, contenido estático), y **`/lineas-de-crisis`**
  (líneas reales de Colombia). **IMPORTANTE sobre las líneas de crisis:** verifica el número correcto
  antes de publicarlo — hubo un error previo en el proyecto con el 106; confirma cuál es la línea vigente
  (p. ej. 123 emergencias, o la línea de salud mental que corresponda) antes de ponerla en producción. No
  publiques un número sin verificar.

### 5. Landing de Empresas (`/empresas`) — B2B
Estática: bienestar laboral, reducción de ausentismo, "agenda una demo". El formulario de contacto/demo
inyecta a `crm_leads` (que ya existe, mismo patrón que `contactanos.tsx`). No inventes métricas de
clientes que MeF no tenga — usa lenguaje de propuesta, no cifras falsas.

### 6. Enriquecer Nosotros y Asesoramiento
- `sobre-nosotros.tsx`: misión/valores, respaldo científico, diferenciador clínico. Si vas a listar el
  equipo con credenciales reales, pídeme los datos — no inventes profesionales.
- `asesoramiento.tsx`: sumar la tabla comparativa completa (idealmente reutilizando `PLAN_BENEFITS` en vez
  de duplicar la de `membresia.tsx`), "cómo funciona el proceso" y un FAQ de planes. La política de
  cambio de terapeuta / orientación gratuita son decisiones de negocio — déjalas como placeholder marcado
  si no están definidas, no las inventes.

## Testimonios / reseñas — ojo
Si agregas una sección de testimonios en el Inicio, **no inventes reseñas de pacientes**. Usa un
placeholder claramente marcado o pídeme testimonios reales. Inventar reseñas de un servicio de salud
mental es un problema ético y legal, no solo estético.

## Verificación
Al terminar, recorre el sitio sin sesión y confirma: no hay enlaces rotos en el nuevo header, el Inicio
carga las guías destacadas reales, las landings nuevas abren, el formulario de Empresas cae en
`crm_leads`, y la línea de crisis muestra un número verificado. Repórtame qué quedó como placeholder
pendiente de contenido real (testimonios, equipo, políticas de negocio) para que yo te pase esos datos.
