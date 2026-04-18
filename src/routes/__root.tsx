import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

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
      { title: "Mente en Foco — Salud Mental Integral" },
      { name: "description", content: "Centro de salud mental: asesoramiento, guías, membresía y acompañamiento para padres." },
      { name: "author", content: "Mente en Foco" },
      { property: "og:title", content: "Mente en Foco — Salud Mental Integral" },
      { property: "og:description", content: "Centro de salud mental: asesoramiento, guías, membresía y acompañamiento para padres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
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
  { to: "/guia" as const, label: "Guía" },
  { to: "/membresia" as const, label: "Membresía" },
  { to: "/padres" as const, label: "Padres" },
  { to: "/sobre-nosotros" as const, label: "Sobre nosotros" },
  { to: "/contactanos" as const, label: "Contáctanos" },
];

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
            M
          </div>
          <span className="text-lg font-semibold text-primary font-sans">Mente en Foco</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              activeProps={{ className: "rounded-md px-3 py-2 text-sm font-semibold text-primary bg-primary-soft" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/contactanos"
          className="hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:inline-flex"
        >
          Agendar cita
        </Link>
      </div>
      <nav className="gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden items-start justify-center flex flex-row border-none shadow-xl rounded-none">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
            activeProps={{ className: "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-primary bg-primary-soft" }}
            activeOptions={{ exact: item.to === "/" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-primary font-bold">
              M
            </div>
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
            <li><Link to="/padres">Portal padres</Link></li>
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
            <li>contacto@mentesana.com</li>
            <li>+34 900 123 456</li>
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
