// assets/js/guia.js
//
// Guía "Cómo funciona" (2026-11-09, Mikel: "al entrar por primera vez, una
// explicación con menús de una idea por pantalla y scroll lateral,
// preguntando primero si costa, embarcación o submarinismo. Debe estar
// disponible permanentemente en la pestaña de usuario").
//
// - Primera pantalla: ¿cómo pescas? La respuesta pone la modalidad de la app
//   (localStorage "va_modalidad", la de la píldora del mapa; en el mapa avisa
//   con el evento "guia-modalidad") y adapta el resto de pantallas.
// - Una idea por pantalla, deslizando de lado (scroll-snap) o con los botones.
// - Sale sola la primera vez que se abre el mapa en este navegador
//   (localStorage "cv-guia-vista"), después del pop-up de bienvenida si lo hay.
// - Siempre a mano en el menú 👤: botón #btnGuia ("📖 Cómo funciona").
// Sin on*= (CSP): todo con addEventListener.

const CLAVE_VISTA = "cv-guia-vista";
const MODALIDADES = ["costa", "embarcacion", "submarina"];

export function pantallasGuia(modalidad) {
  const m = MODALIDADES.includes(modalidad) ? modalidad : "costa";
  return [
    { id: "mapa", icono: "🗺️" },
    { id: "indice", icono: "🎯" },
    { id: `mod_${m}_1`, icono: { costa: "🌊", embarcacion: "🚤", submarina: "🤿" }[m] },
    { id: `mod_${m}_2`, icono: { costa: "🪨", embarcacion: "📍", submarina: "🚫" }[m] },
    { id: "capas", icono: "🛰️" },
    { id: "diario", icono: "📓" },
    { id: "aprende", icono: "🧠" },
    { id: "grupos", icono: "👥" },
    { id: "final", icono: "🎣" },
  ];
}

const t = (k, d) => {
  const I = typeof window !== "undefined" ? window.I18n : null;
  const v = I && I.t(k);
  return v && v !== k ? v : d;
};

function leer(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

let abierta = null;

function cerrar() {
  if (!abierta) return;
  escribir(CLAVE_VISTA, "1");
  abierta.remove();
  abierta = null;
  document.documentElement.style.overflow = "";
}

export function abrirGuia() {
  if (typeof document === "undefined" || abierta) return;
  const css = document.getElementById("guia-css") || Object.assign(document.createElement("style"), { id: "guia-css" });
  css.textContent = `
    .guia { position: fixed; inset: 0; z-index: 3500; background: linear-gradient(160deg, #0B1E3F, #12305f); color: #fff; display: flex; flex-direction: column; font-family: var(--f-texto, system-ui); }
    .guia-cab { display: flex; justify-content: flex-end; padding: max(12px, env(safe-area-inset-top)) 16px 0; }
    .guia-saltar { background: transparent; border: 0; color: rgba(255,255,255,0.75); font: 600 15px/1 var(--f-texto, system-ui); padding: 8px; cursor: pointer; }
    .guia-pista { flex: 1; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
    .guia-pista::-webkit-scrollbar { display: none; }
    .guia-pantalla { flex: 0 0 100%; scroll-snap-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 16px 24px; box-sizing: border-box; overflow-y: auto; }
    .guia-icono { font-size: 64px; line-height: 1; margin-bottom: 18px; }
    .guia-pantalla h2 { font: 700 clamp(22px, 6vw, 30px)/1.2 var(--f-titulo, system-ui); margin: 0 0 12px; max-width: 520px; }
    .guia-pantalla p { font-size: 17px; line-height: 1.5; color: rgba(255,255,255,0.85); margin: 0; max-width: 480px; }
    .guia-opciones { display: grid; gap: 12px; width: 100%; max-width: 360px; margin-top: 22px; }
    .guia-opciones button { display: flex; align-items: center; gap: 14px; text-align: left; border: 2px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #fff; border-radius: 16px; padding: 14px 16px; font: 700 17px/1.2 var(--f-texto, system-ui); cursor: pointer; }
    .guia-opciones button span { font-size: 28px; }
    .guia-opciones button[aria-pressed="true"] { border-color: #fff; background: rgba(255,255,255,0.2); }
    .guia-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px max(16px, env(safe-area-inset-bottom)); }
    .guia-puntos { display: flex; gap: 7px; }
    .guia-puntos i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); }
    .guia-puntos i.activo { background: #fff; width: 22px; border-radius: 4px; }
    .guia-siguiente { border: 0; border-radius: 999px; padding: 13px 22px; font: 700 16px/1 var(--f-texto, system-ui); color: #fff; background: linear-gradient(90deg, #E8562A, #7B2FF7); cursor: pointer; }
    .guia-siguiente:disabled { opacity: 0.4; cursor: default; }
  `;
  document.head.appendChild(css);

  let modalidad = MODALIDADES.includes(leer("va_modalidad")) ? leer("va_modalidad") : null;
  const raiz = document.createElement("div");
  raiz.className = "guia";
  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-modal", "true");
  raiz.setAttribute("aria-label", t("guia.titulo", "Cómo funciona Costaviva"));
  raiz.innerHTML = `
    <div class="guia-cab"><button type="button" class="guia-saltar">${t("guia.saltar", "Saltar")}</button></div>
    <div class="guia-pista" tabindex="0"></div>
    <div class="guia-pie"><div class="guia-puntos"></div><button type="button" class="guia-siguiente"></button></div>`;
  document.body.appendChild(raiz);
  document.documentElement.style.overflow = "hidden";
  abierta = raiz;
  const pista = raiz.querySelector(".guia-pista");
  const puntos = raiz.querySelector(".guia-puntos");
  const siguiente = raiz.querySelector(".guia-siguiente");

  const pregunta = () => `<section class="guia-pantalla">
      <div class="guia-icono">🎣</div>
      <h2>${t("guia.pregunta", "¿Cómo pescas?")}</h2>
      <p>${t("guia.pregunta_texto", "Así te enseñamos lo que te sirve. Puedes cambiarlo cuando quieras en la píldora de arriba a la izquierda del mapa.")}</p>
      <div class="guia-opciones">
        ${MODALIDADES.map((m) => `<button type="button" data-modalidad="${m}" aria-pressed="${m === modalidad}"><span>${{ costa: "🪨", embarcacion: "🚤", submarina: "🤿" }[m]}</span>${t(`guia.op_${m}`, m)}</button>`).join("")}
      </div>
    </section>`;

  const pintar = () => {
    const resto = modalidad ? pantallasGuia(modalidad) : [];
    pista.innerHTML = pregunta() + resto.map((p) => `<section class="guia-pantalla">
        <div class="guia-icono">${p.icono}</div>
        <h2>${t(`guia.${p.id}.titulo`, p.id)}</h2>
        <p>${t(`guia.${p.id}.texto`, "")}</p>
      </section>`).join("");
    pista.querySelectorAll("[data-modalidad]").forEach((b) => b.addEventListener("click", () => {
      modalidad = b.dataset.modalidad;
      escribir("va_modalidad", modalidad);
      document.documentElement.dataset.modalidad = modalidad;
      document.dispatchEvent(new CustomEvent("guia-modalidad", { detail: { modalidad } }));
      pintar();
      ir(1);
    }));
    actualizar();
  };

  const total = () => pista.children.length;
  const actual = () => Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
  const ir = (i) => pista.scrollTo({ left: Math.max(0, Math.min(total() - 1, i)) * pista.clientWidth, behavior: "smooth" });
  function actualizar() {
    const i = actual();
    puntos.innerHTML = Array.from({ length: total() }, (_, k) => `<i class="${k === i ? "activo" : ""}"></i>`).join("");
    const ultima = i >= total() - 1 && modalidad;
    siguiente.textContent = ultima ? t("guia.terminar", "¡A pescar!") : t("guia.siguiente", "Siguiente");
    siguiente.disabled = !modalidad && i === 0;
  }
  let reloj = null;
  pista.addEventListener("scroll", () => { clearTimeout(reloj); reloj = setTimeout(actualizar, 60); });
  siguiente.addEventListener("click", () => {
    if (actual() >= total() - 1) cerrar(); else ir(actual() + 1);
  });
  raiz.querySelector(".guia-saltar").addEventListener("click", cerrar);
  raiz.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowRight") ir(actual() + 1);
    else if (e.key === "ArrowLeft") ir(actual() - 1);
  });
  pintar();
  siguiente.focus();
}

if (typeof document !== "undefined") {
  window.abrirGuia = abrirGuia;
  // Menú 👤 > «Cómo funciona», en todas las páginas con sesión.
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("#btnGuia")) {
      document.getElementById("cuentaMenuDropdown")?.classList.remove("visible", "abierto");
      abrirGuia();
    }
  });
  // Primera vez en el mapa: después de la pantalla de inicio y del pop-up de
  // bienvenida, si lo hay.
  const enMapa = ["/", "/index", "/index.html"].includes(location.pathname);
  if (enMapa && !leer(CLAVE_VISTA)) {
    setTimeout(function intentar() {
      const bienvenida = document.getElementById("modalBienvenida");
      const inicio = document.getElementById("comprobandoAcceso");
      if (inicio || bienvenida?.classList.contains("visible")) { setTimeout(intentar, 800); return; }
      if (!leer(CLAVE_VISTA)) abrirGuia();
    }, 1500);
  }
}
