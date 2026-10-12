# Aprendizaje de Costaviva — semana 2026-W42

Generado el 2026-10-12 por el aprendizaje semanal (sin IA, `aprendizaje-semanal.yml`). Contrato de comun: `estandares/aprendizaje.md`. Detalle técnico en `datos-robots/aprendizaje/`; propuestas en `aprendizaje/propuestas.json`; señales en `aprendizaje/senales.json`.

## Estado del bucle

- Aprendizaje semanal: corrió el 2026-10-12 (ok). Salidas usadas: 2.
- Banco de pruebas: 0 salidas recalculadas con el tiempo de su día y 2 con lo que guardó el diario. sin OPEN_METEO_API_KEY: no se recalcula con series (solo términos guardados).
- Retadores en la sombra: 3. Reglas con peso ajustado por los datos: 0.
- Propuestas abiertas: 0. Las decides en el Issue semanal de comun.

## En una frase

Con 2 salidas, cuando el índice está más alto se pesca (falta alguna salida sin pesca para saberlo) (AUC —); se pescó algo en el 100 % de las salidas.
0 cambio(s) aplicados solos y 0 pregunta(s) para ti.

## Te pregunto (sí o no)

Nada esta semana.

## Cambios que se han aplicado solos

Ninguno: los datos todavía no piden mover nada con seguridad.

Barreras: solo el peso (confianza) de reglas expertas, como mucho ±20 % por semana y ±50 % del valor de la persona, nunca cambia el signo, 30 salidas o más donde actuó y de 5 personas o más (nunca de una sola), mejora comprobada en las salidas más recientes, el panel de referencia no se mueve más de 3 puntos de media, tests en verde y como mucho 3 cambios. Un "no" tuyo lo deshace y bloquea esa regla.

## Qué tal acierta el índice


| Índice | Salidas | Se pescó algo |
|---|---|---|
| 40-60 | 1 | 100 % |
| 60-80 | 1 | 100 % |

## Vigilancia de los datos

- Etiquetas de olas de Claude (rutina diaria): último dato hace 91 h (se espera cada 48 h)
- Observaciones abiertas GBIF (martes): sin datos
- el modelo da -30 % frente a la boya Bilbao-Vizcaya (exterior) (8 lecturas)
- el sesgo frente a Bilbao II (costera) ha cambiado: de 0.80 a 1.01
- la calibración de castrourdiales/principal empeora: error 50 % → 100 %
- la calibración de hondarribia/bocana empeora: error 50 % → 100 %
- la calibración de sopelana/principal empeora: error 50 % → 63 %
- la calibración de zarautz/dinamico empeora: error 50 % → 69 %

## Retadores en la sombra

- `calamar-luna-llena` (Calamar: mejor con luna llena de noche): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.
- `levante-confianza-05` (Levante en el Cantábrico con menos peso (0,7 → 0,5)): no gana al índice actual en 2 salidas (probabilidad de mejora 0 %); movería el índice 0,1 puntos de media.
- `lisa-rio-crecido` (Río crecido: la lisa entra en la desembocadura): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.

## Frentes, clorofila y corrientes (en la sombra)

Se mira, para cada modalidad y cada especie, si pescar cerca de un borde de clorofila, de un cambio de temperatura, de una corriente que junta el agua (o con agua azul, verdosa o con floración, o con corriente fuerte) cambia lo que ya decía el índice, sin suponer de antemano si ayuda o estorba. No toca el índice en vivo.
- Salidas con la capa de su día: 2 de 2. 3 fechas de salida sin capa de frentes (la copia diaria empezó el 2026-10-09 o falló ese día): esas salidas no cuentan en la sombra de frentes.
- Ninguna combinación supera todavía las barreras (80 salidas, 15 con y 15 sin captura, 30 con y 30 sin el rasgo, 5 personas o más, efecto de 3 desviaciones y mejora en las salidas recientes). Todas siguen en la sombra, acumulando salidas.

## Temperatura del agua: sonda frente al modelo

Quien mide el agua con su sonda la apunta en el diario. Se compara con lo que decía el modelo a esa hora y en ese punto (Open-Meteo, la capa IBI de Copernicus y la boya si se usó), por zona. No cambia nada solo.
- Medidas con sonda: 1.
- Ninguna zona supera todavía las barreras (30 medidas, 5 personas o más, sesgo de 0,3 °C o más, 3 errores típicos y que se mantenga en las medidas recientes).

## Para etiquetar (lo que más enseña)

- Cámara berria (dinamico), 2026-10-08 16:37 UTC: cámara y modelo discrepan mucho.
- Cámara donostia (principal), 2026-10-10 11:07 UTC: cámara y modelo discrepan mucho.
- Cámara donostia (principal), 2026-10-08 11:02 UTC: cámara y modelo discrepan mucho.
- Cámara deba (rompiente), 2026-10-09 15:07 UTC: cámara y modelo discrepan mucho.
- Cámara castrourdiales (principal), 2026-10-09 11:07 UTC: cámara y modelo discrepan mucho.
- Cámara orio (principal), 2026-10-10 09:07 UTC: cámara y modelo discrepan mucho.

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
