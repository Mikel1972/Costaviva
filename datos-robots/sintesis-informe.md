<!-- SINTESIS fecha=2026-11-15 hasta_commit=cf9295ec0ff68c328bc5d80a265e439948de434c -->

## 🛠 Trabajo interno (calibración y datos)
El robot de cámaras caídas (14-nov) vio en rojo Orio (sin respuesta), Pasaia (imagen plana: la fuente publica una sola imagen al día, igual que ayer), San Vicente (cantabria.es corta la conexión desde la red de la rutina, sin verificar) y Cambrils en Windy (inactiva; hay que buscarle sustituto). Bakio y Mundaka salen congeladas de noche, sin avería. No se tocó código. La pasada del 15-nov (presión atmosférica) comprobó que IPMA (Portugal) sigue respondiendo con presión real en 78 estaciones; falta verificar su licencia y elegir estaciones costeras (decisión tuya, toca prevision.js). MeteoGalicia sigue en 404.
**Cámaras nuevas encontradas:** 0
**Términos de búsqueda:** zona Asturias (14-nov): se miraron enterat.com y windfinder.com; los directos de Salinas (YouTube) no se pudieron comprobar visualmente, así que no se creó spot. Ningún término funcionó por primera vez ni apareció un tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso
**Robot de experiencia de usuario:** no le tocaba pasar hoy.
**Robot de patrones de uso (14-nov):** muestra muy pequeña (7 usuarios activos en 7 días; indicios, no patrones). El mapa lo usan los 7; las capas de mar (corriente, frentes, estaciones) las prueban 3-4 cada una, mientras que el diario solo 2 de 7. Propuestas, todas con tu sí/no: (1) investigar por qué 5 activos no abren el diario, p. ej. una pista desde la ficha del spot; (2) vigilar la capa de temperatura del agua (2 usuarios), sin quitarla; (3) seguir el embudo de pago (3 vieron suscripción, 1 inició checkout); (4) 3 de 11 perfiles con más de 7 días nunca hicieron nada: revisar si les llegan los avisos. Punto ciego: no se mide el cambio de modalidad, la capa de flota ni la ventana de actividad; propone eventos cambiar_modalidad, ver_capa_flota y ver_ventana_actividad.

## 🔎 Trabajo externo (investigación de contenido)
Sin novedades de buenas prácticas de otras apps ni de estudios institucionales en las últimas 24 h.
**Robot de especies:** no le tocaba pasar hoy.

## 🆕 Nuevas fuentes encontradas, pendientes de validar
### IPMA observaciones (Portugal)
Observaciones meteorológicas de las últimas 24 h de 227 estaciones, 78 con presión (hPa) medida en la última hora, sin clave. Aportaría presión real a los spots de Portugal, como ya hacen las estaciones de AEMET en España. Opinión: parece sólida y útil, pero no integrar hasta confirmar la licencia (su página de términos no devolvió texto útil).
