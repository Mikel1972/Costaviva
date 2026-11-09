// assets/js/guia-botones.js
//
// "Qué es cada botón" (2026-11-09, Mikel: "que explique para qué es cada
// botón, sobre la pantalla en sí: poniendo el cursor sobre cada elemento,
// que explique lo que es. Bonito, sencillo").
//
// Sobre el mapa de verdad (no una foto que se quedaría vieja): un punto «?»
// junto a cada botón visible. Con el ratón encima, o tocándolo en el móvil,
// sale un globo con el nombre y para qué sirve. En el móvil, «Ver las capas»
// abre el ☰ y pone puntos también en sus botones. Se abre desde la última
// pantalla de la guía (guia.js) o con /?botones=1.

export const BOTONES = [
  { sel: "#modalidadPildora", id: "modalidad" },
  { sel: ".leaflet-control-zoom", id: "zoom" },
  { sel: "#selectorRegionBoton", id: "region" },
  { sel: "#boton3d", id: "tresd" },
  { sel: "[data-gfw-chip]", id: "gfw" },
  { sel: "#toggleLeyenda", id: "leyenda" },
  { sel: "#menuCapas", id: "capas" },
  { sel: "#toggleSpots", id: "spots" },
  { sel: "#toggleAnadirUbicacion", id: "anadir" },
  { sel: "#toggleRayos", id: "rayos" },
  { sel: "#toggleLuna", id: "luna" },
  { sel: "#toggleFondo", id: "fondo" },
  { sel: "#toggleNubes", id: "lluvia" },
  { sel: "#toggleRios", id: "rios" },
  { sel: "#toggleBoyas", id: "boyas" },
  { sel: "#toggleEstaciones", id: "estaciones" },
  { sel: "#toggleViento", id: "viento" },
  { sel: "#toggleClorofila", id: "clorofila" },
  { sel: "#toggleTempAgua", id: "tempagua" },
  { sel: "#toggleFrentes", id: "frentes" },
  { sel: "#toggleCorriente", id: "corriente" },
  { sel: "#btnCuentaMenu", id: "cuenta" },
  { sel: '.tabs-nav a[href="/"]', id: "tab_mapa" },
  { sel: '.tabs-nav a[href="/diario.html"]', id: "tab_diario" },
  { sel: '.tabs-nav a[href="/alarma.html"]', id: "tab_alarma" },
  { sel: '.tabs-nav a[href="/grupos.html"]', id: "tab_grupos" },
];

const t = (k, d = "") => {
  const I = typeof window !== "undefined" ? window.I18n : null;
  const v = I && I.t(k);
  return v && v !== k ? v : d;
};

const visible = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
};

// Dónde va el globo: debajo del punto si cabe; si no, encima. Dentro de la pantalla.
export function posicionGlobo(punto, globo, pantalla, margen = 10) {
  const izq = Math.min(Math.max(margen, punto.x - globo.w / 2), pantalla.w - globo.w - margen);
  const abajo = punto.y + 18 + globo.h + margen <= pantalla.h;
  const arriba = abajo ? punto.y + 18 : Math.max(margen, punto.y - 18 - globo.h);
  return { left: Math.round(izq), top: Math.round(arriba) };
}

let capa = null;

export function cerrarBotones() {
  if (!capa) return;
  capa.limpiar();
  capa = null;
}

export function abrirBotones() {
  if (typeof document === "undefined" || capa) return;
  if (!document.getElementById("guia-botones-css")) {
    const css = document.createElement("style");
    css.id = "guia-botones-css";
    css.textContent = `
      .gb-capa { position: fixed; inset: 0; z-index: 3400; pointer-events: none; }
      .gb-punto { z-index: 1; position: fixed; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; border: 0; padding: 0; pointer-events: auto; cursor: help;
        background: #fff; color: #7B2FF7; font: 800 14px/24px var(--f-texto, system-ui); text-align: center; box-shadow: 0 0 0 3px #7B2FF7, 0 4px 12px rgba(0,0,0,0.35); animation: gb-latido 1.8s ease-in-out infinite; }
      .gb-punto.activo { background: #7B2FF7; color: #fff; animation: none; }
      @keyframes gb-latido { 0%, 100% { box-shadow: 0 0 0 3px #7B2FF7, 0 0 0 0 rgba(123,47,247,0.5); } 50% { box-shadow: 0 0 0 3px #7B2FF7, 0 0 0 9px rgba(123,47,247,0); } }
      @media (prefers-reduced-motion: reduce) { .gb-punto { animation: none; } }
      .gb-globo { z-index: 3; position: fixed; max-width: min(280px, calc(100vw - 20px)); background: #fff; color: #0B1E3F; border-radius: 14px; padding: 12px 14px; pointer-events: none;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3); font: 14px/1.4 var(--f-texto, system-ui); }
      .gb-globo b { display: block; font: 700 15px/1.25 var(--f-titulo, system-ui); margin-bottom: 4px; }
      .gb-barra { z-index: 2; position: fixed; left: 50%; bottom: calc(68px + env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
        width: max-content; max-width: calc(100vw - 24px); background: #0B1E3F; color: #fff; border-radius: 999px; padding: 8px 8px 8px 16px; pointer-events: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35); font: 600 14px/1.3 var(--f-texto, system-ui); }
      @media (max-width: 720px) { .gb-barra { bottom: calc(124px + env(safe-area-inset-bottom)); font-size: 13px; } }
      .gb-barra button { border: 0; border-radius: 999px; padding: 8px 14px; font: 700 14px/1 var(--f-texto, system-ui); cursor: pointer; }
      .gb-cerrar { background: linear-gradient(90deg, #E8562A, #7B2FF7); color: #fff; }
      .gb-capas { background: rgba(255,255,255,0.15); color: #fff; }
    `;
    document.head.appendChild(css);
  }
  const raiz = document.createElement("div");
  raiz.className = "gb-capa";
  raiz.innerHTML = `<div class="gb-barra" role="status"><span>${t("guia.b.ayuda", "Toca o pasa el ratón por los puntos ? para ver qué es cada botón")}</span>
    <button type="button" class="gb-capas" hidden>${t("guia.b.ver_capas", "Ver las capas")}</button>
    <button type="button" class="gb-cerrar">${t("guia.b.cerrar", "Entendido")}</button></div>`;
  document.body.appendChild(raiz);
  const globo = document.createElement("div");
  globo.className = "gb-globo";
  globo.hidden = true;
  globo.setAttribute("role", "tooltip");
  raiz.appendChild(globo);
  let puntos = [];
  let activo = null;

  const mostrar = (p) => {
    activo?.btn.classList.remove("activo");
    activo = p;
    p.btn.classList.add("activo");
    globo.innerHTML = `<b>${t(`guia.b.${p.id}.titulo`, p.id)}</b>${t(`guia.b.${p.id}.texto`)}`;
    globo.hidden = false;
    const r = p.btn.getBoundingClientRect();
    const pos = posicionGlobo({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, { w: globo.offsetWidth, h: globo.offsetHeight }, { w: innerWidth, h: innerHeight });
    globo.style.left = `${pos.left}px`;
    globo.style.top = `${pos.top}px`;
  };
  const ocultar = () => { activo?.btn.classList.remove("activo"); activo = null; globo.hidden = true; };

  const colocar = () => {
    for (const p of puntos) {
      const r = p.el.getBoundingClientRect();
      // Esquina de arriba a la derecha del botón, sin salirse de la pantalla.
      p.btn.style.left = `${Math.min(innerWidth - 14, Math.max(14, r.right - 2))}px`;
      p.btn.style.top = `${Math.min(innerHeight - 14, Math.max(14, r.top + 2))}px`;
    }
    if (activo) mostrar(activo);
  };
  const escanear = () => {
    puntos.forEach((p) => p.btn.remove());
    puntos = [];
    ocultar();
    for (const b of BOTONES) {
      const el = document.querySelector(b.sel);
      if (!visible(el)) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-punto";
      btn.textContent = "?";
      btn.setAttribute("aria-label", t(`guia.b.${b.id}.titulo`, b.id));
      const p = { ...b, el, btn };
      btn.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") mostrar(p); });
      btn.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") ocultar(); });
      // Tocar siempre enseña (no alterna): con ratón, el hover ya lo había abierto.
      btn.addEventListener("click", (e) => { e.stopPropagation(); mostrar(p); });
      btn.addEventListener("focus", () => mostrar(p));
      raiz.appendChild(btn);
      puntos.push(p);
    }
    colocar();
    const menu = document.getElementById("menuCapas");
    raiz.querySelector(".gb-capas").hidden = !(visible(menu) && menu.getAttribute("aria-expanded") === "false");
  };

  raiz.querySelector(".gb-cerrar").addEventListener("click", cerrarBotones);
  raiz.querySelector(".gb-capas").addEventListener("click", () => {
    document.getElementById("menuCapas")?.click();
    setTimeout(escanear, 350);
  });
  const tecla = (e) => { if (e.key === "Escape") cerrarBotones(); };
  const fuera = (e) => { if (!e.target.closest?.(".gb-punto, .gb-barra")) ocultar(); };
  addEventListener("resize", colocar);
  addEventListener("keydown", tecla);
  document.addEventListener("pointerdown", fuera, true);
  capa = {
    limpiar() {
      removeEventListener("resize", colocar);
      removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera, true);
      raiz.remove();
    },
  };
  escanear();
}

if (typeof document !== "undefined") {
  window.abrirBotones = abrirBotones;
  // /?botones=1: desde la guía abierta en otra página.
  if (new URLSearchParams(location.search).get("botones") === "1") {
    history.replaceState(null, "", location.pathname);
    const esperar = () => (document.getElementById("comprobandoAcceso") || !document.querySelector("#map.leaflet-container") ? setTimeout(esperar, 500) : setTimeout(abrirBotones, 600));
    esperar();
  }
}
