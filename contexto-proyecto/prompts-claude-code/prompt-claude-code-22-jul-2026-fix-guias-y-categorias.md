# Prompt para Claude Code — Fix visibilidad de guías + dropdown de categorías

Contexto: en la vitrina de guías, un perfil premium ve las 20 correctamente, pero un perfil gratis o un
visitante sin sesión solo ve 4 en total (en vez de ver las 20 con candado en las que no puede leer).
Diagnostiqué la causa exacta leyendo `src/lib/api/guidesService.ts` — no es un problema de datos ni de
RLS, es una línea de filtro de más. Spec completa en
`especificaciones-producto/06_fix_visibilidad_guias_y_expansion_categorias.md` — léela antes de tocar
código, este prompt resume el orden de trabajo.

## 1. Fix del bug (prioridad, es lo primero)

En `listGuides()` (`src/lib/api/guidesService.ts`), quita esta línea:
```ts
if (freeLead) query = query.eq("visible_en_plan_gratis", true);
```
`clinical_guides_meta` es solo metadatos (sin `contenidoCompleto`) y no tiene RLS propio que bloquee
nada — quitar el filtro no expone contenido, solo hace que la lista completa (20 guías, y las que se
agreguen) llegue siempre al cliente. `guia.tsx` ya tiene el candado listo para `min_plan !== 'free'`; con
esto empieza a renderizarse para free/anónimo tal como se diseñó originalmente (el propio comentario del
archivo ya decía esa era la intención). No toques `getGuide()` — el gateo del contenido completo ahí sí
está bien y no cambia.

Verifica en el navegador, sin sesión y con `paciente.free@test.com`: deben verse las 20 tarjetas, con
candado ámbar en las que no son de vitrina, y el botón "Leer guía" debe llevar al paywall correcto en
esas (ya debería funcionar solo con este fix, porque `getGuide` ya está bien).

## 2. Aclaración que NO requiere cambio de código

Confirmé en `20260703_plan_tiers_admin_rpcs.sql` que el backend ya hace lo que el usuario pidió hoy:
cualquier guía premium tiene `min_plan='esencial'` (nunca `integral`/`premium`), así que cualquier plan
pago desbloquea el catálogo completo. Esto no se toca — solo lo dejo anotado para que no se intente
"corregir" algo que ya está bien.

## 3. Dropdown de categorías (para cuando se agreguen las 5 categorías nuevas)

Las categorías van a pasar de 8 a 13 (Personalidad, Sueño, Estrés laboral/Burnout, Adicciones, Salud
mental perinatal se agregan más adelante, con contenido investigado — no las generes todavía). La fila de
pills de `guia.tsx` no escala bien a 13. Construye ahora la UI para que soporte esto: mantener "Todas" +
pills para las categorías con más guías, y un desplegable ("Más categorías ▾") para el resto — o el patrón
visual que prefieras manteniendo la línea glass/neon ya establecida. No hace falta esperar a las 5
categorías nuevas para construir el dropdown: constrúyelo ya para que estas 8 se vean bien organizadas y
quede listo para cuando lleguen las nuevas.

## Qué NO hacer todavía

No generar contenido de las 5 categorías nuevas — el usuario quiere que primero se investigue la base
científica de cada tema (ver `guias-bienestar/01_taxonomia_categorias.md` para el orden sugerido). Esa
parte se hace en una ronda posterior, con el prompt generador en
`guias-bienestar/02_prompt_generador_de_guias.md`.
