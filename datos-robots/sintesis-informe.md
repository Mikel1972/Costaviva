<!-- SINTESIS fecha=2026-11-10 hasta_commit=b8218d0a078585ebc909684bb21453d596c37c3b -->

## 🛠 Trabajo interno (calibración y datos)
Hoy (martes) pasó el buscador de fuentes en la zona de caudal de ríos y estaciones de monte: sin novedades integrables y sin cambios de código. MeteoGalicia sigue exigiendo clave para el estado actual; Euskalmet y el SNIRH portugués dan 301/403 desde esta red (no se dan por caídos); no hay API pública de SAIH con licencia, así que la vía sigue siendo pedir acceso por email con datos@costaviva.org. El robot de cámaras caídas vio en rojo Orio (stream 404; probadas 5 variantes más de nombre y varias páginas de la Diputación, sin alternativa), Pasaia (`frame_plano`, esperable de noche), Alicante y Torreblanca (`origen_404` desde octubre, sin sustituto), Comillas (522), y Bakio y Mundaka (congelados de noche).
**Cámaras nuevas encontradas:** 0
**Términos de búsqueda:** "camaramar gipuzkoa orio webcam" (zona Gipuzkoa), sin resultado útil; no apareció ningún tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso
**Robot de experiencia de usuario:** hoy no le tocaba pasar; la última entrada es la del 2026-11-09. Hallazgos: (1) **turbidez congelada desde el 12-oct**: los 36 spots con etiqueta tienen `actualizado` entre 2026-10-06 y 2026-10-12 (~4 semanas). Causa probable: `datosTurbidezPorSpot()` (`functions/prevision.js` ~l.499-501) pide 90 días de `turbidez_historico` ordenados ascendente sin paginar y PostgREST corta en 1.000 filas (36 spots × ~27 días ≈ 1.000), quedándose con las más antiguas; la etiqueta "turbia/muy turbia" es la del 12-oct. Sin confirmar aún. (2) Mareas del Mediterráneo con extremos duplicados o sin alternar (Alicante `p14:00 p14:00`, Santa Pola, Guardamar, Orihuela Costa; Cartagena/Águilas dos pleamares seguidas) y coeficiente 35-79 sin sentido físico (ruido de centímetros). (3) Nubosidad 0 % aislada en Llanes, Ribadesella, Comillas y Santa Cruz de Tenerife: sospecha, no confirmada. (4) Viento muy desigual entre vecinos (Getaria 4 km/h entre Zumaia 28 y Orio 29), probable artefacto del modelo. (5) Boya Langosteira con agua a 11,8 °C frente a 13,7 °C del modelo. (6) Cámaras muertas desde hace semanas (Alicante, Torreblanca, Mundaka congelada desde 25-oct) y otras caídas hoy. (7) Caudales: `sella` null, Lagares = 0, y los del Cantábrico muy por debajo de su `umbralBajo` (¿unidades m³/s vs l/s? sin verificar). (8) `GET /identificar-captura` sin sesión devuelve 404 con HTML en vez de 401/405 (no gasta IA). Diario y cuenta B correctos; 0 spots con error.
**Robot de patrones de uso:** no le tocaba pasar esta semana.

## 🔎 Trabajo externo (investigación de contenido)
Sin entradas nuevas de buenas prácticas de otras apps ni de estudios institucionales en las últimas 24 h.
**Robot de especies:** hoy no le tocaba pasar (corre los jueves).

## 🆕 Nuevas fuentes encontradas, pendientes de validar
Ninguna fuente nueva desde la última síntesis.
