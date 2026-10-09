// functions/_lib/seo/indice-hoy.js
// "Condiciones de hoy" de la página pública de un spot: ola, viento, marea
// (de /prevision) y el índice de pesca desde costa de esta hora con sus
// motivos ▲▼. El índice es la MISMA cuenta que la ficha de la app
// (VA.indiceSpot sobre la serie horaria de /meteo, con fondo, batimetría,
// río y turbidez del spot, ver contextoIndiceSpot y datosHorariosSpot en
// index.html), sin IA. Lógica pura: la red la pone functions/spots/[slug].js.

import * as VA from "../../../assets/js/ventana-actividad.js";
import { contextoFondo } from "../../../assets/js/capa-tipo-fondo.js";
import { coeficienteDesdeParametros } from "../oleaje-costero.js";
import { factorCamara, horasEntreLocales } from "../oleaje-camaras.js";
import { factorOleaje } from "../../prevision.js";
import { RIOS_SPOT } from "./datos.js";
import { isoLocal, paramZona, zonaDeSpot } from "../../../assets/js/regiones.js";

// Consultas a /meteo/* iguales que las de la app (datosHorariosSpot).
// Zona horaria: la del spot (regiones.js), igual que en la app.
export function consultasMeteo(spot) {
  const coord = `latitude=${spot.lat}&longitude=${spot.lon}&${paramZona(zonaDeSpot(spot))}`;
  return {
    marine: `/meteo/marine?${coord}&past_days=1&forecast_days=2&hourly=wave_height,wave_direction,sea_surface_temperature,sea_level_height_msl`,
    forecast: `/meteo/forecast?${coord}&past_days=5&forecast_days=2&hourly=windspeed_10m,winddirection_10m,pressure_msl,precipitation&windspeed_unit=kmh`,
  };
}

// Serie horaria como datosHorariosSpot de index.html: factor de Gipuzkoa,
// abrigo del spot (zonaOleaje.parametros de /prevision) y corrección por
// cámara (oleajeCamara de /prevision).
export function serieHorariaSpot(spotPrev, marino, tiempo) {
  const abrigo = spotPrev?.zonaOleaje?.parametros || null;
  const cam = spotPrev?.oleajeCamara && Number.isFinite(spotPrev.oleajeCamara.cociente) ? spotPrev.oleajeCamara : null;
  const horaCam = cam ? isoLocal(Date.parse(cam.fecha), zonaDeSpot(spotPrev)) : null;
  const porHora = {};
  (tiempo?.hourly?.time || []).forEach((t, i) => {
    porHora[t] = {
      viento: tiempo.hourly.windspeed_10m?.[i] ?? null, vientoDir: tiempo.hourly.winddirection_10m?.[i] ?? null,
      presion: tiempo.hourly.pressure_msl?.[i] ?? null, lluvia: tiempo.hourly.precipitation?.[i] ?? null,
    };
  });
  const factor = factorOleaje(spotPrev.lat, spotPrev.lon);
  const mar = {};
  (marino?.hourly?.time || []).forEach((t, i) => {
    const ola = marino.hourly.wave_height?.[i];
    const coef = abrigo ? coeficienteDesdeParametros(abrigo, marino.hourly.wave_direction?.[i]) : 1;
    const fCam = cam ? factorCamara(cam.cociente, horasEntreLocales(horaCam, t), cam.peso) : 1;
    mar[t] = {
      nivelMar: marino.hourly.sea_level_height_msl?.[i] ?? null,
      ola: ola === null || ola === undefined ? null : ola * factor * coef * fCam,
      tempAgua: marino.hourly.sea_surface_temperature?.[i] ?? null,
    };
  });
  return [...new Set([...Object.keys(porHora), ...Object.keys(mar)])].sort().map((t) => ({
    hora: t,
    nivelMar: mar[t]?.nivelMar ?? null, ola: mar[t]?.ola ?? null, tempAgua: mar[t]?.tempAgua ?? null,
    viento: porHora[t]?.viento ?? null, vientoDir: porHora[t]?.vientoDir ?? null,
    presion: porHora[t]?.presion ?? null, lluvia: porHora[t]?.lluvia ?? null,
  }));
}

// Índice de pesca desde costa de esta hora, o null (sin datos, sin especie).
export function indiceDeHoy(especiesDatos, spotPrev, horas, { ahoraISO, tipoFondoEntrada = null, batimetria = null, turbidez = null, caudalRio = null } = {}) {
  if (!especiesDatos || !horas?.length) return null;
  const i = horas.findIndex((h) => h.hora.slice(0, 13) === ahoraISO.slice(0, 13));
  if (i < 0) return null;
  const rio = RIOS_SPOT[spotPrev.slug] ? { nombre: RIOS_SPOT[spotPrev.slug].rio, distancia_desembocadura_km: null } : null;
  const contexto = {
    lat: spotPrev.lat, lon: spotPrev.lon, modalidad: "costa",
    reglasModalidad: especiesDatos.reglas_por_modalidad, reglasExpertas: especiesDatos.reglas_expertas,
    b0: especiesDatos.indice?.b0_logodds ?? 0,
    fondo: contextoFondo(tipoFondoEntrada, "costa"),
    turbidez, caudalRio, rio, batimetria, horaActual: ahoraISO,
  };
  let ind;
  try {
    ind = VA.indiceSpot(especiesDatos, horas, i, contexto);
  } catch {
    return null;
  }
  if (!ind || ind.puntuacion === null || ind.puntuacion === undefined) return null;
  const { motivos } = VA.paraUsuario(ind.resultado?.razones, { max: 4 });
  const p = Math.round(ind.puntuacion);
  return {
    puntuacion: p,
    nivel: p >= 60 ? "bueno" : p >= 40 ? "medio" : "malo",
    especie: ind.especie?.nombre || null,
    especieId: ind.especie?.id || null,
    freza: !!ind.freza,
    avisoOla: ind.avisoOla?.texto || null,
    motivos: motivos.map((m) => ({ texto: m.texto, flecha: m.flecha, sube: m.sube })),
  };
}

// Resumen de /prevision para la tarjeta "condiciones de hoy".
export function condicionesDePrevision(spotPrev) {
  if (!spotPrev || spotPrev.error) return null;
  const b = spotPrev.bloques?.[0];
  const m = spotPrev.marea;
  if (!b && !m) return null;
  const f = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  return {
    ola: b?.altura ? `${f(b.altura[0])}–${f(b.altura[1])} m` : null,
    olaDetalle: [b?.periodo ? `${b.periodo} s` : null, b?.dirOla ? `del ${b.dirOla.split(" ")[0]}` : null].filter(Boolean).join(" · ") || null,
    viento: b?.viento != null ? `${b.viento} km/h` : null,
    vientoDetalle: b?.dirViento ? `del ${b.dirViento}` : null,
    tempAgua: b?.tempAgua != null ? `${f(b.tempAgua)} °C` : null,
    marea: m?.altura != null ? `${f(m.altura)} m ${m.tendencia === "subiendo" ? "▲ subiendo" : m.tendencia === "bajando" ? "▼ bajando" : ""}`.trim() : null,
    mareaDetalle: [
      m?.coeficiente ? `coef. ${m.coeficiente}` : null,
      ...(m?.proximas || []).slice(0, 2).map((e) => `${e.tipo} ${e.manana ? "mañana " : ""}${e.hora}`),
    ].filter(Boolean).join(" · ") || null,
    actualizado: spotPrev.actualizado || null,
  };
}
