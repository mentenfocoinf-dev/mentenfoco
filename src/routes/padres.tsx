import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/padres")({
  head: () => ({
    meta: [
      { title: "Portal Padres — Mente Sana" },
      { name: "description", content: "Accede a los resultados de las pruebas de tu hijo/a y recomendaciones profesionales." },
      { property: "og:title", content: "Portal Padres — Mente Sana" },
      { property: "og:description", content: "Resultados, evolución y recomendaciones del tratamiento de tu hijo/a." },
    ],
  }),
  component: Padres,
});

const reports = [
  { date: "12/03/2025", test: "Evaluación cognitiva WISC-V", status: "Completado", score: "Promedio alto" },
  { date: "28/02/2025", test: "Test de atención D2", status: "Completado", score: "Dentro de la media" },
  { date: "15/02/2025", test: "Escala de ansiedad infantil", status: "Completado", score: "Leve" },
];

const recommendations = [
  { title: "Sesión de seguimiento", date: "Próx. 25 abr", icon: "📅" },
  { title: "Ejercicios de motricidad fina", date: "Diario · 15 min", icon: "✏️" },
  { title: "Lectura compartida", date: "3 veces por semana", icon: "📖" },
  { title: "Rutina de sueño estable", date: "Acostarse 21:30h", icon: "🌙" },
];

function Padres() {
  const [logged, setLogged] = useState(false);

  if (!logged) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-16 md:px-6">
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-2xl">
              👨‍👩‍👧
            </div>
            <h1 className="mt-4 text-2xl font-bold text-primary">Portal de padres</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Accede a resultados de pruebas y recomendaciones del tratamiento de tu hijo/a.
            </p>
          </div>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setLogged(true);
            }}
          >
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                placeholder="tu@email.com"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ingresar
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ¿No tienes cuenta? Solicítala con tu psicólogo asignado.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="gradient-soft">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bienvenida</p>
              <h1 className="text-3xl font-bold text-primary">Familia García</h1>
              <p className="mt-1 text-sm text-muted-foreground">Paciente: Lucas, 8 años · Psic. María Torres</p>
            </div>
            <button
              onClick={() => setLogged(false)}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Salir
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-primary">Resultados de pruebas</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Prueba</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.test} className="border-t border-border">
                      <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3 font-medium">{r.test}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                          {r.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs font-medium text-primary hover:underline">Ver informe</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-primary">Recomendaciones</h2>
            <div className="mt-4 space-y-3">
              {recommendations.map((r) => (
                <div key={r.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="text-xl">{r.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
