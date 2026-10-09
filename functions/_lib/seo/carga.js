// functions/_lib/seo/carga.js
// Carga de datos de las páginas públicas (red), separada de la lógica pura.
// Coste: los JSON de assets/ salen de env.ASSETS (estáticos, sin cuota);
// /prevision y /meteo/* ya tienen caché en el edge (30 min y por
// coordenadas); la página entera se guarda 30-60 min con conCache().
import { SPOTS } from "../../prevision.js";
import { WEBCAMS } from "../../webcam/[slug].js";
import { cargarJson, pedirConLimite, ahoraMadridISO } from "./base.js";
import { consultasMeteo, serieHorariaSpot, indiceDeHoy, condicionesDePrevision } from "./indice-hoy.js";
import { rioDeSpot } from "./datos.js";
import { horaLocalISO, zonaDeSpot } from "../../../assets/js/regiones.js";

export { SPOTS };

export const cargarEspecies = (context) => cargarJson(context, "/assets/datos/especies.json");

// Mes en curso para las páginas de especies (todas de la Península por
// ahora): hora de Madrid a propósito. Nueva Zelanda tendrá las suyas (fase 5).
export function mesMadrid(fecha = new Date()) {
  return Number(ahoraMadridISO(fecha).slice(5, 7));
}

// Todo lo que necesita /spots/<slug>. Lo que falle (o tarde) se queda en
// null y la página sale igual, sin ese bloque.
export async function datosPaginaSpot(context, spot) {
  const base = context.request.url;
  const q = consultasMeteo(spot);
  const [especiesDatos, tipoFondo, profundidad, prevision, marino, tiempo] = await Promise.all([
    cargarEspecies(context),
    cargarJson(context, "/assets/datos/tipo-fondo.json").catch(() => null),
    cargarJson(context, "/assets/datos/profundidad-spots.json").catch(() => null),
    pedirConLimite(new URL("/prevision", base).toString(), undefined, context),
    pedirConLimite(new URL(q.marine, base).toString(), undefined, context),
    pedirConLimite(new URL(q.forecast, base).toString(), undefined, context),
  ]);
  // "Ahora" en la hora local del spot (la de su serie de /meteo).
  const ahoraISO = `${horaLocalISO(zonaDeSpot(spot))}:00`;
  const spotPrev = prevision?.spots?.find((s) => s.slug === spot.slug && !s.error) || null;
  const cond = condicionesDePrevision(spotPrev);
  let indice = null;
  if (spotPrev && marino && tiempo) {
    const horas = serieHorariaSpot(spotPrev, marino, tiempo);
    const rio = rioDeSpot(spot.slug, prevision?.caudales);
    indice = indiceDeHoy(especiesDatos, spotPrev, horas, {
      ahoraISO,
      tipoFondoEntrada: tipoFondo?.spots?.[spot.slug] || null,
      batimetria: profundidad?.spots?.[spot.slug] || null,
      turbidez: prevision?.turbidez?.[spot.slug]?.etiqueta || null,
      caudalRio: rio?.caudal?.categoria || null,
    });
  }
  const camarasApp = Object.fromEntries(Object.keys(WEBCAMS).map((k) => [k, true]));
  for (const [k, v] of Object.entries(prevision?.camaras || {})) if (v && v.sinSenal === false) camarasApp[k] = true;
  return {
    especiesDatos, tipoFondo, profundidad, caudales: prevision?.caudales || null, camarasApp, cond, indice,
    mes: Number(ahoraISO.slice(5, 7)),
    completa: !!(cond && indice),
  };
}
