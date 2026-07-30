// Siembra los tests públicos (capa de captación sin login) en `public_tests`.
//
// Los ítems de PHQ-9 y GAD-7 NO se escriben aquí: se IMPORTAN de
// src/lib/psychometricScales.ts, que es la fuente única del proyecto. Si se
// copiaran, el día que se corrija una redacción quedarían dos versiones del
// mismo instrumento —una dentro del portal y otra en abierto— y nadie se
// enteraría. Node importa el .ts directamente (type stripping nativo).
//
// Rosenberg sí se define aquí porque no existe en la app: es de dominio público
// y esta es su primera aparición.
//
// Uso:
//   node seed_public_tests.mjs            (siembra / actualiza por slug)
//   node seed_public_tests.mjs --dry-run  (valida y muestra, sin escribir)
//
// Idempotente: upsert por `slug`.
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

const { PHQ9, GAD7 } = await import(
  pathToFileURL(path.resolve(__dirname, "src/lib/psychometricScales.ts")).href
);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Convierte una escala del portal al formato de test público.
 *
 * `riskItemIndex` de la escala se traduce a `riesgo: true` en el ítem: así el
 * lector público sabe qué respuesta dispara los recursos de crisis sin tener que
 * conocer de antemano qué instrumento está mostrando.
 */
function fromScale(scale) {
  return scale.items.map((texto, i) => ({
    n: i + 1,
    texto,
    ...(scale.riskItemIndex === i ? { riesgo: true } : {}),
    opciones: scale.options.map((o) => ({ label: o.label, valor: o.value })),
  }));
}

// ── Escala de Rosenberg (dominio público) ───────────────────────────────────
//
// Los ítems 2, 5, 8, 9 y 10 son inversos. En vez de marcarlos y dejar que el
// front sepa invertirlos, se invierten YA los valores de sus opciones: el
// puntaje es siempre la suma simple de lo elegido. Así el lector público no
// necesita lógica por instrumento, que es donde se cuelan los errores de cálculo.
const ROSENBERG_DIRECTO = [
  { label: "Muy de acuerdo", valor: 4 },
  { label: "De acuerdo", valor: 3 },
  { label: "En desacuerdo", valor: 2 },
  { label: "Muy en desacuerdo", valor: 1 },
];
const ROSENBERG_INVERSO = [
  { label: "Muy de acuerdo", valor: 1 },
  { label: "De acuerdo", valor: 2 },
  { label: "En desacuerdo", valor: 3 },
  { label: "Muy en desacuerdo", valor: 4 },
];

const ROSENBERG_ITEMS = [
  ["Me siento una persona tan valiosa como las otras", false],
  ["Casi siempre pienso que soy un fracaso", true],
  ["Creo que tengo varias cualidades buenas", false],
  ["Puedo hacer las cosas tan bien como la mayoría de la gente", false],
  ["Creo que no tengo mucho de lo que estar orgulloso(a)", true],
  ["Tengo una actitud positiva hacia mí mismo(a)", false],
  ["En general, me siento satisfecho(a) conmigo mismo(a)", false],
  ["Me gustaría poder tenerme más respeto", true],
  ["A veces me siento verdaderamente inútil", true],
  ["A veces pienso que no sirvo para nada", true],
].map(([texto, inverso], i) => ({
  n: i + 1,
  texto,
  opciones: inverso ? ROSENBERG_INVERSO : ROSENBERG_DIRECTO,
}));

// ── Bandas ──────────────────────────────────────────────────────────────────
//
// `min`/`max` inclusive. `alerta: true` marca las bandas donde el resultado debe
// priorizar los recursos de crisis y CALLAR el mensaje comercial: ofrecer un
// plan a quien acaba de puntuar en riesgo es exactamente lo que el proyecto no
// hace.
//
// Interpretación en lenguaje llano y en segunda persona, sin etiqueta
// diagnóstica: un cribado orienta, no diagnostica.
const TESTS = [
  {
    slug: "test-de-ansiedad",
    nombre: "Test de ansiedad",
    instrumento: "GAD-7",
    categoria: "Ansiedad",
    descripcion:
      "Siete preguntas sobre cómo te has sentido las últimas dos semanas. Te da una orientación de tu nivel de ansiedad y qué puedes hacer con eso.",
    tiempo_estimado: "2-3 min",
    instrucciones: GAD7.instructions,
    items: fromScale(GAD7),
    bandas: [
      {
        min: 0,
        max: 4,
        etiqueta: "Ansiedad mínima",
        interpretacion:
          "Por lo que respondiste, la ansiedad no parece estar interfiriendo con tu día a día. Sentir nervios en momentos puntuales es normal y no es una señal de alarma.",
        recomendacion:
          "Si quieres cuidar lo que ya funciona, tenemos guías breves de respiración y manejo del estrés que puedes usar cuando lo necesites.",
      },
      {
        min: 5,
        max: 9,
        etiqueta: "Ansiedad leve",
        interpretacion:
          "Aparecen algunos síntomas de ansiedad, todavía en un rango leve. Es común en épocas de más carga o incertidumbre, y suele responder bien a herramientas concretas.",
        recomendacion:
          "Empieza por lo práctico: ejercicios de respiración y registro de pensamientos. Si notas que crece o se sostiene varias semanas, hablarlo con un profesional ayuda.",
      },
      {
        min: 10,
        max: 14,
        etiqueta: "Ansiedad moderada",
        interpretacion:
          "Los síntomas están en un nivel moderado y es probable que ya te estén costando cosas: dormir, concentrarte, sostener la calma. No es falta de carácter; es algo que tiene tratamiento.",
        recomendacion:
          "Vale la pena una valoración con un profesional. La ansiedad moderada responde muy bien a intervención temprana, y no tienes que esperar a que empeore.",
      },
      {
        min: 15,
        max: 21,
        etiqueta: "Ansiedad severa",
        interpretacion:
          "Lo que respondiste apunta a un nivel alto de ansiedad, del que probablemente ya está afectando varias áreas de tu vida. Sostener esto en solitario es agotador, y no tendrías que hacerlo.",
        recomendacion:
          "Te recomendamos buscar acompañamiento profesional pronto. Una valoración permite entender qué la mantiene y empezar a trabajarlo con un plan.",
        alerta: true,
      },
    ],
  },
  {
    slug: "test-de-depresion",
    nombre: "Test de estado de ánimo",
    instrumento: "PHQ-9",
    categoria: "Ánimo",
    descripcion:
      "Nueve preguntas sobre las últimas dos semanas. Te orienta sobre tu estado de ánimo y te dice qué paso tiene sentido dar ahora.",
    tiempo_estimado: "3-4 min",
    instrucciones: PHQ9.instructions,
    items: fromScale(PHQ9),
    bandas: [
      {
        min: 0,
        max: 4,
        etiqueta: "Ánimo dentro de lo esperado",
        interpretacion:
          "No aparecen síntomas significativos de depresión. Tener días bajos es parte de la vida y no significa que algo esté mal.",
        recomendacion:
          "Si quieres entender mejor la diferencia entre estar triste y estar deprimido, tenemos un artículo abierto sobre justo eso.",
      },
      {
        min: 5,
        max: 9,
        etiqueta: "Síntomas leves",
        interpretacion:
          "Hay algunas señales de ánimo bajo en un rango leve. Puede ser una reacción a algo que estás viviendo, y conviene no dejarlo pasar sin más.",
        recomendacion:
          "Observa cómo evoluciona en las próximas semanas. Cuidar el sueño y volver a actividades que te hacían bien suele ayudar; si se sostiene, consúltalo.",
      },
      {
        min: 10,
        max: 14,
        etiqueta: "Síntomas moderados",
        interpretacion:
          "Los síntomas están en un nivel moderado y es probable que lleven un tiempo. La depresión no se resuelve con voluntad: es una condición de salud con tratamiento eficaz.",
        recomendacion:
          "Una valoración profesional te dará claridad sobre qué está pasando y qué opciones tienes. Cuanto antes se aborda, más corto suele ser el proceso.",
      },
      {
        min: 15,
        max: 19,
        etiqueta: "Síntomas moderadamente severos",
        interpretacion:
          "Lo que respondiste apunta a un malestar importante, del que probablemente ya está pesando en tu día a día, tu descanso y tus relaciones. Esto merece atención, no aguante.",
        recomendacion:
          "Te recomendamos hablar con un profesional pronto. No tienes que llegar a un punto peor para pedir ayuda.",
        alerta: true,
      },
      {
        min: 20,
        max: 27,
        etiqueta: "Síntomas severos",
        interpretacion:
          "El resultado indica un nivel alto de malestar. Lo que estás cargando es mucho, y hay ayuda concreta y eficaz para esto.",
        recomendacion:
          "Busca atención profesional lo antes posible. Si en algún momento sientes que no puedes más, hay líneas de atención disponibles ahora mismo.",
        alerta: true,
      },
    ],
  },
  {
    slug: "test-de-autoestima",
    nombre: "Test de autoestima",
    instrumento: "Escala de Rosenberg",
    categoria: "Autoestima",
    descripcion:
      "Diez frases sobre cómo te ves a ti mismo(a). Es la escala de autoestima más usada en el mundo y te da una lectura clara de cómo estás.",
    tiempo_estimado: "2-3 min",
    // Rosenberg no mide una ventana temporal: pregunta por cómo te ves en
    // general, así que su encabezado no puede ser el de PHQ-9/GAD-7.
    instrucciones:
      "Lee cada frase y responde qué tan de acuerdo estás con ella, pensando en cómo te sientes contigo mismo(a) en general.",
    items: ROSENBERG_ITEMS,
    bandas: [
      {
        min: 10,
        max: 25,
        etiqueta: "Autoestima baja",
        interpretacion:
          "Por tus respuestas, la manera en que te hablas y te valoras te está costando. La autoestima no es un rasgo fijo con el que naciste: se construye, y por lo tanto se puede trabajar.",
        recomendacion:
          "El diálogo interno es el mejor punto de partida y hay guías abiertas sobre eso. Si la autocrítica es constante, un proceso acompañado hace mucha diferencia.",
      },
      {
        min: 26,
        max: 29,
        etiqueta: "Autoestima media",
        interpretacion:
          "Tu autoestima está en un rango medio: hay cosas que reconoces en ti y otras en las que te cuesta darte crédito. Es el punto donde está la mayoría de la gente.",
        recomendacion:
          "Trabajar el diálogo interno y poner límites sanos suele mover bastante desde aquí. Tenemos guías prácticas de las dos cosas.",
      },
      {
        min: 30,
        max: 40,
        etiqueta: "Autoestima alta",
        interpretacion:
          "Tus respuestas reflejan una relación mayormente amable contigo mismo(a). Eso es una base sólida, y también algo que se cuida.",
        recomendacion:
          "Si quieres seguir construyendo sobre esto, nuestras guías de autoconcepto y límites sanos te pueden interesar.",
      },
    ],
  },
];

// ── Validación antes de escribir ────────────────────────────────────────────

function validar(test) {
  const errores = [];
  if (test.items.length === 0) errores.push("sin ítems");

  const valores = test.items.map((it) => it.opciones.map((o) => o.valor));
  const minPosible = valores.reduce((s, v) => s + Math.min(...v), 0);
  const maxPosible = valores.reduce((s, v) => s + Math.max(...v), 0);

  // Las bandas tienen que cubrir TODO el rango posible y sin solaparse: un hueco
  // deja un puntaje real sin interpretación, y un solape hace ambiguo el
  // resultado. Los dos fallos solo aparecerían con un usuario ya delante.
  const bandas = [...test.bandas].sort((a, b) => a.min - b.min);
  if (bandas[0].min !== minPosible)
    errores.push(`la banda más baja empieza en ${bandas[0].min} y el mínimo posible es ${minPosible}`);
  if (bandas[bandas.length - 1].max !== maxPosible)
    errores.push(
      `la banda más alta termina en ${bandas[bandas.length - 1].max} y el máximo posible es ${maxPosible}`,
    );
  for (let i = 1; i < bandas.length; i++) {
    if (bandas[i].min !== bandas[i - 1].max + 1)
      errores.push(`hueco o solape entre ${bandas[i - 1].max} y ${bandas[i].min}`);
  }
  for (const b of bandas) {
    if (!b.etiqueta || !b.interpretacion || !b.recomendacion)
      errores.push(`banda ${b.min}-${b.max} incompleta`);
  }

  return { errores, minPosible, maxPosible };
}

let hayErrores = false;
console.log(`Validando ${TESTS.length} test(s)…\n`);
for (const t of TESTS) {
  const { errores, minPosible, maxPosible } = validar(t);
  const riesgo = t.items.filter((i) => i.riesgo).map((i) => i.n);
  console.log(
    `  ${t.instrumento.padEnd(20)} ${String(t.items.length).padStart(2)} ítems  rango ${minPosible}-${maxPosible}  ${t.bandas.length} bandas` +
      (riesgo.length ? `  ítem de riesgo: ${riesgo.join(", ")}` : ""),
  );
  for (const e of errores) {
    console.error(`      ✗ ${e}`);
    hayErrores = true;
  }
}
if (hayErrores) {
  console.error("\n❌ No se sembró nada: corrige los errores primero.");
  process.exit(1);
}

if (DRY_RUN) {
  console.log("\n(--dry-run: no se escribió nada en la base)");
  process.exit(0);
}

let creados = 0;
let actualizados = 0;
for (const t of TESTS) {
  const { data: existente } = await supabase
    .from("public_tests")
    .select("id")
    .eq("slug", t.slug)
    .maybeSingle();

  const payload = { ...t, activo: true };

  if (existente) {
    const { error } = await supabase.from("public_tests").update(payload).eq("id", existente.id);
    if (error) {
      console.error(`❌ ${t.slug}: ${error.message}`);
      process.exit(1);
    }
    actualizados++;
    console.log(`  ↻ actualizado  ${t.slug}`);
  } else {
    const { error } = await supabase.from("public_tests").insert(payload);
    if (error) {
      console.error(`❌ ${t.slug}: ${error.message}`);
      process.exit(1);
    }
    creados++;
    console.log(`  ✓ creado       ${t.slug}`);
  }
}

console.log(`\n✅ ${creados} creado(s), ${actualizados} actualizado(s).`);
