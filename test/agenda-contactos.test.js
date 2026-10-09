// Contactos de emergencia desde la agenda (assets/js/agenda-contactos.js,
// 2026-10-08). Lógica pura: detección de la Contact Picker API, contacto
// elegido -> fila para revisar (varios teléfonos/emails, teléfonos no
// válidos) y fila revisada -> lo que se guarda. Sin red ni secretos: corre
// en tests.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fuenteEs } from "./i18n-html.js";

await import("../assets/js/sos-whatsapp.js");
await import("../assets/js/agenda-contactos.js");
const { agendaDisponible, propiedadesAPedir, contactoAFila, contactosAFilas, yaGuardado, filaParaGuardar } =
  globalThis.AgendaContactos;

const contactsFalso = { select: async () => [], getProperties: async () => ["name", "email", "tel"] };

test("detección: solo con navigator.contacts, ContactsManager y contexto seguro", () => {
  assert.equal(agendaDisponible({ navigator: { contacts: contactsFalso }, window: { ContactsManager: function () {} }, isSecureContext: true }), true);
  // iPhone Safari / escritorio: no hay navigator.contacts.
  assert.equal(agendaDisponible({ navigator: {}, window: {}, isSecureContext: true }), false);
  // Sin ContactsManager (API a medias o desactivada).
  assert.equal(agendaDisponible({ navigator: { contacts: contactsFalso }, window: {}, isSecureContext: true }), false);
  // http:// sin https: la API no se puede usar.
  assert.equal(agendaDisponible({ navigator: { contacts: contactsFalso }, window: { ContactsManager: 1 }, isSecureContext: false }), false);
  assert.equal(agendaDisponible({ navigator: { contacts: {} }, window: { ContactsManager: 1 }, isSecureContext: true }), false);
  assert.equal(agendaDisponible(undefined), false);
});

test("propiedades: solo las que el teléfono soporta, en orden fijo", () => {
  assert.deepEqual(propiedadesAPedir(["tel", "address", "name", "email", "icon"]), ["name", "email", "tel"]);
  assert.deepEqual(propiedadesAPedir(["name", "tel"]), ["name", "tel"]);
  assert.deepEqual(propiedadesAPedir([]), []);
  assert.deepEqual(propiedadesAPedir(null), ["name", "email", "tel"]);
});

test("contacto sencillo: nombre, email y móvil normalizado a E.164", () => {
  const f = contactoAFila({ name: ["Ane Etxeberria"], email: ["Ane@Ejemplo.eus"], tel: ["612 34 56 78"] });
  assert.equal(f.nombre, "Ane Etxeberria");
  assert.deepEqual(f.emails, ["ane@ejemplo.eus"]);
  assert.equal(f.email, "ane@ejemplo.eus");
  assert.equal(f.whatsapp, "+34612345678");
  assert.equal(f.elegir, false);
  assert.deepEqual(f.telefonos, [{ original: "612 34 56 78", ok: true, e164: "+34612345678", error: null }]);
});

test("varios teléfonos: sin repetir, móviles antes que fijos, el primero marcado", () => {
  const f = contactoAFila({
    name: ["Jon"],
    tel: ["943 12 34 56", "+34 612 34 56 78", "0034612345678", "+33 6 12 34 56 78"],
  });
  assert.deepEqual(f.telefonos.map((t) => t.e164), ["+34612345678", "+33612345678", "+34943123456"]);
  assert.equal(f.whatsapp, "+34612345678");
  assert.equal(f.elegir, true);
  assert.equal(f.email, null);
});

test("varios emails: sin repetir (sin distinguir mayúsculas), descarta los que no lo son", () => {
  const f = contactoAFila({ name: ["Miren"], email: ["miren@a.com", "MIREN@a.com", " otro@b.org ", "no-es-email", ""] });
  assert.deepEqual(f.emails, ["miren@a.com", "otro@b.org"]);
  assert.deepEqual(f.emailsDescartados, ["no-es-email"]);
  assert.equal(f.email, "miren@a.com");
  assert.equal(f.elegir, true);
});

test("teléfono no válido: se enseña con el motivo y no se marca", () => {
  const f = contactoAFila({ name: ["Peio"], tel: ["612 34", "*21#"], email: ["peio@x.es"] });
  assert.equal(f.whatsapp, null);
  assert.equal(f.telefonos.length, 2);
  for (const t of f.telefonos) {
    assert.equal(t.ok, false);
    assert.equal(t.e164, null);
    assert.ok(t.error.length > 10);
  }
  // Inválidos detrás de los válidos.
  const g = contactoAFila({ tel: ["abc", "612345678"] });
  assert.deepEqual(g.telefonos.map((t) => t.ok), [true, false]);
});

test("contacto sin nombre o con campos que faltan", () => {
  const f = contactoAFila({ tel: ["612345678"] });
  assert.equal(f.nombre, "");
  assert.deepEqual(f.emails, []);
  const vacio = contactoAFila({});
  assert.deepEqual([vacio.nombre, vacio.email, vacio.whatsapp, vacio.telefonos.length], ["", null, null, 0]);
  assert.equal(contactoAFila({ name: ["", "  Koldo  "] }).nombre, "Koldo");
  assert.equal(contactoAFila({ name: ["x".repeat(80)] }).nombre.length, 60);
  assert.deepEqual(contactosAFilas(null), []);
  assert.equal(contactosAFilas([{ name: ["A"] }, { name: ["B"] }]).length, 2);
});

test("prefijo de país por defecto distinto de España", () => {
  const f = contactoAFila({ tel: ["06 12 34 56 78"] }, "33");
  assert.equal(f.whatsapp, "+33612345678");
});

test("guardar: lo marcado por defecto, o lo que la persona elige", () => {
  const f = contactoAFila({ name: ["Ane"], email: ["a@a.com", "b@b.com"], tel: ["612345678", "698765432"] });
  assert.deepEqual(filaParaGuardar(f, {}, "u1"), {
    ok: true, fila: { user_id: "u1", nombre: "Ane", email: "a@a.com", whatsapp: "+34612345678" },
  });
  assert.deepEqual(filaParaGuardar(f, { nombre: " Ane E. ", email: "b@b.com", whatsapp: "+34698765432" }, "u1").fila,
    { user_id: "u1", nombre: "Ane E.", email: "b@b.com", whatsapp: "+34698765432" });
  // "Sin email": solo WhatsApp (sin clave whatsapp si no hay, como el alta a mano).
  assert.deepEqual(filaParaGuardar(f, { email: null }, "u1").fila,
    { user_id: "u1", nombre: "Ane", email: null, whatsapp: "+34612345678" });
  assert.deepEqual(filaParaGuardar(f, { whatsapp: null }, "u1").fila, { user_id: "u1", nombre: "Ane", email: "a@a.com" });
});

test("guardar: solo datos que venían del contacto elegido", () => {
  const f = contactoAFila({ name: ["Ane"], email: ["a@a.com"], tel: ["612345678"] });
  const r = filaParaGuardar(f, { email: "otro@intruso.com", whatsapp: "+34699999999" }, "u1");
  assert.equal(r.ok, false);
  assert.match(r.error, /email o un WhatsApp/);
});

test("guardar: errores claros", () => {
  const sinNombre = contactoAFila({ tel: ["612345678"] });
  assert.deepEqual(filaParaGuardar(sinNombre, {}, "u1"), { ok: false, error: "Escribe el nombre del contacto." });
  assert.equal(filaParaGuardar(sinNombre, { nombre: "Mikel" }, "u1").ok, true);
  const nada = contactoAFila({ name: ["X"], tel: ["123"], email: ["roto"] });
  assert.match(filaParaGuardar(nada, {}, "u1").error, /ni un teléfono válido/);
  const conTodo = contactoAFila({ name: ["Y"], email: ["y@y.es"] });
  assert.match(filaParaGuardar(conTodo, { email: null }, "u1").error, /Elige al menos/);
});

test("ya guardado: mismo WhatsApp o mismo email", () => {
  const guardados = [{ nombre: "Ama", email: "Ama@Casa.es", whatsapp: null }, { nombre: "Aita", email: null, whatsapp: "+34612345678" }];
  assert.equal(yaGuardado(contactoAFila({ email: ["ama@casa.es"] }), guardados), true);
  assert.equal(yaGuardado(contactoAFila({ tel: ["612 345 678"] }), guardados), true);
  assert.equal(yaGuardado(contactoAFila({ tel: ["698765432"], email: ["otro@x.es"] }), guardados), false);
  assert.equal(yaGuardado(contactoAFila({}), guardados), false);
  assert.equal(yaGuardado(contactoAFila({ email: ["a@a.es"] }), null), false);
});

test("alarma.html: carga el módulo tras sos-whatsapp.js, botón y nota honesta, sin on*=", () => {
  const html = fuenteEs(readFileSync(new URL("../alarma.html", import.meta.url), "utf8"));
  const iSos = html.indexOf('src="/assets/js/sos-whatsapp.js"');
  const iAgenda = html.indexOf('src="/assets/js/agenda-contactos.js"');
  assert.ok(iSos > 0 && iAgenda > iSos);
  assert.match(html, /id="btnAgenda" hidden>📇 Elegir de la agenda</);
  assert.match(html, /Tu navegador no deja abrir la agenda: escribe el contacto a mano\./);
  assert.match(html, /navigator\.contacts\.select\(propiedadesAgenda, \{ multiple: true \}\)/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i);
});
