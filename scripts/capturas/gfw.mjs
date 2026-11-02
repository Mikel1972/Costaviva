// scripts/capturas/gfw.mjs (2026-11-02): capturas de la capa de Global
// Fishing Watch para enseñárselas a GFW (piden pruebas de que va en la parte
// GRATIS). Entra en producción con la sesión de una cuenta de prueba
// (SESION_JSON, de generate_link + verify en el workflow), abre el chip
// «🌍 Pesca comercial» y guarda capturas en capturas-gfw/. Solo lectura.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const SESION = JSON.parse(process.env.SESION_JSON || "{}");
if (!SESION.access_token) throw new Error("Falta SESION_JSON");
const CLAVE = "sb-imncbmizxkorotpeisic-auth-token";
mkdirSync("capturas-gfw", { recursive: true });
const b = await chromium.launch();
const vistas = [
  { nombre: "1-cantabrico-reciente", locale: "en-GB", centro: [44.0, -4.5], zoom: 7, periodo: "reciente", arte: "todas" },
  { nombre: "2-cantabrico-arrastre", locale: "en-GB", centro: [44.0, -4.5], zoom: 7, periodo: "reciente", arte: "arrastre" },
  { nombre: "3-cantabrico-habitual", locale: "en-GB", centro: [44.0, -4.5], zoom: 7, periodo: "habitual", arte: "todas" },
  { nombre: "4-nz-reciente", locale: "en-GB", centro: [-41.0, 174.0], zoom: 6, periodo: "reciente", arte: "todas" },
];
const informe = {};
for (const v of vistas) {
  const p = await b.newPage({ viewport: { width: 1280, height: 860 }, locale: v.locale });
  await p.addInitScript(([k, s]) => {
    localStorage.setItem(k, s);
    localStorage.setItem("va_gfw", JSON.stringify({ ver: true, periodo: "reciente", arte: "todas" }));
    localStorage.setItem("idioma", "en");
  }, [CLAVE, JSON.stringify(SESION)]);
  await p.goto("https://costaviva.org/", { waitUntil: "load", timeout: 60000 });
  await p.waitForSelector("[data-gfw-chip]", { timeout: 60000 });
  await p.evaluate(([c, z]) => map.setView(c, z), [v.centro, v.zoom]);
  await p.click("[data-gfw-chip]");
  await p.click(`[data-gfw-periodo="${v.periodo}"]`);
  await p.selectOption("[data-gfw-arte]", v.arte);
  await p.waitForTimeout(6000);
  informe[v.nombre] = await p.evaluate(() => ({
    plan: window.estadoPlan ? { plan: window.estadoPlan.plan ?? null, estado: window.estadoPlan.estado ?? window.estadoPlan.status ?? null } : null,
    fechas: document.querySelector("[data-gfw-fechas]")?.textContent || "",
  }));
  await p.screenshot({ path: `capturas-gfw/${v.nombre}.png` });
  await p.close();
}
writeFileSync("capturas-gfw/informe.json", JSON.stringify(informe, null, 1));
console.log(JSON.stringify(informe, null, 1));
await b.close();
