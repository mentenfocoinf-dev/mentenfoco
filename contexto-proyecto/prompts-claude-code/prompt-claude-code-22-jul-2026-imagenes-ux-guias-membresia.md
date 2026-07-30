# Prompt para Claude Code — Imágenes de guías, fix de click bloqueado, orden de membresía, renombrado de planes

Buen trabajo con el fix de guías y el dropdown de categorías, y con encontrar y corregir las 9 guías con
`min_plan='free'` no-vitrina que rompían el paywall — ese hallazgo no estaba en mi spec original y la
corrección fue exactamente la correcta. Cuatro tareas nuevas, independientes entre sí:

## 1. Descargar y colocar las 8 imágenes de guías faltantes

Yo no tengo acceso de red a bancos de imágenes desde mi sandbox (todo bloqueado por allowlist), así que
esto viene como brief curado, no como archivos ya descargados. Spec completa con brief visual y términos
de búsqueda exactos por guía en
`especificaciones-producto/07_curaduria_imagenes_guias.md`. Resumen: 8 archivos van en `public/guias/`
con estos nombres exactos (deben coincidir carácter por carácter con `imageName` en la base):
`Entender un episodio depresivo.png`, `Prevenir una recaída depresiva.png`, `Primeros pasos tras un
evento traumático.png`, `Cuando el duelo no avanza.png`, `Reconstruir una relación sana con la
comida.png`, `Entender el trastorno por atracones.png`, `Cambios de memoria qué es normal y cuándo
consultar.png`, `Acompañar a un familiar con demencia.png`.

Busca en Pexels o Unsplash (licencia libre, sin atribución obligatoria) siguiendo el brief de cada una —
foto de persona real, luz suave, sin texto ni marca de agua, sin clichés estigmatizantes (ver la sección
de criterio ético en la spec, basada en las guías Mindframe). Si quieres aplicar el mismo desvanecido
inferior que ya tienen las 12 imágenes existentes (ver `Diálogo interno positivo.png` como referencia),
adelante, pero no es bloqueante — prioriza tener las 8 puestas y bien elegidas.

## 2. Fix: click en guía bloqueada debe abrir el popup ahí mismo

Hoy el botón "Leer guía" siempre navega con `Link`, aunque la guía esté bloqueada — el popup solo aparece
después de cargar la otra página. Spec exacta (qué línea cambia, cómo queda el estado) en
`especificaciones-producto/08_fix_click_guia_bloqueada_y_orden_membresia.md`, sección 1. Resumen: en
`guia.tsx`, si `locked`, el botón pasa de `Link` a `button` que abre `PaywallModal` in-place; si no está
bloqueada, se queda como `Link`. No toques `guias.$guiaId.tsx` — ese flujo (acceso directo por URL) sigue
sirviendo para enlaces compartidos.

De paso, quita el ícono `Sparkles` del título "Contenido ✨" en `PaywallModal.tsx` (línea 33) — el usuario
pidió remover emojis innecesarios ahí.

## 3. Reordenar secciones de Membresía

En `membresia.tsx`, la tabla "Compara los niveles de acceso" debe ir **antes** del carrusel "¿Qué
incluye?" (hoy va después, y obliga a mucho scroll para ver la comparación). Ver sección 2 de la spec 08
— es mover dos bloques JSX, sin tocar datos ni lógica.

## 4. Renombrado de planes (más cálido, framing de inversión en vez de "membresía")

Investigué (con fuentes) si el naming actual se siente invasivo y propuse un renombrado — completo en
`analisis-estrategico/analisis-neuromarketing-planes-22-jul-2026.md`. Resumen de lo que cambia (**solo
labels de presentación, el campo `plan_type` de la base de datos NO cambia — cero riesgo de backend**):

- `PLAN_OFFERS` en `plans.ts`: `name` de "Esencial"/"Integral"/"Premium" → **"Primeros Pasos"** / **"Mi
  Equilibrio"** / **"Mi Mundo en Foco"**.
- `PLAN_LABELS`: mismo criterio, para que el paywall y cualquier otro lugar que lea esa fuente única
  queden consistentes.
- `MEMBERSHIP_TIERS`: "Membresía Mensual" → "Mi Equilibrio, mes a mes"; "Membresía Anual" → "Mi Mundo en
  Foco, todo el año".
- Título de `/membresia`: "Membresía Mente en Foco+" → "Invierte en tu bienestar". "Elige tu plan" →
  "Elige cómo quieres avanzar". Botón "Suscribirme" → "Empezar con [Nombre del plan]".

Si algún nombre no termina de sonar bien al verlo en contexto real (a veces un nombre se lee distinto en
una tarjeta que en un documento), usa criterio y avísame qué cambiaste y por qué — no es una decisión
rígida, es una propuesta a validar en producción.

## Verificación

Después de los 4 puntos: entra a `/guia` sin sesión y confirma que las 8 tarjetas nuevas ya tienen imagen
(sin roto/placeholder) y que clic en una bloqueada abre el popup sin cambiar de página. Entra a
`/membresia` y confirma el nuevo orden y los nombres nuevos en las 3 tarjetas de plan y en las 2 de
membresía de contenido. Repórtame cualquier nombre que se vea raro en la práctica.
