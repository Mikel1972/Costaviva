// assets/js/cola-sin-conexion.js — capturas y picadas apuntadas sin cobertura (2026-11-19)
//
// En el mar lo normal es no tener cobertura. Si al guardar no hay red, lo
// apuntado se queda en el móvil (IndexedDB, con las fotos ya reducidas) y se
// sube solo al volver la cobertura o al abrir el diario. Nada se pierde:
// solo se borra de la cola cuando la base de datos confirma la escritura.

const BD = "costaviva-sin-conexion";
const ALMACEN = "pendientes";

function abrir(idb = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!idb) { ko(new Error("sin IndexedDB")); return; }
    const pet = idb.open(BD, 1);
    pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN, { keyPath: "clave" });
    pet.onsuccess = () => ok(pet.result);
    pet.onerror = () => ko(pet.error);
  });
}

function operar(modo, fn, idb) {
  return abrir(idb).then((bd) => new Promise((ok, ko) => {
    const tx = bd.transaction(ALMACEN, modo);
    const res = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => { bd.close(); ok(res?.result); };
    tx.onerror = () => { bd.close(); ko(tx.error); };
  }));
}

export function encolar(item, idb) {
  const clave = item.clave || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return operar("readwrite", (s) => s.put({ ...item, clave, creado: new Date().toISOString() }), idb).then(() => clave);
}
export function listar(idb) {
  return operar("readonly", (s) => s.getAll(), idb).then((l) => (l || []).sort((a, b) => a.creado.localeCompare(b.creado)));
}
export function quitar(clave, idb) {
  return operar("readwrite", (s) => s.delete(clave), idb);
}

// ¿El fallo es por falta de red (y merece guardarse para luego) o es un
// error de verdad de la base de datos (que hay que enseñar)?
export function esFalloDeRed(error, enLinea = globalThis.navigator?.onLine) {
  if (enLinea === false) return true;
  if (!error) return false;
  const m = String(error.message || error).toLowerCase();
  return error instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|err_internet/.test(m);
}

// Sube lo pendiente con `subir(item)` (true si se guardó). Un fallo de red
// para la vuelta (se reintenta más tarde); un error real deja ese apunte en
// la cola y sigue con el resto. Devuelve cuántos se subieron.
let enCurso = null;
export function subirPendientes(subir, idb) {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    let subidos = 0;
    let lista = [];
    try { lista = await listar(idb); } catch { return 0; }
    for (const item of lista) {
      try {
        if (await subir(item)) { await quitar(item.clave, idb); subidos++; }
      } catch (e) {
        if (esFalloDeRed(e)) break;
        console.warn("Apunte sin conexión no subido:", e?.message || e);
      }
    }
    return subidos;
  })().finally(() => { enCurso = null; });
  return enCurso;
}
