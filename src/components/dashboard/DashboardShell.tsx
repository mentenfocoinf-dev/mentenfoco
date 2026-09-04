// ============================================================================
// Layout INTERNO del área autenticada (patrón Selia), reutilizable por los 3
// roles (paciente / terapeuta / admin).
//
// IMPORTANTE — arquitectura: este componente NO es un app-shell de pantalla
// completa. Es un bloque acotado que se compone DENTRO de <main>, entre la
// Navbar y el Footer institucionales (que permanecen en todas las rutas, ver
// __root.tsx). El sidebar estilo Selia vive solo dentro del área central del
// dashboard; nunca reemplaza la estructura global del sitio.
//
// En desktop: sidebar como tarjeta sticky a la izquierda + contenido a la
// derecha. En móvil: navegación en píldoras horizontales sobre el contenido.
// ============================================================================
import { LogOut, type LucideIcon } from "lucide-react";

export interface ShellNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface DashboardShellProps {
  /** Secciones principales de navegación. */
  nav: ShellNavItem[];
  /** Secciones del bloque inferior (ej. Ajustes, Ayuda). Opcional. */
  bottomNav?: ShellNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  /** Nombre y subtítulo (plan/rol) mostrados en el pie del sidebar. */
  userName: string;
  userSubtitle?: string;
  /** Título de la sección activa (cabecera del área de contenido). */
  title: string;
  /** Acciones a la derecha de la cabecera de contenido (ej. chip de plan). */
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
  const allNav = [...nav, ...bottomNav];

  function SidebarButton({ item }: { item: ShellNavItem }) {
    const Icon = item.icon;
    const isActive = active === item.key;
    return (
      <button
        onClick={() => onNavigate(item.key)}
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

  function MobilePill({ item }: { item: ShellNavItem }) {
    const Icon = item.icon;
    const isActive = active === item.key;
    return (
      <button
        onClick={() => onNavigate(item.key)}
        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "glass border border-white/40 text-foreground hover:border-primary/50"
        }`}
      >
        <Icon size={15} strokeWidth={1.75} />
        {item.label}
        {item.badge != null && item.badge > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="page-fade-in mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Navegación en píldoras (móvil) */}
      <div className="mb-5 -mx-4 overflow-x-auto px-4 pb-1 hide-scrollbar lg:hidden">
        <div className="flex w-max gap-2">
          {allNav.map((item) => (
            <MobilePill key={item.key} item={item} />
          ))}
          <button
            onClick={onLogout}
            className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
          >
            <LogOut size={15} /> Salir
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:items-start lg:gap-8">
        {/* Sidebar (desktop) — tarjeta sticky bajo la navbar institucional */}
        <aside className="sticky top-20 hidden lg:block">
          <div className="rounded-3xl bg-primary p-3 shadow-lg">
            <nav className="space-y-1">
              {nav.map((item) => (
                <SidebarButton key={item.key} item={item} />
              ))}
            </nav>

            {bottomNav.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                {bottomNav.map((item) => (
                  <SidebarButton key={item.key} item={item} />
                ))}
              </div>
            )}

            <div className="mt-2 border-t border-white/10 pt-3">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-primary-foreground">
                  {userName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary-foreground">
                    {userName}
                  </p>
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
        </aside>

        {/* Área de contenido */}
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-primary drop-shadow-sm">{title}</h2>
            {topbarRight}
          </div>
          <div className="min-h-[50vh]">{children}</div>
        </div>
      </div>
    </section>
  );
}
