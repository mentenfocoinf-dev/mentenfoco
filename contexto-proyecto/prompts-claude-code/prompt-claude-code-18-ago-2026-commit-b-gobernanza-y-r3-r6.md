# Prompt para Claude Code — Git Governance Commit B (producto) + reanudar R3/R6

> Pégalo tal cual en Claude Code, en la raíz del repo. Continúa directamente después de **Commit A**
> (`f3f9701`, "security: close RLS hardening and remediation sprints") y de
> `Remediacion_Seguridad_2026-08-18.md`, que dejó R3 y R6 **bloqueados por gobernanza de git** —tus
> propias palabras: *"R3/R6-código quedan bloqueados hasta resolver la gobernanza de `SignupModal.tsx`
> y `public-signup/index.ts` (working tree sin commitear)"*.

---

## Lo que encontré al revisar el árbol tras Commit A

`git status --short` reporta **~246 rutas sin commitear**, agrupadas así (cuéntalas de nuevo tú mismo,
no heredes mis números — es la misma disciplina que usaste en Commit A):

| Carpeta | ~Rutas | Qué es (mi hipótesis, verifícala) |
|---|---|---|
| `src/` | 87 | Todo el código de producto de agosto: agenda unificada, perfiles de terapeuta + matching, solicitudes de contacto, notificaciones, Journey Engine/"Mi camino", y ajustes sobre lo ya commiteado en `46d3c53`. |
| `supabase/` (fuera de las `20260812`–`818` ya commiteadas en A) | ~35 | Migraciones de **funcionalidad real ya construida**, dato clave: van de `20260730g` a `~20260811`, es decir **anteceden al sprint de seguridad** y nunca se commitearon. Ejemplos: `20260803c_therapist_profiles.sql`, `20260803g_patient_therapist_relationship.sql`, `20260803j_appointments.sql`, `20260803k_agenda_unificada.sql`, `20260804*` (disponibilidad, contraofertas), `20260805*`, `20260807*`, `20260808*`. **Esto es git-history de features en producción que hoy solo existe en disco.** |
| `.agents/` | 34 | En una muestra (`_template.md` de `supabase-postgres-best-practices`) el diff estaba **vacío** — probablemente ruido de mtime/normalización de línea de alguna sesión de herramienta, no cambio real. **No lo asumas de mi muestra: verifica el diff completo de las 34.** |
| `.claude/` | 35 | Mismo patrón: parece un espejo de los mismos archivos de referencia de skill que `.agents/`. Verifica igual, no asumas. |
| `contexto-proyecto/` | 9 | Probablemente `00_INDICE_MAESTRO.md` (el que quedó fuera de A a propósito) + otros docs de producto de agosto. |
| raíz (`tsconfig.json`, `package.json`, `wrangler.jsonc`, `eslint.config.js`, `components.json`, `bunfig.toml`, `.prettierrc`, `.prettierignore`, `.dockerignore`, `.env.example`, `scripts/`) | 1 c/u | Config de tooling — inspecciona cada uno, podría ser legítimo o residual. |
| `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md`, `01_ROADMAP_Y_TAREAS.md` | 2 | **Estos los edité yo (Cowork) en esta sesión** — una nota de puesta al día en el maestro y la sección "✅ Cerrado en agosto" + el cierre de R4/R5 en el roadmap. No es drift misterioso; son ediciones legítimas de documentación que deben ir en el commit de producto/docs. |

**Confirmado, no supuesto:** `git status --short | grep -i '\.env'` solo devuelve `.env.example`
(modificado). Ningún `.env` real aparece — coherente con lo que ya documentó
`Diagnostico_Seguridad_Post_RLS_2026-08-14.md` (`.env` nunca estuvo en git). Vuelve a confirmarlo tú
antes de commitear nada.

**El hallazgo que más me preocupa:** las migraciones de `20260730g`–`~20260811` son la base de datos de
funciones que **ya documenté como construidas y en uso** (agenda, matching, notificaciones — ver
`01_ROADMAP_Y_TAREAS.md`, sección "✅ Cerrado en agosto"). Que sigan sin commitear significa que, igual
que el hallazgo de R1 (cero backups de base de datos), **tampoco hay backup de código** para ese trabajo:
si se pierde el disco local antes de este commit, se pierden semanas de funciones ya en producción. Este
commit es, en ese sentido, tan urgente como R1.

---

## ⛔ Alcance de este prompt — solo gobernanza de git, cero cambios de base

- **No apliques ninguna migración.** Todas las `.sql` de `supabase/` que vas a commitear **ya están
  aplicadas en la base real** (son historial retroactivo, no trabajo pendiente). Este commit solo pone
  al día el repositorio con lo que ya existe en Supabase y en disco.
- **No toques RLS, ni R1, ni R2.** No ejecutes nada contra la base salvo consultas de solo lectura para
  verificar (igual que en Commit A: `git status`, y si necesitas confirmar que una migración de
  `supabase/` ya está aplicada, usa la Management API de solo lectura, nunca `psql` de escritura).
- **No mezcles gobernanza con código nuevo.** Si al revisar `src/` o `supabase/` encuentras algo que se
  ve a medio terminar, roto, o que no reconoces del roadmap, **no lo arregles ni lo completes aquí** —
  este commit es "poner al día git con lo que ya existe", no una revisión de calidad. Repórtalo aparte.

---

## FASE 0 — Inventario completo (antes de proponer nada)

1. `git status --short` completo, clasificado por carpeta con conteos exactos (no confíes en mi tabla).
2. Para `.agents/` y `.claude/`: `git diff` de **cada uno de los 69 archivos** (no una muestra). Clasifica
   cada uno como **contenido real modificado** o **ruido (mtime/line-ending/permission bit)**. Si
   confirmas que TODOS son ruido, propón `git checkout -- .agents/ .claude/` para descartarlos limpio
   (revierte, no commitea) — pero **pídeme confirmación antes de ejecutar ese `checkout`**, porque
   descarta cambios y las reglas del proyecto piden `git status` + respaldo antes de cualquier operación
   que descarte trabajo. Si encuentras que ALGUNO tiene contenido real, sepáralo y dime cuál.
3. `git status --short | grep -iE '\.env|secret|token|key'` — confirma 0 coincidencias de valores reales
   (solo `.env.example` con placeholders debería aparecer, si acaso).
4. Confirma que ninguna ruta de las pendientes se solape con las 65 ya commiteadas en A (no debería, pero
   verifícalo).
5. Para las migraciones `supabase/2026073*`–`2026081*` sin commitear: confirma contra la Management API
   (solo lectura) que las tablas/columnas que crean **ya existen en la base real** — es la prueba de que
   son historia retroactiva y no trabajo pendiente de aplicar.

## FASE 1 — Propuesta de commits (plan, no ejecución)

No hagas un solo commit gigante de 246 archivos sin criterio. Propón una **agrupación temática**, en el
mismo espíritu que Commit A, por ejemplo (ajústala a lo que realmente encuentres):

- **Commit B1 — `feat: therapist profiles, matching engine and contact requests`** — migraciones
  `therapist_profiles`, `user_preferences`, `therapist_contact_requests`, `patient_therapist` relación, +
  `src/lib/api/matchingService.ts`, `therapistContactService.ts`, `src/components/matching/`, y las
  piezas de `MiCaminoSection.tsx` que dependen de esto.
- **Commit B2 — `feat: unified agenda and appointments`** — migraciones de `appointments`, agenda
  unificada, disponibilidad, contraofertas + `appointmentService.ts`, `sessionsService.ts`,
  `timeBlocksService.ts`, `useAgenda.ts`, componentes de agenda.
- **Commit B3 — `feat: notifications and journey engine`** — `notifications`, `journey_events` (las
  migraciones de *funcionalidad*, no las de R4 que ya están en A) + `notificationService.ts`,
  `journeyService.ts`, `useNovedades.ts`, `NotificacionesBadge.tsx`, `recentResources.ts`.
- **Commit B4 — `docs: catch up product context to mid-August`** — `00_INDICE_MAESTRO.md`,
  `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md`, `01_ROADMAP_Y_TAREAS.md`, resto de `contexto-proyecto/`.
- **Commit B5 — `chore: tooling config catch-up`** — los archivos raíz de config, solo los que
  confirmes como cambio real (no ruido).
- Cualquier resto de `src/` que no encaje arriba, en el commit temático que mejor le quede o en uno
  adicional que propongas y justifiques.

Preséntame esta propuesta (qué va en cada commit, cuántos archivos, mensaje exacto) **antes de hacer
`git add`**. Usa el mismo formato de reporte que en Commit A (FASE por FASE, con verificación de
staging antes de cada commit).

## FASE 2 — Ejecución (solo tras mi aprobación de la propuesta de FASE 1)

Por cada commit propuesto y aprobado:
1. `git add` solo de las rutas de ese commit.
2. `git status --short` → confirma el conteo exacto y 0 archivos fuera de lo aprobado para ese commit.
3. `git diff --cached --name-status` → confirma altas/modificaciones esperadas, 0 secretos.
4. Commit con el mensaje exacto acordado (Conventional Commits, en inglés).
5. Repite para el siguiente, sin mezclar.

## FASE 3 — Push

Tras el último commit de este sprint, la rama local quedará muchos commits por delante de
`origin/main` (ya son 14 solo con Commit A). **Antes de hacer `git push`, dime cuántos commits quedarían
por delante y pídeme confirmación explícita** — es información que debo aprobar antes de que se publique,
aunque el repo sea privado.

---

## Después de Commit B — reanudar R3 y R6

Una vez el árbol está limpio (working tree = solo lo que de verdad está en curso), retoma lo que quedó
bloqueado:

### R3 — Rate-limit + captcha en `public-signup`
Sigue las instrucciones ya dadas en `prompt-claude-code-18-ago-2026-remediacion-seguridad.md` (sección
R3): backend antes que frontend, prioriza Cloudflare Turnstile, prueba en staging, secretos como env,
copy en español neutro sin urgencia artificial. Con `SignupModal.tsx` y `public-signup/index.ts` ya en un
commit limpio, ahora los cambios de R3 se ven aislados en su propio diff.

### R6 — Retirar `DEV_MAIL_REDIRECT`
Confirma que ninguna función lo consume, deja la instrucción para que el responsable lo borre del panel
de secretos, y verifica por Management API que ya no aparece en la lista.

Al cerrar R3/R6: actualiza `01_ROADMAP_Y_TAREAS.md` (quedan solo R1 y R2 como pendientes del
responsable) y escribe el informe de cierre en `contexto-proyecto/auditorias-tecnicas/` con la misma
disciplina de invariantes antes/después.

---

## Entregable de tu primer mensaje

Solo la **FASE 0 (inventario) y la FASE 1 (propuesta de agrupación de commits)**. No adelantes `git add`
ni commits todavía — espera mi aprobación explícita a la propuesta, igual que se hizo con Commit A.
