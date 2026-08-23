# Aprobación — commits (frontend atómico) y diseño B2B

## 1 — Commits: apruebo el plan de 4

Correcto el mismo razonamiento de B1 (barrel obliga atomicidad). Procede con:

1. `security: close public over-exposure of therapist profiles (ADR-013)` — backend + roadmap + audit doc
2. `security: admin-create-user forces password change on created accounts`
3. `feat(db): structured journaling table (journal_entries, owner-only)`
4. `feat: journaling and public specialists directory (frontend)`

**Los prompts de `contexto-proyecto/prompts-claude-code/` de esta sesión (cola de backend, journaling,
directorio, B2B) van en el Commit 1**, junto con el roadmap y el audit doc — mismo criterio que el fix
del webhook: evita dejarlos untracked otra vez. `.claude/launch.json` fuera, como siempre.

Staging → status → diff cached → commit, uno por uno, sin mezclar. No hagas push todavía — avísame
cuántos commits quedarían por delante de `origin/main` y espera mi confirmación antes de intentarlo (y
recuerda: el push probablemente lo tengas que correr tú por el bloqueo del harness).

## 2 — B2B: apruebo el diseño de FASE 1, procede a las migraciones

El diseño es sólido: consentimiento separado (nunca reutiliza `clinical_consents`, respeta ADR-008),
umbral k=5 para evitar reidentificación en las métricas agregadas, sin rol nuevo por ahora, extensión del
pipeline de `crm_leads` en vez de una app aparte. Apruebo las 3 tablas (`companies`, `company_members`,
`employer_link_consents`) y la función `company_aggregate_metrics`.

**No negociable, repito para que quede explícito:** construyes el mecanismo completo con la disciplina
de siempre (backup, prueba en tx, invariantes, rollback, doc), pero el texto del consentimiento queda
`PENDIENTE DE REVISIÓN JURÍDICA` y **nada de esto se conecta a ningún flujo real ni UI de producción**
hasta que yo confirme que la revisión legal se hizo. Está bien que la tabla/función existan en la base
inertes — es el mismo patrón que ya funcionó con el consentimiento clínico.

Es su propio sprint — no lo mezcles en los 4 commits de arriba. Cuando termines el backend de B2B,
preséntame el plan de commit por separado.
