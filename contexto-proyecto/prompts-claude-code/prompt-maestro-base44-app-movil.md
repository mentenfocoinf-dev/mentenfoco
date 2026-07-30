# Prompt maestro para Base44 — App móvil de Mente en Foco

Copia y pega el bloque de la sección "PROMPT" completo en el chat de Base44 para iniciar la generación. El resto de este documento (antes y después del bloque) es contexto para ti, no para pegar.

**Nota importante sobre el enfoque:** Base44 no tiene integración oficial con Supabase externo — solo existen workarounds de la comunidad, no soportados por Base44 ni garantizados a futuro. Por eso este prompt le pide a Base44 que genere **su propio backend**, replicando el mismo modelo de datos que ya funciona en la web. Esto es un prototipo rápido para validar la experiencia móvil — los datos NO se sincronizan en vivo con Supabase todavía. Cuando quieran una app móvil de producción de verdad (con los mismos datos que la web), lo natural es construirla nativamente contra el Supabase real (por ejemplo con Claude Code + Expo/React Native), no seguir sobre Base44.

---

## PROMPT

```
Quiero construir una app móvil para "Mente en Foco", una plataforma de salud mental y bienestar
emocional para Colombia (psicología clínica y neuropsicología). Ya existe una versión web completa
y funcionando — quiero que repliques su modelo de datos y sus funcionalidades principales, adaptadas
a una experiencia móvil nativa, no que inventes un producto nuevo.

CONTEXTO DEL PRODUCTO
Mente en Foco conecta pacientes con terapeutas. El paciente tiene un terapeuta asignado, completa
evaluaciones clínicas validadas, ve su progreso en el tiempo, agenda sesiones y le escribe a su
terapeuta entre sesiones. El terapeuta ve a sus pacientes, gestiona su agenda, responde mensajes y
recibe alertas inmediatas si un paciente muestra señales de riesgo.

IDIOMA Y TONO
Todo el texto de la app debe estar en español neutro/colombiano con tuteo — NUNCA voseo argentino
(nada de "podés", "tenés", "sos"; siempre "puedes", "tienes", "eres"). Tono cálido pero profesional
y clínico, nunca infantil ni casual en exceso — es una app de salud mental, no una app de lifestyle.

IDENTIDAD VISUAL
- Color primario: azul marino profundo y desaturado (oklch(0.32 0.06 255), aproximadamente #2b3854).
- Fondos claros, casi blancos, con toques de un azul muy suave como color secundario/de acento.
- Estilo "glassmorphism" suave: tarjetas semi-transparentes con blur, bordes sutiles, sombras suaves,
  gradientes radiales muy tenues de fondo. Nada de colores saturados o infantiles — la estética debe
  transmitir calma, orden y profesionalismo clínico.
- Iconografía simple tipo outline (no ilustraciones cartoon).

ROLES DE USUARIO (dos tipos de cuenta, con login separado o un mismo login que redirige según rol)
1. Paciente
2. Terapeuta

MODELO DE DATOS A REPLICAR (crea estas entidades con estos campos; los nombres pueden adaptarse a
las convenciones de Base44, pero la estructura y relaciones deben ser equivalentes)

- Perfil (profiles): id, email, nombre completo, rol (paciente/terapeuta), tipo de plan
  (gratuito/esencial/integral/premium), estado de suscripción (activo/inactivo).
- Asignación paciente-terapeuta (patient_therapist): qué terapeuta tiene asignado cada paciente
  (relación uno a muchos: un terapeuta, varios pacientes).
- Anamnesis del paciente (patient_anamnesis): un registro por paciente con motivo de consulta,
  antecedentes médicos, antecedentes psiquiátricos personales y familiares, medicación actual,
  consumo de sustancias (incluye un mini-cuestionario AUDIT-C de 3 preguntas con puntaje 0-12), si
  ha tenido antecedentes de autolesión, red de apoyo, y un cribado cognitivo opcional para adultos
  mayores. Se completa una vez y el terapeuta puede verla; el paciente la ve en modo solo lectura.
- Evaluaciones psicométricas (psychometric_evaluations): registros con tipo de escala, puntaje
  total, nivel de severidad y fecha. Tipos de escala:
  - PHQ-9 (depresión, autoadministrable por el paciente, 9 preguntas de frecuencia 0-3).
  - GAD-7 (ansiedad, autoadministrable, 7 preguntas de frecuencia 0-3).
  - C-SSRS (riesgo de seguridad/autolesión, autoadministrable, con lógica de ramificación: si la
    pregunta 2 sobre ideación activa es "sí", se despliegan preguntas adicionales de seguimiento).
  - MoCA y MMSE (cribado cognitivo, NO autoadministrables — las registra el terapeuta después de
    aplicarlas en consulta, no un formulario que el paciente llena solo).
  Cuando una evaluación indica riesgo alto (especialmente en C-SSRS), se dispara una alerta de
  crisis.
- Alertas de crisis (clinical_alerts): registro con paciente, estado (por ejemplo "alta_prioridad")
  y fecha. Al crearse una, el terapeuta asignado a ese paciente debe recibir una notificación push
  INMEDIATA en su teléfono — esta es la función de seguridad más importante de toda la app. El
  paciente, por su lado, ve un mensaje tranquilizador confirmando que ya se avisó a su terapeuta
  (nunca un botón de "llamar a emergencias" con un número — el flujo es siempre avisar al terapeuta
  real, no una línea genérica).
- Agenda de sesiones (therapy_sessions): paciente, terapeuta, fecha y hora, duración en minutos,
  estado (programada/confirmada/completada/cancelada/no_asistio), enlace de videollamada (puede
  estar vacío hasta que el terapeuta lo cargue), y estado de recordatorio. El paciente solo puede
  ver sus sesiones; el terapeuta programa, edita el estado y carga el enlace.
- Mensajes (messages): conversación entre un paciente y su terapeuta asignado (par fijo, no hace
  falta un concepto de "sala" separado). Cada mensaje tiene remitente, cuerpo de texto y si fue
  leído o no. Necesito contador de no leídos y notificación push cuando llega un mensaje nuevo.
- Guías clínicas (clinical_guides): artículos de contenido por categoría (ansiedad, infantil,
  autoestima, ánimo, trauma, alimentación, memoria, etc.), algunos gratuitos y otros solo para
  ciertos niveles de plan (paywall simple por nivel).
- Recomendaciones/tareas clínicas (patient_prescriptions): tareas de intervención que el terapeuta
  asigna al paciente entre sesiones, con título, objetivo clínico e instrucción para el paciente.

PANTALLAS DE LA FASE 1 — PACIENTE (prioridad más alta, es quien más usa la app día a día)
1. Login / registro.
2. Inicio: estado del plan, próxima sesión destacada, accesos rápidos a evaluaciones y mensajes.
3. "Mi progreso": anamnesis en modo lectura, historial de evaluaciones, y un gráfico de tendencia
   PHQ-9/GAD-7 en el tiempo (esta es una función que nos diferencia de la competencia — literal,
   mostrarle al paciente su propia evolución en un gráfico simple es algo que la mayoría de apps de
   este tipo no hace).
4. Evaluaciones: tarjetas para iniciar PHQ-9, GAD-7 o C-SSRS cuando corresponda, con su resultado
   más reciente visible.
5. Agenda: próximas sesiones con fecha/hora/estado y botón para unirse a la videollamada si el
   enlace ya está cargado.
6. Mensajes: chat simple con el terapeuta asignado, con notificación push de mensajes nuevos.
7. Guías: lista de contenido por categoría, con indicador de qué requiere mejorar el plan.

PANTALLAS DE LA FASE 2 — TERAPEUTA (constrúyela después de validar la del paciente)
1. Login.
2. Lista de pacientes asignados.
3. Agenda: vista de sus sesiones, con formulario para programar una nueva y cambiar estado/enlace.
4. Mensajes: bandeja con todas las conversaciones, contador de no leídos por paciente.
5. Alertas de crisis: banner o pantalla dedicada que se abre automáticamente (o notifica push) ante
   cualquier alerta de alta prioridad de sus pacientes.

REGLAS QUE NO PUEDES ROMPER
- Nunca muestres un número de emergencias genérico ni un botón de "llamar a emergencias" — el único
  camino ante una señal de riesgo es notificar al terapeuta asignado.
- No traduzcas ni adaptes el contenido clínico de las escalas (PHQ-9, GAD-7, C-SSRS) — son
  instrumentos validados, deben mantenerse literales.
- Todo el texto en español debe usar tuteo neutro-colombiano, nunca voseo.
- No construyas la parte de pagos/checkout todavía — el paciente ya llega con un plan asignado desde
  la web; eso queda fuera del alcance de esta primera versión.

Empecemos por la Fase 1 completa (todas las pantallas del paciente). Cuando esté validada, seguimos
con la Fase 2 del terapeuta.
```

---

## Qué hacer con la Fase 1 ya generada

1. Pruébala tú mismo primero, sobre todo el flujo de evaluaciones (que la ramificación del C-SSRS funcione) y el de agenda. Base44 cobra créditos por iteración, así que vale la pena confirmar que esto está sólido antes de gastar créditos en ajustes.
2. Cuando estés conforme, sigue con el bloque "PROMPT — FASE 2" de abajo.

---

## PROMPT — FASE 2 (panel del terapeuta)

Pega este bloque completo en el MISMO chat de Base44 donde generaste la Fase 1 (no abras un chat nuevo — necesita el contexto y las entidades que ya existen).

```
Ahora construye la Fase 2 completa: las pantallas del terapeuta. Usa exactamente las mismas
entidades que ya creaste en la Fase 1 (perfiles, asignación paciente-terapeuta, anamnesis,
evaluaciones psicométricas, alertas de crisis, sesiones, mensajes, guías, recetas) — no crees
entidades nuevas ni dupliques las que ya existen.

NAVEGACIÓN Y ACCESO
El login ya distingue entre paciente y terapeuta por el campo de rol del perfil. Cuando un usuario
con rol "terapeuta" inicia sesión, debe ir a esta navegación distinta (no la del paciente), con las
mismas 5 pantallas de abajo en la barra inferior.

PANTALLAS

1. Inicio del terapeuta
   - Resumen: número de pacientes asignados, sesiones de hoy, mensajes sin leer totales.
   - Si hay alguna alerta de crisis activa (alta_prioridad) de cualquiera de sus pacientes, debe
     aparecer como un banner rojo fijo en la parte superior de esta pantalla, imposible de ignorar,
     con el nombre del paciente y un botón directo a su ficha. Esto es lo más importante de toda la
     Fase 2 — un terapeuta nunca debe enterarse tarde de una alerta de riesgo.

2. Mis pacientes
   - Lista de todos los pacientes asignados a este terapeuta (usando la entidad de asignación
     paciente-terapeuta), con su nombre, plan y estado de suscripción.
   - Al tocar un paciente, abre su ficha: anamnesis en modo lectura, historial de evaluaciones
     psicométricas (todas las escalas, no solo las más recientes), e historial de recetas/tareas
     asignadas.
   - Desde la ficha del paciente, botón para asignarle una nueva tarea/recomendación (título,
     objetivo clínico, instrucción para el paciente) usando la entidad de recetas ya creada.
   - Desde la ficha del paciente, botón para registrar un resultado de MoCA o MMSE — recuerda que
     estas dos escalas las aplica y registra el terapeuta, el paciente nunca las llena solo. El
     formulario debe pedir el puntaje y notas del terapeuta, no las 30 preguntas del test completo.

3. Agenda
   - Vista de todas las sesiones de este terapeuta (con todos sus pacientes), ordenadas por fecha,
     con filtro simple de próximas vs. pasadas.
   - Botón "Programar sesión": selector de paciente (solo de los ya asignados a este terapeuta),
     fecha y hora, duración en minutos (45 por defecto), y campo opcional de enlace de videollamada.
   - Cada sesión en la lista debe permitir cambiar su estado (programada, confirmada, completada,
     cancelada, no_asistio) y editar o agregar el enlace de videollamada después de creada — el
     enlace no siempre se conoce al momento de programar.

4. Mensajes
   - Bandeja de conversaciones: una fila por paciente asignado, con su último mensaje y un contador
     de mensajes no leídos.
   - Al tocar una conversación, abre el chat completo con ese paciente. Enviar un mensaje debe
     marcar como leídos los mensajes anteriores de esa conversación.
   - Notificación push cuando llega un mensaje nuevo de cualquier paciente, incluso con la app
     cerrada o en segundo plano.

5. Perfil / Cerrar sesión
   - Nombre del terapeuta, correo, y botón de cerrar sesión.

REGLA QUE NO PUEDES ROMPER (igual que en la Fase 1)
La notificación de una alerta de crisis debe ser push, inmediata, y visible apenas el terapeuta
abre la app (banner en Inicio) — no puede quedar escondida dentro de una pantalla a la que solo se
llega navegando. Esta es la función de seguridad más importante de todo el producto.
```

---

## Sobre construir la app yo mismo (Cowork) — respuesta honesta

Puedo escribir el código de una app nativa (por ejemplo React Native/Expo) reutilizando toda la lógica que ya existe en `src/lib/api/` (las mismas consultas a `therapy_sessions`, `messages`, `psychometric_evaluations`, etc. que ya usa la web) — eso sí lo puedo redactar de una. Pero hay dos cosas que este sandbox de Cowork **no puede hacer**, y las acabo de verificar de nuevo antes de responderte:

- **No tengo salida de red hacia tu Supabase real** (lo confirmé con una prueba directa: la conexión se bloquea). Así que no puedo ejecutar ni probar la app contra tus datos reales desde aquí.
- **Este sandbox no está en tu red WiFi.** Aunque lograra correr algo, tu teléfono nunca podría alcanzarlo — vive en un servidor en la nube, no en tu casa/oficina.

Por eso, para una app nativa de verdad (no el prototipo de Base44), lo que sí puedo hacer es **dejar todo el código de la app Expo escrito y listo**, y que **Claude Code sea quien la corra en tu computador** — ahí sí tiene acceso real a Supabase y a tu red local. Dime si quieres que arranque con eso.

## Cómo ver algo en tu teléfono, en la misma WiFi, antes de generar un APK

Tres caminos distintos según qué quieras ver:

**A. La web de Mente en Foco tal como está hoy, en tu teléfono, ahora mismo (sin construir nada nuevo).**
Pídele a Claude Code que corra `npm run dev -- --host` en tu computador (el flag `--host` expone el servidor a tu red local, no solo a `localhost`). Te va a mostrar una URL tipo `http://192.168.x.x:5173` — ábrela desde el navegador de tu teléfono conectado a la misma WiFi. Es responsive, así que ya deberías ver algo razonable.

**B. La app que generó Base44 (Fase 1/Fase 2).**
Base44 aloja un link de vista previa propio — no necesitas estar en la misma WiFi ni hacer nada especial, ábrelo directo desde el navegador del teléfono con datos o WiFi, el que sea.

**C. Una futura app nativa React Native/Expo (si decides que la construyamos de verdad).**
Ese es el flujo con **Expo Go**: instalas la app "Expo Go" del store en tu teléfono, Claude Code corre `npx expo start` en tu computador (misma WiFi), aparece un código QR en la terminal, lo escaneas con Expo Go, y ves la app nativa en vivo con hot-reload — todo esto antes de generar ningún APK.
