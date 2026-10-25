<!-- SINTESIS fecha=2026-10-25 hasta_commit=c87db9e2ac40fe30f5c34dc503852f93bb5e6e72 -->

## 🛠 Trabajo interno (calibración y datos)

El robot de cámaras caídas (04:50 UTC) revisó el estado de las cámaras: en rojo alicante, torreblanca, mundaka, benicassim (`origen_404`), zumaia (`sin_respuesta`) y pasaia (`frame_plano`), más una congelada. Mundaka sigue en 404 en kostasystem y no hay alternativa verificable. Zumaia: también devuelven 404 `GIP_zarautz.stream` y la raíz del Wowza, así que parece una caída general del servidor de la Diputación esta noche; se reintenta de día. Pasaia: la imagen de detectia responde 200 pero no se actualiza desde el 24-oct 18:04 GMT. Sin cambios de código. La pasada buscadora de presión no integró nada. No hay entrada de calibración nocturna en el texto nuevo.

**Cámaras nuevas encontradas:** 0

**Términos de búsqueda:** el robot de cámaras probó "Mundaka webcam en directo ola izquierda cámara" (zona Bizkaia); solo devolvió agregadores (Surf-Forecast) con cámaras de escuelas sin URL propia verificable. No apareció ningún tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso

**Robot de experiencia de usuario:** no le tocaba pasar hoy (no hay entrada suya en el texto nuevo).

**Robot de patrones de uso** (entrada del 24-oct): muestra muy pequeña: 9 perfiles, 3 usuarios activos en 7 días y 7 en 28. Checkout: 0 pulsaciones en 28 días (la última fue el 25-sep). ver_suscripcion sube a 9 filas en 7 días, pero de una sola persona. Propuestas, todas con la salvedad de n pequeña: (1) mirar la página de planes con ojos de nuevo usuario y volver a medir con 3 o más personas viéndola; (2) observar qué hacen justo tras el alta, porque 6 de 8 perfiles con más de una semana no están activos; (3) no quitar ninguna capa de mar; (4) no tocar diario, grupos ni SOS. Puntos ciegos: no hay evento para la píldora de modalidad, la ventana de actividad, la capa de flota (AIS), la hoja de condiciones ni «Tus datos». Propone añadir `registrarEvento` a `ponerModalidad` y a la capa de flota. No está aplicado.

## 🔎 Trabajo externo (investigación de contenido)

La pasada buscadora (04:55 UTC) se centró en presión atmosférica. No hay entradas nuevas de buenas prácticas de otras apps ni de estudios institucionales.

**Robot de especies:** no le tocaba pasar hoy.

## 🆕 Nuevas fuentes encontradas, pendientes de validar

### IPMA (Portugal): observaciones horarias por estación
`api.ipma.pt/open-data/observation/meteorology/stations/observations.json` vuelve a responder 200. Da observaciones horarias de las últimas 24 h por estación, con presión (`pressao`, hPa), temperatura, viento y precipitación acumulada. No necesita clave. Aportaría presión real en Portugal, hoy solo con presión de modelo, al estilo de `ESTACIONES_AEMET`. Opinión: parece sólida y barata de integrar, pero su licencia no está verificada y integrarla toca `functions/`, así que es solo propuesta. Verificar la licencia antes de decidir. Siguen sin verificar `meteogalicia.gal/observacion/rest/getEstacionsMeteo` (404, la ruta puede haber cambiado) y `meteo.cat` (responde 200).
