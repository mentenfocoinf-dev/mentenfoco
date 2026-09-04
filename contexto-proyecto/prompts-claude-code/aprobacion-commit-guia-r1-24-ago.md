Revisé la guía completa — buen trabajo, en particular la distinción entre PITR (recuperación operativa,
ventana móvil) y la retención legal de 15 años de la historia clínica (Resolución 1995/1999 mod.
839/2017), que PITR no cubre. Apruebo la recomendación de 28 días.

**Commitea los 3 archivos** (`docs: R1 backups/PITR guide + read-only verify-pitr script`):
- `contexto-proyecto/auditorias-tecnicas/Guia_R1_Backups_PITR.md`
- `scripts/verify-pitr.cjs`
- `01_ROADMAP_Y_TAREAS.md` (línea P0)

**Añade un ítem nuevo al roadmap** (fuera de este commit si prefieres separarlo, o dentro, tu criterio):
la exportación lógica periódica cifrada para cubrir la retención legal de 15 años — lo dejaste bien
anotado en la guía como algo que PITR no resuelve, y no estaba en ningún lado del roadmap antes de hoy.
Que quede como su propio punto en la fase de configuraciones (después de P0, antes o junto a P5 jurídico,
ya que también tiene componente legal), no perdido dentro del texto de la guía.

Después de commitear: nada más de código por ahora en P0 — la activación del plan/PITR la hago yo en el
panel. Puedes seguir con P1 (Resend + Turnstile) si quieres dejarlo también preparado, o esperar a que
confirme que ya activé PITR. Tu criterio sobre el orden.
