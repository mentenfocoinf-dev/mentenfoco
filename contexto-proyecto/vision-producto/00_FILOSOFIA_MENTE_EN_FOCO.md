---
tags: [mente-en-foco, filosofia, vision-producto]
documento: filosofía oficial
estado: vigente
prioridad: máxima
actualizado: 2026-07-30
---

# Filosofía de Mente en Foco

> [!warning] Lectura obligatoria antes de tocar el producto
> Este documento tiene **prioridad sobre cualquier roadmap, especificación o análisis
> estratégico futuro**. Si una tarea, una spec o una idea de negocio contradice algo de
> aquí, se detiene la tarea y se discute la filosofía — no se ejecuta la tarea.
>
> Aplica a cualquiera que modifique el producto: desarrollador humano, diseñador, redactor,
> o modelo de IA trabajando con o sin supervisión.

> [!info] De dónde sale esto
> Nada de este documento es una aspiración inventada. Cada afirmación se deriva de decisiones
> que **ya se tomaron y ya están construidas** en la plataforma, registradas en
> `Decisiones tecnicas`, `analisis-estrategico/`, `contenido-plataforma/00_guia_estilo_redaccion.md`,
> el `Marco normativo` y las specs de producto. Lo que sigue no propone una cultura: la
> pone por escrito, porque hasta hoy vivía repartida en notas técnicas y se estaba perdiendo.

---

## Qué es Mente en Foco

Mente en Foco es un **centro clínico de salud mental que opera de forma íntegramente digital**.
No es una app de bienestar con psicólogos adjuntos: es una práctica clínica —con historia
clínica real, instrumentos validados, documentos firmados e inmutables y trazabilidad
ético-legal— cuya puerta de entrada resulta ser una pantalla.

Tres cosas la definen y ninguna es negociable:

1. **Es clínica de verdad.** Anamnesis completa, PHQ-9, GAD-7, C-SSRS, MoCA/MMSE, valoraciones,
   evoluciones e informes que quedan firmados y no se pueden alterar (Resolución 839/2017).
   Lo que se registra aquí es historia clínica, con todo lo que eso obliga.
2. **Es un espacio de acompañamiento, no un catálogo.** La persona que llega no está comprando
   un producto: está atravesando algo. El producto existe para sostener ese proceso.
3. **Es un lugar donde se aprende.** Guías, contenido, programas, herramientas y tests abiertos
   existen para que alguien entienda lo que le pasa **aunque nunca contrate nada**.

Su diferenciador real frente al mercado colombiano no es el precio ni el catálogo de
terapeutas: es que **le devuelve al paciente su propia evolución clínica** —su tendencia
psicométrica en el tiempo, sus documentos, su proceso— y que cubre neuropsicología y
deterioro cognitivo, terreno que ningún competidor directo ocupa.

---

## Qué NO es

- **No es una máquina de cobrar.** Esa frase literal es la razón por la que se borraron todos
  los candados del producto. Si una pantalla se siente como un peaje, está mal construida.
- **No es un marketplace de terapeutas.** El terapeuta no compite por clientes dentro de la
  plataforma ni es puntuado como un proveedor.
- **No es una app de "productividad emocional".** No hay rachas, no hay puntos, no hay presión
  por volver todos los días.
- **No es un servicio de urgencias.** No atiende crisis en tiempo real, y lo dice de frente en
  el consentimiento clínico, en el contenido y en los tests públicos. Cuando alguien está en
  riesgo, la plataforma **lo saca hacia ayuda real** (`/lineas-de-crisis`, línea 123, urgencias)
  en vez de retenerlo.
- **No es un producto que use el dolor como palanca de conversión.** Ni una vez. Ni "solo esta
  vez". Ni "es que convierte mejor".
- **No es un SaaS con niveles.** Los planes no son SKUs; ver
  [Cómo entendemos los planes](#cómo-entendemos-los-planes).

---

## Nuestra misión

**Que alguien que la está pasando mal encuentre, en el mismo lugar, tres cosas: entender qué
le pasa, saber qué hacer con eso, y —si lo necesita y lo quiere— alguien profesional que lo
acompañe.**

En ese orden. Entender viene primero porque es lo que la mayoría no tiene y lo que casi nadie
regala. Por eso la biblioteca, el blog y los tests son abiertos: la misión se cumple parcialmente
con cada persona que se va sabiendo algo que no sabía, aunque no deje su correo.

---

## Nuestra visión

**Ser el lugar donde la salud mental deja de sentirse como un trámite.**

Que una persona pueda ver su propia evolución clínica y entenderla. Que un terapeuta pueda
ejercer sin convertirse en vendedor. Que una familia colombiana encuentre valoración
neuropsicológica seria sin peregrinar entre instituciones. Y que todo eso ocurra en un
producto que se siente como un consultorio bien llevado, no como una tienda.

---

## Cómo entendemos la salud mental

- **Es un proceso, no un estado.** Nadie "está curado" ni "está roto". Por eso el producto
  muestra tendencias en el tiempo, no veredictos.
- **Es sensible por definición.** Los datos de salud son categoría especial (Ley 1581 art. 5,
  RGPD art. 9). Cada dato que se guarda debe justificar por qué existe. Cuando en los tests
  públicos hubo que elegir, se guardó **solo el puntaje total y la banda** —nunca las respuestas
  individuales—, porque guardar el detalle habría convertido una tabla de captación en un
  registro de salud que nadie consintió.
- **Se orienta, no se diagnostica desde una pantalla.** Ningún cuestionario público arroja un
  diagnóstico. Un cribado señala qué mirar de cerca; el diagnóstico lo hace un profesional en
  una valoración. Esto se dice explícitamente en cada resultado.
- **La seguridad está por encima de todo lo demás**, incluida la confidencialidad y,
  obviamente, incluido el negocio. Por eso el C-SSRS está **exento del límite freemium**:
  cobrar por una evaluación de riesgo suicida es inaceptable, y por eso mismo el C-SSRS
  **nunca se ofrece en abierto** —evaluar ideación suicida en un flujo anónimo y sin contención
  deja a la persona sola con el resultado—.
- **El malestar se valida, no se dramatiza.** Se dice "estás atravesando", no "estás sufriendo".
  Nunca se amplifica el dolor de alguien, ni para ayudar ni para vender.

---

## Cómo entendemos la relación paciente-plataforma

La plataforma es **un lugar al que se entra, no un producto que se consume**.

- **La persona manda sobre su proceso.** El consentimiento clínico es revocable desde Ajustes
  con la misma facilidad con que se dio; si no lo fuera, no habría sido libre. Revocarlo no
  borra el registro histórico —eso es evidencia ético-legal— pero sí detiene el supuesto de
  que hay proceso vigente, y el terapeuta lo ve como alerta.
- **Nadie consiente por otro.** Ni el admin. Consentir es personal e indelegable, y está
  garantizado en la base de datos, no solo en la interfaz.
- **La plataforma no acumula lo que no necesita.** Sin dirección física publicada, sin datos
  de más, sin PII en URLs, sin correos de terceros expuestos en rutas públicas.
- **Lo que se promete se cumple literalmente.** El badge "Gratis · sin registro · confidencial"
  de los tests no es copy: las respuestas no salen del navegador. Si una promesa de interfaz
  no está respaldada por el backend, la promesa se cambia — no se deja pasar.
- **Nunca se le miente por omisión.** Si algo no existe todavía, se dice ("Audio próximamente",
  campos del perfil marcados como pendientes). No se inventan testimonios, métricas,
  profesionales ni reseñas. Nunca.

---

## Cómo entendemos la relación paciente-terapeuta

- **El terapeuta acompaña; no vende.** Su panel no tiene metas comerciales, no tiene ranking,
  no tiene comisión visible. Ver [Principios innegociables](#principios-innegociables).
- **El terapeuta escribe desde lo clínico, no desde lo técnico.** Cuando redacta contenido, el
  editor le pide tipo, categoría, título, "de qué se trata" y cuerpo. El slug, el SEO y el tier
  los define el admin al publicar, porque son decisiones de distribución, no clínicas. Pedirle
  eso a quien escribe convierte un acto editorial en un formulario.
- **Lo que firma, queda.** Una nota clínica firmada no se edita ni se borra. Esa
  irreversibilidad protege al paciente y también al profesional.
- **El profesional necesita saber en qué terreno pisa.** Por eso ve, de un vistazo en la ficha,
  si el consentimiento clínico está aceptado, pendiente o revocado. Un proceso sin
  consentimiento vigente no debería continuar, y esa información no puede estar escondida.
- **La confianza tiene límites explicados de frente.** El consentimiento nombra los tres casos
  en que la confidencialidad cede —riesgo grave para la vida, requerimiento judicial,
  protección de niñas, niños y adolescentes— antes de que ocurran, no cuando ocurren.

---

## Cómo entendemos los planes

> [!important] Los planes NO son productos
> Un plan es **una etapa de acompañamiento**, no un artículo de catálogo. Nombra dónde está
> la persona en su proceso, no cuánto pagó.

Los nombres lo dicen todo y por eso se eligieron así:

| Etapa | Qué nombra |
| :--- | :--- |
| **Plan Gratuito** *(ver nota)* | Todavía no hay proceso. Hay alguien mirando, entendiendo, decidiendo. |
| **Primeros Pasos** | Empezó. No es una "versión básica" ni un producto recortado: es un inicio. |
| **Mi Equilibrio** | Hay acompañamiento continuo. El nombre describe lo que se busca, no cuántas funciones incluye. |
| **Mi Mundo en Foco** | El acompañamiento alcanza también al entorno, la familia incluida. |

Consecuencias prácticas de entenderlos así:

- **Un plan superior agrega, nunca quita.** Nadie pierde nada al quedarse donde está. La
  diferencia entre etapas es **cuánta biblioteca ves**, no cuántas puertas cerradas
  encuentras.
- **Lo que una etapa no incluye, no se muestra.** No aparece atenuado, ni borroso, ni con
  candado: no aparece. El plan **filtra** el catálogo. Un contenido fuera de tu etapa es un
  "no encontrado", nunca un "compra para ver".
- **La etapa gratuita no es una demo.** Es una etapa legítima con su propio valor: 15 guías,
  10 piezas, tests abiertos, anamnesis completa, evaluaciones. Alguien puede quedarse ahí para
  siempre y la misión se sigue cumpliendo.
- **Nada esencial vive detrás de una etapa.** La seguridad clínica jamás está en un plan.
- **No se habla de comprar, suscribirse ni adquirir.** Se habla de avanzar, empezar y ampliar.

> [!warning] Nombre de la etapa gratuita — decisión abierta (30-jul)
> El código dice **"Plan Gratuito"**; el contexto maestro afirma que se renombró a **"Primer Contacto"**.
> Nunca se aplicó: el análisis de neuromarketing (22-jul) lo marcó como *"opcional, de menor prioridad"*.
> Hasta que se decida, **la fuente de verdad es `src/lib/api/plans.ts`** (hoy: "Plan Gratuito").
> Recomendación argumentada en el informe del sprint de coherencia.


---

## Principios innegociables

Los diez que siguen no son preferencias de estilo. Son la línea que separa este producto de
uno que se vería igual y haría daño.

### 1. Ayudar antes que vender
Todo lo que la plataforma sabe hacer se ofrece primero como ayuda. La conversión es una
consecuencia posible, nunca el propósito de una pantalla.

### 2. La confianza precede a la conversión
Nadie contrata terapia con quien acaba de presionarlo. La secuencia correcta es entender →
confiar → decidir, y ninguna optimización puede saltarse un paso.

### 3. Nunca generar ansiedad para vender terapia
Prohibido en el producto y en el contenido: cuenta regresiva, escasez artificial ("quedan 3
cupos"), promesas absolutas ("cura", "en 30 días"), amplificación del malestar. Vender ansiedad
a alguien que vino por su ansiedad es la contradicción más grande que este producto puede
cometer.

### 4. Nunca mostrar contenido bloqueado
Si no está en tu etapa, no se lista. No hay preview borrosa, no hay "Contenido Premium", no
hay tarjeta atenuada.

### 5. Nunca mostrar candados
Ningún ícono de candado sobre contenido. **Excepción legítima y única:** los candados que no
son comerciales —una nota clínica firmada e inmutable, una guarda de rol sobre la ficha de otra
persona—. Esos protegen; los otros presionan.

### 6. Los planes agregan valor, nunca eliminan experiencias
Ninguna etapa se define por lo que le falta. Si una funcionalidad tiene que retirarse de una
etapa inferior para que la superior parezca mejor, la respuesta es no.

### 7. El paciente siempre debe sentir que está siendo acompañado
Incluso sin sesión iniciada. Incluso sin pagar. Incluso en un callejón sin salida: si un paso
de un programa apunta a algo fuera de su etapa, el paso **se muestra igual** —título y
descripción se sostienen solos— pero sin enlace, porque mandarlo a un "no encontrado" sería
abandonarlo a mitad de camino.

### 8. El terapeuta nunca es tratado como vendedor
Sin cuotas, sin ranking de captación, sin incentivos por upgrade en su panel. Su trabajo es
clínico y su herramienta debe reflejarlo.

### 9. Toda decisión se justifica primero desde el beneficio clínico y después desde el negocio
En ese orden y por escrito. Si el argumento clínico no existe, la decisión no se toma aunque
el argumento comercial sea excelente.

### 10. El mensaje comercial nunca coincide con un momento de riesgo
Cuando hay señal de riesgo, los recursos de crisis van **primero, arriba de todo**, y el bloque
comercial **no se muestra**. Es una regla con implementación real y verificada: en el PHQ-9
público se activa por dos vías independientes —banda severa **o** respuesta positiva en el ítem
de ideación, aunque el puntaje total sea mínimo—. Alguien con 1 punto y un pensamiento de
hacerse daño no ve una oferta; ve el 123.

> [!note] Corolario de los diez
> Estas reglas se implementan en **base de datos**, no en la interfaz. Una regla que solo vive
> en la documentación se rompe sola el día que alguien copie un archivo. Por eso hay triggers
> que impiden publicar un instrumento de riesgo en abierto, fabricar un consentimiento ajeno o
> autopublicar un comentario.

---

## Cómo queremos que se sienta un paciente al navegar

- **Recibido.** Que note que alguien pensó en cómo se siente al llegar, no solo en qué botón
  pulsar.
- **Tranquilo.** Sin urgencia, sin ruido, sin nada parpadeando. El ritmo lo pone él.
- **Capaz.** Que salga sabiendo algo concreto que puede hacer hoy, aunque no haya pagado.
- **Con control.** Que entienda dónde está, qué sigue y cómo salirse si quiere.
- **Digno.** Que nada en la pantalla lo trate como un caso, un lead o una conversión pendiente.
- **Acompañado, incluso solo.** Un domingo a las 3 a.m., sin sesión iniciada, leyendo un
  artículo: incluso ahí debe sentir que hay alguien del otro lado que pensó en ese momento.

---

## Cómo NO queremos que se sienta

- **Presionado.** Ninguna pantalla debe transmitir "decide ya".
- **Excluido.** Ver algo que no puede tener es la sensación exacta que este producto eliminó.
- **Juzgado.** Ni por lo que respondió, ni por lo que no hizo, ni por cuánto tiempo lleva sin
  entrar.
- **Alarmado.** Un resultado severo se comunica con seriedad y calidez, nunca con dramatismo.
- **Convertido en objetivo.** Que nunca perciba que su malestar fue la palanca.
- **Perdido.** Sin callejones sin salida, sin pantallas que terminan en nada.
- **Como un número.** Nada de lenguaje de embudo asomándose a la superficie.

---

## Cómo hablamos

- **De tú a tú, en español neutro colombiano.** Tuteo siempre; nunca voseo.
- **Con autoridad sin jerga.** Todo término técnico se explica la primera vez con una imagen
  simple. Si hace falta un diccionario, está mal escrito.
- **Validando sin dramatizar.** "Estás atravesando", no "estás sufriendo".
- **Con sustento real.** Cada afirmación clínica se apoya en la investigación del proyecto o
  en fuentes verificables, registradas en `clinical_refs`. Nada inventado.
- **Con honestidad sobre los límites.** "Esto es una orientación, no un diagnóstico" aparece
  donde tiene que aparecer, no escondido al final.
- **En segunda persona y en concreto.** "Qué puedes hacer ahora", no "se recomienda".
- **Reconociendo el esfuerzo.** Responder honestamente a una pregunta sobre ideación cuesta;
  se agradece.

---

## Cómo NO hablamos

- **Sin lenguaje de tienda.** Nada de comprar, adquirir, suscribirse, SKU, upgrade, checkout
  visible en la superficie del producto.
- **Sin promesas absolutas.** Nada de curar, garantizar, "en X días".
- **Sin urgencia fabricada.** Ni "última oportunidad", ni "no dejes pasar más tiempo".
- **Sin etiquetar personas.** Se habla de lo que alguien está viviendo, no de lo que "es".
  Nunca "eres depresivo", "eres ansioso".
- **Sin frialdad clínica de cara al paciente.** El rigor va en el registro clínico; la calidez,
  en la pantalla.
- **Sin culpa como motor.** Nada de "si de verdad te importara tu salud mental…".
- **Sin nomenclatura de SaaS para las etapas.** Ni Básico, ni Pro, ni Premium como escalón
  comercial.

---

## Ejemplos prácticos

### Planes y etapas

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Compra Premium | Amplía tu acompañamiento |
| Suscríbete ahora | Empezar con Primeros Pasos |
| Plan Básico / Plan Pro | Primeros Pasos / Mi Equilibrio |
| Elige tu plan | Elige cómo quieres avanzar |
| Desbloquea todo el contenido | En Mi Equilibrio también encuentras… |
| Mejora tu plan | Amplía tu proceso |
| Membresía Mente en Foco+ | Tu proceso, a tu ritmo |

### Contenido y acceso

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| 🔒 Contenido Premium | *(no se muestra: no está en tu etapa)* |
| Actualiza para leer esto | *(la pieza sencillamente no se lista)* |
| Vista previa — adquiere un plan para continuar | *(el contenido se lee completo o no aparece)* |
| Solo para miembros | Lectura libre, sin registro |
| Ver detalle | Leer |

### Resultados y evaluaciones

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Tienes depresión moderada | Tus respuestas apuntan a síntomas en un nivel moderado |
| Diagnóstico: ansiedad severa | Orientación: nivel alto de ansiedad. El diagnóstico lo hace un profesional |
| Tu resultado es preocupante. Habla ya con un especialista → **Ver planes** | No tienes que sostener esto solo(a). Si estás en riesgo, llama al 123 → **Líneas de atención inmediata** |
| Estás en riesgo. Aprovecha 20% en tu primer plan | *(en riesgo no hay mensaje comercial: solo seguridad)* |
| Déjanos tu correo para ver tu resultado | Ya viste tu resultado. Si quieres, te lo enviamos |

### Acompañamiento y tono

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| No dejes que la ansiedad arruine tu vida | La ansiedad tiene tratamiento, y no tienes que esperar a que empeore |
| Llevas 7 días sin entrar. Tu progreso se está perdiendo | *(no existe: no se presiona el retorno)* |
| Eres una persona ansiosa | Estás atravesando un momento de mucha ansiedad |
| Regístrate para continuar | Si quieres seguir tu evolución, puedes crear una cuenta |
| Cuéntanos tu caso y te contactará un asesor | Cuéntanos qué necesitas y coordinamos tu valoración inicial |

### Para el terapeuta

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Pacientes convertidos este mes | Tus pacientes |
| Impulsa a tus pacientes a mejorar de plan | *(no existe: el terapeuta no vende)* |
| Publica y posiciona tu contenido | Comparte lo que trabajas con tus pacientes |

---

## Cómo se usa este documento

**Antes de construir cualquier cosa, responde tres preguntas por escrito:**

1. ¿Cuál es el beneficio **clínico** de este cambio? Si no lo hay, no se construye.
2. ¿Qué principio de la lista podría rozar? Si roza alguno, se detiene y se discute.
3. ¿Cómo se va a sentir la persona más vulnerable que llegue a esta pantalla —la que está en
   un mal momento, sin dinero y sin saber qué le pasa? Si esa persona sale peor, el diseño
   está mal, aunque los números digan lo contrario.

**Si una spec futura contradice este documento, gana este documento.** El roadmap se ajusta a
la filosofía, nunca al revés.

---

## Enlaces

- `Decisiones tecnicas` — dónde vive implementada cada regla de aquí
- `contenido-plataforma/00_guia_estilo_redaccion.md` — cómo se aplica la voz al escribir
- `Marco normativo` — Ley 1581, RGPD, Ley 1090, Resolución 839
- `analisis-estrategico/` — el límite ético que originó el principio 10
- `investigacion-competencia/` — qué hace el mercado y por qué no lo copiamos todo
