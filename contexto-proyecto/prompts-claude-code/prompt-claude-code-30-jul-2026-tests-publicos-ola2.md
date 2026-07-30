# Prompt para Claude Code — Tests públicos sin login (Ola 2)

El mayor gancho de captación frente a la competencia. Hoy PHQ-9/GAD-7 están encerrados tras el login;
esto los saca a una capa **pública, sin sesión**, con resultado inmediato e invitación (no muro) a
registrarse. Spec completa: `contexto-proyecto/especificaciones-producto/13_tests_publicos_ola2.md`. Léela
antes de empezar.

Coherente con dos reglas del proyecto: **backend antes que frontend** y **sin muros/pantallas de bloqueo**
(el resultado se ve siempre; el registro es invitación).

## 1. Backend (migración)
- Tabla `public_tests` (slug, nombre, instrumento, categoria, descripcion, tiempo_estimado, `items` jsonb,
  `bandas` jsonb, activo) — lectura pública (anon).
- Tabla `public_test_submissions` (test_slug, score, banda, email opcional, created_at) — INSERT público,
  SELECT solo admin. **Nada de PII en la URL**; el email es opcional.
- RLS/triggers como el resto del proyecto (escritas, comentadas si RLS sigue apagado en pruebas).

## 2. Sembrar 3 tests de lanzamiento
- **GAD-7** (ansiedad) y **PHQ-9** (depresión): **reutiliza los ítems que ya existen** en
  `src/lib/psychometricScales.ts` (fuente única — no los redefinas divergiendo).
- **Escala de Rosenberg** (autoestima, 10 ítems, dominio público).
- Cada uno con sus **bandas** de resultado (rangos → etiqueta + interpretación en lenguaje llano +
  recomendación). No inventes ítems de otras escalas; el resto (insomnio/burnout/TCA/trauma) se agrega en
  un batch posterior cuando se verifiquen las fuentes.

## 3. Frontend público
- Hub `/tests` (grid con instrumento, tiempo, "Gratis · sin registro · confidencial") + `/tests/$slug`
  (cuestionario con progreso) + pantalla de resultado (puntaje + banda + interpretación llana +
  recomendación). Deja claro que **no es un diagnóstico**.
- Tras el resultado: invitación **opcional** (crear cuenta para guardar progreso / conocer acompañamiento;
  "enviarme mis resultados" con email opcional). **Nunca** bloquear el resultado tras el registro.
- Enlaza `/tests` en la navbar (un ítem "Evalúate" o dentro de Recursos). SEO: meta título/descripción por
  test.

## 4. Manejo de riesgo (crítico)
- En PHQ-9, si el **ítem 9** (ideación) es positivo **o** el puntaje cae en banda severa, el resultado
  muestra de forma **visible y empática** los recursos de crisis (enlace a `/lineas-de-crisis`) **por
  encima** de cualquier mensaje comercial. El mensaje comercial nunca coincide con un momento de riesgo.
- **C-SSRS NO** se ofrece como test público — se queda solo dentro del portal.

## Verificación
- Sin sesión: entro a `/tests`, hago GAD-7 y PHQ-9 y Rosenberg, veo resultado con interpretación y sin que
  me obliguen a registrarme. El email es opcional y, si lo dejo, cae en `public_test_submissions`.
- PHQ-9 con ítem 9 positivo (o banda severa): el resultado prioriza los recursos de crisis sobre lo
  comercial.
- `public_tests` es legible por anon; `public_test_submissions` no expone datos a anon (solo admin lee).
- Repórtame el recorrido, los conteos y si algún ítem/banda necesita ajuste.
