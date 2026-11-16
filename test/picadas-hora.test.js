// Cada picada con su hora y condiciones (2026-11-16, Mikel: "cuando marco
// picadas, deberá guardarse la hora y demás datos automáticamente").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../diario.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20261116090000_picadas_pesca.sql", import.meta.url), "utf8");
function cargar(nombre) {
  const i = html.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, nombre);
  let n = 0;
  for (let j = html.indexOf("{", i); j < html.length; j++) {
    if (html[j] === "{") n++;
    else if (html[j] === "}" && --n === 0) return new Function(`${html.slice(i, j + 1)}; return ${nombre};`)();
  }
}

test("las condiciones de la picada usan los nombres de salidas_pesca y no guardan nulos", () => {
  const condicionesPicada = cargar("condicionesPicada");
  assert.deepEqual(
    condicionesPicada({ presion_valor: 1017, viento_kmh: 6, nubosidad: null, luna_fase: "Menguante", marea_altura: 1.2, otra: 1 }),
    { presion_valor: 1017, viento_kmh: 6, luna_fase: "Menguante" },
  );
});

test("+1 con la jornada en curso guarda la picada; − quita la última", () => {
  assert.match(html, /if \(delta === 1 && salida\.concluida === false\) await registrarPicada\(salida\);/);
  assert.match(html, /from\("picadas_pesca"\)\.delete\(\)\.eq\("id", entrada\.picadas\[entrada\.picadas\.length - 1\]\.id\)/);
  assert.match(html, /\.insert\(\{ salida_id: salida\.id, user_id: usuario\.id, hora \}\)/);
});

test("la tabla es privada de cada usuario y se borra con la salida", () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.picadas_pesca from anon, authenticated/);
  assert.match(sql, /references public\.salidas_pesca \(id\) on delete cascade/);
  assert.equal((sql.match(/auth\.uid\(\) = user_id/g) || []).length, 6);
});
