# Spec — Tests públicos sin login (Ola 2)

El gap #1 de captación frente a la competencia. Selia (10 tests), Terapify (10+) y PQEB (6) usan tests
gratuitos, sin login, como puerta de entrada + SEO. Mente en Foco ya tiene PHQ-9/GAD-7/C-SSRS, pero
**encerrados tras el login**. Objetivo: una versión **pública** (sin sesión) con resultado inmediato e
invitación cálida a registrarse — nunca un muro.

Regla del proyecto: **backend antes que frontend.** Y coherente con la filosofía **sin pantallas de
bloqueo** y **no invasiva**: el resultado se muestra siempre; el registro es una invitación, no un peaje.

## 1. Alcance de lanzamiento (y expansión)

**Lanzar con 3 tests** — los de mayor demanda y sin dudas de derechos de autor sobre los ítems:
- **Ansiedad — GAD-7** (7 ítems). Ya está en la app (`psychometricScales.ts`): reutilizar los ítems.
- **Depresión — PHQ-9** (9 ítems). Ya está en la app: reutilizar. **Ojo con el ítem 9** (ideación) — ver
  §4 (manejo de riesgo).
- **Autoestima — Escala de Rosenberg** (10 ítems). Dominio público, estándar: se puede incluir.

**Expansión (siguiente batch, cuando se verifiquen/consigan los ítems):** Insomnio (AIS), Burnout (CBI),
Conducta alimentaria (EAT-26), Trauma infantil (ACE), Dependencia emocional, Inteligencia emocional. **No
inventar ítems** de escalas que no tengamos verificadas; se agregan cuando estén las fuentes.

**C-SSRS NO se ofrece como test público autoservicio** — evaluar riesgo suicida sin contención en un flujo
anónimo es un riesgo clínico. Se queda solo dentro del portal, como hoy.

## 2. Backend

```sql
-- Definición de cada test público (ítems y bandas de resultado en jsonb).
create table public_tests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- "test-de-ansiedad", ...
  nombre text not null,
  instrumento text not null,            -- "GAD-7", "PHQ-9", "Escala de Rosenberg"
  categoria text not null,              -- Ansiedad, Ánimo, Autoestima
  descripcion text not null,
  tiempo_estimado text,                 -- "3-5 min"
  items jsonb not null,                 -- [{ n, texto, opciones:[{label,valor}] }]
  bandas jsonb not null,                -- [{ min, max, etiqueta, interpretacion, recomendacion }]
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Captura opcional del lead (analítica + marketing), sin PII sensible en URL.
create table public_test_submissions (
  id uuid primary key default gen_random_uuid(),
  test_slug text not null references public_tests(slug),
  score integer,
  banda text,
  email text,                           -- solo si el usuario lo deja voluntariamente
  created_at timestamptz not null default now()
);
```

- `public_tests` es de **lectura pública** (anon): son solo definiciones, sin datos de nadie.
- `public_test_submissions`: **INSERT** público permitido (para registrar que se hizo el test y, si el
  usuario lo deja, su email). **SELECT** solo admin (es dato de captación/analítica). Nada de PII en la URL.
  El email es **opcional** — el resultado se ve sin dejarlo.
- Sembrar los 3 tests con sus ítems y bandas. PHQ-9/GAD-7 reutilizan los ítems que ya están en
  `psychometricScales.ts` (fuente única: importarlos o copiarlos, sin divergir).

## 3. Frontend (público, sin login)

- **Hub `/tests`** (o `/evaluate`): grid de los tests con instrumento, tiempo estimado, badge "Gratis ·
  sin registro · confidencial". SEO fuerte (cada test con su meta título/descripción).
- **Flujo `/tests/$slug`**: el cuestionario (una pregunta a la vez o lista corta), barra de progreso.
- **Resultado inmediato**: puntaje + banda + **interpretación en lenguaje llano** + recomendación. **No es
  un diagnóstico** (dejarlo explícito). Tono cálido, no alarmista.
- **Invitación (no muro):** tras el resultado, ofrecer —opcional— "crea tu cuenta para guardar tu progreso
  y seguir tu evolución" y "conoce cómo un especialista puede acompañarte". El email para "enviarme mis
  resultados" es opcional. Nunca bloquear el resultado detrás del registro.
- Enlazar `/tests` desde el menú **Evalúate** (o Recursos) de la navbar.

## 4. Manejo de riesgo (no negociable)

- PHQ-9 incluye el ítem 9 (pensamientos de estar mejor muerto / hacerse daño). En el test **público**, si
  ese ítem tiene respuesta positiva —o si el puntaje cae en banda severa— el resultado **debe mostrar de
  forma visible y empática** los recursos de crisis (enlace a `/lineas-de-crisis`) por encima de cualquier
  mensaje comercial. El mensaje comercial nunca coincide con un momento de riesgo (regla del proyecto).
- Ningún test público arroja "diagnóstico": siempre "orientación", con invitación a valoración profesional.

## 5. Qué NO cambia

- Las evaluaciones internas del portal (con seguimiento longitudinal) siguen como están; esto es una capa
  pública y separada, de captación. Si el usuario se registra, más adelante se puede vincular su resultado
  público con su historial — fuera de alcance de esta ola.
