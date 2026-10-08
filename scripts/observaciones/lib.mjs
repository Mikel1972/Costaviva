// scripts/observaciones/lib.mjs
// Lógica pura (sin red) de las observaciones abiertas y de "Comparte tu
// captura". La usan scripts/observaciones/descargar.mjs y
// test/observaciones.test.js. Aprobado por Mikel (2026-10-08, "añade todo lo
// legal"). Sin IA.
//
// Qué fija este módulo:
//   - QUÉ LICENCIAS valen para qué (clasificarLicencia). Costaviva es de pago:
//     solo CC0 / CC BY / CC BY-SA sirven para uso comercial. CC BY-NC y
//     CC BY-NC-SA se guardan APARTE y marcadas "solo referencia interna, no
//     comercial"; nunca se muestran en la app. Todo lo demás (sin licencia =
//     todos los derechos reservados, -ND) se descarta.
//   - CÓMO se casa un nombre científico con una especie de
//     assets/datos/especies.json (construirMapaEspecies / especieDeNombre).
//   - Que las coordenadas OCULTADAS por el observador o por la plataforma
//     (geoprivacidad de iNaturalist, taxón amenazado...) NUNCA se intentan
//     afinar: se redondean aún más (0,2°), no menos.
//   - El difuminado de las capturas compartidas por usuarios (rejilla ~5 km)
//     y el umbral k-anónimo (k ≥ 5 usuarios distintos), espejo exacto de lo
//     que hace la migración 20261008150000_capturas_compartidas.sql.

// ---------------------------------------------------------------------------
// Licencias
// ---------------------------------------------------------------------------

// Normaliza las formas en que llega una licencia:
//   GBIF (campo `license` del registro): "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
//     "http://creativecommons.org/publicdomain/zero/1.0/legalcode"; en filtros, "CC_BY_4_0".
//   iNaturalist (`license_code`): "cc0", "cc-by", "cc-by-nc", "cc-by-sa", "cc-by-nd",
//     "cc-by-nc-sa", "cc-by-nc-nd", null (= todos los derechos reservados).
// Devuelve "cc0" | "cc-by" | "cc-by-sa" | "cc-by-nc" | "cc-by-nc-sa" |
// "cc-by-nd" | "cc-by-nc-nd" | null.
export function normalizarLicencia(valor) {
  if (valor == null) return null;
  const v = String(valor).trim().toLowerCase();
  if (!v) return null;
  if (/publicdomain\/zero|^cc0|cc0_1_0|^cc-zero/.test(v)) return "cc0";
  let m = v.match(/licenses\/([a-z-]+)\//);
  let codigo = m ? m[1] : v.replace(/_\d.*$/, "").replace(/_/g, "-").replace(/^cc-?/, "");
  codigo = codigo.replace(/^cc-?/, "");
  const valido = ["by", "by-sa", "by-nc", "by-nc-sa", "by-nd", "by-nc-nd"];
  if (!valido.includes(codigo)) return null;
  return `cc-${codigo}`;
}

export const LICENCIAS_COMERCIALES = new Set(["cc0", "cc-by", "cc-by-sa"]);
export const LICENCIAS_NO_COMERCIALES = new Set(["cc-by-nc", "cc-by-nc-sa"]);

// "comercial"     -> se puede usar en Costaviva (con atribución si es BY).
// "no_comercial"  -> solo referencia interna, fichero aparte, nunca en la app.
// "descartar"     -> no se guarda (todos los derechos reservados, -ND).
export function clasificarLicencia(valor) {
  const l = normalizarLicencia(valor);
  if (l && LICENCIAS_COMERCIALES.has(l)) return "comercial";
  if (l && LICENCIAS_NO_COMERCIALES.has(l)) return "no_comercial";
  return "descartar";
}

export function necesitaAtribucion(valor) {
  const l = normalizarLicencia(valor);
  return !!l && l !== "cc0";
}

// ---------------------------------------------------------------------------
// Especies: nombre científico -> id de especies.json
// ---------------------------------------------------------------------------

// El campo `cientifico` de especies.json tiene varias formas reales:
//   "Dicentrarchus labrax"                         -> binomio exacto
//   "Solea spp." / "Trachurus spp."                -> todo el género
//   "Mugilidae (Chelon labrosus, Mugil spp.)"      -> familia + lista
//   null                                           -> sin nombre (no se mapea)
// Devuelve [{ id, tipo: "especie"|"genero"|"familia", nombre }].
export function patronesDeEspecie(esp) {
  const c = typeof esp?.cientifico === "string" ? esp.cientifico.trim() : "";
  if (!c) return [];
  const salida = [];
  const familia = c.match(/^([A-Z][a-z]+idae)\b/);
  if (familia) salida.push({ id: esp.id, tipo: "familia", nombre: familia[1] });
  const dentro = c.match(/\(([^)]*)\)/);
  const trozos = familia ? (dentro ? dentro[1].split(",") : []) : [c.replace(/\(.*\)/, "")];
  for (const t of trozos) {
    const s = t.trim();
    const gen = s.match(/^([A-Z][a-z]+)\s+spp?\.?$/);
    if (gen) { salida.push({ id: esp.id, tipo: "genero", nombre: gen[1] }); continue; }
    const bin = s.match(/^([A-Z][a-z]+)\s+([a-z-]+)/);
    if (bin) salida.push({ id: esp.id, tipo: "especie", nombre: `${bin[1]} ${bin[2]}` });
  }
  return salida;
}

// Índice para casar observaciones. Las especies con `presencia` en una sola
// región (p. ej. chicharro_canario) se guardan con esa región para que un
// género compartido (Trachurus) no se reparta mal.
export function construirMapaEspecies(datosEspecies) {
  const especie = new Map();
  const genero = new Map();
  const familia = new Map();
  for (const e of datosEspecies?.especies || []) {
    const regiones = e.presencia ? Object.keys(e.presencia) : null;
    for (const p of patronesDeEspecie(e)) {
      const destino = p.tipo === "especie" ? especie : p.tipo === "genero" ? genero : familia;
      const lista = destino.get(p.nombre) || [];
      lista.push({ id: e.id, regiones });
      destino.set(p.nombre, lista);
    }
  }
  return { especie, genero, familia };
}

function elegir(lista, region) {
  if (!lista || !lista.length) return null;
  if (lista.length === 1) return lista[0].id;
  if (region) {
    const conRegion = lista.filter((x) => x.regiones && x.regiones.includes(region));
    if (conRegion.length === 1) return conRegion[0].id;
  }
  return null; // ambiguo: mejor sin mapear que mal mapeado
}

// nombre: nombre científico aceptado de la observación (GBIF `species` o
// `acceptedScientificName` sin autor). familiaObs: familia de la observación.
// Prioridad: binomio exacto > género > familia. Un binomio que está en
// especies.json NUNCA cae a su género (Trachurus trachurus es "jurel", no
// "chicharro_canario"); y un género con un binomio propio en el mapa solo
// recoge las OTRAS especies del género si hay una entrada "spp." explícita.
export function especieDeNombre(mapa, nombre, { familiaObs = null, region = null } = {}) {
  if (!nombre) return null;
  const limpio = String(nombre).trim().split(/\s+/).slice(0, 2).join(" ");
  const directo = elegir(mapa.especie.get(limpio), region);
  if (directo) return directo;
  if (mapa.especie.has(limpio)) return null; // existe pero ambiguo
  const gen = limpio.split(" ")[0];
  const porGenero = elegir(mapa.genero.get(gen), region);
  if (porGenero) return porGenero;
  if (familiaObs) return elegir(mapa.familia.get(familiaObs), region);
  return null;
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

export function redondear(v, paso) {
  return Math.round(Math.round(v / paso) * paso * 1e6) / 1e6;
}

// ¿La plataforma o el observador ocultaron la posición? Señales de GBIF
// (iNaturalist las rellena así): informationWithheld / dataGeneralizations,
// o una incertidumbre grande. De iNaturalist directo: obscured /
// geoprivacy / taxon_geoprivacy distintos de "open".
export function coordenadaOculta(r) {
  if (!r) return false;
  if (r.obscured === true) return true;
  for (const k of ["geoprivacy", "taxon_geoprivacy"]) {
    if (r[k] && r[k] !== "open") return true;
  }
  const texto = `${r.informationWithheld || ""} ${r.dataGeneralizations || ""}`.toLowerCase();
  if (/coordinat|obscur|generaliz|withheld|privac/.test(texto)) return true;
  const inc = Number(r.coordinateUncertaintyInMeters);
  return Number.isFinite(inc) && inc > 5000;
}

// Coordenadas que se GUARDAN de una observación abierta. Nunca se
// "des-ocultan": si está ocultada se guarda aún más gruesa (0,2° ≈ 20 km) y
// marcada; si no, a 0,01° (~1 km), que basta para casarla con un spot y no
// guarda más precisión de la necesaria.
export function coordenadasGuardables(lat, lon, oculta) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const paso = oculta ? 0.2 : 0.01;
  return { lat: redondear(lat, paso), lon: redondear(lon, paso), oculta: !!oculta };
}

// Rejilla de ~5 km para las capturas que comparten los usuarios. El paso en
// longitud se ensancha con la latitud para que la celda mida lo mismo en km
// (en Canarias y en Hondarribia). Devuelve el CENTRO de la celda: nunca el
// punto real. Misma fórmula que public.celda_difuminada() en SQL.
export const KM_CELDA_COMPARTIDA = 5;
export function celdaDifuminada(lat, lon, km = KM_CELDA_COMPARTIDA) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const pasoLat = km / 111.32;
  const filaLat = Math.floor(lat / pasoLat);
  const latCentro = (filaLat + 0.5) * pasoLat;
  // El paso en longitud se calcula con la latitud de la FILA (no la del
  // punto), para que todos los puntos de una misma celda den la misma celda.
  const pasoLon = km / (111.32 * Math.cos(latCentro * Math.PI / 180));
  const colLon = Math.floor(lon / pasoLon);
  return {
    lat: Math.round(latCentro * 1e4) / 1e4,
    lon: Math.round((colLon + 0.5) * pasoLon * 1e4) / 1e4,
    celda: `${filaLat}_${colLon}`,
  };
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Spot del catálogo más cercano. Solo se aceptan observaciones a <= maxKm de
// un spot: así se quedan fuera las de interior, las de alta mar (campañas de
// arrastre) y se pueden cruzar con las condiciones de ese spot.
export const MAX_KM_SPOT = 25;
export function spotCercano(lat, lon, spots, maxKm = MAX_KM_SPOT) {
  let mejor = null;
  for (const s of spots) {
    const d = distanciaKm(lat, lon, s.lat, s.lon);
    if (d <= maxKm && (!mejor || d < mejor.km)) mejor = { slug: s.slug, km: Math.round(d * 10) / 10 };
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Registro de GBIF -> fila compacta
// ---------------------------------------------------------------------------

export const DATASET_INATURALIST = "50c9509d-22c7-4a22-a47d-8c48425ef4a7";
export const BASES_ACEPTADAS = new Set(["HUMAN_OBSERVATION", "OCCURRENCE", "MACHINE_OBSERVATION"]);

// Fecha y hora UTC de una observación de GBIF. Casos reales:
//   iNaturalist: eventDate "2026-01-18T10:17" (hora LOCAL, sin zona) y
//                eventTime "10:17:00+01:00" (con desfase) -> 09 UTC.
//   otros:       eventDate "2026-03-04T16:00Z" -> 16 UTC.
//                eventDate "2019-06-02" o un rango "2019-06-02/2019-06-05"
//                -> solo el día (hora null: se cruza con la media del día,
//                nunca con una hora inventada).
// Una hora sin zona horaria conocida tampoco se usa (no sabemos si es local).
export function fechaHora(eventDate, eventTime = null) {
  if (!eventDate) return null;
  const s = String(eventDate);
  if (s.includes("/")) {
    const [ini, fin] = s.split("/");
    if (fin && fin.slice(0, 10) !== ini.slice(0, 10)) return null; // rango de varios días: no se sabe el día
  }
  const p = s.split("/")[0];
  const dia = p.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dia) return null;
  const hm = p.match(/T(\d{2}):(\d{2})/);
  if (!hm) return { fecha: dia[1], hora: null };
  let zona = (p.match(/(Z|[+-]\d{2}:?\d{2})$/) || [])[1] || null;
  if (!zona && eventTime) zona = (String(eventTime).match(/(Z|[+-]\d{2}:?\d{2})$/) || [])[1] || null;
  if (!zona) return { fecha: dia[1], hora: null };
  const z = zona === "Z" ? "Z" : zona.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(`${dia[1]}T${hm[1]}:${hm[2]}:00${z}`);
  if (!Number.isFinite(ms)) return { fecha: dia[1], hora: null };
  const d = new Date(ms);
  return { fecha: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}

// Devuelve { uso, fila } o null si no se guarda. `uso`: "comercial" |
// "no_comercial". Nunca guarda el nombre del observador salvo cuando la
// licencia exige atribución (BY*): entonces `autor` es el titular de
// derechos tal como lo publica GBIF (rightsHolder, o recordedBy).
export function filaDesdeGbif(r, { mapa, spots, regionDe = null }) {
  if (!r || r.occurrenceStatus === "ABSENT") return null;
  if (r.basisOfRecord && !BASES_ACEPTADAS.has(r.basisOfRecord)) return null;
  const uso = clasificarLicencia(r.license);
  if (uso === "descartar") return null;
  const lat = Number(r.decimalLatitude);
  const lon = Number(r.decimalLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const oculta = coordenadaOculta(r);
  const coords = coordenadasGuardables(lat, lon, oculta);
  const spot = spotCercano(lat, lon, spots);
  if (!spot) return null;
  const region = regionDe ? regionDe(lat, lon) : null;
  const especie = especieDeNombre(mapa, r.species || r.acceptedScientificName || r.scientificName, {
    familiaObs: r.family || null, region,
  });
  if (!especie) return null;
  const fh = fechaHora(r.eventDate, r.eventTime);
  if (!fh) return null;
  const licencia = normalizarLicencia(r.license);
  const fila = {
    id: `gbif:${r.key ?? r.gbifID}`,
    src: r.datasetKey === DATASET_INATURALIST ? "inat" : "gbif",
    ds: r.datasetKey || null,
    e: especie,
    sci: r.species || null,
    f: fh.fecha,
    h: fh.hora,
    lat: coords.lat,
    lon: coords.lon,
    oc: coords.oculta,
    inc_km: Number.isFinite(Number(r.coordinateUncertaintyInMeters))
      ? Math.round(Number(r.coordinateUncertaintyInMeters) / 100) / 10 : null,
    spot: spot.slug,
    km: spot.km,
    reg: region,
    base: r.basisOfRecord || null,
    lic: licencia,
  };
  if (necesitaAtribucion(r.license)) {
    fila.autor = r.rightsHolder || r.recordedBy || null;
  }
  if (r.datasetKey === DATASET_INATURALIST && r.occurrenceID) fila.url = String(r.occurrenceID);
  return { uso, fila };
}

// ---------------------------------------------------------------------------
// Condiciones (Copernicus / Open-Meteo) -> valor a la hora de la observación
// ---------------------------------------------------------------------------

// Valor de una serie horaria con inicio ISO (formato de las instantáneas de
// Copernicus, columnas wh/sst/...). Con hora null -> media del día.
export function valorEnSerie(inicioISO, serie, fecha, hora) {
  if (!Array.isArray(serie)) return null;
  const inicio = Date.parse(inicioISO);
  const base = Date.parse(`${fecha}T00:00:00Z`);
  const idx = (ms) => Math.round((ms - inicio) / 3600000);
  if (hora != null) {
    const v = serie[idx(base + hora * 3600000)];
    return v == null ? null : v;
  }
  const vals = [];
  for (let h = 0; h < 24; h++) {
    const v = serie[idx(base + h * 3600000)];
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length < 18) return null; // día a medias: no se promedia (ROBOT_REGLAS, 2026-09-13)
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// Respuesta horaria de Open-Meteo (timezone=GMT) -> valor a la hora/día.
export function valorOpenMeteo(hourly, variable, fecha, hora) {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly[variable])) return null;
  if (hora != null) {
    const etiqueta = `${fecha}T${String(hora).padStart(2, "0")}:00`;
    const i = hourly.time.indexOf(etiqueta);
    const v = i >= 0 ? hourly[variable][i] : null;
    return v == null ? null : v;
  }
  const vals = [];
  hourly.time.forEach((t, i) => {
    const v = hourly[variable][i];
    if (t.startsWith(fecha) && v != null && Number.isFinite(v)) vals.push(v);
  });
  if (vals.length < 18) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

// ---------------------------------------------------------------------------
// k-anonimato (espejo del SQL de capturas compartidas)
// ---------------------------------------------------------------------------

export const K_ANONIMATO = 5;

// filas: [{ usuario, ...claves }]. Agrupa por `claves` y devuelve solo los
// grupos con al menos k USUARIOS DISTINTOS (no k capturas: 5 capturas de la
// misma persona siguen siendo una persona). Nunca devuelve el usuario.
export function agregarK(filas, claves, k = K_ANONIMATO) {
  const grupos = new Map();
  for (const f of filas) {
    const clave = JSON.stringify(claves.map((c) => f[c] ?? null));
    const g = grupos.get(clave) || { valores: claves.map((c) => f[c] ?? null), usuarios: new Set(), total: 0 };
    g.usuarios.add(f.usuario);
    g.total++;
    grupos.set(clave, g);
  }
  const salida = [];
  for (const g of grupos.values()) {
    if (g.usuarios.size < k) continue;
    const o = {};
    claves.forEach((c, i) => { o[c] = g.valores[i]; });
    o.capturas = g.total;
    salida.push(o);
  }
  return salida;
}

// Franja horaria que se expone en los agregados (nunca la hora exacta).
export function franjaHoraria(hora) {
  if (hora == null || !Number.isFinite(hora)) return null;
  if (hora < 6) return "madrugada";
  if (hora < 12) return "manana";
  if (hora < 18) return "tarde";
  return "noche";
}
