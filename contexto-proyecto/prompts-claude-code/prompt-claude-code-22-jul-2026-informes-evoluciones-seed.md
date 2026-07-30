# Prompt para Claude Code — Historial clínico, datos de prueba, y búsqueda dual CIE-11/DSM-5

Contexto: auditoría de hoy encontró que los informes/notas clínicas que ya se generan
(`ClinicalReportModal.tsx`) no se ven en ningún otro lugar de la app — ni el terapeuta tiene una vista
agregada de sus pacientes, ni el admin tiene visibilidad de nada de esto. Además, `clinical_alerts` y
`patient_anamnesis` seguían en 0 filas: nunca se probó el circuito clínico completo con datos que
parezcan reales. Las 3 specs completas están en `contexto-proyecto/especificaciones-producto/`. Este
prompt las consolida en un plan de ejecución.

**Nota:** no tengo acceso de red a Supabase ni un navegador para hacer login en los 6 perfiles de
prueba desde mi sandbox — todo lo de abajo lo diseñé leyendo el código real del repo. Te pido que
verifiques cada punto contra la app corriendo, no que asumas que mi lectura del código es la última
palabra.

## Orden de ejecución sugerido

### 1. Sembrar los datos de prueba primero (para tener con qué probar todo lo demás)

```
node seed_clinical_demo_data.cjs
```

Detalle completo en `contexto-proyecto/especificaciones-producto/02_seed_datos_prueba.md`. Verifica
que corrió bien: 4 pacientes con 5 sesiones + notas + evaluaciones cada uno, y 2 alertas de crisis ya
resueltas (integral y premium). Si algún nombre de columna no coincide con el esquema real (lo escribí
sin poder consultar la base en vivo), ajústalo con criterio — el propósito del script es claro aunque
algún detalle de columna necesite corrección.

### 2. Construir el historial clínico + panel de supervisión

Spec completa: `contexto-proyecto/especificaciones-producto/01_informes_y_evoluciones_medicas.md`.
Resumen: una sección nueva en `TherapistDashboard.tsx` con vista de lista (todos los pacientes,
ordenable por "más tiempo sin nota") y vista de detalle (línea de tiempo cruzando notas + evaluaciones
+ sesiones de un paciente); y un panel de solo lectura en `AdminDashboard.tsx` (conteo de notas por
terapeuta, pacientes sin ninguna nota, alertas sin resolver hace +24h). No requiere tablas nuevas, es
una capa de agregación sobre `clinical_notes`/`psychometric_evaluations`/`therapy_sessions`/`clinical_alerts`
que ya existen.

Pruébalo con los datos recién sembrados en el paso 1: si el historial no muestra las 5 sesiones de
cada paciente de prueba, algo quedó mal conectado.

### 3. Búsqueda dual CIE-11 / DSM-5-TR

Spec completa: `contexto-proyecto/especificaciones-producto/03_busqueda_dual_cie11_dsm5.md`. Resumen:
columna `sinonimos_dsm5 text[]` en `cie11_directory`, poblada solo para los diagnósticos de la demo
sembrada (ansiedad, depresión, duelo, pánico) — no el DSM-5-TR completo, por derechos de autor sobre
los criterios y para no fabricar códigos que no puedo verificar. `searchCie11` busca en ambos campos.
El diagnóstico que se guarda en la nota clínica sigue siendo siempre el código CIE-11, nunca un código
DSM-5 paralelo.

### 4. Verificación en vivo, en los 6 perfiles de prueba

El usuario pidió explícitamente entrar a cada uno de los 6 perfiles (`admin`, `terapeuta`,
`paciente.free/esencial/integral/premium`) y confirmar que la información que ve cada uno es correcta
y relevante — esto es algo que solo tú puedes hacer con acceso real a la app corriendo. Puntos
específicos a revisar mientras entras a cada uno:
- Login: el gate `resolveRequiredGate` (password → consentimiento → completar-perfil → anamnesis) no
  debe interferir con las 6 cuentas de prueba ya existentes (que no pasaron por signup ni por OAuth) —
  confirma que ninguna quedó atascada en una pantalla de gate que no le corresponde.
- Terapeuta: el nuevo historial clínico del paso 2 debe reflejar los datos sembrados.
- Admin: el nuevo panel de supervisión debe mostrar actividad real, no ceros ni errores de carga.
- Cada paciente: su gráfico de tendencia en "Mi progreso" debe mostrar las 5 evaluaciones sembradas con
  la mejora esperada.

## Qué hacer con este documento

1. Corre el paso 1, confirma que los datos quedaron bien antes de seguir.
2. Construye 2 y 3.
3. Haz el recorrido del paso 4 por los 6 perfiles y repórtame explícitamente qué encontraste — no solo
   "quedó listo", sino si algo se veía raro, vacío, o inconsistente en alguno de los 6 logins, aunque no
   esté en esta lista.
