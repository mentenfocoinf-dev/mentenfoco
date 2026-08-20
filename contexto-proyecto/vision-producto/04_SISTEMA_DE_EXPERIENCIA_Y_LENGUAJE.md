---
tags: [mente-en-foco, ux, lenguaje, vision-producto]
documento: sistema de experiencia y lenguaje
estado: vigente
actualizado: 2026-07-30
---

# Sistema de experiencia y lenguaje

> [!warning] Guía obligatoria para toda superficie del producto
> Aplica a cualquier texto que lea un ser humano: botones, títulos, errores, correos, estados
> vacíos, tooltips, meta descripciones y mensajes del sistema. Si escribes una cadena que alguien
> va a leer, esta guía te obliga.
>
> Subordinado a `00_FILOSOFIA_MENTE_EN_FOCO.md` y `03_DECISIONES_ARQUITECTONICAS.md`. La filosofía
> dice en qué creemos; los ADR, qué se decidió; este documento, **cómo suena**.

> [!info] Los ejemplos son reales
> Cada cadena marcada como ❌ está —o estuvo— en el producto. No son ejemplos hipotéticos. Al final
> hay un [inventario de deuda](#inventario-de-deuda-de-lenguaje) con lo que hoy incumple esta guía.

---

## Voz

La voz no cambia nunca. Es quién somos en todas las pantallas.

**Somos un profesional que te habla de frente, no una marca que te interpela.**

Cuatro rasgos, en orden de prioridad cuando entran en conflicto:

1. **Clara antes que elegante.** Si hay que elegir entre sonar bien y entenderse, se entiende.
2. **Cálida sin ser blanda.** Cercanía real, no simpatía impostada. No somos tu amigo: somos alguien
   que sabe de esto y está de tu lado.
3. **Honesta antes que tranquilizadora.** No prometemos lo que no podemos. Un resultado severo se
   dice, no se suaviza hasta volverlo inútil.
4. **Sobria.** Sin euforia, sin dramatismo, sin signos de exclamación en cadena.

**Persona gramatical:** tuteo neutro colombiano. Nunca voseo, nunca "usted" con el paciente
(el "usted" solo aparece dentro de instrumentos psicométricos validados, donde la redacción del ítem
es intocable).

**Primera persona del plural para nosotros** ("no pudimos guardar", "te acompañamos"), **segunda del
singular para la persona** ("tu proceso", "puedes revocarlo"). Nunca impersonal frío ("se ha
producido un error", "se recomienda").

---

## Tono

El tono **sí cambia**: es la voz adaptada al momento. Estos son los cinco registros y cuándo aplica
cada uno.

| Registro | Cuándo | Cómo suena | Qué evita |
| :--- | :--- | :--- | :--- |
| **Acogedor** | Primera visita, home, blog, tests públicos | Invita, baja la barrera, no pide nada | Urgencia, promesas |
| **Sereno** | Portal, agenda, perfil, ajustes | Informativo, breve, sin adornos | Entusiasmo fuera de lugar |
| **Cuidadoso** | Resultados, evaluaciones, anamnesis, consentimiento | Preciso y validante a la vez | Dramatismo y también frialdad |
| **Firme y cálido** | Riesgo, crisis, ideación | Directo, sin rodeos, con salida concreta | Cualquier otra cosa que no sea ayudar |
| **Discreto** | Facturación, planes, upsell | Informa y se aparta | Presión, insistencia |

**Regla de transición:** el tono nunca sube de energía cuando la persona está mal. Puede bajar de
energía cuando está bien, nunca al revés. Un mensaje de éxito puede ser sobrio; un mensaje de riesgo
no puede ser efusivo.

---

## Personalidad

Si Mente en Foco fuera una persona:

**Es** un profesional con años de consulta que aprendió a explicar sin tecnicismos. Escucha antes de
hablar. No se asusta con lo que le cuentas. No te apura. Te dice la verdad aunque no sea la que
querías. Y cuando algo se le escapa de las manos, te dice a dónde ir en vez de improvisar.

**No es:**

- **El coach motivacional.** Nada de "¡tú puedes!", "el primer paso es el más difícil", "hoy es el
  día". Ese registro trivializa.
- **El bot amistoso.** Sin emojis en la interfaz, sin "¡Ups!", sin humor sobre el malestar.
- **El vendedor consultivo.** No hace preguntas cuya única salida es contratar.
- **El manual clínico.** El rigor va en el registro clínico; la calidez, en la pantalla.
- **El sistema.** Nunca habla como máquina ("operación no permitida", "código 42501").

**Cómo se comporta ante el silencio del usuario:** no lo persigue. No hay "llevas 7 días sin
entrar", ni rachas, ni notificaciones de culpa. Si vuelve, se le recibe igual que la primera vez.

---

## Lenguaje permitido

### Verbos que usamos

| Campo | Verbos |
| :--- | :--- |
| Proceso | acompañar, avanzar, empezar, continuar, retomar, ampliar |
| Comprensión | entender, conocer, explorar, descubrir, aprender |
| Acción del usuario | elegir, decidir, guardar, enviar, revocar, responder |
| Nuestra acción | acompañar, revisar, cuidar, registrar, proponer |
| Clínico | valorar, orientar, evaluar, hacer seguimiento, remitir |

### Sustantivos que usamos

proceso · acompañamiento · etapa · valoración · orientación · espacio · guía · herramienta ·
biblioteca · aporte · profesional · especialista · equipo clínico

### Formulaciones que funcionan

- **"Tu ___"** para lo que le pertenece: tu proceso, tu resultado, tu espacio, tu aporte.
- **"Si quieres, ___"** para lo opcional. Marca que no hay obligación sin decir "opcional".
- **"Puedes ___"** para permisos y capacidades: "puedes revocarlo cuando quieras".
- **"No tienes que ___"** para quitar peso: "no tienes que sostener esto solo(a)".
- **"Todavía"** en estados vacíos: "todavía no hay aportes publicados" — señala que llegará algo, sin
  reclamar nada.
- **Inclusivo con paréntesis**, no con barra ni con "e": "solo(a)", "deprimido(a)". Es lo que ya usa
  el producto y lo que usan los instrumentos.

### Puntuación

- **Punto final en frases completas**, también en mensajes de error y de éxito.
- **Máximo un signo de exclamación por pantalla**, y solo si celebra algo del usuario — nunca algo
  nuestro (un pago no es un logro suyo).
- **Comillas para citar al usuario**, no para ironizar.
- **Raya larga (—) para incisos**, no guion corto.
- **Cifras en números** cuando son datos (9 de 27 puntos); en letras cuando son parte de la prosa
  ("dos semanas").

---

## Lenguaje prohibido

### Prohibido siempre

| Categoría | Ejemplos concretos |
| :--- | :--- |
| **Comercio** | comprar, adquirir, suscribirse, contratar, checkout, carrito, oferta, promoción, descuento, upgrade, SKU |
| **Urgencia** | ahora, ya, no esperes más, última oportunidad, cupos limitados, solo hoy, no dejes pasar |
| **Exclusividad** | exclusivo, premium (como adjetivo), VIP, acceso privilegiado, solo para miembros |
| **Bloqueo** | desbloquea, bloqueado, restringido, no disponible en tu plan, actualiza para ver |
| **Promesa absoluta** | cura, garantizado, resultados en X días, definitivo, para siempre |
| **Etiqueta a la persona** | eres ansioso, eres depresivo, paciente difícil, caso |
| **Embudo** | lead, conversión, funnel, retención, engagement, activación |
| **Culpa** | si de verdad te importara, no te descuides, deberías haber |
| **Sistema** | operación no permitida, error inesperado, código de error, algo salió mal |
| **Inglés** | login, dashboard, upgrade, matching, wellness, mindset |

### Prohibido según contexto

- **"Gratis"** como reclamo comercial ("¡gratis!") sí; como descripción honesta de acceso
  ("gratis · sin registro · confidencial") no solo se permite: se usa.
- **"Premium"** como nombre de etapa está prohibido (ADR-003); como adjetivo de calidad, también.
  El nivel se llama **Mi Mundo en Foco**.
- **"Membresía"** está prohibido para las etapas de acompañamiento. Solo sería admisible para un
  producto que realmente fuera una membresía y no una etapa clínica — hoy no existe.
- **Emojis:** prohibidos en la interfaz del producto. Admitidos en documentación interna.

---

## Cómo escribir CTAs

### Reglas

1. **Verbo en infinitivo o primera persona del singular**, nunca imperativo agresivo.
2. **Nombra el resultado, no la transacción.** "Empezar con Primeros Pasos", no "Pagar plan".
3. **Máximo 4 palabras** en botón primario.
4. **Un solo CTA primario por pantalla.** Los demás son secundarios visual y verbalmente.
5. **El CTA nunca miente sobre lo que pasa al pulsarlo.** Si abre un formulario, no dice "Empezar
   ahora".
6. **Un CTA comercial nunca aparece junto a contenido de riesgo** (ADR-004).

### Tabla

| ❌ Incorrecto | ✅ Correcto | Por qué |
| :--- | :--- | :--- |
| Adquirir plan | Empezar con Primeros Pasos | ADR-003: no se adquiere una etapa |
| Comprar Premium | Amplía tu acompañamiento | Comercio + nombre prohibido |
| Suscribirme | Empezar mi proceso | Lenguaje de suscripción |
| Desbloquea todo el contenido | Ver qué incluye cada etapa | ADR-001: no hay nada bloqueado |
| Regístrate para continuar | Crear cuenta gratis | ADR-005: nunca condiciona el acceso |
| ¡Empieza hoy mismo! | Da el primer paso | Urgencia + exclamación |
| Solicitar información | Cuéntanos qué necesitas | Genérico y frío |
| Enviar | Enviar aporte | Un verbo solo no dice qué se envía |
| Ver más | Leer guía · Leer · Ver documentos | "Ver más" no dice a dónde va |
| Ver detalle | Leer | Si se puede leer entero, se dice "leer" |
| Actualizar plan | Ampliar mi acompañamiento | "Actualizar" es de software |
| Agenda una demo | Hablemos de tu equipo | *(B2B: sigue sin sonar a software)* |

### CTA en momento de riesgo

Solo uno, y no es comercial:

> ✅ **Ver líneas de atención inmediata**

---

## Cómo escribir mensajes de error

### Estructura obligatoria

**[Qué pasó, en primera persona del plural] + [qué puede hacer la persona].**

Nunca una sola de las dos partes. Un error sin salida deja a alguien parado.

### Reglas

1. **"No pudimos", no "hubo un error".** Asumimos la responsabilidad; no le pasa "algo" al usuario.
2. **Nunca códigos técnicos ni jerga de sistema** en la superficie. El detalle va a la consola.
3. **Nunca culpar al usuario.** "El correo no es válido" → "Revisa el correo: parece que falta algo".
4. **Si el error es nuestro, se nota que lo sabemos.** Si es de conexión, se dice.
5. **Nunca signos de exclamación.**
6. **Un error en un flujo clínico se comunica con más cuidado, no con menos**: si alguien acaba de
   escribir su historia y no se guardó, hay que decirle explícitamente qué pasó con lo que escribió.

### Tabla

| ❌ Incorrecto (real, en el producto) | ✅ Correcto |
| :--- | :--- |
| `Something went wrong` | No pudimos cargar esta página. Intenta de nuevo en un momento. |
| `Error de validación inesperado.` | Revisa los campos marcados y vuelve a intentarlo. |
| `Error de validación.` | Faltan datos por completar. Te los marcamos abajo. |
| `Error al guardar. Intenta de nuevo.` | No pudimos guardar los cambios. Intenta de nuevo. |
| `Error al cambiar el plan.` | No pudimos cambiar la etapa del paciente. Intenta de nuevo. |
| `Error al actualizar el estado.` | No pudimos actualizar el estado. Intenta de nuevo. |
| `Hubo un error al registrar la evaluación.` | No pudimos guardar tus respuestas. No se perdieron: vuelve a enviarlas. |
| `No se pudo completar la acción.` | No pudimos completar esta acción. Intenta de nuevo. |
| `Error tracking telemetry` *(consola)* | *(correcto: es log interno, no lo ve nadie)* |

### Ejemplos ya correctos en el producto

Estos cumplen la guía y sirven de patrón:

> ✅ No pudimos enviar el correo. Verifica el email ingresado.
> ✅ No pudimos cargar el directorio. Intenta de nuevo.
> ✅ Hubo un error al asignar las tareas. Verifica tu conexión.
> ✅ No pudimos registrar tu consentimiento. Intenta de nuevo.

---

## Cómo escribir mensajes de éxito

### Reglas

1. **Sobrio.** El éxito es lo esperado, no un logro extraordinario.
2. **Confirma qué pasó, no que "todo salió bien".** "Guardado" dice más que "¡Operación exitosa!".
3. **Exclamación solo si celebra algo de la persona,** nunca algo del sistema ni un pago.
4. **Si hay un siguiente paso, se dice.** Si no hay ninguno, se calla — no se inventa uno comercial.
5. **Sin felicitaciones vacías.** Nadie necesita que lo feliciten por llenar un formulario.

### Tabla

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| `¡Pago procesado con éxito!` + `Bienvenido/a a Mente en Foco Premium.` | Listo. Ya estás en Mi Mundo en Foco. Tu acompañamiento empieza con tu valoración inicial. |
| `¡Tareas clínicas asignadas correctamente al paciente!` | Tareas asignadas. El paciente ya las ve en su portal. |
| `Operación exitosa` | Guardado. |
| `¡Felicitaciones! Completaste tu perfil` | Tu ficha quedó registrada. |
| `Datos guardados con éxito` | Guardado. |
| `¡Gracias por registrarte!` | Revisa tu correo: te enviamos tu contraseña temporal. |

### Ejemplos ya correctos en el producto

> ✅ Tu comentario fue enviado y se publicará tras revisión.
> ✅ Sesión programada correctamente.
> ✅ Comentario publicado.
> ✅ Tu ficha quedó registrada.

---

## Cómo escribir mensajes clínicos

Los mensajes clínicos son los que hablan de lo que le pasa a alguien. Son los más delicados del
producto después de los de riesgo.

### Reglas

1. **Orientación, nunca diagnóstico.** Ningún texto de cara al paciente afirma que tiene un
   trastorno. Se habla de lo que las respuestas *sugieren* o *apuntan*.
2. **Se describe lo que la persona vive, no lo que "es".** "Estás atravesando", no "eres".
3. **Se valida sin amplificar.** Ni minimizar ("no es para tanto") ni dramatizar ("estás muy mal").
4. **Se nombra que tiene tratamiento.** Casi siempre es la información más útil del mensaje.
5. **Se explica el término técnico la primera vez**, con una imagen simple.
6. **Se dice el límite del instrumento** donde corresponde, no escondido al final.
7. **Nunca se atribuye culpa ni carácter.** No es falta de voluntad, ni de disciplina, ni de fuerza.

### Tabla

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Tienes depresión moderada | Tus respuestas apuntan a síntomas en un nivel moderado |
| Diagnóstico: ansiedad severa | Nivel alto de ansiedad. El diagnóstico lo hace un profesional en una valoración |
| Eres una persona ansiosa | Estás atravesando un momento de mucha ansiedad |
| Tu puntaje es preocupante | Lo que respondiste apunta a un malestar importante |
| Sufres de insomnio | Llevas un tiempo durmiendo mal |
| Debes buscar ayuda urgentemente | Vale la pena una valoración con un profesional, y no tienes que esperar a que empeore |
| Tu resultado es normal | La ansiedad no parece estar interfiriendo con tu día a día |
| Presentas sintomatología ansiosa de intensidad moderada | Los síntomas están en un nivel moderado y es probable que ya te estén costando cosas |
| Falta de adherencia al tratamiento | *(nunca de cara al paciente; es lenguaje de registro clínico)* |

### El patrón de tres partes

Todo resultado clínico de cara al paciente usa la misma estructura, ya implementada en los tests:

1. **Qué significa** — interpretación en lenguaje llano, sin etiqueta.
2. **Qué puedes hacer ahora** — un paso concreto, no un consejo abstracto.
3. **El límite** — "esto es una orientación, no un diagnóstico".

### Registro clínico vs. pantalla

Son dos idiomas distintos y no se mezclan:

| Superficie | Idioma |
| :--- | :--- |
| Historia clínica, valoración, informe | Técnico, preciso, con nomenclatura CIE-11 |
| Pantalla del paciente | Llano, cálido, sin jerga |
| Pantalla del terapeuta | Técnico, pero sin lenguaje de gestión ("pacientes convertidos") |

---

## Cómo escribir mensajes de riesgo

> [!danger] Registro más estricto del producto
> Aquí no hay margen creativo. ADR-004 y ADR-012 obligan.

### Reglas

1. **El bloque de riesgo va primero, arriba de todo.** No debajo del resultado, no en una pestaña.
2. **Cero mensaje comercial en la misma pantalla.** No atenuado ni movido abajo: ausente.
3. **Se nombra lo que la persona dijo, sin eufemismo.** Si marcó ideación, se dice —con cuidado— que
   lo marcó. Rodearlo comunica que es innombrable.
4. **Se agradece la honestidad.** Responder eso cuesta.
5. **Se da salida concreta e inmediata:** número, urgencias, enlace a líneas de atención. Nunca solo
   "busca ayuda".
6. **Se dice lo que la plataforma NO es.** No atendemos urgencias en tiempo real, y hay que decirlo
   ahí.
7. **Sin dramatismo y sin alarma.** Firme y cálido. No "estás en peligro"; sí "no tienes que
   sostener esto solo(a)".
8. **Nunca se le pide nada a cambio.** Ni registro, ni correo, ni datos.

### Tabla

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Tu resultado es preocupante. Habla ya con un especialista → **Ver planes** | No tienes que sostener esto solo(a). Si sientes que estás en riesgo, llama al 123 → **Ver líneas de atención inmediata** |
| Detectamos riesgo suicida | En una de tus respuestas mencionaste pensamientos de hacerte daño. Gracias por tu honestidad: eso cuesta. |
| Estás en riesgo. Aprovecha 20% en tu primer plan | *(prohibido: no hay mensaje comercial en riesgo)* |
| Si tienes pensamientos negativos, considera hablar con alguien | Si en algún momento tienes pensamientos de hacerte daño, busca ayuda de inmediato: urgencias o una línea de atención. |
| Contacta a un profesional lo antes posible | Busca atención profesional lo antes posible. Si sientes que no puedes más, hay líneas disponibles ahora mismo. |
| *(silencio: mostrar solo el puntaje)* | *(prohibido: un puntaje sin contención es abandono)* |

### Umbral de activación

El registro de riesgo se activa por **dos vías independientes**, y basta una:

- Banda severa del instrumento, **o**
- Respuesta positiva en un ítem de ideación, **aunque el puntaje total sea mínimo**.

Un puntaje de 1 con un pensamiento de hacerse daño **es** riesgo. Si el criterio fuera solo el
puntaje, esa persona vería una oferta comercial.

---

## Cómo escribir textos relacionados con pagos

Los pagos existen —hay que cobrar— pero son el registro **discreto**: informan y se apartan.

### Reglas

1. **El pago se nombra como lo que es, sin eufemismo ni entusiasmo.** Ni "invierte en ti" en el
   botón de cobro, ni "¡compra ahora!".
2. **Nunca se celebra un pago.** Se confirma. La celebración corresponde a los avances de la persona.
3. **Se dice el precio con claridad y sin trucos.** Sin "desde", sin tachados falsos, sin
   comparativos inventados.
4. **La palabra "pago" solo aparece donde de verdad hay una transacción** (confirmación,
   facturación) — nunca en la navegación ni en la presentación de etapas.
5. **Nunca se menciona el dinero cerca de contenido clínico o de riesgo.**
6. **Se dice cómo salirse.** Si se puede cancelar, se dice dónde.

### Tabla

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| ¡Pago procesado con éxito! | Listo, tu pago quedó confirmado. |
| Tu suscripción está activa | Tu acompañamiento está activo. |
| Renovación automática activada | Se renueva cada mes. Puedes cancelarlo cuando quieras desde tus ajustes. |
| Aún no tienes un plan activo | Todavía no has empezado tu proceso de acompañamiento. |
| Invierte en tu salud mental — **Pagar** | Empezar con Primeros Pasos |
| Precio especial por tiempo limitado | *(prohibido: urgencia artificial)* |
| Método de pago vencido. Actualiza para no perder tu acceso | Tu método de pago necesita actualizarse. Te avisamos con tiempo para que no se interrumpa tu proceso. |

---

## Cómo escribir textos relacionados con planes

> [!important] Un plan es una etapa, no un producto (ADR-003)
> Nombra dónde está la persona en su proceso, no cuánto pagó.

### Reglas

1. **Se dice el nombre de la etapa, nunca el identificador técnico** ni el nombre viejo de SaaS.
2. **Se describe lo que la etapa incluye, jamás lo que le falta.**
3. **Ninguna etapa se presenta como versión recortada de otra.** La gratuita no es una demo.
4. **La comparativa informa; no presiona.** Es legítima porque el usuario la busca (ADR-001).
5. **La invitación a avanzar va después del valor entregado**, es opcional y no se repite.
6. **No se usa "plan" cuando se puede usar "proceso" o "acompañamiento".**

### Tabla

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Plan Básico / Plan Pro / Premium | Primeros Pasos / Mi Equilibrio / Mi Mundo en Foco |
| Membresía exclusiva | Tu proceso, a tu ritmo |
| Elige tu plan | Elige cómo quieres avanzar |
| Mejora tu plan | Amplía tu acompañamiento |
| El plan Básico no incluye sesiones | Las sesiones con especialista empiezan en Primeros Pasos |
| Solo con Premium accedes a las 24 piezas | En Mi Mundo en Foco encuentras las 24 piezas de la biblioteca |
| Plan gratuito (limitado) | Plan Gratuito — 15 guías, 10 piezas y tus evaluaciones *(nombre en revisión: ver el informe de coherencia del 30-jul)* |
| Cambia de plan cuando quieras | Puedes avanzar de etapa cuando lo necesites |
| Este contenido requiere plan Integral | *(prohibido: no se muestra lo que no incluye — ADR-001)* |

---

## Cómo escribir textos relacionados con terapeutas

> [!important] El terapeuta nunca es tratado como vendedor (ADR-004)
> Su panel es una herramienta clínica, no un CRM.

### Reglas

1. **Cero lenguaje de gestión comercial** en su superficie: sin conversión, sin captación, sin
   metas, sin ranking.
2. **Sus pacientes son personas, no cartera.** "Tus pacientes", nunca "tu cartera" ni "tus clientes".
3. **Se le habla como profesional, con precisión técnica** — pero sin convertir actos clínicos en
   formularios.
4. **Al paciente se le habla del terapeuta con respeto y sin superlativos.** "Tu profesional", "un
   especialista". Nada de "los mejores terapeutas del país".
5. **No se inventan credenciales, reseñas ni cifras** (ADR-007).
6. **Lo que el terapeuta firma es irreversible, y la interfaz lo dice antes,** no después.

### Tabla — superficie del terapeuta

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Pacientes convertidos este mes | Tus pacientes |
| Impulsa a tus pacientes a mejorar de plan | *(prohibido: el terapeuta no vende)* |
| Tu cartera de clientes | Mis pacientes |
| Publica y posiciona tu contenido | Comparte lo que trabajas con tus pacientes |
| Meta mensual de sesiones | Sesiones de esta semana |
| Caso #4812 | *(el paciente se nombra por su nombre)* |
| Guardar | Firmar documento *(y avisar que quedará inmodificable)* |

### Tabla — cómo se habla del terapeuta al paciente

| ❌ Incorrecto | ✅ Correcto |
| :--- | :--- |
| Nuestros mejores especialistas | Nuestro equipo clínico |
| Te asignaremos un experto | Un profesional entiende tu caso y proponen juntos un plan |
| Terapeuta certificado ⭐⭐⭐⭐⭐ | Profesional en psicología, con su tarjeta profesional visible |
| Tu asesor | Tu profesional · tu terapeuta |

---

## Ejemplos por pantalla

Recorrido por las superficies reales del producto, con lo que se dice hoy y lo que corresponde.

### Navbar

| ❌ | ✅ | Nota |
| :--- | :--- | :--- |
| Membresía | Planes | ADR-003. Hoy dice "Planes" en la navbar pero "Membresía" en la página |
| Blog y artículos | Blog | "Artículos" ahora vive en Contenido — ADR-009 |
| Evalúate | ✅ *(correcto)* | Verbo, invita, no promete resultado |
| Recursos → Tests de bienestar | ✅ *(correcto)* | |

### Planes (`/asesoramiento`, `/membresia`)

| ❌ | ✅ |
| :--- | :--- |
| `Membresía — Mente en Foco` *(título de página)* | Tu proceso, a tu ritmo — Mente en Foco |
| `Adquirir plan` *(botón del reverso)* | Empezar con Mi Equilibrio |
| `Membresía exclusiva` *(home)* | Biblioteca de tu etapa |
| Descubrir plan | ✅ *(correcto)* |
| Elige cómo quieres avanzar | ✅ *(correcto)* |
| Cada plan incluye el nivel de contenido digital correspondiente. | Cada etapa incluye su biblioteca de contenido. |

### Agenda

| ❌ | ✅ |
| :--- | :--- |
| No hay sesiones programadas todavía. | ✅ *(correcto — usa "todavía")* |
| No tienes sesiones próximas. | ✅ *(correcto)* |
| Reservar cita | Programar sesión |
| Cita cancelada exitosamente | Sesión cancelada. Avisamos a tu profesional. |
| Sesión programada correctamente. | ✅ *(correcto)* |

### Contenido (`/contenido`)

| ❌ | ✅ |
| :--- | :--- |
| Ver detalle | Leer |
| Contenido Premium 🔒 | *(no se muestra — ADR-001)* |
| Todavía no hay contenido publicado en esta categoría. Estamos preparándolo. | ✅ *(correcto)* |
| Desbloquea más contenido | *(prohibido)* |

### Tests (`/tests`)

| ❌ | ✅ |
| :--- | :--- |
| Descubre si tienes ansiedad | Test de ansiedad — orientación sobre tu nivel |
| Gratis · sin registro · confidencial | ✅ *(correcto — y literalmente cierto: ADR-005)* |
| Déjanos tu correo para ver tu resultado | Ya viste tu resultado. Si quieres, te lo enviamos. |
| Un cribado no es un diagnóstico | ✅ *(correcto)* |
| Qué significa / Qué puedes hacer ahora | ✅ *(correcto — es el patrón de tres partes)* |
| Empezar | ✅ *(correcto)* |

### Consentimiento (`/consentimiento-clinico`)

| ❌ | ✅ |
| :--- | :--- |
| Acepta los términos para continuar | Leí y entendí esta información, y acepto de forma libre y voluntaria iniciar mi proceso |
| Al continuar aceptas nuestras condiciones | *(prohibido: el consentimiento clínico es expreso, no tácito — ADR-008)* |
| Puedes revocarlo cuando quieras desde los ajustes de tu cuenta. | ✅ *(correcto)* |
| Consentimiento revocado exitosamente | Tu consentimiento quedó revocado. Tu profesional lo verá y podrán hablar de cómo continuar. |

### Dashboard del paciente

| ❌ | ✅ |
| :--- | :--- |
| `Aún no tienes un plan activo` | Todavía no has empezado tu proceso de acompañamiento. |
| Bienvenido a tu Espacio | ✅ *(correcto)* |
| Tu espacio de acompañamiento | ✅ *(correcto)* |
| ¿Cómo te sientes hoy? | ✅ *(correcto — pregunta abierta, sin obligación)* |
| Completa tu perfil para desbloquear funciones | Completa tu perfil para que podamos contactarte si hay cambios |
| Llevas 5 días sin registrar tu ánimo | *(prohibido: no se persigue al usuario)* |

### Perfil / Ajustes

| ❌ | ✅ |
| :--- | :--- |
| Campo obligatorio | Necesitamos este dato para contactarte si hay un cambio en tu sesión |
| Datos actualizados con éxito | Guardado. |
| Editar mis datos | ✅ *(correcto)* |
| Zona de peligro | *(prohibido: lenguaje de sistema. Usar "Revocar consentimiento del proceso")* |
| Revocar consentimiento del proceso | ✅ *(correcto)* |

### Blog

| ❌ | ✅ |
| :--- | :--- |
| Deja tu comentario | Comparte lo que a ti te ayudó |
| Tu comentario está pendiente de aprobación | Solo tú lo ves por ahora. Lo revisamos antes de publicarlo. |
| Comentario rechazado | Este aporte no se publicó. Si crees que fue un error, escríbenos. |
| Lo que cuenta la comunidad | ✅ *(correcto)* |
| Regístrate para comentar | ¿Quieres aportar tu experiencia? Entra a tu cuenta para escribir. |

### Panel del terapeuta

| ❌ | ✅ |
| :--- | :--- |
| No tienes pacientes asignados. | ✅ *(correcto)* |
| Guardar y firmar | Firmar documento — quedará inmodificable |
| Aprobar comentario | Publicar |
| Comparte lo que trabajas con tus pacientes | ✅ *(correcto)* |

### Estados vacíos (transversal)

| ❌ | ✅ |
| :--- | :--- |
| No hay datos | Todavía no hay [lo que sea]. |
| Sin resultados | No encontramos nada con ese filtro. Prueba con otra categoría. |
| Vacío | *(nunca)* |
| Sin evaluaciones aún | ✅ *(correcto)* |
| Todavía no hay aportes publicados. | ✅ *(correcto)* |

---

## Inventario de deuda de lenguaje

Cadenas reales que hoy incumplen esta guía. No se corrigen en este documento —no se toca código—
pero quedan registradas para una pasada futura.

| Dónde | Cadena actual | Incumple |
| :--- | :--- | :--- |
| Error boundary | `Something went wrong` | Inglés · lenguaje de sistema |
| Compra exitosa | `¡Pago procesado con éxito!` | Celebra un pago |
| Compra exitosa | `Bienvenido/a a Mente en Foco Premium.` | ADR-003: nombre de etapa prohibido |
| Tarjeta de plan | `Adquirir plan` | ADR-003: no se adquiere una etapa |
| `/membresia` | `Membresía — Mente en Foco` *(título y OG)* | ADR-003 |
| Home | `Membresía exclusiva` | Exclusividad + membresía |
| Contáctanos | `Membresía` *(opción del formulario)* | ADR-003 |
| Dashboard paciente | `Aún no tienes un plan activo` | Lenguaje de suscripción |
| Panel terapeuta | `¡Tareas clínicas asignadas correctamente al paciente!` | Exclamación + jerga |
| Varios | `Error de validación.` / `Error de validación inesperado.` | Sin salida · lenguaje de sistema |
| Varios | `Error al guardar.` / `Error al cambiar el plan.` / `Error al actualizar el estado.` | "Error al" en vez de "No pudimos" |

**Prioridad sugerida:** primero lo que viola un ADR (las cinco filas de planes y pagos), después los
errores, al final los detalles de tono.

---

## Lista de verificación antes de publicar un texto

1. ¿Suena a alguien o suena a sistema?
2. ¿Usa alguna palabra de la lista prohibida?
3. Si es un error, ¿dice qué hacer ahora?
4. Si es clínico, ¿orienta en vez de diagnosticar?
5. Si hay riesgo en la pantalla, ¿desapareció todo lo comercial?
6. Si habla de una etapa, ¿usa su nombre y no el técnico?
7. ¿Describe lo que se incluye, en vez de lo que falta?
8. ¿Pide algo antes de haber dado algo?
9. ¿Cómo lee esto la persona más vulnerable que llegue a esta pantalla?

Si alguna respuesta incomoda, el texto se reescribe.

## Enlaces

- `00_FILOSOFIA_MENTE_EN_FOCO.md` — en qué creemos
- `03_DECISIONES_ARQUITECTONICAS.md` — qué se decidió (ADR-001 a ADR-013)
- `contenido-plataforma/00_guia_estilo_redaccion.md` — voz aplicada a piezas editoriales largas
- `especificaciones-producto/11_diferenciacion_guias_vs_contenido.md` — voz por sección
