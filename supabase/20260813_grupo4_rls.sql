-- ============================================================================
-- GRUPO 4 — RLS en las tres tablas publicas aprobadas.
--
--   public.crm_leads                -> RLS ON, con sus 2 politicas existentes
--   public.public_test_submissions  -> RLS ON + 4 politicas nuevas
--   public.blog_comments            -> RLS ON + 5 politicas nuevas
--
-- **`content_items` queda EXPRESAMENTE FUERA**, aplazada a su propio sprint.
-- Ver la nota al final.
--
-- No toca ACL, `DEFAULT PRIVILEGES`, triggers, FK, funciones, RPC, columnas,
-- indices, datos, vistas ni React. Sin `FORCE RLS`.
--
-- RLS pasa de 16 a 19 de 37. Politicas: 56 -> 65.
--
-- Reversion: `supabase/backups/20260813_pre_grupo4_rls.sql`
--
--
-- ══ 1. crm_leads · ninguna politica nueva ═══════════════════════════════════
--
-- Sus 2 politicas existentes ya son las correctas: `Anyone can create a lead`
-- (INSERT `TO public`) para los formularios de `contactanos.tsx:64` y
-- `empresas.tsx:87`, y `Admins manage leads` (ALL) para el panel de
-- `AdminDashboard.tsx:118`.
--
-- Lo que aporta activar RLS es cerrar una fuga medida: **cualquier usuario con
-- sesion podia leer los leads comerciales con nombre, correo y telefono,
-- modificarlos y crearlos.** Antes y despues, con un paciente cualquiera:
--
--   SELECT leads ..... leia 1 con nombre, email y telefono  ->  0 filas
--   UPDATE leads ..... modificaba 1                         ->  0 filas
--
-- `anon` ya estaba cerrado para lectura por la ACL (`anon=am`, sin SELECT), y
-- sigue pudiendo insertar. El admin conserva lectura y gestion.
--
--
-- ══ 2. public_test_submissions · 4 politicas ════════════════════════════════
--
-- Tabla disenada para recepcion publica: la rellena quien hace un test sin
-- sesion. Los tres flujos que hay que conservar intactos son
-- `recordSubmission:171`, `attachEmailToSubmission:202/210` y
-- `listTestSubmissions:235`.
--
-- `recordSubmission` hace `.insert({...}).select("id")`, es decir un
-- **INSERT ... RETURNING**, y eso exige politica de SELECT. Medido:
--
--   anon INSERT ... RETURNING, solo con politica de INSERT .... 42501
--   anon INSERT sin RETURNING ................................. OK
--   anon INSERT ... RETURNING + politica de SELECT ............ OK
--   anon UPDATE del correo, sin politica de UPDATE ............ 0 filas
--
-- ── PARIDAD, NO AISLAMIENTO ─────────────────────────────────────────────────
--
-- `USING (true)` para `anon` en SELECT y UPDATE es **paridad con el
-- comportamiento actual, no una mejora de aislamiento**. La tabla no tiene
-- ninguna columna de pertenencia con la que acotar a un visitante sin sesion,
-- y no se inventa una que el modelo no soporta.
--
-- Lo que si acota el dano, y sigue en pie:
--   * la ACL de columna: `anon` solo puede leer `id`. Pedir `email` o `score`
--     devuelve `42501` — comprobado.
--   * el trigger `enforce_submission_append_only`: impide cambiar `test_slug`,
--     `score`, `banda` y `created_at`, y sobrescribir un correo ya registrado.
--
-- Lo que si mejora: el `SELECT` completo —con `email`— queda reservado al
-- admin. Un `authenticated` que no sea admin pasa de leer la tabla entera a
-- no ver nada.
--
--
-- ══ 3. blog_comments · 5 politicas ══════════════════════════════════════════
--
-- Cierra una fuga medida: **`anon` leia los comentarios NO aprobados.** Con
-- 1 aprobado y 1 pendiente en la base, un visitante sin sesion veia los 2.
-- Despues ve 1.
--
-- Las cinco politicas cubren los seis consumidores de `blogCommentsService`:
--
--   listPostComments:78   lectura publica de los aprobados      -> SELECT anon+auth
--   listPostComments:91   los propios aun no publicados         -> SELECT auth propio
--   listCommentQueue:136  cola de moderacion (con embed)        -> SELECT moderador
--   countPendingComments:177  badge de pendientes               -> el mismo SELECT
--   submitComment:110     alta de un comentario                 -> INSERT auth
--   moderateComment:165   aprobar o rechazar                    -> UPDATE moderador
--
-- ── Las dos politicas que consultan content_items ───────────────────────────
--
-- `Moderators read the queue` y `Moderators update comments` hacen
-- `EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = post_id AND
-- ci.author_id = auth.uid())`, para que un terapeuta modere **su** conversacion
-- y no la de los demas.
--
-- Eso depende de que `authenticated` pueda leer `content_items`. Hoy puede
-- (`authenticated=rm`, SELECT de tabla) y `content_items` **no tiene RLS** —
-- por eso queda fuera de este sprint. Comprobado sembrando un post de blog de
-- un terapeuta con un comentario pendiente: el terapeuta autor ve **1**, y de
-- un post ajeno solo ve el aprobado, que es publico.
--
-- **Es el mismo patron que rompio 8 politicas en el Grupo 0**: una politica que
-- consulta una tabla que el invocante no puede leer falla con `42501` en vez de
-- filtrar. Aqui no falla porque `content_items` sigue abierta a lectura.
--
-- ── Lo que las politicas NO duplican ────────────────────────────────────────
--
-- `enforce_blog_comment_moderation` (DEFINER) sigue siendo quien exige sesion
-- para comentar (`BLOG_COMMENT_ANONYMOUS_FORBIDDEN`), fuerza que un comentario
-- nuevo entre en revision (`BLOG_COMMENT_SELF_PUBLISH_FORBIDDEN`), impide
-- comentar a nombre de otro (`BLOG_COMMENT_AUTHOR_MISMATCH`), decide quien
-- modera y congela el texto de lo aprobado (`BLOG_COMMENT_IMMUTABLE`). Las
-- politicas solo deciden **que filas alcanza cada actor**.
--
--
-- ══ Sin politicas de DELETE en ninguna de las tres ══════════════════════════
--
-- La ACL ya lo niega: `anon=am`/`awxtm`/`arwxtm` y `authenticated=arwm` en las
-- tres, ninguna con `d`. Una politica de DELETE seria letra muerta.
--
--
-- ══ Por que `content_items` queda fuera ═════════════════════════════════════
--
-- Se midio y aparecio una dependencia no contemplada: la vista
-- `content_items_meta` es de `postgres` y **no tiene `security_invoker`**, asi
-- que se ejecuta con los privilegios de su propietario, que tiene `bypassrls`.
-- Medido:
--
--   anon, RLS ON en content_items, por la VISTA ..... 26 filas
--   anon, RLS ON en content_items, por la TABLA ..... 0 filas
--
-- Activar RLS ahi daria una proteccion aparente: cerraria el acceso directo y
-- dejaria la vista abierta. Ademas, hacerlo sin disenar a la vez las politicas
-- de moderacion vacia la cola de comentarios (medido: 1 fila -> 0).
--
-- Queda para un sprint propio, donde se estudiaran juntos: RLS de
-- `content_items`, `security_invoker` de `content_items_meta`, los consumidores
-- publicos, la moderacion de `blog_comments` y la logica de `min_plan`.
--
--
-- ══ Idempotencia ═══════════════════════════════════════════════════════════
--
-- `ENABLE ROW LEVEL SECURITY` sobre una tabla que ya lo tiene activo no es un
-- error. Cada politica va precedida de su `DROP POLICY IF EXISTS`, limitado a
-- su tabla. Sin `CASCADE`.
-- ============================================================================


-- ═══ 1. public.crm_leads ════════════════════════════════════════════════════
-- Sus 2 politicas ya existen y no se tocan.

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;


-- ═══ 2. public.public_test_submissions ══════════════════════════════════════

ALTER TABLE public.public_test_submissions ENABLE ROW LEVEL SECURITY;

-- recordSubmission:171 y attachEmailToSubmission:210 · alta publica de un test
DROP POLICY IF EXISTS "Anyone submits a public test" ON public.public_test_submissions;
CREATE POLICY "Anyone submits a public test"
  ON public.public_test_submissions
  AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- recordSubmission usa .select("id") -> RETURNING, que exige politica de SELECT.
-- `USING (true)` es paridad con hoy: la tabla no tiene columna de pertenencia.
-- Lo acota la ACL de columna: `anon` solo puede leer `id`.
DROP POLICY IF EXISTS "Submitters read their own id" ON public.public_test_submissions;
CREATE POLICY "Submitters read their own id"
  ON public.public_test_submissions
  AS PERMISSIVE FOR SELECT
  TO anon
  USING (true);

-- listTestSubmissions:235 · el panel del admin es quien lee el correo
DROP POLICY IF EXISTS "Admins read all submissions" ON public.public_test_submissions;
CREATE POLICY "Admins read all submissions"
  ON public.public_test_submissions
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- attachEmailToSubmission:202 · el trigger append-only impide pisar un correo
-- ya registrado y cambiar score, banda, slug o created_at.
DROP POLICY IF EXISTS "Submitters attach their email" ON public.public_test_submissions;
CREATE POLICY "Submitters attach their email"
  ON public.public_test_submissions
  AS PERMISSIVE FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- ═══ 3. public.blog_comments ════════════════════════════════════════════════

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- listPostComments:78 · lo aprobado es publico, y debe seguir siendolo
DROP POLICY IF EXISTS "Anyone reads approved comments" ON public.blog_comments;
CREATE POLICY "Anyone reads approved comments"
  ON public.blog_comments
  AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (status = 'aprobado');

-- listPostComments:91 · cada quien ve el suyo mientras espera revision
DROP POLICY IF EXISTS "Authors read their own comments" ON public.blog_comments;
CREATE POLICY "Authors read their own comments"
  ON public.blog_comments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

-- listCommentQueue:136 y countPendingComments:177 · admin, o el terapeuta autor
-- del post. El EXISTS exige que authenticated pueda leer content_items: hoy
-- puede, y por eso content_items queda fuera de este sprint.
DROP POLICY IF EXISTS "Moderators read the queue" ON public.blog_comments;
CREATE POLICY "Moderators read the queue"
  ON public.blog_comments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = post_id AND ci.author_id = auth.uid()
    )
  );

-- submitComment:110 · el trigger ya fuerza status='pendiente' y el autor
DROP POLICY IF EXISTS "Authenticated users comment" ON public.blog_comments;
CREATE POLICY "Authenticated users comment"
  ON public.blog_comments
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- moderateComment:165 · el trigger decide que transiciones son validas;
-- la politica decide a que filas llega el moderador.
DROP POLICY IF EXISTS "Moderators update comments" ON public.blog_comments;
CREATE POLICY "Moderators update comments"
  ON public.blog_comments
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = post_id AND ci.author_id = auth.uid()
    )
  )
  WITH CHECK (true);
