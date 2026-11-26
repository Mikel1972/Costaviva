// assets/js/plan.js
// Qué ve cada cuenta según su plan (2026-10-11, cobro). Módulo ES puro: lo
// usan index.html (vía window.Plan) y test/plan.test.js.
//
// El estado sale de mi_estado_suscripcion() (migración 20261011230000):
//   premium / con_acceso   tiene Premium en alguna región
//   ambito                 "mundial" (prueba, admin, permanente, invitación o
//                          plan Mundial) o "regional"
//   region_contenido       región del plan regional ("es", "nz")
//   en_prueba, prueba_termina_en
// Las regiones de contenido son las de functions/_lib/regiones-activas.js
// ("es" = España y Portugal con las islas, "nz"); la de un spot la da
// paisDeRegion() de regiones.js.
//
// Sin estado (la RPC no respondió) se deja ver todo, como hacía el paywall:
// un fallo de red no debe quitarle a nadie lo que ha pagado.

export function premiumEn(estado, region) {
  if (!estado) return true;
  if (!(estado.premium ?? estado.con_acceso)) return false;
  if (estado.ambito === "regional") return (estado.region_contenido || "es") === region;
  return true;
}

// Aviso para lo Premium que no tiene en esa región:
//   "mundial"  tiene plan regional de otra región ("Disponible con el plan Mundial")
//   "premium"  no tiene Premium
//   null       lo tiene
export function avisoPremium(estado, region) {
  if (premiumEn(estado, region)) return null;
  return estado?.premium && estado.ambito === "regional" ? "mundial" : "premium";
}

// Aviso de fin de prueba dentro de la app: 3 días antes y el último día.
//   { tipo: "tres_dias" | "ultimo_dia", fin: Date } o null
export function avisoFinPrueba(estado, ahora = new Date()) {
  if (!estado?.en_prueba || !estado.prueba_termina_en) return null;
  const fin = new Date(estado.prueba_termina_en);
  const horas = (fin.getTime() - ahora.getTime()) / 3600000;
  if (!(horas > 0)) return null;
  if (horas <= 24) return { tipo: "ultimo_dia", fin };
  if (horas <= 72) return { tipo: "tres_dias", fin };
  return null;
}

// Black Friday 2x1 (2026-11-26, Mikel: «sí» a la cinta): del viernes
// 27/11/2026 00:00 al lunes 30/11 23:59 hora de España (las mismas fechas que
// functions/_lib/black-friday.js, que es quien acepta o no el código).
export const BF_DESDE_MS = Date.UTC(2026, 10, 26, 23, 0, 0); // 27/11 00:00 en Madrid (UTC+1)
export const BF_HASTA_MS = Date.UTC(2026, 10, 30, 23, 0, 0); // 01/12 00:00 en Madrid
export function ventanaBf(ahora = new Date()) {
  const t = ahora.getTime();
  if (!(t >= BF_DESDE_MS && t < BF_HASTA_MS)) return null;
  return { ultimoDia: t >= BF_HASTA_MS - 24 * 3600e3 };
}
// ¿Se le enseña la cinta? A quien no paga: plan gratis o aún en la prueba.
export function mostrarCintaBf(estado, ahora = new Date()) {
  if (!ventanaBf(ahora)) return false;
  if (!estado) return false; // sin estado no se sabe: mejor no molestar a quien paga
  return !(estado.premium ?? estado.con_acceso) || !!estado.en_prueba;
}
