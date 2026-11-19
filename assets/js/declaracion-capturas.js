// assets/js/declaracion-capturas.js — ¿hay que declarar esta captura? (2026-11-19)
//
// Costaviva NO declara por el pescador: la declaración legal solo se hace en
// la app oficial de cada país. Aquí solo se avisa, con la norma de la que
// sale, y se enlaza a la app oficial. Nada de "probables": cada especie está
// copiada del texto oficial y la tabla lleva su fuente y fecha.
//
// España: RD 347/2011, art. 3 bis (añadido por el RD 214/2026, BOE-A-2026-6401,
//   en vigor desde el 20-03-2026). Especies del anexo II (protección
//   diferenciada) en cualquier agua, a declarar en PescaREC en las 24 horas
//   siguientes al final de la actividad, retenidas y sueltas. Anexo II
//   consolidado (BOE-A-2011-6099, consultado 2026-11-19): atún rojo, atún
//   blanco, patudo, pez espada, marlines (Makaira), agujas (Tetrapturus),
//   pez vela, merluza, besugo (Orden APA/315/2020) y, desde el RD 214/2026,
//   lubina, bacalao, abadejo, lenguado y lampuga.
//   El resto de especies con medidas de la UE solo en aguas exteriores: no se
//   avisa de ellas (no hay lista cerrada que podamos citar).
// Portugal: RecFishing (app europea), desde el 10-01-2026, según las
//   preguntas frecuentes de la DGRM: robalo (lubina), atún rojo, aguja azul,
//   aguja blanca y marlín peto.
// Nueva Zelanda: no hay obligación general de declarar (MPI): nada.

export const FUENTES = {
  es: { app: "PescaREC", norma: "RD 347/2011, art. 3 bis y anexo II (RD 214/2026)", consultado: "2026-11-19",
        enlaces: { ios: "https://apps.apple.com/es/app/pescarec/id6752486687", android: "https://play.google.com/store/search?q=PescaREC&c=apps" } },
  pt: { app: "RecFishing", norma: "Reg. (CE) 1224/2009, art. 55 (Reg. 2023/2842); DGRM", consultado: "2026-11-19",
        enlaces: { info: "https://dgrm.pt/en/electronic-catch-recording-system" } },
};

// Nombre científico (especie exacta) o género con "spp." (todo el género).
export const ESPECIES = {
  es: [
    "Thunnus thynnus", "Thunnus alalunga", "Thunnus obesus", "Xiphias gladius",
    "Makaira spp.", "Tetrapturus spp.", "Istiophorus albicans", "Merluccius merluccius",
    "Pagellus bogaraveo", "Dicentrarchus labrax", "Gadus morhua", "Pollachius pollachius",
    "Solea solea", "Coryphaena hippurus",
  ],
  pt: ["Dicentrarchus labrax", "Thunnus thynnus", "Makaira nigricans", "Kajikia albida", "Tetrapturus albidus", "Tetrapturus pfluegeri"],
};

const PLAZO_HORAS = { es: 24, pt: 24 };

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function casa(cientifico, patron) {
  const c = norm(cientifico), p = norm(patron);
  if (p.endsWith(" spp.")) return c.split(" ")[0] === p.split(" ")[0];
  return c === p;
}

// "es" | "pt" | null a partir de la región de assets/js/regiones.js.
export function paisDeclaracion(region) {
  const r = String(region || "");
  if (!r) return null;
  if (r === "nueva_zelanda" || r.startsWith("nz")) return null;
  if (r === "portugal" || r === "azores" || r === "madeira") return "pt";
  return "es";
}

// regionPorCoordenadas devuelve una región española para cualquier punto que
// no case con otra (por defecto "cantabrico"). Para no mandar a PescaREC una
// captura hecha en Francia o fuera de la Península e islas, se exige que el
// punto esté en una caja amplia de España y Portugal, sin la costa francesa
// (al este de Hendaya en el Cantábrico, al norte de Portbou en el
// Mediterráneo).
export function puntoEnEspanaOPortugal(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < 27 || lat > 44.5 || lon < -31.5 || lon > 4.6) return false;
  if (lat >= 43.35 && lon > -1.79) return false;
  if (lat >= 42.44 && lon > 2.0) return false;
  return true;
}

// Devuelve { pais, app, plazo_horas, norma, enlaces } o null.
// Un nombre científico con varias especies ("A / B") no se avisa: no
// sabemos cuál fue.
export function declaracionNecesaria(cientifico, region) {
  const pais = paisDeclaracion(region);
  if (!pais || !cientifico || String(cientifico).includes("/")) return null;
  if (!ESPECIES[pais].some((p) => casa(cientifico, p))) return null;
  const f = FUENTES[pais];
  return { pais, app: f.app, plazo_horas: PLAZO_HORAS[pais], norma: f.norma, enlaces: f.enlaces };
}

// Texto para copiar y pegar en la app oficial. `campos` son pares
// [etiqueta, valor] ya traducidos; se omiten los vacíos.
export function textoParaDeclarar(campos) {
  return campos.filter(([, v]) => v != null && v !== "").map(([e, v]) => `${e}: ${v}`).join("\n");
}
