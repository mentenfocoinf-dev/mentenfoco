// ============================================================================
// Botones de acceso con proveedores externos.
//
// Los logotipos van como SVG en línea: lucide-react ya no distribuye iconos de
// marca, y cargarlos desde un CDN rompería el aislamiento del bundle.
// ============================================================================
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signInWithProvider, type OAuthProvider } from "../lib/api";

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
  disabled?: boolean;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.71-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.540-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.18a6.9 6.9 0 0 1 0-4.36V6.84H1.7a11.51 11.51 0 0 0 0 10.32l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.08c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.63 15.1.5 12 .5A11.5 11.5 0 0 0 1.7 6.84l3.85 2.98C6.46 7.1 9 5.08 12 5.08Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z"
      />
    </svg>
  );
}

const PROVIDERS: { id: OAuthProvider; label: string; icon: () => React.ReactElement }[] = [
  { id: "google", label: "Google", icon: GoogleIcon },
  { id: "facebook", label: "Facebook", icon: FacebookIcon },
];

export function SocialAuthButtons({ onError, disabled }: SocialAuthButtonsProps) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  async function handleClick(provider: OAuthProvider) {
    setPending(provider);
    onError("");
    try {
      // En caso de éxito el navegador sale hacia el proveedor, así que no hay
      // estado que limpiar: solo se vuelve aquí si la redirección no ocurrió.
      await signInWithProvider(provider);
    } catch (err) {
      onError(err instanceof Error ? err.message : "No pudimos conectar con el proveedor.");
      setPending(null);
    }
  }

  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">o continúa con</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            disabled={disabled || pending !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === id ? <Loader2 size={16} className="animate-spin" /> : <Icon />}
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
