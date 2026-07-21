-- ============================================================================
-- Datos minimos de operacion del paciente.
--
-- La Resolucion Unica DIAN 000227 de 2025 permite exigir al comprador solo tres
-- datos: nombre, tipo/numero de identificacion y correo. La cedula se pide por
-- eso y nada mas: sin ella no se puede emitir factura electronica al activar un
-- plan pago. No se pide direccion ni datos adicionales.
--
-- El contacto de emergencia no es administrativo sino de seguridad clinica: es
-- a quien escalar cuando una crisis supera el alcance del terapeuta asignado.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cedula text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

COMMENT ON COLUMN profiles.cedula IS
  'Numero de identificacion. Requerido para facturacion electronica DIAN antes de poder cobrar un plan pago (Resolucion Unica DIAN 000227 de 2025 exige nombre + tipo/numero de identificacion + correo al comprador).';
COMMENT ON COLUMN profiles.emergency_contact_name IS
  'Contacto de emergencia del paciente. Dato de seguridad clinica, no solo administrativo: a quien escalar si una crisis supera el alcance del terapeuta asignado.';
COMMENT ON COLUMN profiles.emergency_contact_phone IS
  'Telefono del contacto de emergencia. Ver emergency_contact_name.';

-- ---------------------------------------------------------------------------
-- Relleno de las cuentas sinteticas de prueba.
--
-- Se crearon con scripts de seed antes de que existiera el registro de
-- consentimiento, asi que tienen terms_accepted_at NULL y el nuevo gate las
-- bloquearia a todas, dejando el entorno de pruebas inutilizable.
--
-- terms_version = 'seed-backfill' las deja identificables: NO representan un
-- consentimiento real prestado por una persona, son datos de prueba.
-- ---------------------------------------------------------------------------
UPDATE profiles
SET terms_accepted_at = COALESCE(terms_accepted_at, now()),
    terms_version     = COALESCE(terms_version, 'seed-backfill'),
    cedula            = COALESCE(cedula, '1000000000'),
    phone             = COALESCE(phone, '3000000000'),
    emergency_contact_name  = COALESCE(emergency_contact_name, 'Contacto de prueba'),
    emergency_contact_phone = COALESCE(emergency_contact_phone, '3000000001')
WHERE email LIKE '%@test.com';
