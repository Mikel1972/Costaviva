// functions/_lib/seo/paginas-pt.js
// Páginas públicas en PORTUGUÉS EUROPEO (2026-10-11, aprobado por Mikel), bajo
// /pt/ con las mismas rutas que las españolas para que cada par lleve su
// hreflang (es, pt-PT y x-default español; idiomas.js):
//
//   /pt/spots/<slug>            pesca en un spot de Portugal
//   /pt/spots/region/portugal   pesqueiros de Portugal
//   /pt/mareas/<slug>           marea de hoy de un spot de Portugal
//   /pt/mareas/region/portugal  marés de hoje em Portugal
//   /pt/especies, /pt/especies/<slug>
//                               todas las especies de España y Portugal
//
// Puro: recibe los datos y devuelve { titulo, html }. Tests en
// test/seo-pt.test.js. Mismas reglas que las españolas: nada inventado,
// nada interno, datos reales de la app. Solo se publica en portugués lo que
// tiene traducción (_pt en especies.json, assets/i18n/pt.js); lo que no la
// tiene (hábitat, alimentación...) no sale en estas páginas.

import { DOMINIO, esc, documento, migasHtml, migasJsonLd, ctaPt, imagenOg, imagenOgRegion } from "./base.js";
import {
  REGIONES_MAREAS, nombreCortoSpot, slugEspecie, especiesDeSpot, profundidadDeSpot,
  camarasPublicasDeSpot, rioDeSpot, spotsCercanos, regionEspeciesDeSpot,
} from "./datos.js";
import * as VA from "../../../assets/js/ventana-actividad.js";
import { textoFondo } from "../../../assets/js/capa-tipo-fondo.js";
import { zonaDeSpot } from "../../../assets/js/regiones.js";
import { I18n } from "../../../assets/js/i18n-modulo.js";

const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
// Las páginas en portugués: los spots de la región "portugal" de /mareas.
export const REGION_PT = REGIONES_MAREAS.find((r) => r.slug === "portugal");
export const spotsPT = (spots) => (spots || []).filter((s) => REGION_PT.spots.has(s.slug));
export const esSpotPT = (slug) => REGION_PT.spots.has(slug);
const ALTERNOS = ["es", "pt"];

const t = (clave, vars) => I18n.t(clave, vars, "pt");
// Texto portugués de un dato: SOLO campo_pt (nunca el español de respaldo).
const soloPt = (obj, campo) => (obj && typeof obj[`${campo}_pt`] === "string" && obj[`${campo}_pt`].trim()) || null;
// Lo que solo sabe pintar el núcleo en el idioma activo (textoFondo...):
// síncrono, así que no se cruza con otras peticiones.
function enPortugues(fn) {
  const antes = I18n.idioma();
  I18n.fijarIdioma("pt");
  try { return fn(); } finally { I18n.fijarIdioma(antes); }
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CORTOS = MESES.map((m) => m.slice(0, 3));
export const mesLargoPt = (m) => MESES[m - 1];
export const NOMBRE_MODALIDAD_PT = { costa: "De terra", embarcacion: "Embarcação", submarina: "Pesca submarina" };
export const NOMBRE_REGION_PT = {
  cantabrico: "Cantábrico", atlantico_norte: "Galiza", portugal: "Portugal", golfo_cadiz: "Golfo de Cádis",
  mediterraneo: "Mediterrâneo", baleares: "Baleares", canarias: "Canárias", azores: "Açores", madeira: "Madeira",
};
const fmt = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
const listaE = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

// "Todo o ano", "out–mar", "jan–fev, jun" (como VA.textoMeses, en portugués).
export function textoMesesPt(meses) {
  const set = [...new Set(meses || [])].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!set.length) return "";
  if (set.length === 12) return "Todo o ano";
  const tramos = [];
  for (const m of set) {
    const u = tramos[tramos.length - 1];
    if (u && u[1] === m - 1) u[1] = m;
    else tramos.push([m, m]);
  }
  if (tramos.length > 1 && tramos[0][0] === 1 && tramos[tramos.length - 1][1] === 12) tramos[0][0] = tramos.pop()[0];
  return tramos.map(([a, b]) => (a === b ? MESES_CORTOS[a - 1] : `${MESES_CORTOS[a - 1]}–${MESES_CORTOS[b - 1]}`)).join(", ");
}

// Nombre portugués de una especie (nombres.pt; si no, el científico; si no, el español).
export function nombrePt(e) {
  return e?.nombres?.pt || String(e?.cientifico || "").split(" (")[0].trim() || e?.nombres?.es || e?.id;
}

// Motivo del índice en portugués: por su clave de assets/i18n; las reglas
// expertas, por su texto_pt. Sin traducción, no se enseña.
export function motivoPt(m, especiesDatos) {
  if (m.clave) return t(m.clave, m.vars);
  const regla = (especiesDatos?.reglas_expertas?.reglas || []).find((r) => r.texto === m.texto);
  return soloPt(regla, "texto");
}

const EVENTO = { pleamar: "preia-mar", bajamar: "baixa-mar" };
const textoEvento = (e) => `${e.manana ? "amanhã " : ""}${e.hora} (${fmt(e.altura)} m)`;
const tendencia = (x) => (x === "subiendo" ? "a encher ▲" : x === "bajando" ? "a vazar ▼" : "");

// "Condiciones de hoy" a partir del spot de /prevision.
export function condicionesPt(sp) {
  if (!sp || sp.error) return null;
  const b = sp.bloques?.[0];
  const m = sp.marea;
  if (!b && !m) return null;
  return {
    ola: b?.altura ? `${fmt(b.altura[0])}–${fmt(b.altura[1])} m` : null,
    olaDetalle: b?.periodo ? `${b.periodo} s` : null,
    viento: b?.viento != null ? `${b.viento} km/h${b.dirViento ? ` ${b.dirViento}` : ""}` : null,
    tempAgua: b?.tempAgua != null ? `${fmt(b.tempAgua)} °C` : null,
    marea: m?.altura != null ? `${fmt(m.altura)} m ${tendencia(m.tendencia)}`.trim() : null,
    mareaDetalle: [m?.coeficiente ? `coef. ${m.coeficiente}` : null,
      ...(m?.proximas || []).slice(0, 2).map((e) => `${EVENTO[e.tipo] || e.tipo} ${e.manana ? "amanhã " : ""}${e.hora}`)].filter(Boolean).join(" · ") || null,
    actualizado: sp.actualizado || null,
  };
}

// ---------------------------------------------------------------------------
// /pt/spots/<slug>
// ---------------------------------------------------------------------------
function fondoPt(tipoFondo, slug) {
  const e = tipoFondo?.spots?.[slug];
  if (!e) return null;
  const partes = (enPortugues(() => textoFondo(e)) || "").split(" · ");
  // Los nombres de las clases de fondo se fijan al cargar capa-tipo-fondo.js
  // (en español en el servidor): aquí se pasan al portugués.
  let texto = /^Fundo: /.test(partes[0]) && !/sem dado/i.test(partes[0]) ? partes[0] : null;
  if (texto) {
    for (const k of ["pradera", "posidonia", "roca", "arena", "grava", "fango"]) {
      texto = texto.replace(new RegExp(`(?<![\\p{L}])${I18n.t(`fondo.clase.${k}`, null, "es")}(?![\\p{L}])`, "gu"), t(`fondo.clase.${k}`));
    }
  }
  const orilla = e.orilla?.tipo ? t(`fondo.orilla.${e.orilla.tipo}`) : null;
  return texto || orilla ? { texto, orilla } : null;
}

function profundidadPt(profundidad, slug) {
  const p = profundidadDeSpot(profundidad, slug);
  if (!p) return null;
  const raw = profundidad.spots[slug];
  const dist = (m) => (m >= 1000 ? `${fmt(m / 1000)} km` : `${Math.round(m / 10) * 10} m`);
  const frases = [];
  if (Number.isFinite(raw.zona_m)) frases.push(`Fundo típico a 1 km da costa: cerca de ${Math.round(raw.zona_m)} m.`);
  const hitos = [[10, raw.dist_10m_m], [20, raw.dist_20m_m], [30, raw.dist_30m_m], [50, raw.dist_50m_m], [100, raw.dist_100m_m]].filter(([, d]) => Number.isFinite(d));
  if (hitos.length) frases.push(`Profundidades a partir do pesqueiro: ${hitos.map(([h, d]) => `${h} m a ${dist(d)}`).join(", ")}.`);
  if (Number.isFinite(raw.prof_max_5km_m)) frases.push(`O mais fundo a 5 km ou menos: cerca de ${Math.round(raw.prof_max_5km_m)} m (o que alcança uma embarcação que sai daqui).`);
  return { frases, zona_m: p.zona_m, max5: p.max5 };
}

// Especies del spot con nombre portugués, una fila por especie.
function tablaEspeciesPt(porModalidad, especiesDatos) {
  const porId = new Map((especiesDatos?.especies || []).map((e) => [e.id, e]));
  const filas = new Map();
  for (const m of VA.MODALIDADES) {
    for (const e of porModalidad[m] || []) {
      if (!filas.has(e.id)) filas.set(e.id, { ...e, nombre: nombrePt(porId.get(e.id)), modos: new Set() });
      filas.get(e.id).modos.add(m);
    }
  }
  const lista = [...filas.values()].sort((a, b) => (b.deTemporada - a.deTemporada) || a.nombre.localeCompare(b.nombre, "pt"));
  if (!lista.length) return `<p class="nota">Sem espécies com dados para este pesqueiro.</p>`;
  const marca = (si) => (si ? `<span aria-label="sim">✓</span>` : `<span aria-label="não">–</span>`);
  return `<div class="tabla-env"><table class="tabla-especies"><thead><tr><th scope="col">Espécie</th><th scope="col">Época</th>${VA.MODALIDADES.map((m) => `<th scope="col">${esc(NOMBRE_MODALIDAD_PT[m])}</th>`).join("")}</tr></thead><tbody>
${lista.map((e) => `<tr${e.deTemporada ? ' class="ahora"' : ""}><th scope="row"><a href="/pt/especies/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a></th><td>${esc(textoMesesPt(e.meses))}${e.deTemporada ? " · <strong>agora</strong>" : ""}${e.veda ? " · <strong>em defeso</strong>" : ""}</td>${VA.MODALIDADES.map((m) => `<td>${marca(e.modos.has(m))}</td>`).join("")}</tr>`).join("\n")}
</tbody></table></div>`;
}

export function introSpotPt(spot, { fondo, prof, destacadas, camaras, rio, mes, cercano }) {
  const n = nombreCortoSpot(spot.nombre);
  const partes = [`${n} (Portugal) é um dos pesqueiros que a Costaviva acompanha.`];
  if (fondo?.orilla || fondo?.texto) {
    const f = fondo.texto ? fondo.texto.replace(/^Fundo: /, "") : null;
    partes.push(`${fondo.orilla ? `Na beira-mar: ${fondo.orilla}` : "Beira-mar variada"}${f ? `; fundo próximo de ${f}` : ""}.`);
  }
  if (prof?.zona_m != null && prof?.max5 != null) {
    const cerca = (m) => (Math.round(m) <= 1 ? "1 m ou menos" : `cerca de ${Math.round(m)} m`);
    partes.push(`A um quilómetro da costa há ${cerca(prof.zona_m)} de água e a 5 km chega-se a ${cerca(prof.max5)}.`);
  }
  if (destacadas.length) {
    const lista = listaE(destacadas.slice(0, 4).map((x) => x.toLowerCase()));
    partes.push(destacadas.length > 4 ? `Em ${mesLargoPt(mes)} há ${destacadas.length} espécies da época; entre elas, ${lista}.` : `Em ${mesLargoPt(mes)} é época de ${lista}.`);
  }
  if (rio) partes.push(`Perto desagua o rio ${rio.nombre}.`);
  if (camaras.externas.length || camaras.enApp) partes.push("Tem câmara para ver o mar antes de sair.");
  if (cercano?.distancia != null) partes.push(`O pesqueiro mais próximo acompanhado pela Costaviva é ${nombreCortoSpot(cercano.nombre)}, a ${fmt(cercano.distancia < 10 ? cercano.distancia : Math.round(cercano.distancia))} km.`);
  return partes.join(" ");
}

function bloqueHoyPt(cond, indice, spot, especiesDatos) {
  if (!cond && !indice) {
    return `<section class="tarjeta hoy" aria-labelledby="t-hoy"><h2 id="t-hoy">Condições de hoje</h2>
<p class="nota">Neste momento não temos os dados de hoje deste pesqueiro. Tente novamente dentro de alguns minutos ou veja a <a href="/pt/mareas/${esc(spot.slug)}">maré de hoje</a>.</p></section>`;
  }
  const celda = (etq, val, det) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span>${det ? `<span class="dato-det">${esc(det)}</span>` : ""}</div>` : "");
  let indiceHtml = "";
  if (indice) {
    const esp = indice.especieId ? (especiesDatos?.especies || []).find((e) => e.id === indice.especieId) : null;
    const motivos = indice.motivos.map((m) => ({ ...m, pt: motivoPt(m, especiesDatos) })).filter((m) => m.pt);
    indiceHtml = `<div class="indice" data-nivel="${indice.nivel}">
  <div class="indice-nota"><span class="nota-nivel" data-nivel="${indice.nivel}">${indice.puntuacion}</span><span class="indice-etq">Índice de pesca de terra${esp ? ` · melhor agora: <a href="/pt/especies/${esc(slugEspecie(esp.id))}">${esc(nombrePt(esp).toLowerCase())}</a>` : ""}</span></div>
  ${indice.avisoOla ? `<p class="aviso-ola" role="note">⚠️ Onda perigosa para pescar de terra: todo o cuidado é pouco.</p>` : ""}
  ${motivos.length ? `<ul class="motivos">${motivos.map((m) => `<li class="${m.sube ? "sube" : "baja"}"><span class="flecha" aria-label="${m.sube ? "a favor" : "contra"}">${esc(m.flecha)}</span><span>${esc(m.pt)}</span></li>`).join("")}</ul>` : ""}
  ${indice.freza ? `<p class="nota">Está em desova: se o apanhar, devolva-o.</p>` : ""}
</div>`;
  }
  const hora = cond?.actualizado ? new Date(cond.actualizado).toLocaleString("pt-PT", { timeZone: zonaDeSpot(spot), hour: "2-digit", minute: "2-digit" }) : null;
  return `<section class="tarjeta hoy" aria-labelledby="t-hoy">
<h2 id="t-hoy">Condições de hoje${hora ? ` <small>(${hora})</small>` : ""}</h2>
${indiceHtml}
${cond ? `<div class="datos">${celda("Onda", cond.ola, cond.olaDetalle)}${celda("Vento", cond.viento, null)}${celda("Maré", cond.marea, cond.mareaDetalle)}${celda("Água", cond.tempAgua, null)}</div>` : ""}
<p class="nota">A janela hora a hora, as melhores horas para cada espécie e os alarmes, dentro da Costaviva. Marés de hoje em detalhe: <a href="/pt/mareas/${esc(spot.slug)}">maré em ${esc(nombreCortoSpot(spot.nombre))}</a>.</p>
</section>`;
}

export function paginaSpotPt(spot, todos, d) {
  const { especiesDatos, tipoFondo, profundidad, caudales, camarasApp, indice, mes, spotPrev } = d;
  const nombre = nombreCortoSpot(spot.nombre);
  const especies = especiesDeSpot(especiesDatos, spot, mes);
  const porId = new Map((especiesDatos?.especies || []).map((e) => [e.id, e]));
  const destacadas = [];
  for (const m of VA.MODALIDADES) for (const e of especies.porModalidad[m]) if (e.deTemporada && !destacadas.some((x) => x.id === e.id)) destacadas.push(e);
  destacadas.sort((a, b) => a.meses.length - b.meses.length);
  const nombresDest = destacadas.map((e) => nombrePt(porId.get(e.id)));
  const fondo = fondoPt(tipoFondo, spot.slug);
  const prof = profundidadPt(profundidad, spot.slug);
  const camaras = camarasPublicasDeSpot(spot.slug, camarasApp);
  const rio = rioDeSpot(spot.slug, caudales);
  const cercanos = spotsPT(todos).length > 1 ? spotsCercanos(spotsPT(todos), spot, 6) : [];
  const intro = introSpotPt(spot, { fondo, prof, destacadas: nombresDest, camaras, rio, mes, cercano: cercanos[0] });
  const ruta = `/spots/${spot.slug}`;
  const titulo = `Pesca em ${nombre}: espécies, época, fundo e condições de hoje | Costaviva`;
  const descripcion = `Pesca em ${nombre} (Portugal): ${nombresDest.length ? `agora ${nombresDest.slice(0, 3).map((x) => x.toLowerCase()).join(", ")}; ` : ""}o que se pesca de terra, de embarcação e na pesca submarina, tipo de fundo, profundidade e o índice de pesca de hoje.`;
  const migas = [{ nombre: "Pesqueiros", ruta: "/pt/spots/region/portugal" }, { nombre, ruta: `/pt${ruta}` }];
  const ld = [
    {
      "@context": "https://schema.org", "@type": ["Place", "TouristAttraction"], name: `Pesca em ${nombre}`, description: intro,
      url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT", geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon },
      touristType: "Pesca lúdica", containedInPlace: { "@type": "Place", name: "Portugal" },
    },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas, "pt")}
<h1>Pesca em ${esc(nombre)}</h1>
<p class="intro">${esc(intro)}</p>
${bloqueHoyPt(condicionesPt(spotPrev), indice, spot, especiesDatos)}
<section aria-labelledby="t-especies"><h2 id="t-especies">O que se pesca em ${esc(nombre)}</h2>
<p class="nota">Espécies de ${esc(NOMBRE_REGION_PT[especies.region] || "a zona")} com a sua época e a modalidade em que se pescam. Em destaque, as de ${esc(mesLargoPt(mes))}.</p>
${tablaEspeciesPt(especies.porModalidad, especiesDatos)}</section>
${fondo || prof ? `<section class="tarjeta" aria-labelledby="t-fondo"><h2 id="t-fondo">Fundo e profundidade</h2>
${fondo?.orilla ? `<p><strong>Beira-mar:</strong> ${esc(fondo.orilla)}.</p>` : ""}
${fondo?.texto ? `<p><strong>${esc(fondo.texto.replace(/^Fundo:/, "Fundo próximo:"))}</strong></p>` : ""}
${prof ? prof.frases.map((f) => `<p>${esc(f)}</p>`).join("") : ""}
<p class="nota">Orientativo, não serve para navegar.</p></section>` : ""}
${rio ? `<section class="tarjeta" aria-labelledby="t-rio"><h2 id="t-rio">Rio próximo</h2><p>Desagua perto o rio <strong>${esc(rio.nombre)}</strong>. Com muito caudal, a água fica turva junto à foz.</p></section>` : ""}
${camaras.externas.length || camaras.enApp ? `<section class="tarjeta" aria-labelledby="t-cam"><h2 id="t-cam">Câmaras</h2>
${camaras.enApp ? `<p>Com a Costaviva vê a câmara de ${esc(nombre)} junto às condições.</p>` : ""}
${camaras.externas.length ? `<ul class="camaras">${camaras.externas.map((c) => `<li><a href="${esc(c.url)}" rel="noopener nofollow" target="_blank">${esc(c.nombre)}</a> <span class="nota">(${esc(c.dueno)})</span></li>`).join("")}</ul><p class="nota">Câmaras dos respetivos donos: abrem no site deles.</p>` : ""}
</section>` : ""}
${ctaPt(`Pesque melhor em ${nombre}`)}
${cercanos.length ? `<section aria-labelledby="t-cerca"><h2 id="t-cerca">Pesqueiros próximos</h2>
<ul class="cercanos">${cercanos.map((s) => `<li><a href="/pt/spots/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a> <span class="nota">${fmt(s.distancia < 10 ? s.distancia : Math.round(s.distancia))} km</span> · <a href="/pt/mareas/${esc(s.slug)}">maré</a></li>`).join("")}</ul>
<p><a href="/pt/spots/region/portugal">Todos os pesqueiros de Portugal →</a></p>
</section>` : ""}`;
  return {
    titulo,
    html: documento({ titulo, descripcion, ruta, cuerpo, ld, idioma: "pt", alternos: ALTERNOS, imagen: imagenOgRegion(REGION_PT), imagenAlt: `Pesca em Portugal com a Costaviva` }),
  };
}

// ---------------------------------------------------------------------------
// /pt/spots/region/portugal
// ---------------------------------------------------------------------------
export function paginaRegionSpotsPt(spots, especiesDatos, mes) {
  const del = spotsPT(spots).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));
  const ruta = "/spots/region/portugal";
  const regiones = [...new Set(del.map(regionEspeciesDeSpot))];
  const deTemporada = (especiesDatos?.especies || [])
    .filter((e) => regiones.some((r) => e.presencia?.[r]?.meses?.includes(mes)))
    .map((e) => ({ slug: slugEspecie(e.id), nombre: nombrePt(e) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));
  const titulo = `Pesca em Portugal: ${del.length} pesqueiros, espécies e época | Costaviva`;
  const descripcion = `Pesqueiros em Portugal (${del.length}) e espécies da época em ${mesLargoPt(mes)}: ${deTemporada.slice(0, 5).map((e) => e.nombre.toLowerCase()).join(", ")}. Fundo, profundidade e condições de hoje.`;
  const migas = [{ nombre: "Pesqueiros", ruta: `/pt${ruta}` }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT", about: { "@type": "Place", name: "Portugal" }, publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas, "pt")}
<h1>Pesca em Portugal</h1>
<p class="intro">${del.length} pesqueiros na costa portuguesa. Em cada um: espécies por modalidade e época, fundo, profundidade, câmaras e o índice de pesca de hoje. Marés da zona: <a href="/pt/mareas/region/portugal">marés de hoje em Portugal</a>. Procure também <a href="/pt/especies">por espécie</a>.</p>
<ul class="lista-spots">${del.map((s) => `<li><a href="/pt/spots/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a></li>`).join("")}</ul>
<section aria-labelledby="t-temp"><h2 id="t-temp">Da época em ${esc(mesLargoPt(mes))}</h2>
<ul class="chips">${deTemporada.map((e) => `<li><a href="/pt/especies/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
${ctaPt()}`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, idioma: "pt", alternos: ALTERNOS, imagen: imagenOgRegion(REGION_PT), imagenAlt: "Pesca em Portugal com a Costaviva" }) };
}

// ---------------------------------------------------------------------------
// /pt/especies/<slug> y /pt/especies
// ---------------------------------------------------------------------------
const TIPO_VEDA_PT = { veda_recreativa: "Defeso na pesca lúdica", prohibida: "Captura proibida", solo_captura_y_suelta: "Só captura e devolução" };
// Zona de las tablas de tallas que comparten "ámbito corto" (como ZONA_JURISDICCION de datos.js).
const ZONA_TALLA_PT = {
  "ES-RD560-I": "Cantábrico-Noroeste e Golfo de Cádis", "ES-RD560-II": "Mediterrâneo", "ES-RD560-III": "Canárias",
  "UE-SWW": "águas ocidentais austrais", "UE-MED": "Mediterrâneo",
};

export function fichaEspeciePt(e, spots, mes) {
  const temporada = VA.REGIONES.filter((r) => e.presencia?.[r]?.meses?.length).map((r) => {
    const veda = VA.vedaActiva(e, r, mes);
    return {
      region: r, nombre: NOMBRE_REGION_PT[r], texto: textoMesesPt(e.presencia[r].meses), ahora: e.presencia[r].meses.includes(mes),
      freza: e.freza?.por_region?.[r]?.meses?.length ? textoMesesPt(e.freza.por_region[r].meses) : null,
      veda: veda ? (TIPO_VEDA_PT[veda.tipo] || "Defeso") : null,
    };
  });
  const modalidades = VA.MODALIDADES.filter((m) => e.modalidades?.[m]?.aplica === true).map((m) => ({
    id: m, nombre: NOMBRE_MODALIDAD_PT[m],
    normativa: (e.modalidades[m].normativa || []).map((n) => ({ texto: soloPt(n, "texto"), url: n.url || null })).filter((n) => n.texto),
  }));
  const tallas = (e.talla_minima || []).filter((x) => Number.isFinite(x.valor_cm)).map((x) => {
    const base = soloPt(x, "ambito_corto") || soloPt(x, "ambito");
    if (!base) return null;
    const zona = ZONA_TALLA_PT[x.jurisdiccion];
    return { cm: x.valor_cm, ambito: zona ? `${base} · ${zona}` : base, url: x.url || null };
  }).filter(Boolean);
  const vedas = (e.vedas || []).map((v) => ({
    texto: soloPt(v, "texto") ? `${TIPO_VEDA_PT[v.tipo] || "Defeso"}: ${soloPt(v, "texto")}` : (TIPO_VEDA_PT[v.tipo] || "Defeso"),
    meses: textoMesesPt(v.meses), regiones: (v.regiones || []).map((r) => NOMBRE_REGION_PT[r] || r), url: v.url || null,
  }));
  const cebos = [];
  const vistos = new Set();
  for (const c of e.cebos || []) {
    const n = soloPt(c, "nombre");
    if (!n || vistos.has(n.toLowerCase())) continue;
    vistos.add(n.toLowerCase());
    cebos.push({ nombre: n, modalidades: VA.modalidadesDeCebo(c).map((m) => NOMBRE_MODALIDAD_PT[m]) });
  }
  const conPresencia = new Set(temporada.map((x) => x.region));
  const enPortugal = spotsPT(spots).filter((s) => conPresencia.has(regionEspeciesDeSpot(s)))
    .map((s) => ({ slug: s.slug, nombre: nombreCortoSpot(s.nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));
  const otros = Object.entries(e.nombres || {}).filter(([k, v]) => k === "es" && v).map(([, v]) => v);
  return { id: e.id, slug: slugEspecie(e.id), emoji: e.emoji || "🐟", nombre: nombrePt(e), cientifico: String(e.cientifico || "").trim() || null, otros, temporada, modalidades, tallas, vedas, cebos, enPortugal };
}

export function introEspeciePt(f, mes) {
  const partes = [`${f.nombre}${f.cientifico && f.cientifico !== f.nombre ? ` (${f.cientifico})` : ""}: onde e quando se pesca em Portugal e Espanha, tamanhos mínimos e iscos.`];
  if (f.modalidades.length) partes.push(`Modalidades: ${listaE(f.modalidades.map((m) => m.nombre.toLowerCase()))}.`);
  const ahora = f.temporada.filter((x) => x.ahora && !x.veda).map((x) => x.nombre);
  if (ahora.length) partes.push(`Em ${mesLargoPt(mes)} está na época em ${listaE(ahora)}.`);
  if (f.tallas.length) {
    const min = Math.min(...f.tallas.map((x) => x.cm)), max = Math.max(...f.tallas.map((x) => x.cm));
    partes.push(min === max ? `Tamanho mínimo: ${max} cm.` : `Tamanho mínimo: de ${min} a ${max} cm consoante a zona.`);
  }
  return partes.join(" ");
}

export function paginaEspeciePt(e, especiesDatos, spots, mes) {
  const f = fichaEspeciePt(e, spots, mes);
  const n = f.nombre;
  const ruta = `/especies/${f.slug}`;
  const intro = introEspeciePt(f, mes);
  const titulo = `${n}: onde e quando pescar, tamanho mínimo e iscos | Costaviva`;
  const descripcion = `${n}${f.cientifico && f.cientifico !== n ? ` (${f.cientifico})` : ""}: época por zonas de Portugal e Espanha, modalidades, iscos e pesqueiros onde a pescar.${f.tallas.length ? ` Tamanho mínimo desde ${Math.min(...f.tallas.map((x) => x.cm))} cm.` : ""}`;
  const migas = [{ nombre: "Espécies", ruta: "/pt/especies" }, { nombre: n, ruta: `/pt${ruta}` }];
  const ld = [
    {
      "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT", description: intro,
      dateModified: especiesDatos.version || undefined,
      about: { "@type": "Thing", name: n, alternateName: [f.cientifico, ...f.otros].filter((x) => x && x !== n) }, publisher: ORG_LD,
    },
    migasJsonLd(migas),
  ];
  const aviso = soloPt(especiesDatos, "aviso_legal") || "Tamanhos mínimos orientativos: prevalece a norma em vigor.";
  const cuerpo = `${migasHtml(migas, "pt")}
<h1><span aria-hidden="true">${esc(f.emoji)}</span> ${esc(n)}</h1>
<p class="cientifico">${f.cientifico && f.cientifico !== n ? `<em>${esc(f.cientifico)}</em>` : ""}${f.otros.length ? ` · ${f.otros.map((o) => `${esc(o)} <span class="nota">(espanhol)</span>`).join(" · ")}` : ""}</p>
<p class="intro">${esc(intro)}</p>
${f.temporada.length ? `<section class="tarjeta" aria-labelledby="t-temp"><h2 id="t-temp">Época por zonas</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Zona</th><th scope="col">Meses</th><th scope="col">Desova</th></tr></thead><tbody>
${f.temporada.map((x) => `<tr${x.ahora ? ' class="ahora"' : ""}><th scope="row">${esc(x.nombre)}</th><td>${esc(x.texto)}${x.ahora && !x.veda ? " · <strong>agora</strong>" : ""}${x.veda ? ` · <strong>${esc(x.veda.toLowerCase())}</strong>` : ""}</td><td>${x.freza ? esc(x.freza) : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">Em desova: se o apanhar, devolva-o.</p></section>` : ""}
${f.vedas.length ? `<section class="tarjeta aviso" aria-labelledby="t-veda"><h2 id="t-veda">Defesos e proibições</h2><ul>${f.vedas.map((v) => `<li>${esc(v.texto)}${v.meses ? ` <span class="nota">(${esc(v.meses)}${v.regiones.length ? `; ${esc(v.regiones.join(", "))}` : ""})</span>` : ""}${v.url ? ` <a href="${esc(v.url)}" rel="noopener nofollow" target="_blank">norma</a>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.tallas.length ? `<section class="tarjeta" aria-labelledby="t-talla"><h2 id="t-talla">Tamanho mínimo</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Tamanho</th><th scope="col">Onde se aplica</th><th scope="col">Norma</th></tr></thead><tbody>
${f.tallas.map((x) => `<tr><td><strong>${x.cm} cm</strong></td><td>${esc(x.ambito)}</td><td>${x.url ? `<a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">ver</a>` : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">${esc(aviso)}</p></section>` : ""}
${f.modalidades.length ? `<section aria-labelledby="t-mod"><h2 id="t-mod">Como se pesca</h2><ul class="modos">${f.modalidades.map((m) => `<li><strong>${esc(m.nombre)}</strong>${m.normativa.length ? `<ul>${m.normativa.map((x) => `<li class="nota">${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">norma</a>` : ""}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.cebos.length ? `<section aria-labelledby="t-cebos"><h2 id="t-cebos">Iscos e amostras típicos</h2><ul class="chips">${f.cebos.map((c) => `<li>${esc(c.nombre)}${c.modalidades.length ? ` <span class="nota">(${esc(c.modalidades.join(", ").toLowerCase())})</span>` : ""}</li>`).join("")}</ul></section>` : ""}
${ctaPt(`Quando pica hoje: ${n.toLowerCase()}?`)}
${f.enPortugal.length ? `<section aria-labelledby="t-donde"><h2 id="t-donde">Onde pescar em Portugal</h2>
<ul class="chips">${f.enPortugal.map((s) => `<li><a href="/pt/spots/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<p><a href="/pt/especies">Todas as espécies →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", idioma: "pt", alternos: ALTERNOS, imagen: imagenOg("especies"), imagenAlt: "Espécies de pesca: tamanhos mínimos, defesos e época" }) };
}

export function paginaIndiceEspeciesPt(especiesDatos, mes) {
  const ruta = "/especies";
  const lista = (especiesDatos?.especies || [])
    .map((e) => ({ slug: slugEspecie(e.id), nombre: nombrePt(e), cientifico: e.cientifico, emoji: e.emoji || "🐟", ahora: Object.values(e.presencia || {}).some((p) => p?.meses?.includes(mes)) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));
  const titulo = "Espécies de pesca em Portugal e Espanha: época, tamanhos mínimos e iscos | Costaviva";
  const descripcion = `${lista.length} espécies da pesca lúdica em Portugal e Espanha: época por zonas, tamanho mínimo com a sua norma, modalidades, iscos e onde as pescar.`;
  const migas = [{ nombre: "Espécies", ruta: `/pt${ruta}` }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT", publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas, "pt")}
<h1>Espécies de pesca em Portugal e Espanha</h1>
<p class="intro">Fichas de ${lista.length} espécies: quando se pescam em cada zona, tamanho mínimo com a ligação para a norma, modalidades (de terra, de embarcação ou pesca submarina), iscos típicos e os pesqueiros onde as encontrar. Procure também <a href="/pt/spots/region/portugal">por pesqueiro</a>.</p>
<section aria-labelledby="t-ahora"><h2 id="t-ahora">Da época em ${esc(mesLargoPt(mes))} nalguma zona</h2>
<ul class="chips">${lista.filter((e) => e.ahora).map((e) => `<li><a href="/pt/especies/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
<section aria-labelledby="t-todas"><h2 id="t-todas">Todas as espécies</h2>
<ul class="lista-especies">${lista.map((e) => `<li><a href="/pt/especies/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a>${e.cientifico && e.cientifico !== e.nombre ? ` <em class="nota">${esc(e.cientifico)}</em>` : ""}</li>`).join("")}</ul></section>
${ctaPt()}`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, idioma: "pt", alternos: ALTERNOS, imagen: imagenOg("especies"), imagenAlt: "Espécies de pesca: tamanhos mínimos, defesos e época" }) };
}

// ---------------------------------------------------------------------------
// /pt/mareas/<slug> y /pt/mareas/region/portugal (datos de /prevision)
// ---------------------------------------------------------------------------
const hora24 = (etq) => {
  const m = /^(\d+)(am|pm)$/.exec(etq || "");
  if (!m) return etq || "";
  return `${String((Number(m[1]) % 12) + (m[2] === "pm" ? 12 : 0)).padStart(2, "0")}:00`;
};

export function paginaMareaPt(sp, todos) {
  const nombre = nombreCortoSpot(sp.nombre);
  const ruta = `/mareas/${sp.slug}`;
  const proximas = sp.marea?.proximas || [];
  const pleamar = proximas.find((e) => e.tipo === "pleamar");
  const bajamar = proximas.find((e) => e.tipo === "bajamar");
  const b = sp.bloques?.[0];
  const cond = condicionesPt(sp);
  const resumen = [pleamar && `preia-mar ${textoEvento(pleamar)}`, bajamar && `baixa-mar ${textoEvento(bajamar)}`].filter(Boolean).join(", ");
  const titulo = `Maré hoje em ${nombre}: preia-mar, baixa-mar e ondulação | Costaviva`;
  const descripcion = `Maré hoje em ${nombre}: ${resumen ? `próxima ${resumen}; ` : ""}ondulação ${cond?.ola || "sem dados agora"}, vento ${cond?.viento || "sem dados agora"}${cond?.tempAgua ? `, água a ${cond.tempAgua}` : ""}. Dados reais atualizados a cada hora, grátis e sem conta.`;
  const migas = [{ nombre: "Marés", ruta: "/pt/mareas/region/portugal" }, { nombre, ruta: `/pt${ruta}` }];
  const ld = [
    { "@context": "https://schema.org", "@type": "Place", name: nombre, geo: { "@type": "GeoCoordinates", latitude: sp.lat, longitude: sp.lon }, url: `${DOMINIO}/pt${ruta}` },
    {
      "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT",
      ...(sp.actualizado ? { dateModified: new Date(sp.actualizado).toISOString() } : {}),
      isPartOf: { "@type": "WebSite", name: "Costaviva", url: `${DOMINIO}/` }, about: { "@type": "Place", name: nombre },
    },
    migasJsonLd(migas),
  ];
  const actualizado = sp.actualizado ? new Date(sp.actualizado).toLocaleString("pt-PT", { timeZone: zonaDeSpot(sp) }) : null;
  const filas = (sp.bloques || []).map((x) => `<tr><td>${esc(hora24(x.hora))}</td><td>${x.altura ? `${fmt(x.altura[0])}–${fmt(x.altura[1])} m` : "–"}</td><td>${x.viento ?? "–"} km/h ${esc(x.dirViento ?? "")}</td><td>${x.tempAgua != null ? `${fmt(x.tempAgua)} °C` : "–"}</td></tr>`).join("");
  const cercanos = spotsCercanos(spotsPT(todos), sp, 8);
  const celda = (etq, val) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span></div>` : "");
  const cuerpo = `${migasHtml(migas, "pt")}
<h1>Maré hoje em ${esc(nombre)}</h1>
${actualizado ? `<p class="nota">Dados reais, atualizados: ${esc(actualizado)}</p>` : ""}
<section class="tarjeta hoy" aria-labelledby="t-marea"><h2 id="t-marea">Próximas marés</h2>
<div class="datos">${celda("Próxima preia-mar", pleamar ? textoEvento(pleamar) : null)}${celda("Próxima baixa-mar", bajamar ? textoEvento(bajamar) : null)}${celda("Maré agora", cond?.marea || null)}${celda("Ondulação", cond?.ola || null)}${celda("Vento", cond?.viento || null)}${celda("Água", cond?.tempAgua || null)}</div>
${sp.marea?.coeficiente ? `<p class="nota">Coeficiente de maré: ${esc(sp.marea.coeficiente)}.</p>` : ""}</section>
${ctaPt()}
${filas ? `<section aria-labelledby="t-prev"><h2 id="t-prev">Previsão das próximas horas em ${esc(nombre)}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Hora</th><th scope="col">Ondulação</th><th scope="col">Vento</th><th scope="col">Água</th></tr></thead><tbody>${filas}</tbody></table></div></section>` : ""}
<p class="nota">A Costaviva é uma app de condições costeiras em tempo real (ondulação, marés, corrente, webcams, radar de chuva) e diário de pesca para a costa de Portugal e Espanha. A maré, a ondulação e o vento de ${esc(nombre)} são grátis e não precisam de conta. Horas locais, calculadas com os mesmos dados da app (Open-Meteo, CC BY 4.0). Orientativo: não serve para navegar.</p>
${cercanos.length ? `<section aria-labelledby="t-cerca"><h2 id="t-cerca">Pesqueiros próximos</h2><ul class="chips">${cercanos.map((s) => `<li><a href="/pt/mareas/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a></li>`).join("")}</ul></section>` : ""}
<p><a href="/pt/spots/${esc(sp.slug)}">Pesca em ${esc(nombre)}: espécies, época, fundo e profundidade →</a></p>
<p><a href="/pt/mareas/region/portugal">Marés em toda a costa portuguesa →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, idioma: "pt", alternos: ALTERNOS, imagen: imagenOgRegion(REGION_PT), imagenAlt: `Maré hoje em ${nombre}` }) };
}

export function paginaRegionMareasPt(spotsPrev) {
  const del = spotsPT(spotsPrev).filter((s) => !s.error).sort((a, b) => a.nombre.localeCompare(b.nombre, "pt"));
  const ruta = "/mareas/region/portugal";
  const titulo = "Marés hoje em Portugal: preia-mar, baixa-mar e ondulação | Costaviva";
  const descripcion = `Marés hoje em Portugal: próxima preia-mar e baixa-mar, ondulação e vento em tempo real de ${del.length} pesqueiros. Grátis e sem conta.`;
  const migas = [{ nombre: "Marés", ruta: `/pt${ruta}` }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}/pt${ruta}`, inLanguage: "pt-PT", about: { "@type": "Place", name: "Portugal" }, publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const ev = (s, tipo) => (s.marea?.proximas || []).find((e) => e.tipo === tipo);
  const cuerpo = `${migasHtml(migas, "pt")}
<h1>Marés hoje em Portugal</h1>
<p class="intro">${esc(descripcion)}</p>
${ctaPt()}
<section aria-labelledby="t-tabla"><h2 id="t-tabla">Próximas marés e ondulação por pesqueiro</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Pesqueiro</th><th scope="col">Preia-mar</th><th scope="col">Baixa-mar</th><th scope="col">Onda</th><th scope="col">Vento</th></tr></thead><tbody>
${del.map((s) => {
  const p = ev(s, "pleamar"), b = ev(s, "bajamar"), o = s.bloques?.[0];
  return `<tr><th scope="row"><a href="/pt/mareas/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a> <small><a href="/pt/spots/${esc(s.slug)}">pesca</a></small></th><td>${p ? esc(textoEvento(p)) : "–"}</td><td>${b ? esc(textoEvento(b)) : "–"}</td><td>${o?.altura ? `${fmt(o.altura[0])}–${fmt(o.altura[1])} m` : "–"}</td><td>${o?.viento != null ? `${o.viento} km/h ${esc(o.dirViento || "")}` : "–"}</td></tr>`;
}).join("\n")}
</tbody></table></div>
<p class="nota">Horas locais de cada pesqueiro, calculadas com os mesmos dados da app (Open-Meteo, CC BY 4.0). Orientativo: não serve para navegar.</p></section>
<p><a href="/pt/spots/region/portugal">O que se pesca em Portugal: espécies e época por pesqueiro →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, idioma: "pt", alternos: ALTERNOS, imagen: imagenOgRegion(REGION_PT), imagenAlt: "Marés hoje em Portugal" }) };
}

// URLs del sitemap en portugués.
export function urlsPt({ spots, especies, fecha, fechaEspecies }) {
  const u = (ruta, lastmod, changefreq, priority) => ({ loc: `${DOMINIO}/pt${ruta}`, lastmod, changefreq, priority });
  const pt = spotsPT(spots).sort((a, b) => a.slug.localeCompare(b.slug));
  return [
    u("/spots/region/portugal", fecha, "daily", "0.8"),
    u("/mareas/region/portugal", fecha, "daily", "0.75"),
    u("/especies", fechaEspecies, "weekly", "0.8"),
    ...pt.map((s) => u(`/spots/${s.slug}`, fecha, "daily", "0.7")),
    ...pt.map((s) => u(`/mareas/${s.slug}`, fecha, "hourly", "0.7")),
    ...[...(especies || [])].sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(`/especies/${slugEspecie(e.id)}`, fechaEspecies, "monthly", "0.6")),
  ];
}

