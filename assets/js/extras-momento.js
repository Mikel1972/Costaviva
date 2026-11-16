// assets/js/extras-momento.js
// Más datos de un momento de pesca (picada o captura) para buscar patrones
// (2026-11-16, Mikel: "y todos aquellos datos que creas que puedan afectar,
// y a las especies pescadas"). Además de lo que ya guarda la salida
// (marea, presión, viento, ola, agua, nubes, lluvia, luna), aquí:
//  - cambio de presión en 3 h y en 24 h (no solo "sube/baja");
//  - lluvia de las 24 h y 72 h anteriores (agua turbia, arrastres de río);
//  - temperatura del aire y rachas de viento, dirección del viento en grados;
//  - periodo y dirección de la ola, y el mar de fondo (altura y periodo);
//  - cambio de la temperatura del agua en 3 días;
//  - punto del ciclo de marea: última pleamar/bajamar, minutos desde ella y
//    hasta la siguiente, y el rango de esa marea (cuánta agua se mueve).
// Puro: entra lo que devuelve Open-Meteo (series horarias en hora local) y
// la etiqueta local "AAAA-MM-DDTHH:MM" del momento. Test en
// test/extras-momento.test.js.

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

function indiceHora(horas, etiqueta) {
  const clave = `${String(etiqueta).slice(0, 13)}:00`;
  return (horas || []).indexOf(clave);
}
function suma(serie, desde, hasta) {
  let s = 0, n = 0;
  for (let i = Math.max(0, desde); i <= hasta && i < (serie?.length || 0); i++) {
    if (Number.isFinite(serie[i])) { s += serie[i]; n++; }
  }
  return n ? s : null;
}
const valor = (serie, i) => (i >= 0 && Number.isFinite(serie?.[i]) ? serie[i] : null);
const cambio = (serie, i, h) => {
  const a = valor(serie, i), b = valor(serie, i - h);
  return a !== null && b !== null ? a - b : null;
};

// Extremos de marea (máximos y mínimos locales de la serie horaria).
export function extremosMarea(serie) {
  const out = [];
  for (let i = 1; i < (serie?.length || 0) - 1; i++) {
    const a = serie[i - 1], b = serie[i], c = serie[i + 1];
    if (![a, b, c].every(Number.isFinite)) continue;
    if (b >= a && b > c) out.push({ i, tipo: "pleamar", altura: b });
    else if (b <= a && b < c) out.push({ i, tipo: "bajamar", altura: b });
  }
  return out;
}

export function extrasMomento({ etiqueta, marino = null, tiempo = null }) {
  const out = {};
  const minutos = Number(String(etiqueta).slice(14, 16)) || 0;
  const im = indiceHora(marino?.hourly?.time, etiqueta);
  const it = indiceHora(tiempo?.hourly?.time, etiqueta);
  if (it >= 0) {
    const h = tiempo.hourly;
    out.presion_cambio_3h = r1(cambio(h.pressure_msl, it, 3));
    out.presion_cambio_24h = r1(cambio(h.pressure_msl, it, 24));
    out.lluvia_24h = r1(suma(h.precipitation, it - 23, it));
    out.lluvia_72h = r1(suma(h.precipitation, it - 71, it));
    out.temp_aire = r1(valor(h.temperature_2m, it));
    out.viento_racha_kmh = r1(valor(h.wind_gusts_10m, it));
    out.viento_dir_grados = valor(h.winddirection_10m, it);
  }
  if (im >= 0) {
    const h = marino.hourly;
    out.ola_periodo = r1(valor(h.wave_period, im));
    out.ola_direccion = valor(h.wave_direction, im);
    out.mar_fondo_altura = r2(valor(h.swell_wave_height, im));
    out.mar_fondo_periodo = r1(valor(h.swell_wave_period, im));
    out.temp_agua_cambio_72h = r1(cambio(h.sea_surface_temperature, im, 72));
    const ext = extremosMarea(h.sea_level_height_msl);
    const antes = ext.filter((e) => e.i <= im).pop();
    const despues = ext.find((e) => e.i > im);
    if (antes) {
      out.marea_ultimo_extremo = antes.tipo;
      out.marea_min_desde_extremo = (im - antes.i) * 60 + minutos;
    }
    if (despues) out.marea_min_a_siguiente = (despues.i - im) * 60 - minutos;
    if (antes && despues) out.marea_rango = r2(Math.abs(despues.altura - antes.altura));
  }
  for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined) delete out[k];
  return out;
}

// Parámetros de Open-Meteo que necesita extrasMomento (3 días antes para
// lluvia y cambios, 1 después para la siguiente pleamar/bajamar).
export const HOURLY_MARINO_EXTRAS = "sea_level_height_msl,wave_period,wave_direction,swell_wave_height,swell_wave_period,sea_surface_temperature";
export const HOURLY_TIEMPO_EXTRAS = "pressure_msl,precipitation,temperature_2m,wind_gusts_10m,winddirection_10m";
