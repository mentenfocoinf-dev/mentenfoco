# Diagnóstico RLS — `clinical_guides` + `clinical_guides_meta`

**Fecha:** 2026-08-13
**Alcance:** diagnóstico. **Sin migración, sin backup, sin políticas nuevas, sin RLS permanente, sin
tocar `security_invoker`.** No se modificó ACL, triggers, funciones, FK, índices, frontend ni RPC.
Todas las simulaciones dentro de transacciones revertidas.

Baseline al abrir y al cerrar — **idéntico**: 29 criterios, 6 huellas globales y huella de datos de
la tabla `676fd831…`.

---

## 1. Baseline

### `public.clinical_guides`

```
relrowsecurity = false · relforcerowsecurity = false · reloptions = (NULL) · owner = postgres
filas = 20 · triggers = 0 · FK salientes = 0 · FK entrantes = 0 · índices = 2
funciones que la citan = 0 · Realtime = 0
ACL: postgres=arwdDxtm · anon=rxtm · authenticated=rm · service_role=arwdDxtm
     -> efectiva: anon r--- · authenticated r---   (solo SELECT en ambos)
huella de datos = 676fd831bd27ab20cf1a4656d943a253
```

**Ya tiene una política, del Grupo 0, y está inerte porque RLS está apagado:**

```sql
"Guides readable by plan level"  [SELECT]  roles {public}
USING ( plan_rank(min_plan) = 0
        OR get_my_plan_rank() >= plan_rank(min_plan)
        OR get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role]) )
```

Nótese que el rol es `{public}`, no `authenticated`: es uno de los dos flujos públicos que el
Grupo 0 dejó fuera del acotamiento a propósito.

**Columnas (14):** `id, categoria, etiquetas, titulo, descripcionBreve, tiempoLectura, imageName,
fundamentoClinico, ejercicioPractico, es_premium, contenidoCompleto, min_plan,
visible_en_plan_gratis, theme_key`. Sin CHECKs. Enums: `plan_type` (free/esencial/integral/premium)
y `theme_key` (15 valores).

**Datos:** 15 guías `free` + 5 `esencial`. Las 20 tienen `contenidoCompleto`, **4.523 caracteres de
media**.

### `public.clinical_guides_meta`

```
owner = postgres (bypassrls = true) · reloptions = (NULL)  -> SIN security_invoker
security_barrier = no
ACL: anon=rxtm · authenticated=rDxtm · efectiva r--- en ambos
```

Definición: **proyección pura de 11 de las 14 columnas, sin `WHERE`**.
**Oculta exactamente las tres columnas de contenido:** `fundamentoClinico`, `ejercicioPractico` y
`contenidoCompleto`. Esa diferencia con `content_items_meta` importa y se desarrolla en §5.

---

## 2. Consumidores de `clinical_guides`

**Uno solo. Ningún INSERT, UPDATE, DELETE, upsert, RPC, Edge Function ni embed.**

| Archivo:línea | Op | Columnas | Filtros | `.select()` | `RETURNING` | Actor |
|---|---|---|---|---|---|---|
| `guidesService.ts:142` `getGuide` | SELECT | `*` — **incluye `contenidoCompleto`** | `id = guiaId` **y** `min_plan IN allowedPlans(plan)` | — | no | cualquiera, incluido `anon` |

Lo consumen `routes/guias.$guiaId.tsx:12` (**ruta pública, sin guardia**) y
`recentResources.ts:55`.

**Depende de `min_plan`: sí.** **De `es_premium`: no.** Cero funciones SQL lo tocan.

## 3. Consumidores de `clinical_guides_meta`

**Tres, todos SELECT, todos filtrando por `min_plan`.**

| Archivo:línea | Columnas | Filtros | Actor | Por qué la vista |
|---|---|---|---|---|
| `guidesService.ts:120` `listGuides` | `*` (los 11 metadatos) | `min_plan IN allowedPlans(plan)`, `order titulo` | cualquiera, incl. `anon` | el catálogo **no necesita el contenido**; la vista evita traer 4,5 KB por fila |
| `recommendationsService.ts:357` `buscarGuias` | 7: `id, titulo, descripcionBreve, categoria, tiempoLectura, imageName, theme_key` | `min_plan IN planes` + filtro por `etiquetas` | motor de recomendaciones | ídem |
| `contentService.ts:210` | `id` | `id IN (...)`, `min_plan IN planes` | comprobación de alcanzabilidad | ídem |

`listGuides()` lo llaman `routes/guia.tsx:25` y **`routes/index.tsx:36` — la portada**. Ambas rutas
son **públicas, sin guardia de sesión**, así que **`anon` debe seguir leyendo la vista**.

La vista **no es una comodidad**: es una separación deliberada entre metadatos y contenido. Es la
razón por la que el catálogo público nunca ha servido los 4,5 KB de cada guía.

---

## 4. Modelo actual de acceso

**La autoridad hoy es el frontend. No la ACL, no la vista, no la política.**

- La **ACL** concede `SELECT` sobre las 20 filas a `anon` y a `authenticated`, sin distinción de plan.
- La **política existe pero está inerte**: RLS está apagado.
- La **vista** oculta columnas, no filas: no filtra por plan.
- El **filtro real** es `.in("min_plan", allowedPlans(plan))`, en los cuatro consumidores.

`min_plan` es la única columna con autoridad. Medido:

- `es_premium` coincide con `min_plan <> 'free'` en las 20 filas — **0 discrepancias**; es redundante
  y no se usa en ningún filtro.
- `visible_en_plan_gratis` tiene **11 discrepancias** con `min_plan = 'free'`. Es una columna
  vestigial, y el propio código lo dice: *«`visible_en_plan_gratis` ya no participa del control de
  acceso»* (`guidesService.ts:10`).

---

## 5. Riesgos reales

### Fuga de contenido — **real y medida**

```
RLS APAGADO (hoy)      TABLA  VISTA  contenidoCompleto  de las 5 esencial
anon                     20     20         20                  5
paciente free            20     20         20                  5
paciente esencial        20     20         20                  5
terapeuta / admin        20     20         20                  5
```

**Cualquiera, sin sesión, lee las 5 guías de pago con su contenido completo.** Es el mismo patrón que
`content_items`: el muro de pago no existe a nivel de datos.

Volumen menor que en `content_items` —5 guías `esencial` frente a 8 piezas `premium`— y el escalón
es el más bajo de pago, pero la naturaleza del defecto es idéntica.

### Fuga de metadatos — condicional

Solo aparece en el Escenario A (§6). Serían título, categoría, etiquetas, imagen y `min_plan` de las
5 guías de pago. **No incluye contenido**, porque la vista lo oculta.

### Acceso premium no autorizado

Es la misma fuga de contenido: no hay un canal separado.

### Escritura no autorizada — **ninguna**

`anon` y `authenticated` solo tienen `SELECT`. Cero triggers, cero consumidores de escritura. El
contenido lo carga un seeder con `service_role`.

### Otros — un hallazgo colateral, que NO corrijo

`anon` conserva **`REFERENCES` y `TRIGGER`** sobre 10 objetos, y `authenticated` sobre las **dos
vistas**:

```
blog_comments · cie11_directory · clinical_guides · guides · journey_events
public_test_submissions · public_tests · test_scores      -> anon[xt]
clinical_guides_meta · content_items_meta                 -> anon[xt] auth[xt]
```

El sprint 4N cerró `H-TRIGGER-001` para `authenticated` **sobre tablas**; `anon` lo conserva, y las
**vistas** quedaron fuera de aquella barrida. Aplica la misma salvedad que entonces: `anon` y
`authenticated` son NOLOGIN y PostgREST no ejecuta DDL, así que explotarlo exige una conexión directa
a la base, que ya es un compromiso previo. **Se documenta; modificar ACL está fuera de este sprint.**

---

## 6. Resultado simulación A — RLS de tabla, vista SIN `security_invoker`

Usando **la política que ya existe**, sin crear ninguna:

```
                  TABLA  VISTA   contenido esencial
anon                15     20            0
paciente free       15     20            0
paciente esencial   20     20            5
paciente premium    20     20            5
terapeuta           20     20            5
admin               20     20            5
```

**La vista esquiva RLS**: la tabla filtra correctamente a 15 para quien no paga, y la vista sigue
devolviendo 20 a todo el mundo. Es **protección aparente**, el mismo hallazgo que obligó a tratar
`content_items` y su vista en la misma migración.

**Matiz que la diferencia de `content_items`:** aquí la vista **no expone el contenido**, así que la
fuga por ese canal sería de metadatos, no de los 4,5 KB de cada guía. Menos grave, pero igual de
engañoso: el catálogo diría RLS activo y el listado público seguiría mostrando las 5 de pago.

---

## 7. Resultado simulación B — RLS + `security_invoker`

```
                  TABLA  VISTA   contenido esencial
anon                15     15            0
paciente free       15     15            0
paciente esencial   20     20            5
paciente premium    20     20            5
terapeuta           20     20            5
admin               20     20            5
```

Los cuatro consumidores reales:

```
listGuides:120 como anon .................. 15   OK: las 15 free
getGuide:142 anon, guía free .............. 1    OK
getGuide:142 anon, guía esencial .......... 0    OK: RLS la corta
recommendationsService:357 como anon ...... 15
listGuides:120 paciente esencial .......... 20   OK: las 20
terapeuta: get_my_plan_rank() = 0, ve ..... 20   OK: la rama de rol de la política funciona
```

**Ningún consumidor se rompe.** Distinción de capas: los 15 de `anon` son de **RLS** (la política
`plan_rank(min_plan) = 0`); el 0 de las esencial es **RLS**; no interviene ACL —ambos roles tienen
`SELECT`—, ni trigger —no hay—, ni ausencia de datos —las 5 filas existen y el admin las ve—.

---

## 8. Modelo de plan

**No hace falta decidir nada nuevo: la política del Grupo 0 ya expresa el modelo correcto**, y a
diferencia de `content_items` **no hay divergencia entre React y SQL**.

| Actor | Debe ver | Lo consigue por |
|---|---|---|
| `anon` | las 15 guías `free`, con contenido | `plan_rank(min_plan) = 0` |
| paciente `free` | las 15 `free` | ídem |
| paciente `esencial`+ | las 20 | `get_my_plan_rank() >= plan_rank(min_plan)` |
| `therapist` | las 20, aunque su `plan_type` sea `free` | **la rama de rol ya está en la política** |
| `admin` | las 20 | ídem |
| `service_role` | todo | `bypassrls`, por diseño |

`getViewerPlan()` (`guidesService.ts:92-110`) devuelve `"premium"` para admin y terapeuta; la política
SQL tiene la rama equivalente. **Coinciden.** Verificado: el terapeuta, con `get_my_plan_rank() = 0`,
ve las 20.

**La política del Grupo 0 sigue siendo correcta con RLS activo.** No hay que modificarla.

---

## 9. Políticas mínimas propuestas

**Ninguna nueva.** Es el primer sprint del plan en el que la tabla ya trae la política correcta y
solo hay que encenderla.

```sql
-- No se crea ninguna política. La existente ya cubre el modelo:
--   "Guides readable by plan level"  [SELECT]  {public}
--   USING (plan_rank(min_plan) = 0
--          OR get_my_plan_rank() >= plan_rank(min_plan)
--          OR get_my_role() = ANY (ARRAY['admin'::user_role,'therapist'::user_role]))

ALTER TABLE public.clinical_guides ENABLE ROW LEVEL SECURITY;
ALTER VIEW  public.clinical_guides_meta SET (security_invoker = true);
```

- **Sin INSERT / UPDATE / DELETE:** cero consumidores de escritura y la ACL solo concede `SELECT`.
  Crear políticas de escritura sería inventar una necesidad que no existe.
- **Sin tocar la política existente:** cambiarla sería duplicar una lógica que ya funciona.
- **Columnas sensibles:** `contenidoCompleto`, `fundamentoClinico` y `ejercicioPractico`. La vista ya
  las oculta; la política decide qué filas.
- **Cómo se preserva el hub público:** la rama `plan_rank(min_plan) = 0` deja pasar las 15 guías
  `free` a `anon`, y la política es `{public}`, no `authenticated`. Verificado: portada y `/guia`
  siguen mostrando 15.

---

## 10. Tratamiento de `clinical_guides_meta`

**Debe recibir `security_invoker = true`, y en la MISMA migración que el `ENABLE RLS`.**

Está demostrado, no supuesto: sin él la vista devuelve 20 a todo el mundo (§6). Y por sí solo, sin
RLS en la tabla, no cambia nada. **Son inseparables**, exactamente por la razón que hizo inseparables
`content_items` y su vista.

No hace falta redefinir la vista: solo cambia una *reloption*. El rollback debe usar
`RESET (security_invoker)` para devolver `reloptions` a `NULL`, no a `false`.

---

## 11. Riesgos de regresión

| Consumidor | Riesgo | Cómo se comprobará |
|---|---|---|
| `guidesService.ts:120` `listGuides` (vista) | portada y `/guia` vacías para `anon` | contar 15 como `anon`, 20 como `esencial` |
| `guidesService.ts:142` `getGuide` (tabla) | `/guias/$id` devolvería «no encontrada» para una guía free | 1 fila para una `free` como `anon`, 0 para una `esencial` |
| `recommendationsService.ts:357` | recomendaciones vacías | 15 filas visibles como `anon` |
| `contentService.ts:210` | alcanzabilidad rota | el `IN (...)` sigue devolviendo ids |
| terapeuta con `plan_type = free` | vería 15 en vez de 20 | la rama de rol ya lo cubre; verificar 20 |
| `anon` | perder el hub público | verificar 15 por tabla y por vista |

Sin `RETURNING` ni `.select()` tras escritura en ningún consumidor: **no aplica la regla del
`INSERT ... RETURNING`** que apareció en los cinco sprints anteriores.

---

## 12. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | ¿La vista evita RLS sin solución clara? | **No se activa.** La evita, pero la solución es conocida y ya probada en `content_items` |
| 2 | ¿`security_invoker` rompe un consumidor legítimo? | **No.** Los cuatro funcionan |
| 3 | ¿`min_plan` con semántica distinta React/SQL? | **No.** La política ya lleva la rama de rol clínico; coinciden |
| 4 | ¿`anon` necesita campos que la política no expone? | **No.** Sigue leyendo las 15 free completas |
| 5 | ¿Algún RPC con `bypassrls` haría la protección aparente? | **No.** Cero funciones citan la tabla |
| 6 | ¿Consumidor no documentado? | **No.** 1 + 3, todos localizados |
| 7 | ¿Columna derivada por trigger? | **No.** Cero triggers |
| 8 | ¿Algún `0 filas` sin causa distinguible? | **No.** Aislados por contraste |
| 9 | ¿Baseline no coincide? | **No.** 29 criterios OK |
| 10 | ¿Hace falta modificar ACL, funciones, triggers, FK o frontend? | **No.** Solo `ENABLE RLS` y una *reloption* |

**Ninguno se activa.**

---

## 13. Decisión requerida

**Diagnóstico completo. Diseño listo para aprobación. No se ha modificado nada.**

El sprint sería el más corto del plan: **dos sentencias, cero políticas nuevas**, y deben ir juntas.

Queda anotado, sin corregir y fuera de alcance: `anon` conserva `REFERENCES` y `TRIGGER` sobre 10
objetos y `authenticated` sobre las dos vistas — resto de `H-TRIGGER-001`, que el sprint 4N cerró
solo para `authenticated` sobre tablas.

---

---

## Cierre — aplicado el 13 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260813_clinical_guides_rls.sql`, con backup en
`backups/20260813_pre_clinical_guides_rls.sql`. **RLS 24 → 25 de 37; políticas 83 → 83.**
Las dos sentencias, cero políticas nuevas, la existente sin tocar.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Clinical Guides — RLS + `security_invoker`»*.

**Todo lo que este diagnóstico anticipó se confirmó al aplicar:** `anon` pasa de 20 a 15 por tabla y
por vista, deja de leer el `contenidoCompleto` de las 5 de pago, el paciente `esencial` conserva las
20, el terapeuta con `get_my_plan_rank() = 0` conserva las 20 por la rama de rol, los cuatro
consumidores funcionan y la vista sigue ocultando las tres columnas de contenido. **Sin sorpresas ni
límites nuevos.**

La comparación explícita contra el Escenario A quedó registrada: `tabla anon 15 · vista anon 15`
frente al `15 · 20` del escenario inseguro.

## Estado global del diagnóstico

```
RLS activo: 24/37 · FORCE: 0/37 · políticas: 83
ACL: sin cambios · triggers: sin cambios · FK: sin cambios · funciones: sin cambios
índices: sin cambios · vistas: sin cambios · datos permanentes: sin cambios
frontend: sin cambios · RPC: sin cambios · Realtime: sin cambios · commits: 0
```

**Artefactos y errores de guion, declarados:** tres intentos fallidos por errores míos —el alias `r`
de una subconsulta chocando con la variable `r` del bloque (`55000`), la columna
`"contenidoCompleto"` sin comillas (`42703`), y un `GROUP BY` incompleto (`42803`)—. Ninguno afectó a
la base: fallaron antes de ejecutar nada. Las simulaciones A y B activaron RLS y `security_invoker`
dentro de la transacción y se revirtieron con `DISABLE` y `RESET`.
