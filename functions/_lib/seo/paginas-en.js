// functions/_lib/seo/paginas-en.js
// Páginas públicas de Nueva Zelanda, SOLO en inglés, bajo /en/ (lanzamiento
// de NZ, 2026-10-11). Puro: recibe los datos y devuelve { titulo, html }.
// Tests en test/nz-region.test.js.
//
//   /en/spots                     índice de los spots de NZ por zona
//   /en/spots/region/<zona>       spots de una zona (zonas-nz.js)
//   /en/spots/<slug>              pesca en un spot: especies, normativa (solo
//                                 enlace a MPI + rāhui), reservas del DOC,
//                                 condiciones de hoy
//   /en/tides, /en/tides/region/<zona>, /en/tides/<slug>
//                                 mareas de LINZ (atribución y aviso de LINZ)
//   /en/species, /en/species/<slug>
//                                 especies de NZ (nombres en inglés y māori)
//
// Reglas de contenido (las de España, más las de NZ): ninguna cifra de
// normativa (tallas y cupos solo en MPI), siempre el aviso de rāhui, LINZ con
// "Sourced from Land Information New Zealand data (CC BY 4.0)" y el aviso de
// que no son tablas oficiales, y nada interno ("heuristic", "pending"...).

import { DOMINIO, esc, documento, migasHtml, migasJsonLd, imagenOg } from "./base.js";
import { ZONAS_NZ, zonaDeSpotNZ } from "../nz/zonas-nz.js";
import { AREAS_MPI, URL_APP_MPI, URL_REGLAS_MPI, normativaArea } from "../../../assets/js/normativa-nz.js";
import { ATRIBUCION_LINZ, AVISO_LINZ } from "../nz/mareas-linz.js";
import { ATRIBUCION_DOC, URL_DOC_RESERVAS } from "../nz/reservas-doc.js";
import { slugEspecie } from "./datos.js";

export const ZONA_NZ = "Pacific/Auckland";
const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
const MESES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MESES_CORTOS_EN = MESES_EN.map((m) => m.slice(0, 3));
export const mesLargoEn = (m) => MESES_EN[m - 1];
const MODALIDADES = ["costa", "embarcacion", "submarina"];
export const NOMBRE_MODALIDAD_EN = { costa: "Shore fishing", embarcacion: "Boat fishing", submarina: "Spearfishing" };
const MODALIDAD_CORTA_EN = { costa: "from the shore", embarcacion: "from a boat", submarina: "spearfishing" };
const AVISO_RAHUI = "Rāhui (temporary closures placed by tangata whenua) can apply at any time and are not in any dataset: respect local signs and notices.";

// Créditos del pie de todas las páginas /en/.
export const PIE_EN = `Marine weather: Open-Meteo (CC BY 4.0). Tides: ${esc(ATRIBUCION_LINZ)}; ${esc(AVISO_LINZ)} ${esc(ATRIBUCION_DOC)}. Map data © OpenStreetMap contributors (ODbL). Fishing rules change: always check the official <a href="${esc(URL_REGLAS_MPI)}" rel="noopener" target="_blank">MPI fishing rules</a>.`;

// Spots de NZ = los de pais "nz". Especies de NZ = las de pais "nz".
export const spotsNZ = (spots) => (spots || []).filter((s) => s.pais === "nz");
export const especiesNZ = (datos) => (datos?.especies || []).filter((e) => e.pais === "nz");

// Mes en curso en Nueva Zelanda (1-12).
export function mesNZ(fecha = new Date()) {
  return Number(new Intl.DateTimeFormat("en-NZ", { timeZone: ZONA_NZ, month: "numeric" }).format(fecha));
}

// "All year", "Oct–Mar", "Jan–Feb, Jun".
export function textoMesesEn(meses) {
  const set = [...new Set(meses || [])].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!set.length) return "";
  if (set.length === 12) return "All year";
  const tramos = [];
  for (const m of set) {
    const t = tramos[tramos.length - 1];
    if (t && t[1] === m - 1) t[1] = m;
    else tramos.push([m, m]);
  }
  // Une diciembre con enero (temporadas que cruzan el año, como en el sur).
  if (tramos.length > 1 && tramos[0][0] === 1 && tramos[tramos.length - 1][1] === 12) {
    const ult = tramos.pop();
    tramos[0][0] = ult[0];
  }
  return tramos.map(([a, b]) => (a === b ? MESES_CORTOS_EN[a - 1] : `${MESES_CORTOS_EN[a - 1]}–${MESES_CORTOS_EN[b - 1]}`)).join(", ");
}

const listaY = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
export const nombreCientifico = (e) => String(e.cientifico || "").split(" (")[0].trim() || null;
export const nombreEn = (e) => e.nombres?.en || e.id;

function distanciaKm(a, b) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function cercanosNZ(todos, spot, n = 6) {
  return spotsNZ(todos).filter((s) => s.slug !== spot.slug)
    .map((s) => ({ ...s, km: distanciaKm(spot, s) })).sort((a, b) => a.km - b.km).slice(0, n);
}

// Especies de un spot de NZ por modalidad (área de MPI del spot).
export function especiesDeSpotNZ(datos, spot, mes) {
  const porModalidad = {};
  for (const m of MODALIDADES) {
    porModalidad[m] = especiesNZ(datos)
      .filter((e) => e.presencia?.[spot.region]?.meses?.length && e.modalidades?.[m]?.aplica === true)
      .map((e) => {
        const meses = e.presencia[spot.region].meses;
        return { id: e.id, slug: slugEspecie(e.id), nombre: nombreEn(e), maori: e.nombres?.mi || null, emoji: e.emoji || "🐟", temporada: textoMesesEn(meses), ahora: meses.includes(mes), meses };
      })
      .sort((a, b) => (b.ahora - a.ahora) || a.nombre.localeCompare(b.nombre, "en"));
  }
  return porModalidad;
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------
function ctaEn(titulo = "Try Costaviva free for 7 days") {
  return `<section class="cta" aria-label="Try Costaviva">
  <p class="cta-titulo">${esc(titulo)}</p>
  <ul class="cta-lista">
    <li>Hour-by-hour fishing index and the best window of the day</li>
    <li>Condition alerts and SOS with your location (dials 111 in New Zealand)</li>
    <li>Fishing log with the conditions of every catch</li>
    <li>Private groups to share spots and trips</li>
  </ul>
  <a class="cta-boton" href="/login?alta=1">Start free →</a>
  <p class="cta-sub">No card needed. Then €3.99/month or €39.99/year, charged in euros.</p>
</section>`;
}

function bloqueNormativa(region) {
  const n = normativaArea(region);
  return `<section class="tarjeta aviso" aria-labelledby="t-normas"><h2 id="t-normas">Fishing rules</h2>
<p>Size limits, daily bag limits and closed areas change. Check the official rules before you go:</p>
<ul>${n ? `<li><a href="${esc(n.url)}" rel="noopener" target="_blank">MPI fishing rules: ${esc(n.area)} area</a></li>` : `<li><a href="${esc(URL_REGLAS_MPI)}" rel="noopener" target="_blank">MPI recreational fishing rules</a></li>`}
<li><a href="${esc(URL_APP_MPI)}" rel="noopener" target="_blank">NZ Fishing Rules app (MPI, free)</a></li></ul>
<p class="nota">${esc(AVISO_RAHUI)}</p></section>`;
}

function bloqueReservas(reservas) {
  if (!reservas?.length) return "";
  return `<section class="tarjeta aviso" aria-labelledby="t-reservas"><h2 id="t-reservas">Marine reserve nearby</h2>
<ul>${reservas.map((r) => `<li><strong>${esc(r.nombre)}</strong> ${r.km === 0 ? "(at this spot)" : `(about ${esc(String(r.km))} km away)`}</li>`).join("")}</ul>
<p>No fishing and no taking of any marine life inside a marine reserve. Check the exact boundary on the <a href="${esc(URL_DOC_RESERVAS)}" rel="noopener" target="_blank">Department of Conservation website</a> before fishing.</p>
<p class="nota">${esc(ATRIBUCION_DOC)}. Simplified outline, not an exact boundary.</p></section>`;
}

// "high tide 16:42 (2.9 m)", con "tomorrow" si es de mañana.
const textoEvento = (e) => `${e.manana ? "tomorrow " : ""}${e.hora} (${e.altura} m)`;
const tipoEn = (t) => (t === "pleamar" ? "High tide" : "Low tide");

function notaMareaLinz(puerto) {
  return `<p class="nota">${puerto ? `Tide port: ${esc(puerto.nombre)} (${esc(String(puerto.km))} km${puerto.metodo === "secundario" ? ", secondary port" : ""}). ` : ""}Heights above chart datum. ${esc(ATRIBUCION_LINZ)}. ${esc(AVISO_LINZ)}</p>`;
}

function condicionesHoy(spotPrev, spot) {
  const b = spotPrev?.bloques?.[0];
  const m = spotPrev?.marea;
  if (!b && !m) {
    return `<section class="tarjeta hoy" aria-labelledby="t-hoy"><h2 id="t-hoy">Today's conditions</h2>
<p class="nota">Today's data for this spot is not available right now. Try again in a few minutes or see the <a href="/en/tides/${esc(spot.slug)}">tide times</a>.</p></section>`;
  }
  const f = (x) => String(Math.round(x * 10) / 10);
  const celda = (etq, val, det) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span>${det ? `<span class="dato-det">${esc(det)}</span>` : ""}</div>` : "");
  const ola = b?.altura ? `${f(b.altura[0])}–${f(b.altura[1])} m` : null;
  const olaDet = [b?.periodo ? `${b.periodo} s` : null, b?.dirOla ? `from ${b.dirOla.split(" ")[0]}` : null].filter(Boolean).join(" · ");
  const viento = b?.viento != null ? `${b.viento} km/h` : null;
  const marea = m?.altura != null ? `${f(m.altura)} m ${m.tendencia === "subiendo" ? "▲ rising" : m.tendencia === "bajando" ? "▼ falling" : ""}`.trim() : null;
  const mareaDet = (m?.proximas || []).slice(0, 2).map((e) => `${e.tipo === "pleamar" ? "high" : "low"} ${e.manana ? "tomorrow " : ""}${e.hora}`).join(" · ");
  const hora = spotPrev?.actualizado ? new Date(spotPrev.actualizado).toLocaleString("en-NZ", { timeZone: ZONA_NZ, hour: "2-digit", minute: "2-digit" }) : null;
  return `<section class="tarjeta hoy" aria-labelledby="t-hoy">
<h2 id="t-hoy">Today's conditions${hora ? ` <small>(${esc(hora)})</small>` : ""}</h2>
<div class="datos">${celda("Waves", ola, olaDet)}${celda("Wind", viento, b?.dirViento ? `from ${b.dirViento}` : null)}${celda("Tide", marea, mareaDet)}${celda("Water", b?.tempAgua != null ? `${f(b.tempAgua)} °C` : null, null)}</div>
${m ? notaMareaLinz(m.puerto) : ""}
<p class="nota">The hour-by-hour window, the best times for each species and alerts are in the Costaviva app. Full tide times: <a href="/en/tides/${esc(spot.slug)}">${esc(spot.nombre)} tides</a>.</p>
</section>`;
}

function documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagen = imagenOg("spots"), imagenAlt = "Costaviva: live fishing conditions in New Zealand", ogTipo }) {
  return documento({ titulo, descripcion, ruta, cuerpo, ld, imagen, imagenAlt, ogTipo, idioma: "en", alternos: ["en"], pie: PIE_EN });
}

// ---------------------------------------------------------------------------
// /en/spots/<slug>
// ---------------------------------------------------------------------------
export function introSpotNZ(spot, porModalidad, mes) {
  const zona = zonaDeSpotNZ(spot);
  const area = AREAS_MPI[spot.region]?.nombre;
  const partes = [`${spot.nombre} is one of the New Zealand fishing spots Costaviva follows${zona ? `, in ${zona.nombre}` : ""}${area ? ` (MPI ${area} fishing area)` : ""}.`];
  partes.push(`Fished ${listaY(spot.modalidades.map((m) => MODALIDAD_CORTA_EN[m]).filter(Boolean))}.`);
  const ahora = [...new Map(MODALIDADES.flatMap((m) => porModalidad[m]).filter((e) => e.ahora && e.meses.length < 12).map((e) => [e.id, e.nombre.toLowerCase()])).values()];
  if (ahora.length) partes.push(`In ${mesLargoEn(mes)} it is the season for ${listaY(ahora.slice(0, 4))}.`);
  if (spot.puerto_linz) partes.push(`Tides from LINZ predictions for ${spot.puerto_linz.nombre}.`);
  return partes.join(" ");
}

function listaEspeciesEn(lista) {
  if (!lista.length) return `<p class="nota">No species listed for this kind of fishing here.</p>`;
  return `<ul class="especies">${lista.map((e) => `<li${e.ahora && e.meses.length < 12 ? ' class="temporada"' : ""}><a href="/en/species/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a><span class="meses">${esc(e.temporada)}${e.maori ? ` · ${esc(e.maori)}` : ""}</span></li>`).join("")}</ul>`;
}

export function paginaSpotNZ(spot, todos, d) {
  const { especiesDatos, spotPrev, reservas, mes } = d;
  const zona = zonaDeSpotNZ(spot);
  const porModalidad = especiesDeSpotNZ(especiesDatos, spot, mes);
  const intro = introSpotNZ(spot, porModalidad, mes);
  const ruta = `/spots/${spot.slug}`;
  const titulo = `Fishing at ${spot.nombre}, NZ: species, season, tides and today's conditions | Costaviva`;
  const descripcion = `Fishing at ${spot.nombre}${zona ? ` (${zona.nombre})` : ""}, New Zealand: what to catch from the shore, from a boat and spearfishing, season by month, LINZ tides, today's waves and wind, and links to the MPI fishing rules.`;
  const migas = [{ nombre: "Spots", ruta: "/en/spots" }, ...(zona ? [{ nombre: zona.nombre, ruta: `/en/spots/region/${zona.slug}` }] : []), { nombre: spot.nombre, ruta: `/en${ruta}` }];
  const ld = [
    {
      "@context": "https://schema.org", "@type": ["Place", "TouristAttraction"], name: `Fishing at ${spot.nombre}`, description: intro,
      url: `${DOMINIO}/en${ruta}`, geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon }, touristType: "Recreational fishing",
      containedInPlace: { "@type": "Place", name: zona ? `${zona.nombre}, New Zealand` : "New Zealand" },
    },
    migasJsonLd(migas),
  ];
  const cercanos = cercanosNZ(todos, spot, 6);
  const cuerpo = `${migasHtml(migas, "en")}
<h1>Fishing at ${esc(spot.nombre)}</h1>
<p class="intro">${esc(intro)}</p>
${condicionesHoy(spotPrev, spot)}
${bloqueReservas(reservas)}
<section aria-labelledby="t-especies"><h2 id="t-especies">What you can catch at ${esc(spot.nombre)}</h2>
<p class="nota">Species of the MPI ${esc(AREAS_MPI[spot.region]?.nombre || "")} area and their season. Highlighted: in season in ${esc(mesLargoEn(mes))}.</p>
<div class="modalidades">${MODALIDADES.map((m) => `<section class="modalidad" aria-labelledby="t-${m}"><h3 id="t-${m}">${NOMBRE_MODALIDAD_EN[m]}</h3>${listaEspeciesEn(porModalidad[m])}</section>`).join("")}</div></section>
${bloqueNormativa(spot.region)}
${ctaEn(`Fish smarter at ${spot.nombre}`)}
<section aria-labelledby="t-cerca"><h2 id="t-cerca">Nearby spots</h2>
<ul class="chips">${cercanos.map((s) => `<li><a href="/en/spots/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul>
${zona ? `<p><a href="/en/spots/region/${esc(zona.slug)}">All spots in ${esc(zona.nombre)} →</a></p>` : ""}
</section>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagenAlt: `Fishing at ${spot.nombre} with Costaviva` }) };
}

// ---------------------------------------------------------------------------
// /en/spots y /en/spots/region/<zona>
// ---------------------------------------------------------------------------
const listaSpotsEn = (spots, base) => `<ul class="lista-spots">${spots.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "en"))
  .map((s) => `<li><a href="${base}/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul>`;

export function paginaIndiceSpotsNZ(todos) {
  const nz = spotsNZ(todos);
  const ruta = "/spots";
  const titulo = `Fishing spots in New Zealand: ${nz.length} places | Costaviva`;
  const descripcion = `${nz.length} fishing spots around New Zealand: what to catch at each one and when, LINZ tide times, today's waves and wind, and the MPI fishing rules for its area.`;
  const migas = [{ nombre: "Spots", ruta: "/en/spots" }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", publisher: ORG_LD }, migasJsonLd(migas)];
  const cuerpo = `${migasHtml(migas, "en")}
<h1>Fishing spots in New Zealand</h1>
<p class="intro">Pick a spot to see what you can catch there from the shore, from a boat or spearfishing, in which months, the tide times and today's conditions. You can also browse <a href="/en/species">by species</a> or check <a href="/en/tides">tides today</a>.</p>
${ZONAS_NZ.map((z) => {
    const del = nz.filter((s) => s.zona === z.zona);
    if (!del.length) return "";
    return `<section aria-labelledby="t-${z.slug}"><h2 id="t-${z.slug}"><a href="/en/spots/region/${z.slug}">${esc(z.nombre)}</a> <small>(${del.length})</small></h2>${listaSpotsEn(del, "/en/spots")}</section>`;
  }).join("\n")}
${ctaEn()}
<p class="nota">Fishing in Spain or Portugal? <a href="/spots" hreflang="es">Spots in Spain and Portugal (in Spanish)</a>.</p>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld }) };
}

export function paginaZonaSpotsNZ(zona, todos, especiesDatos, mes) {
  const del = spotsNZ(todos).filter((s) => s.zona === zona.zona);
  const ruta = `/spots/region/${zona.slug}`;
  const areas = new Set(del.map((s) => s.region));
  const deTemporada = especiesNZ(especiesDatos)
    .filter((e) => [...areas].some((a) => e.presencia?.[a]?.meses?.includes(mes)))
    .map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEn(e) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "en"));
  const titulo = `Fishing in ${zona.nombre}, NZ: ${del.length} spots, species and season | Costaviva`;
  const descripcion = `Fishing spots in ${zona.nombre}, New Zealand (${del.length}) and species in season in ${mesLargoEn(mes)}: ${deTemporada.slice(0, 5).map((e) => e.nombre.toLowerCase()).join(", ")}. LINZ tides and today's conditions.`;
  const migas = [{ nombre: "Spots", ruta: "/en/spots" }, { nombre: zona.nombre, ruta: `/en${ruta}` }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", about: { "@type": "Place", name: `${zona.nombre}, New Zealand` } }, migasJsonLd(migas)];
  const cuerpo = `${migasHtml(migas, "en")}
<h1>Fishing in ${esc(zona.nombre)}</h1>
<p class="intro">${del.length} fishing spots in ${esc(zona.nombre)}. For each one: species by kind of fishing and season, tide times and today's conditions. Tides for the area: <a href="/en/tides/region/${esc(zona.slug)}">${esc(zona.nombre)} tides</a>.</p>
${listaSpotsEn(del, "/en/spots")}
<section aria-labelledby="t-temp"><h2 id="t-temp">In season in ${esc(mesLargoEn(mes))}</h2>
<ul class="chips">${deTemporada.map((e) => `<li><a href="/en/species/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
${[...areas].map((a) => bloqueNormativa(a)).slice(0, 1).join("")}
${ctaEn()}
<p><a href="/en/spots">All of New Zealand →</a></p>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagenAlt: `Fishing in ${zona.nombre} with Costaviva` }) };
}

// ---------------------------------------------------------------------------
// /en/tides/<slug>, /en/tides, /en/tides/region/<zona>
// ---------------------------------------------------------------------------
// Pleamares y bajamares de hoy y mañana (hora de NZ) a partir de los eventos
// de LINZ del puerto: [{ dia: "today"|"tomorrow", tipo, hora, altura }].
export function mareasDiasNZ(eventos, ahora = Date.now()) {
  const fecha = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_NZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  const hora = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: ZONA_NZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t));
  const hoy = fecha(ahora);
  const manana = fecha(ahora + 36 * 3600 * 1000) === hoy ? fecha(ahora + 48 * 3600 * 1000) : fecha(ahora + 24 * 3600 * 1000);
  return (eventos || [])
    .filter((e) => [hoy, manana].includes(fecha(e.t)))
    .map((e) => ({ dia: fecha(e.t) === hoy ? "today" : "tomorrow", fechaISO: fecha(e.t), tipo: e.tipo, hora: hora(e.t), altura: Math.round(e.h * 100) / 100, pasada: e.t < ahora }));
}

export function paginaMareaNZ(spot, todos, d) {
  const { spotPrev, dias = [] } = d;
  const m = spotPrev?.marea || null;
  const zona = zonaDeSpotNZ(spot);
  const ruta = `/tides/${spot.slug}`;
  const pleamar = m?.proximas?.find((e) => e.tipo === "pleamar");
  const bajamar = m?.proximas?.find((e) => e.tipo === "bajamar");
  const b = spotPrev?.bloques?.[0];
  const resumen = [pleamar && `next high tide ${textoEvento(pleamar)}`, bajamar && `low tide ${textoEvento(bajamar)}`].filter(Boolean).join(", ");
  const titulo = `${spot.nombre} tide times today: high and low tide, waves | Costaviva`;
  const descripcion = `Tide times today at ${spot.nombre}, New Zealand${resumen ? `: ${resumen}` : ""}${b?.altura ? `; waves ${b.altura[0]}–${b.altura[1]} m` : ""}${b?.viento != null ? `, wind ${b.viento} km/h` : ""}. LINZ tide predictions, free and without an account.`;
  const migas = [{ nombre: "Tides", ruta: "/en/tides" }, ...(zona ? [{ nombre: zona.nombre, ruta: `/en/tides/region/${zona.slug}` }] : []), { nombre: spot.nombre, ruta: `/en${ruta}` }];
  const ld = [
    { "@context": "https://schema.org", "@type": "Place", name: spot.nombre, geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon }, url: `${DOMINIO}/en${ruta}` },
    { "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", isPartOf: { "@type": "WebSite", name: "Costaviva", url: `${DOMINIO}/` }, about: { "@type": "Place", name: spot.nombre } },
    migasJsonLd(migas),
  ];
  const tabla = dias.length
    ? `<div class="tabla-env"><table><thead><tr><th scope="col">Day</th><th scope="col">Tide</th><th scope="col">Time (NZ)</th><th scope="col">Height</th></tr></thead><tbody>
${dias.map((e) => `<tr${e.pasada ? ' class="nota"' : ""}><td>${e.dia === "today" ? "Today" : "Tomorrow"}</td><td>${tipoEn(e.tipo)}</td><td>${esc(e.hora)}</td><td>${e.altura} m</td></tr>`).join("")}
</tbody></table></div>`
    : `<p class="nota">Tide times are not available for this spot right now.</p>`;
  const filas = (spotPrev?.bloques || []).map((x) => `<tr><td>${esc(x.hora)}</td><td>${x.altura?.[0]}–${x.altura?.[1]} m</td><td>${x.viento ?? "–"} km/h ${esc(x.dirViento ?? "")}</td><td>${x.tempAgua != null ? `${x.tempAgua} °C` : "–"}</td></tr>`).join("");
  const cercanos = cercanosNZ(todos, spot, 6);
  const cuerpo = `${migasHtml(migas, "en")}
<h1>${esc(spot.nombre)} tide times today</h1>
${m ? `<section class="tarjeta hoy" aria-labelledby="t-ahora"><h2 id="t-ahora">Tide now</h2>
<div class="datos"><div class="dato"><span class="dato-etq">Now</span><span class="dato-val">${esc(String(m.altura))} m ${m.tendencia === "subiendo" ? "▲ rising" : m.tendencia === "bajando" ? "▼ falling" : ""}</span></div>
${pleamar ? `<div class="dato"><span class="dato-etq">Next high tide</span><span class="dato-val">${esc(textoEvento(pleamar))}</span></div>` : ""}
${bajamar ? `<div class="dato"><span class="dato-etq">Next low tide</span><span class="dato-val">${esc(textoEvento(bajamar))}</span></div>` : ""}</div></section>` : ""}
<section aria-labelledby="t-tabla"><h2 id="t-tabla">High and low tides today and tomorrow</h2>
${tabla}
${notaMareaLinz(m?.puerto || (spot.puerto_linz ? { ...spot.puerto_linz, metodo: spot.puerto_linz.tabla ? "tabla" : "secundario" } : null))}</section>
${filas ? `<section aria-labelledby="t-prev"><h2 id="t-prev">Waves and wind for the next hours</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Time</th><th scope="col">Waves</th><th scope="col">Wind</th><th scope="col">Water</th></tr></thead><tbody>${filas}</tbody></table></div>
<p class="nota">Marine weather: Open-Meteo (CC BY 4.0). Model forecast, offshore values may differ at the shore.</p></section>` : ""}
${ctaEn()}
<section aria-labelledby="t-cerca"><h2 id="t-cerca">Tides at nearby spots</h2>
<ul class="chips">${cercanos.map((s) => `<li><a href="/en/tides/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul>
${zona ? `<p><a href="/en/tides/region/${esc(zona.slug)}">All tides in ${esc(zona.nombre)} →</a></p>` : ""}</section>
<p><a href="/en/spots/${esc(spot.slug)}">Fishing at ${esc(spot.nombre)}: species, season and rules →</a></p>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("mareas"), imagenAlt: `${spot.nombre} tide times` }) };
}

export function paginaIndiceMareasNZ(todos) {
  const nz = spotsNZ(todos);
  const ruta = "/tides";
  const titulo = `Tide times today in New Zealand: ${nz.length} fishing spots | Costaviva`;
  const descripcion = `High and low tide times today for ${nz.length} fishing spots around New Zealand, from LINZ tide predictions, with waves and wind. Free, no account needed.`;
  const migas = [{ nombre: "Tides", ruta: "/en/tides" }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", publisher: ORG_LD }, migasJsonLd(migas)];
  const cuerpo = `${migasHtml(migas, "en")}
<h1>Tide times today in New Zealand</h1>
<p class="intro">High and low tides today and tomorrow at ${nz.length} fishing spots, from the official LINZ predictions for the nearest standard or secondary port.</p>
${ZONAS_NZ.map((z) => {
    const del = nz.filter((s) => s.zona === z.zona);
    if (!del.length) return "";
    return `<section aria-labelledby="t-${z.slug}"><h2 id="t-${z.slug}"><a href="/en/tides/region/${z.slug}">${esc(z.nombre)}</a> <small>(${del.length})</small></h2>${listaSpotsEn(del, "/en/tides")}</section>`;
  }).join("\n")}
<p class="nota">${esc(ATRIBUCION_LINZ)}. ${esc(AVISO_LINZ)}</p>
${ctaEn()}`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("mareas"), imagenAlt: "Tide times in New Zealand" }) };
}

export function paginaZonaMareasNZ(zona, todos) {
  const del = spotsNZ(todos).filter((s) => s.zona === zona.zona);
  const ruta = `/tides/region/${zona.slug}`;
  const titulo = `${zona.nombre} tide times today: ${del.length} fishing spots | Costaviva`;
  const descripcion = `Tide times today in ${zona.nombre}, New Zealand: high and low tides at ${del.length} fishing spots from LINZ predictions, with waves and wind.`;
  const migas = [{ nombre: "Tides", ruta: "/en/tides" }, { nombre: zona.nombre, ruta: `/en${ruta}` }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", about: { "@type": "Place", name: `${zona.nombre}, New Zealand` } }, migasJsonLd(migas)];
  const cuerpo = `${migasHtml(migas, "en")}
<h1>${esc(zona.nombre)} tide times today</h1>
<p class="intro">Tides at ${del.length} fishing spots in ${esc(zona.nombre)}. Fishing guide for the area: <a href="/en/spots/region/${esc(zona.slug)}">fishing in ${esc(zona.nombre)}</a>.</p>
${listaSpotsEn(del, "/en/tides")}
<p class="nota">${esc(ATRIBUCION_LINZ)}. ${esc(AVISO_LINZ)}</p>
${ctaEn()}
<p><a href="/en/tides">All of New Zealand →</a></p>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("mareas"), imagenAlt: `${zona.nombre} tide times` }) };
}

// ---------------------------------------------------------------------------
// /en/species/<slug> y /en/species
// ---------------------------------------------------------------------------
export function fichaEspecieNZ(e, todos, mes) {
  const areas = Object.keys(AREAS_MPI).filter((a) => e.presencia?.[a]?.meses?.length);
  const temporada = areas.map((a) => ({
    area: a, nombre: AREAS_MPI[a].nombre, url: AREAS_MPI[a].url,
    texto: textoMesesEn(e.presencia[a].meses), ahora: e.presencia[a].meses.includes(mes),
    freza: e.freza?.por_region?.[a]?.meses?.length ? textoMesesEn(e.freza.por_region[a].meses) : null,
  }));
  const modalidades = MODALIDADES.filter((m) => e.modalidades?.[m]?.aplica === true);
  const habitat = e.habitat?.verificado && e.habitat?.valor_en ? e.habitat.valor_en : null;
  const prof = e.profundidad_m?.verificado && Array.isArray(e.profundidad_m.valor) ? e.profundidad_m : null;
  const notaFreza = Object.values(e.freza?.por_region || {}).map((f) => f?.nota_en).find(Boolean) || null;
  const spots = spotsNZ(todos).filter((s) => areas.includes(s.region));
  const porZona = ZONAS_NZ.map((z) => ({ ...z, spots: spots.filter((s) => s.zona === z.zona) })).filter((z) => z.spots.length);
  return { id: e.id, slug: slugEspecie(e.id), emoji: e.emoji || "🐟", nombre: nombreEn(e), maori: e.nombres?.mi || null, cientifico: nombreCientifico(e), temporada, modalidades, habitat, prof, notaFreza, porZona };
}

export function paginaEspecieNZ(e, especiesDatos, todos, mes) {
  const f = fichaEspecieNZ(e, todos, mes);
  const ruta = `/species/${f.slug}`;
  const titulo = `${f.nombre}${f.maori && f.maori !== f.nombre ? ` (${f.maori})` : ""}: where and when to catch it in NZ | Costaviva`;
  const descripcion = `${f.nombre}${f.cientifico ? ` (${f.cientifico})` : ""} in New Zealand: season by MPI fishing area, how it is fished, habitat and the spots where you can catch it. Size and bag limits: MPI.`;
  const migas = [{ nombre: "Species", ruta: "/en/species" }, { nombre: f.nombre, ruta: `/en${ruta}` }];
  const intro = `${f.nombre}${f.maori ? ` (te reo Māori: ${f.maori})` : ""}${f.cientifico ? `, ${f.cientifico}` : ""}. ${f.modalidades.length ? `Fished ${listaY(f.modalidades.map((m) => MODALIDAD_CORTA_EN[m]))}.` : ""}${f.temporada.some((t) => t.ahora) ? ` In ${mesLargoEn(mes)} it is in season in ${listaY(f.temporada.filter((t) => t.ahora).map((t) => t.nombre))}.` : ""}`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", description: intro, dateModified: especiesDatos.version || undefined,
      about: { "@type": "Thing", name: f.nombre, alternateName: [f.maori, f.cientifico].filter(Boolean) }, publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas, "en")}
<h1><span aria-hidden="true">${esc(f.emoji)}</span> ${esc(f.nombre)}</h1>
<p class="cientifico">${f.cientifico ? `<em>${esc(f.cientifico)}</em>` : ""}${f.maori ? ` · ${esc(f.maori)} <span class="nota">(Māori)</span>` : ""}</p>
<p class="intro">${esc(intro)}</p>
${f.temporada.length ? `<section class="tarjeta" aria-labelledby="t-temp"><h2 id="t-temp">Season by fishing area</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">MPI area</th><th scope="col">Months</th><th scope="col">Spawning</th></tr></thead><tbody>
${f.temporada.map((t) => `<tr${t.ahora ? ' class="ahora"' : ""}><th scope="row">${esc(t.nombre)}</th><td>${esc(t.texto)}${t.ahora ? " · <strong>now</strong>" : ""}</td><td>${t.freza ? esc(t.freza) : "–"}</td></tr>`).join("")}
</tbody></table></div>
${f.notaFreza ? `<p class="nota">${esc(f.notaFreza)}</p>` : ""}</section>` : ""}
<section class="tarjeta aviso" aria-labelledby="t-normas"><h2 id="t-normas">Size and bag limits</h2>
<p>Minimum sizes, daily limits and closures depend on the area and change over time. Costaviva does not copy them: check MPI for each area.</p>
<ul>${f.temporada.map((t) => `<li><a href="${esc(t.url)}" rel="noopener" target="_blank">MPI fishing rules: ${esc(t.nombre)}</a></li>`).join("")}
<li><a href="${esc(URL_APP_MPI)}" rel="noopener" target="_blank">NZ Fishing Rules app (MPI, free)</a></li></ul>
<p class="nota">${esc(AVISO_RAHUI)}</p></section>
${f.modalidades.length ? `<section aria-labelledby="t-mod"><h2 id="t-mod">How it is fished</h2><ul class="modos">${f.modalidades.map((m) => `<li><strong>${NOMBRE_MODALIDAD_EN[m]}</strong></li>`).join("")}</ul></section>` : ""}
${f.habitat || f.prof ? `<section aria-labelledby="t-hab"><h2 id="t-hab">Where it lives</h2>
${f.habitat ? `<p>${esc(f.habitat)}</p>` : ""}${f.prof ? `<p>Usual depth: ${f.prof.valor[0]}–${f.prof.valor[1]} m${f.prof.maximo ? ` (down to about ${f.prof.maximo} m)` : ""}.</p>` : ""}
<p class="nota">Source: Fisheries New Zealand / MPI (CC BY 4.0).</p></section>` : ""}
${ctaEn(`When is ${f.nombre.toLowerCase()} biting today?`)}
${f.porZona.length ? `<section aria-labelledby="t-donde"><h2 id="t-donde">Where to catch ${esc(f.nombre.toLowerCase())}</h2>
${f.porZona.map((z) => `<h3><a href="/en/spots/region/${esc(z.slug)}">${esc(z.nombre)}</a></h3><ul class="chips">${z.spots.map((s) => `<li><a href="/en/spots/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul>`).join("")}
</section>` : ""}
<p><a href="/en/species">All New Zealand species →</a></p>`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: "New Zealand fishing species" }) };
}

export function paginaIndiceEspeciesNZ(especiesDatos, mes) {
  const ruta = "/species";
  const lista = especiesNZ(especiesDatos)
    .map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEn(e), maori: e.nombres?.mi || null, cientifico: nombreCientifico(e), emoji: e.emoji || "🐟", ahora: Object.values(e.presencia || {}).some((p) => p?.meses?.includes(mes) && p.meses.length < 12) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "en"));
  const titulo = `New Zealand fishing species: season, where to fish and MPI rules | Costaviva`;
  const descripcion = `${lista.length} recreational fishing species in New Zealand: English and Māori names, season by MPI fishing area, how they are fished and where, with links to the official MPI rules.`;
  const migas = [{ nombre: "Species", ruta: "/en/species" }];
  const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/en${ruta}`, inLanguage: "en", publisher: ORG_LD }, migasJsonLd(migas)];
  const ahora = lista.filter((e) => e.ahora);
  const cuerpo = `${migasHtml(migas, "en")}
<h1>New Zealand fishing species</h1>
<p class="intro">${lista.length} species: when they are caught in each MPI fishing area, how they are fished (from the shore, from a boat or spearfishing) and the spots where you can find them. Size and bag limits always on MPI. Browse <a href="/en/spots">by spot</a> too.</p>
${ahora.length ? `<section aria-labelledby="t-ahora"><h2 id="t-ahora">In season in ${esc(mesLargoEn(mes))}</h2>
<ul class="chips">${ahora.map((e) => `<li><a href="/en/species/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<section aria-labelledby="t-todas"><h2 id="t-todas">All species</h2>
<ul class="lista-especies">${lista.map((e) => `<li><a href="/en/species/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a>${e.maori ? ` <span class="nota">${esc(e.maori)}</span>` : ""}${e.cientifico ? ` <em class="nota">${esc(e.cientifico)}</em>` : ""}</li>`).join("")}</ul></section>
${ctaEn()}`;
  return { titulo, html: documentoEn({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("especies"), imagenAlt: "New Zealand fishing species" }) };
}

// ---------------------------------------------------------------------------
// Sitemap: URLs /en/ de Nueva Zelanda.
// ---------------------------------------------------------------------------
export function urlsEn({ spots, especies, fecha }) {
  const nz = spotsNZ(spots).slice().sort((a, b) => a.slug.localeCompare(b.slug));
  const zonas = ZONAS_NZ.filter((z) => nz.some((s) => s.zona === z.zona));
  const u = (ruta, changefreq, priority) => ({ loc: `${DOMINIO}/en${ruta}`, lastmod: fecha, changefreq, priority });
  if (!nz.length) return [];
  return [
    u("/spots", "daily", "0.9"),
    u("/species", "weekly", "0.9"),
    u("/tides", "daily", "0.8"),
    ...zonas.map((z) => u(`/spots/region/${z.slug}`, "daily", "0.8")),
    ...zonas.map((z) => u(`/tides/region/${z.slug}`, "daily", "0.75")),
    ...nz.map((s) => u(`/spots/${s.slug}`, "daily", "0.7")),
    ...nz.map((s) => u(`/tides/${s.slug}`, "hourly", "0.7")),
    ...especiesNZ(especies).slice().sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(`/species/${slugEspecie(e.id)}`, "monthly", "0.7")),
  ];
}
