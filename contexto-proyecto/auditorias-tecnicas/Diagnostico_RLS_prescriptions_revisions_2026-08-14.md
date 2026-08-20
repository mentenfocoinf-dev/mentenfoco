# Diagnóstico RLS — clinical_prescriptions + content_revisions

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se activó RLS, no se creó ninguna
política permanente, no se revocó nada, no se tocó ACL, triggers, funciones, FK, índices, vistas,
frontend, RPC, Realtime ni datos. Toda escritura se hizo dentro de transacciones con `ROLLBACK`
forzado y los **49 criterios del baseline** volvieron a OK al terminar.

**Estado global al terminar:** RLS 29/37 · FORCE 0/37 · 92 políticas · huellas ACL `050454ff…`,
POL `345c6ca6…`, RLS, triggers, funciones, FK, índices y vistas idénticas.

---

## 1. Baseline

**Los 49 criterios OK.**

```
                              clinical_prescriptions      content_revisions
relrowsecurity ...........    false                       false
relforcerowsecurity ......    false                       false
reloptions ...............    (NULL)                      (NULL)
owner ....................    postgres                    postgres
filas ....................    14                          0
columnas .................    4                           7
CHECK propios ............    0                           0
políticas ................    1                           0
triggers propios .........    0                           0
FK salientes .............    0                           2
FK entrantes .............    1                           0
índices ..................    1                           2
vistas dependientes ......    0                           0
Realtime / Broadcast .....    0                           0
funciones que la citan ...    0                           1
huella de datos ..........    61a83e35…                   (VACÍA)
```

**Las dos comparten ACL, letra por letra:**

```
anon            -------m       (solo MAINTAIN)
authenticated   raw----m       SELECT + INSERT + UPDATE + MAINTAIN
service_role    rawdDxtm
postgres        rawdDxtm

ACL literal (idéntica en ambas):
  postgres=arwdDxtm/postgres, anon=m/postgres, authenticated=arwm/postgres, service_role=arwdDxtm/postgres
```

**Grants por columna** — reproducen los de tabla, no los recortan:

```
clinical_prescriptions  authenticated  SELECT/INSERT/UPDATE  x4 c/u   (12)
content_revisions       authenticated  SELECT/INSERT/UPDATE  x7 c/u   (21)
anon                    0 en ambas
```

**Columnas:**

```
clinical_prescriptions            content_revisions
  id                uuid            id                uuid
  titulo            text            content_item_id   uuid  -> content_items ON DELETE CASCADE
  objetivo_clinico  text            edited_by         uuid  -> profiles
  instruccion_pac.  text            previous_body     text
                                    previous_status   content_status
                                    note              text
                                    created_at        timestamptz
```

**La política existente en `clinical_prescriptions`, hoy inerte porque RLS está apagado:**

```
"Authenticated users read the prescription catalog"  SELECT · PERMISSIVE · TO authenticated · USING (true)
```

---

## 2. Modelo clinical_prescriptions

**Es un catálogo, y está confirmado por esquema, por datos y por migración.**

Origen: `20240514_b2b_clinical_prescriptions.sql`, bajo el título literal
*«2. Catálogo de Prescripciones Clínicas»*, junto a `psychometric_evaluations` y
`patient_prescriptions`.

Las 14 filas son **plantillas de ejercicio terapéutico**, no prescripciones de nadie:

```
Activación Conductual Matutina          Identificación de Valores Fundamentales
Caja de Herramientas de Tolerancia      Inventario de Gratitud
Defusión Cognitiva ("El pasajero")      Programación del Tiempo de Preocupación
Economía de Fichas (Crianza)            Registro de Pensamientos Automáticos
Experimento Conductual                  Respiración Diafragmática (4-7-8)
Exposición Gradual Imaginada            Técnica de Grounding (5-4-3-2-1)
Higiene del Sueño Estricta              Tiempo Fuera (Timeout) en Pareja
```

Cada una con `objetivo_clinico` (*«Manejo de crisis de desregulación emocional intensa»*,
*«Modificación conductual infantil / TDAH»*) e `instruccion_paciente` (*«Cuando la angustia llegue a
9/10, cambia tu temperatura…»*).

**Verificado contra el criterio de parada #1:**

- columnas de identidad (`patient|therapist|user|author|owner`): **0**
- columnas de fecha, plan, tipo, duración o repeticiones: **0**
- FK salientes: **0**

**No es una instancia de prescripción individual.** La instancia vive en `patient_prescriptions`,
que sí tiene `patient_id`, `therapist_id`, `prescription_id`, `assigned_at`, `completed`, **RLS
activo y 4 políticas** por `patient_id` / `therapist_id`.

> El sprint del Grupo 0 (`20260812_grupo0_preparacion_politicas.sql`) ya dejó escrita esta
> corrección: *«CORRECCIÓN de lo afirmado en el informe del sprint 4Q, que la había clasificado como
> peligrosa y recomendaba borrarla. Es un error: la tabla NO contiene datos de pacientes.»*
> Este diagnóstico lo vuelve a confirmar, ahora leyendo las 14 filas.

**Quién debería leer:** cualquier usuario autenticado —el terapeuta para asignar, el paciente para
leer lo que le asignaron—. **Quién debería crear, editar o eliminar:** solo el sistema. Es contenido
profesional curado, no generado por el cliente.

---

## 3. Consumidores clinical_prescriptions

| Archivo:línea | Función | Operación | Actor | Filtros | `.select()`/RETURNING |
|---|---|---|---|---|---|
| `clinicalService.ts:200` | `getPrescriptionsCatalog` | SELECT `*`, `order(titulo)` | terapeuta (`TherapistDashboard:127`) | ninguno | — |
| `clinicalService.ts:224` | `getPatientPrescriptions` | **SELECT vía embed** | **paciente** (`PatientDashboard:117`) | `.eq("patient_id", …)` sobre la tabla padre | — |

**INSERT, UPDATE, DELETE, upsert, RPC, Edge Functions, scripts: cero.** Nadie escribe este catálogo
desde el producto.

### Cómo resuelve PostgREST el embed, medido

```js
supabase.from("patient_prescriptions")
  .select(`id, assigned_at, completed,
           prescription:clinical_prescriptions (titulo, objetivo_clinico, instruccion_paciente)`)
  .eq("patient_id", patientId)
```

PostgREST lo resuelve como **una sola consulta con join sobre la tabla embebida, ejecutada con el rol
de quien llama**. Consecuencias, las tres verificadas:

1. **Necesita `SELECT` sobre `clinical_prescriptions` a nivel de tabla.** La ACL ya lo concede.
2. **RLS sobre el padre embebido SÍ alcanza al embed.**
3. Como es un `LEFT JOIN`, si RLS filtra la fila del catálogo **el resultado no da error: devuelve el
   título a `NULL`**. Fallo silencioso.

Simulado dentro de transacción revertida, sembrando 1 asignación:

```
A) HOY, RLS apagado ................................. 1 fila con título e instrucción
B) RLS ACTIVO conservando la política del Grupo 0 ... 1 fila con título e instrucción   NO ROMPE
C) RLS ACTIVO y SIN ninguna política ................ 0 filas   <<< ROMPE, en silencio
   lectura directa del catálogo en ese estado ....... 0 filas   (baseline 14)
```

> **Error de guion mío, y lo declaro.** Mi primera versión del caso C devolvió `1 fila` y yo había
> etiquetado el resultado esperado como `0`. La causa: **olvidé que la tabla ya tiene la política
> real del Grupo 0**, que quedó activa al encender RLS; solo había borrado la mía de prueba. Nunca
> llegué a probar el caso «sin política». Repetido quitando también la real: **0 filas**. El
> resultado de arriba es el de la segunda pasada.

**Conclusión operativa: la política del Grupo 0 es imprescindible.** Encender RLS conservándola no
rompe nada; quitarla rompería el `PatientDashboard` sin un solo error en consola.

---

## 4. Protección actual clinical_prescriptions

Con RLS apagado, leyendo columnas reales:

```
actor            clinical_prescriptions          content_revisions
paciente         14 filas                        0 filas
pac. ajeno       14 filas                        0 filas
terapeuta        14 filas                        0 filas
admin            14 filas                        0 filas
anon             42501 permission denied — ACL   42501 permission denied — ACL
service_role     14 filas                        0 filas   bypassrls
```

Escritura:

```
actor          INSERT              UPDATE                DELETE
paciente       SE CREA  <<<        MODIFICA  <<<         42501 ACL
terapeuta      SE CREA  <<<        MODIFICA  <<<         42501 ACL
admin          SE CREA  <<<        MODIFICA  <<<         42501 ACL
anon           42501 ACL           42501 ACL             42501 ACL
```

> Los conteos de filas modificadas crecieron (15, 16, 17) porque **mis propios INSERT se iban
> acumulando dentro de la transacción**. El baseline es 14 y volvió a 14. No es un dato del sistema.

**Un paciente puede modificar las cuatro columnas**: `id`, `titulo`, `objetivo_clinico` e
`instruccion_paciente`. Los grants por columna no recortan nada.

---

## 5. Riesgo clinical_prescriptions

Prueba reversible sobre una plantilla concreta:

```
1) instrucción ACTUAL de "Activación Conductual Matutina":
   "Mañana, independientemente de cómo te sientas, levántate a las 8:00 AM, tiende la cama y camina…"

2) el paciente 141e54fe la reescribe .... 1 fila MODIFICADA por un PACIENTE

3) instrucción AHORA:
   "ZZ: deja de tomar tu medicacion y no vayas a la consulta."

4) revertida al valor original dentro de la misma transacción ... idéntica
```

**Ese texto es exactamente lo que el paciente lee en su `PatientDashboard`** a través del embed de
§3, presentado como la indicación de su terapeuta. Y afecta a **todos los pacientes** a quienes se
haya asignado esa plantilla, no solo a quien la modificó.

**Qué capa debería haberlo impedido:**

```
ACL ......... authenticated tiene UPDATE sobre las 4 columnas    NO lo impide
RLS ......... apagado, y su única política es de SELECT          NO lo impide
trigger ..... no hay ninguno                                     NO lo impide
constraint .. 0 CHECK                                            NO lo impide
>>> NINGUNA CAPA
```

**El problema es de ACL, no de RLS.** Y lo confirmé midiendo la alternativa: con RLS activo y solo la
política de SELECT, el mismo `UPDATE` da **0 filas modificadas** — RLS sí lo cierra, **pero dejando
el privilegio puesto en la ACL**. Las dos cosas no son equivalentes: una quita el permiso, la otra lo
tapa.

**Nivel de riesgo: MEDIO.** No es fuga —el catálogo no identifica a nadie— pero sí **manipulación de
contenido clínico que llega al paciente como indicación de su profesional**. Que no se haya
explotado no lo hace menos real: no hay ninguna barrera.

---

## 6. Modelo recomendado clinical_prescriptions

**Categoría: C) catálogo visible para autenticados, editable solo por el sistema.**

No es A —`anon` no lo lee ni debe, y su ACL ya lo cierra— ni B a secas, porque el punto no es quién
lee sino quién escribe.

| Operación | anon | paciente | terapeuta | admin | service_role |
|---|---|---|---|---|---|
| SELECT | denegado — ACL | **permitido** | **permitido** | **permitido** | permitido |
| INSERT | denegado — ACL | **denegado** | **denegado** | **denegado** | permitido |
| UPDATE | denegado — ACL | **denegado** | **denegado** | **denegado** | permitido |
| DELETE | denegado — ACL | denegado — ACL | denegado — ACL | denegado — ACL | permitido |

### Mecanismo: REVOKE **y** RLS, en ese orden de importancia

**Lo digo explícitamente porque el prompt lo pide: aquí el REVOKE es la corrección; RLS es la
defensa en profundidad.**

- `REVOKE INSERT, UPDATE ON public.clinical_prescriptions FROM authenticated;` — **quita el
  privilegio de raíz.** Es lo que faltaba desde 2024.
- `SELECT` **se conserva**: lo necesitan `getPrescriptionsCatalog()` y, sobre todo, el embed del
  `PatientDashboard`.
- `ENABLE ROW LEVEL SECURITY` **conservando la política existente del Grupo 0**, sin crear ninguna
  nueva. Medido: el embed sigue devolviendo la fila.

**No hay que crear ninguna política.** La que hace falta ya está escrita desde el 12 de agosto.
Es el mismo patrón que `clinical_guides`: encender RLS y no añadir nada.

**Lo que no hay que hacer, y conviene dejarlo dicho:** copiar el modelo de `content_items`. Aquel es
contenido editorial con autoría, estado y plan; este es un catálogo de 4 columnas sin dueño. Una
política por autoría aquí no tendría sobre qué operar.

---

## 7. Modelo content_revisions

**Categoría: auditoría — y con una intención de producto escrita, nunca implementada.**

Origen: `20260724_content_items.sql`, con el propósito literal en el comentario:

> *«Historial de revisiones. Guarda el cuerpo previo cuando un admin edita lo que envió un terapeuta,
> **para que el autor pueda ver qué se le cambió**.»*

La misma migración dejó **comentado** el modelo de RLS previsto:

```sql
-- ALTER TABLE content_revisions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Revisions visible to author and admins" ON content_revisions
--   FOR SELECT USING (
--     get_my_role() = 'admin'::user_role
--     OR EXISTS (SELECT 1 FROM content_items c
--                WHERE c.id = content_revisions.content_item_id AND c.author_id = auth.uid())
--   );
```

**No es cache ni tabla de compatibilidad.** Es auditoría editorial. Pero **está vacía y nadie la
escribe**, así que hoy la garantía que promete —«el autor puede ver qué se le cambió»— no existe.

`enforce_content_authorization()` [DEFINER] la menciona, pero **solo en un comentario**: el trigger
que usa esa función está en `content_items`, verificado en `pg_trigger`. **`content_revisions` no
tiene ningún trigger.**

---

## 8. Consumidores content_revisions

**Cero consumidores ejecutables. Lo documento explícitamente, como pide la fase.**

```
src/                    0
Edge Functions (4)      0
scripts/ · cron         0
RPC                     0
funciones SQL           0 que la lean o escriban (1 la cita en un comentario)
vistas                  0
Realtime / Broadcast    0
FK entrantes            0
```

Las únicas apariciones en `supabase/` son la migración que la crea y seis migraciones de cierre de
privilegios (`20260806a`, `20260807b`, `20260807d`, `20260807_…`, `20260808_…`, `20260812_grupo2`).
Ninguna la escribe.

**Nada, en ningún punto del producto, inserta una fila en esta tabla.** La funcionalidad que
justificaba su existencia nunca se construyó.

---

## 9. Riesgo content_revisions

Medido con RLS apagado, en transacción revertida:

```
actor          operación                              resultado
paciente       INSERT con edited_by PROPIO            SE CREA
paciente       INSERT con edited_by AJENO             SE CREA  <<< a nombre del terapeuta
paciente       UPDATE de las revisiones               MODIFICA <<< reescribe la auditoría
paciente       DELETE                                 42501 — ACL
anon           INSERT                                 42501 — ACL
```

**Cualquier usuario autenticado puede fabricar una entrada de auditoría a nombre de otro y después
reescribirla.** Es el mismo patrón que se cerró en `journey_events`, con un agravante conceptual: un
registro de auditoría en el que cualquiera escribe a nombre de otro **no es un registro de
auditoría**.

**Qué capa lo permite: ninguna.** Sin trigger, sin CHECK, sin política, sin RLS. **ACL pura.**

**Nivel: MEDIO.** El impacto actual es cero —0 filas, 0 lectores— pero la tabla está declarada como
auditoría y hoy es falsificable por diseño.

### Las tres opciones, medidas

**A) REVOKE y conservar.** `REVOKE INSERT, UPDATE, SELECT ... FROM authenticated`. La tabla queda
inerte y lista para cuando se implemente la funcionalidad prometida. Sin RLS: **no habría privilegio
que filtrar**.

**B) RLS + REVOKE.** Simulado: con RLS activo y **sin ninguna política**, el INSERT ajeno da
`42501 new row violates row-level security policy` y el SELECT devuelve 0 filas. **Cierra la tabla
entera y no rompe nada, porque no hay consumidores.** Añade una capa sobre el REVOKE.

**C) DROP en sprint separado.** Defendible por estar vacía y sin consumidores — **pero no lo
recomiendo**, y no por su tamaño: **existe una intención de producto documentada** («que el autor
pueda ver qué se le cambió») con el modelo de RLS ya redactado en la migración. Eso la distingue de
`guides` y de `test_scores`, que no tienen ninguna promesa detrás. Borrarla sería descartar una
funcionalidad pendiente, no limpiar un vestigio.

---

## 10. Dependencias cruzadas

```
relación                     RLS    políticas  filas
patient_prescriptions        true   4          0
content_items                true   5          26
profiles                     true   5          8
clinical_guides              true   1          20
```

```
FK que SALEN de content_revisions:
  content_item_id -> content_items(id) ON DELETE CASCADE
  edited_by       -> profiles(id)
FK que ENTRAN a clinical_prescriptions:
  desde patient_prescriptions:  prescription_id -> clinical_prescriptions(id) ON DELETE CASCADE
```

- **La única dependencia que puede romper algo es el embed de §3**, y está medida: con la política
  del Grupo 0 conservada, no rompe.
- **Las FK no se ven afectadas por RLS**: la verificación de integridad referencial en Postgres no
  pasa por políticas.
- **Vistas: 0. Realtime/Broadcast: 0. Reglas: 0.**
- **`enforce_content_authorization` [DEFINER]** actúa sobre `content_items`, **no** sobre
  `content_revisions`. Verificado en `pg_trigger`. No hay ninguna RPC que contradiga el modelo.
- Ninguna de las dos tablas puede romper una tabla ya cerrada. El riesgo va en la otra dirección:
  encender RLS en `clinical_prescriptions` sin política rompería la lectura del hijo.

---

## 11. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | `clinical_prescriptions` no es realmente un catálogo | **No.** 4 columnas, 0 de identidad, 0 FK salientes, 14 plantillas leídas |
| 2 | Consumidor de escritura no documentado | **No.** 0 INSERT/UPDATE/DELETE en todo el repositorio |
| 3 | El catálogo necesita ser editable por el cliente por diseño | **No.** Ningún consumidor lo escribe |
| 4 | Un embed rompe con el modelo RLS | **No, con la política del Grupo 0 conservada.** Medido: 1 fila. Sin política: 0 y en silencio |
| 5 | `content_revisions` tiene un consumidor oculto | **No.** 0 en `src/`, Edge Functions, scripts, cron, RPC, funciones |
| 6 | `content_revisions` participa en auditoría exigida por producto | **PARCIAL — ver abajo** |
| 7 | Vista que esquiva RLS | **No.** 0 vistas en ambas |
| 8 | Realtime o Broadcast | **No.** 0 en ambas |
| 9 | RPC `SECURITY DEFINER` que contradice el modelo | **No.** `enforce_content_authorization` actúa sobre `content_items` |
| 10 | Decisión de producto necesaria | **SÍ — una, ver abajo** |
| 11 | `0 filas` ambiguo | **No.** Los `0` de `content_revisions` son tabla vacía con ACL concedida, distinguidos del `42501` de `anon` |
| 12 | `42501` ambiguo | **No.** Todos fueron `permission denied for table` (ACL); el único de RLS apareció en la simulación y decía `new row violates row-level security policy` |

### Criterio 6 y 10 — la promesa de `content_revisions`

**No bloquea el sprint, pero es una decisión que te corresponde.** La migración que la creó promete
que **el autor pueda ver qué se le cambió** y deja escrito el modelo de RLS para lograrlo. Esa
funcionalidad **no existe**: nadie escribe la tabla y nadie la lee.

La decisión no es técnica: **¿esa promesa sigue en pie?**

- **Si sigue en pie**, la tabla se conserva y se cierra ahora (REVOKE, con o sin RLS), quedando lista
  para cuando se construya el flujo.
- **Si se abandona**, entra en el mismo saco que `guides` y se propone su eliminación en el sprint de
  limpieza.

**Mi recomendación es conservarla**, porque a diferencia de `guides` y `test_scores` esta tabla tiene
una intención documentada y un modelo ya redactado — pero la promesa es tuya, no mía.

---

## 12. Sprints propuestos

**Dos tablas, un solo sprint, pero mecanismos distintos.** No comparten solución: comparten
diagnóstico.

### `clinical_prescriptions`

| Operación | Decisión | Mecanismo |
|---|---|---|
| **SELECT** | se conserva para `authenticated` | ACL sin cambios + política existente del Grupo 0 |
| **INSERT** | se cierra | **REVOKE** |
| **UPDATE** | se cierra | **REVOKE** |
| **DELETE** | ya cerrado | ACL, sin cambios |
| **REVOKE necesario** | **SÍ** | `REVOKE INSERT, UPDATE ... FROM authenticated` |
| **RLS necesario** | **SÍ, como defensa en profundidad** | `ENABLE ROW LEVEL SECURITY`, **0 políticas nuevas** |

### `content_revisions`

| Operación | Decisión | Mecanismo |
|---|---|---|
| **SELECT** | se cierra | **REVOKE** — nadie la lee |
| **INSERT** | se cierra | **REVOKE** |
| **UPDATE** | se cierra | **REVOKE** |
| **DELETE** | ya cerrado | ACL, sin cambios |
| **REVOKE necesario** | **SÍ** | `REVOKE ALL PRIVILEGES ... FROM authenticated` |
| **RLS necesario** | **opcional, y con matiz** | Revocado todo, RLS no tiene nada que filtrar |
| **¿Eliminar la tabla?** | **No lo recomiendo** | Tiene intención de producto documentada |

> **Sobre el RLS de `content_revisions`, lo mismo que dije en `test_scores`:** una vez revocado todo,
> **RLS es un contador, no una protección**. Subiría a 31/37 sin cerrar nada que el REVOKE no cierre
> ya. Si aun así se quiere por homogeneidad, es inofensivo —está medido: cierra la tabla entera y no
> rompe nada—, pero conviene aplicarlo sabiendo lo que aporta.

**El sprint puede ser uno solo** —comparten ACL idéntica, ninguna dependencia entre sí y ambas se
cierran con REVOKE— siempre que la migración deje claro que el mecanismo de cada una es distinto.

---

## 13. Decisión requerida

**¿Están las dos preparadas?** **Sí, las dos.** Ningún criterio de parada bloquea. La única cautela
está medida: la política del Grupo 0 de `clinical_prescriptions` **no se toca**, o el
`PatientDashboard` deja de mostrar la instrucción sin dar error.

**Qué mecanismo usar en cada una:**

- **`clinical_prescriptions`** → **REVOKE `INSERT, UPDATE` + `ENABLE RLS` conservando su política.**
  Cero políticas nuevas. El REVOKE es la corrección; RLS es la segunda capa.
- **`content_revisions`** → **REVOKE `ALL` a `authenticated`.** RLS opcional y, dicho con franqueza,
  decorativo una vez revocado todo.

**¿Necesitan REVOKE?** **Las dos, sí.** Es el hallazgo central: en ninguna de las dos el problema era
la falta de RLS, sino que la ACL concede escritura a `authenticated` desde el día que se crearon
—2024 en una, julio de 2026 en la otra—.

**¿Necesitan RLS?** `clinical_prescriptions` **sí**, como defensa en profundidad y porque su política
ya existe. `content_revisions` **no lo necesita**; es una elección de homogeneidad.

**¿`content_revisions` se conserva o se elimina después?** **Recomiendo conservarla**, y no por estar
vacía sino porque tiene una promesa de producto escrita y un modelo de RLS ya redactado. Eso la
separa de `guides` y `test_scores`.

**¿Hay decisión de producto?** **Una:** ¿sigue en pie la promesa de que *«el autor pueda ver qué se
le cambió»*? Si sí, se conserva y se cierra. Si no, entra en el sprint de limpieza junto a `guides`.

**Preguntas concretas:**

1. **¿Se aprueba REVOKE + RLS para `clinical_prescriptions`**, conservando su política del Grupo 0 y
   sin crear ninguna nueva?
2. **¿`content_revisions` con REVOKE solo, o REVOKE + RLS?** El primero cierra; el segundo suma
   cobertura sin sumar protección.
3. **¿Sigue en pie la promesa de auditoría editorial?** Determina si la tabla se conserva o se
   propone para eliminación.
4. **¿Un sprint conjunto o dos separados?** Recomiendo uno, con la migración explicando que el
   mecanismo de cada tabla es distinto.

Con esas respuestas, el plan queda con **un sprint pendiente** (`user_preferences` +
`therapist_time_blocks`) y las tres excepciones ya documentadas.

---

## Cierre — aplicado el 14 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260814_prescriptions_revisions.sql`, con backup
conjunto en `backups/20260814_pre_prescriptions_revisions.sql`.
**RLS 29 → 31 de 37. Políticas: 92, sin cambio — se crearon 0.**

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Catálogo y Auditoría — REVOKE + RLS»*.

**Se confirmó lo esencial del diagnóstico**, incluida su tesis central: **el cierre lo hace el
REVOKE, no RLS.** Las nueve denegaciones de escritura sobre `clinical_prescriptions` y las ocho de
`content_revisions` dieron `42501 permission denied for table` —ACL— y **ninguna**
`new row violates row-level security policy`.

- El **embed** de `clinicalService.ts:224` sigue funcionando con la política del Grupo 0 conservada:
  1 fila, con el título `"Activación Conductual Matutina"` y su instrucción reales. **No hay
  denegación disfrazada de NULL.**
- `instruccion_paciente` **ya no la puede modificar `authenticated`**, en ninguno de los tres roles.
- `content_revisions` queda cerrada entera para `anon` y `authenticated`, con RLS y **0 políticas**,
  y **se conserva** por su promesa funcional. La auditoría **no se implementó**.

**Corrección al plan aprobado:** el estado final esperado decía `políticas: 93`. **El real es 92** —
este sprint crea 0 políticas y la única de `clinical_prescriptions` ya estaba dentro de las 92. Lo
avisé antes de aplicar y se aplicó con el valor correcto.

## Estado del diagnóstico

**Aplicado.**

```
RLS activo: 31/37 · FORCE: 0/37 · políticas: 92
clinical_prescriptions: RLS=true · 1 política (conservada) · 14 filas · authenticated=r------m
content_revisions:      RLS=true · 0 políticas · 0 filas · anon y authenticated sin privilegios
ACL: solo las dos tablas del sprint · triggers: 0 · FK: 0 · funciones: 0 · índices: 0 · vistas: 0
datos permanentes: 0 · frontend: 0 · RPC: 0 · Realtime: 0 · Broadcast: 0 · commits: 0
```
