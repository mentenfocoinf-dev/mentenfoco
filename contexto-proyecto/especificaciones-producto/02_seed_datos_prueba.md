# Spec — Datos de prueba longitudinales (5+ sesiones por paciente)

## Por qué

`clinical_alerts` y `patient_anamnesis` estaban en 0 filas — toda la capa clínica (anamnesis,
evaluaciones, alertas, notas firmadas) nunca se había ejercitado de punta a punta con datos que
parezcan un caso real. El pedido explícito fue "generar informes y datos de los pacientes de mínimo 5
sesiones cada una para verificar que no solo tengamos una interfaz bonita sino también funcional".

## Qué hace el script

`seed_clinical_demo_data.cjs` (raíz del proyecto, mismo patrón que `seed_users.cjs` y
`link_test_patient_therapist.cjs` — Service Role Key, sin pasar por RLS). Para cada uno de los 4
perfiles de paciente de prueba (`paciente.free`, `paciente.esencial`, `paciente.integral`,
`paciente.premium`), siembra un caso clínico completo y distinto entre sí (para que la demo no se vea
repetitiva):

| Perfil | Motivo de consulta | Espaciado de sesiones | Alerta de crisis |
|---|---|---|---|
| Free | Ansiedad laboral | 30 días (respeta el límite freemium) | No |
| Esencial | Depresión post-ruptura | 7 días | No |
| Integral | Duelo complicado | 7 días | Sí — riesgo Bajo, resuelta con `session_scheduled` |
| Premium | Trastorno de pánico | 7 días | Sí — riesgo Moderado, resuelta con `contacted_patient` |

Cada uno queda con: anamnesis completa, 5 sesiones (`therapy_sessions`, status `completada`), 5 notas
clínicas firmadas (`clinical_notes`, con diagnóstico CIE-11 real buscado en vivo contra
`cie11_directory`, no inventado), y 10 evaluaciones (PHQ-9 + GAD-7 por sesión) con una **tendencia de
mejora** de la primera a la última — para que el gráfico de tendencia en `PatientDashboard.tsx` y la
nueva línea de tiempo de `01_informes_y_evoluciones_medicas.md` tengan algo real que mostrar.

Los diagnósticos CIE-11 se buscan en tiempo real contra la tabla `cie11_directory` ya sembrada (por
palabra clave: "ansiedad", "depres", "duelo", "pánico") en vez de hardcodear un código exacto que yo no
puedo verificar sin acceso a la base real — así el script se auto-corrige si los códigos sembrados no
coinciden exactamente con lo que yo recordaba.

## Cómo correrlo

```
node seed_clinical_demo_data.cjs
```

Requiere que `seed_users.cjs` ya haya corrido antes (las 6 cuentas `@test.com` deben existir). Enlaza
automáticamente a cada paciente con `terapeuta@test.com` si no lo estaban ya.

## Qué verificar después de correrlo

1. Login como cada uno de los 4 pacientes → "Mi progreso" debe mostrar el gráfico de tendencia con 5
   puntos bajando (mejora).
2. Login como `terapeuta@test.com` → el nuevo "Historial clínico" (ver spec 01) debe mostrar los 4
   pacientes con su última nota y última evaluación, y las 2 alertas ya resueltas.
3. Login como `admin@test.com` → el nuevo panel de supervisión (spec 01) debe mostrar actividad real,
   no ceros.
4. Abrir "Informe Clínico" de cualquiera de los 4 pacientes y confirmar que el historial de notas
   firmadas (pestaña dentro del modal) muestra las 5 sesiones sembradas.
