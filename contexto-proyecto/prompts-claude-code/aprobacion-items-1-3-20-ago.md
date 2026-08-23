# Aprobación — ítems 1, 2 y 3 (journaling, directorio, admin-create-user)

Apruebo los tres. Respuestas a tus preguntas:

## Ítem 1 — Journaling
- Prompts como **constante estática** (recomendado) — no crear `journal_prompts`.
- **DELETE del propietario: sí**, inclúyelo (recomendado) — es un diario privado, no un registro clínico
  firmado.
- **Dentro de "Mi camino"** como subsección (recomendado), no ítem propio de nav.

Procede con el esquema propuesto y la disciplina completa de migración.

## Ítem 2 — Directorio público (Ola 3)
- **Apruebo cerrar la sobre-exposición** con la vista `public_therapist_directory` + columnas allowlist.
  Buen hallazgo aparte — trátalo como lo que es: una corrección de seguridad real (ADR-013), no solo un
  paso de la Ola 3.
- **`license_number` fuera del público** — confirmado, autenticados solamente.
- Columnas de la vista: las que listaste (`profile_id, professional_name, bio, specializations,
  languages, modalities, age_groups, accepts_online, accepts_in_person, years_experience, verified`) —
  aprobadas tal cual.
- **Ruta `/especialistas`** — aprobada.
- Confirmado: migración completa (vista + ajuste de política), con toda la disciplina de siempre.

## Ítem 3 — admin-create-user
**Procede** con `must_change_password: true` en el UPDATE (líneas 74-81), para paciente y terapeuta.
Verifica build + tests después. Es de una línea, no hace falta que interrumpa el resto de la cola.

## Orden de ejecución
Aplica en el orden que prefieras entre estos tres — no dependen entre sí. El ítem 4 (B2B) sigue en
preguntas de alcance; te llegan las respuestas por separado, no te detengas por eso.

Al terminar cada uno: doc de auditoría breve + línea correspondiente en `01_ROADMAP_Y_TAREAS.md`. No
commitees hasta que yo lo confirme, mismo patrón de siempre.
