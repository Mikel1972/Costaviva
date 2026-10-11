// functions/_lib/precios.js
// Precios de Premium por zonas y por ámbito de contenido (2026-10-11,
// decisiones de Mikel). Lógica pura, sin red: la usan crear-checkout-stripe.js,
// /precios-zona, stripe-webhook.js, scripts/stripe/crear-precios.mjs,
// scripts/precios/multiplicadores.mjs y test/precios.test.js.
//
// La configuración vive en functions/_lib/precios-zonas.json (se pasa como
// argumento: así los tests y los scripts la leen con fs y las Functions la
// importan). Detalle y porqués en CLAUDE.md, "Cobro: precios por zonas".
//
//   - ZONA: grupo de países con moneda, multiplicador y redondeo. La UE/EEE
//     va SIEMPRE a 1,0 en EUR (Reglamento UE 2018/302, geobloqueo): mismas
//     condiciones para todos sus clientes. Fuera de la UE, el multiplicador
//     es la RNB per cápita (Atlas, USD) del país ÷ la de España, acotada a
//     [0,6, 1,5] y redondeada a 0,05 (scripts/precios/multiplicadores.mjs).
//   - ÁMBITO: "regional" (Premium en la región de contenido de su zona) o
//     "mundial" (todas las regiones activas). Mundial = regional de su zona
//     × 1,5, redondeado hacia arriba a .99.
//   - PLAN: mensual, anual o fundador_anual (24,99 € en la UE, plazas
//     compartidas entre regional y mundial).

export const AMBITOS = Object.freeze(["regional", "mundial"]);
export const PLANES = Object.freeze(["mensual", "anual", "fundador_anual"]);

// Redondeo hacia arriba al .99 (11,15 -> 11,99; 11,99 -> 11,99). En céntimos.
export function redondear99(cent) {
  const euros = Math.ceil((cent - 99) / 100 - 1e-9);
  return Math.max(99, euros * 100 + 99);
}

// Redondeo "local": coronas sin decimales acabadas en 9 (129, 139...), franco
// suizo a .90; el resto, .99.
export function redondearLocal(cent, moneda) {
  const m = String(moneda || "").toUpperCase();
  if (["NOK", "SEK", "DKK", "ISK"].includes(m)) {
    const unidades = Math.ceil(cent / 100 - 1e-9);
    return (Math.ceil((unidades - 9) / 10 - 1e-9) * 10 + 9) * 100;
  }
  if (m === "CHF") {
    const euros = Math.ceil((cent - 90) / 100 - 1e-9);
    return euros * 100 + 90;
  }
  return redondear99(cent);
}

export function redondear(cent, modo, moneda) {
  return modo === "local" ? redondearLocal(cent, moneda) : redondear99(cent);
}

// Multiplicador por renta: RNB del país ÷ RNB de España, acotado y a 0,05.
export function multiplicadorPorRenta(rnbPais, rnbEspana, { min = 0.6, max = 1.5, paso = 0.05 } = {}) {
  if (!(rnbPais > 0) || !(rnbEspana > 0)) return null;
  const crudo = rnbPais / rnbEspana;
  const acotado = Math.min(max, Math.max(min, crudo));
  return Math.round(Math.round(acotado / paso) * paso * 100) / 100;
}

// Zona de un país (ISO 3166-1 alfa-2). Solo zonas activas; si no, "resto".
export function zonaDePais(config, pais) {
  const p = String(pais || "").toUpperCase();
  const activas = config.zonas.filter((z) => z.activa);
  return activas.find((z) => (z.paises || []).includes(p)) || activas.find((z) => z.id === config.zona_por_defecto);
}

export function zonaPorId(config, id) {
  return config.zonas.find((z) => z.id === id) || null;
}

// Zona con el multiplicador pendiente de decidir (NZ, 2026-10-11: 1,25 por
// renta frente al 1,40 que pidió Mikel). Mientras tanto se cobra como hoy:
// en EUR y al precio de España, sin crear precios en su moneda.
export function multiplicadorPendiente(zona) {
  return zona?.multiplicador_decision === "pendiente";
}

// Lo que de verdad se cobra a una zona (moneda y multiplicador).
export function zonaDeCobro(zona) {
  if (!multiplicadorPendiente(zona)) return zona;
  return { ...zona, moneda: "EUR", multiplicador_fijo: 1, redondeo: "99", cobro_provisional: true };
}

// Multiplicador efectivo de una zona: el fijo (UE/EEE y resto), el decidido a
// mano (multiplicador_manual) o el calculado por renta para su país.
export function multiplicadorDeZona(config, zona) {
  if (typeof zona.multiplicador_fijo === "number") return zona.multiplicador_fijo;
  if (multiplicadorPendiente(zona)) throw new Error(`zona ${zona.id}: multiplicador pendiente de decisión`);
  if (typeof zona.multiplicador_manual === "number") return zona.multiplicador_manual;
  const pais = (zona.paises || [])[0];
  const m = config.multiplicadores_pais?.[pais]?.multiplicador;
  if (typeof m !== "number") throw new Error(`zona ${zona.id}: sin multiplicador calculado para ${pais}`);
  return m;
}

// Tipo de cambio EUR -> moneda (BCE). EUR = 1.
export function tipoCambio(config, moneda) {
  if (moneda === "EUR") return 1;
  const t = config.tipo_cambio?.eur_a?.[moneda];
  if (typeof t !== "number") throw new Error(`sin tipo de cambio EUR->${moneda}`);
  return t;
}

// Importe en céntimos de la moneda de la zona para un ámbito y un plan.
//   regional = base EUR × multiplicador × cambio, redondeado;
//   mundial  = regional (ya redondeado) × factor_mundial, redondeado.
export function importeZona(config, zona, ambito, plan) {
  const base = config.planes[plan]?.eur_cent;
  if (!base) throw new Error(`plan desconocido: ${plan}`);
  const moneda = zona.moneda;
  const regional = moneda === "EUR" && multiplicadorDeZona(config, zona) === 1
    ? base
    : redondear(base * multiplicadorDeZona(config, zona) * tipoCambio(config, moneda), zona.redondeo, moneda);
  if (ambito === "regional") return regional;
  if (ambito === "mundial") return redondear(regional * config.factor_mundial, zona.redondeo, moneda);
  throw new Error(`ámbito desconocido: ${ambito}`);
}

// Clave estable (lookup_key de Stripe) de un precio. Lleva la versión de la
// tabla: si cambian los importes se crean precios nuevos y los clientes
// existentes se quedan en los suyos (no se migran suscripciones).
export function lookupKey(config, ambito, plan, sufijo = "") {
  return `cv_${ambito}_${plan}_v${config.version_precios}${sufijo}`;
}

// Precios que tienen que existir en Stripe: uno por ámbito y plan, en EUR,
// con currency_options para las monedas de las zonas activas. Si dos zonas
// activas comparten moneda con importes distintos (p. ej. una zona en EUR
// con multiplicador < 1), la segunda lleva su propio precio (sufijo _z<zona>).
export function preciosStripe(config) {
  const lista = [];
  const zonas = config.zonas.filter((z) => z.activa);
  for (const ambito of AMBITOS) {
    for (const plan of PLANES) {
      const base = {
        lookup_key: lookupKey(config, ambito, plan),
        producto: config.productos[ambito].clave,
        ambito, plan,
        intervalo: config.planes[plan].intervalo,
        fundador: !!config.planes[plan].fundador,
        moneda: "eur",
        importe: 0,
        currency_options: {},
        zonas: [],
      };
      base.importe = importeZona(config, { moneda: "EUR", multiplicador_fijo: 1, redondeo: "99" }, ambito, plan);
      const propios = [];
      for (const zOriginal of zonas) {
        const z = zonaDeCobro(zOriginal);
        const imp = importeZona(config, z, ambito, plan);
        const mon = z.moneda.toLowerCase();
        if (mon === "eur" && imp === base.importe) { base.zonas.push(z.id); continue; }
        if (mon !== "eur" && (base.currency_options[mon] === undefined || base.currency_options[mon] === imp)) {
          base.currency_options[mon] = imp;
          base.zonas.push(z.id);
          continue;
        }
        propios.push({ ...base, lookup_key: lookupKey(config, ambito, plan, `_z${z.id}`), moneda: mon, importe: imp, currency_options: {}, zonas: [z.id] });
      }
      lista.push(base, ...propios);
    }
  }
  return lista;
}

// Precio (lookup_key, moneda, importe) que paga una zona.
export function precioParaZona(config, zonaId, ambito, plan) {
  if (!zonaPorId(config, zonaId)) throw new Error(`zona desconocida: ${zonaId}`);
  const zona = zonaDeCobro(zonaPorId(config, zonaId));
  const p = preciosStripe(config).find((x) => x.ambito === ambito && x.plan === plan && x.zonas.includes(zonaId));
  if (!p) throw new Error(`sin precio para ${zonaId}/${ambito}/${plan}`);
  return { lookup_key: p.lookup_key, moneda: zona.moneda, importe: importeZona(config, zona, ambito, plan) };
}

// Ahorro del anual frente a 12 mensualidades, en % entero hacia abajo (para
// no prometer de más: 37,36 -> 37).
export function ahorroAnual(mensualCent, anualCent) {
  if (!(mensualCent > 0)) return 0;
  return Math.floor((1 - anualCent / (mensualCent * 12)) * 100);
}

// Región de contenido que cubre cada ámbito para una zona: regional = la de
// la zona; mundial = todas las regiones activas (functions/_lib/regiones-activas.js).
export function regionesDelAmbito(zona, ambito, regionesActivas) {
  if (ambito === "mundial") return [...regionesActivas];
  return zona.region_contenido ? [zona.region_contenido] : [];
}

// Tabla de precios de una zona para la página de precios.
export function tablaZona(config, zonaId) {
  const zona = zonaDeCobro(zonaPorId(config, zonaId));
  const t = { zona: zona.id, moneda: zona.moneda, region_contenido: zona.region_contenido, provisional: !!zona.cobro_provisional, planes: {} };
  for (const ambito of AMBITOS) {
    t.planes[ambito] = {};
    for (const plan of PLANES) t.planes[ambito][plan] = importeZona(config, zona, ambito, plan);
    t.planes[ambito].ahorro_anual = ahorroAnual(t.planes[ambito].mensual, t.planes[ambito].anual);
  }
  return t;
}

// Lectura de los metadatos que crear-precios.mjs pone en cada precio de
// Stripe (el webhook los usa para saber qué compró cada cliente). Admite los
// dos precios antiguos (39,99 €/año, 2026-09-15) como regional.
export const PRECIOS_ANTIGUOS = Object.freeze({
  price_1UG0hPGVID60u22aXMcBJNF3: { periodo: "mensual", ambito: "regional", fundador: false },
  price_1UG0hPGVID60u22a3GO1Cflj: { periodo: "anual", ambito: "regional", fundador: false },
});

export function datosDePrecio(price) {
  if (!price) return { periodo: null, ambito: null, fundador: false, lookup_key: null };
  const antiguo = PRECIOS_ANTIGUOS[price.id];
  if (antiguo) return { ...antiguo, lookup_key: price.lookup_key || null };
  const md = price.metadata || {};
  const plan = md.costaviva_plan;
  const periodo = plan === "mensual" ? "mensual" : plan === "anual" || plan === "fundador_anual" ? "anual"
    : price.recurring?.interval === "month" ? "mensual" : price.recurring?.interval === "year" ? "anual" : null;
  const ambito = AMBITOS.includes(md.costaviva_ambito) ? md.costaviva_ambito : "regional";
  return { periodo, ambito, fundador: md.costaviva_fundador === "true" || plan === "fundador_anual", lookup_key: price.lookup_key || null };
}

// Países de la UE y del EEE (para el test de geobloqueo y la zona ue_eee).
export const PAISES_UE = Object.freeze([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);
export const PAISES_EEE_NO_UE = Object.freeze(["IS", "LI", "NO"]);
