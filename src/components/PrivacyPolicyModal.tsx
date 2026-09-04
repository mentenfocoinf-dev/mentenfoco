// ============================================================================
// Política de tratamiento de datos personales.
//
// Se abre desde el checkbox del SignupModal. Cubre los deberes de información
// sobre responsable, finalidades, base legal, conservación, encargados,
// transferencias internacionales y derechos del titular.
//
// ALCANCE: cubre ÚNICAMENTE los datos de contacto recogidos en el registro de
// la cuenta gratuita (nombre, correo, teléfono). Los datos de salud del proceso
// terapéutico son datos sensibles y requieren un consentimiento informado
// propio y separado, que no se otorga aquí.
//
// Redactado como borrador de trabajo: debe ser revisado por un profesional
// jurídico antes del lanzamiento público.
//
// TIPOGRAFÍA: texto legal en cuerpo pequeño y continuo, sin listas, siguiendo
// la convención de letra menuda de las plataformas de manejo de datos.
// ============================================================================
import { ShieldCheck, X } from "lucide-react";

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

/** Versión del texto legal. NO se muestra en pantalla: existe para que
 *  profiles.terms_version deje constancia de qué texto aceptó cada titular.
 *  Debe coincidir con TERMS_VERSION de la Edge Function public-signup. */
export const PRIVACY_POLICY_VERSION = "2026-07-21-v3";

const RESPONSIBLE_EMAIL = "mentenfocoinf@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
      <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-slate-500">{children}</div>
    </section>
  );
}

/**
 * Cuerpo del documento, sin contenedor. Se extrae aparte para que la pantalla
 * de consentimiento post-OAuth (/consentimiento) muestre exactamente el mismo
 * texto que el modal del registro, sin duplicarlo en dos sitios.
 */
export function PrivacyPolicyContent() {
  return (
    <>
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
        Este documento describe cómo Mente en Foco recoge, usa y protege los datos personales que el
        Titular entrega al crear una cuenta gratuita.{" "}
        <span className="font-semibold text-slate-700">
          Mente en Foco aplica un mismo estándar de protección a todos sus usuarios, con
          independencia de su país de residencia
        </span>
        : los derechos, plazos y garantías descritos aquí se reconocen a cualquier Titular, tomando
        como referencia el nivel de protección del Reglamento (UE) 2016/679 (RGPD), hoy el más
        exigente en la materia.
      </p>

      <Section title="1. Responsable del tratamiento">
        <p>
          <span className="font-semibold text-slate-700">Mente en Foco</span> es el responsable del
          tratamiento de los datos personales descritos en esta política. Es un servicio
          íntegramente digital: no atiende al público en establecimientos físicos y toda la relación
          con el Titular, incluido el ejercicio de sus derechos, se gestiona por medios
          electrónicos. El canal oficial de atención es{" "}
          <a href={`mailto:${RESPONSIBLE_EMAIL}`} className="text-primary hover:underline">
            {RESPONSIBLE_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Datos que se recogen en este registro">
        <p>
          Al crear una cuenta gratuita se recogen únicamente datos de contacto: nombre completo,
          correo electrónico y teléfono, este último de carácter opcional.
        </p>
        <p>
          <span className="font-semibold text-slate-700">
            Esta autorización no cubre datos de salud.
          </span>{" "}
          La información clínica que pueda generarse dentro de un proceso terapéutico, como
          evaluaciones, historia clínica o diagnósticos, constituye un dato sensible de categoría
          especial y requiere un consentimiento informado independiente, específico y otorgado por
          separado. La cuenta gratuita no da acceso a servicios clínicos ni genera información de
          esta naturaleza.
        </p>
      </Section>

      <Section title="3. Finalidades del tratamiento">
        <p>
          Los datos se tratan para crear, identificar y administrar la cuenta gratuita del Titular;
          enviar las credenciales de acceso y las comunicaciones operativas propias de la cuenta;
          dar acceso al contenido de bienestar de cortesía disponible para esta cuenta; y atender
          solicitudes, consultas y reclamos del Titular. Únicamente si el Titular lo autoriza de
          forma separada, los datos se emplean además para enviar información comercial, novedades y
          contenido promocional sobre los servicios de Mente en Foco.
        </p>
        <p>
          Los datos no se utilizan para decisiones automatizadas que produzcan efectos jurídicos
          sobre el Titular ni para elaboración de perfiles.
        </p>
      </Section>

      <Section title="4. Base legal">
        <p>
          El tratamiento se fundamenta en la autorización previa, expresa e informada del Titular.
          No se trata ningún dato sin que el Titular la haya otorgado. La autorización para
          comunicaciones comerciales es independiente y voluntaria: negarla no impide crear la
          cuenta ni acceder al contenido gratuito, y puede revocarse en cualquier momento sin que
          ello afecte la licitud del tratamiento realizado antes de la revocatoria.
        </p>
      </Section>

      <Section title="5. Conservación de los datos">
        <p>
          Los datos se conservan mientras la cuenta permanezca activa. Si el Titular solicita la
          supresión de sus datos o la eliminación de su cuenta, estos se suprimen dentro de los
          plazos legales aplicables, salvo que exista un deber legal de conservación que obligue a
          mantenerlos por un período mayor.
        </p>
      </Section>

      <Section title="6. Encargados del tratamiento y transferencias internacionales">
        <p>
          Para operar la plataforma, Mente en Foco se apoya en proveedores tecnológicos que actúan
          como encargados del tratamiento y que tratan los datos siguiendo sus instrucciones:
          Supabase, para el alojamiento de la base de datos y el servicio de autenticación, y
          Resend, para el envío de los correos transaccionales de la cuenta.
        </p>
        <p>
          La infraestructura de estos proveedores se encuentra ubicada en Estados Unidos, por lo que
          el tratamiento implica una transferencia internacional de datos, que el Titular consiente
          al otorgar su autorización. Ambos proveedores son operadores de alcance internacional
          sujetos a compromisos contractuales de protección de datos.
        </p>
      </Section>

      <Section title="7. Derechos del Titular">
        <p>
          Todo Titular, con independencia de su país de residencia, tiene derecho a conocer,
          actualizar y rectificar sus datos personales; solicitar prueba de la autorización
          otorgada; ser informado sobre el uso que se ha dado a sus datos; acceder de forma gratuita
          a ellos; revocar la autorización y solicitar su supresión, cuando no exista un deber legal
          o contractual que lo impida; solicitar la limitación del tratamiento y oponerse a él;
          solicitar la portabilidad de sus datos, recibiéndolos en un formato estructurado y de uso
          común; y presentar quejas ante la autoridad de protección de datos de su país de
          residencia.
        </p>
      </Section>

      <Section title="8. Cómo ejercer estos derechos">
        <p>
          El Titular puede ejercer cualquiera de estos derechos escribiendo a{" "}
          <a href={`mailto:${RESPONSIBLE_EMAIL}`} className="text-primary hover:underline">
            {RESPONSIBLE_EMAIL}
          </a>
          , indicando su nombre, el derecho que desea ejercer y los datos de contacto asociados a su
          cuenta. Toda solicitud se responde en un plazo máximo de diez días hábiles. Cuando la
          complejidad de la solicitud lo exija, el plazo puede prorrogarse informando previamente al
          Titular; en ningún caso la respuesta excede el mes siguiente a la recepción de la
          solicitud. La suscripción a comunicaciones comerciales puede cancelarse en cualquier
          momento escribiendo al mismo contacto.
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
          Mente en Foco adopta medidas técnicas y organizativas razonables para proteger los datos
          personales frente a accesos no autorizados, pérdida, alteración o divulgación, incluyendo
          cifrado en tránsito y control de acceso por autenticación.
        </p>
      </Section>

      <Section title="11. Marco normativo">
        <p>
          Esta política toma como referencia el Reglamento (UE) 2016/679 (RGPD) y se ajusta a la
          normativa de protección de datos aplicable a la operación de Mente en Foco, incluidas la
          Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia. Los derechos y garantías descritos
          se reconocen a todos los Titulares por igual, sin que su país de residencia suponga un
          nivel de protección menor.
        </p>
      </Section>

      <Section title="12. Vigencia y cambios">
        <p>
          Esta política rige desde su publicación. Cualquier modificación material será informada al
          Titular por el correo asociado a su cuenta antes de su entrada en vigor.
        </p>
      </Section>
    </>
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
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 id="privacy-title" className="text-base font-bold text-slate-900">
                Política de tratamiento de datos personales
              </h2>
              <p className="text-xs text-slate-400">Registro de cuenta gratuita</p>
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <PrivacyPolicyContent />
        </div>

        <div className="border-t border-slate-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
