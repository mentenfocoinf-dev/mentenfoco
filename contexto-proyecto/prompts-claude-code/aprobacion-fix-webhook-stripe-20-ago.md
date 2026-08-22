# Aprobación — fix webhook Stripe (contraseña = correo)

Apruebo FASE 1 completa. Respuestas a tus 3 decisiones:

1. **Contraseña aleatoria + enlace `recovery` enviado por Resend** — aprobado (tu recomendación). Mantiene
   la voz/branding consistente con `public-signup`, no dependas de `inviteUserByEmail`.
2. **Incluye `must_change_password: true`** como defensa en profundidad. El gate ya existe y funciona
   (`onboardingGates.ts:79`); es una línea más y no cuesta nada aunque la contraseña aleatoria ya sea
   inutilizable sin el enlace.
3. **`admin-create-user` queda fuera de este fix** — no es esta vulnerabilidad. Anótalo como item aparte
   en el roadmap (severidad baja, admin comunica la clave directamente) para atenderlo después, sin
   bloquear este cierre.

Procede a aplicar. Como no hay migración, no hace falta el sprint completo de backup/rollback — pero sigue
la disciplina normal de código: verifica que build + tests (220/220) siguen verdes después del cambio, y
no toques nada de R1-R6, RLS, ni los archivos de R3 sin commitear.

Al terminar: actualiza la línea del webhook en `01_ROADMAP_Y_TAREAS.md` (cerrado + nota del item aparte de
`admin-create-user`), deja la nota breve en `contexto-proyecto/auditorias-tecnicas/`, y dime si este
código queda listo para commitear junto con R3 o en un commit propio — no lo comitees todavía, solo
propón.
