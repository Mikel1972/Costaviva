// scripts/aprendizaje/privacidad.mjs
//
// Qué se puede publicar en datos-robots/aprendizaje/ (el repo es PÚBLICO).
// Regla única: un número agregado solo sale si lo forman casos de al menos
// K_USUARIOS usuarios distintos (k-anonimato, igual que capturas_comunidad),
// o si TODOS sus casos son del dueño (tabla administradores: Mikel publica
// lo suyo, agregado). Nunca salen ids, fechas, horas, spots, coordenadas ni
// textos libres de un caso, aunque cumpla la regla.

export const K_USUARIOS = 5;

export function publicable(casos, k = K_USUARIOS) {
  if (!casos.length) return { ok: false, motivo: "sin casos" };
  if (casos.every((c) => c.propio)) return { ok: true, motivo: "solo datos del dueño" };
  const usuarios = new Set(casos.map((c) => c.usuario)).size;
  return usuarios >= k ? { ok: true, motivo: `${usuarios} usuarios` } : { ok: false, motivo: `menos de ${k} usuarios distintos` };
}

// Devuelve `valor` si el grupo es publicable; si no, un marcador sin datos.
export function siPublicable(casos, valor, k = K_USUARIOS) {
  const p = publicable(casos, k);
  return p.ok ? valor : { oculto: true, motivo: p.motivo };
}

// Barrido final antes de escribir: falla si algo con pinta de dato personal
// se ha colado en lo que se va a publicar (defensa en profundidad).
const CLAVES_PROHIBIDAS = /^(ref|usuario|user_id|email|lat|lon|fecha_salida|spot_slug|notas)$/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i;
export function comprobarPublicable(obj, ruta = "") {
  const problemas = [];
  const visitar = (o, r) => {
    if (o === null || o === undefined) return;
    if (typeof o === "string") {
      if (UUID.test(o)) problemas.push(`${r}: parece un id de usuario o salida`);
      if (EMAIL.test(o) && !/noreply@|@costaviva\.org/i.test(o)) problemas.push(`${r}: parece un email`);
      return;
    }
    if (Array.isArray(o)) { o.forEach((x, i) => visitar(x, `${r}[${i}]`)); return; }
    if (typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (CLAVES_PROHIBIDAS.test(k)) problemas.push(`${r}.${k}: clave no publicable`);
        visitar(v, `${r}.${k}`);
      }
    }
  };
  visitar(obj, ruta);
  return problemas;
}
