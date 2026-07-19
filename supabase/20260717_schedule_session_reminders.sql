-- Programa el envío automático de recordatorios de sesión por correo (canal inicial, hasta que la
-- app móvil permita notificaciones push — decisión del usuario, 2026-07-16).
--
-- Corre la Edge Function `send-session-reminders` cada hora vía pg_cron + pg_net. La función misma
-- filtra qué sesiones caen en la ventana de recordatorio (23-25h antes), así que llamarla de más no
-- duplica correos: reminder_status pasa a 'enviado'/'fallido' en cuanto se procesa una sesión.
--
-- ESTADO (aplicado y verificado el 2026-07-19 por Claude Code):
--   1. Función desplegada: `supabase functions deploy send-session-reminders` ✔
--   2. Secret configurado: RESEND_API_KEY ✔ (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta
--      Supabase automáticamente en toda función; REMINDER_FROM_EMAIL queda sin definir y se usa el
--      remitente por defecto "Mente en Foco <onboarding@resend.dev>").
--   3. El service role key NO va en texto plano en este archivo: se guardó en Supabase Vault con el
--      nombre 'cron_service_key' y el cron lo lee en tiempo de ejecución (ver abajo). Para recrearlo
--      en otro entorno:
--         SELECT vault.create_secret('<service_role_key>', 'cron_service_key', 'Service role key del cron');
--   4. pg_cron y pg_net habilitadas por esta misma migración.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotencia: si el job ya está programado, lo quitamos antes de volver a crearlo, para que
-- reaplicar esta migración no falle ni deje jobs duplicados.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-session-reminders-hourly') THEN
        PERFORM cron.unschedule('send-session-reminders-hourly');
    END IF;
END $$;

SELECT cron.schedule(
    'send-session-reminders-hourly',
    '0 * * * *', -- cada hora, en el minuto 0
    $$
    SELECT net.http_post(
        url := 'https://eluxdqsprbgtnwznmxqe.supabase.co/functions/v1/send-session-reminders',
        headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_key'),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Para verificar manualmente que el cron quedó registrado:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'send-session-reminders-hourly';
--
-- Para revisar las últimas corridas:
-- SELECT status, return_message, start_time FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-session-reminders-hourly')
-- ORDER BY start_time DESC LIMIT 10;
--
-- Para desactivarlo si algo sale mal:
-- SELECT cron.unschedule('send-session-reminders-hourly');
