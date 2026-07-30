# Análisis estratégico — Freemium → Anamnesis → Dashboard con upsells

Fecha: 2026-07-21. Rol: consultor estratégico (ver nota al final sobre cómo pediste que trabaje de aquí en
adelante). Comparado contra Selia (líder colombiano, 500+ especialistas, 83.000 reseñas a 4.92/5, sesiones
desde $80.000 con paquetes de 4/8/12), y contra Terapify y BetterHelp investigados en una auditoría previa.

## 1. Lo que el flujo de hoy hace bien

El diseño tiene tres decisiones correctas que casi nadie en este mercado tiene las tres a la vez: la
anamnesis gratuita como imán de leads es más agresivo que lo que hace cualquiera de los tres competidores
(ellos piden un test corto de 10-15 minutos, no una historia clínica completa); el límite de evaluaciones por
trigger de base de datos, no por UI, significa que no se puede bypasear desde la app móvil ni desde un
script — eso es solidez técnica real, no cosmética; y la exclusión explícita del C-SSRS del muro comercial es
la clase de decisión que, bien comunicada, se vuelve un argumento de venta ("nunca vamos a cobrarte por tu
seguridad").

## 2. El gap más grande: no existe elección de terapeuta

Este es el punto crítico del análisis. Selia, Terapify y BetterHelp compiten fundamentalmente en **matching**:
el paciente ve perfiles, especialidades, reseñas, y elige (o un algoritmo sugiere) a su terapeuta en minutos.
En Mente en Foco, hoy la asignación paciente↔terapeuta es un RPC que ejecuta el admin manualmente desde su
panel — el paciente nunca ve un directorio, nunca elige, nunca sabe que tuvo opciones. Para un paciente nuevo
que viene de completar la anamnesis gratuita, aterrizar en "ya tienes un terapeuta asignado" sin haber elegido
nada es la antítesis de lo que el mercado le enseñó a esperar (Selia: "encuentra especialista compatible en
~3 minutos"; BetterHelp: "se puede pedir cambio con un clic").

Esto no es un defecto menor de UX — es la ausencia de la mecánica de conversión más importante del sector.
Recomendación concreta: después de la anamnesis, en vez de "en breve un terapeuta te contactará", mostrar 2-3
perfiles de terapeutas disponibles (foto, especialidad, años de experiencia, frase corta) cruzados con las
etiquetas de motivo de consulta que ya se capturan (`CHIEF_COMPLAINTS` en `ClinicalReportModal.tsx` — el
mismo catálogo se puede reusar para taggear especialidades de terapeuta). El admin sigue haciendo el match
final si quiere mantener control de calidad, pero el paciente necesita *sentir* que eligió.

## 3. El embudo de upsell es reactivo, no anticipatorio

Hoy el upsell ("Mejorar mi plan", "Solicitar servicio adicional") vive donde el paciente tiene que ir a
buscarlo. La investigación de mercado sobre modelos freemium es consistente en un punto: las tasas de
conversión free→pago típicas están entre 1-5%, y lo que las mueve por encima de ese rango es el upsell
*contextual atado al uso real*, no un botón fijo esperando a que alguien lo note.

Ejemplo concreto y ya construible con lo que existe: cuando el trigger de límite de evaluaciones bloquea al
usuario Free ("disponible el [fecha]"), ese es el momento de mayor fricción y mayor conciencia del valor —
ahí debería aparecer, en el mismo modal de bloqueo, no un genérico "mejora tu plan" sino "con el plan Esencial
puedes hacer seguimiento semanal en vez de mensual" con el precio y el link directo. Es la misma lógica que
ya aplicaron bien al excluir C-SSRS del límite: la oportunidad de upsell más fuerte es la que nace de una
necesidad real detectada por el propio sistema clínico, no de un banner.

Otro momento de alto valor sin explotar: cuando un PHQ-9/GAD-7 resulta en severidad "Moderado" o mayor, ese
es el instante en que un usuario Free está más convencido de que necesita ayuda estructurada. Un mensaje
breve, no alarmista, del estilo "tu resultado sugiere que hablar con un especialista te ayudaría — ¿quieres
ver los planes?" es coherente con la lógica clínica y comercialmente mucho más fuerte que un botón fijo.
**Límite ético que hay que trazar aquí y no cruzar:** este mensaje no puede aparecer en el mismo momento que
la app_ está mostrando resultados de riesgo suicida (C-SSRS) — ahí el único mensaje válido es el de seguridad,
nunca una oferta comercial. Mezclar ambos sería explotar un momento de vulnerabilidad real, y es exactamente
el tipo de práctica que la evidencia sobre freemium en salud mental identifica como dañina y que además,
tácticamente, sería un desastre reputacional si trasciende.

## 4. Retención: hay dos widgets nuevos, falta el hilo narrativo entre sesiones

`DailyQuoteCard` y `MoodTrackerCard` son un buen punto de partida — son exactamente el tipo de "hábito diario
liviano" que la investigación de monetización de apps identifica como el que mejor sostiene una suscripción
(el paralelo es Headspace/Calm: el contenido de pago se sostiene con un hábito gratuito diario). Lo que falta
es conectar esos dos datos con algo que ya existe en el roadmap de ideas de este proyecto: la "Línea de tiempo
de ADN Clínico" mencionada en la sección de diferenciación de este mismo diagnóstico. Hoy el mood tracker y el
gráfico de PHQ-9/GAD-7 viven en tarjetas separadas sin relación visual. Cruzar "cómo te sentiste día a día"
contra "tu puntaje de la última evaluación" en una sola vista es, literalmente, algo que ninguno de los tres
competidores investigados ofrece — y ya tienen los dos datasets construidos, falta solo la vista combinada.

Sobre gamificación de rachas ("streaks"): es una mecánica de retención probada, pero en salud mental hay
evidencia de que las rachas rotas generan culpa y abandono en vez de motivación (el usuario que se salta un
día dos veces siente que "falló" y deja de volver). Si se implementa, debe enmarcarse como "días de cuidado
acumulados" (que nunca bajan) y no como una racha que se puede romper.

## 5. Empaquetado: el modelo híbrido ya está ahí sin que se haya notado

Selia vende por sesión/paquete (4, 8, 12), nosotros vendemos por suscripción (Esencial/Integral/Premium). La
tabla `service_requests` que ya se construyó hoy para "servicio adicional" es, sin que se haya planteado así
explícitamente, la puerta de entrada al modelo de Selia dentro del nuestro: un usuario Free o Esencial que no
quiere comprometerse a una suscripción puede comprar una sesión suelta o una valoración neuropsicológica
puntual. Vale la pena nombrar esto como estrategia explícita ("compra por sesión" como entrada, suscripción
como retención) en vez de dejarlo como una feature aislada — es el mismo patrón que usa el líder del mercado,
y ya tenemos la tabla que lo soporta.

## 6. Qué priorizar primero (orden sugerido, sin tocar el trabajo ya en curso de los gaps de terapeuta)

1. **Directorio/selección de terapeuta post-anamnesis** — es el gap más grande frente al mercado, y el que
   más directamente mejora la conversión free→pago porque le da al usuario una razón concreta para creer que
   "este terapeuta es para mí".
2. **Upsell contextual en el momento del bloqueo de evaluación y en severidad moderada+** — reusa UI que ya
   existe (el modal de plan conectado a Stripe), solo cambia cuándo y con qué copy aparece.
3. **Vista combinada de ánimo diario + tendencia de evaluaciones** — valor de retención alto, cero backend
   nuevo (ambos datasets ya existen).
4. **Nombrar y comunicar el modelo híbrido** (suscripción + compra puntual vía `service_requests`) como
   estrategia de producto, no como una feature suelta.

## Nota sobre cómo voy a trabajar de aquí en adelante

Guardé en memoria que cuando me pases un boceto de idea, en vez de solo documentarlo voy a compararlo contra
competidores reales y proponer cómo expandirlo — con un límite explícito: agresividad comercial sí, pero
nunca a costa de explotar momentos de vulnerabilidad clínica real (crisis, riesgo suicida). Ese límite no es
negociable y lo voy a señalar cada vez que una idea se acerque a cruzarlo, como hice arriba con el punto 3.
