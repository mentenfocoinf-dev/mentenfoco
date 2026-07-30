# Prompt para Claude Code — 16 de julio de 2026

Copia y pega este prompt completo en Claude Code (con acceso al repo local, `npm run dev` y la conexión real a Supabase que Cowork no tiene).

---

## Contexto

Hoy trabajé en paralelo en Cowork (sin acceso de red a Supabase) e hice cambios que son solo edición de archivos — nada de esto se ha probado contra el backend real. Necesito que verifiques que todo funciona en la práctica y que completes lo único que yo no podía hacer desde ahí: aplicar y probar una migración SQL nueva.

Regla del proyecto que debes respetar en todo momento: **no se construye frontend para algo que no tenga ya backend real funcionando y verificado** (regla "backend antes que frontend", impuesta el 16-jul-2026). Además, todo texto en español visible debe usar tuteo/español neutro-colombiano — nunca voseo argentino (nada de "podés", "tenés", "sos", etc.).

## Archivos que cambié hoy (revisar, no rehacer)

1. `src/routes/contactanos.tsx` — reformulé la entrada "Alex AI" en la lista de canales de contacto para que ya no se presente como un canal de urgencias 24h real, sino como "Próximamente para plan VIP".
2. `src/routes/membresia.tsx` — mismo cambio en la lista de beneficios de membresía.
3. `src/lib/api/plans.ts` — mismo cambio en el beneficio `PLAN_BENEFITS` usado por el paywall/comparador de planes.
4. `src/components/dashboard/PatientDashboard.tsx` — agregué:
   - Tarjeta "Tu anamnesis" (solo lectura, usa `getPatientAnamnesis` ya existente en `lib/api/clinicalService.ts`; si no hay anamnesis, muestra CTA a `/anamnesis`).
   - Tarjeta "Progreso en el tiempo": gráfico de línea con `recharts` (ya era dependencia del proyecto, no agregué ninguna) mostrando PHQ-9 y GAD-7 en el tiempo, más un historial completo desplegable de todas las evaluaciones (usa `getPatientEvaluations`, también ya existente).
   - No toqué el backend porque ambas funciones ya existían y ya tenían RLS — solo consumí lo que faltaba consumir en el frontend.
5. `supabase/20260716_create_therapy_sessions.sql` — **migración NUEVA, redactada pero NUNCA aplicada ni probada.** Crea la tabla `therapy_sessions` (agenda de sesiones paciente↔terapeuta) con estado, `video_call_link`, `reminder_status`, índices y RLS completo siguiendo el mismo patrón que `clinical_alerts` y `patient_anamnesis`.
6. `auditoria-diagnostico-julio-2026/diagnostico_sitio.html` — solo actualicé porcentajes/textos del diagnóstico visual para reflejar lo de arriba. Es un documento informativo, no afecta la app.

## Lo que necesito que hagas

### 1. Aplicar y probar la migración de agenda (prioridad alta)
- Aplica `supabase/20260716_create_therapy_sessions.sql` contra el proyecto real de Supabase.
- Verifica que las policies de RLS funcionan como se espera, con usuarios de prueba reales:
  - Un paciente solo puede hacer `SELECT` de sus propias filas en `therapy_sessions` (no puede insertar/editar/borrar directamente).
  - Un terapeuta solo puede `SELECT`/`INSERT`/`UPDATE`/`DELETE` sobre sesiones de pacientes que tenga asignados en `patient_therapist` — prueba que falle si intenta tocar un paciente que no es suyo.
  - Un admin puede hacer todo.
- Verifica que el trigger `trg_therapy_sessions_updated_at` efectivamente actualiza `updated_at` en cada `UPDATE`.
- Si algo de esto falla o necesita ajuste, corrígelo directamente en la migración (o en una migración de corrección) — no me lo devuelvas para que yo lo edite a ciegas sin Supabase.
- **No construyas todavía la interfaz de calendario/agenda.** Eso viene después, una vez esta migración esté confirmada funcionando — por la regla backend-antes-que-frontend.

### 2. Verificar los cambios de `PatientDashboard.tsx` contra datos reales
- Corre `npm run dev` y entra como un paciente de prueba.
- Confirma que no hay errores de consola ni de build por el import de `recharts` o los nuevos hooks (`useMemo`).
- Prueba los tres estados de la tarjeta de anamnesis: sin anamnesis (debe mostrar el CTA), con anamnesis parcial, con anamnesis completa.
- Prueba el gráfico de tendencia con 0, 1 y 2+ evaluaciones PHQ-9/GAD-7 guardadas — con menos de 2 debe mostrar el mensaje de "aún no hay suficientes evaluaciones", no un gráfico vacío o roto.
- Revisa el historial desplegable con al menos una evaluación C-SSRS o MoCA/MMSE mezclada, para confirmar que el formato de esas filas (que no tienen `total_score` comparable) se ve bien.

### 3. Confirmar que no rompí nada con los cambios de texto de "Alex AI"
- `npm run build` (o `tsc --noEmit`) para confirmar que no hay errores de tipo en `contactanos.tsx`, `membresia.tsx` ni `plans.ts`.
- Revisión visual rápida de `/contactanos` y `/membresia` para confirmar que el texto "Próximamente" se ve bien en el diseño (no se truncó ni rompió el layout).

### 4. Después de que la migración esté verificada (no antes)
Estas son las siguientes tareas del roadmap, pero **bloqueadas** hasta confirmar el punto 1:
- Construir la UI de agenda/calendario para paciente y terapeuta sobre `therapy_sessions`.
- Mensajería básica paciente↔terapeuta (sigue sin ninguna tabla — sería la siguiente pieza de backend a diseñar, no antes de terminar agenda).

Repórtame en español neutro/tuteo (no voseo) qué funcionó, qué tuviste que ajustar, y cualquier cosa de la migración que haya requerido cambios respecto a lo que dejé escrito.

---

## Actualización — Parte 2 (mismo 16-jul, después de tu verificación)

Con `therapy_sessions` ya aplicada y probada por ti, construí la UI de agenda en el mismo sandbox (Cowork), sobre los mismos archivos del repo — no hay nada que copiar ni transferir, ya está en el working tree.

### Archivos nuevos/modificados en esta segunda vuelta

1. `src/lib/api/sessionsService.ts` — **archivo nuevo.** CRUD de `therapy_sessions`: `getPatientSessions`, `getTherapistSessions` (con join a `profiles` vía `profiles!therapy_sessions_patient_id_fkey`), `createSession`, `updateSessionStatus`, `updateSessionVideoLink`, `cancelSession`.
2. `src/lib/api/index.ts` — agregué `export * from "./sessionsService"`.
3. `src/components/dashboard/PatientDashboard.tsx` — agregué la tarjeta "Próximas sesiones" (solo lectura): lista las próximas 5 sesiones no canceladas, muestra fecha/hora/duración/estado, y el botón de videollamada solo si `video_call_link` no es null.
4. `src/components/dashboard/TherapistDashboard.tsx` — agregué la sección "Agenda de sesiones": lista de todas las sesiones con selector de estado inline y campo para cargar/actualizar el enlace de videollamada, más un formulario para programar una sesión nueva (paciente, fecha/hora, duración, enlace opcional).

### Lo que necesito que verifiques (no reconstruyas, solo prueba)

1. Corre `npm run dev`, entra como terapeuta con al menos un paciente asignado y programa una sesión de prueba desde el formulario nuevo.
2. Confirma que el `select` de join `profiles!therapy_sessions_patient_id_fkey` en `getTherapistSessions` resuelve bien contra el nombre real que Postgres le dio a esa foreign key (debería ser automático porque no la nombré explícitamente en la migración, pero verifícalo — si Supabase da error de "could not find relationship", el nombre de constraint real es distinto y hay que ajustarlo en `sessionsService.ts`).
3. Entra como el paciente de esa sesión y confirma que aparece en "Próximas sesiones", con el enlace de videollamada si lo cargaste como terapeuta.
4. Cambia el estado de la sesión a "cancelada" desde el panel del terapeuta y confirma que desaparece de "Próximas sesiones" del paciente (la lista filtra `status !== "cancelada"`).
5. `npm run build` / `tsc --noEmit` para confirmar que no hay errores de tipo en los 4 archivos de esta parte.

### Sobre el commit

Ya me confirmaron que sí quieren que commitees todo lo pendiente (el fix del gráfico, la migración con el trigger endurecido, el tuteo de las guías, y ahora también esta UI de agenda una vez la verifiques). Hazlo en el o los commits que consideres más claros siguiendo Conventional Commits, como el resto del historial del repo.

---

## Actualización — Parte 3 (mismo 16-jul, tras construir mensajería)

Con `messages` ya construida y subida por ti (backend + UI de chat/inbox), completé en el sandbox los 3 pendientes que quedaban marcados como "Media" en el diagnóstico: badge global de mensaje nuevo, calendario visual sobre la agenda, y el diseño completo (código listo, sin desplegar) de recordatorios de sesión por correo.

### Archivos nuevos/modificados en esta tercera vuelta

**Badge de mensaje nuevo (100%, solo frontend, no necesita nada tuyo):**
1. `src/lib/api/messagesService.ts` — agregué `getPatientUnreadCount` y `getTherapistUnreadCount`.
2. `src/components/messaging/TherapistMessages.tsx` — agregué el prop opcional `onConversationsChange` para que el badge del header se mantenga sincronizado sin duplicar la consulta.
3. `src/components/dashboard/PatientDashboard.tsx` y `TherapistDashboard.tsx` — agregué un botón "Mensajes" en el header con contador rojo de no leídos (fetch inicial + Realtime), que hace scroll a la tarjeta de mensajería (`id="mensajeria"`).

**Calendario visual (100%, solo frontend, no necesita nada tuyo):**
4. `src/components/agenda/WeeklyAgenda.tsx` — **archivo nuevo.** Vista semanal reutilizable (7 columnas, navegación anterior/siguiente, botón "Volver a hoy") sobre los datos ya verificados de `therapy_sessions`. Coloreada por estado. Se insertó dentro de las tarjetas de agenda existentes en `PatientDashboard.tsx` y `TherapistDashboard.tsx` — no reemplaza la lista ni el formulario de gestión del terapeuta, los complementa.

**Recordatorios de sesión por correo (código listo, DESPLIEGUE pendiente — esto sí necesita acción tuya y del usuario):**
5. `supabase/functions/send-session-reminders/index.ts` — **función nueva, nunca desplegada ni probada.** Busca sesiones entre 23-25h antes de `scheduled_at` con `reminder_status = 'pendiente'`, envía el correo vía Resend, y marca `reminder_status` como `'enviado'` o `'fallido'`. Usa el remitente de pruebas `onboarding@resend.dev` de Resend por defecto (no exige dominio propio verificado para empezar a probar hoy).
6. `supabase/20260717_schedule_session_reminders.sql` — **migración nueva, sin aplicar.** Habilita `pg_cron`/`pg_net` y programa la función para correr cada hora. Tiene dos placeholders (`<PROJECT_REF>` y `<SERVICE_ROLE_KEY>`) que hay que reemplazar con los valores reales del proyecto — **no commitear el service role key en texto plano**, usar Supabase Vault como está comentado en el archivo.

### Lo único que falta para que los recordatorios funcionen de verdad

Del lado del usuario (Valo's): crear una cuenta gratuita en [resend.com](https://resend.com) y generar una API key — 5 minutos, no requiere dominio propio para el remitente de pruebas.

Del lado de Claude Code, una vez tengas la API key:
1. `supabase secrets set RESEND_API_KEY=<la key>` (y opcionalmente `REMINDER_FROM_EMAIL` si más adelante se verifica un dominio propio en Resend).
2. `supabase functions deploy send-session-reminders`.
3. Completar los dos placeholders de `supabase/20260717_schedule_session_reminders.sql` con el project ref real y el service role key vía Vault, y aplicar la migración.
4. Probar de punta a punta: crear una sesión de prueba con `scheduled_at` a ~24h de ahora, invocar la función manualmente (`supabase functions invoke send-session-reminders`) en vez de esperar al cron, confirmar que llega el correo y que `reminder_status` pasó a `'enviado'` en la tabla.
5. Confirmar también el caso de error: sin `RESEND_API_KEY` configurada, la función debe responder 500 sin tumbar nada más.

Repórtame igual que las veces anteriores: qué funcionó, qué tuviste que ajustar, y si el nombre de la extensión/cron quedó exactamente como lo dejé o tuviste que adaptarlo al proyecto real.

Después de esto, lo único que queda realmente en cero es mensajería paciente↔terapeuta — siguiente prioridad, backend primero.
