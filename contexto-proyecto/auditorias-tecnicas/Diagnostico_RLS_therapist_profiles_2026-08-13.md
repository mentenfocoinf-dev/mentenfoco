# Diagnóstico RLS — `therapist_profiles`

**Fecha:** 2026-08-13
**Alcance:** diagnóstico. **Sin migración, sin backup, sin políticas, sin RLS.** No se modificó ACL,
triggers, funciones, FK, índices, vistas, frontend ni RPC. Todo en transacciones revertidas.

Baseline al abrir y al cerrar — **idéntico**: 30 criterios, 6 huellas globales
(ACL `c9a0182c…`, FK `cfb70692…`, índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`,
vistas `61114ef9…`) y huella de datos de la tabla `5f6308f0…`.

---

## Corrección a mi diagnóstico anterior

En `Diagnostico_RLS_15_restantes_2026-08-13.md` escribí que la fila auto-insertada por un paciente
**«entra en el directorio y en el matching»**. **La segunda mitad es falsa.**

`matchingService.ts:224`, dentro de `cargarPerfiles()`, hace:

```js
return perfiles.filter((t) => t.verified)
```

Y `listTherapists()` tiene **un único consumidor**: ese mismo `cargarPerfiles()`. Comprobado por
búsqueda exhaustiva en `src/`: nadie más lo importa.

Lo que sí es cierto y está medido: **la fila entra en el resultado SQL de `listTherapists()`**.

```
antes de sembrar, WHERE active = true ...... 1 fila
el paciente crea su fila ................... verified=false  active=true
listTherapists() como anon ................. 2 filas   <<< la suya SÍ entra
de esas, verificadas ....................... 1
```

**Consecuencia honesta:** el agujero es real en la capa de datos, pero **no alcanza al paciente por
la aplicación**, porque el filtro de `verified` está en JS antes de mostrar nada. Sigo sin afirmar
nada sobre el render de ninguna pantalla: no lo he medido.

---

## Fase 1 — Baseline

```
relrowsecurity = false · relforcerowsecurity = false · reloptions = (NULL) · owner = postgres
políticas = 0 · filas = 1 · triggers = 1 · FK salientes = 1 · FK entrantes = 2 · índices = 3
vistas que la proyectan = 0 · Realtime sobre ella = 0
ACL: anon r--- · authenticated raw- · service_role rawd
huella de datos = 5f6308f0935161d4b721aaf24cc1ac75
```

Dato único: `104db81c "Terapeuta de Prueba" lic=TP-000000 verified=true active=true`.

**Defaults que importan:** `verified` → `false`, `active` → **`true`**.

**Índices:** `therapist_profiles_pkey (profile_id)`, gin sobre `specializations` y
**`idx_therapist_profiles_directorio ON (active, verified)`**. Ese último es evidencia de que el
directorio se **diseñó** para filtrar por las dos columnas.

**FK entrantes (2):** `patient_therapist.therapist_id` y
`therapist_contact_requests.therapist_profile_id`, ambas → `therapist_profiles(profile_id)`
`ON DELETE CASCADE`. Es decir: **una fila aquí es requisito para que exista una relación
terapéutica o una solicitud de contacto.**

**5 funciones la mencionan**, todas `SECURITY DEFINER`: `available_hours`,
`enforce_appointment_rules`, `get_my_therapist`, `list_my_appointments`, `list_my_contact_requests`.
No se ven afectadas por RLS.

---

## Fase 2 — Consumidores

**3 accesos directos, todos en `therapistService.ts`. Ninguna Edge Function, ningún RPC que escriba.**

| Consumidor | Op | Columnas | Filtro | `.select()` | Actor |
|---|---|---|---|---|---|
| `:90` `getTherapistProfile` | SELECT | las 14 de `CAMPOS`, incl. `license_number`, `verified`, `active` | `profile_id = sesión` | — | terapeuta (su propio perfil) y `ClinicalReportModal` |
| `:115` `updateTherapistProfile` | **UPSERT** `onConflict profile_id` | 10 campos, **no envía `verified`**, sí `active` | — | **`.select(CAMPOS)`** | terapeuta |
| `:141` `listTherapists` | SELECT | las 14 | **`active = true`** | — | vía `matchTherapists`, desde `MatchingPreview` y `MiCaminoSection` |

- **`INSERT ... RETURNING`:** sí. El upsert de `:115` lleva `.select(CAMPOS)`.
- **`UPDATE ... RETURNING`:** sí, el mismo upsert cuando la fila ya existe.
- **¿El paciente puede consultar `therapist_profiles` directamente?** Sí, y **debe**: el matching lo
  necesita. También `anon`, porque `MatchingPreview` es accesible sin sesión.
- **Sin flujo de verificación en la aplicación.** `adminService.ts` no toca `verified` y
  `AdminDashboard.tsx` no tiene UI de verificación. La única vía es el trigger, por un admin
  autenticado o por `service_role`.
- **Sin flujo de DELETE.** Ningún consumidor borra.
- **Activación/desactivación:** la hace el propio terapeuta desde `TherapistProfileForm`, que envía
  `active` en el upsert.

---

## Fase 3 — Reglas de autoría y triggers

Un solo trigger: `trg_therapist_profile_ownership` → `enforce_therapist_profile_ownership`
[`SECURITY DEFINER`], `BEFORE INSERT OR UPDATE`.

Medido **con RLS apagado**, así que ningún resultado es atribuible a RLS:

| Intento | Resultado | Capa |
|---|---|---|
| paciente **crea el suyo** | **SE CREA** (`verified=false`, `active=true`) | **ninguna** |
| paciente modifica el suyo | 1 fila | ninguna |
| paciente modifica el **ajeno** | `THERAPIST_PROFILE_FORBIDDEN` | trigger |
| paciente se **auto-verifica** | `THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY` | trigger |
| paciente cambia su `active` | 1 fila | ninguna (es su perfil) |
| paciente pone su `license_number` | 1 fila | **ninguna** |
| paciente cambia el `profile_id` | `THERAPIST_PROFILE_FORBIDDEN` | trigger |
| paciente crea **a nombre ajeno** | `THERAPIST_PROFILE_FORBIDDEN` | trigger |
| `INSERT` con `verified=true` | `THERAPIST_PROFILE_FORBIDDEN` | trigger |
| `DELETE` | `42501 permission denied` | **ACL** |
| terapeuta modifica el suyo | 1 fila | — |
| terapeuta cambia su `verified` | `THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY` | trigger |
| **admin verifica a un terapeuta** | **1 fila** | trigger lo permite a propósito |

**Confirmado: el trigger comprueba `NEW.profile_id = auth.uid()` pero NO el rol del actor.** Sigue
siendo cierto en el estado actual. Es el único hueco.

---

## Fase 6 — El directorio, reproducido en SQL

```
SELECT <14 columnas> FROM therapist_profiles WHERE active = true
filtra active .... SÍ        filtra verified ... NO
filtra role ...... NO        consulta profiles . NO      JOIN ... ninguno
función SQL intermedia: ninguna (acceso directo PostgREST)
```

**Inconsistencia preexistente, que no corrijo aquí:** el índice se llama `…_directorio` y es sobre
`(active, verified)`, pero la consulta solo filtra `active`. El filtro de `verified` vive en JS.
Funciona, pero la protección depende del cliente. **Queda documentado, no corregido**: arreglarlo es
tocar frontend, fuera del alcance.

---

## Fase 7 — Diseño, antes de proponer nada

**1. Fuga de lectura real: ninguna.** La lectura es pública **por diseño de ACL** (`anon = r`), no
por ausencia de RLS. Es un directorio profesional. RLS **no añade nada** en lectura.

*Matiz que dejo anotado sin resolver:* `anon` lee `license_number`. En Colombia la tarjeta
profesional es un dato público, así que no lo llamo fuga; pero si el producto decidiera que no debe
ser público, se resolvería con GRANT por columna, no con RLS. **No lo toco.**

**2. Fuga de escritura real: una sola.** Cualquier `authenticated` —incluido un paciente— **puede
crear su propia fila en `therapist_profiles`**, con `active = true` por defecto y el
`license_number` que quiera. Ninguna capa lo impide hoy.

Alcance honesto: esa fila **no llega al paciente por la aplicación** (el matching filtra `verified`),
pero **sí satisface las dos FK entrantes**, así que es una fila de «profesional» estructuralmente
válida en la base.

**3. Controles ya existentes por trigger:** propiedad en `UPDATE`, propiedad en `INSERT` a nombre
ajeno, inmutabilidad de `profile_id`, y `verified` reservado al admin tanto en alta como en edición.
**Todo eso ya funciona y RLS no debe duplicarlo.**

**4. Controles ya existentes por ACL:** `DELETE` cerrado a `anon` y `authenticated`; `anon` sin
`INSERT` ni `UPDATE`.

**5. Lo único que debe añadir RLS:** que **quien crea un perfil profesional tenga rol `therapist`**.
Es lo que el trigger no comprueba.

**6. Consumidores que podrían romperse:** los tres. Medido por eliminación:

```
A) RLS + solo política de INSERT ........... upsert 42501
B) + política de UPDATE .................... upsert 42501
C) + política de SELECT .................... upsert OK
```

`INSERT ... ON CONFLICT DO UPDATE` necesita **ver** la fila en conflicto: sin política de SELECT
falla aunque INSERT y UPDATE estén permitidos. Es la quinta aparición de la regla del `RETURNING`,
y la primera sobre un upsert.

**7. ¿Hace falta UPDATE? Sí, y está demostrado**, no supuesto: sin ella el upsert de
`updateTherapistProfile:115` falla. No es una política "por si acaso".

**8. ¿Hace falta DELETE? No.** Ningún consumidor borra y la ACL ya lo cierra.

**9. ¿Hace falta política para el admin? Sí, para no perder una capacidad que hoy existe.** Medido:
con una política de UPDATE limitada a `auth.uid() = profile_id`, **el admin deja de poder verificar**
(0 filas). Hoy puede, porque el trigger se lo permite explícitamente. Aviso: **ninguna pantalla usa
esa capacidad**; se preservaría el backend, no una funcionalidad visible.

**10. ¿`security_invoker` en alguna vista? No.** Cero vistas proyectan esta tabla. Tampoco hay
Realtime. Ninguno de los dos problemas de `content_items` y `messages` aplica aquí.

### Políticas mínimas propuestas

```sql
-- 1. Lectura: paridad exacta con hoy. Es un directorio público por diseño de ACL.
CREATE POLICY "Anyone reads therapist profiles"
  ON public.therapist_profiles FOR SELECT TO anon, authenticated
  USING (true);

-- 2. Alta: solo un terapeuta, y solo su propia fila.  <-- LO ÚNICO QUE RLS APORTA
CREATE POLICY "Therapists create their own professional profile"
  ON public.therapist_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id AND public.get_my_role() = 'therapist');

-- 3. Edición: el titular o el admin. Necesaria para el upsert.
CREATE POLICY "Owners and admins update professional profiles"
  ON public.therapist_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = profile_id OR public.get_my_role() = 'admin');
```

Sin `DELETE`. Sin `FORCE`. Sin tocar ACL, triggers ni funciones.

| Política | Op | Cubre | Habilita | Sigue bloqueado | Trigger que complementa | Riesgo que elimina | Regresión posible |
|---|---|---|---|---|---|---|---|
| 1 | SELECT | `:90`, `:141`, el `RETURNING` de `:115` | anon y authenticated | — | — | ninguno: es paridad | **sin ella el upsert falla** |
| 2 | INSERT | `:115` cuando no hay fila | terapeuta a nombre propio | **paciente**, y crear a nombre ajeno (ya lo hacía el trigger) | el trigger sigue comprobando propiedad y `verified` | **auto-registro como profesional** | si un terapeuta nuevo no tuviera `role='therapist'` aún, no podría darse de alta |
| 3 | UPDATE | `:115` cuando la fila existe | titular y admin | terapeuta ajeno | el trigger sigue reservando `verified` al admin | — | **sin ella el upsert falla**; sin la rama de admin, el admin pierde la verificación |

Medido con estas tres: el paciente recibe `42501` al intentar darse de alta; **un terapeuta sin fila
previa sí se da de alta**; el trigger sigue devolviendo `THERAPIST_PROFILE_VERIFIED_ADMIN_ONLY`.

---

## Fase 8 — Criterios de parada

Los catorce, evaluados uno a uno:

| # | Criterio | Estado |
|---|---|---|
| 1 | ¿La creación legítima no es expresable en RLS? | **No se activa.** Medido: el terapeuta sin fila se da de alta con la política 2 |
| 2 | ¿UPDATE no definido por el diagnóstico? | **No se activa.** La necesidad está demostrada por eliminación |
| 3 | ¿Algún consumidor necesita DELETE? | **No se activa.** Ninguno borra |
| 4 | ¿El admin requiere acceso no documentado? | **No se activa**, pero se señala: su capacidad de verificar está documentada en el propio trigger; **ninguna pantalla la usa** |
| 5 | ¿Lectura pública con sensibilidad poco clara? | **No se activa** para RLS: la propuesta es paridad. `license_number` queda anotado como cuestión de ACL, no de RLS |
| 6 | ¿`listTherapists()` depende de una vista DEFINER? | **No.** Acceso directo PostgREST, sin función intermedia |
| 7 | ¿Alguna vista esquiva RLS? | **No.** Cero vistas proyectan la tabla |
| 8 | ¿Realtime sobre la tabla? | **No.** Cero publicaciones |
| 9 | ¿Dependencia no documentada? | Las dos FK entrantes quedan documentadas; las comprobaciones de FK no pasan por RLS |
| 10 | ¿Algún `0 filas` sin causa distinguible? | **No.** Todos aislados |
| 11 | ¿Hay que modificar `auth.users`? | **No.** Se usó el ascenso temporal de rol, revertido |
| 12 | ¿Hay que modificar una función? | **No** |
| 13 | ¿`verified`/`active` con semántica distinta de la asumida? | **Parcialmente sí, y se reporta:** `active` lo controla el terapeuta, `verified` solo el admin, y `listTherapists()` filtra únicamente `active` pese a que el índice del directorio es `(active, verified)`. **Es un defecto preexistente de frontend; no lo corrijo ni lo escondo tras RLS** |
| 14 | ¿El paciente debe leer por razón no documentada? | **No.** Lee para el matching, documentado |

**Ninguno bloquea el diseño.**

---

## Fase 9 — Aprobación

**Riesgo medido:** un `authenticated` cualquiera puede crear su propio `therapist_profiles` con
`active=true` y un `license_number` inventado. Ninguna capa lo impide. La fila entra en el resultado
SQL de `listTherapists()` y satisface las dos FK entrantes. **No alcanza al paciente por la
aplicación**, porque el matching filtra `verified` en JS.

**Modelo de acceso:** leen todos (directorio público, paridad); crea solo un terapeuta a nombre
propio; edita el titular o el admin; nadie borra.

**Controles que siguen siendo del trigger, y que RLS no duplica:** propiedad en la edición,
inmutabilidad de `profile_id`, y `verified` reservado al admin.

**Invariantes que deben permanecer:** ACL, triggers, funciones, FK, índices, vistas, datos
(`5f6308f0…`), frontend, RPC, Realtime. Solo deben moverse estado RLS y políticas.

**No se ha aplicado nada.** A la espera de aprobación explícita para pasar a backup y migración.

---

---

## Cierre — aplicado el 13 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260813_therapist_profiles_rls.sql`, con backup en
`backups/20260813_pre_therapist_profiles_rls.sql`. **RLS 23 → 24 de 37; políticas 80 → 83.**
Las tres políticas exactamente como se diagnosticaron, incluida la rama de admin en el UPDATE.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Therapist Profiles — RLS»*.

**Lo que este diagnóstico anticipó y se confirmó:** el paciente ya no puede darse de alta (`42501`),
el terapeuta sin fila previa sí (`OK`), el trigger sigue aplicando propiedad y `verified`, la lectura
sigue pública y el upsert funciona con las tres políticas.

**Un límite del diseño que el diagnóstico no había previsto:** el **upsert del admin sobre una fila
ajena falla** con `42501`, porque en `ON CONFLICT DO UPDATE` Postgres evalúa primero el `WITH CHECK`
del INSERT y el admin no es titular ni terapeuta. **No rompe ningún consumidor** —nadie hace upsert
sobre fila ajena; `updateTherapistProfile` siempre usa el `profile_id` de la sesión— y la vía del
admin para verificar es un `UPDATE` plano, que funciona. Queda como límite medido, no como fallo.

## Estado del diagnóstico

```
RLS activo: 23/37 · FORCE: 0/37 · políticas: 80
ACL: sin cambios · triggers: sin cambios · FK: sin cambios · funciones: sin cambios
índices: sin cambios · vistas: sin cambios · datos permanentes: sin cambios
frontend: sin cambios · RPC: sin cambios · Realtime: sin cambios · commits: 0
```

**Artefactos de prueba, todos revertidos:** ascender temporalmente a `therapist` un paciente sin
perfil, para medir el alta legítima de un terapeuta nuevo; crear y borrar filas de prueba; activar
y desactivar RLS con políticas temporales dentro de la transacción.

**Error de guion, no del sistema:** la primera medición de Fase 6 salió contaminada porque una
prueba anterior había puesto `active=false` en la misma fila. Se repitió aislada y el resultado
correcto es el de arriba.
