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

## IndexNow y mejoras gratuitas (2026-10-08, rama `claude/indexnow-seo-extra`)

Pedido de Mikel: "móntalo (IndexNow), y todo lo que encuentres, gratuito, que
nos ayude, también". Todo sin IA, sin cuentas y sin coste.

### IndexNow

Protocolo abierto (https://www.indexnow.org/documentation) con el que se avisa
a **Bing, Yandex, Seznam, Naver y Yep** (Bing alimenta también a DuckDuckGo y
Ecosia) de qué URLs han cambiado, para que las rastreen en horas y no en
semanas. **Google no lo usa**: para Google sigue el `sitemap.xml`.

- **Clave**: `3ccc16ba30250113574d628e32e874b1`, servida en
  `https://costaviva.org/3ccc16ba30250113574d628e32e874b1.txt` (fichero en la
  raíz del repo, en la lista blanca, `text/plain`). No es secreta: es como el
  buscador comprueba que el dominio es nuestro. Si se cambia, cambiar a la vez
  el nombre y el contenido del fichero, la constante de
  `functions/_lib/seo/indexnow.js` y el `paths:` del workflow (el test avisa).
- **`.github/workflows/indexnow.yml`** (sin IA, sin secretos):
  - **Al fusionar en main** algo que cambia páginas públicas: las URLs
    afectadas (reglas en `urlsDeCambios`: plantilla común → todas; datos de
    especies → spots y especies; `functions/mareas/**` → mareas; nuevas o con
    `lastmod` distinto en el sitemap...). Los CSS no cuentan: un cambio de
    aspecto no es contenido nuevo. **La primera vez** (el push que trae el
    fichero de la clave) avisa de las 284. Antes de avisar espera a que
    `costaviva.org` sirva la clave y el mismo `sitemap.xml` que el repo (el
    despliegue de Cloudflare ha terminado).
  - **Una vez al día** (`17 5 * * *` UTC; GitHub lo arranca con horas de
    retraso, pero los diarios de este repo corren todos los días): las 210
    páginas que cambian cada día de verdad, `/spots/<spot>` (condiciones e
    índice de hoy) y `/mareas/<spot>` (mareas del día). Ni índices ni
    especies. No hace falta pg_cron ni migración.
  - **A mano**: *Actions → IndexNow → Run workflow* con `hoy`, `todas` o
    `probar` (enseña lo que mandaría sin mandar nada).
  - Respuesta esperada **200 o 202** (en el resumen del run). 403 = el
    buscador no encuentra la clave; 422 = URL de otro host; 429 = demasiadas
    peticiones. Cualquiera de esas deja el run en rojo.
- Código: `functions/_lib/seo/indexnow.js` (lógica pura) y
  `scripts/seo/indexnow.mjs`. Tests: `test/seo-extra.test.js`.

### Lo demás que se ha hecho

- **Imágenes para compartir (Open Graph)** propias, sin IA: 1200x630 con el
  logo, la letra y los colores Amanecer. Una por sección (`costaviva`,
  `spots`, `especies`, `mareas`) y **una por región** (`region-<región>`),
  en `assets/og/*.jpg` (~55 KB cada una). Las usan `/spots/<spot>` (la de su
  región), `/spots/region/*`, `/mareas/**`, `/especies/**`, la portada y
  `login.html`, con `og:image:width/height/alt` y `twitter:image`. Antes todas
  usaban la foto del vídeo de portada (350 KB). Se regeneran con
  `python3 scripts/seo/generar-imagenes.py` (Pillow) si cambia una región o
  el logo.
- **La portada real (`/` sirve `index.html`) no tenía Open Graph ni
  JSON-LD**: solo los tenía `login.html`. Ahora los dos llevan Open Graph,
  `WebSite` y `Organization` (logo PNG de 512, que es lo que Google pide).
- **App instalable (PWA)**: `manifest.json` con iconos PNG 192, 512 y
  *maskable* (Android ya no tiene que inventarse uno a partir del SVG),
  `apple-touch-icon` PNG de 180 (iOS ignora los SVG, y en el iPhone salía una
  captura de la página), `id`, `scope`, `lang`, nombre actualizado (seguía
  "Lekeitio a Bilbao") y `theme_color` igual que las páginas (`#0B1E3F`).
  **`icon.svg` pasa a ser el logo Amanecer** de la cabecera (era el icono
  antiguo, verde y dorado): favicon, iconos de la app y logo de Google
  iguales.
- **404 de verdad**: sin `404.html`, Cloudflare Pages trataba el sitio como
  una SPA y respondía **200 con la app entera** a cualquier fichero que no
  existía (`/assets/no-existe.png`, comprobado en producción): un *soft 404*
  para Google. Ahora `404.html` (status 404, `noindex`, enlaces a spots,
  especies, mareas y la app) y el middleware da la misma página, con CSP,
  para lo que no está en la lista blanca (antes, texto "Not Found").
  `node scripts/seo/generar-sitemap.mjs` reescribe también `404.html`.
- **`/.well-known/security.txt`** (RFC 9116): contacto
  `datos@costaviva.org` (ya reenvía al correo de Mikel). **Caduca el
  2027-10-01**: renovarlo antes (el test falla si caduca).
- **Caché del navegador para imágenes** (`_headers`): imágenes OG, iconos y
  `icon.svg` 1 día; vídeo/póster de portada e imágenes de Instagram 1 semana.
  Antes cada visita revalidaba cada imagen. CSS y JS no: no llevan versión en
  el nombre.
- `preconnect` a `fonts.gstatic.com` en la portada y en `login.html` (las
  letras empiezan a bajar antes).

### Lo que se ha mirado y NO se ha hecho (a propósito)

- **hreflang / versión en portugués**: no hay contenido en portugués real (las
  páginas de Portugal están en castellano). Poner hreflang sin traducción
  sería falso.
- **RSS de condiciones diarias**: nadie se suscribe a un feed de oleaje y
  serían 105 entradas nuevas al día casi iguales; no ayuda a posicionar.
- **Imagen OG por spot (105)**: unos 6 MB más en el repo para ganar poco
  frente a la de la región. Se puede hacer si las de región funcionan bien en
  redes.
- Altas masivas en directorios, intercambio de enlaces o páginas "puerta":
  spam, penaliza.

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

## Qué le queda a Mikel tras IndexNow (2026-10-08)

Todo gratis. Ordenado por lo que más ayuda.

1. **Comprobar IndexNow tras fusionar** (2 min, sin cuenta): *GitHub → Actions
   → "IndexNow (avisar a Bing y compañía)"*: el run del merge tiene que acabar
   en verde con "HTTP 200" o "HTTP 202" en el resumen. Si sale 403, abre
   https://costaviva.org/3ccc16ba30250113574d628e32e874b1.txt: debe enseñar
   la clave.
2. **Bing Webmaster Tools** (punto 3 de arriba, si no está hecho): además del
   sitemap, en su menú **IndexNow** se ven las URLs que le llegan cada día.
   Bing también alimenta a DuckDuckGo, Ecosia y Yahoo.
3. **Ahrefs Webmaster Tools** (gratis, 10 min): https://ahrefs.com/webmaster-tools
   → *Sign up for free* → *Import from Google Search Console* (sin tocar DNS)
   → `costaviva.org`. Hace una **auditoría técnica** del sitio cada semana
   (enlaces rotos, títulos duplicados, páginas lentas) y enseña **quién nos
   enlaza**, que Search Console da muy limitado. Si saca errores, pásamelos.
4. **Enlace a costaviva.org en Instagram y Facebook** (2 min): Instagram →
   *Editar perfil* → *Enlaces* → *Añadir enlace externo* →
   `https://costaviva.org/spots`. Facebook (página) → *Información* →
   *Sitio web*. No sube el ranking directamente (son `nofollow`), pero Google
   relaciona la marca con el dominio y trae visitas reales.
5. **PageSpeed Insights** (5 min, sin cuenta): https://pagespeed.web.dev →
   analiza `https://costaviva.org/spots/bakio` y `https://costaviva.org/` en
   *Móvil*. Mira "Core Web Vitals" (LCP, INP, CLS) y pásame el enlace del
   informe si algo sale en rojo.
6. **Prueba de resultados enriquecidos** (2 min, sin cuenta):
   https://search.google.com/test/rich-results con
   `https://costaviva.org/spots/bakio`: debe detectar "Rutas de navegación"
   sin errores.
7. **Refrescar la vista previa en redes** (opcional): Facebook guarda la
   imagen vieja de `costaviva.org` unas semanas. En
   https://developers.facebook.com/tools/debug/ (con tu cuenta de Facebook)
   pega `https://costaviva.org/` y pulsa *Volver a extraer*.
8. **Google Business Profile: no.** Es para negocios con local o que atienden
   en persona en una zona; Costaviva es solo online y Google suspende esas
   fichas.

