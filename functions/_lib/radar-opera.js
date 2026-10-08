// functions/_lib/radar-opera.js
//
// Radar de lluvia casi en tiempo real: composición europea EUMETNET OPERA
// (reflectividad DBZH, una toma cada 5 min, publicada ~4-5 min después de su
// hora). Pedido de Mikel 2026-10-08: "para la lluvia es imprescindible que
// sea lo más cercano en tiempo".
//
// - Licencia: "The property rights of OPERA composite products are held by
//   EUMETNET, which has decided to distribute these products under the CC BY
//   4.0 license" (github.com/EUMETNET/openradardata-documentation,
//   docs/1-ORD-API-overview.md). Uso comercial permitido con atribución.
//   Incluye los radares de AEMET (España), IPMA (Portugal) y Météo-France.
// - Acceso: bucket S3 público de 24 h (s3.waw3-1.cloudferro.com/openradar-24h),
//   sin clave y sin coste. NO manda cabeceras CORS, por eso pasa por aquí.
// - Formato: GeoTIFF "cloud optimized", 3800x4400 px de 1 km en Lambert
//   azimutal equivalente (lat0 55, lon0 10, x0 1 950 000, y0 -2 100 000),
//   float32, 2 bandas (dBZ y calidad), deflate, teselas de 512 px y vistas
//   reducidas a 2, 4, 8 y 16 km. Sin dato = -9 999 000; sin eco = NaN.
//
// Este módulo es lógica pura (sin red): leer el listado del bucket, elegir
// las tomas de la ventana, leer la cabecera TIFF y decidir qué bytes hay que
// pedir. El servidor NO descomprime nada (el límite de CPU de las Functions
// no lo permite): reenvía las teselas comprimidas que cubren España y
// Portugal, y el navegador las descomprime y pinta (assets/js/lluvia-animada.js).

export const S3_BASE = "https://s3.waw3-1.cloudferro.com/openradar-24h/";
export const HORAS_VENTANA = 3;
// Ventana de la vista de 4 km (nivel con 950 px de ancho) que cubre lat
// 34,5-45,5 y lon -11 a 5 (Península, Baleares, golfo de Bizkaia). Calculada
// con la proyección de assets/js/lluvia-animada.js; test/lluvia-animada.test.js
// comprueba que la región del mapa cabe dentro.
export const VENTANA = { factor: 4, x0: 0, y0: 724, x1: 396, y1: 1092 };
export const CABECERA_BYTES = 16384;
export const MAX_BYTES_TESELAS = 1024 * 1024;

const RE_CLAVE = /(\d{4})\/(\d{2})\/(\d{2})\/OPERA\/COMP\/OPERA@(\d{8})T(\d{4})@0@DBZH\.tiff/;

// "YYYYMMDDHHMM" <-> ms UTC.
export function sello(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}
export function desdeSello(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(s || ""));
  if (!m) return NaN;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Solo tomas de 5 en 5 minutos y fechas reales (Date.UTC normaliza 31/02).
  if (sello(ms) !== m[0] || +m[5] % 5 !== 0) return NaN;
  return ms;
}

export function claveToma(ms) {
  const s = sello(ms);
  return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}/OPERA/COMP/OPERA@${s.slice(0, 8)}T${s.slice(8)}@0@DBZH.tiff`;
}

// Prefijos de día (UTC) que hay que listar para cubrir [ahora - horas, ahora].
export function prefijosDia(ahoraMs, horas = HORAS_VENTANA) {
  const out = [];
  for (const t of [ahoraMs - (horas + 1) * 3600000, ahoraMs]) {
    const s = sello(t);
    const p = `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}/OPERA/COMP/`;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

// Horas (ms) de las tomas DBZH .tiff de un ListObjectsV2 de S3.
export function parsearListado(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<Key>([^<]+)<\/Key>/g)) {
    const k = RE_CLAVE.exec(m[1]);
    if (!k || `${k[1]}${k[2]}${k[3]}` !== k[4]) continue;
    const ms = desdeSello(k[4] + k[5]);
    if (Number.isFinite(ms)) out.push(ms);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// Tomas de las últimas `horas` horas que acaban en la más reciente publicada.
export function tomasVentana(horasMs, horas = HORAS_VENTANA) {
  if (!horasMs.length) return [];
  const ultima = horasMs[horasMs.length - 1];
  return horasMs.filter((t) => t >= ultima - horas * 3600000);
}

// --- TIFF -------------------------------------------------------------------
// Lee los IFD (imagen completa y vistas reducidas) de los primeros bytes del
// fichero. Solo TIFF clásico little-endian, que es lo que publica OPERA.
export function parsearIfds(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.length < 8 || dv.getUint16(0, true) !== 0x4949 || dv.getUint16(2, true) !== 42) {
    throw new Error("no es un TIFF little-endian");
  }
  const TAM = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8, 16: 8 };
  const ifds = [];
  let off = dv.getUint32(4, true);
  while (off && ifds.length < 16) {
    if (off + 2 > u8.length) throw new Error("cabecera TIFF incompleta");
    const n = dv.getUint16(off, true);
    if (off + 2 + n * 12 + 4 > u8.length) throw new Error("cabecera TIFF incompleta");
    const tags = {};
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      const tag = dv.getUint16(e, true), tipo = dv.getUint16(e + 2, true), cnt = dv.getUint32(e + 4, true);
      const tam = (TAM[tipo] || 1) * cnt;
      const pos = tam <= 4 ? e + 8 : dv.getUint32(e + 8, true);
      if (![256, 257, 258, 259, 277, 284, 317, 322, 323, 324, 325, 339].includes(tag)) continue;
      if (pos + tam > u8.length) throw new Error("cabecera TIFF incompleta");
      const v = [];
      for (let j = 0; j < cnt; j++) {
        if (tipo === 3) v.push(dv.getUint16(pos + 2 * j, true));
        else if (tipo === 4) v.push(dv.getUint32(pos + 4 * j, true));
        else if (tipo === 16) v.push(Number(dv.getBigUint64(pos + 8 * j, true)));
        else v.push(u8[pos + j]);
      }
      tags[tag] = v;
    }
    ifds.push({
      ancho: tags[256]?.[0], alto: tags[257]?.[0],
      bits: tags[258]?.[0], compresion: tags[259]?.[0], bandas: tags[277]?.[0] || 1,
      planar: tags[284]?.[0] || 1, predictor: tags[317]?.[0] || 1, formato: tags[339]?.[0] || 1,
      tw: tags[322]?.[0], th: tags[323]?.[0], offsets: tags[324] || [], tamanos: tags[325] || [],
    });
    off = dv.getUint32(off + 2 + n * 12, true);
  }
  return ifds;
}

// Teselas del nivel `factor` que tocan la ventana, con su posición y bytes.
export function teselasVentana(ifds, ventana = VENTANA) {
  const base = ifds[0];
  if (!base) throw new Error("TIFF sin imágenes");
  const ancho = Math.ceil(base.ancho / ventana.factor);
  const ifd = ifds.find((f) => f.ancho === ancho && f.tw && f.th);
  if (!ifd) throw new Error(`sin vista reducida de ${ancho} px`);
  if (ifd.compresion !== 8 || ifd.bits !== 32 || ifd.formato !== 3 || ifd.planar !== 1 || ifd.predictor !== 1) {
    throw new Error("formato TIFF inesperado");
  }
  const nx = Math.ceil(ifd.ancho / ifd.tw);
  const teselas = [];
  for (let fila = Math.floor(ventana.y0 / ifd.th); fila * ifd.th < Math.min(ventana.y1, ifd.alto); fila++) {
    for (let col = Math.floor(ventana.x0 / ifd.tw); col * ifd.tw < Math.min(ventana.x1, ifd.ancho); col++) {
      const k = fila * nx + col;
      if (k >= ifd.offsets.length) throw new Error("tesela fuera del índice");
      teselas.push({ col, fila, off: ifd.offsets[k], len: ifd.tamanos[k] });
    }
  }
  const total = teselas.reduce((s, t) => s + t.len, 0);
  if (total > MAX_BYTES_TESELAS) throw new Error("teselas demasiado grandes");
  return { ancho: ifd.ancho, alto: ifd.alto, tw: ifd.tw, th: ifd.th, bandas: ifd.bandas, teselas };
}

// Paquete binario: [uint32 LE longitud del JSON][JSON utf-8][teselas...].
export function empaquetar(meta, trozos) {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const total = 4 + json.length + trozos.reduce((s, t) => s + t.length, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  let p = 4 + json.length;
  for (const t of trozos) { out.set(t, p); p += t.length; }
  return out;
}
