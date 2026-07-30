// ============================================================================
// Envíos de los tests públicos, para el admin.
//
// Es la contrapartida de haberle revocado a `anon` la lectura de esta tabla: los
// datos existen y son útiles (cuánta gente completa cada test, en qué bandas
// cae, quién dejó su correo), pero solo se miran desde aquí.
//
// La mayoría de envíos NO trae correo, y eso es lo esperado: el resultado se ve
// sin dejar nada. Por eso el filtro de "solo con correo" está apagado por
// defecto — el volumen total es el dato de captación; los correos son el extra.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Mail } from "lucide-react";
import { listTestSubmissions, type TestSubmission } from "../../lib/api";

const SLUG_LABEL: Record<string, string> = {
  "test-de-ansiedad": "Ansiedad (GAD-7)",
  "test-de-depresion": "Ánimo (PHQ-9)",
  "test-de-autoestima": "Autoestima (Rosenberg)",
};

export function TestSubmissionsPanel() {
  const [soloConEmail, setSoloConEmail] = useState(false);
  const [envios, setEnvios] = useState<TestSubmission[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    setEnvios(await listTestSubmissions(soloConEmail));
    setCargando(false);
  }, [soloConEmail]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const conEmail = envios.filter((e) => e.email).length;
  const porTest = envios.reduce<Record<string, number>>((acc, e) => {
    acc[e.test_slug] = (acc[e.test_slug] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tests públicos</h2>
            <p className="text-xs text-slate-500">
              Quién completa los cuestionarios abiertos y en qué banda cae.
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50">
          <input
            type="checkbox"
            checked={soloConEmail}
            onChange={(e) => setSoloConEmail(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Solo con correo
        </label>
      </div>

      {cargando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" size={22} />
        </div>
      ) : envios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-500">
            {soloConEmail
              ? "Todavía nadie ha dejado su correo tras un test."
              : "Todavía no hay tests completados."}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica etiqueta="Tests completados" valor={envios.length} />
            <Metrica etiqueta="Dejaron correo" valor={conEmail} />
            {Object.entries(porTest)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([slug, n]) => (
                <Metrica key={slug} etiqueta={SLUG_LABEL[slug] ?? slug} valor={n} />
              ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="p-3.5 font-bold text-slate-900">Test</th>
                  <th className="p-3.5 font-bold text-slate-900">Puntaje</th>
                  <th className="p-3.5 font-bold text-slate-900">Banda</th>
                  <th className="p-3.5 font-bold text-slate-900">Correo</th>
                  <th className="whitespace-nowrap p-3.5 font-bold text-slate-900">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="p-3.5 font-semibold text-slate-700">
                      {SLUG_LABEL[e.test_slug] ?? e.test_slug}
                    </td>
                    <td className="p-3.5 text-slate-600">{e.score ?? "—"}</td>
                    <td className="p-3.5 text-slate-600">{e.banda ?? "—"}</td>
                    <td className="p-3.5">
                      {e.email ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                          <Mail size={12} /> {e.email}
                        </span>
                      ) : (
                        <span className="text-slate-400">anónimo</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3.5 text-xs text-slate-500">
                      {new Date(e.created_at).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-bold text-primary">{valor}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{etiqueta}</p>
    </div>
  );
}
