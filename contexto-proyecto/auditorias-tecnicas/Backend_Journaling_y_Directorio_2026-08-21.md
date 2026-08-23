# Backend — Journaling (item 1) + Directorio público / fix de exposición (item 2)

**Fecha:** 21 de agosto de 2026 · **Alcance:** backend (esquema + RLS) de la cola aprobada. El frontend
(subsección de "Mi camino", ruta `/especialistas`) es el paso siguiente (ADR-006: base verificada primero).
**Marco:** ADR-001 (cero paywalls), ADR-006, ADR-011 (reglas en la base), ADR-013 (cerrar exposición de
terceros). Disciplina completa por migración: baseline → backup → prueba en tx revertida → aplicación →
4 pasadas idempotencia → invariantes → rollback real → reaplicación.

**Baseline (21-ago, post-webhook):** tablas 38 · RLS 34/38 · políticas 98 · funciones 274 · vistas 2 ·
huella POL `772a6193` · huella ACL `74141c34`.

---

## Item 1 — `journal_entries` (journaling privado de autocuidado) · APLICADO

**Migración:** `supabase/20260821_journal_entries.sql` · **Backup:** `backups/20260821_pre_journal_entries.sql`

Decisiones aprobadas: diario **privado por defecto**, sin compartir en v1; owner-only espejo de
`mood_entries` **+ DELETE del propietario** (un diario reflexivo es del paciente, no una nota clínica firmada
e inmutable). Prompts guiados = **constante estática en frontend** (sin tabla `journal_prompts`); `prompt`
guarda cuál guió la entrada (NULL = libre). Vive dentro de **"Mi camino"**.

Esquema: `journal_entries(id, patient_id→profiles ON DELETE CASCADE, entry_date, prompt, body, created_at,
updated_at)` + índice `(patient_id, entry_date DESC)`. **RLS activo**; `REVOKE ALL FROM anon`; `GRANT
SELECT,INSERT,UPDATE,DELETE TO authenticated`; 4 políticas owner-only (`auth.uid()=patient_id`).

**Prueba en tx revertida (9/9):** owner INSERT propio OK · INSERT con `patient_id` ajeno → 42501 · owner
SELECT ve solo lo suyo · tercero SELECT/UPDATE/DELETE → 0 filas (aislado) · owner UPDATE/DELETE propios → 1 ·
anon SELECT → 42501. **Idempotencia:** 4 pasadas idénticas. **Invariantes:** tablas 38→39, RLS 34→35,
políticas 98→102 (+4), anon SELECT=false, auth `arwd`, R4/R5 intactos. **Round-trip:** rollback → baseline
EXACTO (38/34/98, POL `772a6193`, ACL `74141c34`); reaplicación → 39/35/102.

---

## Item 2 — Directorio público + CORRECCIÓN DE SEGURIDAD (ADR-013) · APLICADO

**Migración:** `supabase/20260821_public_therapist_directory.sql` ·
**Backup:** `backups/20260821_pre_public_therapist_directory.sql`

### El hallazgo de seguridad (no solo Ola 3)

`therapist_profiles` tenía la política `[SELECT] "Anyone reads therapist profiles"` con `USING(true)` para
`{anon, authenticated}`. Medido: **cualquier anónimo podía leer por la API la tabla entera** — todas las
columnas (incluidas `license_number` = tarjeta profesional y `availability` = agenda operativa) y todas las
filas (incluidos perfiles `active=false`/`verified=false`). Sobre-exposición → ADR-013.

### El cierre (regla en la base, ADR-011)

1. Política SELECT de la base → **solo `authenticated`** (renombrada "Authenticated reads therapist
   profiles"); el matching del portal sigue leyendo.
2. **`REVOKE SELECT ON therapist_profiles FROM anon`** (defensa en profundidad).
3. **Vista `public_therapist_directory`** con **columnas allowlist** (`profile_id, professional_name, bio,
   specializations, languages, modalities, age_groups, accepts_online, accepts_in_person, years_experience,
   verified`), filtrada a `active=true AND verified=true`, `security_invoker=false` (corre como owner, sirve
   la proyección curada). `license_number` y `availability` **quedan fuera del público** (solo autenticados).
4. `GRANT SELECT` de la vista a `anon, authenticated`.

El contacto real sigue exigiendo cuenta (`therapist_contact_requests` INSERT `CHECK auth.uid()=patient_id`,
anon INSERT=false) — el directorio capta, no vende (ADR-001/ADR-005).

**Prueba en tx revertida:** vista expone exactamente las 11 columnas seguras (sin `license_number` ni
`availability`) · anon SELECT sobre la **base** → 42501 (cerrado) · anon SELECT sobre la **vista** → permitido ·
authenticated SELECT base → sigue permitido · filtro `active&verified`: vista == base(active&verified).
**Idempotencia:** 4 pasadas (se dropean ambas políticas por nombre antes de crear; `CREATE POLICY` no admite
IF NOT EXISTS). **Invariantes:** tablas 39 (sin cambio), vistas 2→3, políticas 102 (sin cambio: −1 +1), anon
base SELECT=false, anon vista SELECT=true, item 1 intacto, R4/R5 intactos. **Round-trip:** rollback restaura
la política EXACTA (POL `aec90dd5` idéntico), anon base SELECT=true, vista eliminada; reaplicación deja el
estado final.

### Discrepancia clasificada

- **ARTEFACTO (reordenamiento de relacl):** tras el round-trip la huella ACL global difiere
  (`05eef021`→`b2886751`). Causa: el ciclo `REVOKE SELECT FROM anon` + `GRANT SELECT TO anon` reordena la
  entrada `relacl` de `therapist_profiles` (mismo fenómeno que en R4). La única operación de grant del ciclo
  fue el SELECT de anon, que quedó restaurado (anon base SELECT=true) → **privilegios idénticos, solo cambia
  el orden**. No afecta el estado final aplicado.
- **FALLO REAL / ERROR DE SCRIPT / CAMBIO DE CAPA:** ninguno.

---

## Estado tras items 1 y 2

```
tablas 39 · RLS 35/39 · políticas 102 · vistas 3
journal_entries: RLS owner-only (4 políticas), anon denegado
therapist_profiles: SELECT solo authenticated · anon sin acceso a la base
public_therapist_directory: vista pública curada (11 columnas, active+verified)
R4/R5 intactos · item 3 (admin-create-user must_change_password) aplicado en código
build ✓ · tests 220/220
```

**Pendiente (frontend, paso siguiente):** subsección de journaling en "Mi camino" (con prompts estáticos) y
página pública `/especialistas` que consume `public_therapist_directory`. **No commiteado** — a la espera de
aprobación, junto con el fix de `admin-create-user`.
