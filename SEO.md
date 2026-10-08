# SEO.md — páginas públicas de Costaviva y cómo seguirlas en Google y Bing

Hecho el 2026-10-08 (rama `claude/seo`). Sin IA en ejecución y sin coste
nuevo: todo sale de los datos que ya usa la app.

## Qué se ha construido

### Páginas públicas nuevas (HTML hecho en el servidor, sin JavaScript)

| URL | Qué tiene |
|---|---|
| `/spots` | Los 105 spots por región, con enlaces. |
| `/spots/region/<región>` | Los spots de la región y las especies de temporada este mes. Mismas 8 regiones que `/mareas/region/<región>`, y se enlazan entre sí. |
| `/spots/<spot>` | "Pesca en <spot>": intro propia hecha con sus datos (orilla, fondo, profundidad, especies de temporada, río, cámaras); **condiciones de hoy** (ola, viento, marea, agua y el **índice de pesca desde costa** con sus motivos ▲▼, la misma cuenta que la ficha de la app); qué se pesca desde costa, en embarcación y en submarina con sus meses; fondo y orilla; profundidades; río cercano y su caudal; cámaras (solo enlace a la web de su dueño); spots cercanos; llamada a la prueba gratis. Enlaza a `/mareas/<spot>` y viceversa. |
| `/especies` | Las 53 especies y las que están de temporada este mes. |
| `/especies/<especie>` | Nombres (es, eu, gl, ca, pt y científico), temporada y freza por zona, vedas, tallas mínimas con enlace a la norma, modalidades con su normativa, cebos, costumbres y en qué spots pescarla. Solo texto para el usuario: nada de notas internas del JSON. |

Enfoques distintos para no duplicar: `/mareas/<spot>` va de marea (pleamar,
bajamar, tabla de horas); `/spots/<spot>` va de pesca. Cada una con su
`canonical`.

Una URL de spot o especie que no existe da **404 de verdad** con `noindex`.
`/spots/` y `/especies/` redirigen (301) a la forma sin barra, y
`/especies/bonito_norte` a `/especies/bonito-norte`.

### SEO técnico

- `<title>` y meta description únicos por página (lo comprueba el test),
  `canonical`, Open Graph y Twitter (imagen de marca de siempre),
  `lang="es"`, JSON-LD: `Place`+`TouristAttraction` con coordenadas en cada
  spot, `CollectionPage` en los índices, `WebPage` en especies y
  `BreadcrumbList` en todas. No hay `FAQPage`: no hay preguntas y respuestas
  reales en la página.
- **`sitemap.xml`** (misma URL que ya está enviada en Search Console): pasa de
  115 a **284 URLs** (portada, `/spots`, `/especies`, `/mareas`, 8+8
  regiones, 105 spots, 105 mareas, 53 especies y privacidad) con `lastmod`.
  Ya no se edita a mano: `node scripts/seo/generar-sitemap.mjs`.
- **`robots.txt`**: todo permitido salvo las páginas de la app tras el login
  (`/diario`, `/alarma`, `/grupos`, `/suscripcion`, `/admin`,
  `/etiquetar-olas`). `/login` NO se bloquea (Google pasa por ahí al pintar la
  portada).
- **Un solo dominio** (`functions/_lib/seo/indexacion.js`, en el middleware):
  `fishnow-59u.pages.dev` servía el sitio entero duplicado; ahora sus páginas
  redirigen con 301 a `costaviva.org` (los endpoints y los POST siguen igual,
  con `noindex`). Las previews de las PR (`*.fishnow-59u.pages.dev`) llevan
  `X-Robots-Tag: noindex`. `http://` → `https://` con 301 también en el
  código (hoy ya lo hace Cloudflare).
- `X-Robots-Tag: noindex` en las páginas privadas de la app. **Nunca** en `/`
  ni en `/login`.
- Portada (`/`): `canonical` a `https://costaviva.org/` y, mientras se
  comprueba la sesión, un texto corto con enlaces a `/spots`, `/especies` y
  `/mareas` en el propio HTML. `login.html` (la portada que ve quien no tiene
  sesión) enlaza también a `/spots` y `/especies`.

### Coste y velocidad

- Las páginas de especies e índices se guardan **1 h** en la caché del edge
  (Cache API); las de spot **30 min** (lo mismo que `/prevision`).
- Una página de spot pide `/prevision` (ya con caché de 30 min) y dos
  `/meteo/*` del spot (con caché por coordenadas). Si algo tarda más de 4 s,
  la página sale sin "condiciones de hoy" y se guarda solo 5 min; la petición
  sigue y deja la caché caliente.
- Sin JavaScript ni mapas; ~35-60 KB por página con las letras.

### Ficheros

`functions/spots/**`, `functions/especies/**`, `functions/_lib/seo/*.js`,
`assets/css/publico.css`, `scripts/seo/generar-sitemap.mjs`, `sitemap.xml`,
`robots.txt`, `functions/_middleware.js`, `functions/_lib/rutas-publicas.js`,
`index.html` y `login.html` (enlaces y canonical), `functions/mareas/**`
(enlaces a las nuevas), `test/seo-paginas.test.js` (en `tests.yml`).

## Qué le queda a Mikel

La propiedad `sc-domain:costaviva.org` ya está verificada (registro TXT en
Cloudflare) y el sitemap ya está enviado: no hay que tocar nada de eso.

### 1. Cloudflare: HTTPS siempre (2 minutos)

En Cloudflare → `costaviva.org` → **SSL/TLS → Edge Certificates**:
- **Always Use HTTPS**: activado. (Hoy `http://costaviva.org/` ya responde
  301 a https; el código lo hace también por si acaso.)
- **HTTP Strict Transport Security (HSTS)**: ya lo manda `_headers`
  (`max-age=31536000; includeSubDomains`). No hace falta activarlo también en
  el panel.

### 2. Google Search Console, tras fusionar la PR

1. **Sitemaps**: entra en https://search.google.com/search-console →
   propiedad `costaviva.org` → *Sitemaps*. Escribe `sitemap.xml` y pulsa
   *Enviar* otra vez: así Google lo vuelve a leer ya con las 284 URLs (antes
   115). Debe salir "Correcto" y "URLs descubiertas: 284".
2. **Pedir la indexación de las páginas clave** (*Inspección de URLs*, la
   barra de arriba): pega cada URL, espera el resultado y pulsa *Solicitar
   indexación*. Hay un cupo diario de unas 10; empieza por:
   - `https://costaviva.org/`
   - `https://costaviva.org/spots`
   - `https://costaviva.org/especies`
   - `https://costaviva.org/spots/bakio`
   - `https://costaviva.org/especies/lubina`
3. **Qué mirar en las próximas semanas**:
   - *Páginas* (Indexación): el número de "Indexadas" debería subir desde 4.
     Lo normal es que pase por "Descubierta: actualmente sin indexar" y luego
     "Rastreada"; si al cabo de 3-4 semanas muchas siguen en "Rastreada:
     actualmente sin indexar", Google las ve flojas: hay que darles más
     contenido propio. "Página alternativa con etiqueta canónica adecuada"
     en URLs de `fishnow-59u.pages.dev` o `/login` es correcto, no un error.
   - *Rendimiento*: impresiones y clics por página y por búsqueda ("pesca en
     <sitio>", "talla mínima <especie>", "marea <sitio>"). Una página con
     impresiones y CTR bajo pide mejor título/descripción.
   - El informe diario y `SEO_ESTADO.md` ya traen estas cifras solas
     (`indexacion-google.yml` lee el `sitemap.xml` del repo, así que desde
     ahora inspecciona las 284).

### 3. Bing Webmaster Tools (5 minutos, también cubre DuckDuckGo y Ecosia)

1. Entra en https://www.bing.com/webmasters con una cuenta Microsoft.
2. *Add a site* → **Import from Google Search Console** → autoriza tu cuenta
   de Google → marca `costaviva.org` → *Import*. Bing copia la verificación
   y el sitemap; no hay que tocar DNS.
3. En *Sitemaps* comprueba que aparece `https://costaviva.org/sitemap.xml`
   (si no, añádelo a mano).
4. Opcional: *URL Submission* → pega las mismas 5 URLs de arriba.

## Para mantenerlo

- Al añadir un spot, una especie o una región: `node
  scripts/seo/generar-sitemap.mjs` y commit del `sitemap.xml` (si se olvida,
  `test/seo-paginas.test.js` falla en CI).
- Texto nuevo en las páginas: nada de notas internas
  (`TEXTO_INTERNO_PUBLICO` en `functions/_lib/seo/datos.js` lo vigila).
- Las cámaras de terceros solo salen como enlace a la web de su dueño; nada se
  inserta ni se descarga en las páginas públicas.
