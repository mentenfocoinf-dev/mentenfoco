// ============================================================================
// "Notificaciones (3)".
//
// Sin nada que avisar no se dibuja: un contador en cero es ruido, y para un
// visitante anónimo la cuenta siempre es cero porque la función de la base
// filtra por sesión.
//
// Sin polling. Se pregunta al montar; si hace falta refrescarlo tras una
// acción, quien la haga vuelve a montar la pantalla.
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { getUnreadCount } from "../lib/api/notificationService";

export function NotificacionesBadge({ className }: { className?: string }) {
  const [sinLeer, setSinLeer] = useState(0);

  useEffect(() => {
    let vigente = true;
    void getUnreadCount().then((n) => {
      if (vigente) setSinLeer(n);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (sinLeer === 0) return null;

  return (
    <Link
      to="/notificaciones"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
      }
    >
      <Bell size={14} /> Notificaciones ({sinLeer})
    </Link>
  );
}
