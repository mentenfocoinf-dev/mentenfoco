import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const content = fs.readFileSync(path.join(__dirname, "src", "data", "guiasData.ts"), "utf8");

const startIndex = content.indexOf("export const guiasClinicas: GuiaClinica[] = [");
const dataStr = content.substring(content.indexOf("[", startIndex));
// Evaluate in a safe context or just use Function
const getGuias = new Function("return " + dataStr);
const guiasClinicas = getGuias();

const sqlHeader = `
-- 1. Actualizar tabla profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_token UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2. Crear tabla clinical_guides
CREATE TABLE IF NOT EXISTS clinical_guides (
    id TEXT PRIMARY KEY,
    categoria TEXT NOT NULL,
    etiquetas TEXT[] NOT NULL,
    titulo TEXT NOT NULL,
    "descripcionBreve" TEXT NOT NULL,
    "tiempoLectura" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "fundamentoClinico" TEXT NOT NULL,
    "ejercicioPractico" TEXT NOT NULL,
    es_premium BOOLEAN NOT NULL DEFAULT false,
    "contenidoCompleto" TEXT
);

-- 3. Habilitar RLS en clinical_guides
ALTER TABLE clinical_guides ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas RLS
-- Permitir lectura de guías gratuitas a cualquier usuario
CREATE POLICY "Permitir lectura de guías gratuitas" ON clinical_guides 
    FOR SELECT USING (es_premium = false);

-- Permitir lectura de guías premium EXCLUSIVAMENTE a usuarios con plan premium
CREATE POLICY "Permitir lectura premium a usuarios premium" ON clinical_guides 
    FOR SELECT USING (
        es_premium = true AND 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.plan_type = 'premium'
        )
    );

-- 5. Crear tabla de telemetría
CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert telemetry" ON telemetry_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Select telemetry admins" ON telemetry_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 6. Insertar Datos de Guías
`;

const escapeStr = (str) => {
  if (!str) return "";
  return str.replace(/'/g, "''");
};

const inserts = guiasClinicas
  .map((g) => {
    const etiquetas = g.etiquetas.map((e) => "'" + escapeStr(e) + "'").join(", ");
    return (
      'INSERT INTO clinical_guides (id, categoria, etiquetas, titulo, "descripcionBreve", "tiempoLectura", "imageName", "fundamentoClinico", "ejercicioPractico", es_premium, "contenidoCompleto") \n' +
      "VALUES ('" +
      g.id +
      "', '" +
      escapeStr(g.categoria) +
      "', ARRAY[" +
      etiquetas +
      "], '" +
      escapeStr(g.titulo) +
      "', '" +
      escapeStr(g.descripcionBreve) +
      "', '" +
      escapeStr(g.tiempoLectura) +
      "', '" +
      escapeStr(g.imageName) +
      "', '" +
      escapeStr(g.fundamentoClinico) +
      "', '" +
      escapeStr(g.ejercicioPractico) +
      "', " +
      g.es_premium +
      ", '" +
      escapeStr(g.contenidoCompleto || "") +
      "')\n" +
      "ON CONFLICT (id) DO UPDATE SET\n" +
      "    categoria = EXCLUDED.categoria,\n" +
      "    etiquetas = EXCLUDED.etiquetas,\n" +
      "    titulo = EXCLUDED.titulo,\n" +
      '    "descripcionBreve" = EXCLUDED."descripcionBreve",\n' +
      '    "tiempoLectura" = EXCLUDED."tiempoLectura",\n' +
      '    "imageName" = EXCLUDED."imageName",\n' +
      '    "fundamentoClinico" = EXCLUDED."fundamentoClinico",\n' +
      '    "ejercicioPractico" = EXCLUDED."ejercicioPractico",\n' +
      "    es_premium = EXCLUDED.es_premium,\n" +
      '    "contenidoCompleto" = EXCLUDED."contenidoCompleto";'
    );
  })
  .join("\n\n");

if (!fs.existsSync(path.join(__dirname, "supabase"))) {
  fs.mkdirSync(path.join(__dirname, "supabase"));
}
fs.writeFileSync(
  path.join(__dirname, "supabase", "20240514_security_sprint.sql"),
  sqlHeader + inserts,
);
console.log("SQL Migration generated at supabase/20240514_security_sprint.sql");
