import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AuthProvider } from "../hooks/useAuth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mente en Foco — Salud Mental con Propósito" },
      {
        name: "description",
        content:
          "Centro de salud mental: asesoramiento, guías, membresía y acompañamiento para padres.",
      },
      { name: "author", content: "Mente en Foco" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Mente en Foco — Salud Mental Integral" },
      {
        property: "og:description",
        content:
          "Centro de salud mental: asesoramiento, guías, membresía y acompañamiento para padres.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/BANNER.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/BANNER.jpg" },
    ],
    links: [
      { rel: "icon", href: "/GOLO.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const navItems = [
  { to: "/" as const, label: "Inicio" },
  { to: "/asesoramiento" as const, label: "Asesoramiento" },
  { to: "/guia" as const, label: "Guías" },
  { to: "/membresia" as const, label: "Membresía" },
  { to: "/sobre-nosotros" as const, label: "Nosotros" },
  { to: "/contactanos" as const, label: "Contáctanos" },
  { to: "/ingresa" as const, label: "Ingresa" },
];

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/GOLO.png" alt="Mente en Foco" className="h-9 w-auto object-contain" />
          <span className="text-lg font-semibold text-primary font-sans">Mente en Foco</span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              activeProps={{
                className:
                  "rounded-md px-3 py-2 text-sm font-semibold text-primary bg-primary-soft",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA desktop + botón hamburguesa móvil */}
        <div className="flex items-center gap-3">
          <Link
            to="/contactanos"
            className="hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:inline-flex"
          >
            Agendar cita
          </Link>
          <button
            className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-primary hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileOpen && (
        <nav
          id="mobile-menu"
          className="lg:hidden border-t border-border bg-background/95 backdrop-blur animate-in slide-in-from-top-2 duration-200"
          aria-label="Menú móvil"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                activeProps={{
                  className: "rounded-lg px-4 py-3 text-sm font-semibold text-primary bg-primary-soft",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/contactanos"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition-colors"
            >
              Agendar cita
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="/GOLO.png"
              alt="Mente en Foco"
              className="h-9 w-auto object-contain bg-background rounded-md p-1"
            />
            <span className="text-lg font-semibold">Mente en Foco</span>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/70">
            Cuidamos tu bienestar emocional con un enfoque humano y profesional.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Servicios</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><Link to="/asesoramiento">Asesoramiento</Link></li>
            <li><Link to="/guia">Guías</Link></li>
            <li><Link to="/membresia">Membresía</Link></li>
            <li><Link to="/ingresa">Portal de Usuarios</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Empresa</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><Link to="/sobre-nosotros">Sobre nosotros</Link></li>
            <li><Link to="/contactanos">Contáctanos</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Contacto</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li>mentenfocoinf@gmail.com</li>
            <li>3186546057</li>
            <li>Lun – Vie · 9:00 – 19:00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 px-4 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Mente en Foco. Todos los derechos reservados.
      </div>
    </footer>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
