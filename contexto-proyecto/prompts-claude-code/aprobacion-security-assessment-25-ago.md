Buen informe — que haya verificado `enforce_profile_ownership` contra escalada de rol/plan en vez de
asumir que las políticas ya cubrían mass-assignment es exactamente el nivel de rigor que necesitamos.

## Apruebo ambas

1. **Commitea el informe:** `docs: security assessment against 20 hardening pillars`.
2. **Empieza por la brecha 18 (cabeceras HTTP)** — de acuerdo en que es la de mayor impacto/menor
   esfuerzo. Calíbrala contra los orígenes reales del proyecto (Supabase, Turnstile, Stripe, Resend si
   aplica en algún `connect-src`) y verifica con un scanner de cabeceras o al menos revisando la respuesta
   real después de desplegar, no solo por inspección del archivo.

## Antes de dar la 20 (SCA/`npm audit`) por "P8 después" — necesito un detalle

Dijiste "20 vulns (1 crítica, 9 altas), varias dev-only" pero no separaste **cuáles son cuáles**. Antes de
meter esto en el balde de "hardening para después", dime específicamente:

- La vulnerabilidad **crítica**: ¿es de una `devDependency` (no llega a producción) o de una dependencia
  que sí se empaqueta en el build/runtime? Nombre del paquete y CVE si `npm audit` lo da.
- Lo mismo para las **9 altas**: cuántas son dev-only vs. producción real.

Si alguna crítica o alta está en el bundle de producción o en las Edge Functions (Deno, aparte de npm),
esa no espera a P8 — la resolvemos ahora, aunque sea en paralelo a las cabeceras. Si de verdad todo lo
crítico/alto es dev-only (linters, build tools, etc.), entonces sí queda razonable agruparlo con
Dependabot/CI como mejora de proceso en P8, dilo explícitamente con la evidencia y sigo tu recomendación.

Sigue respetando la pausa de P0/P1 (PITR, Turnstile, Resend) — nada de eso lo tocas todavía.
