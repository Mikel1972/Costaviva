// Robots a rutinas (2026-10-08, Mikel aprobó las propuestas de GASTO.md de
// Mikel1972/comun): ninguna pasada PROGRAMADA de un workflow puede gastar
// saldo de la API de Anthropic. Todo paso que use ANTHROPIC_API_KEY o el CLI
// de Claude tiene que ir condicionado a un lanzamiento manual con el input
// respaldo_api marcado, y ese input tiene que existir y valer false por
// defecto. Además, la agregación de patrones de uso que va al repo público
// no puede llevar identificadores, y el sondeo de experiencia tampoco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { agregar, contarValores } from "../scripts/patrones-uso/agregar.mjs";
import { salidaDesdePrevision, diferencias, compactarSpot } from "../scripts/experiencia/sondear.mjs";

const DIR = new URL("../.github/workflows/", import.meta.url);
const CONDICION = /github\.event_name == 'workflow_dispatch' && inputs\.respaldo_api == true/;

// Trocea un workflow en pasos ("      - name:" / "      - uses:") con su texto.
function pasos(yml) {
  const lineas = yml.split("\n");
  const out = [];
  let actual = null;
  for (const l of lineas) {
    if (/^      - (name|uses):/.test(l)) { actual = { cabecera: l.trim(), texto: l + "\n" }; out.push(actual); }
    else if (actual && (/^      \S/.test(l) || /^       /.test(l) || l.trim() === "" || /^\s+#/.test(l))) actual.texto += l + "\n";
    else if (actual && /^\S/.test(l)) actual = null;
  }
  return out;
}

const usaClaude = (texto) => /ANTHROPIC_API_KEY:\s*\$\{\{\s*secrets\.|@anthropic-ai\/claude-code|^\s*claude -p/m.test(texto.replace(/^\s*#.*$/gm, ""));

for (const fichero of readdirSync(DIR).filter((f) => f.endsWith(".yml"))) {
  const yml = readFileSync(new URL(fichero, DIR), "utf8");
  const conClaude = pasos(yml).filter((p) => usaClaude(p.texto));
  if (!conClaude.length) continue;

  test(`${fichero}: Claude solo arranca a mano con respaldo_api`, () => {
    for (const p of conClaude) {
      const si = p.texto.match(/^        if: (.+)$/m);
      assert.ok(si, `${p.cabecera}: usa la API sin "if:"`);
      assert.match(si[1], CONDICION, `${p.cabecera}: su "if:" no exige workflow_dispatch + respaldo_api`);
    }
  });

  test(`${fichero}: el input respaldo_api existe, es booleano y vale false por defecto`, () => {
    const bloque = yml.match(/^      respaldo_api:\n((?:        .*\n)+)/m);
    assert.ok(bloque, "falta el input respaldo_api en workflow_dispatch");
    assert.match(bloque[1], /type: boolean/);
    assert.match(bloque[1], /default: false/);
  });
}

test("los 5 robots que gastaban API siguen condicionados (no se ha quitado ninguno por error)", () => {
  for (const f of ["robot-camaras-caidas.yml", "daily-report.yml", "robot-buscador-fuentes.yml", "robot-experiencia-usuario.yml", "robot-patrones-uso.yml"]) {
    const yml = readFileSync(new URL(f, DIR), "utf8");
    assert.ok(pasos(yml).some((p) => usaClaude(p.texto)), `${f}: ya no tiene paso de Claude; si se quitó del todo, quitarlo de esta lista y de comun/scripts/gasto/robots-api.json`);
  }
});

// ---------- patrones de uso: agregados sin identificadores ----------

const AHORA = Date.parse("2026-10-09T22:00:00Z");
const hace = (dias) => new Date(AHORA - dias * 864e5).toISOString();
const U = ["11111111-aaaa", "22222222-bbbb", "33333333-cccc"];

test("contarValores oculta los valores de un solo usuario", () => {
  const r = contarValores([
    { valor: "lubina", user_id: U[0] }, { valor: "lubina", user_id: U[1] },
    { valor: "dorada", user_id: U[2] }, { valor: "dorada", user_id: U[2] },
  ]);
  assert.deepEqual(r.valores, [{ valor: "lubina", veces: 2, usuarios: 2 }]);
  assert.deepEqual(r.otros_con_menos_de_2_usuarios, { valores: 1, veces: 2 });
});

test("agregar: recuentos correctos y ningún user_id en la salida", () => {
  const r = agregar({
    perfiles: [
      { id: U[0], aprobado: true, creado_en: hace(30) },
      { id: U[1], aprobado: true, creado_en: hace(20) },
      { id: U[2], aprobado: false, creado_en: hace(2) },
    ],
    eventos: [
      { user_id: U[0], tipo: "ver_mapa", detalle: null, creado_en: hace(1) },
      { user_id: U[1], tipo: "ver_mapa", detalle: null, creado_en: hace(10) },
      { user_id: U[0], tipo: "marcar_favorito", detalle: { slug: "mundaka" }, creado_en: hace(3) },
      { user_id: U[1], tipo: "marcar_favorito", detalle: { slug: "mundaka" }, creado_en: hace(3) },
      { user_id: U[2], tipo: "marcar_favorito", detalle: { slug: "mi-rincon-secreto" }, creado_en: hace(1) },
    ],
    capturas: [{ user_id: U[0], especie: "lubina", creado_en: hace(5) }],
    salidas: [{ user_id: U[0], tipo_salida: "costa", spot_slug: "mundaka", creado_en: hace(5) }],
    favoritos: [{ user_id: U[0], spot_slug: "mundaka", spot_usuario_id: null, creado_en: hace(9) }],
    spotsUsuario: [],
  }, AHORA);
  assert.equal(r.perfiles.total, 3);
  assert.equal(r.perfiles.altas_7d, 1);
  assert.equal(r.usuarios_activos["7d"], 3);
  assert.deepEqual(r.abandono, { perfiles_con_mas_de_7_dias: 2, nunca_activos: 0, sin_actividad_en_7_dias: 0, activos_en_7_dias: 2 });
  assert.deepEqual(r.eventos_uso.por_tipo.ver_mapa["7d"], { filas: 1, usuarios: 1 });
  assert.deepEqual(r.eventos_uso.por_tipo.ver_mapa.total, { filas: 2, usuarios: 2 });
  assert.deepEqual(r.eventos_uso.por_tipo.marcar_favorito.detalle.slug.valores, [{ valor: "mundaka", veces: 2, usuarios: 2 }]);
  // Las capturas de un solo usuario no dicen la especie.
  assert.deepEqual(r.capturas.especie.valores, []);
  const texto = JSON.stringify(r);
  for (const id of U) assert.ok(!texto.includes(id), `sale el user_id ${id}`);
  assert.ok(!texto.includes("mi-rincon-secreto"), "sale un valor de un solo usuario");
});

// ---------- experiencia de usuario: lo que se guarda en el diario ----------

test("sondeo: la salida de prueba se arma con los datos del spot y se compara bien", () => {
  const spot = { slug: "mundaka", nombre: "Mundaka", lat: 43.4, lon: -2.7, marea: { altura: 3.1, tendencia: "bajando", coeficiente: 103 }, presion: { valor: 1026, tendencia: "estable" }, bloques: [{ altura: [1.6, 1.9], viento: 30, dirViento: "NNW", tempAgua: 20.5, precipitacion: 0, nubosidad: 97 }] };
  const s = salidaDesdePrevision(spot, { fase: "Menguante", iluminacion: 6 }, "2026-10-08");
  assert.equal(s.oleaje_altura_max, 1.9);
  assert.equal(s.marea_coeficiente, 103);
  assert.equal(s.luna_fase, "Menguante");
  assert.ok(!("user_id" in s));
  assert.deepEqual(diferencias(s, { ...s, presion_valor: "1026", nubosidad: null }), [{ campo: "nubosidad", enviado: 97, guardado: null }]);
  assert.deepEqual(compactarSpot({ slug: "x", error: "429" }), { slug: "x", error: "429" });
});
