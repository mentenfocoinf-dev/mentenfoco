// ============================================================================
// Resultado de un test público.
//
// El orden de los bloques ES la regla clínica del proyecto, no una decisión de
// maquetación: cuando hay señal de riesgo, los recursos de crisis van ARRIBA y
// el mensaje comercial NO se muestra. Ofrecer un plan a quien acaba de marcar
// ideación suicida convierte un momento de vulnerabilidad en una oportunidad de
// venta, y eso no se hace aquí.
//
// Se activa por dos vías independientes (ver scorePublicTest): banda severa, o
// una respuesta positiva en el ítem de ideación aunque el total quede bajo. Un
// puntaje moderado con ideación presente sigue siendo riesgo.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  attachEmailToSubmission,
  recordSubmission,
  trackEvent,
  type PublicTest,
  type PublicTestResult,
} from "../../lib/api";

interface Props {
  test: PublicTest;
  resultado: PublicTestResult;
  onReiniciar: () => void;
}

export function TestResult({ test, resultado, onReiniciar }: Props) {
  const { score, banda, riesgo, riesgoPorItem } = resultado;

  // Se registra que el test se completó, sin correo y sin respuestas: es la
  // analítica de captación (cuánta gente lo hace y en qué banda cae). Si la
  // persona deja su correo después, se añade a ESTE envío en vez de crear otro.
  //
  // El guard NO es paranoia: en StrictMode React monta el componente dos veces y
  // el efecto se ejecutaba dos veces, dejando dos filas por cada test. Un flag
  // de "vigente" en el cleanup no sirve —la petición ya salió—; hace falta no
  // lanzar la segunda. El ref sobrevive al doble montaje, así que sí lo evita.
  const submissionId = useRef<string | null>(null);
  const yaRegistrado = useRef(false);
  useEffect(() => {
    if (yaRegistrado.current) return;
    yaRegistrado.current = true;
    void recordSubmission(test.slug, score, banda.etiqueta).then((id) => {
      submissionId.current = id;
    });
    // Mismo guard: el resultado se ve una vez, aunque StrictMode monte dos veces.
    trackEvent("TEST_RESULT_VIEWED", {
      test_id: test.slug,
      score,
      band: banda.etiqueta,
    });
  }, [test.slug, score, banda.etiqueta]);

  const maxPosible = test.items.reduce(
    (s, i) => s + Math.max(...i.opciones.map((o) => o.valor)),
    0,
  );

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Crisis primero, siempre que haya señal ────────────────────────── */}
      {riesgo && <BloqueCrisis porItem={riesgoPorItem} />}

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {test.instrumento} · Tu resultado
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-5xl font-bold text-primary">{score}</span>
          <span className="pb-1.5 text-sm text-muted-foreground">de {maxPosible} puntos</span>
        </div>

        <p className="mt-4 inline-block rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
          {banda.etiqueta}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Qué significa</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{banda.interpretacion}</p>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Qué puedes hacer ahora</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{banda.recomendacion}</p>
          </div>
        </div>

        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          Este resultado es una <strong className="text-slate-700">orientación</strong>, no un
          diagnóstico. Los cuestionarios de cribado señalan qué conviene mirar de cerca; el
          diagnóstico lo hace un profesional en una valoración.
        </p>

        <button
          onClick={onReiniciar}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
        >
          <RefreshCw size={14} /> Volver a responder
        </button>
      </div>

      {/* Enviarme el resultado: es utilidad para la persona, así que se ofrece
          también en riesgo. Lo que se calla ahí es la venta, no el servicio. */}
      <EnviarmeResultado
        test={test}
        score={score}
        banda={banda.etiqueta}
        submissionId={submissionId}
      />

      {/* ── Invitación: solo si NO hay señal de riesgo ────────────────────── */}
      {!riesgo && <BloqueInvitacion />}

      <p className="mt-8 text-center text-xs text-slate-400">
        No guardamos tus respuestas individuales ni las asociamos a tu identidad.
      </p>
    </div>
  );
}

function BloqueCrisis({ porItem }: { porItem: boolean }) {
  return (
    <div className="mb-6 rounded-3xl border-2 border-red-200 bg-red-50 p-6">
      <div className="flex items-center gap-2 text-red-800">
        <Phone size={20} />
        <h2 className="text-lg font-bold">Antes de seguir, queremos decirte algo</h2>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-red-800">
        {porItem
          ? "En una de tus respuestas mencionaste pensamientos de hacerte daño o de estar mejor muerto(a). Gracias por tu honestidad: eso cuesta. No tienes que sostener esto solo(a), y hay ayuda disponible ahora mismo."
          : "Tu resultado indica un malestar importante. No tienes que atravesarlo solo(a), y hay ayuda disponible ahora mismo."}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-red-800">
        Si sientes que estás en riesgo, llama al <strong>123</strong> (línea nacional de emergencias)
        o acude al servicio de urgencias más cercano. También hay líneas de atención psicológica
        gratuitas y confidenciales.
      </p>

      <Link
        to="/lineas-de-crisis"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-red-700"
      >
        Ver líneas de atención inmediata <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function BloqueInvitacion() {
  return (
    <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/5 p-8">
      <h2 className="text-lg font-bold text-primary">¿Quieres seguir tu evolución?</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Con una cuenta gratuita puedes repetir estos cuestionarios y ver cómo cambias en el tiempo,
        además de acceder a nuestra biblioteca de guías y contenido.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/ingresa"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
        >
          <UserPlus size={15} /> Crear cuenta gratis
        </Link>
        <Link
          to="/asesoramiento"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
        >
          Cómo te acompaña un especialista
        </Link>
      </div>
    </div>
  );
}

function EnviarmeResultado({
  test,
  score,
  banda,
  submissionId,
}: {
  test: PublicTest;
  score: number;
  banda: string;
  submissionId: React.RefObject<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    await attachEmailToSubmission(submissionId.current, test.slug, score, banda, email);
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <Check size={16} /> Listo, guardamos tu correo.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-700">
          Te enviaremos tu resultado en cuanto tengamos el correo de la plataforma activo. No
          compartimos tu dirección con nadie.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label htmlFor="email-resultado" className="text-sm font-bold text-slate-900">
        ¿Quieres tu resultado por correo?
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Opcional. Ya viste tu resultado completo arriba; esto es solo si quieres tenerlo a mano.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="email-resultado"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => void enviar()}
          disabled={!email.includes("@") || enviando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Enviármelo
        </button>
      </div>
    </div>
  );
}
