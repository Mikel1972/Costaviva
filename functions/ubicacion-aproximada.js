// functions/ubicacion-aproximada.js — zona aproximada de quien abre la app
// (2026-11-25, «base» por IP, pedido de Mikel). Solo lo que Cloudflare ya
// sabe de la petición (request.cf: país, ciudad y coordenadas aproximadas,
// a nivel de ciudad). Ni se guarda la IP ni se llama a nadie de fuera. La
// app la propone como base y el usuario decide (index.html, proponerBase).
export function ubicacionDeCf(cf) {
  const lat = Number(cf?.latitude);
  const lon = Number(cf?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null);
  return { lat, lon, ciudad: texto(cf.city), region: texto(cf.region), pais: texto(cf.country) };
}

export function onRequestGet(context) {
  const u = ubicacionDeCf(context.request.cf);
  return new Response(JSON.stringify(u || { error: "sin_ubicacion" }), {
    status: u ? 200 : 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
