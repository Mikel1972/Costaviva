// scripts/aprendizaje/especies-texto.mjs
//
// Cambia la `confianza` de reglas expertas en el TEXTO de especies.json sin
// reformatear el resto (el fichero tiene ~480 KB con sangría de 1 espacio y
// números como 0.0: reescribirlo entero daría un diff ilegible). La primera
// vez que el ajuste toca una regla guarda al lado `confianza_experta` (el
// valor que puso la persona), que es el ancla de las barreras de seguridad.
// Después comprueba que el JSON resultante es el mismo salvo esos campos.

function bloqueRegla(texto, id) {
  const marca = `"id": ${JSON.stringify(id)},`;
  const ini = texto.indexOf(marca, texto.indexOf('"reglas_expertas"'));
  if (ini < 0) return null;
  // Fin del objeto: siguiente `"id": ` de otra regla o el cierre de la lista.
  const sig = texto.indexOf('\n    "id": ', ini + marca.length);
  return { ini, fin: sig < 0 ? texto.length : sig };
}

export function cambiarConfianzas(texto, cambios) {
  let t = texto;
  for (const c of cambios) {
    const b = bloqueRegla(t, c.regla);
    if (!b) throw new Error(`regla no encontrada en el texto: ${c.regla}`);
    const trozo = t.slice(b.ini, b.fin);
    const re = /\n(\s*)"confianza": ([0-9.]+),/;
    const m = trozo.match(re);
    if (!m) throw new Error(`regla ${c.regla} sin "confianza" en una línea propia`);
    const sangria = m[1];
    let nuevo = trozo.replace(re, `\n${sangria}"confianza": ${c.propuesto},`);
    if (!/"confianza_experta":/.test(trozo)) {
      nuevo = nuevo.replace(`"confianza": ${c.propuesto},`, `"confianza": ${c.propuesto},\n${sangria}"confianza_experta": ${m[2]},`);
    }
    t = t.slice(0, b.ini) + nuevo + t.slice(b.fin);
  }
  // Comprobación: solo cambian confianza y confianza_experta de esas reglas.
  const a = JSON.parse(texto), d = JSON.parse(t);
  const ids = new Set(cambios.map((c) => c.regla));
  for (const r of d.reglas_expertas.reglas) {
    const o = a.reglas_expertas.reglas.find((x) => x.id === r.id);
    const limpio = (x) => { const { confianza, confianza_experta, ...resto } = x; return JSON.stringify(resto); };
    if (limpio(o) !== limpio(r)) throw new Error(`cambio inesperado en la regla ${r.id}`);
    if (!ids.has(r.id) && (o.confianza !== r.confianza || o.confianza_experta !== r.confianza_experta)) throw new Error(`regla ${r.id} cambiada sin pedirlo`);
  }
  const sinReglas = (x) => JSON.stringify({ ...x, reglas_expertas: { ...x.reglas_expertas, reglas: null } });
  if (sinReglas(a) !== sinReglas(d)) throw new Error("cambio fuera de reglas_expertas.reglas");
  return t;
}
