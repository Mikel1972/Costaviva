// scripts/fuentes/puntos.mjs
// Lista de puntos para descargar-ibi.py: los SPOTS de la app y las boyas de
// Puertos del Estado (estas solo para la comparativa). Sin IA.
// Uso: node scripts/fuentes/puntos.mjs > puntos.json
import { SPOTS, BOYAS } from "../../functions/prevision.js";

export function puntosMar() {
  return [
    ...SPOTS.map((s) => ({ id: s.slug, tipo: "spot", lat: s.lat, lon: s.lon })),
    ...BOYAS.map((b) => ({ id: `boya-${b.codigo}`, tipo: "boya", lat: b.lat, lon: b.lon })),
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(puntosMar(), null, 1) + "\n");
}
