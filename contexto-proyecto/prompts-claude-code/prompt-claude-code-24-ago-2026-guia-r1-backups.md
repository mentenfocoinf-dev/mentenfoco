# Prompt para Claude Code — Guía R1 (backups/PITR) + script de verificación

> Pégalo tal cual en Claude Code. Arranca la fase de "configuraciones" (P0-P7 acordada el 24-ago en el
> roadmap). Empieza por P0 porque es la más crítica y porque **nunca se llegó a entregar** — se pidió en
> el prompt de remediación del 18-ago pero el trabajo se desvió a R4/R5 y la cola de backend, y quedó
> pendiente hasta hoy.

## Alcance — solo lectura y documentación, cero riesgo

**No actives nada tú.** PITR/backups requiere upgrade de plan y una acción del responsable en el panel de
Supabase — vos preparás la guía y el script de verificación de solo lectura, nada más. Nada de esto toca
la base de datos en escritura.

## Entregable 1 — Guía paso a paso para el responsable

Escribe en `contexto-proyecto/auditorias-tecnicas/Guia_R1_Backups_PITR.md`:

1. Qué plan/add-on de Supabase habilita PITR (verifica el nombre real actual del plan vía la
   documentación de Supabase o la Management API si el endpoint lo expone — no asumas el nombre de un
   plan que pudo haber cambiado).
2. Dónde se activa exactamente en el panel (ruta de navegación real, no genérica).
3. Qué retención recomendar para datos clínicos — dado que este es un producto de salud mental con
   historias clínicas reales, señala si hay alguna implicación de la Ley 1581/2012 o Resolución 1995/1999
   sobre cuánto tiempo debe ser recuperable un dato clínico, y recomienda una retención con esa base (no
   solo la mínima técnica).
4. Cómo confirmar que quedó bien activado: qué debe verse en el panel y qué debe devolver la Management
   API (`pitr_enabled: true`, backups no vacío).

## Entregable 2 — Script de verificación de solo lectura

Reutiliza el mismo patrón defensivo que ya usaste en las verificaciones de secrets (nunca imprime datos
sensibles, solo metadata): consulta `GET /v1/projects/{ref}/database/backups` vía la Management API y
reporta `pitr_enabled` + conteo de copias disponibles. Debe poder correrse en cualquier momento para
confirmar el estado, antes y después de que el responsable active el plan.

## Compuerta que debe quedar explícita en la guía

Hasta que el script confirme al menos una copia recuperable, **siguen bloqueados**: los DROP aplazados de
`test_scores` y `guides`, y cualquier futura operación estructural irreversible. Los demás pasos de la
fase de configuraciones (P1 en adelante) no dependen de P0 y pueden avanzar en paralelo si el responsable
lo decide.

## Al terminar

Corre el script una vez ahora (antes de cualquier activación) para dejar registrado el estado de
partida (`pitr_enabled: false`, 0 copias, previsiblemente). Actualiza `01_ROADMAP_Y_TAREAS.md` marcando
que la guía y el script de P0 ya existen (sin marcar P0 como resuelto — eso lo hace el responsable).
