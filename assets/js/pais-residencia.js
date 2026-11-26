// assets/js/pais-residencia.js
// País de residencia declarado antes de pagar (2026-11-25, aprobado por
// Mikel; CLAUDE.md "País de residencia obligatorio antes de pagar"). Decide
// la zona de precio (ya no el país de la conexión) y es una de las pruebas de
// residencia para el IVA.
//
// Módulo ES puro, sin dependencias: lo usan suscripcion.html (selector),
// functions/crear-checkout-stripe.js y functions/precios-zona.js
// (validación), functions/_lib/pais-residencia.js y los tests.

// Los 249 códigos ISO 3166-1 alfa-2 oficiales y XK (Kosovo: no es oficial,
// pero Stripe y Cloudflare lo usan). Ordenados.
export const PAISES = Object.freeze(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(" "));
const CONJUNTO = new Set(PAISES);

// País de residencia válido (en mayúsculas) o null. XX/T1 de Cloudflare
// ("desconocido"/Tor) no están en la lista, así que no valen.
export function paisResidenciaValido(p) {
  if (typeof p !== "string") return null;
  const s = p.trim().toUpperCase();
  return CONJUNTO.has(s) ? s : null;
}

// Bizum es un sistema español: solo para quien declara residir en España.
export const PAIS_BIZUM = "ES";
export function motivoBizumResidencia(pais) {
  return paisResidenciaValido(pais) === PAIS_BIZUM ? null : "bizum_solo_residentes_espana";
}

const LOCALES = { es: "es-ES", en: "en-NZ", pt: "pt-PT" };

// [{ codigo, nombre }] con el nombre en el idioma de la página (Intl), por
// orden alfabético de ese idioma. Sin Intl.DisplayNames, el código.
export function opcionesPaises(idioma = "es") {
  const loc = LOCALES[idioma] || LOCALES.es;
  let dn = null;
  try { dn = new Intl.DisplayNames([loc], { type: "region" }); } catch (e) { dn = null; }
  const nombre = (c) => { try { return (dn && dn.of(c)) || c; } catch (e) { return c; } };
  return PAISES.map((codigo) => ({ codigo, nombre: nombre(codigo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, loc));
}
