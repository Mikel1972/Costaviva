// scripts/camaras/decidir-estado.mjs
//
// Decisión de salud de una cámara PROPIA (imagen fija por /webcam/<slug> o
// vídeo HLS) a partir de la lectura de esta pasada y del estado guardado en la
// anterior. Vive aparte de comprobar-camaras.mjs (que necesita CRON_SECRET y
// red al importarse) para poder probarla: test/estado-camaras.test.js.
//
// Cambio del 2026-10-11 (pedido de Mikel, "Verde = cámara. Rojo = no
// cámara"). Dos casos reales de ese día salían en verde sin que el usuario
// viera nada:
//   1. Un fallo del ORIGEN (comillas, sanvicente y suances: origen_522 de
//      cantabria.es; alicante: origen_404) contaba como "un bache de red" y
//      solo se marcaba sin señal al segundo seguido. El parte decía
//      "✓ suances: origen_522" y la app los pintaba en verde mientras la
//      ficha decía "No se pudo cargar la webcam". Un origen_4xx/5xx (o un
//      http_4xx/5xx de nuestro proxy) es una respuesta del servidor, no un
//      corte de red: cuenta como sin señal desde el primero. Lo único que
//      espera a la segunda pasada es lo que sí puede ser un bache (sin
//      respuesta, error de descarga, fotograma plano).
//   2. Esas tres cámaras llevaban además el mismo fotograma desde la 01:30
//      UTC (hash_desde). Una lectura congelada daba frame_congelado y la
//      siguiente, al fallar, lo olvidaba y volvía a "sana". Ahora un fallo
//      no saca del rojo a una cámara cuyo último fotograma ya estaba
//      congelado (mismo hash desde hace más de UMBRAL_CONGELADA_MS).

// Umbrales de diseño, no calibrados en laboratorio.
export const UMBRAL_DESVIACION = 3; // desviación típica de brillo (0-255) mínima para no ser "plano"
export const UMBRAL_CONGELADA_MS = 3 * 60 * 60 * 1000; // 3h con el mismo frame -> "congelado"
export const UMBRAL_FALLOS_SEGUIDOS = 2; // fallos de red/frame plano seguidos antes de mostrarlo

// origen_404, origen_522, http_502...: el servidor respondió con un error.
export function esFalloDeServidor(motivo) {
  return /^(origen|http)_[45]\d\d$/.test(String(motivo ?? ""));
}

function congeladaDesdeHace(hashDesde, ahoraMs) {
  return !!hashDesde && ahoraMs - Date.parse(hashDesde) > UMBRAL_CONGELADA_MS;
}

// bruto: { ok, motivo?, hash?, desviacion? } de esta pasada.
// previo: { hashFrame, hashDesde, fallosSeguidos } de la anterior (o nada).
export function decidirEstado(bruto, previo, ahoraISO, ahoraMs = Date.parse(ahoraISO)) {
  if (!bruto.ok) {
    // No se pudo ni descargar/decodificar: se conserva el hash previo tal
    // cual (no se puede comparar nada esta vez), nunca se inventa uno.
    const fallosSeguidos = (previo?.fallosSeguidos ?? 0) + 1;
    const sinSenal =
      fallosSeguidos >= UMBRAL_FALLOS_SEGUIDOS ||
      esFalloDeServidor(bruto.motivo) ||
      congeladaDesdeHace(previo?.hashDesde, ahoraMs);
    return {
      sinSenal,
      motivo: bruto.motivo,
      fallosSeguidos,
      hashFrame: previo?.hashFrame ?? null,
      hashDesde: previo?.hashDesde ?? null,
    };
  }
  const mismoHash = !!previo?.hashFrame && previo.hashFrame === bruto.hash;
  const hashDesde = mismoHash ? (previo.hashDesde ?? ahoraISO) : ahoraISO;

  if (bruto.desviacion < UMBRAL_DESVIACION) {
    const fallosSeguidos = (previo?.fallosSeguidos ?? 0) + 1;
    return { sinSenal: fallosSeguidos >= UMBRAL_FALLOS_SEGUIDOS, motivo: "frame_plano", fallosSeguidos, hashFrame: bruto.hash, hashDesde };
  }
  // Lectura buena de verdad -> se resetea el contador de fallos seguidos,
  // aunque acabe marcándose congelada por el motivo independiente del hash.
  const congelada = mismoHash && congeladaDesdeHace(hashDesde, ahoraMs);
  return { sinSenal: congelada, motivo: congelada ? "frame_congelado" : "ok", fallosSeguidos: 0, hashFrame: bruto.hash, hashDesde };
}
