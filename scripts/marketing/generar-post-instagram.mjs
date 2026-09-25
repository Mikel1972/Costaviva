// scripts/marketing/generar-post-instagram.mjs
// Corrido por .github/workflows/robot-marketing-instagram.yml (lunes/
// miércoles/viernes). Pedido explícito del usuario (2026-09-19): marketing
// orgánico en Instagram para captar usuarios, sin anuncios de pago.
//
// Alterna dos tipos de contenido, siempre a partir de datos ya reales del
// propio repo -- nunca inventa nada, mismo criterio que el resto de robots:
//   - "condiciones": oleaje/viento/marea reales de un spot destacado, tal
//     cual los devuelve /prevision (el mismo endpoint que usa la app).
//   - "especies": una especie de temporada ahora mismo, con el texto ya
//     documentado y sourced en index.html (ESPECIES, campo "nota" -- ver el
//     comentario de esa constante para las fuentes: FishBase, aipeces.com,
//     etc.). Se reutiliza ese texto casi literal, no se genera con un LLM.
//
// Este script SOLO genera la imagen (PNG) y el texto -- no publica nada.
// Escribe scripts/marketing/post-pendiente.json con lo generado; un
// segundo script (publicar-borrador-instagram.mjs) lo recoge después de
// que el workflow haya comiteado y desplegado la imagen, crea el
// "contenedor" de Instagram (borrador, sin publicar) y abre el Issue de
// revisión. La publicación real queda para un tercer paso manual
// (workflow "Publicar post de Instagram", disparado a mano) -- pedido
// explícito del usuario: aprobación humana antes de que nada se vea en
// público.

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(__dirname, "..", "..");
const BASE_URL = "https://costaviva.org";

const DORADO = "#A8792A";
const DORADO_FONDO = "#D4A24C";
const NAVY = "#0B2532";
const GRIS = "#5C7680";
const CREMA = "#F7F3E8";
const BLANCO = "#FFFFFF";
const BORDE = "#DDE2DC";

function diaDelAnio(fecha) {
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  return Math.floor((fecha - inicio) / 86400000);
}

function escaparXml(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// SVG no envuelve texto solo -- reparte a mano por número de caracteres
// (estimación, no medición real de fuente, suficiente para una tarjeta de
// redes sociales que no necesita precisión tipográfica exacta).
function envolverTexto(texto, maxCaracteres) {
  const palabras = texto.split(" ");
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (candidata.length > maxCaracteres && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function cabeceraSvg() {
  return `
    <rect width="1080" height="1080" fill="${CREMA}" />
    <text x="64" y="96" font-family="Georgia, 'Liberation Serif', serif" font-size="40" font-weight="bold" fill="${DORADO}" letter-spacing="2">COSTAVIVA</text>
    <text x="64" y="128" font-family="Arial, 'Liberation Sans', sans-serif" font-size="22" fill="${GRIS}">pesca en tiempo real</text>
    <line x1="64" y1="152" x2="1016" y2="152" stroke="${BORDE}" stroke-width="2" />
  `;
}

function piePaginaSvg() {
  return `
    <line x1="64" y1="972" x2="1016" y2="972" stroke="${BORDE}" stroke-width="2" />
    <text x="540" y="1020" font-family="Arial, 'Liberation Sans', sans-serif" font-size="26" font-weight="bold" fill="${DORADO}" text-anchor="middle">Datos reales de tu costa → costaviva.org</text>
  `;
}

// Solo spots con webcam real servida por nuestro propio proxy /webcam/
// (imagen fija, no vídeo HLS -- eso necesitaría ffmpeg, que este script
// no lleva) -- pedido explícito del usuario: la foto real en directo es
// justo lo que diferencia el post de un simple parte del tiempo. Lista
// verificada a mano contra SPOTS_CON_WEBCAM/functions/webcam/[slug].js
// 2026-09-19: mundaka, bakio, getxo, laredo, santona tienen imagen fija;
// zarautz/donostia/hondarribia son solo vídeo HLS y santander no tiene
// webcam -- se quitaron de esta lista (mantener sincronizado a mano si
// cambia el proxy).
// Zonas de la costa, en el orden en que se van publicando (añadido
// 2026-09-25, pedido explícito del usuario: "cada publicación un spot de una
// zona diferente, en ciclos completos"). Antes eran 5 spots sueltos de los
// que 3 eran de Bizkaia y 2 de Cantabria, así que la variedad geográfica era
// nula.
//
// Solo spots con imagen fija servida por nuestro proxy /webcam/ — el vídeo
// HLS necesitaría ffmpeg, que este script no lleva. Verificado contra
// WEBCAMS de functions/webcam/[slug].js el 2026-09-25.
//
// "Ciclo completo" significa que se recorren las 8 zonas antes de repetir
// ninguna. Como cada pasada del robot es un proceso nuevo que no recuerda
// nada, hace falta estado en disco: rotacion-zonas.json, que el workflow
// comitea junto con la imagen generada.
const ZONAS = [
  { nombre: "País Vasco — Bizkaia", spots: ["mundaka", "bakio", "sopelana", "lekeitio", "getxo"] },
  { nombre: "País Vasco — Gipuzkoa", spots: ["getaria", "pasaia"] },
  { nombre: "Cantabria", spots: ["santona", "laredo", "castrourdiales", "suances", "comillas", "sanvicente"] },
  { nombre: "Galicia", spots: ["acoruna", "baiona", "camarinas", "cangas", "corrubedo", "ribadeo", "ons", "portosin", "cies"] },
  { nombre: "Castellón", spots: ["peniscola", "alcossebre", "benicassim", "oropesa", "burriana", "castellon", "torreblanca", "vinaros", "xilxes"] },
  { nombre: "Valencia", spots: ["valencia", "alboraya", "cullera", "gandia", "oliva", "piles", "canetdeberenguer", "pobladefarnals"] },
  { nombre: "Alicante", spots: ["denia", "javea", "calpe", "altea", "benidorm", "vilajoiosa", "alicante", "santapola", "guardamardelsegura", "pilardelahoradada"] },
  { nombre: "Murcia y Baleares", spots: ["aguilas", "calamillor", "sonbou", "muro"] },
];

const RUTA_ROTACION = join(__dirname, "rotacion-zonas.json");

// Supabase: la anon key es pública por diseño en este repo (ver CLAUDE.md) y
// camara_estado es de lectura pública — no son datos de nadie, es el estado
// de unas webcams.
const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbmNibWl6eGtvcm90cGVpc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMTQsImV4cCI6MjEwNDUxMzMxNH0.QYvtoHQyFRo1SploGPCUyWZqeHNwy6Qdd6IsAbmvHnc";

// Estado de las cámaras. Dos niveles, no uno (añadido 2026-09-25, pedido
// explícito del usuario: "spot sano"):
//   - `sin_senal = false` es lo mínimo: la cámara responde.
//   - `fuente_usada = 0` es lo bueno: responde por su fuente PRINCIPAL. Un
//     spot con fuente_usada > 0 tira de reserva porque la principal falla:
//     vale para la app, pero es mal candidato para un post que presume de
//     "webcam en directo", porque si la reserva también cae se queda sin
//     nada. Caso real del 2026-09-25: Laredo estaba así.
async function estadoCamaras() {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/camara_estado?select=spot_slug,sin_senal,fuente_usada`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resp.ok) throw new Error(`camara_estado respondió ${resp.status}`);
    return new Map((await resp.json()).map((f) => [f.spot_slug, f]));
  } catch (e) {
    console.warn(`No se pudo leer el estado de las cámaras (${e.message}); se publicará sin ese filtro.`);
    return new Map();
  }
}

function leerRotacion() {
  try {
    return JSON.parse(readFileSync(RUTA_ROTACION, "utf8"));
  } catch {
    return { ultimoIndice: -1, ciclo: 1 };
  }
}

// Elige la SIGUIENTE zona del ciclo y, dentro de ella, el mejor spot
// disponible. Si una zona entera no tiene ninguna cámara utilizable se salta
// a la siguiente, pero NO se da por consumida: se reintentará en el ciclo
// siguiente, para que "ciclo completo" siga significando lo que dice.
async function elegirSpot() {
  const estado = await estadoCamaras();
  const utilizable = (slug, exigirPrincipal) => {
    const e = estado.get(slug);
    if (!e) return !estado.size; // sin datos de ninguna, no filtramos
    if (e.sin_senal !== false) return false;
    return exigirPrincipal ? (e.fuente_usada ?? 0) === 0 : true;
  };

  const rotacion = leerRotacion();
  for (let salto = 1; salto <= ZONAS.length; salto++) {
    const indice = (rotacion.ultimoIndice + salto) % ZONAS.length;
    const zona = ZONAS[indice];
    const conPrincipal = zona.spots.filter((s) => utilizable(s, true));
    const candidatos = conPrincipal.length ? conPrincipal : zona.spots.filter((s) => utilizable(s, false));
    if (!candidatos.length) {
      console.warn(`Zona "${zona.nombre}" sin ninguna cámara utilizable ahora mismo; se salta (se reintentará en el ciclo siguiente).`);
      continue;
    }
    // Dentro de la zona se va alternando por ciclo, para no sacar siempre el
    // mismo spot de las zonas con varias cámaras.
    const slug = candidatos[(rotacion.ciclo ?? 1) % candidatos.length];
    const consumida = (rotacion.ultimoIndice + 1) % ZONAS.length;
    const ciclo = indice < consumida || indice === 0 && rotacion.ultimoIndice >= 0
      ? (rotacion.ciclo ?? 1) + 1
      : (rotacion.ciclo ?? 1);
    writeFileSync(
      RUTA_ROTACION,
      JSON.stringify({ ultimoIndice: indice, ciclo, ultimaZona: zona.nombre, ultimoSpot: slug, fecha: new Date().toISOString() }, null, 2) + "\n"
    );
    console.log(`Zona de esta publicación: ${zona.nombre} -> ${slug} (ciclo ${ciclo})`);
    return slug;
  }
  console.warn("Ninguna zona tiene cámaras utilizables; se usa mundaka como último recurso.");
  return "mundaka";
}

const PANEL_FOTO = { x: 140, y: 410, width: 800, height: 310 };

async function generarCondiciones() {
  const slug = await elegirSpot();

  const resp = await fetch(`${BASE_URL}/prevision`);
  if (!resp.ok) throw new Error(`/prevision respondió ${resp.status}`);
  const datos = await resp.json();
  const spot = datos.spots.find((s) => s.slug === slug);
  if (!spot) throw new Error(`No se encontró el spot "${slug}" en /prevision`);
  const bloque = spot.bloques[0];
  if (!bloque) throw new Error(`El spot "${slug}" no tiene bloques de previsión ahora mismo`);

  const oleajeTexto = `${bloque.altura[0]}–${bloque.altura[1]} m · ${bloque.periodo}s`;
  const vientoTexto = `${bloque.viento} km/h ${bloque.dirViento}`;
  const mareaFlecha = spot.marea.tendencia === "subiendo" ? "▲" : "▼";
  const mareaTexto = `${spot.marea.altura} m ${mareaFlecha}`;

  const tarjetas = [
    { titulo: "OLEAJE", valor: oleajeTexto, emoji: "🌊" },
    { titulo: "VIENTO", valor: vientoTexto, emoji: "💨" },
    { titulo: "MAREA", valor: mareaTexto, emoji: "🌙" },
  ];
  const anchoTarjeta = 280;
  const espacio = 32;
  const inicioX = (1080 - (anchoTarjeta * 3 + espacio * 2)) / 2;
  const tarjetasSvg = tarjetas
    .map((t, i) => {
      const x = inicioX + i * (anchoTarjeta + espacio);
      return `
        <rect x="${x}" y="760" width="${anchoTarjeta}" height="190" rx="16" fill="${BLANCO}" stroke="${BORDE}" stroke-width="2" />
        <text x="${x + anchoTarjeta / 2}" y="810" font-family="Arial, sans-serif" font-size="38" text-anchor="middle">${t.emoji}</text>
        <text x="${x + anchoTarjeta / 2}" y="852" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${GRIS}" letter-spacing="1" text-anchor="middle">${t.titulo}</text>
        <text x="${x + anchoTarjeta / 2}" y="895" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="${NAVY}" text-anchor="middle">${escaparXml(t.valor)}</text>
      `;
    })
    .join("");

  // Intenta traer la foto real de la webcam del spot (nuestro propio
  // proxy, ya gestiona failover/extracción de MJPEG él solo) -- si falla
  // por lo que sea, el post sigue saliendo igual pero con el círculo de
  // antes en vez de la foto (nunca bloquea la generación por esto).
  let fotoWebcamBuffer = null;
  try {
    const respFoto = await fetch(`${BASE_URL}/webcam/${slug}`);
    if (respFoto.ok) fotoWebcamBuffer = Buffer.from(await respFoto.arrayBuffer());
    else console.warn(`No se pudo traer la webcam de ${slug}: HTTP ${respFoto.status}`);
  } catch (e) {
    console.warn(`No se pudo traer la webcam de ${slug}: ${e.message}`);
  }

  const capaBase = `
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      ${cabeceraSvg()}
      <text x="540" y="330" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="${NAVY}" text-anchor="middle">${escaparXml(spot.nombre)}</text>
      <text x="540" y="380" font-family="Arial, sans-serif" font-size="24" fill="${GRIS}" text-anchor="middle">${fotoWebcamBuffer ? "Webcam en directo + condiciones reales" : "Condiciones reales ahora mismo"}</text>
      ${fotoWebcamBuffer ? "" : `
        <circle cx="540" cy="565" r="150" fill="${DORADO_FONDO}" opacity="0.15" />
        <text x="540" y="590" font-family="Arial, sans-serif" font-size="90" text-anchor="middle">🎣</text>
      `}
      ${tarjetasSvg}
      ${piePaginaSvg()}
    </svg>
  `;

  const caption = [
    "🎣 La primera app que te da los datos reales del momento de tu spot de pesca",
    "",
    `📍 ${spot.nombre} ahora mismo`,
    "",
    ...(fotoWebcamBuffer ? ["🎥 Con webcam en directo -- mira el mar antes de salir de casa", ""] : []),
    `🌊 Oleaje: ${oleajeTexto}`,
    `💨 Viento: ${vientoTexto}`,
    `🌙 Marea: ${spot.marea.tendencia} (coef. ${spot.marea.coeficiente})`,
    "",
    "Consulta el estado en directo de tu spot, capas de viento/boyas/radar de lluvia y muchos más datos para que incrementes tus posibilidades de pesca -- enlace en la bio 🎣",
    "",
    "#pesca #fishing #instafishing #pescadeportiva #pescadesdecosta #surfcasting #saltwaterfishing #costaviva #euskadi #cantabria #cantabrico",
  ].join("\n");

  if (!fotoWebcamBuffer) {
    return { tipo: "condiciones", svg: capaBase, caption, slug: `condiciones-${slug}` };
  }

  // Con foto: 3 capas compuestas por sharp -- fondo (todo salvo el hueco
  // de la foto, que se deja en blanco), la foto real recortada a ese
  // hueco, y un borde+insignia "EN DIRECTO" encima para que se note que
  // es una foto de verdad y no un adorno.
  const capaBorde = `
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect x="${PANEL_FOTO.x}" y="${PANEL_FOTO.y}" width="${PANEL_FOTO.width}" height="${PANEL_FOTO.height}" fill="none" stroke="${DORADO}" stroke-width="4" />
      <rect x="${PANEL_FOTO.x + 16}" y="${PANEL_FOTO.y + 16}" width="190" height="44" rx="22" fill="#C0392B" />
      <circle cx="${PANEL_FOTO.x + 40}" cy="${PANEL_FOTO.y + 38}" r="7" fill="${BLANCO}" />
      <text x="${PANEL_FOTO.x + 58}" y="${PANEL_FOTO.y + 44}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${BLANCO}" letter-spacing="1">EN DIRECTO</text>
    </svg>
  `;

  const fotoRecortada = await sharp(fotoWebcamBuffer)
    .resize(PANEL_FOTO.width, PANEL_FOTO.height, { fit: "cover" })
    .png()
    .toBuffer();

  const pngBuffer = await sharp(Buffer.from(capaBase))
    .composite([
      { input: fotoRecortada, top: PANEL_FOTO.y, left: PANEL_FOTO.x },
      { input: Buffer.from(capaBorde), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  return { tipo: "condiciones", pngBuffer, caption, slug: `condiciones-${slug}` };
}

// Lee ESPECIES directamente de index.html en vez de mantener una copia --
// mismo criterio que evitar datos duplicados/desincronizados en el resto
// del repo. Es un array literal plano (sin referencias externas), seguro
// de evaluar así.
function extraerEspecies() {
  const html = readFileSync(join(RAIZ_REPO, "index.html"), "utf8");
  const marcadorInicio = "const ESPECIES = [";
  const inicio = html.indexOf(marcadorInicio);
  if (inicio === -1) throw new Error("No se encontró \"const ESPECIES\" en index.html");
  const finMarcador = "\n];";
  const fin = html.indexOf(finMarcador, inicio);
  if (fin === -1) throw new Error("No se encontró el cierre de ESPECIES en index.html");
  const bloque = html.slice(inicio, fin + finMarcador.length);
  const fn = new Function(`${bloque}\nreturn ESPECIES;`);
  return fn();
}

async function generarEspecies() {
  const mesActual = new Date().getMonth() + 1;
  const especies = extraerEspecies().filter((e) => e.meses.includes(mesActual));
  if (!especies.length) throw new Error(`Ninguna especie documentada para el mes ${mesActual}`);
  const dia = diaDelAnio(new Date());
  const especie = especies[dia % especies.length];

  const lineasNota = envolverTexto(especie.nota, 46);
  const notaSvg = lineasNota
    .map((linea, i) => `<tspan x="540" dy="${i === 0 ? 0 : 42}">${escaparXml(linea)}</tspan>`)
    .join("");

  const svg = `
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      ${cabeceraSvg()}
      <circle cx="540" cy="330" r="130" fill="${DORADO_FONDO}" opacity="0.18" />
      <text x="540" y="365" font-family="Arial, sans-serif" font-size="120" text-anchor="middle">${especie.emoji}</text>
      <text x="540" y="530" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="${NAVY}" text-anchor="middle">${escaparXml(especie.nombre)}</text>
      <rect x="390" y="555" width="300" height="44" rx="22" fill="${DORADO}" />
      <text x="540" y="584" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${BLANCO}" text-anchor="middle" letter-spacing="1">DE TEMPORADA AHORA</text>
      <text x="540" y="680" font-family="Georgia, serif" font-size="30" fill="${NAVY}" text-anchor="middle">${notaSvg}</text>
      ${piePaginaSvg()}
    </svg>
  `;

  const caption = [
    "🎣 La primera app que te da los datos reales del momento de tu spot de pesca",
    "",
    `${especie.emoji} ${especie.nombre} — de temporada ahora mismo`,
    "",
    especie.nota.charAt(0).toUpperCase() + especie.nota.slice(1) + ".",
    "",
    `🍽️ Se alimenta de: ${especie.alimento}`,
    "",
    "Consulta las condiciones reales de tu spot y muchos más datos para que incrementes tus posibilidades de pesca -- enlace en la bio 🎣",
    "",
    "#pesca #fishing #instafishing #pescarecreativa #pescadeportiva #costaviva #euskadi #cantabria #pescaenespaña",
  ].join("\n");

  return { tipo: "especies", svg, caption, slug: `especies-${especie.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` };
}

async function main() {
  // Alterna por día de la semana: miércoles especies, lunes/viernes
  // condiciones -- ver .github/workflows/robot-marketing-instagram.yml
  // para el cron exacto (L/X/V).
  const diaSemana = new Date().getDay(); // 0=domingo ... 3=miércoles
  const generador = diaSemana === 3 ? generarEspecies : generarCondiciones;

  const { tipo, svg, pngBuffer, caption, slug } = await generador();

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreFichero = `${fecha}-${slug}.png`;
  const rutaRelativa = `assets/marketing/${nombreFichero}`;
  const rutaAbsoluta = join(RAIZ_REPO, rutaRelativa);

  mkdirSync(join(RAIZ_REPO, "assets", "marketing"), { recursive: true });
  // generarCondiciones() puede devolver un PNG ya compuesto (foto real de
  // la webcam de por medio) en vez de solo el SVG -- si viene el buffer
  // ya hecho, se escribe tal cual; si no, se renderiza el SVG como
  // siempre (mismo camino que ya usaba generarEspecies()).
  if (pngBuffer) writeFileSync(rutaAbsoluta, pngBuffer);
  else await sharp(Buffer.from(svg)).png().toFile(rutaAbsoluta);
  console.log(`✓ Imagen generada: ${rutaRelativa}`);

  const publicUrl = `${BASE_URL}/${rutaRelativa}`;
  const pendiente = { tipo, caption, rutaRelativa, publicUrl, fecha };
  writeFileSync(join(__dirname, "post-pendiente.json"), JSON.stringify(pendiente, null, 2));
  console.log(`✓ scripts/marketing/post-pendiente.json escrito (tipo: ${tipo})`);
}

main().catch((e) => {
  console.error("Fallo generando el post:", e);
  process.exit(1);
});
