// Revisión antes de concluir la jornada (2026-11-10).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendientesConcluir } from "../assets/js/concluir.js";

test("sin hora de fin ni picadas no se concluye", () => {
  const f = pendientesConcluir({ hora_fin: null, picadas: null }, []);
  assert.deepEqual(f.map((x) => x.clave), ["diario.falta.hora_fin", "diario.falta.picadas"]);
});
test("«Ninguna» (0 picadas) vale", () => {
  assert.deepEqual(pendientesConcluir({ hora_fin: "02:30:00", picadas: 0 }, [{ especie: "Congrio", hora: "01:28:00" }]), []);
});
test("una captura sin hora bloquea y dice cuál", () => {
  const f = pendientesConcluir({ hora_fin: "02:30:00", picadas: 2 }, [{ especie: "Sargo", hora: "01:00" }, { especie: "Pulpo", hora: null }]);
  assert.deepEqual(f, [{ clave: "diario.falta.hora_captura", vars: { especie: "Pulpo", n: 2 } }]);
});
test("el diario revisa antes de concluir y los textos están en los tres idiomas", () => {
  const h = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
  assert.match(h, /const faltan = pendientesConcluir\(salida, capturas\);/);
  for (const i of ["es", "en", "pt"]) {
    const d = readFileSync(new URL(`../assets/i18n/${i}.js`, import.meta.url), "utf8");
    for (const k of ["titulo", "hora_fin", "picadas", "hora_captura", "pie"]) assert.ok(d.includes(`"diario.falta.${k}"`), `${i}: ${k}`);
  }
});
