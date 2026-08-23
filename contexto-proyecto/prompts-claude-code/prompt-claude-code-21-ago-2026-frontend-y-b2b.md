# Prompt para Claude Code — Frontend de items 1-2, commits, y desbloqueo B2B

> Pégalo tal cual en Claude Code. Responde tus 3 preguntas de cierre de la cola de backend.

## 1 — Frontend: procede

Sí, procede con el frontend de journaling (subsección en `MiCaminoSection`, prompts estáticos) y
`/especialistas` (consume `public_therapist_directory`). Es el cierre natural de items 1-2 — base ya
verificada, ADR-006 respetado. Build + tests al terminar, como siempre.

## 2 — Commits: 3 separados, agrupa la documentación con el de seguridad

- **`feat: structured journaling (journal_entries, owner-only)`** — migración + backup de item 1, y el
  frontend de journaling cuando esté listo (o en un commit `feat` propio si prefieres separar
  backend/frontend — tu criterio, ya lo hiciste bien con B1).
- **`security: close public over-exposure of therapist profiles (ADR-013)`** — migración + backup de
  item 2, **y aquí incluye el roadmap y `Backend_Journaling_y_Directorio_2026-08-21.md`** (ya que el doc
  cubre items 1 y 2 juntos, y este es el hallazgo de seguridad más significativo de los tres).
- **`security: admin-create-user forces password change on created accounts`** — el cambio de una línea,
  solo.

`.claude/launch.json` fuera, como siempre. Preséntame el staging antes de cada commit, no commitees
todavía.

## 3 — B2B: consentimiento como borrador, sin activar hasta revisión legal

Autorizado: diseña la tabla de vínculo empleado↔empresa y el flujo de consentimiento **"vincular mi
cuenta a mi empleador"** como borrador — mismo patrón que ya usó el proyecto con el consentimiento
clínico (se construyó el mecanismo, el texto quedó marcado pendiente de revisión jurídica antes de
considerarse cerrado). Reglas:

- El consentimiento debe ser **separado y revocable**, nunca reutilizar `clinical_consents` (ADR-008 ya
  lo prohíbe — confirmado por ti).
- **No lo actives por defecto ni lo conectes a ningún flujo real de producción** hasta que yo confirme
  que pasó revisión jurídica — igual que el texto del consentimiento clínico quedó pendiente de esa
  revisión sin bloquear la construcción del mecanismo.
- Con esto desbloqueado, sigue con el resto del diseño de FASE 1 que ya tenías listo: entidad
  `companies`, estado de negociación/contrato (sin precios), sin rol `company_admin` nuevo (confirmado),
  y la función `SECURITY DEFINER` de métricas agregadas con umbral mínimo (evitar reidentificación con
  N pequeño).
- Preséntame el diseño completo (FASE 0 ya la tienes, ahora FASE 1 completa) antes de escribir ninguna
  migración. Sigue siendo su propio sprint, no lo mezcles con el commit de journaling/directorio.

## Recordatorio de alcance

R1, R2, R6, Turnstile E2E, Stripe live, dominio propio — siguen para el final.
