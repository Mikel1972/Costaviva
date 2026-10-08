// scripts/fuentes/subir-storage.mjs
// Sube ficheros JSON al bucket público "fuentes-gratuitas" de Supabase
// Storage (2026-10-08). Lo usa fuentes-gratuitas.yml tras generar las
// instantáneas de MET Norway y de Copernicus Marine. Sin IA.
//
// El bucket lo crea la migración
// supabase/migrations/20261008100000_bucket_fuentes_gratuitas.sql (lectura
// pública: son previsiones, ningún dato de usuarios). Escribe solo quien
// tiene SUPABASE_SERVICE_ROLE_KEY (secret de GitHub Actions que ya existe).
//
// Uso: node subir-storage.mjs <directorio_local> [prefijo_remoto]
//   sube cada .json de <directorio_local> (recursivo) a
//   fuentes-gratuitas/<prefijo_remoto>/<ruta relativa>.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SUPABASE_URL = "https://imncbmizxkorotpeisic.supabase.co";
const BUCKET = "fuentes-gratuitas";

function listar(dir) {
  const salida = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) salida.push(...listar(p));
    else if (n.endsWith(".json")) salida.push(p);
  }
  return salida;
}

async function subir(rutaRemota, cuerpo, clave) {
  for (let intento = 1; intento <= 3; intento++) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${rutaRemota}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        apikey: clave,
        "content-type": "application/json",
        "x-upsert": "true",
        // El edge de Cloudflare y el CDN de Supabase pueden guardarlo 15 min.
        "cache-control": "max-age=900",
      },
      body: cuerpo,
    });
    if (r.ok) return;
    const texto = (await r.text()).slice(0, 200);
    if (r.status < 500 || intento === 3) throw new Error(`Storage HTTP ${r.status} subiendo ${rutaRemota}: ${texto}`);
    await new Promise((ok) => setTimeout(ok, 3000 * intento));
  }
}

const [dir, prefijo = ""] = process.argv.slice(2);
const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!dir) {
  console.log("::error::Uso: node subir-storage.mjs <directorio> [prefijo]");
  process.exit(1);
}
if (!clave) {
  // Falta el secreto: en rojo, no en verde (comun web-y-despliegue.md W9).
  console.log("::error::Falta SUPABASE_SERVICE_ROLE_KEY: no se puede subir la instantánea");
  process.exit(1);
}
const ficheros = listar(dir);
let bytes = 0;
for (const f of ficheros) {
  const rel = relative(dir, f).split("\\").join("/");
  const remota = prefijo ? `${prefijo.replace(/\/+$/, "")}/${rel}` : rel;
  const cuerpo = readFileSync(f);
  bytes += cuerpo.length;
  await subir(remota, cuerpo, clave);
}
console.log(`Subidos ${ficheros.length} ficheros (${(bytes / 1e6).toFixed(1)} MB) a ${BUCKET}/${prefijo}`);
