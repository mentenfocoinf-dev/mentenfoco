# Prompt para Claude Code — Sprint de remediación de seguridad (post-RLS)

> Pégalo tal cual en Claude Code, en la raíz del repo. Da continuidad directa al
> `Diagnostico_Seguridad_Post_RLS_2026-08-14.md`, que se detuvo esperando aprobación. El usuario
> **aprobó la remediación completa (R1–R6)**. Este prompt respeta que R1 y R2 solo las ejecuta el
> responsable: tú las preparas y las **verificas después**, no las aplicas.

---

Retomas Mente en Foco (plataforma clínica de salud mental; React 19 + TS, TanStack, Vite 7, Tailwind v4,
Supabase con RLS, Stripe test, Resend). Español neutro/colombiano, tuteo, nunca voseo. Código y commits en
inglés (Conventional Commits). **Antes de tocar nada, lee `contexto-proyecto/vision-producto/` (filosofía +
ADR + lenguaje): manda sobre todo lo demás.**

## De dónde venimos

El sprint de RLS cerró en **33/37 tablas, 98 políticas, 0 FORCE**. Tu diagnóstico del 14-ago concluyó que
el riesgo dominante ya no es RLS sino la **falta de recuperación**, y dejó una lista ordenada de
remediación (R1–R6). Este sprint la ejecuta en ese orden.

## ⛔ Regla de oro de este sprint (del propio diagnóstico)

**Hasta que exista una copia restaurable (R1), ninguna operación irreversible es prudente.** Por eso:

- Todo cambio de base va en **transacción con `ROLLBACK` de prueba primero**, es **reversible** (REVOKE se
  revierte con GRANT; un trigger se restaura desde su backup), y se aplica solo tras verificar el rollback.
- **NO** ejecutes los DROP aplazados de `test_scores` ni `guides` en este sprint: siguen bloqueados por R1.
- Mide **invariantes en vivo antes y después** de cada cambio (RLS global, nº de políticas, FORCE, huellas
  ACL/TRIGGERS/FUNCTIONS, conteos de filas de las tablas tocadas). No heredes hashes de informes anteriores.
- Lo que no puedas demostrar, márcalo **INCONCLUYENTE**. No rellenes con suposiciones.
- Cada cambio de base = una **migración versionada** en `supabase/` con fecha real y un **backup de ACL/
  definición** del objeto tocado, igual que en los sprints de RLS. Documenta cada paso en
  `contexto-proyecto/auditorias-tecnicas/`.

---

## Orden de ejecución (con compuertas)

### R1 — Backups + PITR · CRÍTICO · **la ejecuta el responsable, tú preparas y verificas**
No puedes activarlo (requiere upgrade de plan/billing y acción del dueño en el panel de Supabase). Tu tarea:

1. Escribe en `contexto-proyecto/auditorias-tecnicas/` una **guía paso a paso** para el responsable:
   qué plan/add-on habilita PITR, dónde se activa, qué retención elegir para datos clínicos, y cómo lucirá
   `pitr_enabled: true` con `backups` no vacío en la Management API.
2. Deja un **script de verificación de solo lectura** (mismo patrón defensivo que ya usaste: nunca imprime
   valores de secretos) que consulte `GET /v1/projects/{ref}/database/backups` y confirme
   `pitr_enabled` y el conteo de copias.
3. **Compuerta:** hasta que ese script confirme al menos una copia recuperable, **no** ejecutes los DROP
   aplazados. Los demás pasos de este sprint (R3–R6) son reversibles y **sí** pueden avanzar sin esperar a
   R1 — dilo explícitamente en tu reporte para que quede claro qué quedó bloqueado y qué no.

### R2 — Rotar la clave de Resend · ALTO · **la ejecuta el responsable, tú preparas y verificas**
1. Guía breve: rotar en el panel de Resend y actualizar el secret `RESEND_API_KEY` en Supabase **en el
   mismo paso** (si se rota sin actualizar, se cae el correo de onboarding y de recordatorios).
2. Verificación: tras la rotación, el `updated_at` del secret debe ser **posterior** a hoy. Confírmalo por
   Management API (solo nombres y fechas, nunca valores). Si no lo es, repórtalo como **no rotada aún**.
3. No uses la clave para "probar si funciona": eso está prohibido. La señal aceptable es el `updated_at`.

### R4 — Cerrar H-JE-001 (`journey_events` TRUNCATE salta el append-only) · **tú lo ejecutas**
Es, según tu informe, el sprint técnico más limpio y encaja con la disciplina previa.

- **Solución:** `REVOKE TRUNCATE ON public.journey_events FROM service_role;` (opción preferida por ser la
  más simple y reversible). Evalúa si además conviene un `BEFORE TRUNCATE ... FOR EACH STATEMENT` como
  defensa en profundidad; si lo añades, justifícalo.
- **Disciplina:** backup de la ACL de `journey_events`; prueba en transacción que tras el REVOKE un
  `TRUNCATE` como `service_role` falla y que un `INSERT`/`SELECT` legítimo del flujo sigue funcionando;
  confirma que ningún consumidor legítimo hace TRUNCATE (revisa `journeyService` y llamadas). Migración
  versionada + registro en auditorías. Reconfirma H-JE-001 cerrado midiéndolo.

### R3 — Rate-limit + captcha en `public-signup` · ALTO · **toca frontend + Edge Function**
`public-signup` es `verify_jwt:false`, usa `service_role` para crear cuentas y enviar correo, sin límite.

- **Backend antes que frontend (regla del proyecto):** primero el control real. Añade rate-limit por IP
  (p. ej. ventana deslizante en una tabla o KV) **y** verificación de captcha del lado servidor en la Edge
  Function. Elige proveedor priorizando **Cloudflare Turnstile** (el deploy es Cloudflare Workers) salvo que
  veas razón para hCaptcha; documenta la decisión.
- **Frontend:** el formulario de signup envía el token del captcha; si el texto visible cambia, en español
  neutro y con el tono de `vision-producto/04_...`. No agregues fricción innecesaria (respeta la ética
  comercial: nada de urgencia/escasez).
- Prueba el flujo en staging (alta legítima pasa; ráfaga de altas se frena; sin token se rechaza).
- Secretos del captcha como secret de entorno, nunca hardcodeados.

### R5 — Cerrar H-TB-001 (`therapist_time_blocks`: `service_role` no borra) · **tú lo ejecutas**
La rama del trigger `enforce_time_block_ownership` para `service_role` devuelve `NEW` (NULL en DELETE) y
cancela la fila en silencio.

- **Solución:** corregir esa rama para `RETURN OLD` cuando `TG_OP='DELETE'`. Backup de la definición de la
  función; prueba en transacción que ahora `service_role` sí borra por `id` y que el dueño autenticado
  sigue borrando por `id` (recuerda el ERROR DE SCRIPT del `WHERE reason=...`: usa `WHERE id=...`, el patrón
  real de `deleteTimeBlock`). Migración versionada + registro. Falla-cerrado antes, así que el cambio solo
  habilita lo que debía; verifica que no abre nada indebido.

### R6 — Retirar `DEV_MAIL_REDIRECT` · BAJO · **la ejecuta el responsable (panel de secretos)**
Deja la instrucción de eliminarlo y confirma por Management API que ya no aparece en la lista de secretos.
Revisa que ninguna función lo lea (`Deno.env.get("DEV_MAIL_REDIRECT")`); si algo lo consume, ajústalo antes
de que el responsable lo borre, para no romper el envío de correo.

---

## Reglas transversales (no negociables)

- **Un cambio, una migración versionada, un backup de rollback, un registro en auditorías.** Igual que los
  sprints de RLS.
- No conviertas hallazgos en cambios que no estén en R1–R6. Si aparece algo nuevo, **documenta y pregunta**,
  no lo apliques.
- No toques RLS ya cerrado, ni los DROP aplazados, ni ejecutes nada irreversible antes de R1.
- No uses secretos para "probar"; la evidencia válida es metadata (`updated_at`, presencia/ausencia).
- Al terminar: **actualiza `01_ROADMAP_Y_TAREAS.md`** marcando lo cerrado en la fase de seguridad, escribe
  un informe de cierre en `contexto-proyecto/auditorias-tecnicas/` con el mismo rigor (invariantes antes/
  después, qué quedó INCONCLUYENTE, qué sigue pendiente del responsable), y **commit + push** (confirma de
  paso que todo el trabajo de agosto quedó commiteado: el `HEAD` estaba en `46d3c53`).

## Entregable de tu primer mensaje (antes de aplicar nada)

Un **plan de ejecución** que liste, para R3/R4/R5: el cambio exacto, el backup que tomarás, la prueba en
transacción y su rollback, y los invariantes que medirás. Para R1/R2/R6: la guía para el responsable y el
método de verificación. **Espera mi visto bueno a ese plan antes de aplicar el primer cambio de base.**
