// ============================================================================
// Formulario del perfil profesional.
//
// Mínimo y funcional, sin diseño definitivo: casillas y campos de texto. Lo que
// importa de este sprint es que el dato exista y se pueda editar, no cómo se ve.
//
// Los vocabularios cerrados —especialidades, modalidad, población, franjas— se
// editan con casillas y no escribiendo: son enums en la base y un texto libre
// acabaría rechazado por el servidor. Los idiomas sí son texto porque no son un
// vocabulario cerrado.
//
// `verified` se muestra pero no se edita: la verificación de credenciales la
// hace el admin, y el trigger de la base rechaza cualquier otro intento.
// ============================================================================
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { THEME_KEYS, THEME_LABELS, type ThemeKey } from "../../lib/api/themes";
import {
  getTherapistProfile,
  updateTherapistProfile,
  AGE_GROUP_LABELS,
  AVAILABILITY_LABELS,
  MODALITY_LABELS,
  type AgeGroup,
  type AvailabilitySlot,
  type TherapyModality,
} from "../../lib/api/therapistService";

/** Añade o quita un valor de una lista, sin mutarla. */
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

const CASILLA = "flex items-center gap-2 text-sm text-slate-700";
const CAMPO =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary";
const ETIQUETA = "text-xs font-bold uppercase tracking-wider text-slate-500";

export function TherapistProfileForm() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const [nombre, setNombre] = useState("");
  const [licencia, setLicencia] = useState("");
  const [bio, setBio] = useState("");
  const [especialidades, setEspecialidades] = useState<ThemeKey[]>([]);
  const [idiomas, setIdiomas] = useState("");
  const [modalidades, setModalidades] = useState<TherapyModality[]>([]);
  const [poblaciones, setPoblaciones] = useState<AgeGroup[]>([]);
  const [franjas, setFranjas] = useState<AvailabilitySlot[]>([]);
  const [anios, setAnios] = useState("");
  const [activo, setActivo] = useState(true);
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    let vigente = true;
    void getTherapistProfile().then((p) => {
      if (!vigente) return;
      if (p) {
        setNombre(p.professional_name ?? "");
        setLicencia(p.license_number ?? "");
        setBio(p.bio ?? "");
        setEspecialidades(p.specializations ?? []);
        setIdiomas((p.languages ?? []).join(", "));
        setModalidades(p.modalities ?? []);
        setPoblaciones(p.age_groups ?? []);
        setFranjas(p.availability ?? []);
        setAnios(p.years_experience != null ? String(p.years_experience) : "");
        setActivo(p.active);
        setVerificado(p.verified);
      }
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (!nombre.trim()) {
      setAviso({ tipo: "error", texto: "El nombre profesional es obligatorio." });
      return;
    }

    setGuardando(true);
    try {
      await updateTherapistProfile({
        professional_name: nombre.trim(),
        license_number: licencia.trim() || null,
        bio: bio.trim() || null,
        specializations: especialidades,
        languages: idiomas
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean),
        modalities: modalidades,
        age_groups: poblaciones,
        availability: franjas,
        years_experience: anios.trim() === "" ? null : Number(anios),
        active: activo,
      });
      setAviso({ tipo: "ok", texto: "Perfil guardado." });
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo guardar el perfil.",
      });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-white/40 p-10">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  return (
    <form
      onSubmit={guardar}
      className="card-neon-hover space-y-5 rounded-3xl glass-card border border-white/40 p-6"
    >
      <div>
        <h2 className="text-lg font-bold text-primary">Perfil profesional</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Esta información es la que ven los pacientes al buscar especialista y la que usa el
          sistema para sugerirte según su motivo de consulta.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Nombre profesional</span>
          <input className={CAMPO} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Tarjeta profesional</span>
          <input className={CAMPO} value={licencia} onChange={(e) => setLicencia(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className={ETIQUETA}>Presentación</span>
        <textarea
          className={CAMPO}
          rows={3}
          maxLength={2000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>

      <fieldset>
        <legend className={ETIQUETA}>Especialidades</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {THEME_KEYS.map((t) => (
            <label key={t} className={CASILLA}>
              <input
                type="checkbox"
                checked={especialidades.includes(t)}
                onChange={() => setEspecialidades((prev) => alternar(prev, t))}
              />
              {THEME_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Idiomas</span>
          <input
            className={CAMPO}
            value={idiomas}
            placeholder="Español, Inglés"
            onChange={(e) => setIdiomas(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Años de experiencia</span>
          <input
            className={CAMPO}
            type="number"
            min={0}
            max={70}
            value={anios}
            onChange={(e) => setAnios(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <fieldset>
          <legend className={ETIQUETA}>Modalidad</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(MODALITY_LABELS) as TherapyModality[]).map((m) => (
              <label key={m} className={CASILLA}>
                <input
                  type="checkbox"
                  checked={modalidades.includes(m)}
                  onChange={() => setModalidades((prev) => alternar(prev, m))}
                />
                {MODALITY_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={ETIQUETA}>Población</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((g) => (
              <label key={g} className={CASILLA}>
                <input
                  type="checkbox"
                  checked={poblaciones.includes(g)}
                  onChange={() => setPoblaciones((prev) => alternar(prev, g))}
                />
                {AGE_GROUP_LABELS[g]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={ETIQUETA}>Disponibilidad</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(AVAILABILITY_LABELS) as AvailabilitySlot[]).map((f) => (
              <label key={f} className={CASILLA}>
                <input
                  type="checkbox"
                  checked={franjas.includes(f)}
                  onChange={() => setFranjas((prev) => alternar(prev, f))}
                />
                {AVAILABILITY_LABELS[f]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
        <label className={CASILLA}>
          <input type="checkbox" checked={activo} onChange={() => setActivo((v) => !v)} />
          Disponible para nuevos pacientes
        </label>
        <span className="text-xs text-slate-500">
          {verificado ? "Credenciales verificadas" : "Verificación pendiente del equipo"}
        </span>
      </div>

      {aviso && (
        <p
          className={`text-sm ${aviso.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
