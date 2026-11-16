// assets/js/sol-luna.js
// Posición del Sol y de la Luna en un instante y lugar (2026-11-16, Mikel:
// "debiéramos meter como variable la posición de los planetas / sol que
// afectan a la tierra"). Sol y Luna sí; los planetas no: su fuerza de marea
// es unas diez mil veces menor que la de la Luna y no hay estudios que los
// relacionen con la pesca (meterlos solo daría patrones de casualidad).
// Fórmulas compactas estándar (precisión de ~1°, de sobra para minutos al
// amanecer o al tránsito de la luna), sin red. Puro: test en
// test/sol-luna.test.js.
//
// Periodos "solunares": mayor = ±1 h del paso de la luna por lo más alto o
// lo más bajo (tránsito superior / inferior); menor = ±30 min de su salida o
// puesta. No se dan por buenos: el aprendizaje comprobará si de verdad
// influyen con las picadas y capturas apuntadas.

const RAD = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;
const jdDe = (ms) => ms / 86400000 + 2440587.5;

function sol(jd) {
  const d = jd - 2451545.0;
  const g = norm360(357.529 + 0.98560028 * d) * RAD;
  const q = norm360(280.459 + 0.98564736 * d);
  return { lon: norm360(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)), lat: 0 };
}
function luna(jd) {
  const d = jd - 2451545.0;
  const L = norm360(218.316 + 13.176396 * d);
  const M = norm360(134.963 + 13.064993 * d) * RAD;
  const F = norm360(93.272 + 13.22935 * d) * RAD;
  return { lon: norm360(L + 6.289 * Math.sin(M)), lat: 5.128 * Math.sin(F) };
}
function ecuatorial({ lon, lat }) {
  const eps = 23.4397 * RAD, l = lon * RAD, b = lat * RAD;
  const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l));
  const ra = norm360(Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) / RAD);
  return { ra, dec: dec / RAD };
}
// Altura (°) y ángulo horario (°, 0 = tránsito superior, 180 = inferior).
function posicion(cuerpo, ms, lat, lon) {
  const jd = jdDe(ms);
  const { ra, dec } = ecuatorial(cuerpo(jd));
  const lst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + lon);
  const H = norm360(lst - ra);
  const alt = Math.asin(Math.sin(dec * RAD) * Math.sin(lat * RAD) + Math.cos(dec * RAD) * Math.cos(lat * RAD) * Math.cos(H * RAD)) / RAD;
  return { alt, H };
}

// Minutos (con signo: + falta, − ya pasó) al cruce más cercano de la altura
// `umbral` en sentido `sube` (true = salida, false = puesta), en ±14 h.
function minutosACruce(cuerpo, ms, lat, lon, umbral, sube) {
  const paso = 10 * 60000, max = 14 * 60;
  const cruza = (t0, t1) => {
    const a0 = posicion(cuerpo, t0, lat, lon).alt - umbral, a1 = posicion(cuerpo, t1, lat, lon).alt - umbral;
    if (sube ? !(a0 < 0 && a1 >= 0) : !(a0 >= 0 && a1 < 0)) return null;
    return t0 + (t1 - t0) * (a0 / (a0 - a1));
  };
  for (let m = 0; m <= max; m += 10) {
    const adelante = cruza(ms + m * 60000, ms + m * 60000 + paso);
    const atras = cruza(ms - m * 60000 - paso, ms - m * 60000);
    const cands = [adelante, atras].filter((x) => x !== null);
    if (cands.length) {
      const t = cands.sort((a, b) => Math.abs(a - ms) - Math.abs(b - ms))[0];
      return Math.round((t - ms) / 60000);
    }
  }
  return null;
}

// Todo lo de un instante (ms UTC) en un punto, con nombres planos para
// guardar en picadas_pesca.condiciones y contar en el aprendizaje.
export function solLuna(ms, lat, lon) {
  if (!Number.isFinite(ms) || !Number.isFinite(lat) || !Number.isFinite(lon)) return {};
  const s = posicion(sol, ms, lat, lon);
  const l = posicion(luna, ms, lat, lon);
  // Tránsito más cercano: superior (H = 0) o inferior (H = 180). La luna
  // avanza ~14,49° de ángulo horario por hora.
  const aSup = ((360 - l.H) % 360), desdeSup = l.H; // grados hasta / desde el superior
  const aInf = norm360(180 - l.H), desdeInf = norm360(l.H - 180);
  const opciones = [
    { tipo: "superior", min: aSup / 14.49 * 60 }, { tipo: "superior", min: -desdeSup / 14.49 * 60 },
    { tipo: "inferior", min: aInf / 14.49 * 60 }, { tipo: "inferior", min: -desdeInf / 14.49 * 60 },
  ].sort((a, b) => Math.abs(a.min) - Math.abs(b.min));
  const transito = opciones[0];
  const lunaSale = minutosACruce(luna, ms, lat, lon, 0.125, true);
  const lunaSePone = minutosACruce(luna, ms, lat, lon, 0.125, false);
  const solSale = minutosACruce(sol, ms, lat, lon, -0.833, true);
  const solSePone = minutosACruce(sol, ms, lat, lon, -0.833, false);
  const cerca = (m, lim) => m !== null && Math.abs(m) <= lim;
  const solunar = Math.abs(transito.min) <= 60 ? "mayor" : (cerca(lunaSale, 30) || cerca(lunaSePone, 30)) ? "menor" : "ninguno";
  return {
    sol_altura: +s.alt.toFixed(1),
    sol_momento: s.alt > 0 ? "dia" : s.alt > -12 ? "crepusculo" : "noche",
    sol_min_amanecer: solSale,
    sol_min_anochecer: solSePone,
    luna_altura: +l.alt.toFixed(1),
    luna_visible: l.alt > 0,
    luna_transito: transito.tipo,
    luna_min_transito: Math.round(transito.min),
    luna_min_salida: lunaSale,
    luna_min_puesta: lunaSePone,
    solunar,
  };
}
