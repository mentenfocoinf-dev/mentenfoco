# Diagnóstico test_scores — decisión de arquitectura

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se eliminó la tabla, no se activó RLS,
no se creó ninguna política, no se revocó ningún privilegio, no se tocó `clinical_alerts`,
`psychometric_evaluations`, funciones, triggers, FK ni frontend. Toda escritura se hizo dentro de una
transacción con `ROLLBACK` forzado y los **33 criterios del baseline** volvieron a OK al terminar.

**Estado global al terminar:** RLS 29/37 · FORCE 0/37 · 92 políticas · huellas ACL/POL/triggers/
funciones/FK/índices/vistas idénticas.

---

## 1. Baseline

**Los 33 criterios OK. Ninguno contradice el diagnóstico anterior.**

```
owner ................. postgres        filas ................. 0
relrowsecurity ........ false           columnas .............. 6
relforcerowsecurity ... false           políticas ............. 0
reloptions ............ (NULL)          triggers propios ...... 0
FK salientes .......... 1               FK entrantes .......... 0
CHECK propios ......... 0               índices ............... 1
vistas dependientes ... 0               Realtime / Broadcast .. 0
funciones que la citan  0               reglas (pg_rewrite) ... 0
huella de datos ....... (VACÍA)         COMMENT ............... (ninguno)
```

**Columnas:**

```
id            uuid                       NOT NULL  gen_random_uuid()
patient_id    uuid                       NULL
test_name     text                       NOT NULL
item_9_score  integer                    NULL      0
total_score   integer                    NULL      0
evaluated_at  timestamp with time zone   NULL      now()
```

**Constraints:** `test_scores_pkey` PRIMARY KEY (id) · `test_scores_patient_id_fkey`
FOREIGN KEY (patient_id) REFERENCES profiles(id) ON DELETE CASCADE. **Cero CHECK.**

**ACL:**

```
postgres=arwdDxtm/postgres, anon=arwxtm/postgres, authenticated=arwm/postgres, service_role=arwdDxtm/postgres
anon            raw--xt      SELECT + INSERT + UPDATE + REFERENCES + TRIGGER
authenticated   raw----      SELECT + INSERT + UPDATE
service_role    rawdDxt
```

**Grants por columna:** `anon` 24 (SELECT/INSERT/UPDATE/REFERENCES × 6), `authenticated` 18
(SELECT/INSERT/UPDATE × 6). **No hay asimetría de columna**: los grants por columna reproducen los
de tabla, no los recortan.

> Nota: `anon` conserva `DELETE`/`TRUNCATE` **revocados** —lo hizo
> `20260807e_cierre_destruccion_anon.sql`—, igual que `authenticated` por
> `20260808_cierre_delete_authenticated.sql`. Lo que quedó abierto es **escribir y modificar**, no
> destruir.

---

## 2. Historial de migraciones

**El hallazgo estructural del sprint: no existe ningún DDL de `test_scores` en el repositorio.**

Búsqueda literal sobre `supabase/`:

```
CREATE TABLE ... test_scores ....... 0 resultados
ALTER TABLE ... test_scores ........ 0 resultados
DROP TABLE ... test_scores ......... 0 resultados
COMMENT ON ... test_scores ......... 0 resultados
```

La tabla **existe en la base pero no en el repositorio**. Se creó fuera del control de migraciones
—consola de Supabase o un esquema inicial nunca versionado—. **Esto importa para la decisión:** si se
elimina sin más, se pierde su definición, porque no hay ningún archivo del que reconstruirla.

Lo que sí está versionado son cinco intervenciones **sobre** la tabla:

| Migración | Qué hizo |
|---|---|
| `20260701_fix_clinical_alerts_fk.sql` | **Redirigió la FK de `clinical_alerts.test_score_id` a `psychometric_evaluations`** |
| `20260807e_cierre_destruccion_anon.sql` | `REVOKE DELETE, TRUNCATE ... FROM anon` |
| `20260808_cierre_delete_authenticated.sql` | `REVOKE DELETE, TRUNCATE ... FROM authenticated` |
| `20260808_revoke_references_trigger_authenticated.sql` | `REVOKE REFERENCES, TRIGGER ... FROM authenticated` |
| `20260812_drop_evaluate_phq9_risk.sql` | **Eliminó el trigger `tr_evaluate_phq9_risk` y la función `evaluate_phq9_risk()`** |

**La migración que lo explica todo** es la primera, y conviene leerla literal porque responde a la
pregunta de por qué existe la tabla:

> «`clinical_alerts.test_score_id` apuntaba a `test_scores`, una tabla previa y más simple (id,
> patient_id, test_name, item_9_score, total_score, evaluated_at) que cubría el mismo propósito que
> `psychometric_evaluations` pero sin `severity_level`, `raw_answers` ni soporte genérico de escalas.
> **Ambas tablas tenían 0 filas — nadie llegó a usar ninguna de las dos desde el frontend.** El
> roadmap especifica construir sobre `psychometric_evaluations`, así que se corrige la FK para que
> apunte ahí. **`test_scores` queda sin usar pero no se borra en esta migración** (fuera de alcance
> de este ítem; decisión de limpieza separada).»

**La sustitución está confirmada por migración, no deducida del nombre.** Y la frase «decisión de
limpieza separada» del 1 de julio es exactamente la decisión que este sprint pone sobre la mesa: ha
estado pendiente **seis semanas**, y se aplazó dos veces más — en `20260812_drop_evaluate_phq9_risk.sql`
(*«No borra la tabla `test_scores`: esa es una decisión de limpieza aparte»*) y en el diagnóstico de
las 8 restantes.

---

## 3. Consumidores del repositorio

Búsqueda sobre todo el repositorio. **Clasificación de cada mención:**

| Categoría | Cuántas | Dónde |
|---|---|---|
| **A) consumidor ejecutable** | **0** | — |
| **B) referencia histórica** | 5 migraciones + 4 backups | `supabase/`, ver §2 |
| **C) comentario** | 9 | comentarios dentro de migraciones y de `20260812_grupo2_rls.sql` |
| **D) migración de compatibilidad** | 1 | `20260701_fix_clinical_alerts_fk.sql` |
| **E) objeto actualmente inexistente** | 2 | `tr_evaluate_phq9_risk`, `evaluate_phq9_risk()` — verificado: 0 en `pg_trigger` y 0 en `pg_proc` |

**Cero apariciones** en `src/`, `supabase/functions/` (las cuatro Edge Functions), `scripts/`,
seeders o cron. El resto de menciones (≈30) están en `contexto-proyecto/`: son **mis propios informes
de auditoría** diciendo que la tabla está muerta. No cuentan como consumidor.

**Ninguna referencia histórica se ha contado como consumidor.**

---

## 4. Dependencias reales en PostgreSQL

`pg_depend` sobre `public.test_scores` — **8 entradas, todas internas a la propia tabla**:

```
pg_attrdef     deptype=a   los 4 defaults (id, item_9_score, total_score, evaluated_at)
pg_class       deptype=i   pg_toast.pg_toast_18378
pg_constraint  deptype=a   test_scores_pkey            (en test_scores)
pg_constraint  deptype=a   test_scores_patient_id_fkey (en test_scores)
pg_type        deptype=i   tipo de fila test_scores
```

**Constraints de OTRAS tablas que la referencian: 0.**

| Catálogo | Resultado |
|---|---|
| `pg_constraint` (FK entrantes) | **0** — bloqueante para DROP: **ninguna** |
| `pg_proc` | **0** funciones de `public` la citan |
| `pg_trigger` | **0** triggers propios; **0** triggers de otras tablas la usan |
| `pg_rewrite` | **0** reglas distintas de `_RETURN` |
| Vistas y vistas materializadas | **0** |
| Políticas | **0** |
| Índices | **1**, el suyo propio |
| Publicaciones (Realtime/Broadcast) | **0** |

**No existe una sola dependencia bloqueante.** `DROP TABLE public.test_scores` funcionaría **sin
`CASCADE`**. La única dependencia hacia fuera es *saliente* —su FK a `profiles`—, que desaparece con
la tabla y no afecta a `profiles`.

---

## 5. Semántica y comparación con psychometric_evaluations

```
columna            test_scores    psychometric_evaluations
evaluated_at       ✔              ✔
id                 ✔              ✔
patient_id         ✔              ✔
total_score        ✔              ✔
test_name          ✔              —
item_9_score       ✔              —
scale_type         —              ✔
raw_answers        —              ✔
severity_level     —              ✔
therapist_id       —              ✔
```

```
                        test_scores    psychometric_evaluations
filas ................  0              40
RLS ..................  false          true
políticas ............  0              5
FK entrantes .........  0              1
triggers .............  0              1
ACL anon .............  arwxtm         ----
```

**Qué representaba `test_scores`:** el resultado de un único instrumento —PHQ-9— reducido a dos
enteros: el total y el ítem 9 (ideación suicida). `test_name` es texto libre, sin catálogo ni CHECK.

**Las dos columnas que solo existen en la vieja:**

- **`test_name` (text)** → sustituida por `scale_type`, que hace lo mismo con más disciplina.
- **`item_9_score` (integer)** → **no tiene equivalente directo, y es deliberado.** La tabla nueva
  guarda `raw_answers` (jsonb) con **todas** las respuestas, así que el ítem 9 está dentro; y añade
  `severity_level`, que es la lectura clínica en vez de un entero suelto. `item_9_score` no es
  información perdida: es información **generalizada**.

**Diferencia semántica importante entre ambas: no la hay en contra de la nueva.**
`psychometric_evaluations` es un superconjunto funcional: soporta cualquier escala, guarda las
respuestas crudas, registra quién evaluó y clasifica la severidad. `test_scores` es el prototipo del
que salió.

**IDs compartidos: ninguno.** Las dos usan `gen_random_uuid()` con secuencias independientes; sus
espacios de identificadores no se solapan. `psychometric_evaluations` tiene 40 filas, `test_scores`
tiene 0: **no hay ni una relación conceptual viva entre ambas.**

---

## 6. Estado de clinical_alerts.test_score_id

**Fase obligatoria. Y aquí corrijo un error de mi diagnóstico anterior.**

> En el diagnóstico de las 8 restantes escribí: «`clinical_alerts` tiene una columna `test_score_id`
> **pero no hay FK real hacia `test_scores`**». La primera mitad es correcta y la segunda induce a
> error: **la columna sí tiene una FK — solo que apunta a otro sitio.**

```
columna:  test_score_id   uuid   NULL   (sin default)

FK reales de clinical_alerts:
  clinical_alerts_patient_id_fkey       FOREIGN KEY (patient_id)    REFERENCES profiles(id) ON DELETE CASCADE
  clinical_alerts_resolved_by_fkey      FOREIGN KEY (resolved_by)   REFERENCES profiles(id)
  clinical_alerts_test_score_id_fkey    FOREIGN KEY (test_score_id) REFERENCES psychometric_evaluations(id) ON DELETE CASCADE
                                                                    ^^^^^^^^^^^^^^^^^^^^^^^^
```

**La columna conserva el nombre viejo pero la restricción apunta a la tabla nueva desde el 1 de
julio.** Es un vestigio de nomenclatura, no una dependencia.

**Consecuencia directa: `test_score_id` NO puede contener un id de `test_scores`.** La FK lo
impediría: un id de `test_scores` no existe en `psychometric_evaluations`, así que cualquier intento
daría `23503`. Eso resuelve el criterio de parada #3 y el #10 sin ambigüedad.

Estado real de las filas:

```
filas de clinical_alerts: 2      con test_score_id NO NULO: 0

  alerta 212bfbbf   test_score_id=(NULL)   status=high_priority   2026-06-24
  alerta cce6d418   test_score_id=(NULL)   status=high_priority   2026-06-24
```

**Ninguna alerta ha usado nunca esa columna.** Ni una coincide con un id de
`psychometric_evaluations` (0). El camino que la habría llenado —`tr_evaluate_phq9_risk`— ya no
existe, y de hecho **estaba roto**: escribía un id de `test_scores` en una columna con FK a
`psychometric_evaluations`, así que todo INSERT con ítem 9 positivo fallaba con `23503`. Eso ya se
documentó y se corrigió en `20260812_drop_evaluate_phq9_risk.sql`.

**Verificación viva, medida hoy:**

```
anon inserta en test_scores un PHQ-9 con item_9_score=3, total_score=27
clinical_alerts: antes 2 -> después 2      no se genera ninguna alerta
triggers en test_scores: 0                 evaluate_phq9_risk() en pg_proc: 0
```

---

## 7. Posibles consumidores futuros

| Indicio buscado | Resultado |
|---|---|
| Tests antiguos | ninguno |
| Módulos desactivados | ninguno |
| Feature flags | ninguno |
| Código comentado en `src/` | **ninguno** — cero apariciones en `src/` |
| Rutas no montadas | ninguna |
| Migraciones incompletas | ninguna: las 5 que la tocan están aplicadas |
| Documentos de roadmap | **sí, y apuntan a la otra tabla** |
| ADR | ninguno la menciona |

El roadmap es `contexto-proyecto/investigacion-clinica/06_Recomendaciones_Implementacion_Tecnica.md`.
Nombra **`psychometric_evaluations` tres veces** y **`test_scores` ninguna**:

> «Reforzar `psychometric_evaluations` con MoCA/MMSE» · «ningún componente del frontend usa esta
> tabla todavía» · «UI de PHQ-9 y GAD-7 sobre `psychometric_evaluations`».

**Intención histórica:** existió, en junio, cuando `test_scores` era la tabla de puntajes.
**Implementación real:** cero, ni entonces ni ahora. **La intención se trasladó a
`psychometric_evaluations` por decisión explícita del roadmap, y allí sigue viva** —la UI de PHQ-9
y GAD-7 sigue pendiente, pero sobre la tabla nueva—.

**No convierto ninguna mención futura en consumidor actual: no hay ninguna que apunte aquí.**

---

## 8. Riesgo actual

Medido con RLS apagado, dentro de una transacción revertida:

```
actor          operación                                  resultado                     capa
anon           SELECT las 6 columnas                      0 filas (vacía; ACL concede)  ninguna
anon           INSERT patient_id ajeno, item_9_score=3    SE CREA                       NINGUNA <<<
anon           INSERT sin paciente, puntajes absurdos     SE CREA                       NINGUNA <<<
anon           UPDATE de todas las filas                  2 MODIFICADAS                 NINGUNA <<<
anon           DELETE                                     42501 permission denied       ACL
anon           TRUNCATE                                   42501 permission denied       ACL
authenticated  SELECT las 6 columnas                      2 filas                       ninguna
authenticated  INSERT patient_id ajeno                    SE CREA                       NINGUNA <<<
authenticated  UPDATE                                     3 MODIFICADAS                 NINGUNA <<<
authenticated  DELETE                                     42501 permission denied       ACL
authenticated  TRUNCATE                                   42501 permission denied       ACL
```

**Aviso de lectura sobre esa tabla, para que no se malinterprete:** las «2 filas» que ve
`authenticated` y las «2/3 MODIFICADAS» **son filas que yo mismo acababa de insertar en la misma
transacción**. El baseline es y sigue siendo **0**. No hay ni un dato real que nadie pueda leer aquí:
**no existe fuga de lectura, porque no hay nada que leer.**

**Lo que sí está abierto, sin ninguna capa que lo detenga:**

- Un **visitante sin sesión** puede escribir `{patient_id: <uuid de un paciente real>,
  test_name: 'PHQ-9', item_9_score: 3, total_score: 27}`. Es decir, **fabricar un registro de
  ideación suicida a nombre de otra persona**.
- Puede también escribir basura: `item_9_score = 999`, `total_score = -999`, `test_name` inventado.
  **Cero CHECK** en toda la tabla.
- Puede **modificar** cualquier fila que exista.
- **No puede** borrar ni vaciar: eso sí lo cerraron los dos sprints de agosto.

**Ninguna capa lo impide: no hay trigger, no hay CHECK, no hay política, no hay RLS.** El único
límite es la FK a `profiles`, que obliga a que el `patient_id` exista — y un uuid de perfil no es
adivinable, lo que reduce la explotabilidad pero no la abre ni la cierra por sí solo.

**Impacto real hoy: ninguno**, porque nadie lee la tabla. **Impacto si alguien la conectara mañana:
directo**, porque estaría leyendo datos fabricados desde fuera.

---

## 9. Opciones A/B/C

### A) ELIMINAR `test_scores`

| | |
|---|---|
| **Seguridad** | **Máxima.** Desaparece la peor ACL de la base. No queda nada que revocar ni que filtrar |
| **Compatibilidad** | **Total.** 0 filas, 0 consumidores, 0 dependencias entrantes, 0 funciones, 0 triggers, 0 vistas |
| **Dependencias** | `DROP TABLE` funciona **sin `CASCADE`**. Solo cae su propia FK a `profiles` |
| **Complejidad** | La menor: dos sentencias |
| **Rollback** | **Aquí está el único punto delicado.** No hay DDL en el repositorio del que reconstruirla, y **PITR está desactivado con cero copias**. El rollback hay que **escribirlo a mano en el backup**, a partir del catálogo. Como la tabla está vacía, no se pierde ni un dato: solo la definición, y esa queda recogida |
| **Coherencia con la migración a `psychometric_evaluations`** | **Es la conclusión que `20260701_fix_clinical_alerts_fk.sql` dejó escrita** y aplazó tres veces |

### B) CONSERVARLA Y CERRARLA CON REVOKE + RLS

| | |
|---|---|
| **Seguridad** | Alta si se hace bien. **Pero el orden importa:** el REVOKE es lo que cierra; RLS, una vez revocado INSERT y UPDATE, **no tiene nada que filtrar** |
| **Compatibilidad** | Total: no rompe nada porque no hay nada que romper |
| **Dependencias** | Ninguna |
| **Complejidad** | Mayor que A: dos REVOKE + `ENABLE RLS` + decidir qué políticas (¿ninguna? ¿titular y terapeuta?) sobre una tabla que nadie usa |
| **Rollback** | Trivial y ya conocido |
| **Coherencia** | **Baja.** Blindar una tabla obsoleta la vuelve permanente: pasa de «pendiente de limpieza» a «tabla cerrada del sistema», y sube la cobertura de RLS a 30/37 sin que nadie esté más seguro |

### C) CONSERVARLA SIN RLS POR COMPATIBILIDAD

| | |
|---|---|
| **Seguridad** | **La peor.** Deja `anon=arwxtm` tal cual |
| **Compatibilidad** | No aporta ninguna: **no hay ningún consumidor ni dependencia que la necesite abierta.** Se ha buscado en catálogo y en repositorio |
| **Justificación** | **No existe.** Esta opción exige nombrar qué consumidor la requiere, y la respuesta medida es: ninguno |

---

## 10. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | Consumidor ejecutable no documentado | **No.** 0 en `src/`, Edge Functions, scripts, cron |
| 2 | Dependencia estructural real | **No.** `pg_depend`: 8 entradas, todas internas; 0 constraints externas |
| 3 | `clinical_alerts.test_score_id` puede recibir ids de `test_scores` por algún flujo vivo | **No, y es imposible:** su FK apunta a `psychometric_evaluations`; un id de `test_scores` daría `23503` |
| 4 | RPC que la use | **No.** 0 funciones de `public` la citan |
| 5 | Trigger que la utilice | **No.** 0 propios y 0 ajenos. `tr_evaluate_phq9_risk` verificado ausente |
| 6 | Vista que la utilice | **No.** 0 vistas y 0 materializadas |
| 7 | Documentación de producto que exija conservarla | **No.** El roadmap nombra `psychometric_evaluations` y nunca `test_scores` |
| 8 | Diferencia semántica importante frente a `psychometric_evaluations` | **No.** La nueva es superconjunto; `item_9_score` está dentro de `raw_answers` |
| 9 | Eliminarla puede romper una migración o función | **No, con una precisión** — ver abajo |
| 10 | No puede determinarse qué hacer con `clinical_alerts.test_score_id` | **Sí se puede: nada.** Su FK ya es correcta; el nombre es un vestigio cosmético |
| 11 | Prueba de ACL con resultado ambiguo | **No.** Los `0 filas` son tabla vacía con ACL concedida; los `42501` son todos `permission denied for table` |
| 12 | Necesidad de modificar otra tabla | **No.** `clinical_alerts` no necesita ningún cambio |

### Precisión sobre el criterio 9

Las cinco migraciones que tocan `test_scores` **ya están aplicadas** y no volverán a ejecutarse. Aun
así, si alguien reconstruyera la base ejecutándolas todas en orden **después** de una migración de
DROP, tres fallarían: los dos `REVOKE ... ON TABLE public.test_scores` y el
`DROP TRIGGER IF EXISTS ... ON public.test_scores`. **No es un impedimento —es una nota para la
migración de limpieza—:** el DROP debe ir con fecha posterior a todas ellas, y los `REVOKE` deberían
llevar guarda. Lo señalo porque el criterio lo pide, no porque bloquee.

**Ningún criterio de parada bloquea la decisión.** El #10, que en el diagnóstico anterior sí estaba
abierto, queda resuelto: la FK ya apunta al sitio correcto.

---

## 11. Recomendación

**Recomiendo la opción A: eliminar `test_scores`.**

No por estar vacía —eso, tú lo dijiste, no basta—, sino porque **las siete condiciones que harían
sensato conservarla fallan todas, y están medidas una a una**:

1. **Nadie la lee ni la escribe.** 0 consumidores ejecutables en todo el repositorio.
2. **Nada depende de ella.** `pg_depend`: 0 constraints externas. `DROP` sin `CASCADE`.
3. **La FK que parecía atarla ya no la ata.** Apunta a `psychometric_evaluations` desde el 1 de julio.
4. **Su único mecanismo vivo ya se eliminó**, y estaba roto: el trigger PHQ-9 fallaba con `23503`.
5. **Su sucesora existe, funciona y está protegida:** 40 filas, RLS, 5 políticas, `anon` sin nada.
6. **El roadmap construye sobre la sucesora**, y nunca sobre esta.
7. **No aporta ninguna columna que la nueva no cubra.** `item_9_score` vive dentro de `raw_answers`.

Y una razón más, que es la que inclina la balanza frente a B: **conservarla cerrada la convierte en
permanente.** Poner RLS a una tabla obsoleta sube el contador a 30/37 y deja el sistema exactamente
igual de seguro, con una tabla muerta más que mantener. Es maquillaje de cobertura — lo mismo que
dije de `guides`, y por la misma razón.

**Respuestas explícitas a las seis preguntas:**

- **¿Se elimina `test_scores`?** → **Sí.**
- **¿Se conserva?** → **No.** Ninguna dependencia ni consumidor la requiere.
- **¿Requiere REVOKE?** → **No, si se elimina** — el DROP se lleva la ACL. **Sí, y con urgencia, si
  decides conservarla**: `REVOKE INSERT, UPDATE ON public.test_scores FROM anon, authenticated` es la
  corrección de fondo, y el `REVOKE SELECT` también, porque nadie debe leerla.
- **¿Requiere RLS?** → **No.** Y esto quiero decirlo sin rodeos aunque el plan del proyecto sea de
  RLS: **una vez revocados INSERT y UPDATE, RLS no tendría nada que filtrar.** Sería una política
  sobre privilegios que ya no existen. Si decides conservarla, hazlo con REVOKE; RLS solo como
  homogeneidad, sabiendo que no añade protección real.
- **¿Qué pasa con `clinical_alerts.test_score_id`?** → **Nada en este sprint.** Su FK ya es correcta,
  sus 2 filas la tienen a `NULL` y ningún flujo la escribe. Lo único cuestionable es **el nombre**,
  que sugiere una tabla que dejará de existir. Renombrarla a `evaluation_id` sería más honesto, pero
  **es un cambio de esquema con impacto en PostgREST y no pertenece a este sprint** — lo dejo
  documentado, no propuesto.
- **¿Qué migración de limpieza sería necesaria?** → Una sola, con tres requisitos:
  1. **Registrar el DDL completo en el backup**, reconstruido desde el catálogo — porque **no existe
     en ningún archivo del repositorio** y sin eso el rollback sería imposible.
  2. `DROP TABLE public.test_scores;` **sin `CASCADE`** — verificado que no hace falta, y usarlo
     ocultaría cualquier dependencia que apareciera.
  3. **Fecha posterior** a las cinco migraciones que la tocan, y una nota de que aquellas ya no son
     replicables sobre una base nueva.

**Una salvedad honesta, y pesa:** PITR está desactivado y no hay ni una copia de seguridad. Eliminar
una tabla **vacía** no pone en riesgo ningún dato —no hay ninguno—, pero es la primera operación
irreversible de todo este plan. Si prefieres no ejecutar ningún DROP mientras no haya copias, **la
alternativa correcta no es B tal como está escrita: es el REVOKE solo**, que cierra el riesgo hoy y
deja la eliminación para cuando existan copias. Esa combinación —REVOKE ahora, DROP después— es la
única variante de «conservar» que puedo defender con la evidencia medida.

---

## 12. Decisión requerida

**Elige una:**

| | Opción | Qué implica |
|---|---|---|
| **A** | **Eliminar** *(recomendada)* | Un sprint: backup con el DDL reconstruido + `DROP TABLE`. RLS quedaría en 29/36 tablas, y el plan cerraría en **34/36** en vez de 34/37 |
| **A′** | **REVOKE ahora, DROP cuando haya copias** | Cierra el riesgo hoy sin ninguna operación irreversible. Es la opción prudente si PITR sigue apagado |
| **B** | **Conservar con REVOKE + RLS** | Cierra el riesgo, pero vuelve permanente una tabla obsoleta y sube la cobertura sin subir la seguridad |
| **C** | **Conservar sin RLS** | **No la recomiendo y no puedo justificarla:** exige nombrar un consumidor que la necesite abierta, y no existe |

**Preguntas concretas que necesito que respondas:**

1. **¿A, A′, B o C?**
2. Si eliges **A**: ¿confirmas el `DROP` con PITR desactivado y cero copias, sabiendo que la tabla
   está vacía y que el backup llevará el DDL completo?
3. Si eliges **A′** o **B**: ¿el REVOKE incluye también `SELECT`, o solo `INSERT` y `UPDATE`?
4. **`clinical_alerts.test_score_id`**: ¿se deja el nombre como está —mi recomendación— o quieres un
   sprint aparte para renombrarlo a `evaluation_id`?

**Con esta decisión tomada, el plan de RLS queda con dos sprints pendientes** (catálogo/auditoría y
datos propios) y las tres excepciones ya documentadas.

---

## Cierre — opción A′ aplicada el 14 de agosto de 2026

**Decisión tomada: A′ — REVOKE ahora, DROP después.** Aplicada en
`20260814_test_scores_revoke.sql`, con backup en `backups/20260814_pre_test_scores_revoke.sql`.
Una sola sentencia: `REVOKE ALL PRIVILEGES ON TABLE public.test_scores FROM anon, authenticated;`

**No se eliminó la tabla. No se activó RLS. No se creó ninguna política. No se tocó
`clinical_alerts`.** RLS sigue en 29/37 y las políticas en 92.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Test Scores — cierre reversible»*.

**Resultado:** `anon` y `authenticated` **desaparecen de la ACL** —no quedan con letras vacías— y los
**42 grants por columna** (24 + 18) caen a 0. Los ocho privilegios en `false` para ambos, y
`service_role` y `postgres` intactos en `rawdDxtm`. Funcionalmente: `42501 permission denied for
table test_scores` en SELECT, INSERT, UPDATE, DELETE, TRUNCATE y TRIGGER, para los dos roles.

**Una precisión de nomenclatura que corrige mis informes anteriores:** la ACL real de
`authenticated` era `arwm`, es decir **`raw----m` con MAINTAIN incluido**. La notación de siete
letras que venía usando no mostraba ese bit. El estado nunca fue distinto; la notación era
incompleta. El `REVOKE ALL` lo quitó igualmente.

**Lo que este sprint NO resuelve, y sigue pendiente:** la eliminación de la tabla. Sigue siendo la
conclusión correcta —§11 no cambia—, aplazada hasta que existan copias de seguridad. Cuando llegue,
su backup tendrá que **reconstruir el DDL completo desde el catálogo**, porque §2 sigue vigente: la
tabla no está en ninguna migración del repositorio.

## Estado del diagnóstico

**Diagnóstico cerrado. Opción A′ aplicada. DROP pendiente de copias de seguridad.**

```
RLS activo: 29/37 · FORCE: 0/37 · políticas: 92
test_scores: RLS=false · 0 políticas · 0 filas · anon sin privilegios · authenticated sin privilegios
             postgres y service_role intactos · tabla NO eliminada
clinical_alerts: 0 · psychometric_evaluations: 0 · triggers: 0 · FK: 0 · funciones: 0
índices: 0 · vistas: 0 · datos permanentes: 0 · frontend: 0 · RPC: 0 · Realtime: 0 · commits: 0
```
