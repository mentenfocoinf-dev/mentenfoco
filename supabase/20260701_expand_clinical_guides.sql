-- Expande clinical_guides con 4 categorías nuevas (8 guías), usando el contenido clínico de
-- investigacion-clinica-cie11-dsm5/03_Metodologias_Terapeuticas_Basadas_en_Evidencia.md (modelos
-- terapéuticos y su nivel de evidencia) y 04_Neurologia_Comorbilidades_Deterioro_Cognitivo.md
-- (espectro de deterioro cognitivo, categoría de salud cognitiva pedida explícitamente).
-- Antes de esto solo existían 4 categorías (Ansiedad, Autoestima, Infantil, Relaciones), 12 guías.
-- Sigue el mismo patrón de la migración 20240514_security_sprint.sql (INSERT ... ON CONFLICT).

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('animo-depresion-episodio', 'Ánimo', ARRAY['TCC', 'Activación Conductual', 'CIE-11'], 'Entender un episodio depresivo', 'Qué está pasando en tu cerebro y qué ayuda realmente.', '13 min', 'Entender un episodio depresivo.png', 'Un episodio depresivo no es "estar triste" sostenido en el tiempo. Es una desregulación que afecta el ánimo, la energía, el sueño, el apetito y la capacidad de sentir placer (anhedonia) al mismo tiempo. El cerebro entra en un patrón de conservación de energía que, paradójicamente, empeora el cuadro: dejas de hacer las cosas que antes te daban placer o sentido, y eso confirma la creencia de que "nada vale la pena".', 'ACTIVACIÓN CONDUCTUAL BÁSICA:

1. Lista de 5 actividades: anota 5 cosas que antes disfrutabas, sin importar cuán pequeñas.
2. Elige la más fácil: no la que "debería" motivarte más, la que requiera menos energía.
3. Hazla sin esperar ganas: la motivación en depresión llega después de actuar, no antes.
4. Registra el resultado: anota tu ánimo del 0 al 10 antes y después.', false, '
# Episodio Depresivo: Fundamento Clínico e Intervención Inicial

## Fundamento Clínico

Un episodio depresivo (CIE-11 6A70 si es único, 6A71 si es recurrente) se caracteriza por ánimo bajo o anhedonia sostenidos la mayor parte del día, casi todos los días, durante al menos dos semanas, junto con síntomas asociados: alteración del sueño y el apetito, fatiga, dificultad de concentración, sentimientos de inutilidad o culpa, y en los casos más graves, ideación de muerte.

Neurobiológicamente, se asocia a alteraciones en la regulación de neurotransmisores (serotonina, noradrenalina, dopamina), pero el modelo puramente bioquímico es insuficiente: la depresión también se sostiene por un círculo conductual. La anhedonia lleva a la evitación de actividades; la evitación reduce el contacto con reforzadores positivos naturales (logros, contacto social, placer); la ausencia de esos reforzadores profundiza el ánimo bajo. Este círculo es el objetivo directo de la activación conductual, uno de los componentes con mejor evidencia dentro de la TCC para depresión.

## Diferenciación Diagnóstica

| Característica | Episodio Depresivo | Tristeza / Duelo Normal | Trastorno Distímico (6A72) |
| :--- | :--- | :--- | :--- |
| **Duración** | Mínimo 2 semanas, la mayor parte del día. | Variable, con oleadas; no ocupa el día completo de forma sostenida. | Crónico, 2 años o más, de menor intensidad. |
| **Anhedonia** | Presente y generalizada a casi todas las áreas. | Puede conservarse el placer en actividades no relacionadas con la pérdida. | Presente pero de baja intensidad constante, "de fondo". |
| **Funcionalidad** | Interferencia clara en trabajo, estudio o vínculos. | Interferencia puntual, se mantiene funcionalidad general. | Funciona, pero con esfuerzo sostenido, "arrastrándose". |
| **Ideación de muerte** | Puede aparecer; requiere evaluación de riesgo inmediata si aparece. | Infrecuente, salvo en duelos complicados. | Menos frecuente, pero posible en cuadros de larga evolución. |

## Protocolo de Intervención: Primeros Pasos

### 1. Psicoeducación y Reducción de Autoexigencia

Explicar el círculo anhedonia-evitación-empeoramiento ayuda a que el paciente deje de interpretar su inactividad como "pereza" o "falta de voluntad", lo cual reduce la culpa secundaria que agrava el cuadro.

*   **Reencuadre:** "No haces las cosas porque estás deprimido, no estás deprimido por no hacer las cosas. El orden importa para saber por dónde empezar."

### 2. Activación Conductual Gradual

*   **Jerarquía de actividades:** listar actividades placenteras o de logro previas al episodio, ordenadas de menor a mayor esfuerzo requerido.
*   **Programación, no espera de motivación:** agendar la actividad más simple en un horario fijo, independientemente del ánimo del momento. La evidencia muestra que el ánimo mejora después de la acción, no antes.
*   **Registro de ánimo pre/post:** anotar el nivel de ánimo (0-10) antes y después de cada actividad para generar evidencia empírica de que la acción sí modifica el estado, contrarrestando la creencia de indefensión.

### 3. Reestructuración Cognitiva Diferida

La reestructuración cognitiva profunda (identificación de distorsiones, cuestionamiento socrático) se introduce una vez que hay algo de activación conductual en marcha — intentar reestructurar pensamientos en el pico de un episodio grave, sin haber roto primero el círculo de evitación, suele generar más frustración que alivio.

### 4. Cuándo escalar

Cualquier mención de ideación de muerte o autolesión, aunque sea pasiva ("no quiero seguir así"), amerita evaluación de riesgo estructurada (ver PHQ-9 ítem 9 y C-SSRS) antes de continuar con el plan de activación conductual.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('animo-prevencion-recaida', 'Ánimo', ARRAY['MBCT', 'Mindfulness', 'Prevención'], 'Prevenir una recaída depresiva', 'Por qué después de 3 episodios el riesgo cambia, y qué hacer al respecto.', '14 min', 'Prevenir una recaída depresiva.png', 'Cada episodio depresivo deja una especie de "huella" cognitiva: patrones de pensamiento que quedan más fácilmente activables ante el próximo bajón de ánimo. Después de tres episodios, el riesgo de uno nuevo sube considerablemente, y ya no depende tanto de eventos externos como de ese patrón interno.', 'ESCANEO CORPORAL DE 3 MINUTOS:

1. Siéntate o acuéstate en un lugar tranquilo.
2. Recorre mentalmente tu cuerpo de pies a cabeza, notando sensaciones sin juzgarlas.
3. Si aparece un pensamiento, nómbralo ("pensamiento") y vuelve al cuerpo.
4. Practícalo a diario, no solo cuando te sientes mal — es entrenamiento, no rescate.', true, '
# Prevención de Recaída Depresiva: Terapia Cognitiva Basada en Mindfulness (MBCT)

## Fundamento Clínico

La Terapia Cognitiva Basada en Mindfulness (MBCT) combina elementos de la TCC con prácticas de meditación de atención plena. Su indicación principal, con evidencia fuerte, es la prevención de recaída en personas con tres o más episodios depresivos previos (trastorno depresivo recurrente, CIE-11 6A71).

El mecanismo central no es "pensar distinto" sobre los síntomas, sino cambiar la relación con ellos. En personas con historia de depresión recurrente, un bajón de ánimo puntual (algo universal y normal) puede reactivar automáticamente el mismo patrón de pensamiento rumiativo que caracterizó episodios anteriores — este fenómeno se llama reactividad cognitiva. El mindfulness entrena la capacidad de notar ese patrón apenas empieza, sin fusionarse con él ni intentar suprimirlo, lo que interrumpe la escalada hacia un episodio completo.

## Diferenciación Diagnóstica

| Aspecto | Bajón de Ánimo Normal (post-MBCT) | Recaída en Curso (sin intervención) |
| :--- | :--- | :--- |
| **Relación con el pensamiento negativo** | Se observa el pensamiento como un evento mental pasajero. | Se fusiona con el pensamiento como si fuera un hecho ("es verdad que no valgo nada"). |
| **Respuesta conductual** | Se mantiene la rutina y el contacto social pese al bajón. | Retirada progresiva de actividades y vínculos. |
| **Duración del bajón** | Días, con fluctuación natural. | Se sostiene y profundiza más allá de una semana. |
| **Rumiación** | Reconocida y redirigida activamente. | Sostenida, con pensamiento repetitivo sobre causas y consecuencias del malestar. |

## Protocolo de Intervención: Estructura MBCT

### 1. Entrenamiento en Atención Plena al Cuerpo

La práctica base es el escaneo corporal: dirigir la atención secuencialmente a distintas zonas del cuerpo, notando sensaciones sin intentar cambiarlas. Esto entrena la capacidad de "anclar" la atención fuera del contenido mental rumiativo.

### 2. Reconocimiento Temprano de Patrones de Recaída

*   **Mapa personal de señales de alerta:** cada persona identifica sus propias señales tempranas de un episodio previo (cambios de sueño, aislamiento incipiente, autocrítica creciente) para poder reconocerlas antes de que escalen.
*   **Plan de acción ante señales:** definir de antemano, en un momento de estabilidad, qué se va a hacer si aparecen esas señales (contactar a alguien, retomar prácticas de mindfulness con mayor frecuencia, consultar antes de que el cuadro avance).

### 3. Descentramiento Cognitivo (Decentering)

Practicar el etiquetado de pensamientos ("estoy teniendo el pensamiento de que...") en vez de aceptarlos como verdades directas, disminuye su carga emocional y la probabilidad de que disparen la cascada rumiativa característica de un episodio.

### 4. Práctica Sostenida, No Solo Reactiva

El punto central de la MBCT es que la práctica se sostiene en momentos de estabilidad, no solo cuando el ánimo ya bajó — igual que un entrenamiento físico, su función preventiva depende de la regularidad, no de usarla como "primeros auxilios" únicamente en la crisis.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('trauma-primeros-pasos', 'Trauma', ARRAY['TEPT', 'EMDR', 'Regulación'], 'Primeros pasos tras un evento traumático', 'Qué es esperable en las primeras semanas y cuándo buscar ayuda especializada.', '12 min', 'Primeros pasos tras un evento traumático.png', 'No toda reacción intensa después de un evento traumático es un trastorno. El cuerpo y la mente tienen una respuesta natural de procesamiento en las primeras semanas. El problema aparece cuando esa respuesta no se resuelve y el sistema de alarma queda "encendido" mucho después de que el peligro real terminó.', 'REGULACIÓN DE PRIMERA LÍNEA:

1. Anclaje al presente: nombra 3 cosas que ves, 3 que escuchas y 3 que sientes en tu cuerpo ahora mismo.
2. Respiración con exhalación larga: inhala en 4, exhala en 6-8. La exhalación larga calma el sistema nervioso.
3. Rutina básica: mantén horarios de sueño y comida lo más regulares posible, aunque cueste.
4. No te aísles del todo: el contacto breve y seguro con otros ayuda más que la evitación total.', false, '
# Reacciones Postraumáticas Tempranas y Señales de Alarma

## Fundamento Clínico

Tras un evento traumático, es esperable experimentar síntomas de estrés agudo durante los primeros días o semanas: hipervigilancia, dificultad para dormir, recuerdos intrusivos, evitación de estímulos relacionados con el evento. La mayoría de las personas procesan estas respuestas de forma natural sin desarrollar un trastorno.

El Trastorno de Estrés Postraumático (TEPT, CIE-11 6B40) se diagnostica cuando estos síntomas persisten más allá de varias semanas, con intensidad significativa, organizados en tres grupos: re-experimentación (recuerdos intrusivos, pesadillas, flashbacks), evitación activa de recordatorios del evento, y una percepción de amenaza actual persistente (hipervigilancia, respuesta de sobresalto exagerada). El TEPT complejo (6B41) añade además alteraciones sostenidas en la regulación emocional, la autopercepción ("estoy dañado/a permanentemente") y la capacidad de mantener vínculos — típico de trauma prolongado o repetido, no de un evento único.

## Diferenciación Diagnóstica

| Característica | Estrés Agudo Normal (primeras semanas) | TEPT (6B40) | TEPT Complejo (6B41) |
| :--- | :--- | :--- | :--- |
| **Duración** | Días a pocas semanas, con mejoría progresiva. | Persiste más allá de un mes, sin mejoría espontánea. | Persiste, típicamente asociado a trauma repetido/prolongado. |
| **Origen del trauma** | Evento único o limitado en el tiempo. | Puede ser evento único o repetido. | Trauma sostenido o repetido (abuso prolongado, cautiverio, violencia crónica). |
| **Regulación emocional** | Fluctuante pero se estabiliza progresivamente. | Hipervigilancia y reactividad marcadas ante recordatorios. | Desregulación emocional generalizada, no solo ante recordatorios específicos. |
| **Autopercepción** | Se mantiene relativamente estable. | Puede afectarse en relación directa al evento. | Alterada de forma profunda y sostenida ("soy alguien dañado"). |

## Protocolo de Intervención: Estabilización Inicial

### 1. Psicoeducación sobre la Respuesta al Trauma

Explicar que los síntomas iniciales son una respuesta biológica esperable (el sistema de alarma haciendo su trabajo, aunque de forma prolongada) reduce la sensación de "estoy roto/a" que suele agravar el malestar.

### 2. Técnicas de Regulación del Sistema Nervioso

*   **Anclaje sensorial (5-4-3-2-1):** nombrar estímulos presentes de distintos sentidos para interrumpir la re-experimentación y devolver la atención al momento actual, donde el peligro ya no está presente.
*   **Respiración con exhalación prolongada:** activa el sistema parasimpático y reduce la activación fisiológica de forma más rápida que intentar "calmar la mente" directamente.
*   **Mantenimiento de rutinas básicas:** sueño, alimentación y algo de actividad física regular sostienen la capacidad de regulación del sistema nervioso, que el trauma tiende a desorganizar primero.

### 3. Evitar la Evitación Total

Sin forzar exposición temprana (que debe ser guiada profesionalmente), es importante no reforzar el aislamiento completo: mantener contacto breve y seguro con personas de confianza protege contra el aislamiento progresivo característico del TEPT en desarrollo.

### 4. Cuándo derivar a tratamiento especializado

Si los síntomas no ceden después de 4 semanas, o si hay evitación funcional significativa (dejar de trabajar, estudiar o salir), corresponde iniciar tratamiento especializado — EMDR y TCC focalizada en trauma son las intervenciones de primera línea recomendadas internacionalmente para TEPT, con evidencia fuerte específicamente para este cuadro.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('trauma-duelo-prolongado', 'Trauma', ARRAY['Duelo', 'TIP', 'CIE-11'], 'Cuando el duelo no avanza', 'La diferencia entre un duelo doloroso y un duelo que quedó atascado.', '13 min', 'Cuando el duelo no avanza.png', 'El duelo no tiene una fecha de vencimiento universal, pero sí hay una diferencia clínica reconocida entre un duelo que, con oleadas de dolor, va encontrando su cauce, y un duelo que queda atascado en el tiempo, sin poder integrar la pérdida a la vida que sigue.', 'CARTA DE INTEGRACIÓN (no de despedida):

1. Escríbele a la persona que ya no está, contándole algo de tu vida actual.
2. No busques "cerrar" nada — el objetivo es mantener el vínculo de otra forma, no cortarlo.
3. Nombra algo que aprendiste o heredaste de esa relación que sigues llevando contigo.
4. Guarda la carta; puedes volver a escribir otra más adelante.', true, '
# Trastorno de Duelo Prolongado: Diferenciación e Intervención

## Fundamento Clínico

El Trastorno de Duelo Prolongado (CIE-11 6B42) es una incorporación relativamente nueva a las clasificaciones diagnósticas (presente también en la revisión de texto del DSM-5-TR). Reconoce que, si bien el duelo es un proceso universal y no patológico, en una fracción de casos el dolor por la pérdida no evoluciona: persiste con una intensidad incapacitante mucho más allá de lo culturalmente esperado (típicamente más de 6 meses a un año, según el contexto cultural), con anhelo intenso y sostenido por la persona fallecida y dificultad para aceptar la pérdida o reincorporarse a la vida cotidiana.

Es importante distinguirlo de la reacción aguda al estrés y del duelo no complicado, que la propia CIE-11 clasifica fuera del capítulo de salud mental (como factores que afectan el estado de salud, no como trastorno) precisamente porque son procesos esperables, no patológicos.

## Diferenciación Diagnóstica

| Característica | Duelo No Complicado | Trastorno de Duelo Prolongado (6B42) |
| :--- | :--- | :--- |
| **Evolución en el tiempo** | Oleadas de dolor que, en general, se van espaciando y suavizando. | El dolor se mantiene con intensidad similar, sin evolución perceptible. |
| **Funcionalidad** | Se recupera progresivamente la capacidad de involucrarse en la vida diaria. | Interferencia sostenida y significativa en el funcionamiento cotidiano. |
| **Relación con la pérdida** | Se integra el recuerdo de la persona a una identidad que sigue adelante. | Anhelo intenso y sostenido; sensación de que la vida perdió sentido sin la persona. |
| **Evitación** | Puede evitar puntualmente recordatorios dolorosos, sin evitación generalizada. | Evitación extensa de recordatorios, o lo opuesto: preocupación excesiva y constante con la pérdida. |

## Protocolo de Intervención: Terapia Interpersonal (TIP) para Duelo

La Terapia Interpersonal tiene evidencia fuerte específicamente para cuadros depresivos y de duelo ligados a eventos vitales, siendo una de las 4 áreas problema centrales de este modelo justamente el duelo.

### 1. Validación del Proceso, No Patologización Prematura

Antes de cualquier intervención, es esencial diferenciar dolor intenso (esperable) de duelo atascado (clínico). Patologizar un duelo doloroso pero en curso puede interferir con el proceso natural de elaboración.

### 2. Reconstrucción del Vínculo, No su Cancelación

A diferencia de modelos antiguos que buscaban "cerrar" o "soltar" el vínculo con la persona fallecida, el enfoque actual promueve la reconstrucción de un vínculo continuo pero transformado: la persona sigue presente en la identidad y la narrativa de vida de quien la perdió, sin que eso impida reincorporarse a la vida cotidiana.

### 3. Reactivación de Roles y Vínculos Presentes

*   **Inventario interpersonal:** identificar qué vínculos y roles quedaron postergados o descuidados desde la pérdida.
*   **Reactivación gradual:** retomar de forma progresiva actividades y relaciones, sin exigir "sentir ganas" antes de actuar, de forma similar a la lógica de activación conductual en depresión.

### 4. Procesamiento Narrativo de la Pérdida

Poner en palabras, oral o escrito, la historia de la pérdida y su significado ayuda a integrar el evento a la narrativa de vida en curso, en vez de que quede como un punto congelado que interrumpe el relato personal.

### 5. Cuándo derivar

Ideación de muerte relacionada con el deseo de reunirse con la persona fallecida, aislamiento social extenso, o incapacidad sostenida de cumplir responsabilidades básicas ameritan evaluación clínica especializada, no solo acompañamiento.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('alimentacion-relacion-comida', 'Alimentación', ARRAY['TCC-E', 'Conducta Alimentaria', 'CIE-11'], 'Reconstruir una relación sana con la comida', 'Cómo identificar señales tempranas y qué hacer al respecto.', '13 min', 'Reconstruir una relación sana con la comida.png', 'Los trastornos de la conducta alimentaria no son una elección ni una cuestión de "fuerza de voluntad". Involucran una desregulación real entre las señales de hambre y saciedad, la imagen corporal y el uso de la comida (o su restricción) como forma de manejar emociones difíciles.', 'REGISTRO SIN JUICIO:

1. Anota qué comiste, cuándo y cómo te sentiste antes (no cuántas calorías).
2. Identifica el disparador emocional, si lo hubo, antes de comer o de restringir.
3. No uses el registro para controlar más — es para observar patrones, no para vigilarte.
4. Compártelo con un profesional; no es un ejercicio para hacer en soledad indefinidamente.', false, '
# Trastornos de la Conducta Alimentaria: Reconocimiento Temprano

## Fundamento Clínico

Los trastornos de la conducta alimentaria (CIE-11, bloque 6B80–6B8Z) incluyen cuadros con presentaciones muy distintas entre sí — desde la restricción severa de la anorexia nerviosa (6B80) hasta los episodios de atracón de la bulimia (6B81) o el trastorno por atracones (6B82) — pero comparten un núcleo común: la comida, el peso o la imagen corporal se convierten en el eje organizador de la autoestima y en una estrategia (disfuncional) de regulación emocional.

Estos cuadros rara vez aparecen "de la nada": suelen desarrollarse de forma gradual, a menudo iniciando con conductas socialmente reforzadas (empezar una dieta, "cuidarse más") que progresivamente escalan en rigidez y pierden flexibilidad. La detección temprana es clínicamente crítica: cuanto antes se interviene, mejor es el pronóstico, y varios de estos cuadros conllevan riesgo médico significativo si se prolongan sin tratamiento.

## Diferenciación Diagnóstica

| Característica | Preocupación Normal por la Alimentación | Trastorno de la Conducta Alimentaria en Desarrollo |
| :--- | :--- | :--- |
| **Flexibilidad** | Se puede improvisar, comer afuera, o saltear un plan sin angustia significativa. | Rigidez creciente; romper la regla autoimpuesta genera angustia intensa o culpa. |
| **Foco de la autoestima** | El peso o la alimentación es un tema entre varios. | El peso, la forma corporal o el control alimentario se vuelven el eje central del autoconcepto. |
| **Vida social** | La comida no interfiere de forma sistemática con la vida social. | Evitación creciente de situaciones sociales que involucren comida. |
| **Señales físicas de hambre/saciedad** | Se reconocen y se respetan en general. | Se ignoran sistemáticamente o se pierden progresivamente. |

## Protocolo de Intervención: Primeras Señales de Alarma

### 1. Psicoeducación sobre el Ciclo Restricción-Descontrol

En muchos casos, la restricción alimentaria severa predispone biológicamente a episodios de atracón (el cuerpo responde a la privación con impulsos intensos de comer), lo cual a su vez refuerza la culpa y la restricción posterior — un círculo que se retroalimenta y no se resuelve "con más fuerza de voluntad", sino rompiendo el ciclo restricción-atracón en sí.

### 2. Reintroducción de Regularidad Alimentaria

*   **Horarios regulares, no reglas rígidas:** establecer momentos de comida regulares ayuda a restaurar las señales fisiológicas de hambre y saciedad, sin necesidad de reglas estrictas sobre qué o cuánto comer.
*   **Registro observacional (no de control):** un registro que capture contexto emocional, no solo la comida en sí, ayuda a identificar disparadores sin reforzar la vigilancia obsesiva sobre la ingesta.

### 3. Trabajo sobre la Imagen Corporal, en Paralelo

Intervenir solo sobre la conducta alimentaria sin abordar la relación con el cuerpo y la autoestima suele ser insuficiente — ambos procesos avanzan juntos en el tratamiento, típicamente con TCC-Mejorada (CBT-E), el modelo con mejor evidencia específica para conducta alimentaria en adultos.

### 4. Rol de la Familia (Especialmente en Adolescentes)

En adolescentes, la terapia familiar (modelo Maudsley) tiene evidencia fuerte, empoderando a la familia como recurso activo en la renutrición y recuperación, en vez de abordar el caso de forma exclusivamente individual.

### 5. Cuándo derivar con urgencia

Pérdida de peso rápida y significativa, signos de desequilibrio médico (mareos, arritmias, amenorrea), o purgas frecuentes requieren evaluación médica inmediata en paralelo al abordaje psicológico — el riesgo físico en estos cuadros puede ser tan relevante como el psicológico.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('alimentacion-atracones', 'Alimentación', ARRAY['Atracones', 'TCC-E', 'CIE-11'], 'Entender el trastorno por atracones', 'Por qué no es "falta de disciplina" y qué intervención realmente ayuda.', '12 min', 'Entender el trastorno por atracones.png', 'El trastorno por atracones (CIE-11 6B82) es el trastorno de la conducta alimentaria más frecuente, y probablemente el más malentendido: se lo suele confundir con "comer mucho" o "falta de disciplina", cuando en realidad es un patrón compulsivo asociado a una intensa desregulación emocional.', 'PAUSA ANTES DEL ATRACÓN:

1. Cuando sientas el impulso, pon una pausa de 5 minutos antes de actuar.
2. Pregúntate: "¿tengo hambre física o estoy buscando calmar algo más?"
3. Si es emocional, nombra la emoción específica (aburrimiento, ansiedad, soledad).
4. Busca una alternativa breve para esa emoción puntual (llamar a alguien, moverte, escribir).', true, '
# Trastorno por Atracones: Más Allá del Estigma

## Fundamento Clínico

El trastorno por atracones (CIE-11 6B82) se caracteriza por episodios recurrentes de ingesta de grandes cantidades de comida en un período corto, con sensación subjetiva de pérdida de control durante el episodio, sin las conductas compensatorias (vómitos autoinducidos, laxantes, ejercicio compulsivo) que sí están presentes en la bulimia nerviosa (6B81). Es, con diferencia, el trastorno de la conducta alimentaria más prevalente, y afecta a personas de todos los pesos corporales — no es exclusivo de personas con sobrepeso, aunque el estigma social suele asumirlo así.

Funcionalmente, el atracón suele operar como una estrategia de regulación emocional: ante estados afectivos difíciles de tolerar (ansiedad, aburrimiento, soledad, vergüenza), comer en exceso genera un alivio inmediato pero breve, seguido de culpa intensa, que a su vez alimenta el malestar emocional original — perpetuando el ciclo.

## Diferenciación Diagnóstica

| Característica | Comer en Exceso Ocasional | Trastorno por Atracones (6B82) |
| :--- | :--- | :--- |
| **Frecuencia** | Situacional (celebraciones, ocasiones puntuales). | Recurrente, típicamente al menos una vez por semana durante meses. |
| **Sensación de control** | Se mantiene cierta conciencia de la decisión de comer más. | Sensación marcada de pérdida de control durante el episodio. |
| **Velocidad e ingesta** | Ritmo relativamente normal, aunque haya exceso. | Ingesta rápida, a menudo hasta sentirse incómodamente lleno/a, incluso sin hambre física. |
| **Conductas compensatorias** | No aplica. | Ausentes (a diferencia de la bulimia nerviosa). |
| **Impacto emocional posterior** | Malestar leve o ausente. | Vergüenza, culpa o disgusto intensos consigo mismo/a tras el episodio. |

## Protocolo de Intervención: TCC-Mejorada (CBT-E)

### 1. Desactivar el Componente de Vergüenza

La vergüenza asociada al atracón suele empeorar el patrón, no mejorarlo — genera aislamiento y refuerza la comida como fuente de alivio secreto. El primer paso terapéutico es reducir la vergüenza mediante psicoeducación clara sobre el mecanismo del trastorno.

### 2. Identificación de Disparadores Emocionales

*   **Registro de antecedentes emocionales:** documentar qué estado emocional o situación precede al impulso de atracón, no solo qué se comió.
*   **Diferenciación hambre física vs. hambre emocional:** entrenar la distinción entre señales fisiológicas de hambre y el impulso de comer como respuesta a una emoción incómoda.

### 3. Introducción de una Pausa Estructurada

Interponer una demora breve (algunos minutos) entre el impulso y la acción, junto con una pregunta orientadora ("¿qué estoy sintiendo en realidad?"), interrumpe la automaticidad del patrón sin exigir supresión total del impulso, lo cual suele ser contraproducente.

### 4. Regularidad Alimentaria como Base

Al igual que en otros trastornos de la conducta alimentaria, restablecer una alimentación regular y suficiente (no restrictiva) reduce la vulnerabilidad biológica a los atracones — la restricción severa es, paradójicamente, uno de los principales factores de mantenimiento del ciclo de atracones.

### 5. Alternativas de Regulación Emocional

Desarrollar un repertorio de estrategias específicas para las emociones que más disparan el impulso (por ejemplo, técnicas de regulación para ansiedad o aburrimiento) reduce progresivamente la dependencia de la comida como única herramienta disponible.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('memoria-cambios-normales', 'Memoria', ARRAY['Deterioro Cognitivo', 'CIE-11', 'Adultos Mayores'], 'Cambios de memoria: qué es normal y cuándo consultar', 'El espectro entre el envejecimiento normal y una señal de alarma real.', '13 min', 'Cambios de memoria qué es normal y cuándo consultar.png', 'Olvidarse un nombre y recordarlo un rato después no es lo mismo que perderse en un lugar conocido. Existe un espectro real entre el envejecimiento cognitivo normal y un trastorno neurocognitivo, y conocer las diferencias ayuda a saber cuándo una consulta profesional realmente hace la diferencia.', 'CRIBADO RÁPIDO DE 3 PREGUNTAS:

1. ¿Has notado cambios en tu memoria en los últimos meses?
2. ¿Algún familiar o allegado te comentó lo mismo, sin que se lo preguntaras?
3. ¿Esto interfiere con actividades cotidianas (manejar dinero, tomar medicamentos, cocinar)?

Si respondiste "sí" a la segunda o la tercera, vale la pena una evaluación cognitiva completa (MoCA o MMSE) con un profesional.', false, '
# El Espectro del Deterioro Cognitivo: De lo Normal a la Señal de Alarma

## Fundamento Clínico

El deterioro cognitivo no es un salto binario de "estar bien" a "tener demencia". Es un continuo con umbrales clínicos definidos:

1. **Envejecimiento cognitivo normal:** enlentecimiento leve de la velocidad de procesamiento y de la recuperación de palabras específicas ("lo tengo en la punta de la lengua"), sin impacto funcional real. No es un diagnóstico.
2. **Declive cognitivo subjetivo:** la persona percibe un cambio, pero las pruebas cognitivas están dentro de rango normal. Es una señal para hacer seguimiento, no un trastorno en sí.
3. **Trastorno neurocognitivo leve (CIE-11 6D71):** deterioro objetivable en pruebas cognitivas, pero la persona mantiene independencia funcional, compensando con más esfuerzo o estrategias (listas, recordatorios, rutinas). Es el punto donde más vale la detección temprana: una fracción de estos casos progresa a demencia, y otra se mantiene estable o incluso mejora si la causa es reversible (déficit de vitamina B12, hipotiroidismo, apnea del sueño no tratada, o depresión con "seudodemencia").
4. **Demencia / trastorno neurocognitivo mayor (CIE-11 6D80–6D8Z):** deterioro en dos o más dominios cognitivos que sí interfiere con la independencia en actividades de la vida diaria.

## Diferenciación Diagnóstica

| Característica | Envejecimiento Normal | Trastorno Neurocognitivo Leve (6D71) | Demencia (6D80–6D8Z) |
| :--- | :--- | :--- | :--- |
| **Qué se olvida** | Nombres o palabras puntuales, recuperables luego. | Información nueva reciente, con más esfuerzo para recordarla. | Información reciente e importante, sin recuperarla luego. |
| **Independencia funcional** | Totalmente preservada. | Preservada, con esfuerzo compensatorio (listas, recordatorios). | Afectada: requiere apoyo en actividades antes autónomas. |
| **Percepción del cambio** | La persona nota el olvido puntual sin preocupación mayor. | La persona y/o su entorno notan un cambio sostenido. | Con frecuencia, quien lo nota primero es el entorno, no la persona. |
| **Progresión** | Estable en el tiempo. | Variable: puede progresar, estabilizarse, o mejorar si la causa es tratable. | Progresiva en la mayoría de las etiologías. |

## Protocolo de Uso: Cribado y Derivación

### 1. Preguntas de Cribado Rápido (antes de un test formal)

Tres preguntas simples orientan si vale la pena avanzar a una evaluación formal: ¿la persona notó cambios en su memoria?, ¿algún familiar lo notó también, sin que se le preguntara?, ¿esto interfiere con actividades como manejar dinero o tomar medicamentos correctamente? Una respuesta afirmativa a la segunda o tercera pregunta, especialmente, amerita seguir el proceso.

### 2. Herramientas de Cribado Formal

El **MoCA** (Montreal Cognitive Assessment) es actualmente la herramienta más recomendada para cribado temprano: es más sensible que el MMSE para detectar deterioro leve y disfunción ejecutiva. El **MMSE** (Mini-Mental State Examination) sigue siendo ampliamente usado y útil, aunque menos sensible a los estadios más tempranos. Ninguna de las dos reemplaza una evaluación neuropsicológica completa; son instrumentos de cribado, no de diagnóstico definitivo.

### 3. Descartar Causas Reversibles Antes de Asumir Progresión

Antes de asumir un curso neurodegenerativo, es clave descartar causas potencialmente reversibles: deficiencias vitamínicas, alteraciones tiroideas, apnea del sueño, efectos de medicación, y muy especialmente depresión en adultos mayores, que puede simular un cuadro cognitivo ("seudodemencia depresiva") y mejorar sustancialmente con tratamiento antidepresivo.

### 4. Por Qué la Detección Temprana Importa

En el trastorno neurocognitivo leve, iniciar seguimiento, ajustar factores de riesgo cardiovascular, tratar causas reversibles y establecer estrategias compensatorias tiene impacto real sobre la trayectoria — a diferencia de la creencia extendida de que "no hay nada que hacer" hasta que aparece una demencia franca.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";

INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto")
VALUES ('memoria-apoyo-familiar-demencia', 'Memoria', ARRAY['Demencia', 'Cuidadores', 'CIE-11'], 'Acompañar a un familiar con demencia', 'Entender las alteraciones conductuales y cuidar a quien cuida.', '14 min', 'Acompañar a un familiar con demencia.png', 'Cuando a un familiar le diagnostican demencia, la atención suele centrarse en la memoria — pero con frecuencia son los cambios de conducta (agitación, apatía, desconfianza) los que más desgastan a la familia día a día, y los que menos se explican con claridad.', 'REGISTRO ABC PARA CONDUCTAS DIFÍCILES:

1. Antecedente: ¿qué pasaba justo antes de la conducta (ruido, cambio de rutina, hambre, dolor)?
2. Conducta: describe exactamente qué hizo o dijo, sin interpretarlo todavía.
3. Consecuencia: ¿qué pasó después? ¿Qué hiciste tú y cómo reaccionó?
4. Con varios registros, suelen aparecer patrones que permiten anticipar y prevenir, no solo reaccionar.', true, '
# Alteraciones Conductuales en la Demencia y Cuidado del Cuidador

## Fundamento Clínico

La CIE-11 distingue seis etiologías principales de demencia por código específico: Alzheimer (6D80, la más frecuente, con inicio insidioso y afectación temprana de la memoria episódica), vascular (6D81, inicio más brusco o "escalonado", ligado a eventos cerebrovasculares), cuerpos de Lewy (6D82, con fluctuaciones cognitivas marcadas y alucinaciones visuales tempranas), frontotemporal (6D83, inicio más temprano, predominio de cambios de personalidad y conducta), debida a sustancias (6D84), y debida a otras enfermedades como Parkinson, Huntington o hidrocefalia normotensiva (6D85, esta última potencialmente reversible con tratamiento quirúrgico).

A cualquiera de estas etiologías se le puede sumar el código 6D86: alteraciones conductuales o psicológicas en la demencia (agitación, psicosis, apatía, alteración del sueño). Clínicamente, estos síntomas conductuales son con frecuencia el motivo real de consulta o de crisis familiar — no el deterioro cognitivo puro, que suele ser más gradual y menos disruptivo en el día a día que un episodio de agitación o una alucinación nocturna.

## Diferenciación Diagnóstica (para orientar la respuesta del cuidador)

| Tipo de Conducta | Interpretación Habitual (Errónea) | Interpretación Clínica Más Útil |
| :--- | :--- | :--- |
| **Repetir la misma pregunta** | "No me presta atención" o "lo hace a propósito". | La información nueva no logra consolidarse en la memoria; no es intencional. |
| **Agitación al atardecer ("sundowning")** | "Está de mal humor porque sí". | Patrón conocido ligado a fatiga acumulada y cambios de luz; predecible y manejable con rutina. |
| **Desconfianza o acusaciones (ej. "me robaron")** | Conflicto personal o mala intención hacia el cuidador. | Con frecuencia, una forma de dar sentido a la propia confusión (no encuentra un objeto y concluye que se lo robaron). |
| **Rechazo a bañarse o cambiarse** | Obstinación o falta de higiene deliberada. | Puede deberse a no reconocer la necesidad, miedo al agua, o pérdida de secuencia de pasos de la tarea. |

## Protocolo de Acompañamiento

### 1. Reencuadre: la Conducta Comunica una Necesidad

La mayoría de las conductas difíciles en demencia no son "mal comportamiento" sino la única forma disponible que la persona tiene de expresar una necesidad no satisfecha (dolor, hambre, aburrimiento, sobreestimulación, miedo). El registro ABC (Antecedente-Conducta-Consecuencia) ayuda a identificar el disparador real detrás de la conducta.

### 2. No Corregir la Realidad Alterada, Validar la Emoción

Discutir o "corregir" a alguien con demencia sobre un hecho que ya no recuerda (ej. insistir en que un familiar fallecido ya no vive) suele generar angustia repetida sin ningún beneficio. Es más efectivo validar la emoción detrás de la pregunta ("lo extrañás mucho, ¿no?") que insistir en el dato objetivo.

### 3. Estructura y Rutina como Herramienta Terapéutica

Rutinas predecibles reducen la carga cognitiva de tener que decidir o anticipar constantemente, lo cual disminuye la ansiedad y, con ella, buena parte de la agitación asociada.

### 4. Cuidado del Cuidador, No Como Lujo sino Como Requisito

El desgaste del cuidador principal es un factor de riesgo tanto para su propia salud (física y mental) como para la calidad del cuidado que puede sostener en el tiempo. Buscar apoyo (grupos de familiares, respiro temporal, terapia individual) no es una opción secundaria sino parte necesaria del plan de cuidado, especialmente sostenido en el tiempo, ya que la demencia suele tener un curso progresivo de años.

### 5. Cuándo Buscar Ajuste Profesional Urgente

Agitación severa, agresividad hacia sí mismo/a o hacia otros, o alucinaciones angustiantes ameritan evaluación profesional para ajustar el manejo — a menudo son abordables con intervenciones no farmacológicas dirigidas antes de considerar medicación, y en algunos perfiles (como cuerpos de Lewy) hay sensibilidad especial a ciertos fármacos que debe documentarse con el equipo tratante.
    ')
ON CONFLICT (id) DO UPDATE SET
    categoria = EXCLUDED.categoria, etiquetas = EXCLUDED.etiquetas, titulo = EXCLUDED.titulo,
    "descripcionBreve" = EXCLUDED."descripcionBreve", "tiempoLectura" = EXCLUDED."tiempoLectura",
    "imageName" = EXCLUDED."imageName", "fundamentoClinico" = EXCLUDED."fundamentoClinico",
    "ejercicioPractico" = EXCLUDED."ejercicioPractico", es_premium = EXCLUDED.es_premium,
    "contenidoCompleto" = EXCLUDED."contenidoCompleto";
