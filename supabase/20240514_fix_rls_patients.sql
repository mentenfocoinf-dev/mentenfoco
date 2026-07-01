-- =========================================================================================
-- CORRECCIÓN URGENTE DE RLS: DASHBOARD B2B (TERAPEUTAS)
-- Fecha: 14 de Mayo 2026
-- Objetivo: Permitir que el JOIN de Supabase extraiga correctamente los datos del paciente.
-- =========================================================================================

-- 0. POLÍTICA BASE: Cada usuario puede leer su PROPIO perfil (auth.uid() = id)
--    Esta es la política más crítica del sistema. Sin ella, useAuth devuelve null.
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- 1. Asegurar que la tabla pivote tiene RLS activado y permite SELECT al terapeuta
ALTER TABLE patient_therapist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists can view their assignments" ON patient_therapist;
CREATE POLICY "Therapists can view their assignments" 
ON patient_therapist 
FOR SELECT 
USING (auth.uid() = therapist_id);

-- 2. Nueva política en `profiles` para permitir al terapeuta leer los datos de su paciente
DROP POLICY IF EXISTS "Therapists can view profiles of their patients" ON profiles;
CREATE POLICY "Therapists can view profiles of their patients" 
ON profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM patient_therapist 
    WHERE patient_therapist.therapist_id = auth.uid() 
    AND patient_therapist.patient_id = profiles.id
  )
);
