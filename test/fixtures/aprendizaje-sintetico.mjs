// Diario sintético para test/aprendizaje.test.js: salidas con el índice
// guardado (términos en log-odds) y un resultado generado con un modelo
// "verdadero" conocido. Así se comprueba que el ajuste encuentra lo que se
// escondió. Nada de esto son datos reales.
import { rng } from "../../scripts/aprendizaje/metricas.mjs";

const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

// verdad: multiplicador real de cada unidad (lo que el índice cree es 1).
export function diarioSintetico({ n = 400, usuarios = 8, verdad = { "regla:coeficientes_altos": 0.4 }, b0Real = -0.2, semilla = 3, propios = [] } = {}) {
  const azar = rng(semilla);
  const salidas = [], capturas = [];
  for (let i = 0; i < n; i++) {
    const dia = new Date(Date.UTC(2026, 0, 1) + Math.floor((i / n) * 270) * 86400e3).toISOString().slice(0, 10);
    const terminos = [
      { factor: "luz", lo: azar() < 0.4 ? 0.4 : 0 },
      { factor: "marea", lo: +(0.4 * (azar() * 2 - 1)).toFixed(3) },
      { factor: "regla:coeficientes_altos", lo: azar() < 0.5 ? 1.0 : 0 },
      { factor: "regla:levante_cantabrico", lo: azar() < 0.3 ? -0.35 : 0 },
    ].filter((t) => t.lo !== 0);
    const xIndice = terminos.reduce((s, t) => s + t.lo, 0);
    const xReal = b0Real + terminos.reduce((s, t) => s + (verdad[t.factor] ?? 1) * t.lo, 0);
    const y = azar() < 1 / (1 + Math.exp(-xReal)) ? 1 : 0;
    const id = uuid(1000 + i);
    const u = uuid(1 + (i % usuarios));
    salidas.push({
      id, user_id: u, fecha: dia, hora_inicio: "08:10", tipo_salida: "costa", lat: 43.4047, lon: -2.6989, spot_slug: "mundaka", concluida: true,
      condiciones_estado: "ok", indice_version: "v2-logistica-2026-10-08", indice_puntuacion: Math.round(100 / (1 + Math.exp(-xIndice))), indice_especie: "lubina",
      indice_factores: {
        version: "v2-logistica-2026-10-08", hora: `${dia}T08:00`, modalidad: "costa", region: "cantabrico", especie: "lubina",
        probabilidad: 100 / (1 + Math.exp(-xIndice)),
        razones: terminos.map((t) => ({ factor: t.factor, texto: t.factor, aporte: Math.round(t.lo * 25), lo: t.lo })),
        ranking: [{ id: "lubina", p: 60 }, { id: "sargo", p: 55 }, { id: "dorada", p: 50 }],
      },
    });
    if (y) capturas.push({ salida_id: id, especie: azar() < 0.7 ? "Lubina" : "Sargo" });
  }
  return { salidas, capturas, excluir: new Set(), propios: new Set(propios) };
}
