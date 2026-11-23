// Portada sin sesión → /login desde el servidor (2026-11-23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { redireccionPortada, tieneMarcaSesion, CLAVE_TOKEN } from "../functions/_lib/portada-sesion.js";

const pet = (ruta, h = {}, metodo = "GET") => new Request(`https://costaviva.org${ruta}`, { method: metodo, headers: h });
const CHROME = { "user-agent": "Mozilla/5.0 (Linux; Android 10) Chrome/120 Mobile Safari/537.36" };

test("sin marca de sesión, la portada va al login (con su query)", () => {
  assert.equal(redireccionPortada(pet("/", CHROME)), "/login");
  assert.equal(redireccionPortada(pet("/index.html", CHROME)), "/login");
  assert.equal(redireccionPortada(pet("/?invitacion=ABC", CHROME)), "/login?invitacion=ABC");
});

test("con marca, robots, otras páginas, POST o viniendo del login: se sirve la portada", () => {
  assert.equal(redireccionPortada(pet("/", { ...CHROME, cookie: "a=1; cv_sesion=1" })), null);
  assert.equal(redireccionPortada(pet("/", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })), null);
  assert.equal(redireccionPortada(pet("/", { "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" })), null);
  assert.equal(redireccionPortada(pet("/spots", CHROME)), null);
  assert.equal(redireccionPortada(pet("/", CHROME, "HEAD")), null);
  // Rompe-bucles: del login a la portada nunca se rebota.
  assert.equal(redireccionPortada(pet("/", { ...CHROME, referer: "https://costaviva.org/login" })), null);
  assert.equal(redireccionPortada(pet("/", { ...CHROME, referer: "https://costaviva.org/login.html?x=1" })), null);
  // De otra web sí se redirige.
  assert.equal(redireccionPortada(pet("/", { ...CHROME, referer: "https://www.google.com/" })), "/login");
});

test("marca: solo cv_sesion=1 exacta", () => {
  assert.equal(tieneMarcaSesion("cv_sesion=1"), true);
  assert.equal(tieneMarcaSesion("x=2; cv_sesion=1; y=3"), true);
  assert.equal(tieneMarcaSesion("cv_sesion=0"), false);
  assert.equal(tieneMarcaSesion("xcv_sesion=1"), false);
  assert.equal(tieneMarcaSesion(""), false);
});

test("index.html y login.html sincronizan la marca con el token, primero de todo", () => {
  for (const f of ["index.html", "login.html"]) {
    const h = readFileSync(f, "utf8");
    const i = h.indexOf('<script id="sin-sesion">');
    assert.ok(i > 0 && i < h.indexOf("<script src="), `${f}: el script va antes que ningún otro`);
    const s = h.slice(i, h.indexOf("</script>", i));
    assert.ok(s.includes(CLAVE_TOKEN), f);
    assert.match(s, /cv_sesion=1; path=\/; max-age=\d+; SameSite=Lax; Secure/, f);
    assert.match(s, /cv_sesion=; path=\/; max-age=0/, f);
  }
});
