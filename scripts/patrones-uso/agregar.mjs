// Patrones de uso: agrega, SIN IA, lo que la rutina "Costaviva - Patrones de
// uso" (plan de Claude) necesita para proponer cambios, y lo deja en
// datos-robots/patrones-uso/ultima.json. La rutina corre en la nube sin acceso
// a Supabase; este script corre en robot-patrones-uso.yml con la service_role
// (solo LECTURA) y escribe solo AGREGADOS: el repo es público (comun,
// estandares/claude-api.md, "Dónde va cada cosa").
//
// Privacidad, sin excepciones:
//   - Nunca sale un user_id, un email ni una fila suelta: solo recuentos.
//   - Un valor concreto (especie, spot, plan...) solo aparece si lo han usado
//     al menos MIN_USUARIOS usuarios distintos; el resto se suma en "otros".
//   - Las cuentas de prueba (TEST_USER_A_EMAIL/TEST_USER_B_EMAIL) no cuentan.
//
// Uso: node scripts/patrones-uso/agregar.mjs <fichero de salida>
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const MIN_USUARIOS = 2;
const DIA = 24 * 3600e3;

// Claves de eventos_uso.detalle que se pueden agregar (las que escriben
// index.html, diario.html, grupos.html, alarma.html y suscripcion.html).
const CLAVES_DETALLE = ["especie", "tecnica", "tipo_salida", "tipo", "publica", "plan", "slug"];

// Cuenta valores por usuarios distintos y oculta los que tienen menos de
// MIN_USUARIOS. filas: [{ valor, user_id }].
export function contarValores(filas) {
  const por = new Map();
  for (const { valor, user_id } of filas) {
    const k = valor == null || valor === "" ? "(vacío)" : String(valor);
    const p = por.get(k) || { veces: 0, usuarios: new Set() };
    p.veces++;
    p.usuarios.add(user_id);
    por.set(k, p);
  }
  const visibles = [];
  const otros = { valores: 0, veces: 0 };
  for (const [valor, p] of por) {
    if (p.usuarios.size >= MIN_USUARIOS) visibles.push({ valor, veces: p.veces, usuarios: p.usuarios.size });
    else { otros.valores++; otros.veces += p.veces; }
  }
  visibles.sort((a, b) => b.usuarios - a.usuarios || b.veces - a.veces || a.valor.localeCompare(b.valor));
  return { valores: visibles, otros_con_menos_de_2_usuarios: otros };
}

function enVentana(fila, ahora, dias) {
  return ahora - Date.parse(fila.creado_en) <= dias * DIA;
}

function resumenVentanas(filas, ahora) {
  const r = {};
  for (const [nombre, dias] of [["7d", 7], ["28d", 28], ["total", Infinity]]) {
    const f = filas.filter((x) => enVentana(x, ahora, dias));
    r[nombre] = { filas: f.length, usuarios: new Set(f.map((x) => x.user_id)).size };
  }
  return r;
}

// Función pura: de las filas leídas (ya sin cuentas de prueba) a los
// agregados que se publican. Ningún user_id sale de aquí.
export function agregar({ perfiles, eventos, capturas, salidas, favoritos, spotsUsuario }, ahora = Date.now()) {
  const fechas = (fs) => fs.map((x) => x.creado_en).sort();
  const porTipo = new Map();
  for (const e of eventos) {
    if (!porTipo.has(e.tipo)) porTipo.set(e.tipo, []);
    porTipo.get(e.tipo).push(e);
  }
  const eventosPorTipo = {};
  for (const [tipo, fs] of [...porTipo].sort((a, b) => a[0].localeCompare(b[0]))) {
    const f = fechas(fs);
    const detalle = {};
    for (const clave of CLAVES_DETALLE) {
      const conClave = fs.filter((x) => x.detalle && typeof x.detalle === "object" && clave in x.detalle && typeof x.detalle[clave] !== "object");
      if (conClave.length) detalle[clave] = contarValores(conClave.map((x) => ({ valor: x.detalle[clave], user_id: x.user_id })));
    }
    eventosPorTipo[tipo] = { ...resumenVentanas(fs, ahora), primero: f[0], ultimo: f[f.length - 1], ...(Object.keys(detalle).length ? { detalle } : {}) };
  }

  // Eventos por día, últimos 28 días (fecha UTC).
  const porDia = {};
  for (const e of eventos.filter((x) => enVentana(x, ahora, 28))) {
    const d = e.creado_en.slice(0, 10);
    porDia[d] = (porDia[d] || 0) + 1;
  }

  // Actividad por usuario: última fila en eventos_uso, capturas o salidas_pesca.
  const ultima = new Map();
  for (const x of [...eventos, ...capturas, ...salidas]) {
    const t = Date.parse(x.creado_en);
    if (!(ultima.get(x.user_id) >= t)) ultima.set(x.user_id, t);
  }
  const conMasDe7Dias = perfiles.filter((p) => ahora - Date.parse(p.creado_en) > 7 * DIA);
  const abandono = { perfiles_con_mas_de_7_dias: conMasDe7Dias.length, nunca_activos: 0, sin_actividad_en_7_dias: 0, activos_en_7_dias: 0 };
  for (const p of conMasDe7Dias) {
    const t = ultima.get(p.id);
    if (t == null) abandono.nunca_activos++;
    else if (ahora - t > 7 * DIA) abandono.sin_actividad_en_7_dias++;
    else abandono.activos_en_7_dias++;
  }

  const activos = (dias) => new Set([...eventos, ...capturas, ...salidas].filter((x) => enVentana(x, ahora, dias)).map((x) => x.user_id)).size;

  return {
    generado_en: new Date(ahora).toISOString(),
    nota: `Solo agregados. Un valor aparece si lo usan al menos ${MIN_USUARIOS} usuarios distintos; el resto va en "otros". Sin cuentas de prueba.`,
    perfiles: {
      total: perfiles.length,
      aprobados: perfiles.filter((p) => p.aprobado).length,
      altas_7d: perfiles.filter((p) => enVentana(p, ahora, 7)).length,
      altas_28d: perfiles.filter((p) => enVentana(p, ahora, 28)).length,
    },
    usuarios_activos: { "7d": activos(7), "28d": activos(28) },
    abandono,
    eventos_uso: { ...resumenVentanas(eventos, ahora), primero: fechas(eventos)[0] || null, por_tipo: eventosPorTipo, por_dia_28d: porDia },
    capturas: { ...resumenVentanas(capturas, ahora), especie: contarValores(capturas.map((x) => ({ valor: x.especie, user_id: x.user_id }))) },
    salidas_pesca: {
      ...resumenVentanas(salidas, ahora),
      tipo_salida: contarValores(salidas.map((x) => ({ valor: x.tipo_salida, user_id: x.user_id }))),
      spot_slug: contarValores(salidas.map((x) => ({ valor: x.spot_slug, user_id: x.user_id }))),
    },
    spots_favoritos: {
      total: favoritos.length,
      de_spots_de_usuario: favoritos.filter((f) => f.spot_usuario_id).length,
      spot_slug: contarValores(favoritos.filter((f) => f.spot_slug).map((f) => ({ valor: f.spot_slug, user_id: f.user_id }))),
    },
    spots_usuario: { total: spotsUsuario.length, usuarios: new Set(spotsUsuario.map((x) => x.user_id)).size },
  };
}

async function leerTodo(tabla, select) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/rest/v1/${tabla}?select=${select}&order=creado_en.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${desde}-${desde + 999}` },
    });
    if (!r.ok) throw new Error(`${tabla}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const pagina = await r.json();
    filas.push(...pagina);
    if (pagina.length < 1000) return filas;
  }
}

async function main() {
  const salida = process.argv[2];
  if (!salida || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node agregar.mjs <salida.json>");
    process.exit(1);
  }
  const perfilesConEmail = await leerTodo("perfiles", "id,email,aprobado,creado_en");
  const emailsPrueba = [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_B_EMAIL].filter(Boolean).map((e) => e.toLowerCase());
  const idsPrueba = new Set(perfilesConEmail.filter((p) => emailsPrueba.includes((p.email || "").toLowerCase())).map((p) => p.id));
  // Una tabla que falla (producción puede haber divergido del repo, trampa 10
  // de comun) no tumba el resto: se agrega vacía y se dice en "errores".
  const errores = [];
  const leer = async (tabla, select) => {
    try { return (await leerTodo(tabla, select)).filter((x) => !idsPrueba.has(x.user_id)); }
    catch (e) { errores.push(String(e.message || e)); return []; }
  };
  const datos = {
    perfiles: perfilesConEmail.filter((p) => !idsPrueba.has(p.id)).map(({ id, aprobado, creado_en }) => ({ id, aprobado, creado_en })),
    eventos: await leer("eventos_uso", "user_id,tipo,detalle,creado_en"),
    capturas: await leer("capturas", "user_id,especie,creado_en"),
    salidas: await leer("salidas_pesca", "user_id,tipo_salida,spot_slug,creado_en"),
    favoritos: await leer("spots_favoritos", "user_id,spot_slug,spot_usuario_id,creado_en"),
    spotsUsuario: await leer("spots_usuario", "user_id,creado_en"),
  };
  const resultado = agregar(datos);
  resultado.cuentas_de_prueba_excluidas = idsPrueba.size;
  resultado.errores = errores;
  for (const e of errores) console.log(`::warning::${e}`);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, JSON.stringify(resultado, null, 1) + "\n");
  console.log(`Agregados escritos en ${salida}: ${resultado.perfiles.total} perfiles, ${resultado.eventos_uso.total.filas} eventos.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
