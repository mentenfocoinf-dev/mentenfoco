# Prompt para Claude Code — Corregir webhook de Stripe (contraseña = correo)

> Pégalo tal cual en Claude Code, en la raíz del repo. Es un frente **nuevo e independiente** de R1-R6:
> no depende de las Turnstile keys, del push a `origin`, ni de R2/Resend. Se puede avanzar ya.

## Por qué ahora

La prueba E2E de Turnstile quedó correctamente bloqueada (`TURNSTILE_SECRET_KEY` ausente — no vamos a
fabricar un PASS ni crear cuentas reales para probarlo, como ya explicaste). Mientras el responsable
carga esa clave y hace el `git push` pendiente, hay un hallazgo de seguridad **ya documentado en el
roadmap** y **sin ninguna dependencia externa**: el webhook de Stripe crea la cuenta del paciente con
**contraseña = su correo electrónico**. Eso es una cuenta con contraseña adivinable por cualquiera que
sepa el email — corresponde a ADR-013 (seguridad técnica que expone a terceros se cierra siempre).

## Antes de tocar nada

Lee `contexto-proyecto/vision-producto/` si no la tienes fresca (ya la leíste hoy, no hace falta repetir
si sigue en contexto). Aplica la misma disciplina de siempre: **demostrar antes de proponer, proponer
antes de aplicar.**

## FASE 0 — Diagnóstico (solo lectura)

1. Localiza el webhook de Stripe (`supabase/functions/stripe-webhook/` o equivalente) y el punto exacto
   donde crea el usuario tras `checkout.session.completed`.
2. Confirma el hallazgo con evidencia (cita la línea): ¿la contraseña se genera literalmente igual al
   email, o hay algo más (ej. email + sufijo fijo)? No asumas, lee el código real.
3. Evalúa impacto real: ¿el flujo obliga a cambiar la contraseña en el primer login? ¿Se envía por correo
   aparte? ¿Cuántas cuentas activas hoy podrían tener este patrón (cuenta de prueba, no valores)?
4. Revisa si el mismo patrón se repite en otro punto de creación de cuentas (`admin-create-user`,
   `public-signup`, seed scripts) — si el problema es más amplio que el webhook, dilo antes de acotar el
   fix.

## FASE 1 — Propuesta (antes de aplicar)

Preséntame el fix exacto antes de tocar código. Referencia — no la apliques sin más, ajústala a lo que
encuentres en FASE 0:

- Generar una contraseña aleatoria criptográficamente segura (no derivada del email) al crear la cuenta
  vía webhook.
- Forzar flujo de "establece tu contraseña" (magic link / reset) en el primer acceso, en vez de que el
  paciente use una contraseña que nunca eligió.
- Si ya existe un mecanismo de invitación por Supabase Auth (`inviteUserByEmail` o similar) que resuelve
  esto de forma nativa, prefiérelo sobre generar-y-enviar contraseña.

Dime también si esto toca el flujo de `compra-exitosa.tsx` (onboarding post-compra, sigue pendiente en el
roadmap) — si la solución requiere cambios ahí, decláralo como alcance ampliado, no lo hagas sin decirlo.

## Reglas transversales

- Nada de Stripe **live** todavía — este fix es sobre el *código* del webhook, no sobre pasar a modo real
  (eso sigue pendiente y depende de que el responsable cargue las claves live, aparte de este prompt).
- No toques R1-R6, RLS, ni el trabajo de R3 sin commitear (déjalo tal cual, a la espera del commit ya
  propuesto).
- Si el fix requiere una migración (ej. columna o flag de "debe cambiar contraseña"), sigue la disciplina
  completa: backup, prueba en transacción, invariantes, rollback probado.
- Al terminar: actualiza `01_ROADMAP_Y_TAREAS.md` (la línea "corregir webhook..." bajo la fase de
  seguridad) y escribe una nota corta en `contexto-proyecto/auditorias-tecnicas/` — no hace falta el
  informe extenso de un sprint completo, esto es un fix acotado.

## Entregable de tu primer mensaje

Solo **FASE 0** (diagnóstico con evidencia) y **FASE 1** (propuesta de fix). Espera mi aprobación antes de
tocar código o crear una migración.
