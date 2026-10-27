<!-- SINTESIS fecha=2026-10-27 hasta_commit=1a861d2d00ec51c81324c7f842263c3e86225609 -->

## 🛠 Trabajo interno (calibración y datos)
El robot de cámaras caídas pasó a las 04:50 UTC con datos frescos (03:03 UTC). En rojo: alicante, torreblanca y benicassim (`origen_404`, sin cambios desde ayer; benicassim queda pendiente de verla de día), mutriku y orio (`sin_respuesta`) y mundaka, bakio y pasaia (`frame_congelado`, lectura nocturna, no se tocan). En el servidor de la Diputación de Gipuzkoa los streams de Orio y Mutriku dan 404 (también con otros nombres probados), mientras Zarautz, Deba y Hondarribia dan 200: la emisión está parada en origen, igual que Zumaia desde hace días. No hay alternativa verificada. Mutriku está en rojo desde ayer 16:30 UTC. Sin cambios de código.
**Cámaras nuevas encontradas:** 0
**Términos de búsqueda:** no se probaron términos de webcams nuevos; para la próxima pasada se sugiere buscar si la Diputación publica el listado ("camaramar", "streamlock GIP"). No apareció ningún tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso
**Robot de experiencia de usuario:** no le tocaba pasar hoy (sin entrada nueva).
**Robot de patrones de uso:** no le tocaba pasar esta semana (sin entrada nueva).

## 🔎 Trabajo externo (investigación de contenido)
La pasada de caudal de ríos y estaciones de monte (05:00 UTC) no trató buenas prácticas de otras apps ni estudios institucionales; no hay novedades en esos temas.
**Robot de especies:** no le tocaba pasar hoy (sin entrada nueva).

## 🆕 Nuevas fuentes encontradas, pendientes de validar
### Red foronómica de MeteoGalicia + Augas de Galicia (caudal y nivel de ríos gallegos)
Un servicio JSON oficial (`servizos.meteogalicia.gal/mgafos/json/estadoActual.action`) da caudal y nivel actuales de las estaciones de aforo en servicio, y cubriría ríos gallegos que hoy no tienen caudal. Es público y gratuito pero exige una clave personal pedida por email a `administracion-web.meteogalicia@xunta.gal` (puede pedirse con `datos@costaviva.org`); sin clave responde una página de error. Su licencia de reutilización no está verificada. Opinión: parece sólida (fuente oficial, mismo patrón que AEMET), pero integrarla exige clave y tocar `functions/`. **Decisión para Mikel:** pedir la clave por email, como con Euskalmet.
Además: los ríos vascos (URA) siguen sin endpoint directo y Euskalmet sigue pendiente de clave; `snirh.apambiente.pt` (403) y `saihebro.com` (sin respuesta) no se pudieron comprobar desde la sesión, no se dan por caídos.
