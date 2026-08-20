# Remediación de seguridad post-RLS — R4 y R5

**Fecha:** 18 de agosto de 2026 · **Continúa:** `Diagnostico_Seguridad_Post_RLS_2026-08-14.md`.
Sprint de remediación aprobado (R1–R6). Este documento cubre **R4 y R5** —los dos cambios de base
que ejecuta el agente—. R1/R2/R6 los ejecuta el responsable; R3/R6-código quedan **bloqueados** hasta
resolver la gobernanza de `SignupModal.tsx` y `public-signup/index.ts` (working tree sin commitear).

**Disciplina aplicada en los dos:** baseline vivo → backup → prueba en transacción revertida →
aplicación → 4 pasadas de idempotencia → validación funcional → invariantes → rollback real →
reaplicación → documentación. Ningún hash heredado: todos medidos en vivo al empezar.

**Estado global sin cambios estructurales:** RLS 33/37 · FORCE 0/37 · políticas 98. Las dos
remediaciones **no crean ni eliminan** políticas ni tablas.

---

## R4 — cierra H-JE-001 (`journey_events`: TRUNCATE de service_role saltaba el append-only)

**Migración:** `supabase/20260818_je_revoke_truncate.sql` ·
**Backup:** `supabase/backups/20260818_pre_je_revoke_truncate.sql`

### El problema, reconfirmado con la corrección de un error de guion

El trigger `enforce_journey_event_append_only` es `FOR EACH ROW`: un `DELETE`/`UPDATE` fila a fila da
`P0001`. Pero `TRUNCATE` no dispara triggers de fila, y `service_role` conservaba `D` (TRUNCATE) en
la ACL (`arwdDxtm`).

> **ERROR DE SCRIPT aislado y corregido antes de aplicar.** La primera prueba puso el claim JWT a
> `service_role` pero **no hizo `SET ROLE service_role`**, así que el `TRUNCATE` corría como
> `postgres` (dueño, siempre puede) y daba un falso «EJECUTADO» incluso tras un privilegio ya
> revocado. Aislado: `SET ROLE service_role` funciona (`current_user=service_role`), y **como
> service_role real** el `TRUNCATE` sin revoke sí se ejecuta — la brecha es real a nivel de rol, no
> solo de ACL.

### Cambio

```sql
REVOKE TRUNCATE ON TABLE public.journey_events FROM service_role;
```

`service_role` pasa de `arwdDxtm` → `arwdxtm` (solo cae la `D`). Sin trigger `BEFORE TRUNCATE`
(descartado y aprobado: el REVOKE ya cierra la vía y no toca la huella de triggers). Confirmado:
**ningún consumidor hace TRUNCATE** de `journey_events` (0 en `src/`, Edge Functions, scripts;
la única mención en migraciones es `20260804d`, que ya lo revocó a `anon`/`authenticated`).

### Prueba en transacción revertida (antes de aplicar), como service_role real

```
1) service_role TRUNCATE (tras REVOKE) . 42501   ACL — CERRADO · filas intactas 58
2) service_role DELETE 1 fila .......... P0001   trigger append-only — INTACTO
3) anon INSERT (user_id NULL) .......... PASA    flujo legítimo intacto
   authenticated INSERT (propio) ....... PASA    flujo legítimo intacto
4) postgres TRUNCATE ................... EJECUTADO  (postgres lo conserva, correcto)
```

### Aplicación, idempotencia y validación

**4 pasadas idénticas:** `service_role=arwdxtm`, TRUNCATE revocado, DELETE (`d`) e INSERT (`a`)
conservados, `postgres` conserva `D`, 58 filas, 2 triggers, 98 políticas. Validación funcional con la
migración ya aplicada: idéntica a la prueba previa (TRUNCATE→42501, DELETE→P0001, INSERTs→PASA).

### Invariantes (18 criterios OK)

Solo cambió la ACL de `journey_events` (service_role `-D`) y, en consecuencia, la huella ACL global
(`d3ca583b…` → `2cde6e70…`). **Intactas:** huella TRIGGERS `3ca1288a…`, huella FUNCTIONS `e5e288e7…`,
huella POL `0370cedb…`, huella RLS `23020137…`, y la **ACL de las otras 36 tablas** (`84c53cde…`, no
se movió). `service_role` conserva DELETE e INSERT; `postgres` conserva TRUNCATE; `anon` sigue `a-`.

### Round-trip

- **Rollback real** (`GRANT TRUNCATE … TO service_role`): `service_role` vuelve a `arwdDxtm`, huella
  ACL global vuelve a **`d3ca583b…` exacta**. Sin reordenación de la ACL (la entrada de service_role
  nunca desapareció; solo se alternó el bit `D`).
- **Reaplicación:** vuelve a `arwdxtm`, huella `2cde6e70…`, idéntica a la primera aplicación.

### Discrepancias

- **FALLO REAL:** ninguno.
- **ERROR DE SCRIPT:** el `SET ROLE service_role` omitido en la primera prueba. Aislado, corregido y
  documentado antes de aplicar.
- **DEFECTO PREEXISTENTE cerrado:** H-JE-001.
- **CAMBIO DE CAPA:** ninguno — el TRUNCATE lo cierra la ACL, no un mecanismo nuevo; el append-only
  fila a fila sigue siendo el trigger.
- **INCONCLUYENTE:** ninguno.

**Estado R4:** aplicado. `service_role` ya no puede vaciar `journey_events`.

---

## R5 — cierra H-TB-001 (`enforce_time_block_ownership` cancelaba el DELETE de service_role en silencio)

**Migración:** `supabase/20260818_tb_trigger_fix.sql` ·
**Backup:** `supabase/backups/20260818_pre_tb_trigger_fix.sql`

### El defecto

La rama de bypass hacía `RETURN NEW` para cualquier operación. En un `BEFORE DELETE`, `NEW` es NULL,
y devolver NULL **cancela la fila sin error**: `service_role DELETE → ROW_COUNT=0`, la fila sobrevive.

### El fix — mínimo, solo la rama de bypass respeta `TG_OP`

```sql
IF (rol = 'service_role') OR (quien IS NULL AND rol = '') THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END IF;
```

Ninguna otra rama cambia: ni el `BLOCK_FORBIDDEN` del DELETE de usuario, ni la derivación
`NEW.therapist_id := auth.uid()`, ni el `BLOCK_FORBIDDEN` de UPDATE, ni `BLOCK_IN_THE_PAST`, ni
`BLOCK_OVERLAPS_AGENDA`. La **condición** de la rama tampoco: cubre service_role y la ruta de sistema
sin sesión, que tenían el mismo bug y quedan corregidas las dos.

**Declaración de huellas (cumplida y verificada):** cambia la huella FUNCTIONS
(`e5e288e7…` → `56046fff…`) porque el cuerpo cambia; **no** cambia la huella TRIGGERS (`3ca1288a…`
intacta), porque `pg_get_triggerdef` no incluye el cuerpo de la función. `SECURITY DEFINER`,
`search_path=public` y owner `postgres` intactos.

### Prueba en transacción revertida (antes de aplicar)

```
0) SIN fix · service_role DELETE por id ... 0 ROW_COUNT, fila sigue   <<< defecto confirmado
   [fix simulado dentro de la tx]
1) service_role DELETE por id ............. 1 borradas   CORRECTO (ahora sí borra)
2) terapeuta dueño DELETE por id .......... 1 borradas   CORRECTO (dueño intacto)
3) tercero (paciente) DELETE por id ....... 0 borradas, fila sobrevive → BLOQUEADO por RLS
4) terapeuta INSERT legítimo .............. PASA, therapist_id derivado
5) paciente envía therapist_id ajeno ...... derivado a SU uid (derivación intacta)
6) bloqueo en el PASADO ................... BLOCK_IN_THE_PAST (intacto)
```

> **ERROR DE SCRIPT aislado (regla cumplida).** Etiqueté el paso 3 como «NO bloqueó» esperando el
> `P0001` del trigger. **Falso:** con RLS activo, la política DELETE (`auth.uid()=therapist_id`)
> **filtra la fila antes de que el trigger se dispare** — el tercero ve 0 filas, borra 0, y la fila
> del terapeuta sobrevive. Es el **cambio de capa** ya documentado en el sprint de R5: en DELETE
> gobierna RLS antes que el trigger. Aislado: paciente SELECT de la fila → 0 visibles; DELETE → 0; la
> fila sigue en 1. El tercero **sí queda bloqueado**, por RLS. El fix de R5 no toca esa ruta.

### Aplicación, idempotencia, validación

**4 pasadas idénticas:** `md5(prosrc)=059881b0…`, huella FUNCTIONS `56046fff…`, huella TRIGGERS
`3ca1288a…` (intacta), SECURITY DEFINER true, search_path public, 0 filas. Validación funcional con la
migración aplicada: idéntica a la prueba (service_role DELETE→1, dueño→1, tercero→0 bloqueado por RLS,
INSERT→PASA, ajeno→derivado, pasado→BLOCK_IN_THE_PAST).

### Invariantes (17 criterios OK)

Solo cambió el cuerpo de `enforce_time_block_ownership`. Intactas: huella TRIGGERS, huella POL
(`0370cedb…`), huella RLS (`23020137…`), la ACL de `therapist_time_blocks`, sus 3 políticas, RLS
33/37, 98 políticas, 273 funciones. La huella ACL global sigue en `2cde6e70…` — **R4 permanece
aplicado** (service_role sin TRUNCATE sobre journey_events).

### Round-trip

- **Rollback real:** `md5(prosrc)` vuelve a `5411ff3c…`, huella FUNCTIONS a `e5e288e7…` (baseline
  exacto).
- **Reaplicación:** vuelve a `059881b0…` / `56046fff…`, triggerdef intacto.

### Discrepancias

- **FALLO REAL:** ninguno.
- **ERROR DE SCRIPT:** el paso 3 mal etiquetado (esperaba trigger, era RLS). Aislado y corregido.
- **DEFECTO PREEXISTENTE cerrado:** H-TB-001.
- **CAMBIO DE CAPA:** el bloqueo del tercero lo hace RLS (0 filas), no el trigger — documentado, no es
  regresión.
- **INCONCLUYENTE:** ninguno.

**Estado R5:** aplicado. `service_role` (y la ruta de sistema) ya pueden borrar bloqueos por `id`.

---

## Estado tras R4 + R5

```
RLS 33/37 · FORCE 0/37 · políticas 98   (sin cambios estructurales)
journey_events: service_role SIN TRUNCATE (arwdxtm) · append-only fila a fila intacto
enforce_time_block_ownership: rama de bypass respeta TG_OP · resto de la función intacto
huella ACL global   2cde6e70…   (baseline d3ca583b… + R4)
huella FUNCTIONS    56046fff…   (baseline e5e288e7… + R5)
huella TRIGGERS     3ca1288a…   (intacta)
huella POL          0370cedb…   (intacta)   ·   huella RLS   23020137…   (intacta)
```

**Bloqueado y pendiente del responsable:**
- **R1** (PITR/backups) — compuerta de cualquier DROP irreversible. No ejecutado.
- **R2** (rotar Resend) — lo hace el responsable; el agente solo verificará después.
- **R3/R6** — bloqueados hasta resolver la gobernanza del working tree sin commitear
  (`SignupModal.tsx`, `public-signup/index.ts`).
- **DROP de `test_scores` y `guides`** — siguen bloqueados por R1.

**Git:** 0 commits. El working tree sin commitear (app entera + plan RLS + estos dos archivos de R4/R5
+ este informe) queda tal cual, a la espera de la decisión de gobernanza.
