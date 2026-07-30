// Siembra el contenido de la plataforma (artículos, programas, herramientas, audio) en `content_items`
// dejándolo PUBLICADO y firmado por una cuenta de administrador.
//
// Fuente: los `.md` de contexto-proyecto/contenido-plataforma/, cada uno con frontmatter YAML
// (= columnas de content_items) + cuerpo markdown. El índice autoritativo es MANIFIESTO_SIEMBRA.md.
// El contenido clínico NO se escribe aquí: este script solo lo carga.
//
// Uso:
//   node seed_content_items.cjs            (recorre las 4 carpetas de contenido-plataforma)
//   node seed_content_items.cjs --dry-run  (parsea y valida sin escribir en la base)
//
// Es idempotente: hace upsert por `slug`, así que correrlo dos veces actualiza en vez de duplicar.

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");

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
const DRY_RUN = process.argv.includes("--dry-run");

const CONTENT_ROOT = path.resolve(__dirname, "contexto-proyecto/contenido-plataforma");
const FOLDERS = ["articulos", "programas", "herramientas", "audio", "blog"];

// Solo estas columnas existen en content_items; cualquier otra clave del frontmatter se ignora
// (los .md pueden traer metadatos de redacción que no van a la base).
const COLUMNS = [
  "content_type",
  "audio_kind",
  "categoria",
  "titulo",
  "slug",
  "resumen_breve",
  "cover_image",
  "tiempo_lectura",
  "body_md",
  "en_resumen",
  "faq",
  "key_takeaway",
  "clinical_refs",
  "audio_url",
  "external_embed_url",
  "program_steps",
  "min_plan",
  "admite_comentarios",
  "tags",
];

const REQUIRED = ["content_type", "categoria", "titulo", "slug", "resumen_breve"];

/** Separa el frontmatter YAML del cuerpo markdown. */
function parseFrontmatter(raw, file) {
  const text = raw.replace(/^﻿/, "");
  if (!text.startsWith("---")) {
    throw new Error(`${file}: no empieza con frontmatter (---).`);
  }
  // El cierre es la siguiente línea que sea exactamente '---'
  const lines = text.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`${file}: no se encontró el cierre del frontmatter.`);

  const front = yaml.load(lines.slice(1, end).join("\n")) ?? {};
  const body = lines.slice(end + 1).join("\n").trim();
  return { front, body };
}

function buildPayload(front, body, file) {
  const item = {};
  for (const col of COLUMNS) {
    if (front[col] !== undefined) item[col] = front[col];
  }
  // El cuerpo del .md es el body_md, salvo que el frontmatter ya lo traiga explícito.
  if (!item.body_md) item.body_md = body || null;

  const missing = REQUIRED.filter((f) => !item[f]);
  if (missing.length > 0) {
    throw new Error(`${file}: faltan campos obligatorios ${missing.join(", ")}`);
  }
  if (item.audio_kind && item.content_type !== "audio") {
    throw new Error(`${file}: audio_kind solo aplica a content_type="audio".`);
  }
  // Normaliza nulls que YAML puede entregar como string "null"
  for (const k of ["audio_url", "external_embed_url"]) {
    if (item[k] === "null" || item[k] === undefined) item[k] = null;
  }
  return item;
}

function collectFiles() {
  const found = [];
  for (const folder of FOLDERS) {
    const dir = path.join(CONTENT_ROOT, folder);
    if (!fs.existsSync(dir)) {
      console.warn(`  ⚠ carpeta ausente: ${folder}`);
      continue;
    }
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".md")) continue;
      found.push({ folder, name, full: path.join(dir, name) });
    }
  }
  return found;
}

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

async function main() {
  const files = collectFiles();
  if (files.length === 0) {
    console.log("ℹ️  No se encontraron .md de contenido. Nada que sembrar.");
    return;
  }

  // Parseo y validación primero: si algo está mal, no se escribe nada.
  const parsed = [];
  for (const f of files) {
    const raw = fs.readFileSync(f.full, "utf8");
    const { front, body } = parseFrontmatter(raw, f.name);
    parsed.push({ file: f, item: buildPayload(front, body, f.name) });
  }

  // Slugs duplicados romperían el upsert de forma silenciosa.
  const bySlug = new Map();
  for (const p of parsed) {
    if (bySlug.has(p.item.slug)) {
      throw new Error(`Slug duplicado "${p.item.slug}" en ${p.file.name} y ${bySlug.get(p.item.slug)}`);
    }
    bySlug.set(p.item.slug, p.file.name);
  }

  console.log(`Encontradas ${parsed.length} pieza(s) en ${FOLDERS.length} carpetas.\n`);

  // ── Resolución de las referencias cruzadas de los programas ────────────────
  // Un paso puede apuntar a otra pieza de contenido O a una guía clínica ya
  // existente (p. ej. "cuando-el-duelo-no-avanza" es el título de la guía
  // trauma-duelo-prolongado). Se marca cada paso con `ref_kind` para que el
  // lector construya la URL correcta: /contenido/<slug> o /guias/<id>.
  const allSlugs = new Set(parsed.map((p) => p.item.slug));

  const slugify = (t) =>
    String(t)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  let guides = [];
  if (!DRY_RUN || true) {
    const { data } = await supabase.from("clinical_guides").select("id, titulo");
    guides = data ?? [];
  }
  const guideById = new Map(guides.map((g) => [g.id, g.id]));
  const guideByTitle = new Map(guides.map((g) => [slugify(g.titulo), g.id]));

  const brokenRefs = [];
  for (const p of parsed) {
    if (!p.item.program_steps) continue;
    p.item.program_steps = p.item.program_steps.map((step) => {
      const rel = step.slug_relacionado;
      if (!rel) return { ...step, ref_kind: null };
      if (allSlugs.has(rel)) return { ...step, ref_kind: "contenido" };

      const guideId = guideById.get(rel) ?? guideByTitle.get(rel);
      if (guideId) return { ...step, slug_relacionado: guideId, ref_kind: "guia" };

      brokenRefs.push(`${p.item.slug} → ${rel}`);
      return { ...step, slug_relacionado: null, ref_kind: null };
    });
  }

  if (DRY_RUN) {
    for (const p of parsed) {
      console.log(
        `  ${p.item.content_type.padEnd(12)} ${p.item.slug.padEnd(46)} ${p.item.min_plan ?? "free"}`,
      );
    }
    console.log(
      brokenRefs.length ? `\n⚠ referencias rotas: ${brokenRefs.join(", ")}` : "\n✓ referencias cruzadas OK",
    );
    console.log("\n(--dry-run: no se escribió nada en la base)");
    return;
  }

  const adminId = await findAdminId();
  console.log(`Admin: ${ADMIN_EMAIL} (${adminId})\n`);

  const now = new Date().toISOString();
  let creadas = 0;
  let actualizadas = 0;
  const sinImagen = [];

  for (const { item } of parsed) {
    const { data: existing } = await supabase
      .from("content_items")
      .select("id")
      .eq("slug", item.slug)
      .maybeSingle();

    // author_id = admin: es contenido institucional publicado directo. Las propuestas de
    // terapeutas entran por la UI del panel, no por aquí.
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
      if (!fs.existsSync(imgPath)) sinImagen.push(item.cover_image);
    }
  }

  console.log(`\n✅ ${creadas} creada(s), ${actualizadas} actualizada(s), publicadas por el admin.`);
  if (sinImagen.length > 0) {
    console.warn(`⚠ Faltan imágenes en public/contenido/: ${sinImagen.join(", ")}`);
  }
  if (brokenRefs.length > 0) {
    console.warn(`⚠ Referencias cruzadas rotas: ${brokenRefs.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
