# Saldo de API — auditoría automática (2026-09-28)

Generado por `scripts/saldo/auditar-consumo-api.mjs` sin usar IA. Repos analizados: Costaviva, polizas-ai, etxeapala, Lurnahi. Objetivo: 20 €/semana entre todas las apps.

## Gasto real (últimos 7 días)
Sin medir: falta el secret `ANTHROPIC_ADMIN_KEY` (clave de administración `sk-ant-admin...` creada en la consola de Anthropic). Con ella este apartado da el gasto real y no solo la estimación de abajo.

## Robots de agente (CLI de Claude en GitHub Actions)
Estimación de orden de magnitud: sesiones/semana × turnos × contexto por turno. Sirve para ordenar, no para facturar.

| App | Workflow | Sesiones/sem | Modelo | Turnos máx | Web | CLAUDE.md cargado | Estimado/sem | Avisos |
|---|---|---|---|---|---|---|---|---|
| Costaviva | `.github/workflows/robot-buscador-fuentes.yml` | 32 | claude-sonnet-5 | 60 | sí | 146 KB | 41 € | R3 carga CLAUDE.md de 146 KB en cada turno; R4 32 sesiones/semana; R5 web con más de 40 turnos |
| Costaviva | `.github/workflows/daily-report.yml` | 7 | por defecto | sin límite | no | 146 KB | 15 € | R1 sin --max-turns; R2 sin --model; R3 carga CLAUDE.md de 146 KB en cada turno |
| Costaviva | `.github/workflows/robot-camaras-caidas.yml` | 7 | claude-sonnet-5 | 80 | sí | 146 KB | 12 € | R3 carga CLAUDE.md de 146 KB en cada turno; R5 web con más de 40 turnos |
| Costaviva | `.github/workflows/robot-patrones-uso.yml` | 1 | claude-sonnet-5 | 30 | no | 146 KB | 0.6 € | R3 carga CLAUDE.md de 146 KB en cada turno |
| Costaviva | `.github/workflows/robot-mejores-practicas.yml` | 1 | claude-sonnet-5 | 50 | no | no | 0.3 € | — |
| Costaviva | `.github/workflows/robot-experiencia-usuario.yml` | 1 | claude-sonnet-5 | 30 | no | no | 0.2 € | — |

**Total estimado de robots: 69 €/semana** (objetivo de todo: 20 €).

## Llamadas a la API desde el código de las apps
El gasto aquí depende del uso real (subidas, preguntas...), que este auditor no ve. Lo que sí ve son los patrones caros.

| App | Fichero | Modelos | max_tokens máx | Contexto metido en el prompt | Avisos |
|---|---|---|---|---|---|
| polizas-ai | `functions/api/polizas/_claude.js` | claude-sonnet-5 | 16000 | — | R7 no registra usage; R8 max_tokens 16000 |
| polizas-ai | `functions/api/polizas/_verificacion.js` | — | 32000 | VIGILANCIA_REGLAS.md (12 KB), VERIFICACION_CALIBRACION.md (612 KB) | R6 mete VERIFICACION_CALIBRACION.md (612 KB) en el prompt; R8 max_tokens 32000 |
| Lurnahi | `functions/api/analyze.js` | claude-sonnet-5 | 16000 | — | R7 no registra usage; R8 max_tokens 16000 |
| Costaviva | `functions/identificar-captura.js` | claude-haiku-4-5-20251001 | 300 | — | R7 no registra usage |
| polizas-ai | `functions/api/polizas/_extraccion.js` | claude-sonnet-5 | 32000 | — | R8 max_tokens 32000 |
| etxeapala | `functions/ai.js` | claude-sonnet-4-6, claude-haiku-4-5 | 4096 | — | R7 no registra usage |
| Lurnahi | `functions/api/claude.js` | claude-sonnet-5 | — | — | R7 no registra usage |
| Lurnahi | `functions/cron-learning-agent.js` | claude-sonnet-5 | 4000 | — | R7 no registra usage |
| Lurnahi | `functions/cron-nightly-digest.js` | claude-sonnet-5 | 2000 | — | R7 no registra usage |
| polizas-ai | `functions/api/polizas/_escenarios.js` | claude-sonnet-5 | 8192 | REGLAS_RELACION_LEGAL.md (25 KB) | — |
| polizas-ai | `functions/api/polizas/bien-declarado.js` | claude-sonnet-5 | 200 | — | — |
| polizas-ai | `functions/api/polizas/comparar-cotizacion.js` | claude-sonnet-5 | 4096 | — | — |
| polizas-ai | `functions/api/polizas/evento-vida-custom.js` | claude-sonnet-5 | 1024 | — | — |
| polizas-ai | `functions/api/polizas/miembro-familia.js` | claude-sonnet-5 | 200 | — | — |
| polizas-ai | `functions/api/polizas/pregunta.js` | claude-sonnet-5 | 8192 | — | — |
| etxeapala | `recetas.html` | claude-haiku-4-5 | 500 | — | — |
| etxeapala | `subir.html` | claude-sonnet-4-6 | 2048 | — | — |
| etxeapala | `tarjetas.html` | claude-haiku-4-5 | 400 | — | — |
| Lurnahi | `agente-clasificador.html` | claude-sonnet-5 | 2000 | — | — |
| Lurnahi | `agente-vigilancia.html` | claude-sonnet-5 | 500 | — | — |
| Lurnahi | `auditoria.html` | claude-sonnet-5 | 12000 | — | — |
| Lurnahi | `contrapartes.html` | claude-sonnet-5 | 400 | — | — |
| Lurnahi | `documentos.html` | claude-sonnet-5 | 700 | — | — |
| Lurnahi | `informes.html` | claude-sonnet-5 | 3000 | — | — |
| Lurnahi | `libreria.html` | claude-sonnet-5 | 1000 | — | — |
| Lurnahi | `movimientos.html` | claude-sonnet-5 | 300 | — | — |

## Fuera del alcance de este auditor
- **Rutinas en la nube de Claude** (claude.ai → Routines): se pagan con el plan de Claude, no con el saldo de la API, y no viven en ningún repo.
- **Frecuencia real de uso** de las funciones de las apps: solo se puede medir registrando `usage` (regla R7) o con `ANTHROPIC_ADMIN_KEY`.
