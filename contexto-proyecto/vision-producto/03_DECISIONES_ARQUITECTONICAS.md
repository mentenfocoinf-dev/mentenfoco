---
tags: [mente-en-foco, adr, decisiones, vision-producto]
documento: registro de decisiones arquitectónicas
estado: vigente
actualizado: 2026-07-30
---

# Decisiones arquitectónicas — Mente en Foco

> [!warning] Registro de decisiones irreversibles
> Lo que está aquí **ya se decidió**. No se re-abre por conveniencia, por presión de plazos ni
> porque una métrica sugiera lo contrario. Revertir un ADR exige un documento propio que explique
> qué cambió en la realidad para invalidarlo, aprobado por el responsable del producto.
>
> Este registro es subordinado a `00_FILOSOFIA_MENTE_EN_FOCO.md`: la filosofía dice **en qué
> creemos**; los ADR dicen **qué se decidió como consecuencia**. Si hay conflicto, gana la filosofía.

> [!info] Qué es y qué no es este documento
> Registra **decisiones**, no implementación. No encontrarás aquí nombres de funciones, rutas de
> archivo ni SQL. Para saber *cómo* está construida una decisión, ve a `Decisiones tecnicas` en el
> vault; para saber *por qué existe*, quédate aquí.

## Índice

| Código | Decisión | Fecha | Estado |
| :--- | :--- | :--- | :--- |
| [ADR-001](#adr-001--no-existen-pantallas-de-bloqueo) | No existen pantallas de bloqueo | 28-jul-2026 | Vigente |
| [ADR-002](#adr-002--descubrimiento-progresivo-del-contenido) | Descubrimiento progresivo del contenido | 28-jul-2026 | Vigente |
| [ADR-003](#adr-003--los-planes-representan-etapas-del-acompañamiento) | Los planes representan etapas del acompañamiento | 22-jul-2026 | Vigente |
| [ADR-004](#adr-004--ayudar-antes-que-vender) | Ayudar antes que vender | 21-jul-2026 | Vigente |
| [ADR-005](#adr-005--la-confianza-precede-a-la-conversión) | La confianza precede a la conversión | 30-jul-2026 | Vigente |
| [ADR-006](#adr-006--backend-antes-que-frontend) | Backend antes que frontend | Fundacional | Vigente |
| [ADR-007](#adr-007--no-fabricar-contenido-clínico) | No fabricar contenido clínico | Fundacional | Vigente |
| [ADR-008](#adr-008--el-consentimiento-clínico-es-indelegable-e-inmutable) | El consentimiento clínico es indelegable e inmutable | 30-jul-2026 | Vigente |
| [ADR-009](#adr-009--blog-contenido-y-guías-cumplen-propósitos-diferentes) | Blog, Contenido y Guías cumplen propósitos diferentes | 29-jul-2026 | Vigente (revisó una regla previa) |
| [ADR-010](#adr-010--toda-ia-que-trabaje-el-proyecto-debe-respetar-esta-filosofía) | Toda IA que trabaje el proyecto debe respetar esta filosofía | 30-jul-2026 | Vigente |
| [ADR-011](#adr-011--las-reglas-de-producto-viven-en-la-base-de-datos) | Las reglas de producto viven en la base de datos | 24-jul-2026 | Vigente |
| [ADR-012](#adr-012--la-seguridad-clínica-nunca-está-detrás-de-un-plan) | La seguridad clínica nunca está detrás de un plan | 21-jul-2026 | Vigente |
| [ADR-013](#adr-013--la-seguridad-técnica-se-difiere-salvo-cuando-expone-a-terceros) | La seguridad técnica se difiere, salvo cuando expone a terceros | 30-jul-2026 | Vigente (matiza una regla previa) |

---

## ADR-001 — No existen pantallas de bloqueo

**Fecha:** 28 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

Hasta esa fecha el producto listaba **todo** el catálogo y marcaba con candado lo que el plan del
usuario no incluía: badges de plan, un modal de paywall y una vista de "Contenido Premium" con
preview borrosa. Era el patrón estándar del mercado y funcionaba técnicamente.

El problema no era técnico. Al recorrer el producto como lo haría un paciente, la sensación
dominante no era la de un espacio de salud mental: era la de una tienda. Alguien que llega a una
plataforma de salud mental porque está mal, y lo primero que ve son candados sobre lo que podría
ayudarle, recibe un mensaje muy claro: *aquí lo que importa es que pagues.*

### Decisión

**El plan filtra el catálogo; no pone candados.** El usuario ve completas las piezas que su etapa
incluye. Las que no incluye **no existen para él**: no se listan, no se atenúan, no se difuminan.

Un contenido fuera de la etapa del usuario responde "no encontrado", nunca "adquiere un plan para
ver esto". No hay ningún camino en el producto que termine en una pantalla de bloqueo comercial.

**Excepción explícita y única:** los candados que **no** son comerciales siguen siendo válidos y
necesarios — la inmutabilidad de una nota clínica firmada, la guarda de rol que impide ver la ficha
de otra persona, la cadencia de evaluaciones del plan gratuito. Esos protegen; los comerciales
presionan. La diferencia es el propósito, no el ícono.

### Consecuencias

- **Se perdió una palanca de conversión conocida.** El paywall convierte; se renunció a él a
  sabiendas. Es el costo aceptado de la decisión.
- **La diferenciación entre etapas pasó a ser cuantitativa:** cuánta biblioteca ves, no cuántas
  puertas cerradas encuentras. Eso obligó a que hubiera suficiente material en cada etapa para que
  la diferencia se notara — de ahí la expansión del catálogo.
- **Aparecieron callejones sin salida donde antes había un paywall.** Un enlace interno que apunta
  fuera de la etapa del usuario ya no cae en un muro: cae en un "no encontrado". Hubo que resolverlo
  caso por caso — un paso de programa fuera de alcance se muestra como texto, sin enlace, en vez de
  mandar al vacío.
- **La comparativa de planes sigue siendo legítima.** Informar qué incluye cada etapa no es
  bloquear; ocultar contenido tras un candado, sí.
- **Cualquier feature futura hereda la regla.** Un módulo nuevo con niveles no puede introducir un
  paywall "solo esta vez".

### Módulos afectados

Guías · Contenido · Blog · Inicio · Membresía · Asesoramiento · Portal del paciente · Cualquier
módulo futuro con diferenciación por plan.

---

## ADR-002 — Descubrimiento progresivo del contenido

**Fecha:** 28 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

ADR-001 dice qué **no** se hace. Faltaba definir qué se hace en su lugar, porque "filtrar" mal
entendido puede producir una experiencia peor que el candado: una etapa gratuita vacía, donde la
persona no encuentra nada y se va con la sensación de que el sitio no tenía nada que ofrecerle.

Además había que resolver una tensión real: si nadie ve lo que no tiene, ¿cómo entiende que existe
más?

### Decisión

**Cada etapa es una biblioteca completa en sí misma, no un recorte de la siguiente.** El contenido
se descubre progresivamente: al avanzar de etapa aparece material nuevo, nunca se "desbloquea"
material que ya se estaba viendo a medias.

Reglas que se derivan:

1. **Toda etapa contiene todos los tipos de pieza.** Ninguna etapa se queda sin programas, sin
   herramientas o sin audio. Una etapa a la que le falta un tipo entero se siente incompleta,
   aunque tenga muchas piezas.
2. **La etapa gratuita es una etapa legítima, no una demo.** Tiene valor propio y suficiente para
   que alguien se quede ahí indefinidamente y la misión se siga cumpliendo.
3. **La progresión es acumulativa.** Una etapa superior contiene todo lo de las anteriores más lo
   suyo. Nunca se retira algo de una etapa inferior para que la superior parezca mejor.
4. **Lo que existe se ve entero.** No hay medias piezas, resúmenes recortados ni "primeros tres
   párrafos".

### Consecuencias

- **El catálogo tuvo que crecer antes de poder escalonarse.** No se puede repartir lo que no
  existe: la escalera exigió duplicar el contenido para que cada etapa tuviera masa suficiente.
- **Sembrar una pieza nueva ya no es una decisión libre.** Hay que decidir a qué etapa entra
  cuidando que la distribución por tipo siga equilibrada.
- **El descubrimiento de lo que no se tiene ocurre en un solo lugar:** la comparativa de planes,
  que es informativa y buscada por el usuario — no interrumpe su lectura.
- **La invitación a avanzar es opcional y va después del valor entregado,** nunca antes ni en lugar
  de él.

### Módulos afectados

Contenido · Guías · Siembra editorial · Membresía · Asesoramiento.

---

## ADR-003 — Los planes representan etapas del acompañamiento

**Fecha:** 22 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

Los niveles se llamaban Esencial, Integral y Premium: nomenclatura genérica de SaaS que no dice
nada del proceso terapéutico. La revisión de tono encontró que el problema no eran tácticas
agresivas —no había cuentas regresivas ni escasez artificial— sino **frialdad**: la página se leía
como un catálogo de suscripciones y no como una ruta de acompañamiento.

Se verificó además que los dos referentes globales de bienestar no nombran sus niveles de forma
diferenciada, así que hacerlo es un espacio que la competencia directa no ocupa.

### Decisión

**Un plan no es un producto: es una etapa del acompañamiento.** Nombra dónde está la persona en su
proceso, no cuánto pagó.

| Etapa | Qué nombra |
| :--- | :--- |
| Plan Gratuito *(nombre en revisión)* | Todavía no hay proceso: hay alguien mirando y decidiendo |
| Primeros Pasos | Empezó — un inicio, no una "versión básica" |
| Mi Equilibrio | Acompañamiento continuo; nombra el resultado buscado |
| Mi Mundo en Foco | El acompañamiento alcanza también al entorno y la familia |

De aquí se sigue que **el lenguaje comercial queda prohibido en la superficie del producto**: no se
compra, no se adquiere, no se suscribe uno. Se empieza, se avanza, se amplía.

> *Excepción pendiente:* la etapa gratuita conserva el nombre técnico **"Plan Gratuito"**, que sí usa la
> palabra "plan". El renombrado a "Primer Contacto" se propuso el 22-jul como opcional y nunca se aplicó.
> Decisión abierta; ver el informe del sprint de coherencia del 30-jul.

### Consecuencias

- **Los identificadores técnicos no cambiaron.** El renombrado es de presentación; internamente los
  niveles conservan sus nombres originales. Cero riesgo de migración, y la decisión de negocio
  queda desacoplada del esquema.
- **Cualquier copy que hable de comprar planes está mal por definición,** aunque sea gramaticalmente
  correcto y convierta mejor.
- **Un nivel nuevo tendría que nombrar una etapa real del proceso.** No se pueden agregar niveles
  por segmentación de precio si no corresponden a un momento distinto del acompañamiento.
- **Referirse a un plan por su nombre técnico de cara al usuario es un error,** no una simplificación.

### Módulos afectados

Membresía · Asesoramiento · Portal del paciente (uso del plan, invitaciones) · Todo el copy público ·
Resultados de tests públicos.

---

## ADR-004 — Ayudar antes que vender

**Fecha:** 21 de julio de 2026
**Estado:** Vigente · irreversible · **fundacional**

### Contexto

El análisis competitivo identificó momentos de altísimo valor comercial: cuando alguien alcanza el
límite de evaluaciones, cuando un cuestionario arroja severidad moderada o mayor, cuando termina la
anamnesis. Son los instantes en que una persona está más convencida de que necesita ayuda, y por
tanto los de mayor conversión.

Son también los instantes en que está más vulnerable. Ese es exactamente el punto donde el marketing
de salud mental se vuelve dañino: promesas absolutas, presión por paquetes caros, urgencia fabricada
sobre el malestar de alguien.

### Decisión

**Todo lo que la plataforma sabe hacer se ofrece primero como ayuda.** La conversión es una
consecuencia posible, nunca el propósito de una pantalla.

Tres reglas operativas:

1. **El mensaje comercial nunca coincide con un momento de riesgo.** Cuando hay señal de riesgo, los
   recursos de crisis van primero y arriba, y el bloque comercial **no se muestra en absoluto**. No
   se atenúa ni se mueve abajo: desaparece.
2. **La señal de riesgo no se determina solo por el puntaje.** Una respuesta positiva sobre ideación
   activa el protocolo aunque el total sea mínimo. Si el criterio fuera solo el puntaje, alguien con
   un punto y un pensamiento de hacerse daño vería una oferta.
3. **Prohibidas las tácticas de urgencia:** cuenta regresiva, escasez artificial, promesas absolutas,
   amplificación del malestar. No por conservadurismo, sino porque vender ansiedad a quien vino por
   su ansiedad es la contradicción más grande que este producto puede cometer.

Lo que **sí** se ofrece en un momento de riesgo es utilidad —enviar el resultado, dar un teléfono—
porque eso sirve a la persona. Lo que se calla es la venta.

### Consecuencias

- **Se renuncia deliberadamente a los momentos de mayor conversión del embudo.** Es el costo
  aceptado, y está documentado como tal desde el análisis estratégico original.
- **Todo upsell contextual debe verificar antes si hay señal de riesgo.** No es opcional ni queda a
  criterio de quien construye la pantalla.
- **La ausencia de estas tácticas es comunicable como diferenciador** ("nunca vamos a cobrarte por
  tu seguridad"), pero eso es consecuencia, no motivo.

### Módulos afectados

Tests públicos · Evaluaciones del portal · Alertas de crisis · Contenido editorial · Upsells ·
Correos · Cualquier superficie con mensaje comercial.

---

## ADR-005 — La confianza precede a la conversión

**Fecha:** 30 de julio de 2026 (formalización de una práctica aplicada desde el inicio)
**Estado:** Vigente · irreversible

### Contexto

ADR-004 prohíbe vender en momentos de vulnerabilidad. Faltaba definir el orden positivo: cuándo
**sí** es legítimo invitar, y qué debe haber ocurrido antes.

El mercado enseña lo contrario: pedir el correo antes de mostrar el resultado, exigir registro para
leer, encerrar los tests tras el login. Todas convierten. Todas invierten el orden.

### Decisión

**La secuencia es entender → confiar → decidir, y ninguna optimización puede saltarse un paso.**

En concreto:

1. **El valor se entrega completo antes de pedir nada.** El resultado de un test se muestra entero
   sin registro; el correo se pide después y es opcional, enmarcado como utilidad ("si quieres, te
   lo enviamos") y no como peaje.
2. **El registro es siempre una invitación, jamás un requisito para acceder a lo abierto.**
3. **Lo que promete la interfaz debe estar respaldado por el backend.** Si una pantalla dice
   "confidencial", tiene que serlo de verdad. Cuando una promesa no se puede sostener, se cambia la
   promesa — no se deja pasar.
4. **No se miente por omisión.** Lo que no existe se marca como pendiente. No se inventan
   testimonios, métricas, profesionales ni reseñas. Nunca.
5. **Se guarda lo mínimo.** De un test abierto se conserva el resultado agregado, no las respuestas
   individuales: guardar el detalle convertiría una tabla de captación en un registro de salud que
   nadie consintió.

### Consecuencias

- **La tasa de captura de correos es más baja de lo que sería con un muro.** Aceptado.
- **Cada promesa de la interfaz genera una obligación técnica verificable.** Un badge es un contrato.
- **La analítica de captación se diseña sobre datos agregados,** lo que limita el detalle disponible
  para marketing. Es una restricción buscada.
- **Cualquier "regístrate para continuar" es una violación de este ADR,** por conveniente que sea.

### Módulos afectados

Tests públicos · Blog · Contenido abierto · Registro · Guías gratuitas · Analítica de captación.

---

## ADR-006 — Backend antes que frontend

**Fecha:** Fundacional (vigente desde el inicio del proyecto)
**Estado:** Vigente · irreversible

### Contexto

En un producto clínico, una pantalla que promete algo que el backend no sostiene no es una demo
inofensiva: es una mentira sobre salud. Un botón de "solicitar valoración" sin flujo real detrás
deja a alguien esperando una llamada que nunca llega.

### Decisión

**Ninguna interfaz se construye si la funcionalidad que promete no existe ya, verificada, en la base
de datos.** Ni "para mostrar cómo se vería", ni como maqueta, ni temporalmente.

El orden es: esquema → regla en la base → verificación real contra la base → recién entonces
interfaz.

### Consecuencias

- **Las features tardan más en verse.** Se acepta a cambio de que lo que se ve, funciona.
- **Toda regla de negocio se verifica contra la base antes de considerarse hecha,** no contra la
  interfaz. Una verificación por pantalla no prueba la regla.
- **Un cambio de producto que necesita esquema nuevo empieza por una migración,** aunque el pedido
  original se haya formulado como cambio visual.
- **Cuando la interfaz debe mostrar algo que aún no existe, se dice explícitamente** ("Audio
  próximamente", campos marcados como pendientes) en vez de simularlo.

### Módulos afectados

Todos, sin excepción. Es regla de método, no de área.

---

## ADR-007 — No fabricar contenido clínico

**Fecha:** Fundacional
**Estado:** Vigente · irreversible

### Contexto

Un modelo de lenguaje puede producir un criterio diagnóstico plausible, una escala verosímil o una
cifra de prevalencia convincente. En cualquier otro dominio eso sería un borrador aceptable. En
salud mental es material que alguien puede aplicarse a sí mismo.

Se suma una restricción de derechos: los criterios del DSM-5-TR son propiedad de la APA.

### Decisión

**Nada clínico se inventa.** Códigos, criterios, escalas, ítems, prevalencias y afirmaciones
clínicas provienen exclusivamente de material verificable, y quedan referenciados en la propia
pieza.

Consecuencias directas de la regla:

1. **Un instrumento tiene una sola fuente de verdad en todo el producto.** Si el mismo cuestionario
   aparece en dos lugares, ambos leen de la misma definición. Copiar ítems produce dos versiones
   que divergen sin que nadie se entere.
2. **No se publica un instrumento cuyos ítems no estén verificados.** La expansión del catálogo de
   tests espera a tener las fuentes, en lugar de completar de memoria.
3. **No se reproduce material con copyright.** Se usan nombres de categorías como sinónimos de
   búsqueda, nunca el catálogo ni los criterios.
4. **Tampoco se fabrica lo no clínico que se lee como evidencia:** testimonios, reseñas, métricas de
   pacientes, perfiles de profesionales.

### Consecuencias

- **El catálogo crece más lento** y algunas piezas quedan a la espera de fuente. Aceptado.
- **Una IA que trabaje en el proyecto no puede completar un instrumento incompleto,** ni siquiera si
  "sabe" cómo sigue. Ver ADR-010.
- **Los campos sin dato se muestran vacíos y marcados como pendientes** en vez de rellenarse con
  ejemplos plausibles.

### Módulos afectados

Evaluaciones · Tests públicos · Guías · Contenido · Blog · Catálogo diagnóstico · Perfiles
profesionales · Cualquier cifra pública.

---

## ADR-008 — El consentimiento clínico es indelegable e inmutable

**Fecha:** 30 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

El producto ya tenía el consentimiento de tratamiento de datos, que autoriza usar nombre, correo y
teléfono. Faltaba el consentimiento del **proceso de atención psicológica** —modalidad, límites de
la confidencialidad, manejo de la historia clínica, riesgos— que es obligatorio antes de iniciar
atención y que ninguna aceptación de términos de uso reemplaza.

Al construirlo apareció una pregunta que no era técnica: ¿qué es exactamente este registro? La
respuesta define todo lo demás: **es la prueba de que hubo consentimiento**. Un registro que
cualquiera puede fabricar no prueba nada — y es peor que no tenerlo, porque haría creer al
profesional que tiene respaldo para continuar cuando no lo tiene.

### Decisión

**El consentimiento clínico es un acto personal, indelegable y permanente.**

1. **Son dos consentimientos distintos y ambos obligatorios.** El de datos y el clínico. Ninguno
   reemplaza al otro y no comparten registro, porque si no sería imposible demostrar cuál se aceptó
   y cuándo.
2. **Solo el titular consiente lo suyo.** Ni el administrador puede consentir por otra persona.
   Consentir es indelegable por naturaleza, no por política interna.
3. **Se consiente antes de entregar la historia clínica,** nunca después. El consentimiento precede
   a la anamnesis.
4. **Se pide a quien tiene proceso abierto,** no a quien solo lee contenido. Una cuenta de captación
   no tiene proceso que consentir y no debe quedar atascada.
5. **El registro es histórico e inmodificable.** Cada versión aceptada deja su rastro. Lo único que
   puede cambiar es el estado de revocación.
6. **Revocar es tan fácil como consentir,** desde la propia cuenta. Si retirarlo fuera más difícil
   que darlo, no habría sido libre.
7. **Revocar no borra la evidencia.** El registro de que hubo consentimiento se conserva; lo que
   cambia es que deja de estar vigente, y el profesional lo ve señalado.

### Consecuencias

- **Un proceso sin consentimiento vigente no debería continuar,** y esa información es visible para
  el profesional sin tener que buscarla.
- **Subir la versión del texto vuelve a pedir el consentimiento** a quienes tienen proceso abierto.
  Nadie queda consintiendo un documento que ya no es el vigente.
- **No se puede detectar la población obligada por el estado del onboarding.** Ese estado se
  completa y no vuelve atrás, así que alguien que revoque dejaría de tener el consentimiento
  exigido justo cuando más hace falta.
- **El texto es material legal:** requiere revisión jurídica antes de producción, independientemente
  de que el flujo ya funcione.

### Módulos afectados

Onboarding y gates · Portal del paciente (Ajustes) · Ficha del paciente · Anamnesis · Historia
clínica · Marco legal.

---

## ADR-009 — Blog, Contenido y Guías cumplen propósitos diferentes

**Fecha:** 29 de julio de 2026
**Estado:** Vigente · **revisó una regla anterior del mismo mes**

### Contexto

Al crecer el catálogo, las tres secciones empezaron a solaparse: el blog era un espejo que listaba
artículos de la biblioteca, y guías y contenido tocaban los mismos temas (ansiedad, sueño, duelo,
estrés). El usuario podía encontrar la misma pieza en dos sitios y no entender la diferencia.

La primera respuesta fue una regla de exclusividad temática: *ningún tema se repite entre secciones*.
Al aplicarla se vio que era la regla equivocada. Habría obligado a retirar material útil, y sobre
todo describía mal el problema: la ansiedad **merece** estar en las tres secciones, porque una
persona con ansiedad necesita cosas distintas según el momento — entender qué le pasa, saber qué
hacer ahora, o hablarlo con alguien que pasó por lo mismo.

### Decisión

**Las tres secciones se diferencian por propósito y voz, no por exclusividad de tema.** Un mismo
tema puede vivir en las tres. Lo prohibido es que dos secciones digan lo mismo con la misma voz.

| Sección | Propósito | Voz | Momento del usuario |
| :--- | :--- | :--- | :--- |
| **Guías** | GUIAR — el "cómo" | Práctica, directiva, accionable | Quiere *hacer algo* con lo que le pasa |
| **Contenido** | EXPLICAR — el "porqué" | Divulgativa, con fundamento clínico | Quiere *comprender* qué le pasa |
| **Blog** | CONVERSAR — la comunidad | Cercana, de opinión, abre diálogo | Quiere *no sentirse solo* |

Reglas estructurales que la acompañan:

1. **Una pieza pertenece a una sola sección.** No hay espejos ni piezas duplicadas.
2. **La sección la determina el tipo de la pieza, y nada más.** No existen marcas paralelas que
   puedan desincronizarse: una marca al lado del tipo es exactamente el mecanismo por el que una
   pieza vuelve a colarse en dos secciones.
3. **El blog es público por definición** y es el único espacio conversacional del producto.
4. **Antes de publicar cualquier pieza se responde:** ¿esto GUÍA, EXPLICA o CONVERSA? Esa respuesta
   decide sección y voz.

### Consecuencias

- **No hizo falta migrar ni borrar nada.** Las guías ya usaban formato de fundamento + ejercicio, y
  los contenidos voz de artículo: estaban diferenciados de hecho antes de estarlo por regla.
- **Queda una curaduría incremental pendiente:** revisar que ninguna guía se lea como artículo
  largo, ni ningún contenido como lista de pasos seca. No es bloqueante.
- **El blog, al ser conversacional y público, es la única superficie donde escriben los pacientes,**
  lo que abre un problema propio de moderación que se resuelve en ADR-011.
- **La regla previa de exclusividad temática queda derogada** por este ADR. Cualquier documento que
  todavía la afirme está desactualizado.

### Módulos afectados

Guías · Contenido · Blog · Editor del terapeuta · Flujo editorial · Siembra · Navegación pública.

---

## ADR-010 — Toda IA que trabaje el proyecto debe respetar esta filosofía

**Fecha:** 30 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

El proyecto se desarrolla con agentes de IA en roles distintos: uno investiga y redacta
especificaciones, otro construye y ejecuta contra la base real. Buena parte del producto la escribió
un modelo, no una persona.

Esto crea un riesgo específico. Un modelo optimiza hacia lo que se le pide y hacia patrones
frecuentes de su entrenamiento — y los patrones frecuentes del mercado son exactamente los que este
producto rechaza: el paywall, el muro de registro, el "desbloquea todo", la urgencia comercial. Sin
una instrucción explícita, un agente reintroduce esos patrones **con buena intención**, porque en
casi cualquier otro producto serían la respuesta correcta.

Ya ocurrió: un candado, un espejo entre secciones y un muro de registro entraron y hubo que
retirarlos.

### Decisión

**La filosofía es de lectura obligatoria antes de modificar el producto, para cualquier agente —
humano o IA — con o sin supervisión.** Y obliga aunque el pedido del momento diga lo contrario.

Obligaciones concretas de un agente que trabaje aquí:

1. **Leer `00_FILOSOFIA_MENTE_EN_FOCO.md` y este registro antes de proponer o construir.**
2. **Si una tarea contradice un ADR, se detiene la tarea y se señala el conflicto** — no se ejecuta
   y se menciona después.
3. **Justificar primero desde el beneficio clínico, después desde el negocio.** Si el argumento
   clínico no existe, la decisión no se toma aunque el comercial sea excelente.
4. **No inventar para completar** (ADR-007). Ante un vacío, se señala el vacío.
5. **No dar por construido lo no verificado.** Reportar fielmente: si algo falló, se dice; si se
   omitió, se dice.
6. **Señalar los huecos que se encuentren de paso,** aunque no formen parte del pedido — varias
   reglas de este registro nacieron así.
7. **Preferir la barrera en la base de datos a la barrera en la interfaz** (ADR-011).

### Consecuencias

- **Un agente puede y debe rechazar una instrucción que viole un ADR,** explicando cuál y por qué.
  Esto es cumplimiento, no desobediencia.
- **La filosofía tiene prioridad sobre el roadmap.** El roadmap se ajusta a ella, nunca al revés.
- **Los prompts de trabajo deben referenciar estos documentos,** no repetir sus reglas de memoria:
  una regla copiada en un prompt envejece; una referenciada, no.
- **Este registro es parte del contrato de trabajo del proyecto,** no documentación opcional.

### Módulos afectados

Todos · Metodología de trabajo · Prompts de handoff · Revisión de cambios.

---

## ADR-011 — Las reglas de producto viven en la base de datos

**Fecha:** 24 de julio de 2026 (consolidado el 30 de julio)
**Estado:** Vigente · irreversible

### Contexto

Varias reglas del producto son afirmaciones sobre lo que **no puede pasar**: solo un administrador
publica, nadie autopublica un comentario, ningún instrumento de riesgo sale sin acompañamiento.
Implementadas en la interfaz, todas se saltan llamando directamente a la API — y el producto tiene
una app móvil, scripts de siembra y agentes de IA escribiendo código, o sea múltiples clientes.

Se comprobó además, repetidamente, que una regla que solo vive en la documentación **se rompe sola**
el día que alguien copia un archivo como plantilla.

### Decisión

**Una regla que importa se implementa en la base de datos, no en la interfaz.** La interfaz solo
evita ofrecer acciones que el servidor va a rechazar; no es la barrera.

Corolario sobre moderación: **el blog es la única superficie donde los pacientes se escriben entre
ellos, y ahí la moderación es previa, no posterior.** Un comentario nace pendiente y solo lo aprueba
un moderador. En salud mental un consejo bienintencionado puede hacer daño, traer datos personales
o contener una señal de riesgo: alguien tiene que leerlo antes que el resto.

### Consecuencias

- **Toda regla de negocio se prueba contra la base simulando cada rol,** no navegando la interfaz.
- **Escribir la regla cuesta más y tarda más.** Aceptado: es la única forma de que siga vigente
  cuando cambie el cliente.
- **La documentación describe la regla; la base la impone.** Si divergen, manda la base — y la
  divergencia es un defecto a corregir.
- **Un flujo que dependa de moderación tiene un costo operativo real** (alguien revisa). Se asume.

### Módulos afectados

Flujo editorial · Comentarios del blog · Consentimientos · Tests públicos · Documentos clínicos ·
Cualquier regla de permisos.

---

## ADR-012 — La seguridad clínica nunca está detrás de un plan

**Fecha:** 21 de julio de 2026
**Estado:** Vigente · irreversible

### Contexto

El plan gratuito tiene un límite de evaluaciones: es una restricción legítima de producto. Pero
entre esas evaluaciones hay un instrumento de riesgo suicida. Aplicarle el mismo límite habría
significado que alguien en riesgo se encontrara con "disponible el [fecha]".

### Decisión

**Ninguna funcionalidad de seguridad clínica se restringe por plan, por cuota o por registro.** El
instrumento de riesgo está exento de todo límite comercial.

Su contrapartida es igual de firme: **ese instrumento tampoco se ofrece en abierto.** Evaluar
ideación suicida en un flujo anónimo, sin sesión y sin nadie que pueda contener, deja a la persona
sola frente al resultado. Vive dentro del portal, donde hay un profesional detrás.

Las dos caras son la misma decisión: **el criterio no es comercial, es de contención.** No se cobra
por la seguridad de alguien, y tampoco se le entrega una evaluación de riesgo sin nadie al otro lado.

### Consecuencias

- **Cualquier límite de uso nuevo debe declarar explícitamente sus exenciones de seguridad.**
- **La expansión de tests públicos tiene un techo:** los instrumentos de riesgo no entran, por
  demanda que tengan.
- **Los recursos de crisis son accesibles desde cualquier punto del producto,** con o sin sesión.
- **Esta decisión es comunicable como diferenciador,** pero se tomó por razones clínicas.

### Módulos afectados

Evaluaciones · Límites del plan gratuito · Tests públicos · Alertas de crisis · Líneas de atención.

---

## ADR-013 — La seguridad técnica se difiere, salvo cuando expone a terceros

**Fecha:** 30 de julio de 2026
**Estado:** Vigente · matiza una regla previa

### Contexto

El proyecto tomó una decisión deliberada: agrupar el endurecimiento de seguridad a nivel de fila en
una fase final, en vez de ir activándolo módulo a módulo. Las políticas se escriben junto a cada
migración pero quedan inactivas. Es una decisión de método razonable mientras se construye.

Al probar contra la API real —no contra la interfaz— apareció el problema. Tres huecos no eran
"seguridad pendiente": eran exposición activa de datos de terceros en rutas sin login. Se podía
fabricar un consentimiento clínico a nombre de cualquier persona, escribir comentarios sin sesión, y
leer los correos de todo el que hubiera hecho un test.

Que un hueco esté programado para cerrarse después no impide que esté abierto ahora.

### Decisión

**El diferimiento de seguridad se mantiene, con una excepción que no admite espera: cuando el hueco
expone datos de terceros o permite fabricar evidencia, se cierra en el momento.**

El criterio para distinguir es concreto: ¿esto expone algo de **otra persona**, o permite falsificar
un registro que alguien va a tomar por cierto? Si la respuesta es sí, no espera a la fase final.

Se cierra con los mecanismos disponibles sin romper el diferimiento general —reglas de la base y
permisos de tabla— no activando la capa que está deliberadamente apagada.

### Consecuencias

- **Toda funcionalidad que cuelgue de una ruta pública debe probarse contra la API real,** no solo
  navegando. La interfaz no revela estos huecos.
- **La ausencia de sesión no equivale a contexto de confianza.** En rutas públicas hay que
  distinguir al servidor de un visitante anónimo.
- **La fase de seguridad final sigue pendiente y sigue siendo obligatoria** antes de cualquier
  lanzamiento real. Este ADR no la reemplaza: le quita los casos que no podían esperar.
- **Cada hueco cerrado así queda documentado con lo que se probó,** para que la fase final sepa qué
  ya está cubierto y qué no.

### Módulos afectados

Consentimientos · Comentarios del blog · Tests públicos · Cualquier superficie sin sesión ·
Fase de seguridad final.

---

## Cómo se agrega un ADR

1. **Solo se registra lo irreversible.** Una preferencia de estilo no es un ADR; una decisión que
   condiciona lo que se puede construir después, sí.
2. **Se escribe cuando la decisión se toma,** no cuando se implementa. La implementación se
   documenta en `Decisiones tecnicas`.
3. **El código es correlativo y no se reutiliza,** aunque el ADR quede derogado.
4. **Derogar exige un ADR nuevo** que explique qué cambió en la realidad. El derogado se marca como
   tal y se conserva: saber qué se descartó y por qué evita volver a proponerlo.
5. **Consecuencias honestas, incluidos los costos.** Un ADR que solo lista beneficios está mal
   escrito: toda decisión irreversible renuncia a algo.

## Enlaces

- `00_FILOSOFIA_MENTE_EN_FOCO.md` — en qué creemos (prioridad sobre este documento)
- `Decisiones tecnicas` (vault) — cómo está implementada cada decisión
- `01_ROADMAP_Y_TAREAS.md` — qué sigue, subordinado a estos ADR
- `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md` — estado y metodología del proyecto
- `especificaciones-producto/` — el detalle funcional de cada feature
