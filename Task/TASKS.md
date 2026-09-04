---
proyecto: mente-en-foco
nombre: Mente en Foco
cliente: Mente en Foco
agencia: Valo's Agency
responsable_principal: Karen Andrea Cobo Correa
actualizado: 2026-09-03
estado_general: en_progreso
total_tareas: 19
completadas: 0
bloqueadas: 2
progreso_pct: 0
esfuerzo_total_h: 117.2
prefijo_id: MEF
repositorio: C:\Users\santy\Desktop\Antigravity\Mente en Foco
fuente: 01_ROADMAP_Y_TAREAS.md, AUDITORIA_MENTE_EN_FOCO.html, contexto-proyecto/auditorias-tecnicas/
nota_esfuerzo: Las horas son estimaciones añadidas el 2026-09-03 para poder agregar el proyecto al panel. El documento original no las traía. Ajustar cuando se planifique cada bloque.
---

# Tareas — Mente en Foco

## Contexto en una línea

Plataforma clínica de salud mental (web + app móvil de paciente) sobre Supabase, con historia clínica sujeta a la normativa colombiana. El desarrollo está maduro; **lo que queda pendiente es casi todo de activación, cumplimiento y endurecimiento**, no de construcción.

## Cuello de botella actual

**MEF-001 (copias de seguridad recuperables) es lo primero y no admite discusión:** hoy no existe ninguna copia de la base de datos restaurable, y todo lo demás de esta lista implica tocar producción. Cualquier operación estructural irreversible hecha antes de tener PITR activo es una apuesta.

Después, el bloque de activaciones manuales (MEF-003, MEF-005, MEF-006, MEF-007) es lo que separa el producto de estar realmente en el aire.

## Resumen por fase

| Fase | Nombre | Tareas | Bloqueadas | Esfuerzo (h) |
|---|---|---|---|---|
| 0 | Continuidad de datos y seguridad crítica | 5 | 1 | 13.2 |
| 1 | Activaciones de salida a producción | 3 | 0 | 9 |
| 2 | Cumplimiento, proceso y endurecimiento | 4 | 1 | 13 |
| 3 | Mejoras de seguridad y operación | 4 | 0 | 22 |
| 4 | Producto futuro | 3 | 0 | 60 |
| | **Total** | **19** | **2** | **117.2** |

---

## Tabla maestra

| ID | Título | Estado | Prioridad | Fase | Área | Responsable | Esfuerzo (h) | Bloqueado por |
|---|---|---|---|---|---|---|---|---|
| MEF-001 | Activar copias de seguridad recuperables (PITR) | pendiente | critica | 0 | infraestructura | karen | 2 | - |
| MEF-002 | Diseñar la exportación cifrada para retención legal de 15 años | pendiente | alta | 0 | cumplimiento | karen | 8 | - |
| MEF-003 | Rotar la clave de Resend y verificar el dominio de correo | pendiente | alta | 0 | seguridad | karen | 1.5 | - |
| MEF-004 | Retirar el secreto de redirección de correo de desarrollo | bloqueado | baja | 0 | seguridad | karen | 0.2 | MEF-003 |
| MEF-005 | Cargar las claves de Cloudflare Turnstile | pendiente | alta | 0 | seguridad | karen | 1.5 | - |
| MEF-006 | Pasar Stripe a modo real (live) | pendiente | media | 1 | pagos | karen | 3 | - |
| MEF-007 | Configurar dominio propio y verificación en Google Cloud | pendiente | media | 1 | infraestructura | karen | 2 | - |
| MEF-008 | Revisión jurídica de consentimientos y política de datos | pendiente | media | 1 | legal | karen | 4 | - |
| MEF-009 | Activar el módulo B2B / Empresas | bloqueado | baja | 2 | producto | claude-code | 6 | MEF-008 |
| MEF-010 | Escaneo automatizado de secretos en el código | pendiente | media | 2 | seguridad | claude-code | 3 | - |
| MEF-011 | Actualización automática de dependencias de construcción | pendiente | baja | 2 | mantenimiento | claude-code | 2 | - |
| MEF-012 | Pasar la política de contenido (CSP) a modo activo | pendiente | media | 2 | seguridad | claude-code | 2 | - |
| MEF-013 | Cifrado a nivel de campo para datos clínicos sensibles | pendiente | baja | 3 | seguridad | claude-code | 8 | - |
| MEF-014 | Migrar la sesión de usuario a cookie segura (HttpOnly) | pendiente | baja | 3 | seguridad | claude-code | 4 | - |
| MEF-015 | Validación estructurada (Zod) en funciones de servidor | pendiente | baja | 3 | seguridad | claude-code | 6 | - |
| MEF-016 | Monitoreo y alertas de rendimiento (APM) | pendiente | baja | 3 | operacion | claude-code | 4 | - |
| MEF-017 | Aplicación móvil para terapeutas | pendiente | baja | 4 | producto | claude-code | 40 | - |
| MEF-018 | Habilitar terapia de pareja y orientación para padres | pendiente | baja | 4 | contenido | karen | 8 | - |
| MEF-019 | Ampliación de contenido educativo y guías | pendiente | baja | 4 | contenido | karen | 12 | - |

---

## Detalle

### MEF-001 · Activar copias de seguridad recuperables (PITR)

**Por qué:** hoy **no existe ninguna copia de la base de datos restaurable**. Es una plataforma con historia clínica: una pérdida de datos aquí no es un incidente técnico, es un problema legal y de pacientes reales. Y bloquea el resto de operaciones estructurales irreversibles.

**Cómo:** subir el plan de Supabase y activar Point-in-Time Recovery con retención de 28 días. Tiene costo mensual asociado — es una decisión de negocio, no técnica.

**Criterio de aceptación:** `scripts/verify-pitr.cjs` confirma PITR activo y se prueba una restauración a un punto anterior.

**Referencia:** `contexto-proyecto/auditorias-tecnicas/Guia_R1_Backups_PITR.md`, `scripts/verify-pitr.cjs`

---

### MEF-002 · Diseñar la exportación cifrada para retención legal de 15 años

**Por qué:** PITR **no cubre** la obligación de conservar la historia clínica 15 años (Res. 1995/1999 mod. 839/2017). Son dos problemas distintos con una sola solución aparente, y confundirlos deja al proyecto fuera de norma sin saberlo.

**Cómo:** definir dónde y cómo se guardan exportaciones cifradas periódicas **fuera de Supabase**, con qué frecuencia y quién custodia las claves. Está sin diseñar: primero la decisión de mecanismo y almacenamiento, después la implementación.

**Criterio de aceptación:** mecanismo documentado, primera exportación cifrada generada y verificada su restauración.

**Referencia:** `contexto-proyecto/auditorias-tecnicas/Guia_R1_Backups_PITR.md` (sección 5)

---

### MEF-003 · Rotar la clave de Resend y verificar el dominio de correo

**Por qué:** la clave está **comprometida y sin rotar desde el 2026-07-19**. Además desbloquea MEF-004.

**Cómo:** generar nueva API key en Resend, verificar el dominio propio con los registros DNS, y actualizar el secreto `RESEND_API_KEY` en Supabase.

**Criterio de aceptación:** `scripts/verify-resend.cjs` pasa y un correo sale desde el dominio propio.

**Referencia:** `scripts/verify-resend.cjs`, `GUIA_ACTIVACIONES_MANUALES.html` (sección P1)

---

### MEF-004 · Retirar el secreto de redirección de correo de desarrollo

**Por qué:** `DEV_MAIL_REDIRECT` desvía los correos reales. Hay que quitarlo, pero **retirarlo antes de verificar el dominio rompería el envío**, por eso espera a MEF-003.

**Criterio de aceptación:** el secreto ya no existe en el panel de Supabase y los correos llegan a sus destinatarios reales.

---

### MEF-005 · Cargar las claves de Cloudflare Turnstile

**Por qué:** el código anti-robots está listo pero las claves no están cargadas, así que la verificación no corre. El límite de intentos por IP está activo mientras tanto, pero no sustituye al captcha.

**Cómo:** crear el widget en Cloudflare Turnstile, cargar `TURNSTILE_SECRET_KEY` en Supabase y `VITE_TURNSTILE_SITE_KEY` en el build del frontend, y volver a desplegar.

**Criterio de aceptación:** `scripts/verify-turnstile.cjs` pasa y el widget aparece en el formulario.

**Referencia:** `contexto-proyecto/auditorias-tecnicas/Remediacion_R3_Rate_Limit_Captcha_2026-08-20.md`

---

### MEF-006 · Pasar Stripe a modo real (live)

**Cómo:** cambiar claves de prueba a reales, recrear los enlaces de pago en modo live, configurar el webhook real, y **probar una compra de bajo valor de punta a punta antes de anunciar el cambio**.

**Criterio de aceptación:** una compra real de prueba completada, con su webhook recibido y el acceso otorgado.

**Referencia:** `GUIA_ACTIVACIONES_MANUALES.html` (sección P3)

---

### MEF-007 · Configurar dominio propio y verificación en Google Cloud

**Por qué:** sin esto, el login con Google no funciona en producción.

**Cómo:** conectar el dominio definitivo en Cloudflare Workers, verificarlo ante Google Cloud Console y actualizar las URIs autorizadas de OAuth.

**Criterio de aceptación:** un usuario entra con Google desde el dominio de producción.

**Referencia:** `GUIA_ACTIVACIONES_MANUALES.html` (sección P4)

---

### MEF-008 · Revisión jurídica de consentimientos y política de datos

**Por qué:** además de ser obligatorio, **bloquea el módulo B2B** (MEF-009). Requiere abogado especializado, no criterio propio.

**Cómo:** validar el texto definitivo de la política de tratamiento de datos (Ley 1581/2012), el consentimiento clínico y el nuevo consentimiento de vínculo empleado↔empresa.

**Criterio de aceptación:** los tres textos con visto bueno jurídico por escrito.

**Referencia:** `GUIA_ACTIVACIONES_MANUALES.html` (sección P5)

---

### MEF-009 · Activar el módulo B2B / Empresas

**Por qué:** el backend ya existe (entidad de empresa, vínculo de empleados, métricas agregadas anónimas) pero está **inerte a propósito** hasta cerrar la revisión legal. No es deuda técnica, es una decisión.

**Referencia:** `contexto-proyecto/auditorias-tecnicas/Backend_B2B_Empresas_2026-08-21.md`

---

### MEF-010 · Escaneo automatizado de secretos en el código

**Por qué:** hoy se compensa revisando manualmente cada cambio antes de subirlo. Funciona hasta el día que no.

**Cómo:** implementar `gitleaks` o similar como verificación antes de cada cambio y en integración continua.

**Referencia:** `Security_Assessment_20_Pilares_2026-08-25.md` (pilar 2)

---

### MEF-011 · Actualización automática de dependencias de construcción

**Por qué:** 9 componentes de construcción (no de producción) tienen alertas de seguridad menores. El riesgo real es bajo; el costo de revisarlas a mano cada vez, no.

**Referencia:** `Security_Assessment_20_Pilares_2026-08-25.md` (pilar 20)

---

### MEF-012 · Pasar la política de contenido (CSP) a modo activo

**Por qué:** las cabeceras de protección están implementadas pero la CSP está en modo solo-observación, así que hoy no bloquea nada.

**Cómo:** desplegar, observar unos días, y cuando no se detecten bloqueos legítimos pasarla a modo forzado. Necesita verificación de negocio después del despliegue.

**Referencia:** `src/start.ts`, roadmap sección P8

---

### MEF-013 · Cifrado a nivel de campo para datos clínicos sensibles

**Por qué:** hoy el cifrado es a nivel de infraestructura. Anamnesis y notas clínicas son categoría de dato especialmente sensible y merecen evaluarse aparte. Mejora, no bloqueante.

---

### MEF-014 · Migrar la sesión de usuario a cookie segura (HttpOnly)

**Por qué:** hoy la sesión se guarda con el método estándar del navegador. Una cookie HttpOnly añade una capa ante un escenario de ataque avanzado. Mejora, no bloqueante.

---

### MEF-015 · Validación estructurada (Zod) en funciones de servidor

**Cómo:** añadir un esquema de validación uniforme en la frontera de cada función de servidor pública, en vez de validaciones manuales sueltas.

---

### MEF-016 · Monitoreo y alertas de rendimiento (APM)

**Por qué:** no hay herramientas de monitoreo de lentitud ni alertas automáticas. Recomendable **antes** de un crecimiento significativo de tráfico, no urgente hoy.

---

### MEF-017 · Aplicación móvil para terapeutas

**Por qué:** la app móvil hoy solo cubre la experiencia del paciente (Fase 1). Extenderla al rol de terapeuta es la siguiente fase natural. Sin fecha definida.

---

### MEF-018 · Habilitar terapia de pareja y orientación para padres

**Por qué:** el sistema **ya soporta** marcar estas especialidades sin cambios de código. Solo falta producir el contenido y que los terapeutas marquen su especialidad. Es la tarea de producto con mejor relación esfuerzo/resultado de la lista.

---

### MEF-019 · Ampliación de contenido educativo y guías

**Cómo:** nuevas categorías de guías, más piezas por plan y contenido en audio (meditaciones guiadas). Continuo, pendiente de priorizar en el calendario editorial.

---

## Resumen por responsable

| Responsable | Tareas | Esfuerzo (h) |
|---|---|---|
| karen (negocio/activaciones/contenido) | 10 | 42.2 |
| claude-code (desarrollo) | 9 | 75 |
