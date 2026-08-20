-- ============================================================================
-- `anon` pasa a solo lectura sobre el contenido público.
--
-- Alcance: UN solo tipo de cambio — revocar INSERT, UPDATE, DELETE y TRUNCATE
-- al rol `anon` sobre 7 objetos. No se toca `authenticated`, ni SELECT, ni
-- ninguna función, trigger, política o tabla clínica. Ni React.
--
-- ── El problema, demostrado antes de escribir esto ──────────────────────────
--
-- `anon` es la clave que viaja en el paquete JavaScript de cada visita.
-- Ejecutado con `SET LOCAL ROLE anon` y rollback forzado:
--
--     content_items filas=26 anon=SIUDT
--     clinical_guides filas=20 anon=SIUDT
--     cie11_directory filas=163 anon=SIUDT
--     ANON MODIFICA content_items: 26 piezas
--     ANON BORRA content_items: 26 piezas
--     ANON BORRA clinical_guides: 20 guias
--     ANON BORRA cie11_directory: 163 entradas
--
-- 209 filas destruibles sin cuenta. Con PITR desactivado, irrecuperables.
--
-- ── Por qué revocar la escritura no rompe nada ──────────────────────────────
--
-- Inventario de TODOS los accesos del frontend a los 7 objetos, operación por
-- operación (`grep` sobre `src` resolviendo la operación de cada `.from()`):
--
--   content_items ......... 5 select, 1 insert, 6 update, 0 delete
--   content_items_meta .... 4 select
--   clinical_guides ....... 1 select
--   clinical_guides_meta .. 3 select
--   guides ................ 0 accesos
--   cie11_directory ....... 2 select
--   public_tests .......... 2 select
--
-- Seis de los siete objetos SOLO se leen. El séptimo, `content_items`, se
-- escribe desde siete puntos, todos en `contentService.ts` y todos del flujo
-- editorial: `createContentDraft(authorId)`, `updateContentDraft`,
-- `submitForReview`, `approveContent(id, adminId)`, `requestContentChanges`,
-- `publishContent`, `archiveContent`. Reciben el identificador del autor o del
-- administrador, es decir, corren con sesión iniciada — con el rol
-- `authenticated`, al que este archivo no toca.
--
-- Archivar es un UPDATE de `status`, no un DELETE: por eso el inventario no
-- registra ni un solo borrado.
--
-- ── Lo que NO se toca, y por qué ────────────────────────────────────────────
--
-- · SELECT de `anon`: las páginas públicas dependen de él.
-- · Todo lo de `authenticated`: fuera del alcance de este sprint.
-- · REFERENCES y TRIGGER de `anon` sobre estos siete: siguen concedidos. Se
--   documentan como observación, no se corrigen aquí. Crear un trigger exige
--   además CREATE sobre el esquema, que `anon` no tiene (comprobado:
--   `has_schema_privilege('anon','public','CREATE')` = false), así que hoy son
--   privilegios inertes.
--
-- ── Idempotencia ───────────────────────────────────────────────────────────
--
-- `REVOKE` sobre un privilegio ya revocado no es error en PostgreSQL: no hace
-- nada y no avisa. Este archivo se puede ejecutar las veces que haga falta.
--
-- ── Reversión ──────────────────────────────────────────────────────────────
--
-- `supabase/backups/20260805_pre_anon_contenido.sql`
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.content_items        FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.content_items_meta   FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clinical_guides      FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clinical_guides_meta FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.guides               FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cie11_directory      FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.public_tests         FROM anon;
