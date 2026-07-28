import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
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

// Ítems de cada menú agrupado. `soon` marca lo que aún no tiene página real:
// se muestra como "Próximamente" deshabilitado, nunca como enlace roto.
interface MenuItem {
  to: string;
  params?: Record<string, string>;
  label: string;
  soon?: boolean;
}

const SERVICIOS_MENU: MenuItem[] = [
  { to: "/servicios/$slug", params: { slug: "psicologia-clinica" }, label: "Psicología Clínica" },
  { to: "/servicios/$slug", params: { slug: "neuropsicologia" }, label: "Neuropsicología" },
  { to: "/servicios/$slug", params: { slug: "psiquiatria" }, label: "Psiquiatría" },
  { to: "/servicios/$slug", params: { slug: "fonoaudiologia" }, label: "Fonoaudiología" },
  { to: "/servicios/$slug", params: { slug: "terapia-pareja" }, label: "Terapia de Pareja" },
  {
    to: "/servicios/$slug",
    params: { slug: "orientacion-padres" },
    label: "Orientación para Padres",
  },
];

const RECURSOS_MENU: MenuItem[] = [
  { to: "/contenido", label: "Contenido" },
  { to: "/guia", label: "Guías de bienestar" },
  { to: "/blog", label: "Blog y artículos" },
  { to: "/faq", label: "Preguntas frecuentes" },
  { to: "/lineas-de-crisis", label: "Líneas de crisis" },
];

// Enlaces directos (sin submenú)
const DIRECT_LINKS: { to: string; label: string }[] = [
  { to: "/asesoramiento", label: "Planes" },
  { to: "/sobre-nosotros", label: "Nosotros" },
  { to: "/empresas", label: "Empresas" },
  { to: "/ingresa", label: "Ingresa" },
];

// Menú desplegable de escritorio: abre por click, cierra al hacer click fuera.
function NavDropdown({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-2xl border border-white/50 glass bg-white/80 p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
          {items.map((item) =>
            item.soon ? (
              <span
                key={item.label}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                  Pronto
                </span>
              </span>
            ) : (
              <Link
                key={item.label}
                // @ts-ignore - rutas dinámicas con params se resuelven en runtime
                to={item.to}
                // @ts-ignore
                params={item.params}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/5 hover:text-primary"
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

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
          <NavDropdown label="Servicios" items={SERVICIOS_MENU} />
          <NavDropdown label="Recursos" items={RECURSOS_MENU} />
          {DIRECT_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              activeProps={{
                className:
                  "rounded-md px-3 py-2 text-sm font-semibold text-primary bg-primary-soft",
              }}
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

      {/* Menú móvil desplegable — grupos como secciones */}
      {mobileOpen && (
        <nav
          id="mobile-menu"
          className="lg:hidden border-t border-border bg-background/95 backdrop-blur animate-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto"
          aria-label="Menú móvil"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            <MobileGroup title="Servicios" items={SERVICIOS_MENU} onNavigate={() => setMobileOpen(false)} />
            <MobileGroup title="Recursos" items={RECURSOS_MENU} onNavigate={() => setMobileOpen(false)} />
            {DIRECT_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
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

function MobileGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: MenuItem[];
  onNavigate: () => void;
}) {
  return (
    <div className="border-b border-border/50 pb-1 mb-1">
      <p className="px-4 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-primary/60">
        {title}
      </p>
      {items.map((item) =>
        item.soon ? (
          <span
            key={item.label}
            className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm text-slate-400"
          >
            {item.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold">Pronto</span>
          </span>
        ) : (
          <Link
            key={item.label}
            // @ts-ignore - rutas dinámicas con params se resuelven en runtime
            to={item.to}
            // @ts-ignore
            params={item.params}
            onClick={onNavigate}
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
          >
            {item.label}
          </Link>
        ),
      )}
    </div>
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
            <li>
              <Link to="/servicios/$slug" params={{ slug: "psicologia-clinica" }}>
                Psicología Clínica
              </Link>
            </li>
            <li>
              <Link to="/servicios/$slug" params={{ slug: "neuropsicologia" }}>
                Neuropsicología
              </Link>
            </li>
            <li>
              <Link to="/servicios/$slug" params={{ slug: "psiquiatria" }}>
                Psiquiatría
              </Link>
            </li>
            <li><Link to="/asesoramiento">Planes</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Recursos</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><Link to="/guia">Guías</Link></li>
            <li><Link to="/faq">Preguntas frecuentes</Link></li>
            <li><Link to="/lineas-de-crisis">Líneas de crisis</Link></li>
            <li><Link to="/empresas">Empresas</Link></li>
            <li><Link to="/sobre-nosotros">Sobre nosotros</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Contacto</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li>mentenfocoinf@gmail.com</li>
            <li>3186546057</li>
            <li>Lun – Vie · 9:00 – 19:00</li>
            <li className="pt-1">
              <Link to="/contactanos" className="font-semibold underline">
                Agendar cita
              </Link>
            </li>
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
  // La Navbar y el Footer institucionales permanecen en TODAS las rutas, también
  // en las autenticadas: Mente en Foco es una plataforma clínica con identidad
  // institucional permanente. El sidebar del dashboard vive dentro de <main>,
  // como layout interno del área autenticada (ver DashboardShell).
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
