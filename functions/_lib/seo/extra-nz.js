// functions/_lib/seo/extra-nz.js — contenido propio añadido a las páginas de
// Nueva Zelanda (2026-11-26, Mikel: «si nueva zelanda está funcionando…
// probemos a crear más contenidos» → «sí»). Igual en en/es/pt:
//
//   1. Profundidad del spot (GEBCO_2026, assets/datos/profundidad-spots.json,
//      68 spots NZ): fondo típico, a qué distancia se llega a 10/20/30/50 m y
//      lo más hondo a 5 km.
//   2. Cámaras cercanas (assets/js/camaras-nz.js): SOLO como enlace a la web
//      de su dueño, el modo que permiten todos; nada se inserta aquí.
//   3. En las páginas de zona: qué especies EMPIEZAN su temporada este mes y
//      cuáles están en su último mes (de especies.json, por área de MPI).
//
// Solo datos verificados del repo; ninguna cifra de normativa.
import { esc } from "./base.js";
import { CAMARAS_NZ, CONDICIONES_NZ } from "../../../assets/js/camaras-nz.js";

const ATRIB_GEBCO = "GEBCO Compilation Group (2026) GEBCO_2026 Grid";

const T = {
  en: {
    dec: ".",
    fondoT: "Depth", tipico: (m) => `Typical depth 1 km off the shore: about ${m} m.`,
    desde: (l) => `Depths from the spot: ${l}.`, a: (h, d) => `${h} m at ${d}`,
    max5: (m) => `Deepest within 5 km: about ${m} m (what a boat launched here can reach).`,
    notaFondo: `Approximate, not for navigation. Bathymetry: ${ATRIB_GEBCO}.`,
    camT: "Cameras near this spot", camNota: "Cameras belong to their owners and open on their websites.",
    nuevasT: (mes) => `Starting in ${mes}`, nuevasTxt: (mes) => `Species whose season in this area starts in ${mes}:`,
    ultimasT: (mes) => `Last month of the season`, ultimasTxt: (mes) => `In season in ${mes} and out of season next month:`,
  },
  es: {
    dec: ",",
    fondoT: "Profundidad", tipico: (m) => `Fondo típico a 1 km de la orilla: unos ${m} m.`,
    desde: (l) => `Profundidades desde el spot: ${l}.`, a: (h, d) => `${h} m a ${d}`,
    max5: (m) => `Lo más profundo a 5 km o menos: unos ${m} m (lo que alcanza una embarcación que sale de aquí).`,
    notaFondo: `Orientativo, no sirve para navegar. Batimetría: ${ATRIB_GEBCO}.`,
    camT: "Cámaras cerca de este spot", camNota: "Cámaras de sus dueños: se abren en su web.",
    nuevasT: (mes) => `Empiezan en ${mes}`, nuevasTxt: (mes) => `Especies cuya temporada en esta zona empieza en ${mes}:`,
    ultimasT: () => "Último mes de temporada", ultimasTxt: (mes) => `De temporada en ${mes} y fuera de temporada el mes que viene:`,
  },
  pt: {
    dec: ",",
    fondoT: "Profundidade", tipico: (m) => `Fundo típico a 1 km da costa: cerca de ${m} m.`,
    desde: (l) => `Profundidades a partir do pesqueiro: ${l}.`, a: (h, d) => `${h} m a ${d}`,
    max5: (m) => `O mais fundo a 5 km ou menos: cerca de ${m} m (o que alcança uma embarcação que sai daqui).`,
    notaFondo: `Orientativo, não serve para navegar. Batimetria: ${ATRIB_GEBCO}.`,
    camT: "Câmaras perto deste pesqueiro", camNota: "Câmaras dos respetivos donos: abrem no site deles.",
    nuevasT: (mes) => `Começam em ${mes}`, nuevasTxt: (mes) => `Espécies cuja época nesta zona começa em ${mes}:`,
    ultimasT: () => "Último mês da época", ultimasTxt: (mes) => `Na época em ${mes} e fora dela no próximo mês:`,
  },
};
const textos = (idioma) => T[idioma] || T.en;

function distancia(m, dec) {
  return m >= 1000 ? `${String(Math.round(m / 100) / 10).replace(".", dec)} km` : `${Math.round(m / 10) * 10} m`;
}

// Frases de profundidad del spot, o null si no hay dato.
export function profundidadNZ(prof, slug, idioma = "en") {
  const p = prof?.spots?.[slug];
  if (!p) return null;
  const L = textos(idioma);
  const frases = [];
  if (Number.isFinite(p.zona_m)) frases.push(L.tipico(Math.round(p.zona_m)));
  const hitos = [[10, p.dist_10m_m], [20, p.dist_20m_m], [30, p.dist_30m_m], [50, p.dist_50m_m], [100, p.dist_100m_m]].filter(([, d]) => Number.isFinite(d));
  if (hitos.length) frases.push(L.desde(hitos.map(([h, d]) => L.a(h, distancia(d, L.dec))).join(", ")));
  if (Number.isFinite(p.prof_max_5km_m)) frases.push(L.max5(Math.round(p.prof_max_5km_m)));
  return frases.length ? frases : null;
}

export function bloqueProfundidadNZ(prof, slug, idioma = "en") {
  const frases = profundidadNZ(prof, slug, idioma);
  if (!frases) return "";
  const L = textos(idioma);
  return `<section class="tarjeta" aria-labelledby="t-fondo"><h2 id="t-fondo">${esc(L.fondoT)}</h2>
${frases.map((f) => `<p>${esc(f)}</p>`).join("")}
<p class="nota">${esc(L.notaFondo)}</p></section>`;
}

// Cámaras del spot que se pueden enlazar (todas las de NZ permiten "enlace").
export function camarasEnlaceNZ(slug, idioma = "en", lista = CAMARAS_NZ) {
  return lista
    .filter((c) => c.spot === slug && (CONDICIONES_NZ[c.condiciones]?.modos_permitidos || []).includes("enlace"))
    .map((c) => ({ nombre: idioma === "es" ? c.nombre : c.nombre_en || c.nombre, dueno: c.dueno, url: c.url }));
}

export function bloqueCamarasNZ(slug, idioma = "en") {
  const cams = camarasEnlaceNZ(slug, idioma);
  if (!cams.length) return "";
  const L = textos(idioma);
  return `<section class="tarjeta" aria-labelledby="t-cam"><h2 id="t-cam">${esc(L.camT)}</h2>
<ul class="camaras">${cams.map((c) => `<li><a href="${esc(c.url)}" rel="noopener nofollow" target="_blank">${esc(c.nombre)}</a> <span class="nota">(${esc(c.dueno)})</span></li>`).join("")}</ul>
<p class="nota">${esc(L.camNota)}</p></section>`;
}

// Especies que empiezan temporada este mes y las que están en su último mes,
// en alguna de las áreas de MPI de la zona. `especies` = especiesNZ(datos).
export function cambiosDeTemporada(especies, areas, mes) {
  const ant = mes === 1 ? 12 : mes - 1;
  const sig = mes === 12 ? 1 : mes + 1;
  const empiezan = [];
  const terminan = [];
  for (const e of especies) {
    const meses = [...new Set([...areas].flatMap((a) => e.presencia?.[a]?.meses || []))];
    if (!meses.includes(mes) || meses.length === 12) continue;
    if (!meses.includes(ant)) empiezan.push(e);
    if (!meses.includes(sig)) terminan.push(e);
  }
  return { empiezan, terminan };
}

// `enlace(e)` → { href, nombre } de la especie en el idioma de la página.
export function bloqueCambiosTemporadaNZ({ especies, areas, mes, mesTexto, idioma = "en", enlace }) {
  const { empiezan, terminan } = cambiosDeTemporada(especies, areas, mes);
  if (!empiezan.length && !terminan.length) return "";
  const L = textos(idioma);
  const chips = (lista) => `<ul class="chips">${lista.map(enlace).sort((a, b) => a.nombre.localeCompare(b.nombre, idioma))
    .map((x) => `<li><a href="${esc(x.href)}">${esc(x.nombre)}</a></li>`).join("")}</ul>`;
  return [
    empiezan.length ? `<section aria-labelledby="t-empiezan"><h2 id="t-empiezan">${esc(L.nuevasT(mesTexto))}</h2>
<p class="nota">${esc(L.nuevasTxt(mesTexto))}</p>${chips(empiezan)}</section>` : "",
    terminan.length ? `<section aria-labelledby="t-terminan"><h2 id="t-terminan">${esc(L.ultimasT(mesTexto))}</h2>
<p class="nota">${esc(L.ultimasTxt(mesTexto))}</p>${chips(terminan)}</section>` : "",
  ].filter(Boolean).join("\n");
}
