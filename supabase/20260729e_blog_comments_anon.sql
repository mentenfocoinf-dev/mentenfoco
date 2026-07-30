-- ============================================================================
-- Un comentario anonimo no existe.
--
-- El trigger trataba auth.uid() IS NULL como "contexto de servidor de
-- confianza", que es el patron del resto del proyecto. En esas tablas es
-- razonable: solo se escriben desde el panel o desde un seed. blog_comments es
-- distinta -- cuelga de una ruta PUBLICA, sin login, y con RLS apagado la anon
-- key puede escribir. Ahi "uid nulo" no significa servidor: significa visitante.
--
-- Se separan los dos casos mirando el rol del JWT: 'service_role' pasa (seeds y
-- migraciones); 'anon' o un token sin sujeto, no. Esto no activa RLS ni cambia
-- nada del resto del proyecto: solo endurece este trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_blog_comment_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_jwt_role     text := coalesce(
                           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                           ''
                         );
  v_role         text;
  v_post_type    content_type;
  v_post_status  content_status;
  v_post_abierto boolean;
  v_post_autor   uuid;
  v_puede_moderar boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT content_type, status, admite_comentarios, author_id
      INTO v_post_type, v_post_status, v_post_abierto, v_post_autor
      FROM content_items WHERE id = NEW.post_id;

    IF v_post_type IS DISTINCT FROM 'blog' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_TARGET_INVALID: solo se comenta en piezas de tipo blog.';
    END IF;
    IF v_post_status IS DISTINCT FROM 'publicado' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_TARGET_INVALID: el post no esta publicado.';
    END IF;
    IF v_post_abierto IS NOT TRUE THEN
      RAISE EXCEPTION 'BLOG_COMMENT_CLOSED: este post no admite comentarios.';
    END IF;
  ELSE
    SELECT author_id INTO v_post_autor FROM content_items WHERE id = NEW.post_id;
  END IF;

  IF v_actor IS NULL THEN
    -- Solo el service_role escribe sin sujeto. Un visitante con la anon key, no.
    IF v_jwt_role = 'service_role' OR v_jwt_role = '' THEN
      RETURN NEW;  -- migracion / seed
    END IF;
    RAISE EXCEPTION 'BLOG_COMMENT_ANONYMOUS_FORBIDDEN: hay que iniciar sesion para comentar.';
  END IF;

  SELECT role::text INTO v_role FROM profiles WHERE id = v_actor;
  v_puede_moderar := (v_role = 'admin') OR (v_role = 'therapist' AND v_actor = v_post_autor);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pendiente' THEN
      RAISE EXCEPTION 'BLOG_COMMENT_SELF_PUBLISH_FORBIDDEN: un comentario nuevo entra siempre en revision.';
    END IF;
    IF NEW.author_id <> v_actor THEN
      RAISE EXCEPTION 'BLOG_COMMENT_AUTHOR_MISMATCH: no se puede comentar en nombre de otra persona.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_puede_moderar THEN
    RAISE EXCEPTION 'BLOG_COMMENT_MODERATION_FORBIDDEN: solo un administrador o el terapeuta autor del post modera comentarios.';
  END IF;

  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by AND NOT v_puede_moderar THEN
    RAISE EXCEPTION 'BLOG_COMMENT_MODERATION_FORBIDDEN: solo un moderador asigna reviewed_by.';
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body AND OLD.status = 'aprobado' THEN
    RAISE EXCEPTION 'BLOG_COMMENT_IMMUTABLE: un comentario aprobado ya no se edita.';
  END IF;

  RETURN NEW;
END;
$$;
