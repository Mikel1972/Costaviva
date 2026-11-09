# Aprendizaje de Costaviva — semana 2026-W46

Generado el 2026-11-09 por el aprendizaje semanal (sin IA, `aprendizaje-semanal.yml`). Contrato de comun: `estandares/aprendizaje.md`. Detalle técnico en `datos-robots/aprendizaje/`; propuestas en `aprendizaje/propuestas.json`; señales en `aprendizaje/senales.json`.

## Estado del bucle

- Aprendizaje semanal: corrió el 2026-11-09 (ok). Salidas usadas: 7.
- Banco de pruebas: 0 salidas recalculadas con el tiempo de su día y 7 con lo que guardó el diario. sin OPEN_METEO_API_KEY: no se recalcula con series (solo términos guardados).
- Retadores en la sombra: 3. Reglas con peso ajustado por los datos: 0.
- Propuestas abiertas: 1. Las decides en el Issue semanal de comun.

## En una frase

Con 7 salidas, cuando el índice está más alto se pesca casi igual que cuando está bajo (AUC 0,4); se pescó algo en el 71 % de las salidas.
0 cambio(s) aplicados solos y 1 pregunta(s) para ti.

## Te pregunto (sí o no)

- **Medir el acierto de la talla que calcula la foto** (`costaviva-talla-foto-estimada-vs-medida`, impacto 2, riesgo bajo: una columna nueva opcional en capturas; requiere migración SQL con el flujo probar/aplicar.). Cuando la foto de una captura calcula la talla, guardar ese cálculo aparte de la talla que apunta el pescador (si la cambia). Así se sabe cuánto acierta la foto por especie y se puede mostrar «suele acertar ±2 cm». Para deshacerlo: quitar la columna talla_estimada_cm de capturas (no la usa nada más). _Evidencia:_ 1 caso: sargo de 2026-11-08, la foto calculó 30 cm y medía 30 cm; hoy no se guarda el cálculo, así que no se puede medir el acierto..

## Cambios que se han aplicado solos

Ninguno: los datos todavía no piden mover nada con seguridad.

Barreras: solo el peso (confianza) de reglas expertas, como mucho ±20 % por semana y ±50 % del valor de la persona, nunca cambia el signo, 30 salidas o más donde actuó y de 5 personas o más (nunca de una sola), mejora comprobada en las salidas más recientes, el panel de referencia no se mueve más de 3 puntos de media, tests en verde y como mucho 3 cambios. Un "no" tuyo lo deshace y bloquea esa regla.

## Qué tal acierta el índice


| Índice | Salidas | Se pescó algo |
|---|---|---|
| 40-60 | 1 | 100 % |
| 60-80 | 6 | 66.7 % |

## Vigilancia de los datos

- Presión real por spot (cada hora): último dato hace 5 h (se espera cada 2 h)
- el modelo da -30 % frente a la boya Bilbao-Vizcaya (exterior) (8 lecturas)
- el modelo da -23 % frente a la boya Bilbao II (costera) (153 lecturas)
- la calibración de berria/dinamico empeora: error 78 % → 100 %
- la calibración de orio/principal empeora: error 71 % → 100 %
- la calibración de sopelana/principal empeora: error 75 % → 99 %
- el índice de las salidas de esta semana se ha desplazado frente al mes anterior (PSI 17,782)

## Retadores en la sombra

- `calamar-luna-llena` (Calamar: mejor con luna llena de noche): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.
- `levante-confianza-05` (Levante en el Cantábrico con menos peso (0,7 → 0,5)): no gana al índice actual en 7 salidas (probabilidad de mejora 0 %); movería el índice 0,1 puntos de media.
- `lisa-rio-crecido` (Río crecido: la lisa entra en la desembocadura): sin resultado publicable (sin casos evaluables); movería el índice 0 puntos de media.

## Frentes, clorofila y corrientes (en la sombra)

Se mira, para cada modalidad y cada especie, si pescar cerca de un borde de clorofila, de un cambio de temperatura, de una corriente que junta el agua (o con agua azul, verdosa o con floración, o con corriente fuerte) cambia lo que ya decía el índice, sin suponer de antemano si ayuda o estorba. No toca el índice en vivo.
- Salidas con la capa de su día: 7 de 7. 3 fechas de salida sin capa de frentes (la copia diaria empezó el 2026-10-09 o falló ese día): esas salidas no cuentan en la sombra de frentes.
- Ninguna combinación supera todavía las barreras (80 salidas, 15 con y 15 sin captura, 30 con y 30 sin el rasgo, 5 personas o más, efecto de 3 desviaciones y mejora en las salidas recientes). Todas siguen en la sombra, acumulando salidas.

## Temperatura del agua: sonda frente al modelo

Quien mide el agua con su sonda la apunta en el diario. Se compara con lo que decía el modelo a esa hora y en ese punto (Open-Meteo, la capa IBI de Copernicus y la boya si se usó), por zona. No cambia nada solo.
- Medidas con sonda: 3.
- Ninguna zona supera todavía las barreras (30 medidas, 5 personas o más, sesgo de 0,3 °C o más, 3 errores típicos y que se mantenga en las medidas recientes).

## Para etiquetar (lo que más enseña)

- Cámara mutriku (principal), 2026-11-05 09:08 UTC: cámara y modelo discrepan mucho.

Se etiquetan en `etiquetar-olas.html` (admin) o con la rutina de etiquetado.

## Lo que sueles aceptar

- regla: 1 sí y 0 no (peso para ordenar: 0,67).

## Ideas para más adelante

- Botón '¿Acertó el índice hoy?' en el panel del spot para quien no usa el diario (necesita una tabla nueva con RLS y probarlo en la preview).
- Calcular los retadores también en vivo al guardar cada salida (indice_factores.sombra), no solo al rejugar los sábados.
- Calibración isotónica del número que se enseña (índice → probabilidad real de pescar) cuando haya 300 salidas o más.
- Ajustar también umbrales de las reglas (no solo su peso) con una búsqueda acotada y el mismo banco de pruebas.
- Validar la temporada con desembarcos oficiales de lonja (cuarta estrella de fiabilidad).
- Pesar menos las salidas con hora estimada (sin hora de inicio) o con condiciones parciales.
- Elegir qué retador probar primero con muestreo de Thompson cuando haya muchos.
