# Backend — Rehabilitación cognitiva (catálogo de ejercicios + progreso)

**Fecha:** 26 de agosto de 2026 · **Marco:** ADR-001 (el plan filtra, no bloquea), ADR-006 (backend antes
que frontend), ADR-007 (no clonar contenido de terceros — NeuronUp es competidor con material propietario;
se usa solo la taxonomía de dominios, minijuegos originales), ADR-011 (reglas en la base). Disciplina
completa de migración.

**Baseline:** tablas 42 · RLS 38 · políticas 108 · enums 20 · POL `b48dad24` · ACL `6768c3c9`.

## Qué se creó
**Migración:** `supabase/20260826_cognitive_rehab.sql` · **Backup:** `backups/20260826_pre_cognitive_rehab.sql`

- **Enums:** `exercise_game_kind (memory_pairs, stroop_color, sequence_recall)`,
  `exercise_age_band (ninos, adolescentes, adultos, adultos_mayores)`,
  `exercise_difficulty (facil, medio, dificil)`.
- **`cognitive_exercises`** (catálogo): `slug, title, description, instructions, game_kind, domains[],
  age_band, min_plan, visible_anonimo, config jsonb, status, theme_key`. `game_kind` mapea a un componente
  React; `config` guarda los parámetros por nivel de dificultad.
- **`user_exercise_sessions`** (progreso): `patient_id, exercise_id, difficulty, score, accuracy,
  duration_seconds, completed`. Para mostrar "cuáles completó y en qué mejorar" (accuracy/score bajos).
- **`profiles`:** `+ birthdate` (adaptación por edad), `+ cognitive_terms_accepted_at` (T&C del apartado),
  con GRANT por columna a `authenticated` (el dueño las edita; no las bloquea el trigger de propiedad).

## Gating (ADR-001) — espeja `content_items` + escalón anónimo
RLS de lectura: `status='publicado'` y (`plan_rank(min_plan) <= get_my_plan_rank()` con la excepción de
`admin`/`therapist`), **más** `visible_anonimo` para el visitante sin cuenta. Resultado (el plan **filtra**,
lo fuera de tier simplemente no aparece):

| Quién | Ve |
|---|---|
| Anónimo | solo los `visible_anonimo` del tier free (pocos) |
| Cuenta gratis | tier `free` completo (más) |
| Base (`esencial`/`integral`) | + los suyos (más) |
| Pro (`premium`) | todos |

La **edad** es personalización (filtro de consulta por `age_band`), **no** frontera de seguridad → no va en
RLS. El **progreso** es owner-only (espeja `journal_entries`/`mood_entries`).

## Prueba en tx revertida (todo ✔)
```
gradiente de tier:  anónimo 1 · cuenta FREE 2 · PREMIUM 3 · ADMIN 3
progreso owner:     free INSERT propia OK · ve 1 · INSERT ajena 42501 · otro usuario 0 (aislado) · anon 42501
```
**Idempotencia:** 4 pasadas (enums guardados, tablas IF NOT EXISTS, políticas DROP+CREATE, seed ON CONFLICT
— 3 publicados sin duplicar). **Invariantes:** tablas 42→44, RLS 38→40, políticas 108→113 (+5), enums 20→23
(+3), profiles +2 columnas, anon sin acceso al progreso; journaling, B2B y R4/R5 intactos. **Round-trip:**
rollback → baseline EXACTO (`b48dad24`/`6768c3c9`); reaplicación → 44/113/23.

## Seed (3 ejercicios, demuestran el gradiente)
1. **Pares de memoria** (`memory_pairs`, memoria de trabajo) — `min_plan free`, `visible_anonimo` → lo ve el anónimo.
2. **Stroop de colores** (`stroop_color`, atención/inhibición) — `min_plan free` → cuenta gratis en adelante.
3. **Secuencia** (`sequence_recall`, memoria secuencial) — `min_plan esencial` → base en adelante.
Cada uno con `instructions` claras y `config` de 3 niveles de dificultad.

## Pendiente (frontend, paso siguiente — ADR-006 cumplido: base verificada primero)
- **3 minijuegos** React originales (`memory_pairs`, `stroop_color`, `sequence_recall`) con cronómetro/
  contador, niveles de dificultad escalables e instrucciones. "Sin modificar la página" → integración limpia
  con el diseño existente.
- **Ruta** `/rehabilitacion-cognitiva` (catálogo filtrado por tier+edad) y `/ejercicios/$slug` (el juego).
- **Popup de T&C** (aceptar/declinar) al abrir la sección; aceptar registra `cognitive_terms_accepted_at`
  (logueado) o localStorage (anónimo).
- **Sistema de progreso** que muestre completados y en qué mejorar (lee `user_exercise_sessions`), en la
  sección y/o "Mi camino".
- **Captura de edad** en onboarding → `birthdate` → `age_band`.

## Decisión legal/producto aún abierta (no bloquea v1 adultos)
El uso por **menores** (cuenta propia vs. acudiente) y su **consentimiento parental** (Ley 1581 NNA,
ADR-008/012) sigue pendiente. v1 arranca con `age_band=adultos`; el mecanismo de edad queda listo, pero el
contenido para `ninos`/`adolescentes` y su consentimiento se definen aparte. El popup de T&C cubre la
capa legal general del apartado.

**No commiteado** — a la espera de revisión (feature de producto).
