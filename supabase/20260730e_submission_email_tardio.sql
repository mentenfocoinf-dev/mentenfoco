-- ============================================================================
-- El envio se registra al ver el resultado; el correo puede llegar despues.
--
-- El trigger append-only original impedia CUALQUIER update, y eso rompia el
-- flujo real: la persona termina el test (ahi hay que registrar el hecho, que es
-- la analitica de captacion) y solo despues decide si deja su correo. Con el
-- trigger anterior, o se registraba sin correo y ya no se podia completar, o se
-- registraba solo a quien dejaba correo — y entonces no se sabria cuanta gente
-- hace los tests, que es justo el dato que se queria medir.
--
-- Se abre una unica excepcion: rellenar `email` cuando estaba vacio. El puntaje,
-- la banda y el test siguen siendo inmutables, que era el motivo real de la
-- regla — que nadie pueda reescribir la analitica.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_submission_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.test_slug IS DISTINCT FROM OLD.test_slug
     OR NEW.score IS DISTINCT FROM OLD.score
     OR NEW.banda IS DISTINCT FROM OLD.banda
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'PUBLIC_SUBMISSION_APPEND_ONLY: el resultado de un envio no se modifica.';
  END IF;

  -- Un correo ya registrado no se pisa ni se borra desde el cliente: eso seria
  -- sobrescribir el dato de contacto de otra persona.
  IF OLD.email IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'PUBLIC_SUBMISSION_APPEND_ONLY: el correo de un envio no se reemplaza.';
  END IF;

  RETURN NEW;
END;
$$;
