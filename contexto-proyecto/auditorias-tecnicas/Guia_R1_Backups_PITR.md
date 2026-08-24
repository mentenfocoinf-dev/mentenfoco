# Guía R1 — Activar backups / PITR (P0 de la fase de configuraciones)

**Fecha:** 24 de agosto de 2026 · **Para:** el responsable del producto (requiere upgrade de plan +
acción en el panel — Claude Code no lo activa). **Alcance de este documento:** guía + script de
verificación de **solo lectura**. Nada aquí escribe en la base.

> **Estado de partida verificado hoy (Management API, solo lectura):**
> `pitr_enabled: false` · **0 copias recuperables** · `walg_enabled: true` · región `us-west-2` ·
> add-on `pitr` **disponible pero NO aplicado**.
> Es decir: **hoy no existe ninguna copia recuperable**. Un `TRUNCATE`/`DROP`/corrupción sería pérdida
> permanente de historias clínicas. Este es el riesgo P0.

---

## 1. Qué plan / add-on habilita PITR

Verificado contra la documentación oficial de Supabase (24-ago) y la Management API del proyecto:

- **PITR es un add-on de pago.** Solo puede aplicarse a proyectos en plan **Pro, Team o Enterprise**
  (no está disponible en Free). Además exige **al menos el compute add-on "Small"** para funcionar bien.
- La Management API confirma que para **este proyecto** el add-on `pitr` figura como **disponible**
  (`available_addons` lo incluye) y **no aplicado** (`selected_addons` vacío) — coherente con que aún no
  se ha subido de plan / activado.
- **Precios de retención (referencia doc oficial, confirmar en el panel al activar):**
  - **7 días** — ~US$0.137/h (~US$100/mes)
  - **14 días** — ~US$0.274/h (~US$200/mes)
  - **28 días** — ~US$0.55/h (~US$400/mes)
- **Importante:** al activar PITR, Supabase **deja de tomar los Daily Backups** — PITR es más fino
  (recuperación a un instante), así que no corren ambos a la vez.

> El nombre exacto del plan y el precio pueden cambiar: confírmalos en `supabase.com/pricing` y en el
> panel al momento de activar. Esta guía no fija un precio, orienta.

## 2. Dónde se activa exactamente en el panel

1. `supabase.com/dashboard` → inicia sesión → selecciona el proyecto **Mente en Foco**
   (ref `eluxdqsprbgtnwznmxqe`, región `us-west-2`).
2. Si el proyecto está en **Free**, primero **subir a Pro** (o superior): barra lateral →
   **Settings → Billing** (o **Organization → Billing**) → cambiar de plan. Asegurar el compute **Small**.
3. Activar el add-on: barra lateral → **Database → Backups** → pestaña **Point in Time** (Point-in-Time
   Recovery). Ahí se elige la **retención** (7 / 14 / 28 días) y se confirma el cargo.
4. Tras confirmar, el panel debe mostrar la sección de PITR activa con la ventana de recuperación elegida
   y, en poco tiempo, la primera copia física disponible.

## 3. Retención recomendada para datos clínicos

Este es un producto de salud mental con **historia clínica real**. Dos marcos colombianos aplican, y
conviene no confundirlos:

- **Ley 1581/2012 (protección de datos).** Los datos de salud son **categoría sensible** (art. 5) y el
  **principio de seguridad** (art. 4, lit. g) obliga a proteger la información contra **pérdida**,
  adulteración o acceso no autorizado. No tener copia recuperable incumple ese principio de frente.
- **Resolución 1995/1999 (manejo de la historia clínica), modificada por la Resolución 839/2017.** Fija
  la **conservación mínima de la historia clínica en 15 años** desde la última atención (5 en archivo de
  gestión + 10 en archivo central). Esto es una obligación de **archivo de largo plazo**.

**Distinción clave — PITR NO es el archivo de 15 años.** PITR es **recuperación operativa ante
desastre**: permite volver a un instante dentro de una ventana móvil (7/14/28 días) para deshacer una
corrupción, un `DROP` accidental o un borrado. La obligación de 15 años se cumple con la **persistencia
de la base + exportaciones lógicas periódicas** conservadas aparte — ese es un ítem propio (ver §5), no
lo resuelve PITR.

**Recomendación:**
- Para PITR, elegir **28 días** (la ventana máxima). Justificación clínica (no solo técnica): los datos
  clínicos son **irreemplazables**, y una corrupción o borrado silencioso puede tardar días o semanas en
  detectarse; cuanto más ancha la ventana, mayor la probabilidad de recuperarlos antes de que sea
  irreversible. Es lo defendible para un producto de salud.
- Si el costo de 28 días no es asumible al inicio, **14 días** es un punto medio razonable; **7 días** es
  el mínimo técnico y **no** se recomienda como estado final para datos de salud.
- **Aparte y obligatorio a mediano plazo:** un mecanismo de **exportación lógica periódica** (dumps
  cifrados fuera de Supabase) para cubrir la retención legal de 15 años de la historia clínica. PITR no lo
  sustituye. Registrar como ítem propio de la fase de configuraciones.

## 4. Cómo confirmar que quedó bien activado

**En el panel:** Database → Backups → Point in Time muestra PITR **activo**, la ventana de retención
elegida y una copia física reciente disponible.

**Por Management API (lo que debe devolver):**
- `GET /v1/projects/{ref}/database/backups` → **`pitr_enabled: true`** y `backups` **no vacío**
  (≥ 1 copia recuperable).
- `GET /v1/projects/{ref}/billing/addons` → el add-on `pitr` en **aplicados**.

**Con el script de este repo (solo lectura, no toca nada):**
```bash
node scripts/verify-pitr.cjs
```
Reporta `pitr_enabled`, el conteo de copias recuperables y si el add-on `pitr` está aplicado, y termina
con un veredicto:
- **⛔ GATE** mientras no haya copia recuperable (estado de hoy).
- **✅ OK** cuando `pitr_enabled: true` y ≥ 1 copia — recién ahí se levanta la compuerta.

## 5. Compuerta (explícita)

**Hasta que `node scripts/verify-pitr.cjs` confirme al menos UNA copia recuperable**, siguen
**BLOQUEADOS**:
- Los DROP aplazados de **`test_scores`** y **`guides`**.
- **Cualquier** operación estructural irreversible futura (DROP de tabla/columna, TRUNCATE masivo,
  migración destructiva).

Los demás pasos de la fase de configuraciones (**P1 en adelante**: R2/Resend, R6/DEV_MAIL_REDIRECT,
Turnstile E2E, Stripe live, dominio propio, revisión jurídica) **no dependen de P0** y pueden avanzar en
paralelo si el responsable lo decide.

**Ítem separado que esta guía deja anotado:** exportación lógica periódica cifrada para la retención
legal de 15 años (Resolución 1995/1999 mod. 839/2017) — PITR no lo cubre.
