// ============================================================================
// Shell de dashboard con barra lateral (patrón Selia), reutilizable por los 3
// roles (paciente / terapeuta / admin). Recibe la lista de secciones y llama a
// onNavigate; el contenido de la sección activa va como children.
//
// Estructura: barra lateral fija a la izquierda (logo, navegación con
// icono+etiqueta y activo resaltado, bloque inferior de ajustes/ayuda/salir) +
// barra superior (título de sección + acciones) + área de contenido con scroll.
// En móvil la barra lateral se colapsa en un cajón desplegable.
// ============================================================================
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Menu, X, ExternalLink, type LucideIcon } from "lucide-react";

export interface ShellNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface DashboardShellProps {
  /** Secciones principales de navegación. */
  nav: ShellNavItem[];
  /** Secciones del bloque inferior (ej. Ajustes). Opcional. */
  bottomNav?: ShellNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  /** Nombre y subtítulo (plan/rol) mostrados en el pie de la barra lateral. */
  userName: string;
  userSubtitle?: string;
  /** Título de la sección activa (barra superior). */
  title: string;
  /** Acciones a la derecha de la barra superior (ej. botón de mensajes). */
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({
  nav,
  bottomNav = [],
  active,
  onNavigate,
  onLogout,
  userName,
  userSubtitle,
  title,
  topbarRight,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function NavButton({ item }: { item: ShellNavItem }) {
    const Icon = item.icon;
    const isActive = active === item.key;
    return (
      <button
        onClick={() => {
          onNavigate(item.key);
          setMobileOpen(false);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
          isActive
            ? "bg-white text-primary shadow-sm"
            : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
        }`}
      >
        <Icon size={19} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
      </button>
    );
  }

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-6">
        <img src="/GOLO.png" alt="Mente en Foco" className="h-9 w-auto rounded-md bg-white/90 p-1" />
        <span className="text-lg font-bold text-primary-foreground">Mente en Foco</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((item) => (
          <NavButton key={item.key} item={item} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        {bottomNav.map((item) => (
          <NavButton key={item.key} item={item} />
        ))}
        <Link
          to="/"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground"
        >
          <ExternalLink size={19} strokeWidth={1.75} className="shrink-0" />
          <span className="flex-1 text-left">Volver al sitio</span>
        </Link>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-primary-foreground">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary-foreground">{userName}</p>
            {userSubtitle && (
              <p className="truncate text-xs text-primary-foreground/60">{userSubtitle}</p>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground"
        >
          <LogOut size={19} strokeWidth={1.75} className="shrink-0" />
          <span className="flex-1 text-left">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Barra lateral fija (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-primary lg:block">
        {sidebarInner}
      </aside>

      {/* Cajón lateral (móvil) */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-primary lg:hidden animate-in slide-in-from-left duration-200">
            {sidebarInner}
          </aside>
        </>
      )}

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-primary hover:bg-muted lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <h1 className="flex-1 truncate text-lg font-bold text-primary">{title}</h1>
          {topbarRight}
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>

      {/* Botón de cierre del cajón móvil (accesible dentro del cajón) */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed left-[17rem] top-4 z-50 rounded-lg bg-white/90 p-2 text-primary shadow lg:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}
