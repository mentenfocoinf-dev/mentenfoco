# Auditoría de Arquitectura de Datos — Mente en Foco

**Fecha:** 30 de julio de 2026 · **Alcance:** capa de datos (PostgreSQL sobre Supabase) · **Método:**
lectura directa de las 33 migraciones versionadas en `supabase/*.sql` (no de documentación previa) ·
**Autor:** revisión técnica de Cowork.

---

## 1. Resumen ejecutivo

La arquitectura de datos de Mente en Foco es un modelo relacional sobre **PostgreSQL gestionado por
Supabase**, organizado en torno a la tabla de identidad `profiles` y a un conjunto de dominios bien
delimitados: clínico, contenido, comunidad, catálogos y captación pública. El diseño es **coherente y
razonablemente normalizado**, con un patrón de servicio único en el frontend (`src/lib/api`) que evita
lógica de datos dispersa.

El rasgo más importante de esta arquitectura —y el que define su perfil de riesgo— es que **la seguridad a
nivel de fila (RLS) está deliberadamente desactivada en la mayoría de las tablas** durante la fase de
pruebas, y las invariantes críticas se protegen con **triggers de base de datos** en lugar de políticas
RLS. Es una decisión consciente y documentada, no un descuido, pero implica que **hoy la base no está lista
para datos de pacientes reales**: los datos sensibles de salud dependen de que nadie use la clave anónima o
de servicio para leerlos directamente.

**Veredicto general:** arquitectura **sólida en diseño e integridad**, con **madurez alta en reglas de
negocio** (triggers de inmutabilidad, autoría y moderación bien implementados) pero **inmadura en control
de acceso** (RLS pendiente) y con **vacíos de trazabilidad** en el esquema base. Adecuada para un entorno
de pruebas; requiere cerrar la fase de seguridad antes de operar con pacientes reales.

---

## 2. Inventario de entidades

Se identificaron **19 tablas** más 2 vistas de metadatos. Se agrupan por dominio.

### 2.1 Identidad y acceso
| Tabla | Rol | Notas |
| :--- | :--- | :--- |
| `profiles` | Perfil de usuario (paciente/terapeuta/admin), plan, estado de suscripción, onboarding, cédula, contacto de emergencia. | **No se crea en las migraciones versionadas** — solo se le agregan columnas vía `ALTER TABLE`. Ver hallazgo §7.1. |
| `patient_therapist` | Vínculo paciente↔terapeuta (asignación por admin). | Tampoco tiene `CREATE TABLE` versionado; RLS habilitado en `security_sprint`. |

### 2.2 Clínico
| Tabla | Rol |
| :--- | :--- |
| `patient_anamnesis` | Historia clínica de ingreso (antecedentes, medicación, AUDIT-C, red de apoyo, cribado cognitivo). |
| `psychometric_evaluations` | Aplicaciones de PHQ-9/GAD-7/C-SSRS/MoCA/MMSE con resultados y disparo de alertas. |
| `clinical_alerts` | Alertas de crisis con trazabilidad de resolución (`resolved_by`, acción, notas). |
| `clinical_notes` | Documentos clínicos tipados (valoración/informe/evolución) con firma electrónica inmutable. **Su `CREATE TABLE` no está versionado**; la migración `20260722_clinical_document_types.sql` solo le agrega `document_type`, `session_id`, `treatment_plan`. Ver §7.1. |
| `therapy_sessions` | Agenda de sesiones (estado, enlace de videollamada, estado de recordatorio). |
| `messages` | Mensajería paciente↔terapeuta. |
| `mood_entries` | Registro de estado de ánimo (retención). |
| `service_requests` | Solicitudes de servicio adicional (consulta extra, valoración neuropsicológica). |
| `clinical_prescriptions` / `patient_prescriptions` | Catálogo de "prescripciones" clínicas (tareas) y su asignación al paciente. |

### 2.3 Consentimiento
| Tabla | Rol |
| :--- | :--- |
| `clinical_consents` | Consentimiento informado **clínico** (Ley 1090), versionado, con aceptación/revocación. Distinto del consentimiento de datos (Ley 1581), que vive como texto versionado en el front, no como tabla. |

### 2.4 Contenido y comunidad
| Tabla | Rol |
| :--- | :--- |
| `clinical_guides` | Guías clínicas (formato fundamento + ejercicio), con `min_plan` y `es_premium`. |
| `content_items` | Biblioteca unificada: artículo/programa/herramienta/audio + blog, con workflow editorial (`content_status`), SEO (`meta_title`, `meta_description`, `slug`), gating por plan y `program_steps` jsonb. |
| `content_revisions` | Historial de versiones de `content_items`. |
| `blog_comments` | Comentarios de pacientes en el blog, con moderación (`comment_status`). |

### 2.5 Catálogos y captación
| Tabla | Rol |
| :--- | :--- |
| `cie11_directory` | Catálogo CIE-11 (161 códigos del capítulo 6), lectura de referencia. |
| `public_tests` | Definición de tests públicos (ítems y bandas en jsonb). |
| `public_test_submissions` | Registro de tests hechos sin login + email opcional (captación). |
| `telemetry_events` | Auditoría/analítica de eventos. **Escrito pero no consumido** (ver §7.6). |

### 2.6 Vistas
- `clinical_guides_meta` — metadatos de guías (sin contenido), para listar con gating.
- `content_items_meta` — equivalente para `content_items`.

---

## 3. Tipos enumerados (enums)

| Enum | Valores | Uso |
| :--- | :--- | :--- |
| `content_type` | articulo, programa, herramienta, audio, **blog** | Diferencia las secciones (Contenido vs Blog) a nivel de dato. |
| `audio_kind` | meditacion, podcast | Subtipo de los ítems de audio. |
| `content_status` | borrador, en_revision, cambios_solicitados, aprobado, publicado, archivado | Workflow editorial terapeuta→admin. |
| `comment_status` | pendiente, aprobado, rechazado | Moderación de comentarios de blog. |
| `plan_type` | free, esencial, integral, premium | Gating por plan. **Su definición no aparece como `CREATE TYPE` en las migraciones** — se usa (`min_plan public.plan_type`) pero se crea fuera del historial versionado. Ver §7.1. |

Las escalas psicométricas (PHQ-9/GAD-7/C-SSRS/MoCA/MMSE) se manejan como valores en `psychometric_evaluations`, ampliados por `20260701_add_moca_mmse_scale_types.sql`.

---

## 4. Modelo de seguridad de datos (hallazgo central)

Este es el punto que más define la arquitectura hoy. Conviven **dos mecanismos** de protección:

### 4.1 RLS (Row Level Security) — parcial y en transición
- **Habilitado** (en `security_sprint` y `secure_*`): `clinical_alerts`, `psychometric_evaluations`,
  `patient_therapist`, `clinical_guides`, `patient_anamnesis`, `cie11_directory`,
  `clinical_prescriptions`, `patient_prescriptions`, `therapy_sessions`, `telemetry_events`.
- **Desactivado a propósito** (políticas escritas pero **comentadas** en la migración, para agilizar la
  generación de perfiles de prueba): `content_items`, `content_revisions`, `blog_comments`,
  `clinical_consents`, `public_tests`, `public_test_submissions`, `mood_entries`, `messages`,
  `service_requests`.
- **Consecuencia:** con la clave anónima o de servicio, las tablas sin RLS son legibles/escribibles
  directamente. Para datos de salud (categoría especial bajo Ley 1581/2012) esto es un riesgo real que
  **debe cerrarse antes de recibir pacientes reales**. Está registrado como decisión consciente en la fase
  de seguridad, no como olvido.

### 4.2 Triggers — la barrera que sí está activa hoy
Como RLS no filtra en las tablas nuevas, las **invariantes críticas se protegen con triggers**, que aplican
venga la llamada de donde venga (web, móvil, script). Es lo correcto dado el estado de RLS, y está bien
ejecutado:

| Trigger / función | Invariante que protege |
| :--- | :--- |
| `enforce_content_publish_is_admin` | Solo un admin puede dejar contenido en `publicado` / setear `published_by`. Un terapeuta no puede autopublicarse. |
| `enforce_clinical_consent_authorship` | El consentimiento es un acto **personal e indelegable**: solo el titular consiente; ni el admin consiente por otro; el anónimo queda fuera. (Cerró un agujero real detectado por API.) |
| `enforce_clinical_consent_immutability` / `_no_delete` | Una vez aceptado, no se puede alterar `accepted_at`/`version`/`patient_id` ni borrar la fila (evidencia legal). |
| `enforce_blog_comment_moderation` | Un comentario solo pasa a `aprobado` por un moderador; el paciente no autopublica. |
| `enforce_free_plan_evaluation_limit` | Límite de 1 evaluación PHQ-9/GAD-7 al mes en plan Free (C-SSRS exento). |
| `enforce_no_public_risk_instrument` | Impide exponer instrumentos de riesgo (C-SSRS) en la capa pública. |
| `enforce_submission_append_only` | Las respuestas de tests públicos son de solo-inserción. |
| Firma electrónica de `clinical_notes` (Res. 839/2017) | Documentos firmados quedan inmutables. |

**Observación:** este modelo trigger-first es robusto para las invariantes que cubre, pero **no sustituye a
RLS** para el control de *lectura* de datos sensibles. Un trigger evita escrituras indebidas; no evita que
alguien con la anon key *lea* una anamnesis o una nota clínica de una tabla sin RLS.

---

## 5. Lógica de negocio en la base (funciones / RPCs)

La base concentra reglas de negocio reales, no solo almacenamiento:
- `plan_rank(plan_type)` / `get_my_plan_rank()` — jerarquía de planes para el gating de contenido.
- `admin_assign_patient` / `admin_unassign_patient` / `admin_get_directory` / `admin_set_plan` — operaciones
  de administración como RPCs (no manipulación directa de tablas desde el cliente). Buen patrón.
- `handle_new_auth_user` / `handle_new_user` (trigger `on_auth_user_created`) — crea el perfil automáticamente
  al alta en `auth.users`, incluido OAuth. **Hay dos funciones con nombre casi igual** (`handle_new_auth_user`
  y `handle_new_user`) — verificar que no haya duplicidad/colisión (ver §7.5).

---

## 6. Integridad relacional

Las relaciones núcleo están bien planteadas: casi todo cuelga de `profiles(id)` vía claves foráneas
(`patient_id`, `therapist_id`, `author_id`, `reviewed_by`, `published_by`, `resolved_by`). El contenido usa
`content_items` como entidad central con `content_revisions` y `blog_comments` referenciándola. Los tests
públicos separan definición (`public_tests`) de respuestas (`public_test_submissions`) por `slug`. El
gating por plan es consistente entre `clinical_guides` y `content_items` (mismo `min_plan`/`plan_rank`),
lo que evita divergencias.

---

## 7. Hallazgos y riesgos (priorizados)

### 7.1 🔴 Alto — Vacío de trazabilidad del esquema base
`profiles`, `patient_therapist`, `clinical_alerts`, `clinical_notes`, `psychometric_evaluations` y el enum
`plan_type` **se usan y se alteran, pero su `CREATE TABLE`/`CREATE TYPE` no aparece en las migraciones
versionadas** (`supabase/*.sql`). Fueron creados en un bootstrap anterior fuera del historial (probablemente
la configuración inicial del proyecto Supabase o scripts no versionados). **Riesgo:** no se puede reconstruir
la base desde cero solo con las migraciones; dificulta onboarding, entornos nuevos y auditoría. **Acción:**
exportar el esquema real (`pg_dump --schema-only`) y versionar una migración base `00000000_baseline.sql`
que capture estas tablas, tipos y sus constraints.

### 7.2 🔴 Alto — RLS desactivado en tablas con datos sensibles de salud
`clinical_consents`, `messages`, `mood_entries`, `content_items` y otras tienen RLS off (por decisión de la
fase de pruebas). Además, la memoria del proyecto indica que en algún punto se desactivó RLS también en
`patient_anamnesis`, `psychometric_evaluations`, `clinical_alerts`, `therapy_sessions` y `messages` para
pruebas, aunque las migraciones tempranas lo habilitaban. **Riesgo:** exposición de datos de categoría
especial (Ley 1581) con la anon/service key. **Acción:** en la fase de seguridad, reactivar RLS en todas las
tablas con datos personales/clínicos y verificar cada política con usuarios reales de los 3 roles. Confirmar
además el estado *efectivo* actual de RLS por tabla (no solo el declarado en migraciones), porque hay
enable/disable a lo largo del historial.

### 7.3 🟠 Medio — No hay bitácora de acceso a datos clínicos
Existe `telemetry_events` (eventos) y trazabilidad de *resolución* de alertas, pero **no un registro de quién
leyó/accedió a una historia clínica o nota**. Para datos de salud, un *access log* (quién, cuándo, a qué
paciente) es buena práctica y respalda el habeas data y la Res. 1995/1999. **Acción:** evaluar una tabla de
auditoría de acceso a `clinical_notes`/`patient_anamnesis` para la fase de producción.

### 7.4 🟠 Medio — Sin cifrado a nivel de columna para datos ultra-sensibles
Las notas clínicas y la anamnesis se guardan en texto. Supabase cifra en reposo a nivel de disco, pero no
hay cifrado a nivel de aplicación/columna para los campos más sensibles. **Acción (evaluar):** para
producción, considerar cifrado de campos de contenido clínico libre, ponderando el impacto en búsqueda y
rendimiento.

### 7.5 🟡 Bajo — Posible duplicidad de función de alta de usuario
Coexisten `handle_new_auth_user` y `handle_new_user`. **Acción:** confirmar cuál está enganchada al trigger
`on_auth_user_created` y eliminar la que quedó huérfana para evitar comportamiento ambiguo.

### 7.6 🟡 Bajo — Datos que se escriben y no se leen
`telemetry_events` se puebla pero **ningún panel lo consume** (el admin no tiene analítica). Es deuda de
producto, no de integridad, pero conviene o explotarlo o dejar de escribirlo.

### 7.7 🟡 Bajo — `min_plan` sigue existiendo bajo el modelo "sin candados"
Correcto y deliberado: el campo se mantiene para **filtrar** (mostrar solo lo concedido), no para bloquear.
No es un riesgo; se documenta para que nadie lo reinterprete como gating de candado.

---

## 8. Fortalezas

- **Integridad por diseño:** las invariantes que de verdad importan (publicación solo-admin, consentimiento
  indelegable e inmutable, moderación, inmutabilidad de documentos firmados) están protegidas en la base con
  triggers, no solo en la UI. Esto sobrevive a llamadas desde móvil o scripts.
- **Separación de dominios limpia:** clínico, contenido, comunidad, catálogos y captación están bien
  delimitados; el contenido usa un modelo unificado con workflow editorial serio.
- **Lógica de negocio server-side:** las operaciones de administración son RPCs, no manipulación directa de
  tablas desde el cliente.
- **Consistencia del gating:** un solo eje de planes (`plan_rank`) gobierna guías y contenido.
- **Decisiones de seguridad conscientes y documentadas:** lo pendiente (RLS, Stripe, password=email) está
  registrado como diferido a propósito, no oculto.

---

## 9. Recomendaciones priorizadas (roadmap de datos)

1. **Versionar el esquema base** (`00000000_baseline.sql` desde `pg_dump --schema-only`) para cerrar el
   vacío de trazabilidad. *(Antes de crecer más el equipo o los entornos.)*
2. **Fase de seguridad de datos** (ya agrupada en el roadmap general):
   - Reactivar y **verificar** RLS en todas las tablas con datos personales/clínicos, rol por rol.
   - Confirmar el estado efectivo de RLS por tabla (auditar en la base, no solo en migraciones).
   - Corregir el webhook de Stripe (hoy contraseña = correo).
3. **Bitácora de acceso** a datos clínicos (auditoría de lectura) para producción.
4. **Evaluar cifrado a nivel de columna** para contenido clínico libre.
5. **Depurar** la duplicidad `handle_new_auth_user`/`handle_new_user`.
6. **Decidir sobre `telemetry_events`:** construir la analítica del admin o dejar de escribir el evento.
7. **Revisión jurídica** de los textos de consentimiento (clínico y de datos) antes de producción.

---

## 10. Conclusión

La capa de datos de Mente en Foco está **bien construida en lo estructural y en la integridad de reglas de
negocio**, con un uso maduro de triggers para blindar las invariantes críticas. Su brecha principal no es de
diseño sino de **control de acceso y trazabilidad**: la RLS pendiente y el esquema base no versionado son
las dos piezas que separan "excelente para pruebas" de "listo para pacientes reales". Ambas ya están
contempladas en la fase de seguridad final del proyecto; esta auditoría las prioriza y añade dos que no
estaban explícitas: **versionar el baseline** y **la bitácora de acceso a datos clínicos**.

*Nota: auditoría basada en lectura de las migraciones versionadas al 30-jul-2026. Para un cierre formal
previo a producción, complementar con una verificación en vivo del estado efectivo de RLS y un `pg_dump`
del esquema real.*
