---
tags: [mente-en-foco, constitucion, decision, vision-producto]
documento: constitución del producto
estado: vigente
prioridad: máxima autoridad
actualizado: 2026-07-30
---

# Constitución del producto

> **Este documento responde una sola pregunta:**
>
> ## Cuando dos decisiones parecen correctas, ¿cómo sabemos cuál elegir?

---

No repite la filosofía ni los ADR. **Los usa.** La filosofía dice en qué creemos; los ADR, qué se
decidió; el sistema de lenguaje, cómo suena. Esta constitución es el **instrumento** con el que se
resuelve un caso nuevo que ninguno de los tres previó.

Se lee cuando estás atascado entre dos opciones defendibles. Si tu caso es obvio, no la necesitas.

> [!warning] Máxima autoridad
> En un conflicto, el orden es: **esta constitución → filosofía → ADR → sistema de lenguaje → roadmap
> → specs → preferencia de quien construye**. Pero la constitución nunca contradice a la filosofía:
> existe para aplicarla cuando la filosofía no alcanza sola.

---

# 1. Jerarquía de decisión

Siete niveles. **Un nivel superior gana siempre contra cualquier combinación de niveles inferiores.**
No se suman: tres argumentos de conversión no vencen a uno de ética. La jerarquía es lexicográfica,
no ponderada.

```
        ┌─────────────────────────────┐
   1 ▲  │   SEGURIDAD CLÍNICA         │  ¿alguien puede salir dañado?
     │  ├─────────────────────────────┤
   2 │  │   PACIENTE                  │  ¿le sirve a quien vino a estar mejor?
     │  ├─────────────────────────────┤
   3 │  │   ÉTICA                     │  ¿lo haríamos si se viera todo?
     │  ├─────────────────────────────┤
   4 │  │   EXPERIENCIA               │  ¿se entiende y no pesa?
     │  ├─────────────────────────────┤
   5 │  │   CONVERSIÓN                │  ¿sostiene el negocio?
     │  ├─────────────────────────────┤
   6 │  │   FACILIDAD TÉCNICA         │  ¿es mantenible?
     │  ├─────────────────────────────┤
   7 │  │   VELOCIDAD DE DESARROLLO   │  ¿sale rápido?
        └─────────────────────────────┘
```

## Nivel 1 — Seguridad clínica

**Pregunta:** ¿esta decisión puede hacer que alguien salga dañado, o que no encuentre ayuda cuando la
necesita?

Es el único nivel que **detiene** una decisión por completo. Los demás la modifican; este la anula.

Cubre: riesgo suicida, crisis, contención, exactitud de un instrumento, límites de la confidencialidad
explicados a tiempo, acceso a recursos de emergencia.

**Ejemplo real.** El plan gratuito limita las evaluaciones a una cada 30 días — restricción legítima
de producto (nivel 5). Pero entre esas evaluaciones hay un cribado de riesgo suicida. Nivel 1 anula
nivel 5: ese instrumento queda exento del límite. Y el mismo nivel 1 lo excluye de los tests
públicos, porque evaluar ideación sin nadie que contenga es su propio daño.

**Cómo se reconoce que estás en este nivel:** si al describir el peor caso aparece la palabra "riesgo",
"crisis", "urgencia" o "no llegó a tiempo", estás aquí.

## Nivel 2 — El paciente

**Pregunta:** ¿esto le sirve a la persona que vino a estar mejor, o le sirve a nosotros?

Gana contra la ética abstracta cuando entran en tensión, porque el bien concreto de una persona
identificable pesa más que un principio bien formulado. En la práctica casi nunca chocan.

Cubre: utilidad real, autonomía, comprensión, control sobre su proceso, no sentirse perseguido.

**Ejemplo real.** Registrar cada respuesta individual de un test público daría analítica riquísima
(nivel 5) y sería técnicamente trivial (nivel 6). Nivel 2 pregunta: ¿le sirve a quien respondió?
No: le crea un registro de salud que no pidió. Se guarda solo el agregado.

**Ejemplo de tensión interna.** El terapeuta necesita ver si el consentimiento está vigente (le sirve
a él, nivel 2 desde su lado). El paciente necesita poder revocarlo sin fricción (nivel 2 desde el
suyo). No se resuelve eligiendo un lado: se resuelve dando las dos cosas — revocación de un clic y
alerta visible en la ficha.

## Nivel 3 — Ética

**Pregunta:** ¿haríamos esto igual si el paciente viera exactamente cómo está construido?

Es el nivel de la coherencia. Cubre: honestidad, no explotar vulnerabilidad, no fabricar, no
prometer lo que no se puede, no acumular datos sin motivo.

**Ejemplo real.** Un mensaje del tipo "tu resultado sugiere que hablar con un especialista te
ayudaría — ¿quieres ver los planes?" tras un cribado con severidad moderada es comercialmente
excelente (nivel 5) y clínicamente defendible (el consejo es correcto). Nivel 3 lo somete a la prueba
de visibilidad: si esa persona supiera que el mensaje se disparó porque su puntaje la volvió más
convertible, ¿se sentiría acompañada o usada? Por eso el mensaje comercial desaparece cuando hay
riesgo, en lugar de matizarse.

**La prueba del titular.** Si un periodista describiera esta decisión en una nota, ¿cómo sonaría el
titular? Si el titular es malo, la decisión es mala aunque la métrica sea buena.

## Nivel 4 — Experiencia

**Pregunta:** ¿se entiende sin esfuerzo y sin que la persona sienta peso?

Cubre: claridad, ritmo, ausencia de fricción innecesaria, tono, coherencia visual.

**Ejemplo real.** Un paso de programa que apunta a contenido fuera de la etapa del usuario podría
llevarlo a "no encontrado" — técnicamente correcto (nivel 6) y rápido (nivel 7). Nivel 4 lo rechaza:
un callejón sin salida es abandono. El paso se muestra como texto, sin enlace.

**Nivel 4 nunca vence al 3.** Una experiencia más fluida que se consigue ocultando algo que la
persona debería saber es peor experiencia, no mejor.

## Nivel 5 — Conversión

**Pregunta:** ¿esto sostiene el negocio que paga por que exista el producto?

**Este nivel es legítimo.** No es el enemigo. Sin ingresos no hay terapeutas, ni plataforma, ni
nadie a quien acompañar. Que esté en el puesto 5 no significa que se ignore: significa que **cede
ante los cuatro de arriba**, no ante los dos de abajo.

Frente a nivel 6 y 7, la conversión gana: si una función que sostiene el negocio es difícil de
construir, se construye igual.

**Ejemplo real.** Los tests públicos son, explícitamente, la mayor apuesta de captación del producto.
Nivel 5 los justificó. Los niveles 1 a 3 definieron su forma: sin C-SSRS, sin muro de registro, sin
mensaje comercial en riesgo. El resultado convierte menos que la versión agresiva y sigue siendo la
decisión correcta.

## Nivel 6 — Facilidad técnica

**Pregunta:** ¿esto se puede mantener sin que se rompa solo?

Cubre: simplicidad del modelo, una sola fuente de verdad, reglas donde no se puedan saltar.

**Ejemplo real.** Marcar las piezas de blog con una bandera al lado del tipo era más fácil que
añadir un tipo nuevo. Nivel 6 lo rechazó por sí solo: una marca paralela al tipo se desincroniza, y
ya lo había hecho.

**Nivel 6 pierde contra el 4 constantemente.** "Sería más simple pedir todos los datos en una
pantalla" no vence a "así pesa demasiado".

## Nivel 7 — Velocidad de desarrollo

**Pregunta:** ¿cuánto tarda?

El último. Nunca es razón suficiente para nada, pero **sí es un desempate legítimo** cuando dos
opciones empatan en los seis niveles anteriores.

**Ejemplo real.** Hacerlo "rápido" fue exactamente el argumento que habría dejado el paywall en pie:
ya estaba construido y funcionaba. Quitarlo costó rehacer cinco pantallas. Nivel 7 perdió, como debe.

---

## Cómo se usa la jerarquía

1. **Identifica el nivel más alto en el que las dos opciones difieren.** Ahí se decide. Los niveles
   inferiores no votan.
2. **Si empatan en todos hasta el 4**, es una decisión de negocio: decide el responsable del producto,
   no quien construye.
3. **Si una opción es mejor en el nivel 5 y peor en el 3, no hay debate.** Gana el 3.
4. **Si te encuentras sumando argumentos de niveles distintos, te equivocaste de método.** No se suman.

> [!tip] El atajo honesto
> Casi todas las discusiones difíciles son en realidad un conflicto entre el nivel 3 y el nivel 5, y
> se disfrazan de discusión sobre el nivel 4. Cuando alguien argumenta muy elaboradamente sobre
> experiencia de usuario a favor de algo que convierte más, vale la pena preguntar en qué nivel está
> de verdad la discusión.

---

# 2. Árbol de decisión

Ocho preguntas, en orden. **Se responden de arriba abajo y no se salta ninguna.** La primera que
invalide detiene el proceso.

```
                    ┌──────────────────────────┐
                    │  FEATURE PROPUESTA       │
                    └────────────┬─────────────┘
                                 ▼
              ① ¿Protege al paciente o al menos no lo expone?
                     NO ──────────────────────► ✖ RECHAZO DEFINITIVO
                     SÍ
                                 ▼
              ② ¿Genera confianza?
                     NO ──────────────────────► ✖ RECHAZO
                     SÍ
                                 ▼
              ③ ¿Rompe algún ADR?
                     SÍ ──────────────────────► ✖ ALTO — requiere ADR nuevo
                     NO
                                 ▼
              ④ ¿Rompe la filosofía?
                     SÍ ──────────────────────► ✖ ALTO — requiere decisión del responsable
                     NO
                                 ▼
              ⑤ ¿Hace sentir presión?
                     SÍ ──────────────────────► ⟲ REDISEÑAR
                     NO
                                 ▼
              ⑥ ¿Añade complejidad desproporcionada?
                     SÍ ──────────────────────► ⟲ SIMPLIFICAR
                     NO
                                 ▼
              ⑦ ¿Existe una alternativa más simple con el mismo efecto?
                     SÍ ──────────────────────► ⟲ HACER LA OTRA
                     NO
                                 ▼
              ⑧ ¿Se puede implementar después sin costo?
                     SÍ ──────────────────────► ⏸ APLAZAR
                     NO
                                 ▼
                            ✔ CONSTRUIR
```

## ① ¿Protege al paciente, o al menos no lo expone?

**Por qué invalida:** es el nivel 1 de la jerarquía. Una función que expone a alguien no se rediseña:
no se hace. No hay versión mitigada de "esto puede hacer daño".

**Cómo se responde de verdad:** describe el peor caso concreto, con una persona específica. No "podría
haber un problema de privacidad", sino "alguien con la anon key lee el correo de todos los que
hicieron el test". Si no puedes describir el peor caso, no has pensado la feature.

**Si la respuesta es "no lo sé":** cuenta como NO hasta que lo sepas.

## ② ¿Genera confianza?

**Por qué invalida:** una función que funciona pero deja a la persona con la sensación de que la
están midiendo destruye más de lo que aporta. La confianza es el activo que hace que alguien cuente
algo verdadero en una anamnesis — sin ella, el producto clínico no tiene materia prima.

**Cómo se responde:** ¿esto se lo explicarías tal cual a la persona? Si la explicación honesta suena
mal ("guardamos tus respuestas para saber a quién ofrecerle un plan"), la feature está mal.

## ③ ¿Rompe algún ADR?

**Por qué detiene:** los ADR son decisiones irreversibles. Romper uno no es una opción de diseño: es
un cambio constitucional.

**Qué hacer si sí:** se detiene, se nombra el ADR y se explica qué cambió en la realidad para
justificar derogarlo. Si no cambió nada en la realidad y solo cambió la conveniencia, la respuesta es
no. Un ADR se deroga con otro ADR, nunca con una tarea.

**Trampa frecuente:** "esto no rompe el ADR, es un caso distinto". Casi nunca lo es. Si tienes que
argumentar por qué tu caso es la excepción, probablemente estás rompiendo el ADR.

## ④ ¿Rompe la filosofía?

**Por qué detiene:** la filosofía cubre lo que los ADR no previeron. Una feature puede no violar
ningún ADR literal y aun así hacer que la plataforma se sienta como una máquina de cobrar.

**Cómo se responde:** relee los 10 principios innegociables pensando en la feature concreta. Si
alguno "casi" se rompe, se rompe.

## ⑤ ¿Hace sentir presión?

**Por qué obliga a rediseñar (no a rechazar):** la presión casi siempre está en la forma, no en el
fondo. Una función útil presentada con urgencia se arregla quitando la urgencia. Por eso aquí el
resultado es ⟲, no ✖.

**Señales de presión:** contador, insistencia, repetición, condicionar acceso, interrumpir una
lectura, aparecer sin que nadie lo pidiera, hacer sentir que se pierde algo.

## ⑥ ¿Añade complejidad desproporcionada?

**Por qué obliga a simplificar:** cada estado nuevo es un estado que alguien tendrá que entender
dentro de dos años. La complejidad no se paga al construir: se paga al mantener y al explicar.

**Medida práctica:** si para describir cómo funciona necesitas más de tres frases, o si introduce un
concepto nuevo que el usuario tiene que aprender, es desproporcionada — salvo que el valor sea
igualmente grande.

## ⑦ ¿Existe una alternativa más simple con el mismo efecto?

**Por qué obliga a cambiar:** la primera solución que se le ocurre a alguien casi nunca es la más
simple, y la más simple casi siempre envejece mejor.

**Cómo se responde:** enuncia el problema sin mencionar la solución propuesta. "Los pacientes no
saben qué contenido hay en otras etapas" admite muchas respuestas; "hay que poner un candado con
preview" ya es una solución disfrazada de problema.

## ⑧ ¿Se puede implementar después sin costo?

**Por qué aplaza:** lo que se puede hacer después casi siempre se hace mejor después, con más
información y sin bloquear lo que sí urge. Aplazar no es rechazar.

**Cuándo NO se aplaza:** cuando el costo de añadirlo luego es una migración de datos, un cambio de
esquema sobre datos ya sembrados, o un texto que la gente ya leyó y aceptó. Ahí conviene hacerlo bien
la primera vez.

> [!important] Regla del árbol
> **Cualquier respuesta que invalide debe explicarse por escrito**, nombrando la pregunta y la razón.
> Un rechazo sin explicación es indistinguible de una omisión, y en tres años nadie sabrá si la
> feature se descartó o se olvidó.

---

# 3. Las preguntas obligatorias

El árbol filtra. Estas ocho **construyen**: obligan a entender la feature antes de escribir la
primera línea. Se responden **por escrito** y viven con la spec.

### ¿Por qué existe?

Una frase, sin justificar. Si necesitas un párrafo, todavía no sabes por qué existe.
*Mal:* "para mejorar el engagement". *Bien:* "para que alguien sepa si lo que siente merece consulta".

### ¿Qué problema real resuelve?

De alguien concreto, no del negocio. Un problema del negocio ("captamos pocos leads") es una
motivación, no un problema del usuario. Traducirlo obliga a encontrar el problema real detrás
("la gente no sabe si lo que le pasa amerita terapia") — y esa traducción suele cambiar la solución.

### ¿Qué sentiría el paciente?

En el momento exacto de encontrarse la feature, no en abstracto. Y en su **peor día**, no en uno
bueno. Una función que solo funciona con alguien de buen ánimo está mal diseñada para este producto.

### ¿Qué sentiría el terapeuta?

¿Le da trabajo o se lo quita? ¿Le pide algo que no es clínico? ¿Lo convierte en vendedor, en
administrativo o en moderador sin haberlo acordado? Una feature que le suma carga sin sumarle
capacidad clínica es una feature para nosotros, no para él.

### ¿Qué sentiría un administrador?

¿Puede operarla sin adivinar? ¿Le crea una cola que alguien tiene que atender todos los días? **Toda
moderación es una promesa operativa**: si nadie la atiende, la feature se vuelve un embudo tapado.
Si no hay quién la sostenga, no está lista.

### ¿Qué ocurre si desaparece?

Si la respuesta es "nada", no debería existir. Si la respuesta es "se rompe otra cosa", documenta esa
dependencia antes de construir.

### ¿Qué ocurre si falla?

No si da error: **si falla en silencio**. ¿Alguien se queda esperando algo que no va a llegar? ¿Un
profesional cree que tiene un respaldo que no tiene? En un producto clínico, el fallo silencioso es
peor que el ruidoso — y la respuesta correcta suele ser diseñar el fallo, no solo el éxito.

### ¿Qué pasa si nadie la usa?

¿Queda un botón huérfano ocupando espacio y confundiendo? ¿Una tabla vacía que alguien interpretará
mal? Diseña también el caso de adopción cero, que es el más probable.

---

# 4. Las tentaciones más peligrosas

Todo lo que sigue **parece bueno**. Casi todo es una buena práctica en otro tipo de producto. Ese es
exactamente el peligro: no llegan disfrazadas de mala idea, llegan disfrazadas de mejora obvia.

> **Patrón común de todas:** optimizan una métrica que sube, a costa de algo que no se mide.

---

### 1. Poner más CTAs

**Por qué parece buena:** más caminos a la acción, más conversión. Es cierto y está medido.

**Por qué destruye:** un CTA es una petición. Multiplicar peticiones convierte el acompañamiento en
insistencia. Y hay un efecto que nadie mide: cuando todo es un llamado a la acción, **nada se lee**.
Una persona que llegó a entender qué le pasa se encuentra con que cada bloque le pide algo.

**En su lugar:** un CTA primario por pantalla, después del valor entregado.

---

### 2. Meter urgencia

**Por qué parece buena:** la escasez y el tiempo límite funcionan. Están entre las palancas mejor
documentadas del comercio.

**Por qué destruye:** esta plataforma existe para bajar la ansiedad de la gente. Generar ansiedad para
vender el tratamiento de la ansiedad no es una contradicción de marca: es un daño real a una persona
que ya está mal. Además, la urgencia siempre es falsa aquí — no hay cupos que se acaben.

**En su lugar:** nada. La urgencia no tiene versión aceptable en este producto.

---

### 3. Mostrar contenido bloqueado

**Por qué parece buena:** es el patrón dominante del mercado. Enseñar lo que falta motiva a pagar, y
la persona "descubre" el catálogo completo.

**Por qué destruye:** convierte cada pantalla en un recordatorio de que no tienes suficiente. Alguien
que llegó buscando ayuda ve, primero, aquello a lo que no llega. Es el patrón que este producto
eliminó a conciencia, aceptando el costo de conversión.

**En su lugar:** el plan filtra; la comparativa de etapas informa cuando la persona la busca.

---

### 4. Crear popups

**Por qué parece buena:** captan atención garantizada. Convierten. Se miden fácil.

**Por qué destruye:** un popup es una interrupción no solicitada. Interrumpir a alguien que está
leyendo sobre su propio malestar para ofrecerle algo es exactamente el gesto que separa un espacio de
salud de una tienda. Y el peor caso es catastrófico: un modal comercial sobre un resultado de riesgo.

**En su lugar:** contenido en el flujo, después del valor, que la persona puede ignorar sin cerrar
nada.

---

### 5. Obligar registro

**Por qué parece buena:** la base de usuarios es el activo. Un muro convierte visitantes en leads con
una sola línea de código.

**Por qué destruye:** invierte el orden entre confianza y conversión. Alguien a las 3 a.m. buscando
si lo que siente es normal, y que se topa con un formulario, se va — y esa persona es exactamente a
quien el producto existe para ayudar. El registro obligatorio cobra por adelantado una confianza que
todavía no se ganó.

**En su lugar:** valor completo primero, invitación opcional después.

---

### 6. Obligar correo

**Por qué parece buena:** es "solo un campo". Casi nadie lo objeta. Y es el canal de retención más
barato.

**Por qué destruye:** es la misma inversión de orden que el registro, en versión suave. Condicionar
el resultado de un cribado a dejar un correo convierte información sobre la salud de alguien en
moneda de cambio.

**En su lugar:** el resultado se ve entero; el correo se ofrece después como utilidad ("si quieres,
te lo enviamos").

---

### 7. Pedir datos innecesarios

**Por qué parece buena:** los datos "por si acaso" son gratis de pedir y caros de conseguir después.
Segmentan mejor, personalizan mejor.

**Por qué destruye:** cada dato de salud almacenado es una responsabilidad legal y ética permanente
(categoría especial). "Por si acaso" no es una finalidad válida. Y cada campo extra en un formulario
es una razón más para abandonarlo justo cuando alguien iba a pedir ayuda.

**En su lugar:** cada campo justifica por qué existe, o no existe. Si el dato hace falta después, se
pide después.

---

### 8. Más métricas

**Por qué parece buena:** lo que no se mide no se mejora. Es cierto.

**Por qué destruye:** las métricas se convierten en objetivos, y los objetivos deforman el producto
hacia lo que es fácil de medir. Conversión, tiempo en página y tasa de apertura son medibles;
"alguien entendió lo que le pasaba y durmió mejor" no lo es. Un tablero lleno de las primeras empuja
inevitablemente a optimizar contra las segundas.

**En su lugar:** pocas métricas, y siempre con la pregunta "¿qué comportamiento induce mirar esto
todos los días?".

---

### 9. Más dashboards

**Por qué parece buena:** dar visibilidad es dar control. Un panel se ve profesional.

**Por qué destruye:** cada panel es una superficie que hay que mantener, entender y llenar de datos
reales. Un dashboard con datos inventados o con métricas vacías es peor que no tenerlo. Y para el
terapeuta, un panel de gestión lo empuja hacia el rol de administrador de su propia cartera.

**En su lugar:** la información donde se necesita, en el momento en que se necesita.

---

### 10. Más badges

**Por qué parece buena:** orientan, jerarquizan, dan feedback visual inmediato.

**Por qué destruye:** un badge es una etiqueta, y las etiquetas sobre personas son peligrosas aquí.
"Paciente en riesgo", "Alta prioridad", "Inactivo" — todos convierten a alguien en un estado. Además
son el vehículo natural del candado: un badge de plan es un candado con mejor diseño.

**En su lugar:** badges sobre objetos (estado de un documento, de un comentario), nunca sobre personas
en la superficie del paciente.

---

### 11. Más notificaciones

**Por qué parece buena:** la retención vive de traer gente de vuelta, y las notificaciones son la
herramienta más directa.

**Por qué destruye:** la mayoría de notificaciones de retención son variaciones de "vuelve" y, en
salud mental, "vuelve" se lee como reproche. Alguien que dejó de entrar puede estar peor, no
desinteresado — y recibir un recordatorio en ese estado es recibir una culpa.

**En su lugar:** notificaciones que informan de algo que ya pasó y le concierne (una sesión, un
mensaje de su profesional). Nunca notificaciones que piden volver.

---

### 12. Más gamificación

**Por qué parece buena:** rachas, logros y progreso visible son los mecanismos de hábito mejor
probados que existen.

**Por qué destruye:** la gamificación funciona creando culpa por romper la racha. Aplicada al ánimo
de alguien, castiga precisamente los días malos — los días en que más falta hace el producto. Y
convierte un proceso terapéutico en un puntaje, que es lo contrario de cómo funciona la mejoría
clínica: no es lineal y no se acumula.

**En su lugar:** progreso clínico real y visible (la tendencia de las escalas en el tiempo), que
informa sin premiar ni castigar.

---

### 13. Más IA

**Por qué parece buena:** es el sitio evidente donde meterla. Chat de apoyo, resúmenes automáticos,
triaje, recomendaciones. Todo el mercado lo está haciendo.

**Por qué destruye:** un modelo que conversa con alguien sobre su salud mental puede fallar de
formas que nadie ve hasta que es tarde — un consejo plausible pero dañino, una señal de riesgo no
detectada, una alucinación con formato clínico. Y hay un problema anterior: **nada clínico se
inventa**, y un modelo generativo inventa por diseño.

**En su lugar:** IA en tareas donde el error es visible y reversible (buscar en un catálogo, ordenar,
sugerir a un profesional que revisa). Nunca IA que hable directamente con un paciente sobre su
estado, ni que produzca contenido clínico que se publique sin revisión humana.

---

### 14. Más automatización

**Por qué parece buena:** menos trabajo manual, menos error humano, más escala. Es casi siempre
correcto en software.

**Por qué destruye:** automatizar un juicio clínico es reemplazar a quien responde por él. La
moderación de comentarios es el caso claro: un filtro automático es más barato, pero alguien tiene
que leer el aporte de un paciente antes de que otro paciente lo lea. Automatizarlo elimina el único
punto donde una señal de riesgo puede detectarse.

**En su lugar:** automatizar el trabajo mecánico alrededor de la decisión (traer, ordenar, avisar),
nunca la decisión clínica misma.

---

### 15. Tentaciones adicionales que ya aparecieron en este proyecto

| Tentación | Por qué parece buena | Por qué destruye |
| :--- | :--- | :--- |
| **Rellenar campos vacíos con ejemplos** | Un perfil vacío se ve mal | Un dato inventado es indistinguible de uno real para quien lo lee |
| **Copiar los ítems de una escala en vez de importarlos** | Es más rápido y no tiene dependencias | Crea dos versiones del mismo instrumento que divergen sin que nadie se entere |
| **Una marca al lado del tipo, en vez de un tipo nuevo** | Evita una migración | Las marcas paralelas se desincronizan; así se cuela una pieza en dos secciones |
| **Poner la regla en la interfaz porque es más rápido** | Funciona y se ve igual | Se salta llamando a la API; y hay app móvil, scripts y agentes escribiendo código |
| **Confiar en que "seguridad al final" cubre todo** | Es la decisión acordada del proyecto | No cubre lo que expone datos de terceros hoy en una ruta sin login |
| **Dejar un enlace a contenido fuera de la etapa** | Es lo que ya estaba construido | Manda a la persona a un "no encontrado" a mitad de un programa |

---

# 5. Las reglas para futuras IA

> Escrito para un modelo que entra al proyecto sin haber estado antes, posiblemente años después,
> posiblemente más capaz que los que lo construyeron.

## Lo primero que debes hacer

1. **Lee, en este orden y completos:**
   `00_FILOSOFIA_MENTE_EN_FOCO.md` → `03_DECISIONES_ARQUITECTONICAS.md` → este documento →
   `04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md` si vas a escribir texto de interfaz.
2. **Después** lee el contexto maestro y el estado actual para saber qué existe.
3. **Al final** el roadmap, para saber qué sigue.

Ese orden importa: si empiezas por el roadmap, construirás lo que dice sin saber por qué el producto
es como es.

## Lo que nunca debes asumir

- **Que el patrón habitual del mercado es correcto aquí.** Casi todo lo que tu entrenamiento sugiere
  como buena práctica de producto —muros, candados, urgencia, gamificación, popups— está prohibido en
  este proyecto. No porque sea malo en general, sino porque este producto decidió otra cosa a
  sabiendas.
- **Que una omisión es un descuido.** Si algo evidente no existe, probablemente se descartó a
  propósito. Búscalo en los ADR antes de "arreglarlo".
- **Que puedes completar lo que falta.** Un ítem de escala, una cifra, un criterio, un testimonio: si
  no está verificado, no se escribe. Tu capacidad de producir texto plausible es, aquí, un riesgo.
- **Que tienes contexto suficiente porque leíste el código.** El código dice qué hace; no dice qué se
  descartó y por qué.
- **Que una métrica justifica un cambio.** La jerarquía de decisión pone la conversión en el puesto 5.
- **Que el usuario que te da una instrucción conoce los ADR.** Muchas veces no. Tu trabajo incluye
  señalarlo.

## Lo que nunca debes romper

1. Ninguno de los 13 ADR, sin un ADR nuevo que lo derogue.
2. Ninguno de los 10 principios innegociables.
3. La jerarquía de decisión de §1.
4. El orden del árbol de §2.

## Cómo debes actuar ante una contradicción

**No la arregles en silencio.** Una contradicción es información: alguien decidió dos cosas
incompatibles, y entender cuál es la vigente requiere contexto que tú no tienes.

El procedimiento:

1. **Detente antes de escribir código.**
2. **Nombra las dos fuentes** y cita el texto exacto de cada una.
3. **Di cuál parece vigente y por qué** (fecha, jerarquía del documento, evidencia en el código o en
   la base de datos).
4. **Pregunta.** No elijas por conveniencia ni por la que te facilita la tarea.
5. **Si tienes que avanzar sin respuesta,** aplica la de mayor jerarquía documental, dilo
   explícitamente, y deja registrado que fue una suposición.

**Jerarquía documental para desempatar:**
constitución → filosofía → ADR → sistema de lenguaje → contexto maestro → vault → roadmap → specs →
comentarios en el código.

## Cómo debes reportar

- **Fielmente.** Si algo falló, dilo con la salida real. Si omitiste una parte, dilo. Si no lo
  verificaste, no digas que funciona.
- **Señala lo que encontraste de paso**, aunque no fuera el encargo. Varias reglas de este proyecto
  nacieron de huecos detectados mientras se hacía otra cosa.
- **Sin adornos.** Un reporte que suena mejor de lo que es hace más daño que un error.

## Cómo debes decir que no

Ver §7. Es parte de tu trabajo, no una falla de obediencia.

---

# 6. Casos reales del proyecto

Siete decisiones que ya se tomaron, con la opción que **casi** se elige.

---

## Caso 1 — Contenido sin candados

| | |
| :--- | :--- |
| **Decisión incorrecta** | Listar todo el catálogo y marcar con candado lo que la etapa no incluye, con preview borrosa y modal de "Contenido Premium". |
| **Por qué parece buena** | Es el patrón dominante del mercado. Convierte: la persona ve lo que se pierde. Estaba construido y funcionaba. El usuario "descubre" todo el catálogo. |
| **Por qué rompe el producto** | Convierte cada pantalla en un recordatorio de insuficiencia. Alguien que llegó mal ve primero aquello a lo que no llega. Nivel 4 (experiencia) y nivel 3 (ética) contra nivel 5 (conversión): la plataforma se sentía como una máquina de cobrar. |
| **Decisión correcta** | El plan **filtra**: lo que no incluye no se muestra. Un slug fuera de etapa es "no encontrado", nunca un paywall. Se eliminó el modal y los badges. **Costo aceptado:** se perdió una palanca de conversión conocida. |

---

## Caso 2 — Consentimiento clínico

| | |
| :--- | :--- |
| **Decisión incorrecta** | Detectar a quién pedírselo usando el estado del onboarding, que ya identificaba exactamente a la misma población. |
| **Por qué parece buena** | Es el campo que ya existe, ya está en el perfil, ya distingue a los pacientes en proceso de las cuentas de captación. Cero consultas extra, cero esquema nuevo. Nivel 6 y 7 a favor. |
| **Por qué rompe el producto** | Ese campo pasa a "completado" al terminar la anamnesis y no vuelve atrás. Un paciente que revocara su consentimiento —o al que le subiera la versión del texto— dejaría de tener el consentimiento exigido **justo cuando más hace falta**. Nivel 1: el terapeuta creería tener respaldo sin tenerlo. |
| **Decisión correcta** | Detectar la población por la señal que define el proceso: plan de pago o terapeuta asignado. Cuesta una consulta más y es correcto siempre. |

**Segunda decisión del mismo caso.** Se descubrió, probando la API real, que cualquiera podía crear un
consentimiento a nombre de otra persona. La tentación era diferirlo a la fase de seguridad, como el
resto. Nivel 1 lo impidió: esa tabla **es** la prueba de que hubo consentimiento, y un registro
falsificable no prueba nada. Se cerró en el momento, sin activar la capa que está deliberadamente
apagada.

---

## Caso 3 — Tests públicos

| | |
| :--- | :--- |
| **Decisión incorrecta** | Tras un resultado severo, mostrar "tu resultado sugiere que hablar con un especialista te ayudaría — ¿quieres ver los planes?". |
| **Por qué parece buena** | Es el momento de máxima conciencia de necesidad, y por tanto de máxima conversión. **El consejo además es clínicamente correcto:** esa persona sí debería consultar. Convierte y ayuda a la vez. |
| **Por qué rompe el producto** | El criterio para mostrarlo sería el puntaje, es decir, la vulnerabilidad. La prueba del titular lo revela: "plataforma de salud mental muestra ofertas a quien puntúa peor". Nivel 3 contra nivel 5. |
| **Decisión correcta** | Cuando hay señal de riesgo, los recursos de crisis van arriba y **el bloque comercial desaparece**. Y la señal no se determina solo por el puntaje: una respuesta positiva sobre ideación lo activa aunque el total sea mínimo — verificado con un caso de 1 punto sobre 27. |

**Decisión hermana:** no ofrecer el cribado de riesgo suicida en abierto, pese a ser el de mayor
demanda. Evaluar ideación sin nadie que contenga deja a la persona sola con el resultado.

---

## Caso 4 — Blog

| | |
| :--- | :--- |
| **Decisión incorrecta** | Que `/blog` fuera un espejo: listar ahí los artículos gratuitos de la biblioteca, marcados con una bandera. |
| **Por qué parece buena** | Llena el blog sin escribir nada nuevo. Reutiliza contenido ya producido. SEO inmediato. Nivel 7 completo. |
| **Por qué rompe el producto** | La misma pieza aparecía en dos secciones y el usuario no entendía la diferencia. Y la bandera al lado del tipo se desincroniza: es el mecanismo exacto por el que algo vuelve a colarse en dos sitios. |
| **Decisión correcta** | El blog es un tipo propio. La sección la decide el tipo y nada más. Las tres secciones se diferencian por **propósito y voz** — guiar, explicar, conversar — no por exclusividad de tema. |

**Segunda decisión.** Los comentarios podrían publicarse directo y moderarse después, como casi todo
internet. Nivel 1 lo impidió: un consejo bienintencionado puede hacer daño, traer datos personales o
contener una señal de riesgo. Alguien lo lee antes que el resto — con el costo operativo que eso
implica.

---

## Caso 5 — Planes

| | |
| :--- | :--- |
| **Decisión incorrecta** | Mantener Esencial / Integral / Premium, la nomenclatura estándar. |
| **Por qué parece buena** | Es la convención que todo el mundo entiende sin explicación. Los referentes globales de bienestar la usan. Cero riesgo. |
| **Por qué rompe el producto** | Nombra un producto, no una etapa. "Básico" comunica que te falta algo; "Premium", que lo demás es de segunda. En un proceso terapéutico, decirle a alguien que está en la versión básica de su acompañamiento es exactamente el mensaje equivocado. |
| **Decisión correcta** | Primeros Pasos · Mi Equilibrio · Mi Mundo en Foco. Nombran dónde está la persona, no cuánto pagó. Cambio solo de presentación: los identificadores técnicos no se tocaron. |

---

## Caso 6 — Dashboard

| | |
| :--- | :--- |
| **Decisión incorrecta** | Llenar la sección de actividad reciente con las tareas y escalas del paciente, aunque esos datos no estuvieran cargados en esa vista. |
| **Por qué parece buena** | Un panel con secciones vacías se ve incompleto y poco profesional. Los datos existen en la base; es cuestión de traerlos o, mientras tanto, mostrar algo representativo. |
| **Por qué rompe el producto** | Un dato mostrado es un dato afirmado. En una superficie clínica, algo aproximado es indistinguible de algo real para quien lo lee y toma decisiones con ello. |
| **Decisión correcta** | Mostrar solo lo que está realmente cargado y omitir el resto, aunque la sección quede más corta. Lo mismo aplica al panel del terapeuta: sin métricas de gestión, sin ranking, sin metas. |

---

## Caso 7 — Perfil profesional

| | |
| :--- | :--- |
| **Decisión incorrecta** | Rellenar los campos del perfil del terapeuta (especialidades, enfoques, formación, idiomas) con valores plausibles de ejemplo. |
| **Por qué parece buena** | El perfil vacío se ve abandonado. Los valores de ejemplo muestran la forma final, ayudan a validar el diseño y se reemplazan luego. Es práctica común en cualquier maqueta. |
| **Por qué rompe el producto** | Esos campos van a alimentar la recomendación de terapeutas a pacientes. Un enfoque terapéutico inventado, aunque sea "de ejemplo", es una credencial falsa en un producto de salud. Y el que reemplaza los datos luego puede no saber cuáles eran de ejemplo. |
| **Decisión correcta** | Los campos se muestran vacíos y marcados como pendientes. La estructura se valida igual, y nadie confunde un ejemplo con una credencial. |

---

# 7. Cómo decir NO

Una IA tiende a construir todo lo que se le pide. Es su modo por defecto y casi siempre es correcto.
**Aquí no lo es.** Buena parte del valor de este producto está en lo que se decidió no hacer.

## Cuándo se dice que no

| Situación | Qué se dice |
| :--- | :--- |
| Rompe un ADR | "Esto rompe ADR-00X. Derogarlo requiere un ADR nuevo. ¿Qué cambió en la realidad?" |
| Rompe un principio innegociable | "Esto contradice el principio N. Necesito confirmación explícita del responsable del producto." |
| Expone a alguien | "No lo voy a construir así: expone [datos de terceros / a la persona a un riesgo]. Alternativa: …" |
| Requiere inventar algo clínico | "No tengo fuente verificada para esos ítems. Puedo construir la estructura y dejarlos pendientes." |
| Promete lo que el backend no sostiene | "Puedo construir la interfaz, pero prometería algo que no existe. Primero la migración." |
| Hay una alternativa más simple | "Antes de esto: [alternativa] logra lo mismo con menos. ¿Seguimos con esa?" |
| Se puede hacer después | "Esto se puede añadir luego sin costo. Propongo aplazarlo y cerrar primero [lo bloqueante]." |
| No hay quien lo opere | "Esto crea una cola que alguien tiene que atender a diario. ¿Quién la sostiene?" |

## Cómo se dice

**Una frase, sin sermón.** Nombra la regla, explica en una línea, ofrece la alternativa más cercana,
y sigue. Nadie necesita un párrafo sobre ética para entender un no.

**Se dice antes, no después.** Un no al terminar de construir es peor que un no al empezar: ya se
gastó el trabajo y la conversación llega cargada.

**Se ofrece siempre algo.** "No, pero esto sí" mantiene la conversación en el problema. "No" a secas
la traslada a la obediencia.

**Se acepta la decisión del responsable.** Si señalas el conflicto y el responsable del producto
confirma que quiere avanzar igual, **eso es una decisión legítima que él puede tomar y tú no**.
Se construye, dejando registrado el conflicto. Insistir después de una respuesta clara no es
integridad: es no escuchar.

## Ejemplos

> **Petición:** "Pon un banner en el resultado del test para que se registren."
> **Respuesta:** "El resultado ya se ve completo sin registro (ADR-005) y el banner lo convertiría en
> un peaje. Alternativa: la invitación opcional que va debajo del resultado, sin condicionar nada.
> ¿La refuerzo visualmente en lugar del banner?"

> **Petición:** "Agrega un test de trauma infantil, hay mucha demanda."
> **Respuesta:** "No tengo los ítems verificados de ese instrumento y no puedo escribirlos de memoria
> (ADR-007). Puedo dejar la estructura lista y sembrarlo en cuanto tengamos la fuente."

> **Petición:** "Si el paciente lleva dos semanas sin entrar, mándale un recordatorio."
> **Respuesta:** "En salud mental 'vuelve' se lee como reproche, y quien dejó de entrar puede estar
> peor. Alternativa: avisar de lo que le concierne —una sesión próxima, un mensaje de su
> profesional— sin pedirle que vuelva."

> **Petición:** "Muestra en la ficha cuántos pacientes convirtió cada terapeuta."
> **Respuesta:** "Eso lo convierte en vendedor (principio 8, ADR-004). Si el objetivo es medir carga
> asistencial, puedo mostrar sesiones y pacientes activos, que es información clínica."

---

# 8. Manifiesto

<div align="center">

---

## MENTE EN FOCO

### Declaración de principios

---

</div>

Construimos para alguien que no conocemos.

Alguien que va a llegar aquí un martes cualquiera, o un domingo a las tres de la mañana, buscando
saber si lo que siente tiene nombre. No sabremos quién es. No sabremos qué le pasó. Solo sabremos
que abrió esta página en lugar de seguir aguantando en silencio, y que eso ya le costó algo.

Todo lo que hacemos se decide pensando en ese momento.

---

**Creemos que entender es la primera forma de ayuda.**
Por eso lo que explicamos está abierto. No cobramos por dejar que alguien se entienda.

**Creemos que la ayuda no se cobra por adelantado.**
Nadie tiene que dejar su correo para saber cómo está. Nadie tiene que registrarse para leer.
Si el valor es real, se entrega antes de pedir nada.

**Creemos que nadie debería ver lo que no puede tener.**
No hay candados. No hay vistas borrosas. No hay recordatorios de que te falta algo. Quien esté en
cualquier etapa encontrará un lugar completo, no el recorte de otro mejor.

**Creemos que el malestar no es una oportunidad comercial.**
Cuando alguien nos dice que ha pensado en hacerse daño, no le mostramos precios. Le mostramos un
teléfono. Eso no se discute, no se prueba en un experimento y no se mide contra una tasa de
conversión.

**Creemos que un plan no es un producto.**
Es dónde está una persona en su proceso. Nadie compra aquí: alguien empieza, avanza, o decide que
por ahora está bien donde está.

**Creemos que el profesional no es un vendedor.**
No tiene metas, ni ranking, ni comisiones a la vista. Tiene pacientes. Su trabajo es clínico y su
herramienta lo trata como tal.

**Creemos que lo que se firma, queda.**
Una nota clínica no se edita ni se borra. Esa irreversibilidad incomoda, y por eso protege.

**Creemos que no se inventa nada.**
Ni un criterio, ni una escala, ni un testimonio, ni una cifra. Si no lo podemos verificar, no lo
decimos. Un dato inventado en salud es una mentira sobre la vida de alguien.

**Creemos que el consentimiento es de quien lo da.**
Nadie consiente por otro. Se retira con la misma facilidad con que se dio, o no era libre.

**Creemos que las reglas que importan no se escriben en la documentación.**
Se escriben donde no se puedan saltar. Una regla que depende de que alguien la recuerde ya está rota.

---

No estamos construyendo la plataforma que más convierte.

Estamos construyendo la que podríamos mostrarle completa, por dentro, a la persona que la usa —
cada decisión, cada regla, cada razón — sin tener que explicar ninguna.

Ese es el único criterio que no negociamos.

<div align="center">

---

*Si algún día una decisión de este producto no resiste esa prueba,*
*la decisión está mal. No la prueba.*

---

</div>

---

## Enlaces

- `00_FILOSOFIA_MENTE_EN_FOCO.md` — en qué creemos
- `03_DECISIONES_ARQUITECTONICAS.md` — qué se decidió (ADR-001 a ADR-013)
- `04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md` — cómo suena
- `../00_INDICE_MAESTRO.md` — dónde está todo lo demás
