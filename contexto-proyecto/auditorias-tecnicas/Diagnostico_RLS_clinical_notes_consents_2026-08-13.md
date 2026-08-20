# Diagnóstico RLS — `clinical_notes` + `clinical_consents`

**Fecha:** 2026-08-13
**Alcance:** diagnóstico. **Sin migración, sin backup, sin políticas, sin RLS.** No se modificó ACL,
triggers, funciones, FK, índices, vistas, frontend ni datos. Todas las mediciones dentro de
transacciones revertidas con `RAISE EXCEPTION`.

**Baseline al abrir y al cerrar — idéntico.** 37 tablas · RLS 20/37 · FORCE 0/37 · 70 políticas ·
41 triggers · 273 funciones · 62 FK · 2 vistas. Las 8 huellas coinciden:
ACL `c9a0182c…` · políticas `6c93061f…` · FK `cfb70692…` · índices `6da61f8c…` ·
triggers `3ca1288a…` · funciones `e5e288e7…` · estado RLS `77b8c091…` · vistas `61114ef9…`.

---

## 1. Causa y riesgo actual

Ambas tablas: **RLS `false`, FORCE `false`, 0 políticas, owner `postgres`.**
ACL idéntica en las dos: `authenticated = arwm` (lee, inserta, actualiza; **sin DELETE**),
`anon` **sin ningún privilegio**, `service_role = arwdDxtm`.

**Ninguna función de la base —de ningún esquema— menciona estas dos tablas.** El acceso es
exclusivamente directo desde React vía PostgREST. Eso significa que **el límite del sprint 4Q no les
aplica**: aquí RLS no es una capa decorativa por encima de RPC `SECURITY DEFINER`, es la única puerta.
Es la misma situación que hizo del Grupo 1 un buen primer paso.

### `clinical_notes` — 24 filas, la fuga más grave que queda en la base

Medido con lecturas limpias, sin escrituras previas que contaminen los conteos:

```
                          todas   del propietario   soap_data ajenos
paciente PROPIETARIO ....  24      6                 18    <<< lee 18 historias ajenas
paciente AJENO ..........  24      6                  6    <<< historia clínica de otro
terapeuta ASIGNADO ......  24      6                  -    legítimo: son sus 4 pacientes
terapeuta AJENO .........  24      6                  -    <<< FUGA: 0 pacientes asignados
ADMIN ...................  24      -                  -    abre la ficha del paciente
anon ....................  42501 permission denied  (lo corta la ACL, no RLS)
```

**Cualquier usuario con sesión lee las 24 notas clínicas de los 4 pacientes, con `soap_data` y
`treatment_plan` completos.** Eso es la historia clínica: subjetivo, objetivo, análisis, plan.
No es un dato comercial como el de `content_items` — **es el dato más sensible de la plataforma**, y
está expuesto a todo el que tenga una cuenta.

**Y hay un segundo agujero, de integridad, que no se cierra con el trigger existente:**

```
paciente crea nota FIRMADA a nombre de su terapeuta ... NADA. Se crea.
terapeuta AJENO crea una nota a un paciente que no es suyo ... OK
```

`clinical_notes` **no tiene trigger de autoría** (`clinical_consents` sí). Un paciente puede insertar
una nota clínica con `is_signed = true`, `signed_at = now()` y `therapist_id` apuntando a su
terapeuta: un documento clínico falsificado, firmado electrónicamente a nombre de un profesional que
no lo escribió. Nada en la base lo impide hoy.

### `clinical_consents` — 2 filas, fuga de lectura; la escritura ya está cubierta

```
paciente AJENO, todos ......  2 de 2   <<< ve quién ha consentido y cuándo
paciente PROPIETARIO, el suyo 1        legítimo: getCurrentConsent
terapeuta ASIGNADO .........  1        legítimo: getClinicalConsentStateById
terapeuta AJENO ............  1        <<< FUGA
anon .......................  42501 permission denied (ACL)
```

La escritura **ya está gobernada** por `enforce_clinical_consent_authorship` (`BEFORE INSERT OR UPDATE`,
`SECURITY DEFINER`):

```
paciente AJENO, UPDATE revocando el consentimiento de otro ... P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
paciente AJENO, INSERT a nombre de otro ...................... P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
paciente AJENO, INSERT propio + RETURNING .................... OK  (acceptClinicalConsent)
```

Ese trigger ya expresa la regla correcta y la deja escrita en el código: *«consentir es un acto
personal e indelegable»*, el admin puede corregir pero no otorgar. **La única exposición real es la
lectura.**

La fuga es menor en volumen pero no trivial: revela **qué personas están en proceso clínico**, que es
información de salud aunque el registro no contenga contenido clínico.

### Aislamientos — qué NO es mérito ni culpa de RLS

Aplicando la regla de no etiquetar cualquier denegación como problema de RLS:

1. **`P0001 INMUTABILIDAD_CLINICA` al editar una nota no es control de acceso.** El mismo `UPDATE`,
   hecho por **el terapeuta autor**, falla igual. `check_clinical_note_immutability` frena a todo el
   mundo por igual cuando `OLD.is_signed = true`. Y **las 24 notas reales están firmadas**: hoy
   ninguna nota existente es editable por nadie. Ese trigger seguirá haciendo su trabajo con o sin RLS.
2. **El `42501` del `DELETE` es de ACL**, no de RLS ni del trigger: `authenticated` no tiene `d` en
   ninguna de las dos tablas. Consecuencia curiosa y conviene saberla:
   **`enforce_clinical_consent_no_delete` nunca llega a ejecutarse para `authenticated`** — lo corta
   la ACL antes. El trigger es la red de seguridad para `service_role` y `postgres`.
3. **El `42501` de `anon` también es de ACL.** `anon` no tiene ningún privilegio sobre estas tablas.
   Activar RLS no cambia nada para `anon`; ya está fuera.

### Un artefacto de prueba y una contaminación, documentados

- **No se puede crear un perfil de prueba:** `profiles.id` referencia `auth.users`, así que el
  `INSERT` falla con `23503`. Para poder medir el actor «terapeuta ajeno» —en los datos reales
  **solo existe un terapeuta**— se ascendió temporalmente a `therapist` un paciente sin notas ni
  relaciones. Revertido.
- **Primera pasada contaminada:** mis propios `INSERT` inflaron las lecturas posteriores (7 en vez de
  6, 26 y 27 en vez de 24). Se repitió la batería con las lecturas antes que las escrituras; las
  cifras de arriba son las limpias.
- El primer intento de sembrar falló con `22P02` porque dejé `request.jwt.claims` vacío y
  `enforce_profile_ownership` lo parsea como JSON. Mismo artefacto que ya apareció en el Grupo 3A.

---

## 2. Consumidores afectados

**13 en total. Cero Edge Functions, cero RPC, cero `SECURITY DEFINER` que las toque.**

### `clinical_notes` — 7 consumidores, **todos de terapeuta o admin**

| Consumidor | Op | Quién lo ejecuta |
|---|---|---|
| `clinicalService.ts:30` `getLatestNote` | SELECT `*` | ClinicalReportModal (terapeuta) |
| `clinicalService.ts:42` `getSignedNotesHistory` | SELECT | ClinicalReportModal |
| `clinicalService.ts:67` `saveClinicalNote` (update) | UPDATE | ClinicalReportModal |
| `clinicalService.ts:68` `saveClinicalNote` (insert) | INSERT **sin `.select()`** | ClinicalReportModal |
| `patientOverviewService.ts:70` `getPatientDocuments` | SELECT por `patient_id` | `pacientes.$patientId` |
| `patientOverviewService.ts:184` `saveClinicalDocument` (update) | UPDATE | ClinicalDocumentModal |
| `patientOverviewService.ts:185` `saveClinicalDocument` (insert) | INSERT **sin `.select()`** | ClinicalDocumentModal |

**Ningún consumidor muestra al paciente sus propias notas.** La ruta `pacientes.$patientId.tsx:134`
se guarda a `therapist | admin` — **pero en el frontend**, que es exactamente lo que RLS vendría a
respaldar con una barrera real.

Detalle relevante para el diseño: **ninguno de los dos `INSERT` usa `.select()`**, así que aquí *no*
aplica la regla del `RETURNING` que mordió en `appointments`, `public_test_submissions` y
`content_items`. Aun así conviene una política de SELECT por otro motivo (ver §5).

### `clinical_consents` — 6 consumidores, **mixtos paciente / terapeuta**

| Consumidor | Op | Quién lo ejecuta |
|---|---|---|
| `clinicalConsentService.ts:59` `getCurrentConsent` | SELECT `*` | base de los tres siguientes |
| `:115` `acceptClinicalConsent` (reactivar) | UPDATE | el paciente, `consentimiento-clinico.tsx` |
| `:123` `acceptClinicalConsent` (alta) | INSERT | el paciente |
| `:138` `revokeClinicalConsent` | UPDATE | el paciente, `ClinicalConsentCard` |
| `getClinicalConsentState(profile)` | SELECT | el paciente: gate de `useAuth.tsx:124` |
| `getClinicalConsentStateById(patientId)` | SELECT | **terapeuta y admin**, `pacientes.$patientId:109` |

El último es el que impide copiar el modelo de `clinical_notes`: **hay una lectura cruzada legítima**
—el terapeuta comprueba de un vistazo que el consentimiento del paciente existe y sigue vigente— y
también la hace el admin.

---

## 3. Modelo de autorización recomendado

**No son el mismo modelo, y la diferencia no es de matiz.** `clinical_notes` es un documento
*del profesional sobre el paciente*: dos partes, y el autor no es el titular del dato.
`clinical_consents` es un acto *del paciente*: una sola parte, y el titular es el único que puede
ejecutarlo.

### `clinical_notes`

| Acción | Quién | Por qué |
|---|---|---|
| Leer | **terapeuta asignado + admin** | son los únicos consumidores que existen |
| Crear | **terapeuta asignado, y solo a nombre propio** | cierra la falsificación de notas firmadas |
| Modificar | **el terapeuta autor** (y el trigger sigue bloqueando lo firmado) | el autor responde de su documento |
| Borrar | **nadie** | ya lo impide la ACL; el flujo clínico no borra |
| Excluidos | **`anon` y todos los pacientes** | ver la decisión de abajo |

> ⚠️ **Esto es una decisión de producto, no técnica, y necesita aprobación explícita.**
> Hoy un paciente **puede** leer sus 6 notas por acceso directo, aunque **ninguna pantalla se las
> muestre**. Cerrarlo **no rompe ningún consumidor** —está medido— pero cambia lo que la base
> permite. Mi recomendación es cerrarlo: lo que existe hoy no es una funcionalidad de acceso a la
> historia clínica sino un camino no diseñado a un `jsonb` crudo, sin contexto ni acompañamiento
> profesional. Si el producto quiere darle al paciente acceso a su historia —que es un derecho— debe
> ser una función deliberada y curada, no un efecto colateral de la ACL. **No estoy dando una opinión
> legal**; la decisión sobre cómo se ejerce ese derecho es tuya y, si toca, de asesoría jurídica.

### `clinical_consents`

| Acción | Quién | Por qué |
|---|---|---|
| Leer | **el paciente titular + su terapeuta asignado + admin** | `getClinicalConsentStateById` es una lectura cruzada legítima |
| Crear | **solo el titular, a nombre propio** | consentir es indelegable — el trigger ya lo dice |
| Modificar | **el titular + admin** (soporte) | el trigger ya lo aplica; la política sería segunda capa |
| Borrar | **nadie** | ACL + trigger; no se borra, se revoca |
| Excluidos | **`anon`, pacientes ajenos, terapeutas no asignados** | |

---

## 4. Políticas mínimas propuestas

**No se crean en este sprint.** Redacción tentativa, para discutir:

### `clinical_notes` — 4 políticas

```sql
-- lectura: terapeuta asignado
CREATE POLICY "Therapists read notes of assigned patients"
  ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.is_therapist_of(patient_id));

-- lectura: admin
CREATE POLICY "Admins read all clinical notes"
  ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- alta: solo el terapeuta asignado y a nombre propio  <-- cierra la falsificación
CREATE POLICY "Therapists create notes for assigned patients"
  ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = therapist_id AND public.is_therapist_of(patient_id));

-- edición: solo el autor (el trigger sigue bloqueando lo firmado)
CREATE POLICY "Authoring therapists update their own notes"
  ON public.clinical_notes FOR UPDATE TO authenticated
  USING (auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = therapist_id);
```

Sin política de DELETE: la ACL ya lo cierra.

**`is_therapist_of()` sirve tal cual y no hay que tocarla.** Es `SECURITY DEFINER` de `postgres`, así
que la política no falla con `42501` al consultar `patient_therapist` —la lección del Grupo 0—, y
**no filtra por `status`**: un terapeuta conserva el acceso a las notas de un paciente dado de alta,
que es lo correcto para la conservación de la historia clínica. Medido: las 4 relaciones existentes
están `active`, así que el caso `finished`/`cancelled` **no está ejercitado por los datos**; lo cubre
el diseño de la función, no una medición.

### `clinical_consents` — 4 políticas

```sql
CREATE POLICY "Patients read their own consent"
  ON public.clinical_consents FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

CREATE POLICY "Therapists read consent of assigned patients"
  ON public.clinical_consents FOR SELECT TO authenticated
  USING (public.is_therapist_of(patient_id));

CREATE POLICY "Admins read all consents"
  ON public.clinical_consents FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Patients record their own consent"
  ON public.clinical_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients and admins update consent"
  ON public.clinical_consents FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = patient_id OR public.get_my_role() = 'admin');
```

(Son 5, no 4 — la de UPDATE se separa de la de INSERT.) Las de escritura **duplican** lo que ya hace
`enforce_clinical_consent_authorship`. Es defensa en profundidad deliberada, no redundancia por
descuido: si algún día se retira o se modifica el trigger, la barrera no desaparece con él.

---

## 5. Riesgos de regresión

| Riesgo | Evaluación |
|---|---|
| **`is_therapist_of()` exige fila en `patient_therapist`** | 0 notas y 0 consentimientos huérfanos hoy. Pero un terapeuta que cree una nota **antes** de que exista la relación recibiría `42501`. Hay que confirmar que el flujo real siempre crea la relación primero |
| **El admin sin política quedaría fuera** | `pacientes.$patientId` es de `therapist|admin`; sin la política de admin, la ficha se vería vacía **sin error** |
| **Los `UPDATE` sin política devuelven 0 filas en silencio** | el patrón que ya mordió en `appointments`, `clinical_alerts` y `content_items`. Aquí afecta a `saveClinicalNote` y a `revokeClinicalConsent` |
| **`RETURNING`** | los 2 `INSERT` de `clinical_notes` **no** usan `.select()`; el de `clinical_consents` **sí** (`acceptClinicalConsent`) — necesita política de SELECT además de la de INSERT |
| **Cerrar la lectura al paciente en `clinical_notes`** | 0 consumidores afectados, medido. El riesgo es de producto, no técnico |
| **El trigger de auditoría** | `audit.audit_clinical_note_changes` es `AFTER UPDATE`, `SECURITY DEFINER` de `postgres`, y escribe en `audit.clinical_logs`. No lo afecta RLS sobre `public.clinical_notes` |
| **`service_role`** | tiene `bypassrls`; las Edge Functions y los seeders no se ven afectados |
| **`anon`** | sin privilegios sobre ninguna de las dos. RLS no le cambia nada |

---

## 6. Objetos que habría que modificar

**Solo dos, y solo de dos maneras:**

```
public.clinical_notes ....... ALTER TABLE ... ENABLE ROW LEVEL SECURITY  +  4 políticas
public.clinical_consents .... ALTER TABLE ... ENABLE ROW LEVEL SECURITY  +  5 políticas
```

**Nada más.** No hace falta crear ni modificar funciones (`is_therapist_of` y `get_my_role` ya
existen y ya se usan en otras políticas), ni tocar ACL, triggers, FK, índices, vistas, RPC, Edge
Functions ni frontend. **Ninguna vista proyecta estas tablas**, así que no se repite el problema de
`content_items_meta`.

---

## 7. Invariantes que deben permanecer intactos

- **Filas:** `clinical_notes` = 24, `clinical_consents` = 2. Ningún dato tocado.
- **Huella ACL** `c9a0182c…`, **FK** `cfb70692…`, **índices** `6da61f8c…`, **triggers** `3ca1288a…`,
  **funciones** `e5e288e7…`, **vistas** `61114ef9…` — las seis deben quedar idénticas.
- Solo deben moverse **estado RLS** (`77b8c091…`) y **políticas** (`6c93061f…`).
- **41 triggers, 273 funciones, 62 FK, 2 vistas, 37 tablas.**
- Los 5 triggers de estas dos tablas siguen existiendo y comportándose igual: `INMUTABILIDAD_CLINICA`
  debe seguir frenando la edición de una nota firmada **incluso al autor**, y
  `CLINICAL_CONSENT_AUTHOR_MISMATCH` debe seguir apareciendo con RLS activo.
- El terapeuta asignado debe seguir leyendo **6 notas** por paciente y **24** en total; el admin, 24.

---

## Cómo dividirlo en sprints — recomendación

**Dos sprints separados**, porque los modelos son distintos y porque uno de los dos depende de una
decisión de producto que el otro no necesita.

**Sprint A — `clinical_notes` (primero).** Es la fuga más grave que queda en la base: historias
clínicas completas legibles por cualquier usuario con sesión, y falsificación de notas firmadas
posible. Requiere resolver antes **una sola pregunta**: si el paciente conserva o no la lectura de
sus propias notas.

**Sprint B — `clinical_consents` (después).** Más pequeño y sin decisiones pendientes: la escritura ya
está resuelta por trigger y solo hay que cerrar la lectura. Se beneficia de que el A haya validado
antes el patrón `is_therapist_of` + admin sobre una tabla clínica.

**No los juntaría**, pese a que las migraciones serían cortas: los modelos difieren, los consumidores
difieren y mezclarlos rompería la regla de un cambio por sprint que ha funcionado en los ocho
anteriores.

---

## Cierre parcial — `clinical_notes` aplicada el 13 de agosto de 2026

El diseño se aprobó y **el Sprint A está hecho**: `20260813_clinical_notes_rls.sql`, backup en
`backups/20260813_pre_clinical_notes_rls.sql`. **RLS 20 → 21 de 37; políticas 70 → 74.**
La decisión de producto se resolvió cerrando la lectura del paciente.

La crónica completa —baseline de 22 criterios, las dos fugas cerradas con cifras antes/después, la
batería de los seis actores, los aislamientos RLS/trigger/ACL, invariantes y round-trip— está en
`Blindaje_Seguridad_Contenido_2026-08-07.md`, sección *«Clinical Notes — RLS»*.

**Una precisión sobre la política de SELECT.** El prompt del sprint pedía
`auth.uid() = therapist_id AND is_therapist_of(patient_id)`, que **no** es lo que propone este
documento. Se midió antes de aplicar: esa variante no cierra ninguna fuga adicional —el terapeuta no
asignado ya recibe 0 con `is_therapist_of()` solo— y en cambio oculta al terapeuta, en silencio, las
notas de su propio paciente escritas por otro autor, porque `getPatientDocuments:70` filtra por
`patient_id` y no por autor. Se reportó y se confirmó la variante de este diagnóstico.

## Cierre completo — `clinical_consents` aplicada el 13 de agosto de 2026

**Sprint B hecho:** `20260813_clinical_consents_rls.sql`, backup en
`backups/20260813_pre_clinical_consents_rls.sql`. **RLS 21 → 22 de 37; políticas 74 → 79.**
Se aplicaron las 5 políticas propuestas en §4 sin cambios.

Crónica en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección *«Clinical Consents — RLS»*.

**Lo que este documento anticipó y se confirmó:** la única exposición real era la lectura; la
escritura ya la gobernaba `enforce_clinical_consent_authorship`; y `getClinicalConsentStateById`
—la lectura cruzada del terapeuta— era la razón para no copiar el modelo de `clinical_notes`.
Los 6 consumidores siguen funcionando.

**Un matiz que el diagnóstico no había previsto:** RLS se evalúa **antes** que el trigger, así que
las escrituras ajenas que antes devolvían `CLINICAL_CONSENT_AUTHOR_MISMATCH` ahora devuelven
**0 filas en silencio**. La protección sigue intacta —verificado con dos controles— pero cambia el
modo de fallo. No afecta al frontend, que lee antes de escribir.

**Las dos tablas clínicas quedan cerradas.** El plan de RLS del sprint 4Q no deja ninguna tabla
nombrada pendiente.
