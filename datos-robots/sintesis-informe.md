<!-- SINTESIS fecha=2026-10-08 hasta_commit=557c4fb6757bca3dd83c68bda37ab45ca4015d51 -->

## 🛠 Trabajo interno (calibración y datos)

La calibración nocturna sumó un nuevo punto para las 3 boyas obligatorias y el octavo para Dragonera. Con oleaje alto en el Cantábrico (más de 3 m), Pasaia II sigue con su desviación de siempre (−36 % hoy; media −26,8 % en 35 puntos) y el factor x1,38 ya aplicado se mantiene. No se propone ningún factor nuevo. La siguiente candidata de la rotación es Barcelona II. Las boyas y la de Nazaré responden bien. **Bug de severidad media sin arreglar:** `datosCaudalCantabrico()` en `functions/prevision.js` cruza filas de la tabla cuando una estación trae sus umbrales en "-". Por eso `sella` (Arriondas) muestra el caudal del Piloña (39,89 m³/s en vez de 279,82) como si fuera correcto, y `ason` sale S/D aunque el dato real existe (92,35 m³/s). El robot no lo tocó porque obliga a reescribir el parsing; propone dividir el HTML por filas. El robot de cámaras caídas revisó Comillas, Alicante y Oliva: Oliva se recuperó sola. Alicante da 404 constante y la única alternativa que respondió (`AlicanteExplanada`) no ve el mar. Comillas depende de `cantabria.es`, que sigue caído. Orio sigue intermitente en origen.

**Cámaras nuevas encontradas:** 0

**Términos de búsqueda:** "webcam Comillas Cantabria playa en directo" (zona Cantabria, sin resultados útiles). El 7 de octubre se probaron para Zumaia "Itzurun webcam Zumaia en directo cámara mar" y "zumaia.eus webcam playa Itzurun", sin cámara independiente; el robot sugiere probar en euskera ("Itzurun hondartza kamera zuzenean"). Ningún término funcionó por primera vez ni apareció un tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso

**Robot de experiencia de usuario:** no le tocaba pasar hoy (corre los lunes) y no dejó entrada.

**Robot de patrones de uso:** no le tocaba pasar esta semana (corre los sábados).

## 🔎 Trabajo externo (investigación de contenido)

Los robots de investigación de contenido (buenas prácticas de otras apps, estudios institucionales) no dejaron nada nuevo en `ROBOT.md` en este periodo.

**Robot de especies:** hoy es jueves, pero no hay entrada suya en `ROBOT.md` en el periodo analizado.

## 🆕 Nuevas fuentes encontradas, pendientes de validar

Ninguna fuente nueva desde la última síntesis.
