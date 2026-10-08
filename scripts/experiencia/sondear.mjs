// Experiencia de usuario: recoge, SIN IA, lo que devuelve producción a un
// usuario real, para que la rutina "Costaviva - Experiencia de usuario"
// (plan de Claude, sin acceso de red a Supabase ni a costaviva.org) lo juzgue
// con sospecha: no "¿respondió 200?" sino "¿tiene sentido?". Deja el
// resultado en datos-robots/experiencia/ultima.json.
//
// Corre en robot-experiencia-usuario.yml. Lo determinista de cada mañana
// (login, foto real a /identificar-captura, grupos...) ya lo cubre
// smoke-test.yml; esto guarda el CONTENIDO para que alguien lo lea.
//
// Reglas, las mismas que tenía el robot con API:
//   - JAMÁS se llama a /sos-alerta ni a nada de alarma.html.
//   - Lo que se cree con la cuenta de prueba se borra antes de terminar, con
//     su propio token (nunca con la service_role), y se comprueba que se fue.
//   - El repo es público: ni tokens ni user_id en el fichero de salida.
//   - Pocas peticiones: una /prevision (cacheada en el edge), tres /luna y un
//     puñado de casos límite.
//
// Uso: node scripts/experiencia/sondear.mjs <fichero de salida>
// Variables: PRODUCCION_URL, SUPABASE_URL, SUPABASE_ANON_KEY y, opcionales,
// TOKEN_A_FILE / TOKEN_B_FILE (ficheros con el access_token de cada cuenta).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

// Muestra fija repartida por zonas (Cantábrico, Galicia, Portugal,
// Mediterráneo, Baleares, Canarias, Andalucía atlántica): estos salen enteros;
// el resto, solo el bloque actual.
export const SPOTS_MUESTRA = ["mundaka", "santander", "acoruna", "nazare", "faro", "cadiz", "malaga", "valencia", "roses", "palma", "laspalmas", "elmedano"];

const RUTAS_PROHIBIDAS = /sos-alerta|alarma/i;

// Resumen compacto de un spot de /prevision: lo que un usuario ve "ahora".
export function compactarSpot(s) {
  if (s.error) return { slug: s.slug, error: s.error };
  return { slug: s.slug, marea: s.marea, presion: s.presion, zona: s.zonaOleaje?.tipo ?? null, bloque_actual: s.bloques?.[0] ?? null, bloques: s.bloques?.length ?? 0 };
}

export function resumirPrevision(p) {
  const spots = Array.isArray(p?.spots) ? p.spots : [];
  return {
    spots_total: spots.length,
    spots_con_error: spots.filter((s) => s.error).map((s) => ({ slug: s.slug, error: String(s.error).slice(0, 300) })),
    fuentesDatos: p?.fuentesDatos ?? null,
    todos_compactos: spots.map(compactarSpot),
    muestra_completa: spots.filter((s) => SPOTS_MUESTRA.includes(s.slug)),
    boyas: p?.boyas ?? null,
    caudales: p?.caudales ?? null,
    estacionesAemet: p?.estacionesAemet ?? null,
    turbidez: p?.turbidez ?? null,
    camaras: p?.camaras ?? null,
    monteRios: p?.monteRios ?? null,
    rayosNacional: p?.rayosNacional ?? null,
  };
}

// La salida que guardaría diario.html para ese spot con esos datos.
export function salidaDesdePrevision(spot, luna, hoy) {
  const b = spot.bloques?.[0] || {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    fecha: hoy,
    spot_slug: spot.slug,
    spot_nombre: spot.nombre,
    lat: spot.lat,
    lon: spot.lon,
    notas: "robot de experiencia de usuario (sin IA): se borra solo",
    marea_altura: num(spot.marea?.altura),
    marea_tendencia: spot.marea?.tendencia ?? null,
    marea_coeficiente: num(spot.marea?.coeficiente),
    presion_valor: num(spot.presion?.valor),
    presion_tendencia: spot.presion?.tendencia ?? null,
    luna_fase: luna?.fase ?? null,
    luna_iluminacion: num(luna?.iluminacion),
    viento_kmh: num(b.viento),
    viento_dir: b.dirViento ?? null,
    oleaje_altura_min: num(b.altura?.[0]),
    oleaje_altura_max: num(b.altura?.[1]),
    temp_agua: num(b.tempAgua),
    nubosidad: num(b.nubosidad),
    precipitacion: num(b.precipitacion),
  };
}

// Campos que no vuelven igual que se mandaron (numeric de Postgres vuelve
// como número; se compara con tolerancia).
export function diferencias(enviado, guardado) {
  const out = [];
  for (const [k, v] of Object.entries(enviado)) {
    const g = guardado?.[k];
    const igual = typeof v === "number" && g != null ? Math.abs(Number(g) - v) < 1e-6 : g === v;
    if (!igual) out.push({ campo: k, enviado: v, guardado: g ?? null });
  }
  return out;
}

function quitarSecretos(texto, secretos) {
  let t = texto;
  for (const s of secretos) if (s) t = t.split(s).join("<oculto>");
  return t;
}

async function main() {
  const salida = process.argv[2];
  const PROD = process.env.PRODUCCION_URL;
  const SB = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  if (!salida || !PROD || !SB || !ANON) {
    console.error("Uso: PRODUCCION_URL=... SUPABASE_URL=... SUPABASE_ANON_KEY=... node sondear.mjs <salida.json>");
    process.exit(1);
  }
  const leerToken = (f) => (f && existsSync(f) ? readFileSync(f, "utf8").trim() : "");
  const tokenA = leerToken(process.env.TOKEN_A_FILE);
  const tokenB = leerToken(process.env.TOKEN_B_FILE);
  const idDe = (t) => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub; } catch { return null; } };
  const idA = tokenA ? idDe(tokenA) : null;
  const idB = tokenB ? idDe(tokenB) : null;
  const secretos = [tokenA, tokenB, idA, idB];

  async function pedir(url, opciones = {}) {
    if (RUTAS_PROHIBIDAS.test(url)) throw new Error(`ruta prohibida: ${url}`);
    const t0 = Date.now();
    try {
      const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(30000) });
      const texto = await r.text();
      let json = null;
      try { json = JSON.parse(texto); } catch {}
      return { status: r.status, ms: Date.now() - t0, json, texto };
    } catch (e) {
      return { status: null, ms: Date.now() - t0, error: String(e.message || e), json: null, texto: "" };
    }
  }
  const corto = (r) => ({ status: r.status, ms: r.ms, ...(r.error ? { error: r.error } : {}), cuerpo: quitarSecretos(r.texto || "", secretos).slice(0, 600) });

  const resultado = { generado_en: new Date().toISOString(), produccion: PROD, avisos: [] };

  // 1. /prevision, lo que ve cualquiera al abrir la app.
  const prev = await pedir(`${PROD}/prevision`);
  resultado.prevision = { status: prev.status, ms: prev.ms, ...(prev.error ? { error: prev.error } : {}), ...(prev.json ? resumirPrevision(prev.json) : { cuerpo: (prev.texto || "").slice(0, 600) }) };
  const spots = prev.json?.spots || [];

  // 2. /luna en tres zonas.
  resultado.luna = [];
  for (const slug of ["mundaka", "valencia", "laspalmas"]) {
    const s = spots.find((x) => x.slug === slug);
    if (!s) continue;
    const r = await pedir(`${PROD}/luna?lat=${s.lat}&lon=${s.lon}`);
    resultado.luna.push({ slug, lat: s.lat, lon: s.lon, status: r.status, respuesta: r.json ?? (r.texto || "").slice(0, 300) });
  }

  // 3. Casos límite: el error tiene que ser claro, no un fallo a medias.
  const bordes = [
    ["/luna sin lat/lon", `${PROD}/luna`, "400 con mensaje claro"],
    ["/luna con texto en lat", `${PROD}/luna?lat=abc&lon=-2`, "400 con mensaje claro"],
    ["/geocodificar con cp inválido", `${PROD}/geocodificar?cp=abc`, "400 con mensaje claro"],
    ["/geocodificar con cp real (48360 Mundaka)", `${PROD}/geocodificar?cp=48360`, "200 con coordenadas cerca de Mundaka"],
    ["/webcam de un spot que no existe", `${PROD}/webcam/no-existe-robot`, "404 o error claro, nunca 200 con una imagen cualquiera"],
    ["/prevision con un spot que no existe", `${PROD}/prevision?spot=no-existe-robot`, "200 con la lista normal o error claro"],
    ["/identificar-captura sin sesión", `${PROD}/identificar-captura`, "401/403/405, nunca gastar IA sin sesión"],
    ["/meteo/marine con parámetro no permitido", `${PROD}/meteo/marine?latitude=43.41&longitude=-2.70&hourly=wave_height&format=csv`, "400"],
  ];
  resultado.casos_limite = [];
  for (const [que, url, esperado] of bordes) resultado.casos_limite.push({ que, esperado, ...corto(await pedir(url)) });

  // 4. Diario con la cuenta de prueba A: guardar la salida que guardaría
  //    diario.html con los datos de ahora, leerla, comprobar que B no la ve
  //    ni la borra, y borrarla.
  if (!tokenA || !idA) {
    resultado.diario = { hecho: false, motivo: "sin token de la cuenta de prueba A" };
  } else {
    const spot = spots.find((x) => x.slug === "mundaka" && !x.error) || spots.find((x) => !x.error);
    const luna = resultado.luna.find((l) => l.slug === spot?.slug)?.respuesta;
    const cab = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
    const d = { hecho: true, spot: spot?.slug ?? null };
    if (!spot) {
      d.hecho = false; d.motivo = "/prevision no trajo ningún spot sin error";
    } else {
      const enviado = salidaDesdePrevision(spot, typeof luna === "object" ? luna : null, new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
      const creada = await pedir(`${SB}/rest/v1/salidas_pesca`, { method: "POST", headers: { ...cab(tokenA), Prefer: "return=representation" }, body: JSON.stringify({ ...enviado, user_id: idA }) });
      const id = Array.isArray(creada.json) ? creada.json[0]?.id : null;
      d.crear = { status: creada.status, ...(id ? {} : { cuerpo: quitarSecretos(creada.texto || "", secretos).slice(0, 600) }) };
      d.enviado = enviado;
      if (id) {
        const leida = await pedir(`${SB}/rest/v1/salidas_pesca?id=eq.${id}&select=*`, { headers: cab(tokenA) });
        const fila = Array.isArray(leida.json) ? leida.json[0] : null;
        d.leer = { status: leida.status, encontrada: !!fila };
        if (fila) {
          const { user_id, id: _id, ...visible } = fila;
          d.guardado = visible;
          d.diferencias = diferencias(enviado, fila);
        }
        if (tokenB) {
          const verB = await pedir(`${SB}/rest/v1/salidas_pesca?id=eq.${id}&select=id`, { headers: cab(tokenB) });
          const borrarB = await pedir(`${SB}/rest/v1/salidas_pesca?id=eq.${id}`, { method: "DELETE", headers: { ...cab(tokenB), Prefer: "return=representation" } });
          d.cuenta_b = {
            ve_la_salida_de_a: Array.isArray(verB.json) ? verB.json.length > 0 : `respuesta inesperada (${verB.status})`,
            pudo_borrarla: Array.isArray(borrarB.json) ? borrarB.json.length > 0 : `respuesta inesperada (${borrarB.status})`,
          };
        }
        const borrada = await pedir(`${SB}/rest/v1/salidas_pesca?id=eq.${id}`, { method: "DELETE", headers: cab(tokenA) });
        const queda = await pedir(`${SB}/rest/v1/salidas_pesca?id=eq.${id}&select=id`, { headers: cab(tokenA) });
        d.limpieza = { status_borrado: borrada.status, sigue_existiendo: Array.isArray(queda.json) ? queda.json.length > 0 : "no se pudo comprobar" };
        if (d.limpieza.sigue_existiendo !== false) resultado.avisos.push("La salida de prueba podría no haberse borrado: revisarla a mano en salidas_pesca (notas 'robot de experiencia de usuario').");
      }
    }
    resultado.diario = d;
  }

  mkdirSync(dirname(salida), { recursive: true });
  const texto = quitarSecretos(JSON.stringify(resultado, null, 1), secretos);
  writeFileSync(salida, texto + "\n");
  for (const a of resultado.avisos) console.log(`::warning::${a}`);
  console.log(`Sondeo escrito en ${salida} (${Math.round(texto.length / 1024)} KB).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
