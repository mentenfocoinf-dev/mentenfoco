# Sprint 4Q — Auditoría y plan de RLS

**Fecha:** 11 de agosto de 2026 · **Modo:** solo lectura · **Estado final:** 37/37 tablas con RLS `FALSE`
**Huella md5 de la ACL de las 37 tablas al terminar:** `64cdb69b1241ea34ac996556da08dc19` — idéntica a la
registrada en la migración `20260808b_default_privileges_tables.sql`. Nada se modificó.

> Este sprint no aplica ninguna política, no crea migraciones ni backups, no toca ACL, funciones,
> triggers, React ni datos. Las dos pruebas que activaron RLS lo hicieron dentro de transacciones
> revertidas por `RAISE EXCEPTION`, según la metodología obligatoria del proyecto.

---

## 1. Conclusión primero

**RLS, tal y como está construida hoy la aplicación, protegería mucho menos de lo que parece y rompería
mucho menos de lo que se temía.** Las dos mitades de esa frase se midieron ejecutando, no leyendo.

Las **31 funciones RPC que usa el frontend son `SECURITY DEFINER` con owner `postgres`, y `postgres`
tiene `bypassrls = true`**. Una política no se evalúa nunca dentro de ellas. Como el 100 % de la lectura
clínica del producto —mensajes, sesiones, citas, pacientes, notificaciones, preferencias— entra por esas
RPC, activar RLS mañana en las 37 tablas:

- **no rompería ninguna de las 30 llamadas RPC del frontend**, ni las 4 Edge Functions, ni los 7 seeders
  (`service_role` también tiene `bypassrls = true`);
- **tampoco protegería nada de lo que pasa por ellas.** La autorización de ese camino vive dentro del
  cuerpo de cada función, y ahí seguirá.

El radio de acción real de RLS es exactamente **el acceso directo `.from("tabla")` desde React con JWT de
`anon` o `authenticated`**: 58 puntos de llamada sobre 30 tablas. Ni uno más.

Y hay un segundo hallazgo que condiciona todo lo demás: **8 de las 48 políticas existentes no filtrarían,
fallarían.** Están escritas contra un modelo de privilegios que los sprints 4I–4N ya desmontaron.

---

## 2. Estado de partida (Fase 1)

| Métrica | Valor |
| :--- | :--- |
| Tablas en `public` | 37 |
| Con RLS activo | **0** |
| Con `FORCE ROW LEVEL SECURITY` | 0 |
| Owner distinto de `postgres` | 0 |
| Políticas definidas (inertes) | **48**, sobre 18 tablas |
| Tablas con cero políticas | **19** |
| Triggers de usuario | 42 |
| Funciones en `public` | 274 |

Ninguna tabla inesperada, ninguna ausente. No se activó ningún criterio de parada de la Fase 1.

---

## 3. Las 48 políticas existentes (Fase 2)

Existen desde antes de la campaña de blindaje y **están inertes**: sin RLS activo, PostgreSQL ni siquiera
las mira. Que existan no significa que sean correctas.

### 3.1 Clasificación

| Categoría | Nº | Detalle |
| :--- | ---: | :--- |
| **A — útiles y reutilizables** | 27 | Patrón `auth.uid() = patient_id` / `= therapist_id` / `= user_id`. Simples, sin subconsulta, correctas. |
| **B — obsoletas** | 2 | `guides` (2): la tabla quedó sustituida por `clinical_guides` + `content_items` en el modelo editorial. |
| **C — incompletas** | 8 | Tablas con política de `SELECT` pero sin `INSERT`/`UPDATE`, o al revés. Ver 3.3. |
| **D — peligrosas si se activaran sin cambios** | 3 | Ver 3.2. |
| **E — rotas: fallarían con `42501`** | 8 | Ver 3.4. **Este es el hallazgo grave.** |

### 3.2 Categoría D — las tres peligrosas

| Tabla | Política | Expresión | Por qué es peligrosa |
| :--- | :--- | :--- | :--- |
| `clinical_prescriptions` | *Anyone authenticated can read clinical prescriptions* | `USING (auth.role() = 'authenticated')` | **Cualquier paciente leería las prescripciones de todos.** Es una política que no filtra nada; solo comprueba que haya sesión. Activarla tal cual sería peor que no tener RLS, porque daría la falsa impresión de que la tabla está protegida. |
| `crm_leads` | *Anyone can create a lead* | `WITH CHECK (true)` | Necesaria para el formulario público, pero sin límite de volumen: un `INSERT` sin restricción. Hoy la contiene el ACL (`anon` solo tiene `INSERT`); la política no aporta nada y no debe leerse como control. |
| `cie11_directory` | *Permitir lectura…* | `USING (true)` | Correcta en intención —el catálogo CIE-11 es público— pero conviene dejarla escrita como `true` explícito y documentado, no heredado. |

### 3.3 Categoría C — incompletas

`clinical_alerts` (INSERT+SELECT, sin UPDATE pese a que `clinicalService.ts:296` actualiza),
`patient_prescriptions` (sin DELETE), `psychometric_evaluations` (sin UPDATE), `telemetry_events`
(sin DELETE), `patient_therapist` (SELECT+ALL solapados), `clinical_tasks`, `clinical_documents`,
`clinical_recommendations` (un `ALL` para terapeuta y un `SELECT` para paciente, sin `WITH CHECK`
en el `ALL`, lo que deja el `INSERT` del terapeuta sin verificación de destino).

### 3.4 Categoría E — las ocho que fallarían, con la causa medida

Las expresiones de una política RLS **se evalúan con los privilegios del invocante**, no del dueño de la
tabla. Ocho políticas hacen `EXISTS (SELECT 1 FROM patient_therapist …)`, y **`authenticated` ya no tiene
`SELECT` sobre `patient_therapist`** — se lo retiró la campaña de blindaje.

| Tabla | Política | cmd |
| :--- | :--- | :--- |
| `clinical_alerts` | Therapists can insert alerts for assigned patients | INSERT |
| `clinical_alerts` | Therapists can view alerts of assigned patients | SELECT |
| `patient_anamnesis` | Therapists can view their patients anamnesis | SELECT |
| `psychometric_evaluations` | Therapists can insert evaluations for assigned… | INSERT |
| `therapy_sessions` | Therapists can create sessions for assigned patients | INSERT |
| `therapy_sessions` | Therapists can delete sessions of assigned patients | DELETE |
| `therapy_sessions` | Therapists can update sessions of assigned patients | UPDATE |
| `therapy_sessions` | Therapists can view sessions of assigned patients | SELECT |

**Evidencia ejecutada** (transacción revertida). Con RLS activo sobre `therapy_sessions`:

```
RLS OFF  count(*)  -> 21
RLS ON   count(*)  -> 42501 permission denied for table patient_therapist
```

No devuelve cero filas: **devuelve error**. Para el frontend eso no es "no ves nada", es una pantalla
rota. La corrección es conocida y ya existe en el proyecto: `is_therapist_of(uuid)`, `SECURITY DEFINER`,
que encapsula exactamente esa consulta. Las ocho deben reescribirse sobre ella antes de cualquier
activación.

### 3.5 Un detalle transversal: `roles = public`

**47 de las 48 políticas apuntan a `public`, no a un rol concreto.** `public` incluye a `anon`. Hoy eso no
tiene consecuencia porque el ACL ya bloquea a `anon` en casi todo, pero una política pensada para un
paciente autenticado no debe declararse para `public`: si mañana se concede un `SELECT` a `anon`, la
política lo dejaría pasar sin que nadie lo haya decidido. Toda política nueva debe declarar
`TO authenticated` explícitamente.

---

## 4. Funciones auxiliares de las políticas (Fase 3)

Las cinco existen. Ninguna política apunta a una función ausente.

| Función | Seguridad | Qué hace |
| :--- | :--- | :--- |
| `get_my_role()` | DEFINER | `SELECT role FROM profiles WHERE id = auth.uid()` |
| `current_user_role()` | DEFINER | Igual, devolviendo `text`. **Duplicado funcional de `get_my_role()`.** |
| `get_my_plan_rank()` | DEFINER | Rango del plan del usuario actual |
| `is_therapist_of(uuid)` | DEFINER | `EXISTS (… patient_therapist WHERE therapist_id = auth.uid() …)` |
| `plan_rank(plan_type)` | invoker | Mapea plan → entero. Pura, sin acceso a tablas. |

Que sean `DEFINER` es justo lo que las hace utilizables dentro de una política: consultan
`profiles` y `patient_therapist` sin exigirle al invocante privilegios sobre ellas. Es el patrón que
resuelve la categoría E.

---

## 5. Inventario de consumidores (Fase 4)

### 5.1 Acceso directo a tabla desde React — el único alcance real de RLS

58 puntos de llamada `.from("tabla")` sobre **30 tablas**. Resumen por operación:

| Operación | Tablas |
| :--- | :--- |
| Solo lectura | `cie11_directory`, `clinical_guides`, `clinical_guides_meta`, `clinical_prescriptions`, `content_items_meta`, `public_tests` |
| Escritura de paciente sobre lo suyo | `mood_entries`, `patient_anamnesis`, `user_preferences`, `notifications`, `clinical_consents`, `journey_events`, `telemetry_events` |
| Escritura de terapeuta | `clinical_notes`, `clinical_alerts`, `therapy_sessions`, `appointments`, `therapist_time_blocks`, `therapist_profiles`, `patient_prescriptions`, `psychometric_evaluations`, `patient_therapist` |
| Pública sin sesión | `crm_leads`, `blog_comments`, `public_test_submissions`, `public_tests` |
| Editorial | `content_items` (INSERT, UPDATE, SELECT) |
| Mixta | `profiles`, `messages`, `service_requests`, `therapist_contact_requests` |

### 5.2 Lo que RLS **no** alcanza

| Consumidor | Nº | Rol efectivo | `bypassrls` |
| :--- | ---: | :--- | :--- |
| RPC invocadas desde React | 30 (31 funciones) | `postgres` (DEFINER) | **sí** |
| Edge Functions | 4 | `service_role` | **sí** |
| Scripts y seeders | 7 | `service_role` | **sí** |
| Migraciones (`run_sql_migration.cjs`) | — | `postgres` vía Management API | **sí** |

Roles medidos: `postgres`, `service_role` y `supabase_admin` tienen `bypassrls = true`.
`anon`, `authenticated` y `authenticator`, `false`.

---

## 6. Prueba central: alcance real de RLS (Fase 9)

Misma sesión, mismo usuario (`b9c6d1c3…`, paciente con 4 mensajes), mismas consultas antes y después de
activar RLS sin políticas sobre `messages` y con las 6 existentes sobre `therapy_sessions`.
Transacción revertida.

```
acceso del rol authenticated              RLS off       RLS on        veredicto
----------------------------------------------------------------------------------------
.from("messages")            DIRECTO      4 filas       0 filas       RLS LO ALCANZA
rpc list_pair_messages       DEFINER      4 filas       4 filas       RLS NO LA ALCANZA
.from("therapy_sessions")    DIRECTO      21 filas      error 42501   RLS LO ALCANZA
rpc list_my_sessions         DEFINER      6 filas       6 filas       RLS NO LA ALCANZA
service_role SELECT directo               —             4 filas       RLS NO LO ALCANZA
```

Se diseñó midiendo **antes y después en la misma transacción** precisamente porque una primera versión de
la prueba devolvió `count_my_unread_messages() → 0` y ese cero era ambiguo: podía ser RLS bloqueando o el
paciente sin mensajes sin leer. Sin la medición pareada, este informe habría afirmado algo que no había
comprobado.

---

## 7. Sensibilidad de las 37 tablas (Fase 5)

| Nivel | Tablas |
| :--- | :--- |
| **CRÍTICA** — dato clínico identificable | `clinical_notes` (24), `patient_anamnesis`, `psychometric_evaluations`, `clinical_alerts`, `messages` (4), `therapy_sessions` (21), `clinical_documents`, `family_genograms`, `clinical_consents`, `patient_prescriptions`, `test_scores`, `public_test_submissions` |
| **ALTA** — relación terapéutica y contacto | `profiles` (8), `patient_therapist` (4), `appointments`, `therapist_contact_requests`, `service_requests`, `crm_leads`, `crm_notes`, `clinical_tasks`, `clinical_recommendations` |
| **MEDIA** — actividad del usuario | `mood_entries`, `journey_events` (58), `notifications`, `user_preferences`, `user_guide_progress`, `telemetry_events`, `blog_comments` |
| **BAJA** — operativa del terapeuta | `therapist_profiles`, `therapist_time_blocks` |
| **PÚBLICA** — catálogo | `cie11_directory`, `clinical_guides`, `guides`, `content_items` (26), `content_revisions`, `public_tests` |

`public_test_submissions` está en CRÍTICA a propósito: recoge puntuación, banda y **correo electrónico**
de personas sin sesión que responden GAD-7 o PHQ-9. Es dato clínico de un identificado, aunque no haya
cuenta detrás.

---

## 8. Matriz de autorización propuesta (Fase 6)

Resumen. `service_role` queda fuera: tiene `bypassrls` y no se ve afectado.

| Tabla | `anon` | `authenticated` propio | `authenticated` ajeno |
| :--- | :--- | :--- | :--- |
| Clínicas CRÍTICAS (12) | DENY todo | ALLOW `patient_id = auth.uid()` | DENY, salvo terapeuta asignado vía `is_therapist_of()` |
| `profiles` | DENY | ALLOW propio (SELECT/UPDATE) | SELECT si `is_therapist_of(id)` o admin |
| `patient_therapist` | DENY | SELECT si es una de sus puntas | DENY; alta y baja solo por RPC de admin |
| `crm_leads` | INSERT ALLOW, SELECT DENY | — | admin |
| `blog_comments`, `public_test_submissions` | INSERT ALLOW | SELECT propio | DENY |
| `public_tests`, `cie11_directory`, `clinical_guides` | SELECT ALLOW | SELECT ALLOW | n/a |
| `content_items` | SELECT solo publicado | ver §9 | ver §9 |
| `therapist_time_blocks` | DENY | ALLOW `therapist_id = auth.uid()` | DENY |
| **REVISAR** | `journey_events`, `telemetry_events` | ¿escritura anónima legítima? | — |

Los dos "REVISAR" no son un descuido: hoy `anon` inserta en ambas para telemetría de visitantes sin
sesión. Cerrarlo con RLS exige antes decidir si esa telemetría se conserva, y esa es una decisión de
producto, no de base de datos.

---

## 9. Análisis especial de `content_items` (Fase 8)

Es la tabla donde RLS **menos aporta y más riesgo tiene**, y conviene decirlo sin rodeos.

Su modelo actual son dos capas ya medidas y funcionando: el trigger `trg_content_authorization`
(10 códigos de error, 16 `RAISE`) y el `GRANT` por columna —9 columnas en el alta, 17 en la edición—.
Ese modelo controla **transiciones de estado y qué columnas puede tocar cada quien**, que es exactamente
lo que RLS no sabe hacer: una política decide sobre filas, no sobre columnas ni sobre la legalidad de un
cambio de `borrador` a `publicado`.

Añadir RLS aquí:

- **no sustituiría al trigger** — habría que mantener los dos;
- **sí añadiría** una cosa útil y una sola: que `anon` y `authenticated` no vean las piezas en
  `borrador` ni `en_revision` en un `SELECT` directo. Hoy eso lo resuelve el filtro de la aplicación
  (`contentService.ts`), no la base.

**Recomendación:** `content_items` va en el último grupo, con una única política de `SELECT`
(`status = 'publicado' OR author_id = auth.uid() OR get_my_role() = 'admin'`) y **sin políticas de
escritura**, dejando el alta y la edición donde ya funcionan: trigger + columnas. No duplicar la máquina
de estados en dos lenguajes distintos.

---

## 10. Riesgos y criterios de activación (Fase 9)

| Riesgo | Probabilidad | Mitigación |
| :--- | :--- | :--- |
| Las 8 políticas de categoría E rompen pantallas con `42501` | **Alta si se activa hoy** | Reescribirlas sobre `is_therapist_of()` **antes** de tocar RLS |
| `clinical_prescriptions` queda "protegida" pero legible por todos | Alta | Borrar esa política antes de activar la tabla |
| Se activa RLS y se da por protegido lo que va por RPC | **Muy alta — es el riesgo principal de este sprint** | Documentado aquí; la autorización de las 31 RPC sigue viviendo en su cuerpo |
| Un `SELECT` que hoy devuelve filas pase a devolver 0 en silencio | Media | Activar tabla a tabla, verificando el recorrido de la app entre cada una |
| Rollback sin PITR | **Alta** | `ALTER TABLE … DISABLE ROW LEVEL SECURITY` es inmediato y no destruye datos. Aun así: **PITR sigue deshabilitado con cero copias** |

### Orden de activación propuesto

1. **Grupo 0 — preparatorio, sin activar nada:** reescribir las 8 políticas rotas, borrar la de
   `clinical_prescriptions`, borrar las 2 de `guides`, cambiar `roles=public` por `TO authenticated`.
2. **Grupo 1 — bajo riesgo:** `mood_entries`, `user_preferences`, `user_guide_progress`,
   `therapist_time_blocks`, `notifications`.
3. **Grupo 2 — clínicas de acceso directo:** `clinical_notes`, `clinical_alerts`, `patient_anamnesis`,
   `psychometric_evaluations`, `clinical_consents`.
4. **Grupo 3 — relación:** `profiles`, `patient_therapist`, `therapy_sessions`, `appointments`.
5. **Grupo 4 — público y editorial:** `crm_leads`, `blog_comments`, `public_test_submissions`,
   `content_items`.

Un grupo por sprint, con backup, migración idempotente aplicada dos veces y verificación del recorrido.

---

## 11. Criterios de parada (Fase 10)

Cualquier sprint de activación se detiene si: aparece una política cuyo comportamiento no pueda
determinarse ejecutándola · una tabla cambia de owner · aparece un rol nuevo con `bypassrls` · una RPC
deja de ser `DEFINER` · el recorrido de la aplicación falla tras activar un grupo · o la huella md5 de la
ACL cambia sin migración que lo explique.

---

## 12. Lo que este sprint decidió NO hacer

No se activó RLS en ninguna tabla. No se corrigió ninguna de las 8 políticas rotas, ni la de
`clinical_prescriptions`, aunque el problema esté demostrado: **la regla del proyecto es que un problema
descubierto durante un sprint se documenta pero no se corrige en él.** Son el contenido del Grupo 0.

---

## 13. Deuda que sigue abierta y no depende de RLS

- **PITR deshabilitado, cero copias de seguridad.** Sigue siendo el riesgo mayor del proyecto y solo el
  responsable puede activarlo.
- Clave de Resend comprometida, pendiente de rotación.
- `current_user_role()` duplica `get_my_role()`.
- 10 códigos de error del trigger editorial sin traducción en React.
- Default privileges de `FUNCTIONS` y `SEQUENCES` sin tocar (decisión del sprint 4P, con motivo).

---

## 14. Validación final (Fase 11)

```
tablas en public ............ 37   (esperado 37)
con RLS activo .............. 0    (esperado 0)
con FORCE RLS ............... 0    (esperado 0)
politicas ................... 48   (las mismas)
triggers de usuario ......... 42
funciones en public ......... 274
md5 ACL de las 37 tablas .... 64cdb69b1241ea34ac996556da08dc19
filas: messages=4  therapy_sessions=21  content_items=26  journey_events=58
```

La huella md5 coincide con la registrada en `20260808b_default_privileges_tables.sql`. **Sprint 4Q
cerrado sin modificar nada.**
