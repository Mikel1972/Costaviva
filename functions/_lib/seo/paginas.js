// functions/_lib/seo/paginas.js
// HTML de las páginas públicas de spots y especies (puro: recibe los datos,
// devuelve { titulo, html }). Tests en test/seo-paginas.test.js.
//
// Enfoque de cada página, para no duplicar /mareas/<spot> (que va de marea,
// pleamar y bajamar): /spots/<spot> va de PESCA (qué especies, cuándo, con
// qué fondo y profundidad, cámaras y río) y solo trae un resumen corto de
// las condiciones de hoy, con enlace a /mareas/<spot> para la tabla de
// mareas. Cada una con su canonical.

import { DOMINIO, esc, documento, migasHtml, migasJsonLd, cta } from "./base.js";
import {
  especiesDeSpot, fondoDeSpot, profundidadDeSpot, camarasPublicasDeSpot, rioDeSpot, spotsCercanos, introSpot,
  nombreCortoSpot, regionDeSlug, REGIONES_MAREAS, fichaEspecie, introEspecie, slugEspecie, mesLargo,
  NOMBRE_REGION_ESPECIES, regionEspeciesDeSpot, especiesDestacadas,
} from "./datos.js";
import { NOMBRE_MODALIDAD, MODALIDADES } from "../../../assets/js/ventana-actividad.js";

const nombreRegion = (r) => r.nombre.split(" (")[0];
const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/icon.svg` };

// ---------------------------------------------------------------------------
// /spots/<slug>
// ---------------------------------------------------------------------------
function bloqueCondiciones(cond, indice, spot) {
  if (!cond && !indice) {
    return `<section class="tarjeta hoy" aria-labelledby="t-hoy"><h2 id="t-hoy">Condiciones de hoy</h2>
<p class="nota">Ahora mismo no tenemos los datos de hoy de este spot. Vuelve a probar en unos minutos o mira la <a href="/mareas/${esc(spot.slug)}">marea de hoy</a>.</p></section>`;
  }
  const celda = (etq, val, det) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span>${det ? `<span class="dato-det">${esc(det)}</span>` : ""}</div>` : "");
  const indiceHtml = indice
    ? `<div class="indice" data-nivel="${indice.nivel}">
  <div class="indice-nota"><span class="nota-nivel" data-nivel="${indice.nivel}">${indice.puntuacion}</span><span class="indice-etq">Índice de pesca desde costa${indice.especie ? ` · mejor ahora: <a href="/especies/${esc(slugEspecie(indice.especieId))}">${esc(indice.especie.toLowerCase())}</a>` : ""}</span></div>
  ${indice.avisoOla ? `<p class="aviso-ola" role="note">${esc(indice.avisoOla)}</p>` : ""}
  ${indice.motivos.length ? `<ul class="motivos">${indice.motivos.map((m) => `<li class="${m.sube ? "sube" : "baja"}"><span class="flecha" aria-label="${m.sube ? "a favor" : "en contra"}">${esc(m.flecha)}</span> ${esc(m.texto)}</li>`).join("")}</ul>` : ""}
  ${indice.freza ? `<p class="nota">Está en freza: si lo pescas, devuélvelo.</p>` : ""}
</div>`
    : "";
  const hora = cond?.actualizado ? new Date(cond.actualizado).toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }) : null;
  return `<section class="tarjeta hoy" aria-labelledby="t-hoy">
<h2 id="t-hoy">Condiciones de hoy${hora ? ` <small>(${hora})</small>` : ""}</h2>
${indiceHtml}
${cond ? `<div class="datos">${celda("Ola", cond.ola, cond.olaDetalle)}${celda("Viento", cond.viento, cond.vientoDetalle)}${celda("Marea", cond.marea, cond.mareaDetalle)}${celda("Agua", cond.tempAgua, null)}</div>` : ""}
<p class="nota">La ventana hora a hora, las mejores horas para cada especie y las alarmas, dentro de Costaviva. Mareas de hoy en detalle: <a href="/mareas/${esc(spot.slug)}">marea en ${esc(nombreCortoSpot(spot.nombre))}</a>.</p>
</section>`;
}

function listaEspecies(lista) {
  if (!lista.length) return `<p class="nota">Sin especies con datos para esta modalidad aquí.</p>`;
  return `<ul class="especies">${lista
    .map((e) => `<li${e.deTemporada ? ' class="temporada"' : ""}><a href="/especies/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a><span class="meses">${esc(e.temporada)}${e.deTemporada ? " · ahora" : ""}${e.veda ? " · en veda" : ""}</span></li>`)
    .join("")}</ul>`;
}

export function paginaSpot(spot, todos, d) {
  const { especiesDatos, tipoFondo, profundidad, caudales, camarasApp, cond, indice, mes } = d;
  const nombre = nombreCortoSpot(spot.nombre);
  const region = regionDeSlug(spot.slug);
  const especies = especiesDeSpot(especiesDatos, spot, mes);
  const fondo = fondoDeSpot(tipoFondo, spot.slug);
  const prof = profundidadDeSpot(profundidad, spot.slug);
  const camaras = camarasPublicasDeSpot(spot.slug, camarasApp);
  const rio = rioDeSpot(spot.slug, caudales);
  const intro = introSpot(spot, { region, fondo, prof, especies, camaras, rio, mes });
  const cercanos = spotsCercanos(todos, spot, 6);
  const ruta = `/spots/${spot.slug}`;
  const deTemporada = especiesDestacadas(especies, ["costa"]).slice(0, 3).map((x) => x.toLowerCase());

  const titulo = `Pesca en ${nombre}: especies, temporada, fondo y condiciones de hoy | Costaviva`;
  const descripcion = `Pesca en ${nombre}${region ? ` (${nombreRegion(region)})` : ""}: ${deTemporada.length ? `ahora ${deTemporada.join(", ")}; ` : ""}qué se pesca desde costa, en embarcación y en submarina, tipo de fondo, profundidad y el índice de pesca de hoy.`;
  const migas = [{ nombre: "Spots", ruta: "/spots" }, ...(region ? [{ nombre: nombreRegion(region), ruta: `/spots/region/${region.slug}` }] : []), { nombre, ruta }];

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": ["Place", "TouristAttraction"],
      name: `Pesca en ${nombre}`,
      description: intro,
      url: `${DOMINIO}${ruta}`,
      geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon },
      touristType: "Pesca recreativa",
      ...(region ? { containedInPlace: { "@type": "Place", name: nombreRegion(region) } } : {}),
    },
    migasJsonLd(migas),
  ];

  const seccionModalidades = MODALIDADES.map(
    (m) => `<section class="modalidad" aria-labelledby="t-${m}"><h3 id="t-${m}">${NOMBRE_MODALIDAD[m]}</h3>${listaEspecies(especies.porModalidad[m])}</section>`
  ).join("");

  const cuerpo = `${migasHtml(migas)}
<h1>Pesca en ${esc(nombre)}</h1>
<p class="intro">${esc(intro)}</p>
${bloqueCondiciones(cond, indice, spot)}
<section aria-labelledby="t-especies"><h2 id="t-especies">Qué se pesca en ${esc(nombre)}</h2>
<p class="nota">Especies de ${esc(NOMBRE_REGION_ESPECIES[especies.region] || "la zona")} con su temporada. Resaltadas, las de ${esc(mesLargo(mes))}.</p>
<div class="modalidades">${seccionModalidades}</div></section>
${fondo || prof ? `<section class="tarjeta" aria-labelledby="t-fondo"><h2 id="t-fondo">Fondo y profundidad</h2>
${fondo?.orilla ? `<p><strong>Orilla:</strong> ${esc(fondo.orilla)}.</p>` : ""}
${fondo?.texto ? `<p><strong>${esc(fondo.texto.split(" · ")[0].replace(/^Fondo:/, "Fondo cercano:"))}</strong></p>` : ""}
${prof ? prof.frases.map((f) => `<p>${esc(f)}</p>`).join("") : ""}
<p class="nota">Orientativo, no sirve para navegar.</p></section>` : ""}
${rio ? `<section class="tarjeta" aria-labelledby="t-rio"><h2 id="t-rio">Río cercano</h2><p>Desemboca cerca el río <strong>${esc(rio.nombre)}</strong>${rio.caudal ? `: ahora lleva ${esc(String(Math.round(rio.caudal.valor * 10) / 10).replace(".", ","))} m³/s${rio.caudal.categoria ? ` (caudal ${esc(rio.caudal.categoria)})` : ""}${rio.caudal.estacion ? `, estación de ${esc(rio.caudal.estacion)}` : ""}` : ""}. Con mucho caudal el agua se enturbia cerca de la desembocadura.</p></section>` : ""}
${camaras.externas.length || camaras.enApp ? `<section class="tarjeta" aria-labelledby="t-cam"><h2 id="t-cam">Cámaras</h2>
${camaras.enApp ? `<p>Con Costaviva ves la cámara de ${esc(nombre)} junto a las condiciones.</p>` : ""}
${camaras.externas.length ? `<ul class="camaras">${camaras.externas.map((c) => `<li><a href="${esc(c.url)}" rel="noopener nofollow" target="_blank">${esc(c.nombre)}</a> <span class="nota">(${esc(c.dueno)})</span></li>`).join("")}</ul><p class="nota">Cámaras de sus dueños: se abren en su web.</p>` : ""}
</section>` : ""}
${cta(`Pesca mejor en ${nombre}`)}
<section aria-labelledby="t-cerca"><h2 id="t-cerca">Spots cercanos</h2>
<ul class="chips">${cercanos.map((s) => `<li><a href="/spots/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a></li>`).join("")}</ul>
${region ? `<p><a href="/spots/region/${esc(region.slug)}">Todos los spots de ${esc(nombreRegion(region))} →</a></p>` : ""}
</section>`;

  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld }) };
}

// ---------------------------------------------------------------------------
// /spots y /spots/region/<region>
// ---------------------------------------------------------------------------
function listaSpots(spots) {
  return `<ul class="lista-spots">${spots
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((s) => `<li><a href="/spots/${esc(s.slug)}">${esc(nombreCortoSpot(s.nombre))}</a></li>`)
    .join("")}</ul>`;
}

export function paginaIndiceSpots(spots) {
  const ruta = "/spots";
  const titulo = `Spots de pesca en España y Portugal: ${spots.length} lugares | Costaviva`;
  const descripcion = `${spots.length} spots de pesca de la costa de España y Portugal: qué especies se pescan en cada uno y cuándo, tipo de fondo, profundidad y el índice de pesca de hoy.`;
  const migas = [{ nombre: "Spots", ruta }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${ruta}`, inLanguage: "es", publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas)}
<h1>Spots de pesca en España y Portugal</h1>
<p class="intro">Elige tu spot para ver qué se pesca allí desde costa, en embarcación o en submarina, en qué meses, cómo es el fondo y cuánta profundidad hay cerca, con el índice de pesca de hoy. También puedes buscar <a href="/especies">por especie</a>.</p>
${REGIONES_MAREAS.map((r) => {
  const del = spots.filter((s) => r.spots.has(s.slug));
  return `<section aria-labelledby="t-${r.slug}"><h2 id="t-${r.slug}"><a href="/spots/region/${r.slug}">${esc(nombreRegion(r))}</a> <small>(${del.length})</small></h2>${listaSpots(del)}</section>`;
}).join("\n")}
${cta()}`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld }) };
}

export function paginaRegionSpots(region, spots, especiesDatos, mes) {
  const del = spots.filter((s) => region.spots.has(s.slug));
  const nombre = nombreRegion(region);
  const ruta = `/spots/region/${region.slug}`;
  // Especies de temporada este mes en las regiones de especies de estos spots.
  const regionesEsp = [...new Set(del.map(regionEspeciesDeSpot))];
  const deTemporada = especiesDatos.especies
    .filter((e) => regionesEsp.some((r) => e.presencia?.[r]?.meses?.includes(mes)))
    .map((e) => ({ slug: slugEspecie(e.id), nombre: e.nombres?.es || e.id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const titulo = `Pesca en ${nombre}: ${del.length} spots, especies y temporada | Costaviva`;
  const descripcion = `Spots de pesca en ${nombre} (${del.length}) y especies de temporada en ${mesLargo(mes)}: ${deTemporada.slice(0, 5).map((e) => e.nombre.toLowerCase()).join(", ")}. Fondo, profundidad y condiciones de hoy.`;
  const migas = [{ nombre: "Spots", ruta: "/spots" }, { nombre, ruta }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${ruta}`, inLanguage: "es", about: { "@type": "Place", name: nombre } },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas)}
<h1>Pesca en ${esc(nombre)}</h1>
<p class="intro">${del.length} spots de pesca en ${esc(nombre)}. En cada uno: especies por modalidad y temporada, fondo, profundidad, cámaras y el índice de pesca de hoy. Mareas de la zona: <a href="/mareas/region/${esc(region.slug)}">mareas en ${esc(nombre)}</a>.</p>
${listaSpots(del)}
<section aria-labelledby="t-temp"><h2 id="t-temp">De temporada en ${esc(mesLargo(mes))}</h2>
<ul class="chips">${deTemporada.map((e) => `<li><a href="/especies/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
${cta()}
<p><a href="/spots">Todas las regiones →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld }) };
}

// ---------------------------------------------------------------------------
// /especies/<slug> y /especies
// ---------------------------------------------------------------------------
export function paginaEspecie(e, especiesDatos, spots, mes) {
  const f = fichaEspecie(e, especiesDatos, spots, mes);
  const n = f.nombres.es;
  const ruta = `/especies/${f.slug}`;
  const intro = introEspecie(f, mes);
  const titulo = `${n}: dónde y cuándo pescarla, talla mínima y cebos | Costaviva`;
  const tallaTxt = f.tallas.length ? ` Talla mínima desde ${Math.min(...f.tallas.map((t) => t.cm))} cm.` : "";
  const descripcion = `${n}${f.nombres.cientifico ? ` (${f.nombres.cientifico})` : ""}: temporada por zonas de España y Portugal, modalidades, cebos y spots donde pescarla.${tallaTxt}`;
  const migas = [{ nombre: "Especies", ruta: "/especies" }, { nombre: n, ruta }];
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: titulo,
      url: `${DOMINIO}${ruta}`,
      inLanguage: "es",
      description: intro,
      dateModified: especiesDatos.version || undefined,
      about: { "@type": "Thing", name: n, alternateName: [f.nombres.cientifico, ...f.nombres.otros.map((o) => o.nombre)].filter(Boolean) },
      publisher: ORG_LD,
    },
    migasJsonLd(migas),
  ];
  const cuerpo = `${migasHtml(migas)}
<h1><span aria-hidden="true">${esc(f.emoji)}</span> ${esc(n)}</h1>
<p class="cientifico">${f.nombres.cientifico ? `<em>${esc(f.nombres.cientifico)}</em>` : ""}${f.nombres.otros.length ? ` · ${f.nombres.otros.map((o) => `${esc(o.nombre)} <span class="nota">(${esc(o.idioma)})</span>`).join(" · ")}` : ""}</p>
<p class="intro">${esc(intro)}</p>
${f.temporada.length ? `<section class="tarjeta" aria-labelledby="t-temp"><h2 id="t-temp">Temporada por zonas</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Zona</th><th scope="col">Meses</th><th scope="col">Freza</th></tr></thead><tbody>
${f.temporada.map((t) => `<tr${t.ahora ? ' class="ahora"' : ""}><th scope="row">${esc(t.nombre)}</th><td>${esc(t.texto)}${t.ahora && !t.veda ? " · <strong>ahora</strong>" : ""}${t.veda ? ` · <strong>en veda</strong>` : ""}</td><td>${t.freza ? esc(t.freza) : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">En freza: si lo pescas, devuélvelo.</p></section>` : ""}
${f.vedas.length ? `<section class="tarjeta aviso" aria-labelledby="t-veda"><h2 id="t-veda">Vedas y prohibiciones</h2><ul>${f.vedas.map((v) => `<li>${esc(v.texto)}${v.meses ? ` <span class="nota">(${esc(v.meses)}${v.regiones.length ? `; ${esc(v.regiones.join(", "))}` : ""})</span>` : ""}${v.url ? ` <a href="${esc(v.url)}" rel="noopener nofollow" target="_blank">norma</a>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.tallas.length ? `<section class="tarjeta" aria-labelledby="t-talla"><h2 id="t-talla">Talla mínima</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">Talla</th><th scope="col">Dónde se aplica</th><th scope="col">Norma</th></tr></thead><tbody>
${f.tallas.map((t) => `<tr><td><strong>${t.cm} cm</strong></td><td>${esc(t.ambito)}</td><td>${t.url ? `<a href="${esc(t.url)}" rel="noopener nofollow" target="_blank">ver${t.revisado ? ` (revisada ${esc(t.revisado)})` : ""}</a>` : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">${esc(especiesDatos.aviso_legal || "Tallas orientativas: manda la norma vigente.")}</p></section>` : ""}
${f.modalidades.length ? `<section aria-labelledby="t-mod"><h2 id="t-mod">Cómo se pesca</h2><ul class="modos">${f.modalidades.map((m) => `<li><strong>${esc(m.nombre)}</strong>${m.consejo ? `: ${esc(m.consejo)}` : ""}${m.normativa.length ? `<ul>${m.normativa.map((x) => `<li class="nota">${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">norma</a>` : ""}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.cebos.length ? `<section aria-labelledby="t-cebos"><h2 id="t-cebos">Cebos y señuelos típicos</h2><ul class="chips">${f.cebos.map((c) => `<li>${esc(c.nombre)}${c.modalidades.length ? ` <span class="nota">(${esc(c.modalidades.join(", ").toLowerCase())})</span>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.textos.habitat || f.textos.actividad || f.textos.alimentacion ? `<section aria-labelledby="t-cost"><h2 id="t-cost">Costumbres</h2>
${f.textos.habitat ? `<p><strong>Dónde vive:</strong> ${esc(f.textos.habitat)}</p>` : ""}
${f.textos.actividad ? `<p><strong>Cuándo come:</strong> ${esc(f.textos.actividad)}</p>` : ""}
${f.textos.alimentacion ? `<p><strong>Qué come:</strong> ${esc(f.textos.alimentacion)}</p>` : ""}</section>` : ""}
${cta(`¿Cuándo pica hoy ${n.toLowerCase()}?`)}
${f.porRegion.length ? `<section aria-labelledby="t-donde"><h2 id="t-donde">Dónde pescar ${esc(n.toLowerCase())}</h2>
${f.porRegion.map((r) => `<h3><a href="/spots/region/${esc(r.slug)}">${esc(r.nombre)}</a></h3><ul class="chips">${r.spots.map((s) => `<li><a href="/spots/${esc(s.slug)}">${esc(s.nombre)}</a></li>`).join("")}</ul>`).join("")}
</section>` : ""}
<p><a href="/especies">Todas las especies →</a></p>`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article" }) };
}

export function paginaIndiceEspecies(especiesDatos, mes) {
  const ruta = "/especies";
  const lista = especiesDatos.especies
    .map((e) => ({ slug: slugEspecie(e.id), nombre: e.nombres?.es || e.id, cientifico: e.cientifico, emoji: e.emoji || "🐟", ahora: Object.values(e.presencia || {}).some((p) => p?.meses?.includes(mes)) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const titulo = `Especies de pesca en España y Portugal: temporada, tallas y cebos | Costaviva`;
  const descripcion = `${lista.length} especies de pesca recreativa en España y Portugal: temporada por zonas, talla mínima con su norma, modalidades, cebos y dónde pescarlas.`;
  const migas = [{ nombre: "Especies", ruta }];
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${ruta}`, inLanguage: "es", publisher: ORG_LD },
    migasJsonLd(migas),
  ];
  const ahora = lista.filter((e) => e.ahora);
  const cuerpo = `${migasHtml(migas)}
<h1>Especies de pesca en España y Portugal</h1>
<p class="intro">Fichas de ${lista.length} especies: cuándo se pescan en cada zona, talla mínima con el enlace a la norma, modalidades (desde costa, embarcación o submarina), cebos típicos y los spots donde encontrarlas. Busca también <a href="/spots">por spot</a>.</p>
<section aria-labelledby="t-ahora"><h2 id="t-ahora">De temporada en ${esc(mesLargo(mes))} en alguna zona</h2>
<ul class="chips">${ahora.map((e) => `<li><a href="/especies/${esc(e.slug)}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
<section aria-labelledby="t-todas"><h2 id="t-todas">Todas las especies</h2>
<ul class="lista-especies">${lista.map((e) => `<li><a href="/especies/${esc(e.slug)}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a>${e.cientifico ? ` <em class="nota">${esc(e.cientifico)}</em>` : ""}</li>`).join("")}</ul></section>
${cta()}`;
  return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld }) };
}
