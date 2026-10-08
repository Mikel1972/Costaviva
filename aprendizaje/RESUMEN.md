# Aprendizaje de Costaviva — semana 2026-W41

Generado el 2026-10-08 por el aprendizaje semanal (sin IA, `aprendizaje-semanal.yml`). Contrato de comun: `estandares/aprendizaje.md`. Detalle técnico en `datos-robots/aprendizaje/`; propuestas en `aprendizaje/propuestas.json`; señales en `aprendizaje/senales.json`.

## Estado del bucle

- Aprendizaje semanal: corrió el 2026-10-08 (error). Salidas usadas: 0.
- Banco de pruebas: 0 salidas recalculadas con el tiempo de su día y 0 con lo que guardó el diario. sin OPEN_METEO_API_KEY: no se recalcula con series (solo términos guardados).
- Retadores en la sombra: 3. Reglas con peso ajustado por los datos: 0.
- Propuestas abiertas: 0. Las decides en el Issue semanal de comun.
- ⚠ sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: pasada sin casos

## En una frase

Todavía no hay salidas del diario con índice para aprender: el sistema está listo y empezará en cuanto las haya.
0 cambio(s) aplicados solos y 0 pregunta(s) para ti.

## Te pregunto (sí o no)

Nada esta semana.

## Cambios que se han aplicado solos

Ninguno: los datos todavía no piden mover nada con seguridad.

Barreras: solo el peso (confianza) de reglas expertas, como mucho ±20 % por semana y ±50 % del valor de la persona, nunca cambia el signo, 30 salidas o más donde actuó y de 5 personas o más (nunca de una sola), mejora comprobada en las salidas más recientes, el panel de referencia no se mueve más de 3 puntos de media, tests en verde y como mucho 3 cambios. Un "no" tuyo lo deshace y bloquea esa regla.

## Qué tal acierta el índice


## Vigilancia de los datos

- Salud de las cámaras: último dato hace 14 h (se espera cada 6 h)
- Observaciones abiertas GBIF (martes): sin datos
- el modelo da -22 % frente a la boya Bilbao II (costera) (19 lecturas)

## Retadores en la sombra

- `calamar-luna-llena` (Calamar: mejor con luna llena de noche): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.
- `levante-confianza-05` (Levante en el Cantábrico con menos peso (0,7 → 0,5)): sin resultado publicable (sin casos evaluables); movería el índice 0,1 puntos de media.
- `lisa-rio-crecido` (Río crecido: la lisa entra en la desembocadura): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.

## Para etiquetar (lo que más enseña)

- Cámara berria (dinamico), 2026-10-08 16:37 UTC: cámara y modelo discrepan mucho.
- Cámara donostia (principal), 2026-10-08 11:02 UTC: cámara y modelo discrepan mucho.
- Cámara mundaka (principal), 2026-10-08 16:21 UTC: cámara y modelo discrepan mucho.
- Cámara zumaia (c), 2026-10-08 11:10 UTC: cámara y modelo discrepan mucho.
- Cámara bakio (principal), 2026-10-08 11:10 UTC: cámara y modelo discrepan mucho.
- Cámara sopelana (principal), 2026-10-08 11:04 UTC: ola fuera del rango ya calibrado.

Se etiquetan en `etiquetar-olas.html` (admin) o con la rutina de etiquetado.

## Lo que sueles aceptar

Aún no hay decisiones. El orden de las propuestas usa impacto × (aceptadas + 1) / (decididas + 2) por tipo, como el resumen de comun.

## Ideas para más adelante

- Botón '¿Acertó el índice hoy?' en el panel del spot para quien no usa el diario (necesita una tabla nueva con RLS y probarlo en la preview).
- Calcular los retadores también en vivo al guardar cada salida (indice_factores.sombra), no solo al rejugar los sábados.
- Calibración isotónica del número que se enseña (índice → probabilidad real de pescar) cuando haya 300 salidas o más.
- Ajustar también umbrales de las reglas (no solo su peso) con una búsqueda acotada y el mismo banco de pruebas.
- Validar la temporada con desembarcos oficiales de lonja (cuarta estrella de fiabilidad).
- Pesar menos las salidas con hora estimada (sin hora de inicio) o con condiciones parciales.
- Elegir qué retador probar primero con muestreo de Thompson cuando haya muchos.
