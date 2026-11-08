// assets/js/visor-foto.js
//
// Visor de fotos de las capturas del diario (2026-11-08, Mikel: "cuando
// selecciono una foto de una captura, debe dejarme ampliarla y, si quiero,
// guardarla en el carrete de fotos").
//
// - Tocar una foto de .galeria-fotos la abre a pantalla completa.
// - Ampliar: pellizco con dos dedos (el viewport de la app no deja hacer
//   zoom a la página, así que el zoom es propio), doble toque o rueda del
//   ratón. Ampliada, se mueve arrastrando con un dedo.
// - "Guardar": en el móvil abre la hoja de compartir del sistema con la foto
//   (en iPhone, "Guardar imagen" la manda al carrete); si el navegador no
//   puede compartir ficheros, la descarga.
// - Se cierra con ✕, con Escape o tocando fuera de la foto sin ampliar.
//
// Sin dependencias; se engancha solo (delegación en document). Funciones
// puras exportadas en window.VisorFoto para los tests.
(function () {
  const ZOOM_MAX = 5;
  const ZOOM_DOBLE = 2.5;

  // Escala nueva al pellizcar, entre 1 y ZOOM_MAX.
  function escalaPellizco(escalaInicial, distInicial, distAhora) {
    if (!distInicial) return escalaInicial;
    return Math.min(ZOOM_MAX, Math.max(1, (escalaInicial * distAhora) / distInicial));
  }
  // Desplazamiento máximo para que la foto ampliada no deje hueco.
  function limitar(x, y, escala, ancho, alto) {
    const mx = ((escala - 1) * ancho) / 2;
    const my = ((escala - 1) * alto) / 2;
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  }
  function nombreFichero(alt, ahora = new Date()) {
    const base = String(alt || "captura").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "captura";
    const f = ahora.toISOString().slice(0, 10);
    return `costaviva-${base}-${f}.jpg`;
  }
  window.VisorFoto = { escalaPellizco, limitar, nombreFichero, ZOOM_MAX };

  if (typeof document === "undefined") return;
  const t = (k, d) => (window.I18n && I18n.t(k) !== k ? I18n.t(k) : d);

  const css = document.createElement("style");
  css.textContent = `
    .visor-foto { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.94); display: flex; align-items: center; justify-content: center; touch-action: none; overscroll-behavior: contain; }
    .visor-foto[hidden] { display: none; }
    .visor-foto img { max-width: 100vw; max-height: 100dvh; object-fit: contain; transform-origin: center center; user-select: none; -webkit-user-select: none; -webkit-touch-callout: default; will-change: transform; }
    .visor-foto .visor-barra { position: absolute; left: 0; right: 0; top: 0; display: flex; justify-content: space-between; align-items: center; gap: 10px;
      padding: max(10px, env(safe-area-inset-top)) 12px 10px; background: linear-gradient(rgba(0,0,0,0.6), transparent); }
    .visor-foto button { border: 0; border-radius: 999px; font: 700 14px/1 var(--f-texto, system-ui); cursor: pointer; }
    .visor-foto .visor-guardar { background: #fff; color: #0B1E3F; padding: 10px 16px; }
    .visor-foto .visor-cerrar { background: rgba(255,255,255,0.18); color: #fff; width: 40px; height: 40px; font-size: 18px; }
    .visor-foto .visor-ayuda { position: absolute; bottom: max(12px, env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; color: rgba(255,255,255,0.7); font: 500 12px/1.3 var(--f-texto, system-ui); pointer-events: none; }
    .galeria-fotos img { cursor: zoom-in; }
  `;
  document.head.appendChild(css);

  let visor, img, escala = 1, px = 0, py = 0;
  const punteros = new Map();
  let pellizco = null, arrastre = null, ultimoToque = 0, movido = false;

  function aplicar() {
    const r = img.getBoundingClientRect();
    const ancho = r.width / escala, alto = r.height / escala;
    ({ x: px, y: py } = limitar(px, py, escala, ancho, alto));
    img.style.transform = `translate(${px}px, ${py}px) scale(${escala})`;
  }
  function reiniciar() { escala = 1; px = 0; py = 0; img.style.transform = ""; }

  function crear() {
    visor = document.createElement("div");
    visor.className = "visor-foto";
    visor.hidden = true;
    visor.setAttribute("role", "dialog");
    visor.setAttribute("aria-modal", "true");
    visor.innerHTML = `
      <img alt="" draggable="false">
      <div class="visor-barra">
        <button type="button" class="visor-guardar"></button>
        <button type="button" class="visor-cerrar">✕</button>
      </div>
      <div class="visor-ayuda"></div>`;
    document.body.appendChild(visor);
    img = visor.querySelector("img");
    visor.querySelector(".visor-cerrar").addEventListener("click", cerrar);
    visor.querySelector(".visor-guardar").addEventListener("click", guardar);

    visor.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".visor-barra")) return;
      visor.setPointerCapture?.(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movido = false;
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        pellizco = { dist: Math.hypot(a.x - b.x, a.y - b.y), escala };
        arrastre = null;
      } else if (punteros.size === 1) {
        arrastre = { x: e.clientX - px, y: e.clientY - py };
      }
    });
    visor.addEventListener("pointermove", (e) => {
      if (!punteros.has(e.pointerId)) return;
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pellizco && punteros.size >= 2) {
        const [a, b] = [...punteros.values()];
        escala = escalaPellizco(pellizco.escala, pellizco.dist, Math.hypot(a.x - b.x, a.y - b.y));
        movido = true;
        aplicar();
      } else if (arrastre && escala > 1) {
        px = e.clientX - arrastre.x; py = e.clientY - arrastre.y;
        movido = true;
        aplicar();
      }
    });
    const soltar = (e) => {
      const habia = punteros.size;
      punteros.delete(e.pointerId);
      if (punteros.size < 2) pellizco = null;
      if (punteros.size === 1) { const [p] = [...punteros.values()]; arrastre = { x: p.x - px, y: p.y - py }; }
      if (punteros.size === 0) arrastre = null;
      if (escala <= 1.01) reiniciar();
      if (habia === 1 && !movido && e.type === "pointerup") {
        const ahora = Date.now();
        if (ahora - ultimoToque < 300) {
          ultimoToque = 0;
          if (escala > 1) reiniciar(); else { escala = ZOOM_DOBLE; aplicar(); }
        } else {
          ultimoToque = ahora;
          // Un toque fuera de la foto, sin ampliar, cierra.
          if (e.target === visor && escala === 1) setTimeout(() => { if (ultimoToque === ahora) cerrar(); }, 320);
        }
      }
    };
    visor.addEventListener("pointerup", soltar);
    visor.addEventListener("pointercancel", soltar);
    visor.addEventListener("wheel", (e) => {
      e.preventDefault();
      escala = Math.min(ZOOM_MAX, Math.max(1, escala * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      if (escala <= 1.01) reiniciar(); else aplicar();
    }, { passive: false });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !visor.hidden) cerrar(); });
  }

  function abrir(src, alt) {
    if (!visor) crear();
    reiniciar();
    img.src = src;
    img.alt = alt || "";
    visor.querySelector(".visor-guardar").textContent = t("diario.foto_guardar", "⬇ Guardar");
    visor.querySelector(".visor-cerrar").setAttribute("aria-label", t("comun.cerrar", "Cerrar"));
    visor.querySelector(".visor-ayuda").textContent = t("diario.foto_ayuda", "Pellizca o toca dos veces para ampliar");
    visor.hidden = false;
    document.documentElement.style.overflow = "hidden";
  }
  function cerrar() {
    visor.hidden = true;
    punteros.clear(); pellizco = null; arrastre = null;
    document.documentElement.style.overflow = "";
  }

  async function guardar() {
    const nombre = nombreFichero(img.alt);
    try {
      const r = await fetch(img.src);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const fichero = new File([blob], nombre, { type: blob.type || "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [fichero] })) {
        await navigator.share({ files: [fichero] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      if (e && e.name === "AbortError") return; // cerró la hoja de compartir
      console.warn("No se pudo guardar la foto:", e && e.message);
      alert(t("diario.foto_no_guardada", "No se ha podido guardar la foto. Mantén pulsada la foto para guardarla."));
    }
  }

  document.addEventListener("click", (e) => {
    const foto = e.target.closest && e.target.closest(".galeria-fotos img");
    if (!foto) return;
    e.preventDefault();
    abrir(foto.currentSrc || foto.src, foto.alt);
  });
})();
