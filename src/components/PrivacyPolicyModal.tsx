// ============================================================================
// Política de tratamiento de datos personales.
//
// Se abre desde el checkbox del SignupModal. Cubre los requisitos de aviso de
// privacidad de la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Colombia) y los
// deberes de información de los artículos 13 y 14 del RGPD (UE), para el caso
// en que un titular resida en el Espacio Económico Europeo.
//
// ALCANCE: este documento cubre ÚNICAMENTE los datos de contacto recogidos en
// el registro de la cuenta gratuita (nombre, correo, teléfono). Los datos de
// salud del proceso terapéutico son datos sensibles y requieren un
// consentimiento informado propio y separado, que no se otorga aquí.
//
// Redactado como borrador de trabajo: debe ser revisado por un profesional
// jurídico antes del lanzamiento público.
// ============================================================================
import { ShieldCheck, X } from "lucide-react";

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

/** Versión del texto legal. Debe coincidir con TERMS_VERSION de la Edge Function
 *  public-signup, que es lo que se guarda en profiles.terms_version. Si el texto
 *  cambia de forma material, ambos valores suben juntos. */
export const PRIVACY_POLICY_VERSION = "2026-07-21-v3";

const RESPONSIBLE_EMAIL = "mentenfocoinf@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 id="privacy-title" className="text-lg font-bold text-slate-900">
                Política de tratamiento de datos personales
              </h2>
              <p className="text-xs text-slate-500">
                Versión {PRIVACY_POLICY_VERSION} · Registro de cuenta gratuita
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            Este documento describe cómo Mente en Foco recoge, usa y protege los datos personales
            que el Titular entrega al crear una cuenta gratuita.{" "}
            <strong>
              Mente en Foco aplica un mismo estándar de protección a todos sus usuarios, con
              independencia de su país de residencia
            </strong>
            : los derechos, plazos y garantías descritos aquí se reconocen a cualquier Titular,
            tomando como referencia el nivel de protección del Reglamento (UE) 2016/679 (RGPD),
            hoy el más exigente en la materia.
          </p>

          <Section title="1. Responsable del tratamiento">
            <p>
              <strong>Mente en Foco</strong> es el responsable del tratamiento de los datos
              personales descritos en esta política.
            </p>
            <p>
              Mente en Foco es un servicio <strong>íntegramente digital</strong>: no atiende al
              público en establecimientos físicos y toda la relación con el Titular —incluido el
              ejercicio de sus derechos— se gestiona por medios electrónicos. El canal oficial de
              atención es:{" "}
              <a href={`mailto:${RESPONSIBLE_EMAIL}`} className="text-primary hover:underline">
                {RESPONSIBLE_EMAIL}
              </a>
            </p>
          </Section>

          <Section title="2. Datos que se recogen en este registro">
            <p>
              Al crear una cuenta gratuita se recogen únicamente datos de contacto:{" "}
              <strong>nombre completo, correo electrónico y teléfono</strong> (este último,
              opcional).
            </p>
            <p>
              <strong>Esta autorización no cubre datos de salud.</strong> La información clínica que
              pueda generarse dentro de un proceso terapéutico —evaluaciones, historia clínica,
              diagnósticos— constituye un dato sensible de categoría especial y requiere un
              consentimiento informado independiente, específico y otorgado por separado. La cuenta
              gratuita no da acceso a servicios clínicos ni genera información de esta naturaleza.
            </p>
          </Section>

          <Section title="3. Finalidades del tratamiento">
            <p>Los datos se tratan para las siguientes finalidades:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Crear, identificar y administrar la cuenta gratuita del Titular.</li>
              <li>Enviar las credenciales de acceso y comunicaciones operativas de la cuenta.</li>
              <li>Dar acceso al contenido de bienestar de cortesía disponible para esta cuenta.</li>
              <li>Atender solicitudes, consultas y reclamos del Titular.</li>
              <li>
                Únicamente si el Titular lo autoriza de forma separada, enviar información
                comercial, novedades y contenido promocional sobre los servicios de Mente en Foco.
              </li>
            </ul>
            <p>
              Los datos no se utilizan para decisiones automatizadas que produzcan efectos jurídicos
              sobre el Titular ni para elaboración de perfiles.
            </p>
          </Section>

          <Section title="4. Base legal">
            <p>
              El tratamiento se fundamenta en la{" "}
              <strong>autorización previa, expresa e informada</strong> del Titular. No se trata
              ningún dato sin que el Titular la haya otorgado.
            </p>
            <p>
              La autorización para comunicaciones comerciales es{" "}
              <strong>independiente y voluntaria</strong>: negarla no impide crear la cuenta ni
              acceder al contenido gratuito, y puede revocarse en cualquier momento sin que ello
              afecte la licitud del tratamiento realizado antes de la revocatoria.
            </p>
          </Section>

          <Section title="5. Conservación de los datos">
            <p>
              Los datos se conservan mientras la cuenta permanezca activa. Si el Titular solicita la
              supresión de sus datos o la eliminación de su cuenta, estos se suprimen dentro de los
              plazos legales aplicables, salvo que exista un deber legal de conservación que obligue
              a mantenerlos por un período mayor.
            </p>
          </Section>

          <Section title="6. Encargados del tratamiento y transferencias internacionales">
            <p>
              Para operar la plataforma, Mente en Foco se apoya en proveedores tecnológicos que
              actúan como encargados del tratamiento y que tratan los datos siguiendo sus
              instrucciones:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Supabase</strong> — alojamiento de la base de datos y servicio de
                autenticación.
              </li>
              <li>
                <strong>Resend</strong> — envío de los correos transaccionales de la cuenta.
              </li>
            </ul>
            <p>
              La infraestructura de estos proveedores se encuentra ubicada en{" "}
              <strong>Estados Unidos</strong>, por lo que el tratamiento implica una transferencia
              internacional de datos, que el Titular consiente al otorgar su autorización. Ambos
              proveedores son operadores de alcance internacional sujetos a compromisos
              contractuales de protección de datos.
            </p>
          </Section>

          <Section title="7. Derechos del Titular">
            <p>
              Todo Titular, con independencia de su país de residencia, tiene derecho a:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Conocer, actualizar y rectificar sus datos personales.</li>
              <li>Solicitar prueba de la autorización otorgada.</li>
              <li>Ser informado sobre el uso que se ha dado a sus datos.</li>
              <li>Acceder de forma gratuita a sus datos personales.</li>
              <li>
                Revocar la autorización y solicitar la supresión de sus datos, cuando no exista un
                deber legal o contractual que lo impida.
              </li>
              <li>Solicitar la limitación del tratamiento y oponerse a él.</li>
              <li>
                Solicitar la portabilidad de sus datos, recibiéndolos en un formato estructurado y
                de uso común.
              </li>
              <li>
                Presentar quejas ante la autoridad de protección de datos de su país de residencia.
              </li>
            </ul>
          </Section>

          <Section title="8. Cómo ejercer estos derechos">
            <p>
              El Titular puede ejercer cualquiera de estos derechos escribiendo a{" "}
              <a href={`mailto:${RESPONSIBLE_EMAIL}`} className="text-primary hover:underline">
                {RESPONSIBLE_EMAIL}
              </a>
              , indicando su nombre, el derecho que desea ejercer y los datos de contacto asociados
              a su cuenta.
            </p>
            <p>
              Toda solicitud se responde en un plazo máximo de{" "}
              <strong>diez (10) días hábiles</strong>. Cuando la complejidad de la solicitud lo
              exija, el plazo puede prorrogarse informando previamente al Titular; en ningún caso la
              respuesta excede el mes siguiente a la recepción de la solicitud.
            </p>
            <p>
              La suscripción a comunicaciones comerciales puede cancelarse en cualquier momento
              escribiendo al mismo contacto.
            </p>
          </Section>

          <Section title="9. Menores de edad">
            <p>
              La cuenta gratuita está dirigida a personas mayores de edad. El registro de un menor
              requiere la autorización de su representante legal y atiende siempre a su interés
              superior. Responder preguntas relativas a datos de menores tiene carácter facultativo.
            </p>
          </Section>

          <Section title="10. Seguridad de la información">
            <p>
              Mente en Foco adopta medidas técnicas y organizativas razonables para proteger los
              datos personales frente a accesos no autorizados, pérdida, alteración o divulgación,
              incluyendo cifrado en tránsito y control de acceso por autenticación.
            </p>
          </Section>

          <Section title="11. Marco normativo">
            <p>
              Esta política toma como referencia el Reglamento (UE) 2016/679 (RGPD) y se ajusta a la
              normativa de protección de datos aplicable a la operación de Mente en Foco, incluidas
              la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia. Los derechos y garantías
              descritos se reconocen a todos los Titulares por igual, sin que su país de residencia
              suponga un nivel de protección menor.
            </p>
          </Section>

          <Section title="12. Vigencia y cambios">
            <p>
              Esta política rige desde su publicación e identifica su versión en el encabezado.
              Cualquier modificación material será informada al Titular por el correo asociado a su
              cuenta antes de su entrada en vigor.
            </p>
          </Section>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
