// assets/js/zoom-foto.js
// Zoom y desplazamiento de la foto (o vídeo) ampliada de la cámara
// (2026-10-12, Mikel: "revisa que pueda mover la foto una vez ampliada").
// Antes se ampliaba con transform: scale(2.2) dentro de un contenedor con
// scroll centrado con flex: lo que sobresalía por la izquierda y por arriba
// no se podía alcanzar, y en el móvil arrastrar casi no movía nada.
//
// Ahora un único transform translate(tx, ty) scale(s) con origen en el
// centro de la imagen:
//   - tocar/clic: amplía ZOOM_TOQUE veces en ese punto; otra vez, vuelve a 1;
//   - arrastrar (dedo o ratón): mueve la imagen ampliada;
//   - pellizcar (dos dedos) y rueda del ratón: acercar y alejar (1 a ZOOM_MAX);
//   - nunca deja la imagen fuera: el desplazamiento se limita a lo que
//     sobresale de la pantalla (limitar).
// Lo puro (limitar, desplazamientoParaFijar) se prueba en
// test/zoom-foto.test.js; montarZoom engancha los eventos (sin on*=, CSP).

export const ZOOM_TOQUE = 2.5;
export const ZOOM_MAX = 5;
const UMBRAL_ARRASTRE_PX = 6;

// Desplazamiento máximo para que la imagen (ancho w, alto h, a escala s,
// centrada en una vista de W x H) no deje huecos: cada eje entre
// -(w*s - W)/2 y +(w*s - W)/2, o 0 si la imagen ampliada cabe.
export function limitar(tx, ty, s, w, h, W, H) {
  const mx = Math.max(0, (w * s - W) / 2);
  const my = Math.max(0, (h * s - H) / 2);
  const c = (v, m) => Math.min(m, Math.max(-m, v));
  return [c(tx, mx) + 0, c(ty, my) + 0]; // + 0: sin -0
}

// Con origen en el centro c, un punto p de la pantalla va a c + (p - c)*s + t.
// Para que el punto p siga bajo el dedo al pasar de escala s0 (con t0) a s1:
//   t1 = (p - c) - (p - c - t0) * s1 / s0
export function desplazamientoParaFijar(p, c, t0, s0, s1) {
  return (p - c) - (p - c - t0) * (s1 / s0);
}

// Engancha el zoom a `media` (img o video) dentro de `vista` (el contenedor a
// pantalla completa). Devuelve { reiniciar, desmontar }: desmontar quita
// todos los eventos (el vídeo vuelve a su ficha al cerrar). `alClicFuera` se
// llama al pulsar el fondo (para cerrar).
export function montarZoom(vista, media, { alClicFuera } = {}) {
  let s = 1, tx = 0, ty = 0;
  const ctl = new AbortController();
  const op = { signal: ctl.signal };
  const punteros = new Map();
  let inicio = null;      // { x, y, tx, ty } del primer dedo
  let pellizco = null;    // { dist, s, mx, my, tx, ty }
  let movido = false;

  media.style.touchAction = "none";
  media.style.transformOrigin = "50% 50%";
  media.style.cursor = "zoom-in";
  media.draggable = false;

  function medidas() {
    const r = vista.getBoundingClientRect();
    return { W: r.width, H: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: media.offsetWidth, h: media.offsetHeight };
  }
  function aplicar(animar) {
    const m = medidas();
    [tx, ty] = limitar(tx, ty, s, m.w, m.h, m.W, m.H);
    media.style.transition = animar ? "transform 0.15s ease-out" : "none";
    media.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    media.style.cursor = s > 1 ? "grab" : "zoom-in";
  }
  function escalarEn(px, py, s1) {
    const m = medidas();
    s1 = Math.min(ZOOM_MAX, Math.max(1, s1));
    tx = desplazamientoParaFijar(px, m.cx, tx, s, s1);
    ty = desplazamientoParaFijar(py, m.cy, ty, s, s1);
    s = s1;
    if (s === 1) { tx = 0; ty = 0; }
  }
  function reiniciar() { s = 1; tx = 0; ty = 0; aplicar(false); }

  media.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    media.setPointerCapture?.(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      inicio = { x: e.clientX, y: e.clientY, tx, ty };
      movido = false;
    } else if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pellizco = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      movido = true;
    }
  }, op);
  media.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size >= 2 && pellizco) {
      const [a, b] = [...punteros.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      escalarEn(pellizco.mx, pellizco.my, pellizco.s * (dist / pellizco.dist));
      aplicar(false);
      return;
    }
    if (!inicio) return;
    const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
    if (!movido && Math.hypot(dx, dy) < UMBRAL_ARRASTRE_PX) return;
    movido = true;
    if (s > 1) {
      tx = inicio.tx + dx;
      ty = inicio.ty + dy;
      media.style.cursor = "grabbing";
      aplicar(false);
    }
  }, op);
  const soltar = (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (punteros.size === 1) {
      const [p] = [...punteros.values()];
      inicio = { x: p.x, y: p.y, tx, ty };
      return;
    }
    if (punteros.size === 0) {
      // Un toque sin arrastre: amplía en ese punto o vuelve a 1.
      if (!movido && e.type === "pointerup") {
        if (s > 1) { s = 1; tx = 0; ty = 0; } else escalarEn(e.clientX, e.clientY, ZOOM_TOQUE);
        aplicar(true);
      } else aplicar(false);
      inicio = null;
    }
  };
  media.addEventListener("pointerup", soltar, op);
  media.addEventListener("pointercancel", soltar, op);
  // El clic del navegador tras un toque no debe cerrar ni hacer nada más.
  media.addEventListener("click", (e) => e.stopPropagation(), op);
  vista.addEventListener("wheel", (e) => {
    e.preventDefault();
    escalarEn(e.clientX, e.clientY, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    aplicar(false);
  }, { passive: false, signal: ctl.signal });
  vista.addEventListener("click", (e) => {
    if (e.target === vista && alClicFuera) alClicFuera();
  }, op);
  aplicar(false);
  return { reiniciar, desmontar: () => ctl.abort() };
}
