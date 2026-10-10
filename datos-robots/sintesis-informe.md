<!-- SINTESIS fecha=2026-10-10 hasta_commit=8bc994d246b2f9e36e9c36be32e81830e6db9403 -->

## 🛠 Trabajo interno (calibración y datos)
La calibración nocturna sigue bloqueada por tercera noche seguida: el servicio de Puertos del Estado (`poem.puertos.es/portus/StationData`) devuelve error 500 en cualquier consulta de datos (el último dato real fue el 2026-10-08). No se escribió nada en `CALIBRACION.jsonl` y no hay factores de corrección nuevos. No afecta a lo que ven los usuarios (el mapa usa la instantánea de Copernicus), pero si sigue así la rutina queda ciega para calibrar. La salud de datos está sana: boya de Nazaré, caudales del Cantábrico (arreglo confirmado), Júcar y Galicia bien, y el Segura se recuperó solo (33/33 estaciones con dato). El robot de cámaras caídas revisó 10 cámaras en rojo: Mundaka y Bakio no están rotas (noche / la fuente no actualiza de noche); Pasaia lleva 3 días sin actualizarse en origen (AZTI/Detectia) y no hay alternativa aún; las de SOCIB (calamillor, muro, sonbou) dan imagen real desde fuera pero 522 desde el proxy de Cloudflare, y las de cantabria.es siguen inaccesibles (bloqueo desde 2026-09-25).
**Cámaras nuevas encontradas:** 0
**Términos de búsqueda:** no consta en el texto ninguna búsqueda de webcams nueva ni zona probada esta vez.

## 🧪 Experiencia de usuario y patrones de uso
**Robot de experiencia de usuario:** no le tocaba pasar hoy (corre los lunes); sin entrada suya.
**Robot de patrones de uso:** no le tocaba pasar esta semana.

## 🔎 Trabajo externo (investigación de contenido)
No hay entradas nuevas de buenas prácticas de otras apps ni de estudios institucionales en este periodo.
**Robot de especies:** no le tocaba pasar hoy (corre los jueves); sin entrada nueva.

## 🆕 Nuevas fuentes encontradas, pendientes de validar
Ninguna fuente nueva desde la última síntesis. Queda una decisión pendiente para Mikel sobre SOCIB: pedirles que permitan las IPs de Cloudflare, o bajar el fotograma con un workflow de GitHub Actions al bucket `fuentes-gratuitas` y servir esa copia.
