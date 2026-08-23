# Prompt para Claude Code — Cola de backend (post fix-webhook), configs externas al final

> Pégalo tal cual en Claude Code, en la raíz del repo. Continúa después del fix de webhook publicado
> (`e4c0be9`). Decisión del responsable: **priorizar todo el backend pendiente ahora; las
> configuraciones externas (R1, R2, R6, Turnstile E2E, Stripe live, dominio propio) quedan para el
> final** — no son urgentes, no dependen de código, y ya están documentadas en el roadmap.

## Antes de tocar nada

Visión de producto (`contexto-proyecto/vision-producto/`) sigue mandando sobre todo esto, en particular:
**ADR-001 (cero paywalls, el plan filtra el catálogo)** y **ADR-006 (backend antes que frontend)**. Si
algo de lo pedido abajo choca con la filosofía, aplica ADR-010: te detienes y lo señalas, no lo resuelves
por tu cuenta.

## Orden de la cola (decidido por el responsable, en este orden)

1. Journaling estructurado (autocuidado)
2. Directorio público de especialistas — Ola 3 (**decisión de negocio ya tomada: el paciente elige**)
3. Fix menor: `admin-create-user` sin `must_change_password`
4. Backend de Empresas/B2B

---

### 1 — Journaling estructurado (autocuidado tipo Terapi)

Feature nueva, sin dependencias externas. Antes de escribir migración: propón el diseño (tabla, campos,
RLS, dónde vive en el portal). Preguntas a resolver en tu propuesta, no asumas:

- ¿Es solo del paciente (privado, nunca visible al terapeuta) o puede compartirse? Dado ADR-001 y el tono
  de "Mi camino", probablemente **privado por defecto**, sin opción de compartir en esta primera versión
  — confírmalo o dime si ves razón clínica para lo contrario.
- ¿Entrada libre, con prompts guiados (tipo "¿qué sentiste hoy?"), o ambas? Si hay prompts, ¿de dónde
  salen — biblioteca fija o ligada a la guía/contenido que el paciente esté viendo?
- ¿Se relaciona con `journey_events` (Journey Engine) como otro tipo de evento, o es una tabla
  independiente? Evalúa reutilizar el patrón existente antes de crear algo paralelo.
- Dónde vive en el portal: ¿sección propia en el nav del paciente, o dentro de "Mi camino"?

Sigue la disciplina completa de migración (nueva tabla = cambio de esquema): baseline → backup → prueba
en transacción revertida → aplicación → idempotencia → invariantes → rollback real → reaplicación → doc
en auditorías. RLS activo desde el inicio, sin excepciones.

### 2 — Directorio público de especialistas (Ola 3, paciente elige)

El motor ya existe (`therapist_profiles`, `matchingService`, `therapistContactService`), usado hoy solo
dentro del portal logueado. Ahora se necesita la **cara pública**: página de captación fuera del login
donde cualquier visitante navegue perfiles de terapeutas y elija.

Antes de tocar código, propón el diseño — en particular:

- **RLS pública:** hoy `therapist_profiles` probablemente no permite SELECT a `anon`. Necesitas una
  política (o una vista) que exponga **solo** los campos seguros para público (especialidad, enfoque,
  bio profesional, foto) y **nunca** datos operativos o de pacientes. Cítame exactamente qué columnas
  expondrías antes de escribir la política.
- **El flujo de "elegir":** con ADR-001 (cero paywalls) de fondo, ¿un visitante anónimo puede iniciar
  contacto con un terapeuta desde el directorio, o el directorio es informativo y el contacto real
  requiere cuenta (como ya exige `therapist_contact_requests` hoy)? Probablemente lo segundo — el
  directorio capta, pero `therapistContactService` ya asume paciente autenticado. Confírmalo con el
  código real antes de asumir.
- **Relación con el matching interno:** ¿el directorio reemplaza `MatchingPreview` dentro del portal, o
  conviven (el portal sigue sugiriendo, el directorio público permite buscar libremente)? Propón, no
  asumas.
- **Ruta:** ¿`/especialistas` o similar, en el árbol de rutas públicas (`src/routes/`) junto a `guia.tsx`,
  `asesoramiento.tsx`?

Si esto requiere una política RLS nueva o una vista, sigue la disciplina completa de migración. Si solo
requiere frontend + una función de lectura pública ya cubierta por una política existente, dilo
explícitamente y evalúa si de verdad no hace falta migración (no lo des por sentado sin comprobarlo).

### 3 — Fix menor: `admin-create-user` sin `must_change_password`

Ya diagnosticado en el fix del webhook: `admin-create-user` no setea `must_change_password: true` cuando
el admin crea una cuenta con contraseña elegida por él. Es una línea de código, no requiere migración (la
columna y el gate ya existen). Bajo riesgo, ejecútalo cuando te quede cómodo en la cola — no hace falta
que interrumpa el resto.

### 4 — Backend de Empresas/B2B

Este es el de mayor ambigüedad — **tu primer entregable aquí debe ser preguntas de alcance, no una
propuesta cerrada**. Hoy la landing de Empresas solo cae en `crm_leads`, igual que cualquier otro lead.
Antes de diseñar nada, necesito que me devuelvas (a mí, para relayar al responsable) las preguntas de
negocio que bloquean el diseño — por ejemplo (ajusta a lo que encuentres real en el código):

- ¿"Funcional" significa que una empresa pueda tener una cuenta propia (multi-usuario, facturación
  agregada), o simplemente que el lead de `crm_leads` se gestione mejor en el panel admin (pipeline,
  estado, notas) sin llegar a ser una cuenta B2B real?
- ¿Hay ya un modelo de precios/plan para empresas, o depende de cotización manual?
- ¿Se espera que empleados de la empresa tengan cuentas de paciente vinculadas a la cuenta B2B (para
  reportes agregados, por ejemplo), o es un canal de adquisición que termina en cuentas de paciente
  normales sin vínculo visible?

No implementes nada de este ítem hasta que estas preguntas tengan respuesta.

---

## Cómo entregar

Para los ítems **1, 2 y 3**: preséntame primero el diagnóstico/diseño de los tres juntos (FASE 0 + FASE 1
de cada uno, en un solo mensaje si te es más eficiente) — así el responsable revisa y aprueba todo de una
vez en lugar de tres rondas separadas. **No apliques nada todavía.**

Para el ítem **4**: solo las preguntas de alcance, nada de diseño.

## Qué queda fuera, para el final (no lo toques ahora)

R1 (backups/PITR), R2 (rotar Resend + verificar dominio), R6 (retirar `DEV_MAIL_REDIRECT`), la validación
E2E de Turnstile (R3), Stripe a modo live, dominio propio + verificación Google Cloud, revisión jurídica.
Todo eso ya está en el roadmap bajo la fase de seguridad/configuración y se retoma cuando el responsable
lo indique explícitamente.
