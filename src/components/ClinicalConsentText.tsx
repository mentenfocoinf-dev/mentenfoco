// ============================================================================
// Texto del consentimiento informado CLINICO (Ley 1090/2006), versionado.
//
// Distinto del de datos (Ley 1581), que vive en PrivacyPolicyModal: ese autoriza
// tratar nombre, correo y teléfono; este consiente el PROCESO de atención
// psicológica. Ambos son obligatorios y ninguno reemplaza al otro.
//
// El texto va como constante markdown (no como JSX, a diferencia de la política
// de privacidad) porque el original vive en
// `contexto-proyecto/contenido-plataforma/legal/consentimiento-informado-clinico.md`
// y así se copia literal, sin reescribirlo a etiquetas: cuando el abogado
// devuelva la revisión, se reemplaza el bloque y se sube la versión, nada más.
//
// La nota interna del .md ("no se muestra al paciente") y el frontmatter NO se
// traen a propósito: son metadatos del repositorio, no del documento legal.
// ============================================================================
import { ContentBody } from "./ContentBody";

/**
 * Versión del consentimiento clínico. Es el número que se guarda en
 * `clinical_consents.version`: si el texto cambia, esto sube y a los pacientes
 * en proceso se les vuelve a pedir, porque nadie puede quedar consintiendo un
 * documento que ya no es el vigente.
 *
 * Entero (no fecha, como PRIVACY_POLICY_VERSION) porque la columna de la base es
 * `integer`, según la spec.
 */
export const CLINICAL_CONSENT_VERSION = 1;

export const CLINICAL_CONSENT_TITLE =
  "Consentimiento informado para el proceso de atención psicológica";

/**
 * Pendiente de revisión jurídica antes de producción (va en la fase de
 * seguridad final). Fundamentado en la Ley 1090 de 2006 y la Doctrina No. 3 de
 * Colpsic.
 */
export const CLINICAL_CONSENT_MARKDOWN = `
Antes de comenzar tu proceso en Mente en Foco, queremos que sepas con claridad en qué consiste, cuáles son
tus derechos y cómo cuidamos tu información. Tómate el tiempo de leerlo; si algo no te queda claro, puedes
preguntarle a tu profesional en cualquier momento.

## 1. En qué consiste la atención

La atención psicológica es un proceso de acompañamiento profesional orientado a tu bienestar emocional y
mental. Según lo que necesites, puede incluir valoración, orientación, psicoterapia y seguimiento. No es un
servicio de urgencias ni un reemplazo de la atención médica de emergencia.

## 2. Modalidad en línea

Tus sesiones y la comunicación con tu profesional se realizan a través de esta plataforma (videollamada,
mensajería y recursos). Para que funcione bien y sea privado, necesitas una conexión estable y un espacio
tranquilo donde puedas hablar con tranquilidad. La atención en línea ha demostrado ser eficaz para muchos
motivos de consulta, aunque algunas situaciones pueden requerir atención presencial; si es tu caso, tu
profesional te lo indicará.

## 3. Voluntariedad y tu derecho a decidir

Tu participación es completamente voluntaria. Puedes hacer preguntas, pedir aclaraciones, y **suspender o
retirarte del proceso en cualquier momento**, sin que eso afecte el respeto ni el trato que recibes. También
puedes solicitar un cambio de profesional si sientes que no hay la conexión que necesitas.

## 4. Confidencialidad y sus límites

Lo que compartes en tu proceso está protegido por el secreto profesional y por la reserva de la historia
clínica (Ley 1090 de 2006 y Resolución 1995 de 1999). Tu información no se comparte con terceros sin tu
autorización, salvo en las situaciones excepcionales que la ley contempla, principalmente:

- Cuando exista un **riesgo grave para tu vida o integridad, o para la de otras personas**. Ante un peligro
  inminente, la protección de la vida está por encima de la confidencialidad.
- Cuando una **autoridad judicial** lo requiera conforme a la ley.
- En el caso de **niñas, niños y adolescentes**, cuando su protección lo exija, informando a quienes ejercen
  su cuidado según corresponda.

Tu profesional te explicará estos límites y actuará siempre buscando tu bienestar y tu seguridad.

## 5. Manejo de tu historia clínica

Se lleva un registro clínico de tu proceso (valoraciones, evoluciones, informes), que es confidencial y se
maneja conforme a la normatividad vigente. Los documentos clínicos, una vez firmados por el profesional,
quedan protegidos e inmodificables (firma electrónica, Resolución 839 de 2017). Tienes derecho a conocer la
información que te concierne según la ley.

## 6. Beneficios y riesgos

La atención psicológica puede ayudarte a comprender lo que vives, desarrollar herramientas y mejorar tu
bienestar. Como parte del proceso, es posible que en algunos momentos aparezcan emociones difíciles o
incómodas; esto puede ser parte normal del trabajo terapéutico, y tu profesional te acompañará en ello. Los
resultados dependen de varios factores, incluida tu participación en el proceso, y no pueden garantizarse de
forma absoluta.

## 7. El profesional que te acompaña

Tu proceso está a cargo de un profesional en psicología debidamente acreditado, identificado en la
plataforma con su nombre y tarjeta profesional. Trabaja con enfoques basados en evidencia y bajo los
principios éticos de la Ley 1090 de 2006.

## 8. En caso de crisis o urgencia

Esta plataforma **no atiende urgencias ni crisis en tiempo real**. Si en algún momento tienes pensamientos
de hacerte daño o estás en una situación de riesgo, busca ayuda de inmediato: acude al servicio de urgencias
más cercano o comunícate con una línea de atención en crisis. Encuentra esos contactos en nuestra sección de
[líneas de atención en crisis](/lineas-de-crisis).

## 9. Tu aceptación

Al aceptar, confirmas que:

- Leíste y entendiste esta información.
- Tus preguntas fueron (o podrán ser) resueltas por tu profesional.
- Aceptas de forma libre y voluntaria iniciar tu proceso de atención psicológica en Mente en Foco, con los
  términos aquí descritos.

Puedes revocar este consentimiento en cualquier momento comunicándolo a tu profesional o a soporte, o desde
los ajustes de tu cuenta.
`.trim();

/**
 * Cuerpo del documento, sin contenedor. Igual que PrivacyPolicyContent: se
 * extrae aparte para que la pantalla del gate y cualquier consulta posterior
 * muestren el MISMO texto, no dos copias que se desincronizan.
 *
 * `prose-sm` y no el tamaño por defecto: es un documento legal largo dentro de
 * un panel con scroll, y el cuerpo grande de los artículos lo volvía interminable.
 */
export function ClinicalConsentContent() {
  return (
    <ContentBody
      markdown={CLINICAL_CONSENT_MARKDOWN}
      className="prose-sm prose-headings:text-sm prose-headings:mt-5 prose-headings:mb-1.5 prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs prose-li:leading-relaxed prose-a:font-semibold"
    />
  );
}
