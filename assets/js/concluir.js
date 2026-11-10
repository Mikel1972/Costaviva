// assets/js/concluir.js
//
// Qué falta para poder concluir una jornada (2026-11-10, Mikel: "cuando se
// concluye jornada, si algo falta debe ser revisado en el momento y no
// permitir concluir jornada"). Puro, sin DOM: lo usa diario.html y lo
// prueban los tests. Devuelve claves de i18n con sus variables.
//
// Obligatorio: hora de fin, las picadas (un número, también 0 con
// «Ninguna») y la hora de cada captura. Lo demás (talla, peso, cebo...) es
// opcional y no bloquea.
export function pendientesConcluir(salida, capturas = []) {
  const out = [];
  if (!salida?.hora_fin) out.push({ clave: "diario.falta.hora_fin" });
  if (!Number.isInteger(salida?.picadas)) out.push({ clave: "diario.falta.picadas" });
  capturas.forEach((c, i) => {
    if (!c?.hora) out.push({ clave: "diario.falta.hora_captura", vars: { especie: c?.especie || "?", n: i + 1 } });
  });
  return out;
}
