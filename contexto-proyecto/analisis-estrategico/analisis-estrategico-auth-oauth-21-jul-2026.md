# Análisis estratégico — Autenticación, OAuth y onboarding vs. competencia

Fecha: 2026-07-21 (2ª ola). Continúa el rol de consultor estratégico: no solo documentar lo construido hoy,
sino compararlo contra Selia, Terapify y BetterHelp y proponer cómo llevarlo más allá.

## 1. Lo que se resolvió hoy es la mitad del problema

El trigger `handle_new_auth_user` (escrito, sin ejecutar aún) resuelve el "hueco de Google": que exista una
fila en `profiles` para cualquier alta en `auth.users`. Eso es necesario pero no suficiente. Un perfil con
`role=patient`, `plan_type=free`, `full_name` y nada más no es una cuenta lista para operar en una plataforma
clínica — le faltan tres cosas que ninguna de las plataformas competidoras necesita resolver con la misma
urgencia porque no operan bajo el marco regulatorio colombiano de la misma forma:

**Consentimiento de tratamiento de datos.** El trigger deja `terms_accepted_at` en NULL a propósito (correcto:
entrar con Google no es un consentimiento expreso). Pero hoy no existe ninguna pantalla que se lo pida después.
Un usuario de OAuth puede quedar navegando la plataforma indefinidamente sin haber autorizado el tratamiento de
sus datos — eso es exactamente el hueco legal que la Ley 1581 de 2012 exige cerrar, y que ya se resolvió bien
para el signup manual (modal separado y versionado) pero no para OAuth.

**Cédula y datos de facturación.** Confirmé en la normativa vigente de facturación electrónica DIAN (Resolución
Única 000227 de 2025): solo se pueden exigir tres campos al comprador — nombre/razón social, tipo y número de
identificación, y correo. Es decir, la cédula no es un capricho de formulario: es un requisito legal mínimo
para poder facturarle a un paciente que paga una sesión o un plan. Ningún competidor investigado (Selia,
Terapify, BetterHelp) publica que pida esto en el onboarding, lo cual es una oportunidad: pedirlo bien
enmarcado ("para poder facturarte correctamente cuando actives un plan pago") posiciona a Mente en Foco como
una operación clínica formal, no como una app de bienestar genérica.

**Contacto de emergencia.** Esto sí es estándar en salud mental seria (cualquier historia clínica clásica lo
pide) y es, literalmente, información de seguridad: si el sistema alguna vez necesita escalar una crisis más
allá del terapeuta asignado, hoy no hay a quién llamar. Es una laguna real de seguridad clínica, no solo de
producto.

## 2. Comparación puntual con el onboarding de los 3 competidores

Terapify y BetterHelp resuelven su onboarding con un cuestionario de afinidad de 10-15 minutos *antes* de pedir
cualquier dato de cuenta — el usuario prueba valor (ve que el sistema "lo entiende") antes de comprometerse.
Selia hace lo mismo con un test de 3 minutos antes de mostrar especialistas. Ninguno de los tres, sin embargo,
pide cédula ni contacto de emergencia en el primer contacto — eso lo piden más adelante, ya con el paciente
comprometido, o nunca (BetterHelp opera bajo un marco regulatorio distinto en EE.UU. donde esto no aplica
igual). La implicación práctica: pedir cédula/teléfono/contacto de emergencia en el *primer* login post-OAuth,
antes de cualquier otra cosa, es correcto legalmente pero puede sentirse frío comparado con la experiencia de
la competencia. Vale la pena enmarcarlo bien (explicar el "para qué" de cada campo, no solo el formulario en
blanco) para no perder la ventaja de fricción baja que da entrar con un clic de Google.

## 3. Propuesta concreta: gate de completar perfil post-OAuth

Mismo patrón que ya se usó para forzar el cambio de contraseña en el signup gratuito (`must_change_password` +
gate en `useAuth`), aplicado ahora a dos cosas distintas que un usuario de OAuth puede necesitar:

1. Si `terms_accepted_at IS NULL` → pantalla de aceptación del tratamiento de datos (reusa el componente
   `PrivacyPolicyModal` ya existente, en modo de pantalla completa en vez de modal, con un solo botón "Acepto y
   continúo").
2. Una vez aceptado, si faltan `cedula`, `phone` o `emergency_contact_*` → pantalla breve de "completa tu
   perfil" (3 campos, con la explicación de para qué sirve cada uno: facturación y seguridad).

Ambos gates deben poder saltarse para roles `admin`/`therapist` (igual que el resto de gates de `useAuth`) y
no deben interferir con el gate de `must_change_password` que ya existe para el signup manual — son casos
mutuamente excluyentes (`signup_source` distingue `web_free_signup` de `oauth`), pero conviene resolverlos en
el mismo lugar del código para que no queden dos flujos de gates divergentes.

## 4. Una idea de posicionamiento que no cuesta nada de backend

El panel izquierdo de marca del nuevo login (imagen + mensaje) hoy dice genéricamente "un lugar seguro para
cuidar tu salud mental". Selia se apoya fuerte en su prueba social (83.000 reseñas, 4.92/5) para generar
confianza en el primer contacto. La landing page de Mente en Foco ya tiene contadores de métricas (pacientes,
experiencia) según la documentación del proyecto — reusar esa misma métrica en el panel de marca del login
(algo como "acompañamos a X pacientes" o el número real cuando exista) es gratis en esfuerzo de desarrollo y
cierra una brecha de confianza real frente al competidor más fuerte del mercado local.

## Resumen accionable

Lo nuevo que se suma a la lista de pendientes de esta sesión (más allá de terminar lo que quedó a medias):
gate de consentimiento + datos post-OAuth, y la métrica de confianza en el panel de login. Ambos van
especificados con detalle de implementación en `prompt-claude-code-21-jul-2026-cierre-auth.md`.
