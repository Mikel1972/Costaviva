// functions/_lib/pais-residencia.js
// País de residencia declarado (2026-11-25, aprobado por Mikel; CLAUDE.md
// "País de residencia obligatorio antes de pagar"). Lógica pura, sin red:
// la usan crear-checkout-stripe.js, precios-zona.js, stripe-webhook.js,
// pais-tarjeta.js (informe) y test/pais-residencia.test.js.
//
//   - La ZONA DE PRECIO sale del país de residencia declarado (zonaDePais),
//     no del país de la conexión, que se guarda aparte (metadata.pais_ip).
//   - PRUEBAS PARA EL IVA (Reglamento de Ejecución UE 282/2011, art. 24 bis
//     y 24 ter): hacen falta dos pruebas que no se contradigan. Aquí hay
//     tres: la residencia declarada, el país de la tarjeta y el país de la
//     conexión (al pagar o el más visto al usar la app).

import { zonaDePais } from "./precios.js";
import { paisResidenciaValido, motivoBizumResidencia, PAISES, PAIS_BIZUM } from "../../assets/js/pais-residencia.js";

export { paisResidenciaValido, motivoBizumResidencia, PAISES, PAIS_BIZUM };

// Lee y valida body.pais_residencia. { pais } o { error: código }.
export function leerPaisResidencia(body) {
  const crudo = body?.pais_residencia;
  if (crudo === undefined || crudo === null || String(crudo).trim() === "") return { error: "falta_pais_residencia" };
  const pais = paisResidenciaValido(String(crudo));
  return pais ? { pais } : { error: "pais_residencia_invalido" };
}

// Zona de precio por el país de residencia (misma lógica que siempre:
// zonaDePais; países sin zona activa -> "resto").
export function zonaPorResidencia(config, pais) {
  return zonaDePais(config, paisResidenciaValido(pais) || "");
}

// País de la conexión válido (2 letras; XX/T1 de Cloudflare no cuentan).
function paisValido(p) {
  const s = String(p || "").toUpperCase();
  return /^[A-Z]{2}$/.test(s) && s !== "XX" && s !== "T1" ? s : null;
}

// País más visto en suscripciones.paises_uso ({ "AAAA-MM-DD": ["NZ"] }),
// por número de días. Empate: orden alfabético. null si no hay.
export function paisDeUso(paisesUso) {
  if (!paisesUso || typeof paisesUso !== "object" || Array.isArray(paisesUso)) return null;
  const dias = new Map();
  for (const lista of Object.values(paisesUso)) {
    if (!Array.isArray(lista)) continue;
    for (const p of new Set(lista.map(paisValido).filter(Boolean))) dias.set(p, (dias.get(p) || 0) + 1);
  }
  const orden = [...dias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return orden.length ? orden[0][0] : null;
}

// Pruebas de residencia de una suscripción:
//   { residencia, tarjeta, uso } -> países (o null).
// Devuelve { suficiente, pais, coinciden, pruebas, contradice }:
//   suficiente — hay al menos 2 pruebas que señalan el mismo país;
//   pais       — ese país (o null);
//   coinciden  — cuántas pruebas lo señalan;
//   pruebas    — cuántas pruebas hay (0-3);
//   contradice — true si alguna prueba señala otro país.
export function pruebasResidencia({ residencia = null, tarjeta = null, uso = null } = {}) {
  const lista = [paisResidenciaValido(residencia || ""), paisValido(tarjeta), paisValido(uso)].filter(Boolean);
  const cuenta = new Map();
  for (const p of lista) cuenta.set(p, (cuenta.get(p) || 0) + 1);
  // Desempate: la residencia declarada (es la que decide el precio).
  const res = paisResidenciaValido(residencia || "");
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || (a[0] === res ? -1 : b[0] === res ? 1 : a[0].localeCompare(b[0])));
  const [pais, coinciden] = orden[0] || [null, 0];
  const suficiente = coinciden >= 2;
  return { suficiente, pais: suficiente ? pais : null, coinciden, pruebas: lista.length, contradice: cuenta.size > 1 };
}

