Sí, prepara los 2 scripts (`verify-turnstile.cjs` y `verify-resend.cjs`), mismo patrón defensivo que
`verify-pitr.cjs` — solo metadata, nunca valores de secretos. Es trabajo útil y de cero riesgo que no
depende de que yo haga nada primero.

Commitea los 2 junto con cualquier ajuste de roadmap que corresponda (`docs: read-only verification
scripts for Turnstile and Resend rotation`). Después de esto, sí — pausa y espera a que confirme que
activé PITR y/o cargué las claves antes de tocar nada más de P1. Te aviso apenas tenga alguna de las dos
cosas hechas.
