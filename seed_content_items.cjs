// Siembra contenido (artículos, programas, herramientas, resúmenes de audio) en `content_items`
// dejándolo PUBLICADO y firmado por una cuenta de administrador.
//
// El contenido NO se escribe aquí: este script solo lo carga. La redacción sigue la metodología del
// proyecto (contexto-proyecto/contenido-plataforma/00_guia_estilo_redaccion.md) y se entrega en un
// manifiesto JSON. Así el script queda listo para recibir las piezas cuando el tono esté aprobado.
//
// Uso:
//   node seed_content_items.cjs                       (usa supabase/seed-data/content_items.json)
//   node seed_content_items.cjs ruta/al/manifiesto.json
//
// Forma de cada entrada del manifiesto (los campos opcionales pueden omitirse):
// {
//   "content_type": "articulo" | "programa" | "herramienta" | "audio",
//   "audio_kind":   "meditacion" | "podcast",        // solo si content_type === "audio"
//   "categoria":    "Ansiedad",
//   "titulo":       "La ansiedad que no se apaga",
//   "slug":         "la-ansiedad-que-no-se-apaga",
//   "resumen_breve":"Una frase con lo que el lector se lleva.",
//   "cover_image":  "la-ansiedad-que-no-se-apaga.png", // archivo en public/contenido/
//   "tiempo_lectura":"8 min",
//   "body_md":      "## Sección\n\n…",
//   "en_resumen":   ["bullet 1", "bullet 2"],
//   "faq":          [{ "q": "…", "a": "…" }],
//   "key_takeaway": "La idea que se lleva.",
//   "clinical_refs":[{ "fuente": "…", "nota": "…" }],
//   "program_steps":[{ "orden": 1, "titulo": "…", "descripcion": "…", "content_item_id": null }],
//   "min_plan":     "free" | "esencial"
// }
//
// Es idempotente: hace upsert por `slug`, así que correrlo dos veces actualiza en vez de duplicar.

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "admin@test.com";
const DEFAULT_MANIFEST = path.resolve(__dirname, "supabase/seed-data/content_items.json");

const REQUIRED = ["content_type", "categoria", "titulo", "slug", "resumen_breve"];

async function findAdminId() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  if (error) throw new Error(`Error buscando al admin: ${error.message}`);
  if (!data) throw new Error(`No existe ${ADMIN_EMAIL}. Corre primero seed_users.cjs.`);
  if (data.role !== "admin") throw new Error(`${ADMIN_EMAIL} no tiene rol admin.`);
  return data.id;
}

function validate(item, index) {
  const missing = REQUIRED.filter((f) => !item[f]);
  if (missing.length > 0) {
    throw new Error(`Ítem #${index + 1} (${item.slug ?? "sin slug"}): faltan campos ${missing.join(", ")}`);
  }
  if (item.audio_kind && item.content_type !== "audio") {
    throw new Error(`Ítem #${index + 1} (${item.slug}): audio_kind solo aplica a content_type="audio".`);
  }
}

async function main() {
  const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_MANIFEST;

  if (!fs.existsSync(manifestPath)) {
    console.log(`ℹ️  No hay manifiesto en:\n   ${manifestPath}\n`);
    console.log("   El script está listo, pero todavía no hay contenido que sembrar.");
    console.log("   Crea ese archivo con un array de piezas (ver la cabecera de este script)");
    console.log("   y vuelve a correrlo. No se inventa contenido clínico aquí.");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const items = Array.isArray(raw) ? raw : [raw];
  if (items.length === 0) {
    console.log("ℹ️  El manifiesto está vacío. Nada que sembrar.");
    return;
  }

  items.forEach(validate);

  const adminId = await findAdminId();
  console.log(`Admin: ${ADMIN_EMAIL} (${adminId})`);
  console.log(`Manifiesto: ${manifestPath} — ${items.length} pieza(s)\n`);

  const now = new Date().toISOString();
  let creadas = 0;
  let actualizadas = 0;

  for (const item of items) {
    const { data: existing } = await supabase
      .from("content_items")
      .select("id")
      .eq("slug", item.slug)
      .maybeSingle();

    // author_id = admin: el contenido sembrado es institucional. Las propuestas de
    // terapeutas entran por la UI, no por aquí.
    const payload = {
      ...item,
      author_id: adminId,
      status: "publicado",
      published_by: adminId,
      published_at: now,
      reviewed_by: adminId,
      reviewed_at: now,
    };

    if (existing) {
      const { error } = await supabase.from("content_items").update(payload).eq("id", existing.id);
      if (error) throw new Error(`${item.slug}: ${error.message}`);
      actualizadas++;
      console.log(`  ↻ actualizada  ${item.slug}`);
    } else {
      const { error } = await supabase.from("content_items").insert(payload);
      if (error) throw new Error(`${item.slug}: ${error.message}`);
      creadas++;
      console.log(`  ✓ creada       ${item.slug}`);
    }

    if (item.cover_image) {
      const imgPath = path.resolve(__dirname, "public/contenido", item.cover_image);
      if (!fs.existsSync(imgPath)) {
        console.warn(`     ⚠ falta la imagen public/contenido/${item.cover_image}`);
      }
    }
  }

  console.log(`\n✅ Listo. ${creadas} creada(s), ${actualizadas} actualizada(s), publicadas por el admin.`);
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
