// Definiciones de escalas de cribado psicométrico (dominio público). Fuente de contenido clínico:
// investigacion-clinica-cie11-dsm5/05_Escalas_Evaluacion_Estructura_Informes_Clinicos.md.
// Traducciones al español estándar de PHQ-9 y GAD-7 (Pfizer/Spitzer, uso clínico y educativo libre).

export interface FrequencyOption {
  value: number;
  label: string;
}

export interface ScaleDefinition {
  key: "phq9" | "gad7";
  title: string;
  subtitle: string;
  instructions: string;
  options: FrequencyOption[];
  items: string[];
  /** Índice (0-based) del ítem que, si es > 0, dispara evaluación de riesgo inmediata. */
  riskItemIndex?: number;
  severity: (score: number) => { label: string; level: "minimo" | "leve" | "moderado" | "grave" };
}

const FRECUENCIA_2_SEMANAS: FrequencyOption[] = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
];

export const PHQ9: ScaleDefinition = {
  key: "phq9",
  title: "PHQ-9",
  subtitle: "Cuestionario de Salud del Paciente — síntomas depresivos",
  instructions:
    "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?",
  options: FRECUENCIA_2_SEMANAS,
  riskItemIndex: 8,
  items: [
    "Poco interés o placer en hacer las cosas",
    "Se ha sentido decaído(a), deprimido(a) o sin esperanzas",
    "Dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado",
    "Se ha sentido cansado(a) o con poca energía",
    "Falta de apetito o ha comido en exceso",
    "Se ha sentido mal con usted mismo(a), o que es un fracaso, o que ha quedado mal con usted mismo(a) o con su familia",
    "Dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión",
    "¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? O lo contrario: estar tan inquieto(a) o agitado(a) que se ha estado moviendo mucho más de lo normal",
    "Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera",
  ],
  severity: (score) => {
    if (score <= 4) return { label: "Mínimo", level: "minimo" };
    if (score <= 9) return { label: "Leve", level: "leve" };
    if (score <= 14) return { label: "Moderado", level: "moderado" };
    if (score <= 19) return { label: "Moderadamente grave", level: "grave" };
    return { label: "Grave", level: "grave" };
  },
};

export const GAD7: ScaleDefinition = {
  key: "gad7",
  title: "GAD-7",
  subtitle: "Escala de Ansiedad Generalizada",
  instructions:
    "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?",
  options: FRECUENCIA_2_SEMANAS,
  items: [
    "Sentirse nervioso(a), ansioso(a) o muy alterado(a)",
    "No poder dejar de preocuparse o controlar la preocupación",
    "Preocuparse demasiado por diferentes cosas",
    "Dificultad para relajarse",
    "Estar tan inquieto(a) que es difícil quedarse quieto(a)",
    "Molestarse o irritarse fácilmente",
    "Sentir miedo como si algo terrible pudiera pasar",
  ],
  severity: (score) => {
    if (score <= 4) return { label: "Mínimo", level: "minimo" };
    if (score <= 9) return { label: "Leve", level: "leve" };
    if (score <= 14) return { label: "Moderado", level: "moderado" };
    return { label: "Grave", level: "grave" };
  },
};

export const SCALES: Record<"phq9" | "gad7", ScaleDefinition> = { phq9: PHQ9, gad7: GAD7 };
