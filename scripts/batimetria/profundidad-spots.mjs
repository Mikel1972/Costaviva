// scripts/batimetria/profundidad-spots.mjs
//
// Profundidad del mar delante de cada spot (sin IA). Pide a EMODnet
// Bathymetry (WCS, DTM 2024) una caja de ~5 km alrededor de cada spot de
// `SPOTS` (functions/prevision.js) y guarda en assets/datos/profundidad-spots.json
// las estadísticas de `estadisticasPunto` (batimetria.mjs). Si EMODnet falla
// o no tiene mar en 1 km, usa GEBCO_2026 (OPeNDAP de CEDA).
//
// Uso:
//   node scripts/batimetria/profundidad-spots.mjs            # escribe el JSON
//   node scripts/batimetria/profundidad-spots.mjs --punto "Armintza,43.4335,-2.9036"   # solo imprime
// El batímetro no cambia de un día para otro: se regenera a mano cuando
// salga una versión nueva del DTM (EMODnet publica cada ~2 años) o se añadan
// spots. Sin red a EMODnet: .github/workflows/batimetria.yml lo hace igual.
import { writeFileSync } from "node:fs";
import { SPOTS } from "../../functions/prevision.js";
import { rejillaEmodnet, rejillaGebco, estadisticasPunto, RADIO_ZONA_M } from "./batimetria.mjs";

const SALIDA = new URL("../../assets/datos/profundidad-spots.json", import.meta.url);
const MEDIA_LAT = 0.05, MEDIA_LON = 0.07; // ~5,5 km a cada lado

export async function profundidadPunto(lat, lon) {
  const caja = { sur: +(lat - MEDIA_LAT).toFixed(4), norte: +(lat + MEDIA_LAT).toFixed(4), oeste: +(lon - MEDIA_LON).toFixed(4), este: +(lon + MEDIA_LON).toFixed(4) };
  let error = null;
  try {
    const st = estadisticasPunto(await rejillaEmodnet(caja), lat, lon);
    if (st.zona_m !== null) return { ...st, fuente: "emodnet_dtm_2024" };
    error = "EMODnet sin mar a 1 km";
  } catch (e) { error = e.message; }
  try {
    const st = estadisticasPunto(await rejillaGebco(caja), lat, lon);
    return { ...st, fuente: "gebco_2026", aviso: `respaldo GEBCO (${error})` };
  } catch (e) {
    return { zona_m: null, fuente: null, aviso: `sin dato: ${error}; GEBCO: ${e.message}` };
  }
}

async function principal() {
  const i = process.argv.indexOf("--punto");
  if (i > 0) {
    const [nombre, lat, lon] = process.argv[i + 1].split(",");
    console.log(nombre, JSON.stringify(await profundidadPunto(Number(lat), Number(lon)), null, 1));
    return;
  }
  const spots = {};
  const cola = [...SPOTS];
  const trabajador = async () => {
    for (let s; (s = cola.shift());) {
      spots[s.slug] = { lat: s.lat, lon: s.lon, ...(await profundidadPunto(s.lat, s.lon)) };
      process.stderr.write(`${s.slug}: ${spots[s.slug].zona_m} m (${spots[s.slug].fuente})\n`);
    }
  };
  await Promise.all([trabajador(), trabajador(), trabajador()]);
  const ordenado = Object.fromEntries(SPOTS.map((s) => [s.slug, spots[s.slug]]));
  const salida = {
    version: 1,
    generado: new Date().toISOString().slice(0, 10),
    fuentes: {
      emodnet_dtm_2024: {
        titulo: "EMODnet Digital Bathymetry (DTM 2024)", editor: "EMODnet Bathymetry Consortium",
        doi: "https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1",
        servicio: "https://ows.emodnet-bathymetry.eu/wcs (cobertura emodnet__mean)",
        licencia: "CC BY 4.0", atribucion: "Batimetría: EMODnet Bathymetry Consortium (2024), EMODnet Digital Bathymetry (DTM 2024), CC BY 4.0",
      },
      gebco_2026: {
        titulo: "GEBCO_2026 Grid", editor: "GEBCO Bathymetric Compilation Group 2026",
        doi: "https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa",
        servicio: "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc",
        licencia: "dominio público (atribución pedida)", atribucion: "GEBCO Compilation Group (2026) GEBCO_2026 Grid",
      },
    },
    metodo: `Profundidades en metros positivos respecto al nivel de referencia del DTM. orilla = celda de mar más cercana al spot (a dist_mar_m); zona_m = mediana de las celdas de mar a ${RADIO_ZONA_M} m o menos de la orilla (la que usa el índice de pesca); punto_m = la celda del propio spot (null si cae en tierra); min/media/max_500m_m = celdas de mar a 500 m o menos de la orilla; max_1km_m; dist_Xm_m = distancia en metros a la celda más cercana de X m de fondo o más (null si no hay en ~5 km). Orientativo: no sirve para navegar.`,
    spots: ordenado,
  };
  writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + "\n");
  console.log(`Escrito ${SALIDA.pathname}: ${Object.keys(ordenado).length} spots`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e); process.exit(1); });
