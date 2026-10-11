<!-- SINTESIS fecha=2026-10-11 hasta_commit=5c0c456e665ae554b8a78efb7719c511e9b29815 -->

## 🛠 Trabajo interno (calibración y datos)

La calibración nocturna sigue ciega por cuarta noche seguida: el servicio de datos de Puertos del Estado (`poem.puertos.es`) responde error 500 a cualquier consulta con datos reales desde el 2026-10-08, así que no se escribió ningún punto nuevo ni se propone ningún factor (Pasaia II mantiene el x1.38; la siguiente en rotar es Barcelona II). No afecta a usuarios: el mapa usa la instantánea de Copernicus. El resto de la salud de datos está sana: boya de Nazaré, caudales del Cantábrico, Júcar, Segura y Galicia, y 4 de 5 webcams de muestra (`santona` sigue sin servicio por el bloqueo de cantabria.es, activo desde el 2026-09-25).
El robot de cámaras caídas revisó 8 en rojo: Mundaka, Corrubedo y Bakio son de noche y se recuperarán con el día; Pasaia lleva 4 días congelada (fuente AZTI/Detectia parada) sin alternativa encontrada; Alicante sigue en 404; las tres de SOCIB (muro, calamillor, sonbou) esperan decisión de Mikel (error 522 desde el edge de Cloudflare).

**Cámaras nuevas encontradas:** 0

**Términos de búsqueda:** "webcam Pasaia bocana puerto en directo" (Pasaia), sin resultado útil. Para la próxima: "Pasaia kamera portua", "cámara Pasajes puerto", web del Ayuntamiento y Autoridad Portuaria. No hay tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso

**Robot de experiencia de usuario:** no le tocaba pasar hoy (corre los lunes).

**Robot de patrones de uso:** pasó el 2026-10-10, con muestra muy pequeña (6 perfiles, 4 usuarios activos en 7 días, 425 eventos desde el 2026-09-17). Propuestas, todas con la salvedad de n=4:
1. Embudo de pago parado: 2 personas llegaron al checkout el 25-sep (11 pulsaciones) y nadie más lo ha intentado en 15 días pese a 2 altas nuevas (ver_suscripcion 0 en 7 días). Mirar cuántas altas recientes han visto `suscripcion.html` antes de tocar precios o diseño.
2. Activación: 2 de 4 perfiles con más de una semana no han hecho nada; solo observar.
3. Capas de mar nuevas: temperatura 19/2, clorofila 18/2, corriente 11/2, frentes 20/1 (filas/usuarios); esperar ≥ 4 semanas antes de decidir nada.
4. Diario y grupos casi sin uso (1 persona); el SOS no se toca.
Punto ciego: la ventana de actividad no tiene evento propio; propone añadir `ver_ventana_actividad` y `cambiar_modalidad` (no aplicado).

## 🔎 Trabajo externo (investigación de contenido)

Sin novedades de buenas prácticas de otras apps ni de estudios institucionales en las últimas entradas de ROBOT.md.

**Robot de especies:** no le tocaba pasar hoy (corre los jueves).

## 🆕 Nuevas fuentes encontradas, pendientes de validar

Ninguna fuente nueva desde la última síntesis.
