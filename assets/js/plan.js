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
