// functions/_lib/assets-memo.js
// JSON de los assets del propio despliegue (env.ASSETS), leído y parseado
// una sola vez por isolate (2026-11-21, cortes 1102 de Cloudflare: las
// páginas de Nueva Zelanda parseaban en cada visita linz-mareas-<año>.json,
// ~400 KB cada uno, y la geojson de reservas). Los assets no cambian dentro
// de un despliegue. null si falta o falla (y entonces no se memoriza).
// Quien lo usa NO debe modificar el objeto devuelto.
const memo = new Map();

export function vaciarMemoAssets() {
  memo.clear();
}

export function leerAssetJson(env, url) {
  if (!env?.ASSETS) return Promise.resolve(null);
  const u = new URL(url);
  const clave = u.pathname;
  let p = memo.get(clave);
  if (!p) {
    p = env.ASSETS.fetch(u)
      .then((r) => (r.ok ? r.json() : null))
      .catch((e) => {
        console.error(`assets-memo: no se pudo leer ${clave}:`, e);
        return null;
      })
      .then((d) => {
        if (d == null) memo.delete(clave);
        return d;
      });
    memo.set(clave, p);
  }
  return p;
}
