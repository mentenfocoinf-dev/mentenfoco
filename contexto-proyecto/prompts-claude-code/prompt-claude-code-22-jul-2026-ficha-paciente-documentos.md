# Prompt para Claude Code — Ficha de paciente, 3 tipos de documento, PDF

Contexto: en "Mis Pacientes" el botón "Informe Clínico" se quita. Cada paciente pasa a llevar a una
ficha propia. Hoy `clinical_notes` guarda todo como un solo tipo de nota (SOAP genérico) y eso ya no
alcanza — el usuario pidió diferenciar explícitamente 3 tipos de documento (Valoración, Informe,
Evolución), un panel de uso del plan, y descarga en PDF de lo firmado. Regla no negociable del
proyecto: nada de esto se hace solo en frontend, cada punto tiene su respaldo de base de datos primero.

Spec completa y detallada (schema exacto, forma de cada campo jsonb, justificación de cada decisión):
`contexto-proyecto/especificaciones-producto/04_ficha_paciente_valoraciones_informes_evoluciones.md`
— léela completa antes de empezar, este prompt solo resume el orden de ejecución.

## Orden sugerido

### 1. Migración: diferenciar tipos de documento

Aplica el `ALTER TABLE clinical_notes` de la sección 1 de la spec (`document_type`, `session_id`,
`treatment_plan`). Antes de correrla en la base con los datos ya sembrados (seed del 22-jul, 4
pacientes x 5 notas cada uno): decide el criterio de backfill (la spec sugiere "primera nota
cronológica de cada paciente = valoracion, el resto = evolucion") y aplícalo en la misma migración o
en un `UPDATE` de acompañamiento — no dejes esas 20 notas ya sembradas con `document_type` default
sin sentido.

### 2. Backend de uso del plan

`PLAN_SESSION_QUOTA` en `src/lib/api/plans.ts` (sección 2 de la spec) + el servicio que calcula
sesiones usadas este mes vs. cupo, y evaluaciones aplicadas en el período. Verifica que
`therapy_sessions.status` tenga en efecto un valor tipo `'completada'` en el esquema real — la spec lo
asume por lectura de código, confírmalo contra la base antes de escribir la query.

### 3. Frontend: ficha de paciente

Ruta nueva bajo el layout de terapeuta (sección 3 de la spec): encabezado, resumen clínico, gráfica de
tendencia (extraer `TrendChart.tsx` compartido desde `PatientDashboard.tsx` en vez de duplicar),
panel de uso del plan, y lista de documentos con los 3 botones de creación. Actualiza
`TherapistDashboard.tsx` para que la tarjeta de cada paciente en "Mis Pacientes" navegue aquí en vez de
abrir `ClinicalReportModal.tsx` directamente con el botón que se quita.

### 4. Formularios diferenciados por tipo

`ClinicalReportModal.tsx` (o su reemplazo) debe ramificarse en 3 formularios según `document_type`,
con los campos exactos de la sección 1 de la spec — la evolución es deliberadamente corta (reutiliza
solo 3 de las 10 categorías de `MENTAL_STATUS_OPTIONS`), no el modal completo actual. El informe se
pre-rellena desde la última valoración + evoluciones firmadas, pero queda editable hasta firmar.
Mantén intacto el mecanismo de inmutabilidad post-firma que ya existe.

### 5. Exportación PDF

Botón visible solo si `is_signed=true`. Genera el PDF a partir de los datos ya persistidos (nunca
datos no firmados). Antes de elegir librería, verifica si el flujo real corre 100% en cliente
(recomendado, evita problemas de compatibilidad) o si tocaría generarlo del lado servidor — en ese
caso confirma que la librería elegida sea compatible con el runtime de Cloudflare Workers
(`wrangler.jsonc`, `nodejs_compat`) antes de comprometerte a ella.

## Verificación

Después de construir, entra con `terapeuta@test.com` y confirma sobre los 4 pacientes de prueba: la
ficha carga sin error, el panel de uso del plan muestra números creíbles (no ceros salvo que
correspondan), los 3 tipos de documento se distinguen visualmente en la lista, un documento firmado
descarga un PDF legible con los datos correctos, y un documento sin firmar NO muestra el botón de PDF.
Repórtame explícitamente cualquier inconsistencia que encuentres, no solo "quedó listo".
