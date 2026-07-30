# Plan de reestructuración de páginas públicas — Mente en Foco

Objetivo del usuario: que alguien entre a Mente en Foco **sin iniciar sesión** y ya encuentre muchísima
información y caminos, como pasa en Selia/Terapify. **No se quita nada** — se añade para que se vea
completa y seria. Basado en el scrape del 24-jul (`investigacion-competencia/scrape-2026-07-24/`).

Regla del proyecto que sigue vigente: **nada se construye en frontend sin backend real detrás.** Por eso
cada sección de abajo marca si es contenido estático (se puede montar ya), si lee de una tabla que ya
existe, o si necesita backend nuevo primero.

---

## 0. Navegación global (header) — reorganizar antes que nada

Hoy: Inicio · Asesoramiento · Guías · Membresía · Nosotros · Contáctanos · Ingresa · Agendar cita.

Propuesto (agrupado en menús desplegables como Selia/Terapify, para que quepa todo sin saturar):

- **Servicios ▾** → Psicología clínica · Neuropsicología · Psiquiatría · Fonoaudiología · Terapia de
  pareja · Orientación para padres (cada una con su landing propia — hoy solo existen como texto en el
  home).
- **Evalúate ▾** (NUEVO) → los tests públicos (ver sección Tests). Es el gancho de captación #1.
- **Guías ▾** → Hub de guías + categorías (ya existe, solo colgar del menú).
- **Programas ▾** (NUEVO) → Duelo, Burnout, Ruptura, Ansiedad, Depresión (reempaquetado de lo existente).
- **Planes** → Asesoramiento + Membresía unificados bajo "Invierte en tu bienestar".
- **Recursos ▾** (NUEVO) → Blog/artículos · Ejercicios descargables · Líneas de crisis · Preguntas
  frecuentes.
- **Nosotros** · **Empresas** (NUEVO, B2B) · **Ingresa** · **Agendar cita** (CTA).

---

## 1. INICIO (`index.tsx`) — de 5 secciones a ~11

Mantener todo lo actual (hero, 4 features, 4 disciplinas, stats, CTA final) y **añadir**, en este orden:

1. **Hero** (existente) — mejorar el CTA secundario para que apunte a "Haz un test gratis" (nuevo gancho).
2. **Barra de confianza** (NUEVO, estático): logos/quote de reseñas, "+5.000 pacientes", "basado en
   evidencia", rating. Como la barra de estrellas de Selia/Terapify. Datos que ya se muestran en stats.
3. **4 accesos rápidos** (existente: Asesoramiento, Guías, Membresía, Portal) — sumar 2: "Evalúate" y
   "Encontrar especialista".
4. **Tests gratuitos destacados** (NUEVO): grid de los tests públicos con "Gratis · 5 min · resultado
   inmediato". Es lo primero que Selia pone arriba. Lee de una tabla de tests (ver sección Tests).
5. **Cómo funciona** (NUEVO, estático): 3–4 pasos (Cuéntanos cómo estás → Te conectamos con tu
   especialista → Empieza a tu ritmo), calcado del patrón de Selia/Terapify pero con la voz de MeF.
6. **Nuestras disciplinas clínicas** (existente: 4) — cada tarjeta ahora enlaza a su landing de servicio.
7. **Programas por lo que estás viviendo** (NUEVO): duelo, burnout, ruptura, ansiedad, depresión.
8. **Diferenciador clínico** (NUEVO, estático): la sección que ningún competidor puede copiar — "No solo
   apoyo emocional: historia clínica real, valoración, informe y seguimiento con estándar profesional
   (CIE-11)". Este es el foso defensivo identificado en el gap analysis.
9. **Guías destacadas** (NUEVO): 3–6 tarjetas de guías reales tiradas de `clinical_guides_meta` (ya
   existe el servicio) para mostrar el contenido sin entrar.
10. **Testimonios** (NUEVO): reseñas reales de pacientes (necesita una tabla `testimonials` o texto
    estático curado por ahora — marcar como pendiente de fuente real, no inventar).
11. **Stats** (existente) + **FAQ corto** (NUEVO, estático) + **CTA final** (existente).

---

## 2. EVALÚATE / TESTS PÚBLICOS (`/tests` + `/tests/$testId`) — PÁGINA NUEVA, gap #1

El cambio de mayor impacto. Hoy PHQ-9/GAD-7/C-SSRS existen pero encerrados tras login. Sacar versiones
**públicas** (sin login), con resultado inmediato y CTA de registro — exactamente el motor de leads de
Selia (10 tests), Terapify (10+) y PQEB (6).

- **Hub `/tests`**: grid de tests con instrumento clínico nombrado, badge "Gratis · X min · confidencial".
- **Detalle `/tests/$testId`**: el cuestionario, resultado con interpretación (sin diagnóstico), y CTA
  "regístrate / agenda para trabajar esto con un especialista".
- Tests a ofrecer (todos con instrumento validado real, varios ya implementados en MeF):
  Ansiedad (**GAD-7**), Depresión (**PHQ-9**), Autoestima (**Rosenberg**), Estrés/Burnout (**CBI**),
  Insomnio (**AIS**), Conducta alimentaria (**EAT-26**), Trauma infantil (**ACE**), Dependencia
  emocional, Pareja, Inteligencia emocional.
- **Backend necesario**: tabla `public_tests` (definición de cada test + ítems + rangos de resultado) y,
  opcionalmente, `public_test_submissions` para capturar el lead (email al final). **No construir la UI
  sin esta tabla.** El C-SSRS (riesgo suicida) NO se ofrece como test público autoservicio sin
  contención — igual que ya se decidió excluirlo del muro freemium.

## 3. ENCONTRAR ESPECIALISTA / MATCHING (`/encontrar-especialista`) — PÁGINA NUEVA, gap #2

Hoy la asignación es manual por admin. Los 3 grandes (Selia, Terapify, BetterHelp) compiten en matching.

- **Test de afinidad** (3 min): motivo de consulta + enfoque preferido + horario/disponibilidad → sugiere
  terapeutas compatibles.
- **Directorio navegable** (`/especialistas`): perfiles con foto, enfoque (TCC, sistémico, humanista…),
  especialidades, años de experiencia, nº de sesiones, idiomas, tarjeta profesional, reseñas.
- **Backend necesario**: tabla/campos de perfil profesional público del terapeuta (hoy `profiles` es
  interno), lógica de matching, y reseñas. Es la pieza más grande de todo el plan — marcar como fase
  propia. **No frontend sin esto.**

## 4. ASESORAMIENTO (`asesoramiento.tsx`) — enriquecer

Mantener las 3 tarjetas de plan (ya con nombres nuevos Primeros Pasos / Mi Equilibrio / Mi Mundo en Foco)
y añadir:

- **Tabla comparativa completa** de niveles (reutilizar la de `membresia.tsx` — hoy están separadas;
  conviene una sola fuente `PLAN_BENEFITS`).
- **"Cómo funciona el proceso"** (pasos) y **garantías** (inspirado en Terapify: qué pasa si no conectas
  con tu terapeuta — política de cambio). Definir la política real antes de publicarla.
- **FAQ de planes** (precios, qué incluye cada uno, cancelación, sesiones que no se pierden — el rollover
  de Terapi es un buen gancho si el negocio lo permite).
- **Orientación breve gratuita** como gancho de entrada (el "20 min gratis" de Selia) — decisión de
  negocio, no construir sin definirla.

## 5. GUÍAS (`guia.tsx`) — ya reestructurada, solo sumar

Ya tiene dropdown de categorías y el fix de visibilidad. Añadir:
- **Buscador** por texto dentro de las guías.
- **Guías destacadas / más leídas** arriba.
- Enlace cruzado desde cada guía a "agenda con un especialista para trabajar esto" (ya existe parcial).

## 6. MEMBRESÍA (`membresia.tsx`) — ya en cola de cambios

Ya está el reordenamiento (tabla antes del carrusel) y el renombrado en el prompt del 22-jul. Sumar aquí:
la capa de **autocuidado digital** que diferencia a Terapi — journaling, meditaciones en audio, sesiones
autodirigidas — como beneficios de los niveles superiores (cuando existan de verdad en backend).

## 7. RECURSOS (NUEVO, hub `/recursos`)

Lo que Terapify y PQEB usan para SEO y autoridad:
- **Blog/artículos** (`/blog`): hoy MeF tiene 20 guías; un blog de artículos más cortos y frecuentes
  (distinto de las guías clínicas) alimenta SEO. Selia tiene +700, PQEB ~727.
- **Ejercicios descargables**: respiración, relajación, autoestima, etc. (Terapify tiene 10+).
- **Líneas de crisis** (`/lineas-de-crisis`): página dedicada con líneas reales de Colombia (106/123/192
  opción 4 — verificar el número correcto, ya hubo un error antes con el 106). Selia, Terapify y
  BetterHelp la tienen; es responsabilidad + confianza.
- **Preguntas frecuentes** (`/faq`): grande, categorizada.

## 8. NOSOTROS (`sobre-nosotros.tsx`) — enriquecer

Sumar: equipo con credenciales, misión/valores, respaldo científico, y el diferenciador clínico. Genera
confianza antes de pagar.

## 9. EMPRESAS (NUEVO, `/empresas`) — B2B

Todos lo tienen. Landing B2B: bienestar laboral, reducción de ausentismo, dashboard de métricas, agendar
demo. Puede ser estático al inicio (formulario de contacto → `crm_leads` que ya existe).

## 10. CONTÁCTANOS (`contactanos.tsx`) — ya funcional

Ya inyecta a `crm_leads`. Sumar líneas de crisis visibles y FAQ de contacto.

---

## Orden de ejecución sugerido (por impacto vs. esfuerzo)

**Ola 1 — alto impacto, se puede montar ya (estático o leyendo tablas existentes):**
enriquecer el Inicio (secciones estáticas + guías destacadas desde `clinical_guides_meta`), landings de
servicios, hub de Recursos/Blog/FAQ/Líneas de crisis, landing de Empresas, enriquecer Nosotros y
Asesoramiento. Nada de esto necesita backend nuevo.

**Ola 2 — el mayor gancho de captación, necesita backend:** Tests públicos (`public_tests`). Prioridad
alta apenas se defina la tabla.

**Ola 3 — la pieza más grande, fase propia:** Encontrar especialista + directorio + matching (perfil
profesional público, reseñas, lógica de match).

Todo el contenido clínico nuevo (guías, artículos, textos de servicios) debe pasar por la investigación
científica y la plantilla maestra de `guias-bienestar/` antes de publicarse — no inventar contenido
clínico. Este plan define la estructura; el contenido se llena con esa metodología.
