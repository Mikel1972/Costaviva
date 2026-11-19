// sw.js — abrir el diario sin cobertura (2026-11-19)
//
// Solo hace dos cosas:
//   1. Guarda una copia de la página del diario y de sus ficheros (JS, CSS,
//      textos, letras y la librería de Supabase de esm.sh) cuando se abren
//      con red, para poder abrir el diario en el mar sin señal.
//   2. Primero SIEMPRE la red: la copia solo se usa si la red falla o no
//      contesta en 8 s. Así un despliegue nuevo nunca se queda con JS viejo
//      (los JS no llevan versión en el nombre, ver _headers).
// Nunca toca la API, Supabase, el tiempo ni nada que no esté en la lista:
// esas peticiones pasan tal cual. Los datos del diario se guardan aparte
// (IndexedDB, assets/js/cola-sin-conexion.js), no aquí.

const CACHE = "costaviva-diario-v1";
const ESPERA_MS = 8000;

const PAGINAS = new Set(["/diario", "/diario.html"]);
const ORIGENES_EXTERNOS = new Set(["https://esm.sh"]);

function seGuarda(url) {
  const u = new URL(url);
  if (u.origin === self.location.origin) {
    return PAGINAS.has(u.pathname) || u.pathname.startsWith("/assets/");
  }
  return ORIGENES_EXTERNOS.has(u.origin);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function conPlazo(promesa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("plazo")), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); ko(e); });
  });
}

async function redPrimero(peticion) {
  const cache = await caches.open(CACHE);
  try {
    const r = await conPlazo(fetch(peticion), ESPERA_MS);
    if (r.ok && (r.type === "basic" || r.type === "cors")) cache.put(clave(peticion), r.clone()).catch(() => {});
    return r;
  } catch (e) {
    const guardada = await cache.match(clave(peticion));
    if (guardada) return guardada;
    throw e;
  }
}

// /diario y /diario.html son la misma página; la consulta (?fecha=...) no cambia el HTML.
function clave(peticion) {
  const u = new URL(peticion.url);
  if (u.origin === self.location.origin && PAGINAS.has(u.pathname)) return `${u.origin}/diario`;
  return peticion.url;
}

self.addEventListener("fetch", (e) => {
  const p = e.request;
  if (p.method !== "GET" || !seGuarda(p.url)) return;
  e.respondWith(redPrimero(p));
});

// La página manda, tras cargar con red, la lista de ficheros que ha usado
// (performance.getEntriesByType("resource")): se guardan los de la lista.
self.addEventListener("message", (e) => {
  if (e.data?.tipo !== "guardar" || !Array.isArray(e.data.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of e.data.urls.slice(0, 300)) {
      if (!seGuarda(url)) continue;
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (r.ok) await cache.put(clave(new Request(url)), r);
      } catch { /* sin red: ya se guardará la próxima vez */ }
    }
  })());
});
