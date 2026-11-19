// functions/_lib/coherencia-vecinos.js — regla de vecinos para la ola en la
// orilla (2026-11-19).
//
// Mikel: "si Sopela tiene 1,9 y Lekeitio 1,7, Bakio no puede tener 2,8";
// "debemos, en todas las cámaras, crear una especie de regla que, con un
// margen, nos salte la alarma de que algún dato puede estar mal y, por lo
// tanto, automáticamente, revisarlo".
//
// Dos reglas, por franja horaria (detalle en revisarVecinos):
//   - CON HISTORIA (lo principal): la relación aprendida entre cámaras
//     cercanas por tamaño de mar (aprenderRelaciones, abajo). Avisa hacia
//     arriba y hacia abajo; recorta solo hacia arriba.
//   - SIN HISTORIA (de reserva): un spot por encima de TODOS sus vecinos y de
//     MARGEN × su mediana se recorta (MARGEN 1,3: con Sopelana a 1,9 y
//     Lekeitio a 1,7, Bakio no pasa de ~2,3). Hacia abajo nada: una bahía da
//     legítimamente menos.
// Los recortes dejan `revisadoVecinos` en el bloque y todo sale en avisos,
// que apunta el robot de las cámaras (avisos-vecinos.mjs) y que hace subir
// esas cámaras en la lista de fotos a etiquetar.
export const RADIO_KM = 40, MARGEN = 1.3, MIN_VECINOS = 2, N_VECINOS = 4;

// --- Relación HISTÓRICA entre cámaras cercanas (Mikel, 2026-11-19: "muy
// por debajo puede ser si la cámara está en una bahía. Lo que tienes que
// hacer es tener un histórico de la relación entre puntos cercanos (con
// temporal, sin temporal...) y, sobre eso, meter esas casuísticas").
//
// De las etiquetas hechas a la vez (±TOLERANCIA_PAR_MIN) en dos cámaras a
// RADIO_KM o menos: el cociente orilla A / orilla B, en logaritmos, por
// tamaño del mar (pequeño, medio, grande = sin temporal … temporal). Se
// guarda la mediana y la dispersión (MAD). La regla compara la previsión
// con eso: si A/B se sale de mediana ± max(K_MAD × MAD, BANDA_MIN), no
// cuadra. Así una bahía que siempre da la mitad que la playa de al lado no
// avisa, y una playa que hoy da el doble de lo de siempre, sí.
// BANDA_MIN 1,5: las etiquetas van por tramos de altura (el cociente sale a
// saltos), así que la relación aprendida es gruesa.
export const TOLERANCIA_PAR_MIN = 45, N_MIN_PAR = 8, K_MAD = 2.5, BANDA_MIN = Math.log(1.5);
const tamanoMar = (hs) => (!Number.isFinite(hs) ? null : hs < 1.5 ? "pequeno" : hs < 3 ? "medio" : "grande");

// verdades: [{ camara, fecha (ISO), altura (m, orilla), hs (mar abierto) }]
// camaras: { id: { lat, lon } }. Devuelve { generado, pares: { "a|b": {
// pequeno: { log, mad, n }, ... } } } con a < b (orden alfabético).
export function aprenderRelaciones(verdades, camaras, { radioKm = RADIO_KM, ahora = new Date() } = {}) {
  const porCam = {};
  for (const v of verdades || []) {
    const t = Date.parse(v?.fecha);
    if (!camaras?.[v?.camara] || !(v.altura > 0) || !Number.isFinite(t)) continue;
    (porCam[v.camara] ||= []).push({ t, altura: v.altura, hs: v.hs });
  }
  const ids = Object.keys(porCam).sort();
  const pares = {};
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const ca = camaras[a], cb = camaras[b];
      if (distanciaKm(ca.lat, ca.lon, cb.lat, cb.lon) > radioKm) continue;
      const grupos = {};
      for (const x of porCam[a]) {
        let mejor = null;
        for (const y of porCam[b]) {
          const d = Math.abs(y.t - x.t);
          if (d <= TOLERANCIA_PAR_MIN * 60e3 && (!mejor || d < mejor.d)) mejor = { y, d };
        }
        if (!mejor) continue;
        const hs = [x.hs, mejor.y.hs].filter(Number.isFinite);
        const tam = tamanoMar(hs.length ? hs.reduce((p, q) => p + q, 0) / hs.length : NaN);
        if (!tam) continue;
        (grupos[tam] ||= []).push(Math.log(x.altura / mejor.y.altura));
      }
      const rel = {};
      for (const [tam, logs] of Object.entries(grupos)) {
        if (logs.length < N_MIN_PAR) continue;
        const m = mediana(logs);
        rel[tam] = { log: +m.toFixed(3), mad: +mediana(logs.map((l) => Math.abs(l - m))).toFixed(3), n: logs.length };
      }
      if (Object.keys(rel).length) pares[`${a}|${b}`] = rel;
    }
  }
  return { generado: ahora.toISOString(), radioKm, nMin: N_MIN_PAR, pares };
}

// Relación esperada log(orilla A / orilla B) para un tamaño, o null.
export function relacionEsperada(relaciones, a, b, tam) {
  if (!relaciones?.pares || !a || !b || a === b || !tam) return null;
  const [x, y] = a < b ? [a, b] : [b, a];
  const r = relaciones.pares[`${x}|${y}`]?.[tam];
  if (!r || !(r.n >= (relaciones.nMin ?? N_MIN_PAR))) return null;
  const banda = Math.max(K_MAD * r.mad, BANDA_MIN);
  const log = a < b ? r.log : -r.log;
  return { log, min: log - banda, max: log + banda, n: r.n };
}

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, R = 6371;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function mediana(xs) {
  const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// ¿La altura del spot es de la orilla (cámara, cámara vecina o abrigo) y no
// el mar abierto del modelo?
export function daOrilla(spot) {
  const z = spot?.zonaOleaje;
  return Boolean(z?.orilla || z?.tipo === "abrigada" || spot?.bloques?.some((b) => b?.fuenteAltura === "camara"));
}

// spots: los de /prevision ({ slug, lat, lon, zonaOleaje, bloques: [{ horaISO,
// altura: [min, max], alturaMarAbierto }] }). camaraDe(slug): la cámara
// PROPIA del spot (o null). relaciones: aprenderRelaciones().
// Devuelve { spots (copias, recortados), avisos }.
//
// Con historia (pares de cámaras propias con relación aprendida para el
// tamaño de mar de esa franja): cada par vota "alto", "bajo" o "normal". Si
// la mayoría de los pares con historia dice "alto", se recorta a la mediana
// de lo máximo que permite cada par; "bajo" solo avisa.
// Sin historia: regla general, solo hacia arriba (por encima de TODOS sus
// vecinos y de MARGEN × su mediana; tope = el mayor de MARGEN × mediana y el
// vecino más alto). Hacia abajo, sin historia, nada: una bahía puede dar
// mucho menos que la playa de al lado.
export function revisarVecinos(spots, { radioKm = RADIO_KM, margen = MARGEN, minVecinos = MIN_VECINOS, nVecinos = N_VECINOS, relaciones = null, camaraDe = () => null } = {}) {
  const lista = spots || [];
  const conOrilla = lista.filter((s) => daOrilla(s) && Number.isFinite(s.lat) && Number.isFinite(s.lon) && s.bloques?.length);
  // Alturas ORIGINALES (antes de recortar nada): los recortes no se encadenan.
  const maxPorHora = new Map(conOrilla.map((s) => [s.slug, new Map(s.bloques.map((b) => [b.horaISO, Array.isArray(b.altura) ? Number(b.altura[1]) : NaN]))]));
  const avisos = [];
  const resultado = lista.map((s) => {
    if (!maxPorHora.has(s.slug)) return s;
    const cercanos = conOrilla
      .filter((o) => o.slug !== s.slug)
      .map((o) => ({ o, km: distanciaKm(s.lat, s.lon, o.lat, o.lon) }))
      .filter((v) => v.km <= radioKm)
      .sort((a, b) => a.km - b.km);
    const generales = cercanos.filter((v) => v.o.zonaOleaje?.tipo !== "abrigada").slice(0, nVecinos).map((v) => v.o);
    const miCam = camaraDe(s.slug);
    let tocado = false;
    const bloques = s.bloques.map((b) => {
      const mio = Array.isArray(b.altura) ? Number(b.altura[1]) : NaN;
      if (!Number.isFinite(mio) || mio <= 0) return b;
      const hsAbierto = Array.isArray(b.alturaMarAbierto) ? (Number(b.alturaMarAbierto[0]) + Number(b.alturaMarAbierto[1])) / 2 : NaN;
      const tam = tamanoMar(hsAbierto);
      // 1. Con historia.
      const votos = [];
      if (miCam && relaciones) {
        for (const { o } of cercanos) {
          const suCam = camaraDe(o.slug);
          const rel = relacionEsperada(relaciones, miCam, suCam, tam);
          const suyo = maxPorHora.get(o.slug).get(b.horaISO);
          if (!rel || !(suyo > 0)) continue;
          const l = Math.log(mio / suyo);
          votos.push({ slug: o.slug, voto: l > rel.max ? "alto" : l < rel.min ? "bajo" : "normal", topeMax: suyo * Math.exp(rel.max), esperado: +(suyo * Math.exp(rel.log)).toFixed(1), n: rel.n });
        }
      }
      if (votos.length) {
        const altos = votos.filter((v) => v.voto === "alto"), bajos = votos.filter((v) => v.voto === "bajo");
        const vec = votos.map((v) => ({ slug: v.slug, voto: v.voto, esperado: v.esperado, n: v.n }));
        if (bajos.length > votos.length / 2) {
          avisos.push({ slug: s.slug, horaISO: b.horaISO, tipo: "bajo", base: "historico", tamano: tam, antes: b.altura, vecinos: vec });
          return b;
        }
        if (altos.length > votos.length / 2) {
          const tope = +mediana(altos.map((v) => v.topeMax)).toFixed(1);
          if (tope < mio) {
            tocado = true;
            avisos.push({ slug: s.slug, horaISO: b.horaISO, tipo: "alto", base: "historico", tamano: tam, antes: b.altura, tope, vecinos: vec });
            const f = tope / mio;
            return { ...b, altura: b.altura.map((x) => +(x * f).toFixed(1)), revisadoVecinos: { antes: b.altura, tope, base: "historico", vecinos: vec.map((v) => v.slug) } };
          }
        }
        return b;
      }
      // 2. Sin historia: regla general, solo hacia arriba.
      if (generales.length < minVecinos) return b;
      const suyos = generales.map((o) => maxPorHora.get(o.slug).get(b.horaISO)).filter((x) => Number.isFinite(x) && x > 0);
      if (suyos.length < minVecinos) return b;
      const tope = +Math.max(margen * mediana(suyos), Math.max(...suyos)).toFixed(1);
      if (mio <= tope) return b;
      tocado = true;
      const vec = generales.map((o) => ({ slug: o.slug, max: maxPorHora.get(o.slug).get(b.horaISO) })).filter((v) => Number.isFinite(v.max));
      avisos.push({ slug: s.slug, horaISO: b.horaISO, tipo: "alto", base: "general", tamano: tam, antes: b.altura, tope, vecinos: vec });
      const f = tope / mio;
      return { ...b, altura: b.altura.map((x) => +(x * f).toFixed(1)), revisadoVecinos: { antes: b.altura, tope, base: "general", vecinos: vec.map((v) => v.slug) } };
    });
    return tocado ? { ...s, bloques } : s;
  });
  return { spots: resultado, avisos };
}
