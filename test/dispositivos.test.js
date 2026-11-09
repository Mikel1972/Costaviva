// Límite de dispositivos por cuenta (2026-11-09).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nombreDispositivo, decidir, LIMITE_DISPOSITIVOS } from "../assets/js/dispositivos.js";
import { sesionDelToken } from "../functions/dispositivos.js";
import { esRutaPermitida } from "../functions/_lib/rutas-publicas.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const PWA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

test("el límite es 2", () => assert.equal(LIMITE_DISPOSITIVOS, 2));

test("nombres legibles de dispositivo", () => {
  assert.equal(nombreDispositivo(IPHONE), "iPhone · Safari");
  assert.equal(nombreDispositivo(PWA), "iPhone · app");
  assert.equal(nombreDispositivo(PC), "Windows · Edge");
  assert.equal(nombreDispositivo(ANDROID), "Android · Chrome");
  assert.equal(nombreDispositivo(""), "?");
});

const s = (id, ua, ultima) => ({ id, user_agent: ua, creada: ultima, ultima });

test("2 dispositivos: sin exceso", () => {
  const d = decidir([s("a", IPHONE, "2026-11-09T10:00Z"), s("b", PC, "2026-11-08T10:00Z")], "a");
  assert.equal(d.exceso, false);
  assert.deepEqual(d.cerrarSolas, []);
});

test("3 dispositivos: exceso, la actual marcada", () => {
  const d = decidir([s("a", IPHONE, "2026-11-09T10:00Z"), s("b", PC, "2026-11-08T10:00Z"), s("c", ANDROID, "2026-11-01T10:00Z")], "a");
  assert.equal(d.exceso, true);
  assert.equal(d.dispositivos.find((x) => x.actual).id, "a");
});

test("la misma app que vuelve a entrar no cuenta dos veces: se cierra la vieja", () => {
  const d = decidir([s("a", IPHONE, "2026-11-09T10:00Z"), s("viejo", IPHONE, "2026-11-02T10:00Z"), s("b", PC, "2026-11-08T10:00Z")], "a");
  assert.deepEqual(d.cerrarSolas, ["viejo"]);
  assert.equal(d.exceso, false);
});

test("si la actual es la más vieja del mismo navegador, se queda la actual", () => {
  const d = decidir([s("nueva", IPHONE, "2026-11-09T10:00Z"), s("a", IPHONE, "2026-11-02T10:00Z")], "a");
  assert.deepEqual(d.cerrarSolas, ["nueva"]);
  assert.equal(d.dispositivos[0].id, "a");
});

test("sesión cerrada desde otro dispositivo", () => {
  assert.equal(decidir([s("b", PC, "2026-11-08T10:00Z")], "a").actualCerrada, true);
});

test("administradores sin límite", () => {
  const d = decidir([s("a", IPHONE, "1"), s("b", PC, "2"), s("c", ANDROID, "3")], "a", null);
  assert.equal(d.exceso, false);
});

test("session_id sale del token; basura → null", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "u", session_id: "0b5f8a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b" })).toString("base64url");
  assert.equal(sesionDelToken(`x.${payload}.y`), "0b5f8a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b");
  const malo = Buffer.from(JSON.stringify({ session_id: "1 or 1=1" })).toString("base64url");
  assert.equal(sesionDelToken(`x.${malo}.y`), null);
  assert.equal(sesionDelToken("basura"), null);
});

test("/dispositivos llega a su función y las páginas con sesión lo vigilan", () => {
  assert.equal(esRutaPermitida("/dispositivos"), true);
  for (const p of ["index.html", "diario.html", "grupos.html", "alarma.html"]) {
    assert.match(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"), /vigilarDispositivos\(supabase\)/, p);
  }
});

test("la migración deja las funciones solo para service_role", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261109120000_sesiones_dispositivos.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all on function public\.sesiones_usuario\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.cerrar_sesion_usuario\(uuid, uuid\) from public, anon, authenticated/);
  assert.equal((sql.match(/set search_path = ''/g) || []).length, 2);
});
