# Aprobación — commit del fix de webhook Stripe

(a) **Apruebo el commit** con el mensaje propuesto: `security: stripe webhook creates account with random
password + recovery link`.

(b) **Incluye los 2 prompts en el mismo commit** (5 archivos en total). Ya estás metiendo un doc de
auditoría en este mismo commit de seguridad, y los 2 prompts documentan exactamente este fix — no es
mezclar temas distintos, es cerrar el rastro completo de esta misma tarea. Evita además dejarlos
untracked otra vez, que es justo el problema que resolvimos con Commit B.

Archivos del commit:
- `supabase/functions/stripe-webhook/index.ts`
- `01_ROADMAP_Y_TAREAS.md`
- `contexto-proyecto/auditorias-tecnicas/Fix_Stripe_Webhook_Password_2026-08-20.md`
- `contexto-proyecto/prompts-claude-code/prompt-claude-code-20-ago-2026-fix-webhook-stripe-password.md`
- `contexto-proyecto/prompts-claude-code/aprobacion-fix-webhook-stripe-20-ago.md`

`.claude/launch.json` sigue fuera, como siempre.

Confirma staging → status → diff cached → commit, y avísame si vuelve a quedar la rama por delante de
`origin/main` para el siguiente push (ya no debería bloquearte el harness si el push anterior de R3 pasó,
pero confírmalo antes de intentarlo).

Buena señal aparte: la nota de auditoría marcó que `/compra-exitosa` promete un enlace "válido 24 horas"
pero el `recovery` de Supabase caduca en ~1h por defecto. Déjalo anotado en el roadmap como pendiente
menor (ajustar la expiración en Auth o el copy) — no lo arregles ahora, es un frente aparte.
