# Diagnóstico RLS — `content_items` + `content_items_meta`

**Fecha:** 2026-08-12
**Alcance:** diagnóstico y diseño. **No se aplicó ninguna migración.** No se creó ninguna política,
no se activó RLS, no se modificó la vista, ni ACL, ni triggers, ni funciones, ni frontend.
Todas las mediciones se hicieron dentro de transacciones revertidas con `RAISE EXCEPTION`.

**Estado del catálogo al abrir y al cerrar el sprint — idéntico:**
37 tablas · RLS 19/37 · FORCE 0/37 · 65 políticas · 41 triggers · 273 funciones · 62 FK.
Las ocho huellas (ACL `64cdb69b…`, políticas `f3b436a3…`, FK `b9087924…`, índices `77e58883…`,
triggers `3d2e64ad…`, funciones `6d9ef54e…`, estado RLS `5da5bff4…`, vistas `0353a679…`) **COINCIDEN**.

---

## Estado actual

### `public.content_items` (tabla)

| Propiedad | Valor |
|---|---|
| RLS | **false** |
| FORCE | false |
| Propietario | `postgres` (`bypassrls = true`) |
| Políticas | **0** |
| Filas | 26 |
| Columnas | 32 |
| Índices | 11 |
| CHECKs | 4 |
| Triggers | 2 |

**ACL:** `{postgres=arwdDxtm, anon=rm, authenticated=rm, service_role=arwdDxtm}`
→ a nivel de tabla, `anon` y `authenticated` tienen **SELECT sobre todo**. La escritura no está
concedida a nivel de tabla sino **por columna**:

- `INSERT` para `authenticated` en 9 de 32 columnas: `content_type, audio_kind, categoria, titulo,
  resumen_breve, tiempo_lectura, body_md, status, author_id`.
- `UPDATE` para `authenticated` en 17 columnas.

**Triggers:**
- `trg_content_authorization` — `BEFORE INSERT OR UPDATE`, `SECURITY DEFINER`. Es el control de
  autorización editorial real hoy (el que devuelve `CONTENT_AUTHOR_MISMATCH` y `CONTENT_AUTHOR_ROLE`).
- `trg_content_items_updated_at`.

**CHECK relevante para el diseño:**
`content_items_blog_es_publico_check CHECK ((content_type <> 'blog') OR (min_plan = 'free'))`
→ **toda pieza de blog tiene `min_plan = 'free'` por invariante de esquema.** Esto es lo que permite
que una política basada en plan no rompa el blog público.

**FK entrantes:** `content_revisions.content_id` y `blog_comments.post_id`.

### Datos

| Corte | Valores |
|---|---|
| `status` | 26 `publicado`, 0 en cualquier otro estado |
| `min_plan` | free 10 · esencial 4 · integral 4 · **premium 8** |
| `content_type` | articulo 6 · audio 6 · blog 2 · herramienta 6 · programa 6 |
| `author_id` | **las 26 son del admin `fa4c4b96`**; el terapeuta tiene 0 |

Que el terapeuta tenga 0 piezas es **dato, no defecto**: obligó a sembrar un borrador para poder
medir de verdad la rama de autoría (ver más abajo).

### `public.content_items_meta` (vista)

| Propiedad | Valor |
|---|---|
| Propietario | `postgres` (`bypassrls = true`) |
| `reloptions` | **NULL → `security_invoker` NO está definido** |
| `security_barrier` | no |
| ACL | `{anon=rxtm, authenticated=rDxtm}` |
| Definición | **proyección pura de columnas, SIN cláusula `WHERE`** |

Expone 15 de 32 columnas: `id, content_type, audio_kind, categoria, titulo, slug, resumen_breve,
cover_image, tiempo_lectura, min_plan, tags, status, published_at, admite_comentarios, theme_key`.

Oculta, entre otras: `body_md, en_resumen, faq, key_takeaway, clinical_refs, audio_url,
external_embed_url, program_steps, author_id, reviewed_by, review_notes, published_by`.

La vista es una **fachada de columnas, no un filtro de filas**. No decide quién ve qué: hoy devuelve
las 26 piezas a cualquiera.

---

## Consumidores reales

**17 en total: 13 contra la tabla, 4 contra la vista.** Todos en `src/lib/api/`.

### Contra la vista `content_items_meta` (4 — solo lectura)

| Consumidor | Qué hace |
|---|---|
| `contentService.ts:138` `listPublishedContent` | filtra `status='publicado'`, `min_plan IN allowedPlans(plan)`, `content_type IN LIBRARY_TYPES` |
| `contentService.ts:200` | busca por `slug` |
| `contentService.ts:232` `listBlogArticles` | **sin filtro de plan** — el blog es público por definición |
| `contentService.ts:248` `getBlogArticleBySlug` | por `slug` |

### Contra la tabla `content_items` (13)

| Consumidor | Operación |
|---|---|
| `contentService.ts:166` `getContentBySlug` | SELECT `*` — **es el que sirve `body_md`** |
| `contentService.ts:262` `listMyContent` | SELECT por `author_id` |
| `contentService.ts:353` `listReviewQueue` | SELECT (cola de revisión) |
| `contentService.ts:367` `listAllContent` | SELECT (admin) |
| `contentService.ts:324` `createContentDraft` | **INSERT + `.select()`** |
| `contentService.ts:336` `updateContentDraft` | UPDATE |
| `contentService.ts:343` `submitForReview` | UPDATE |
| `contentService.ts:379` `approveContent` | UPDATE |
| `contentService.ts:396` `requestContentChanges` | UPDATE |
| `contentService.ts:423` `publishContent` | UPDATE |
| `contentService.ts:443` `archiveContent` | UPDATE |
| `blogCommentsService.ts:136` `listCommentQueue` | JOIN embebido `content_items!inner(slug, titulo, author_id)` |
| `blogCommentsService.ts` (moderación) | lectura del post asociado |

El reparto importa: **la vista nunca expone `body_md`; la tabla sí.** El acceso de pago se juega
en `getContentBySlug:166`.

---

## Riesgos actuales

Medido hoy, con RLS desactivado:

```
anon     SELECT content_items (TABLA) ....... 26 piezas
anon     ... de las cuales premium ..........  8 piezas PREMIUM      <<< sin sesión
anon     body_md de esas 8 ..................  8 CUERPOS COMPLETOS   <<< FUGA
anon     SELECT content_items_meta .......... 26 piezas
anon     INSERT ............................. denegado 42501 (por ACL, no por RLS)
paciente FREE  body_md de las premium .......  8 cuerpos legibles    <<< FUGA
admin    SELECT todo ........................ 26 piezas
```

**El muro de pago no existe a nivel de datos.** Hoy lo aplica exclusivamente el frontend: la consulta
filtra por `allowedPlans(plan)` antes de pedir. Cualquiera con la `anon key` — que es pública por
diseño en una app de navegador — puede pedir la tabla directamente y leer íntegro el cuerpo de las
8 piezas premium sin sesión, sin plan y sin pagar.

Riesgo secundario: hoy no hay contenido no publicado, así que no hay fuga editorial *de facto*.
Pero en cuanto exista un borrador, sería igual de legible por `anon`. La fuga es estructural, no
depende del estado actual de los datos.

Aclaración de alcance, para no exagerar: esto **no expone datos clínicos ni personales**.
`content_items` es contenido editorial. El daño es comercial y de propiedad intelectual, no de
confidencialidad de pacientes.

---

## Comportamiento de `content_items_meta`

Es el hallazgo que hizo aplazar esta tabla en el Grupo 4, y se confirma:

**Una vista sin `security_invoker` se ejecuta con los permisos de su propietario.** El propietario es
`postgres`, que tiene `bypassrls = true`. Por tanto, **la vista ignora por completo cualquier RLS que
se active sobre `content_items`.**

Consecuencia práctica: activar RLS en la tabla y no tocar la vista deja 4 de los 17 consumidores
—incluidos los dos del blog y el listado principal de la biblioteca— operando por un canal que no
respeta ninguna política. La tabla quedaría protegida y la vista seguiría sirviendo las 26 piezas.

La vista no expone `body_md`, así que la fuga por ese canal es de **metadatos** (títulos, resúmenes,
portadas, `min_plan`, `slug`), no de cuerpos. Es menos grave que la fuga por la tabla, pero convierte
la protección en parcial y —sobre todo— **en engañosa**: el catálogo diría RLS activo.

---

## Resultado de A / B / C

### Escenario A — RLS + 3 políticas de SELECT, vista intacta

```
tabla ..... 10 piezas para anon          ✔ protegida
vista ..... 26 piezas para anon, de ellas 8 premium   ✘ sin filtrar
```

**Protección aparente.** El catálogo marcaría `content_items` con RLS y la biblioteca seguiría
listando todo a quien no ha pagado. Es el peor resultado posible: cierra el canal que se audita y
deja abierto el que no.

### Escenario B — lo mismo + `ALTER VIEW public.content_items_meta SET (security_invoker = true)`

```
anon        vista ...................... 10   ✔
anon        blog ........................ 2   ✔ (el CHECK garantiza blog = free)
paciente premium  vista ............... 26   ✔
paciente free     body_md premium ....... 0   ✔
paciente free     vista ................ 10   ✔
admin       tabla y vista .............. 26   ✔
cola de moderación (JOIN) ............... 1   ✔
```

Funciona. **Requiere tocar la vista**, que estaba explícitamente fuera del alcance del Grupo 4 —
por eso este sprint existe.

### Escenario C — la divergencia frontend/SQL

Al medir B con actores reales apareció un desajuste que ninguna lectura del código habría dado por
sí sola:

```
React getViewerPlan()  : si role IN (admin, therapist) -> devuelve "premium"
SQL   get_my_plan_rank(): plan_rank(plan_type), SIN mirar el rol

  admin       fa4c4b96   plan_type = free   -> plan_rank = 0
  therapist   104db81c   plan_type = free   -> plan_rank = 0

  terapeuta: get_my_plan_rank() = 0     (en React ve como premium = 3)
  DIVERGENCIA: SÍ la hay
```

`guidesService.ts:92-110` trata a admin y terapeuta como premium por rol. El SQL solo mira
`plan_type`, y **ambos lo tienen en `free` en los datos reales**. Una política escrita solo sobre el
plan dejaría al equipo clínico viendo 10 piezas donde hoy ve 26: una regresión funcional silenciosa,
no un cierre de fuga.

Con la rama de rol clínico añadida a la política y un borrador del terapeuta sembrado:

```
terapeuta  SELECT todo ................. 27   ✔ 26 publicadas + su borrador
terapeuta  sus propias piezas .......... 1    ✔ listMyContent:262
anon       SELECT tabla ................ 10   ✔ 10 free, NO el borrador
anon       SELECT vista ................ 10   ✔
anon       el borrador por la vista ..... 0   ✔
admin      borradores ajenos ........... 1    ✔ listAllContent / listReviewQueue
admin      SELECT todo ................. 27   ✔
pac. free  el borrador del terapeuta .... 0   ✔
pac. free  body_md premium .............. 0   ✔
```

### El lado de escritura — medido aparte

Con RLS activo **y solo políticas de SELECT**, los 7 consumidores de escritura se rompen:

```
terapeuta INSERT sin returning ......... 42501  new row violates row-level security policy
terapeuta INSERT con returning ......... 42501  ídem
admin     UPDATE de una pieza ........... 0 filas   <<< FALLO SILENCIOSO
```

El `UPDATE` es el peligroso: no lanza error, devuelve 0 filas. `approveContent`, `publishContent`,
`requestContentChanges` y `archiveContent` dejarían de funcionar **sin que nadie se entere**. Es el
mismo patrón que ya apareció en `appointments` y en `clinical_alerts`.

Añadiendo una política de INSERT y una de UPDATE:

```
terapeuta INSERT con returning ......... OK   (createContentDraft:324)
terapeuta UPDATE de SU borrador ........ 1 fila   (updateContentDraft:336)
terapeuta submitForReview .............. 1 fila   (submitForReview:343)
terapeuta UPDATE de una pieza AJENA .... 0 filas   ✔ no la toca
terapeuta INSERT con author_id AJENO ... P0001 CONTENT_AUTHOR_MISMATCH   ✔ el trigger sigue cortando
admin     UPDATE de una pieza ajena ..... 1 fila   (approve / publish / archive)
paciente  INSERT ....................... P0001 CONTENT_AUTHOR_ROLE       ✔ el trigger sigue cortando
```

Dos cosas quedan demostradas: RLS **no sustituye** al trigger `enforce_content_authorization`
(sigue siendo quien aplica la regla editorial), y el trigger **no sustituye** a RLS (no filtra lectura).
Son capas distintas y ambas hacen falta.

---

## Políticas mínimas propuestas

**Cinco políticas + un cambio en la vista.** Ninguna se aplica en este sprint.

```sql
-- 1. lectura pública por plan, con rama de rol clínico (resuelve la divergencia del Escenario C)
CREATE POLICY "Public reads published content within plan"
  ON public.content_items FOR SELECT TO anon, authenticated
  USING (
    status = 'publicado'
    AND (
      public.plan_rank(min_plan) <= public.get_my_plan_rank()
      OR public.get_my_role() = ANY (ARRAY['admin'::user_role, 'therapist'::user_role])
    )
  );

-- 2. cada autor ve lo suyo, publicado o no  (listMyContent:262)
CREATE POLICY "Authors read their own content"
  ON public.content_items FOR SELECT TO authenticated
  USING (auth.uid() = author_id);

-- 3. el admin ve todo  (listAllContent:367, listReviewQueue:353)
CREATE POLICY "Admins read all content"
  ON public.content_items FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- 4. alta a nombre propio  (createContentDraft:324)
CREATE POLICY "Authors create their own content"
  ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- 5. edición: el autor lo suyo, el admin todo  (los 6 UPDATE)
CREATE POLICY "Authors and admins update content"
  ON public.content_items FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.get_my_role() = 'admin')
  WITH CHECK (true);
```

```sql
ALTER VIEW public.content_items_meta SET (security_invoker = true);
```

**Sin política de DELETE**, deliberadamente: `authenticated` no tiene `d` en la ACL y el flujo
editorial archiva en vez de borrar. Sin política, el DELETE queda cerrado, que es lo correcto.

**Sobre `WITH CHECK (true)` en la política 5:** es intencional, no descuido. El estado destino de
cada transición (`en_revision`, `aprobado`, `publicado`, `archivado`) ya lo gobiernan
`enforce_content_authorization` y los CHECK de la tabla. Duplicar esa lógica en la política crearía
una segunda fuente de verdad que se desincronizaría. La política decide **sobre qué fila** se puede
escribir; el trigger decide **qué escritura es válida**.

Notas de diseño que conviene dejar por escrito:
- La rama de rol clínico en la política 1 es **paridad con el comportamiento actual de React**, no
  una decisión nueva de negocio. Si algún día se decide que el equipo clínico no debe ver todo el
  catálogo, hay que cambiarlo en los dos sitios a la vez.
- El blog no necesita una política propia: el CHECK `blog ⇒ min_plan = 'free'` y `plan_rank('free') = 0`
  hacen que la política 1 lo deje pasar siempre. Verificado: `anon` lee los 2 posts.
- `plan_rank()` y `get_my_plan_rank()` ya existen y ya se usan en otras políticas; no se crea nada.

---

## Riesgos de romper consumidores

| Riesgo | Estado |
|---|---|
| `listPublishedContent`, `listBlogArticles`, los 2 por `slug` (vista) | cubiertos por B — **exigen `security_invoker`** |
| `getContentBySlug:166` (`select("*")`, sirve `body_md`) | cubierto por la política 1 |
| `listMyContent:262` | cubierto por la 2 — **verificado con un borrador sembrado**, no asumido |
| `listAllContent:367`, `listReviewQueue:353` | cubiertos por la 3 |
| `createContentDraft:324` — `INSERT` + `.select()` | **exige la 4 Y la 2**: el `RETURNING` necesita política de SELECT. Es la regla que ya mordió en `appointments` y en `public_test_submissions`. Aquí está medido, no supuesto |
| Los 6 `UPDATE` | cubiertos por la 5. Sin ella: **0 filas en silencio** |
| `blogCommentsService.ts:136` — JOIN `content_items!inner` | verificado: la cola de moderación devuelve 1 |
| Los 31 RPC `SECURITY DEFINER` de `postgres` | no afectados (`bypassrls`) |

Riesgo residual asumido: si en el futuro se crea un consumidor nuevo con `anon` que necesite leer
piezas no publicadas, fallará devolviendo 0 filas en vez de un error. Es el modo de fallo de RLS en
lectura y no se puede evitar; queda anotado.

---

## Criterios de parada

Este sprint **para aquí por diseño**. Además, hay tres condiciones que detendrían la aplicación:

1. **Aprobación explícita de `ALTER VIEW`.** Sin ella no se aplica nada: el Escenario A por sí solo
   es peor que no hacer nada, porque produce protección aparente. Si el `ALTER VIEW` no se aprueba,
   la recomendación es **no activar RLS en `content_items`**.
2. **Confirmación de la rama de rol clínico.** Es una decisión de producto disfrazada de detalle
   técnico: ¿admin y terapeuta deben seguir viendo todo el catálogo con `plan_type = 'free'`?
   La propuesta replica lo que hace React hoy. Si la respuesta es no, la política cambia.
3. **Cualquier medición ambigua durante la aplicación** (0 filas que puedan explicarse por dato
   vacío en vez de por política) se aísla y se repite antes de concluir, como en los grupos anteriores.

---

## Recomendación

**Aplicar el Escenario B completo, en un sprint propio, con las cinco políticas y el `ALTER VIEW` juntos.**

El razonamiento:

- Hay una **fuga real y medida hoy**: 8 cuerpos premium completos legibles sin sesión. No es teórica.
- **No se puede partir en dos sprints.** Aplicar las políticas sin el `ALTER VIEW` deja la fuga de
  metadatos abierta y —peor— hace creer que está cerrada. Aplicar el `ALTER VIEW` sin las políticas
  no cambia nada, porque no hay RLS que invocar. Es la primera vez en todo el plan de RLS que un
  sprint necesita tocar dos objetos a la vez, y la razón está medida, no supuesta.
- **Las escrituras entran en el mismo sprint.** Separarlas dejaría el flujo editorial roto en
  silencio entre un sprint y el siguiente.
- El trigger `enforce_content_authorization` **no se toca**. Sigue siendo el que aplica la regla
  editorial; RLS solo añade el filtro de filas que hoy no existe.

Alternativa si el `ALTER VIEW` no se aprueba: dejar `content_items` sin RLS y anotar la fuga como
riesgo aceptado. Es una posición defendible —el daño es comercial, no clínico— pero debe quedar
escrita como decisión, no como olvido.

---

## Cierre — aplicado el 13 de agosto de 2026

El diseño se aprobó completo (Escenario B) y se aplicó en `20260813_content_items_rls.sql`, con
backup en `backups/20260813_pre_content_items_rls.sql`. **RLS 19 → 20 de 37; políticas 65 → 70.**

La crónica de la aplicación —fuga cerrada con cifras antes/después, los 17 consumidores validados,
las cuatro pasadas de idempotencia, los invariantes y el round-trip de reversión— está en
`Blindaje_Seguridad_Contenido_2026-08-07.md`, sección *«Content Items — RLS y `security_invoker`»*.

**Una corrección a este diagnóstico, salida del aislamiento posterior:** aquí se listó el `UPDATE`
de un paciente sobre pieza ajena entre lo que RLS cerraría. **No es así.** Con RLS apagado esa misma
sentencia ya fallaba con `P0001 CONTENT_NOT_AUTHOR`: la cerraba el trigger. RLS añade una segunda
capa y cambia el modo de fallo, pero el agujero no estaba abierto. Lo mismo con el `DELETE` y las
escrituras de `anon`: los corta la **ACL** (`permission denied for table`), no RLS.

**Lo que este sprint cerró de verdad es la lectura** —los 8 cuerpos premium legibles sin sesión—,
y eso sí estaba abierto y medido.
