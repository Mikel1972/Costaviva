// assets/js/dispositivos.js
//
// Límite de dispositivos por cuenta (2026-11-09, Mikel: "podría comprar uno y
// compartirlo entre 3 o 4"; "Ok" a 2 dispositivos). Cada navegador o app en
// el que se entra es una sesión de Supabase Auth. Al abrir la app,
// functions/dispositivos.js devuelve las sesiones de la cuenta usadas en los
// últimos 14 días; con más de LIMITE, una ventana pide cerrar una (la más
// antigua, con un toque) o salir de aquí. La sesión cerrada tendrá que volver
// a entrar con la contraseña. Los administradores no tienen límite.
//
// Puro arriba (lo usan functions/dispositivos.js y los tests); la ventana,
// abajo, solo en el navegador.

export const LIMITE_DISPOSITIVOS = 2;

// "iPhone · Safari", "Android · Chrome", "Windows · Edge", "Mac · Firefox"...
export function nombreDispositivo(ua = "") {
  const u = String(ua);
  const so = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android"
    : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "Mac" : /CrOS/.test(u) ? "Chromebook"
    : /Linux/.test(u) ? "Linux" : null;
  const nav = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(u) ? "Firefox" : /CriOS|Chrome\//.test(u) ? "Chrome"
    : /Safari\//.test(u) ? "Safari" : /iPhone|iPad/.test(u) ? "app" : null;
  return [so, nav].filter(Boolean).join(" · ") || "?";
}

// sesiones: [{ id, user_agent, creada, ultima }] (más reciente primero).
// - La misma app o navegador (user_agent idéntico) con varias sesiones es el
//   mismo dispositivo que ha vuelto a entrar: se cierran las viejas solas.
// - Con más de `limite` dispositivos distintos, hay exceso.
// Devuelve { cerrarSolas: [id], dispositivos: [{ id, nombre, ultima, actual }],
//            exceso, actualCerrada }.
export function decidir(sesiones = [], actualId, limite = LIMITE_DISPOSITIVOS) {
  const vistas = new Map();
  const cerrarSolas = [];
  const orden = [...sesiones].sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));
  for (const s of orden) {
    const clave = s.user_agent || `sin-ua-${s.id}`;
    const previa = vistas.get(clave);
    if (!previa) { vistas.set(clave, s); continue; }
    // Se queda la actual si es una de las dos; si no, la más reciente.
    if (s.id === actualId) { cerrarSolas.push(previa.id); vistas.set(clave, s); } else cerrarSolas.push(s.id);
  }
  const dispositivos = [...vistas.values()].map((s) => ({ id: s.id, nombre: nombreDispositivo(s.user_agent), ultima: s.ultima, actual: s.id === actualId }));
  const actualCerrada = !sesiones.some((s) => s.id === actualId);
  return { cerrarSolas, dispositivos, exceso: limite != null && dispositivos.length > limite, actualCerrada };
}

// ---------------------------------------------------------------------------
// Ventana (navegador)
// ---------------------------------------------------------------------------
const t = (k, vars, d) => {
  const I = typeof window !== "undefined" ? window.I18n : null;
  const v = I && I.t(k, vars);
  if (v && v !== k) return v;
  return String(d).replace(/\{(\w+)\}/g, (_, n) => vars?.[n] ?? "");
};

async function llamar(supabase, cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;
  const r = await fetch("/dispositivos", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) return null;
  return r.json();
}

function hace(fecha) {
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 60) return t("disp.hace_min", { n: min }, "hace {n} min");
  const h = Math.round(min / 60);
  if (h < 48) return t("disp.hace_h", { n: h }, "hace {n} h");
  return t("disp.hace_d", { n: Math.round(h / 24) }, "hace {n} días");
}

function ventana(supabase, estado) {
  const css = document.createElement("style");
  css.textContent = `
    .disp-fondo { position: fixed; inset: 0; z-index: 4000; background: rgba(5,12,28,0.88); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .disp-caja { width: 100%; max-width: 420px; background: var(--superficie, #fff); color: var(--tinta, #0B1E3F); border-radius: 16px; padding: 20px; font: 15px/1.45 var(--f-texto, system-ui); }
    .disp-caja h2 { margin: 0 0 8px; font: 700 19px/1.25 var(--f-titulo, system-ui); }
    .disp-caja p { margin: 0 0 14px; }
    .disp-lista { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 8px; }
    .disp-lista li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(11,30,63,0.06); }
    .disp-lista small { display: block; opacity: 0.7; }
    .disp-caja button { border: 0; border-radius: 999px; padding: 10px 14px; font: 700 14px/1 var(--f-texto, system-ui); cursor: pointer; }
    .disp-cerrar { background: #0B1E3F; color: #fff; }
    .disp-principal { width: 100%; background: linear-gradient(90deg, #E8562A, #7B2FF7); color: #fff; padding: 14px; margin-bottom: 8px; }
    .disp-salir { width: 100%; background: transparent; color: inherit; text-decoration: underline; }
  `;
  document.head.appendChild(css);
  const fondo = document.createElement("div");
  fondo.className = "disp-fondo";
  fondo.setAttribute("role", "dialog");
  fondo.setAttribute("aria-modal", "true");
  document.body.appendChild(fondo);

  const pintar = (est) => {
    const otros = est.dispositivos.filter((d) => !d.actual);
    const masAntiguo = otros[otros.length - 1];
    fondo.innerHTML = `<div class="disp-caja">
      <h2>${t("disp.titulo", { n: est.limite }, "Tu cuenta se usa en más de {n} dispositivos")}</h2>
      <p>${t("disp.texto", { n: est.limite }, "Cada suscripción es para una persona, en {n} dispositivos como mucho. Para seguir aquí, cierra la sesión en otro.")}</p>
      <ul class="disp-lista">${est.dispositivos.map((d) => `<li><span>${d.nombre}<small>${d.actual ? t("disp.este", null, "Este dispositivo") : hace(d.ultima)}</small></span>${d.actual ? "" : `<button type="button" class="disp-cerrar" data-id="${d.id}">${t("disp.cerrar", null, "Cerrar ahí")}</button>`}</li>`).join("")}</ul>
      ${masAntiguo ? `<button type="button" class="disp-principal" data-id="${masAntiguo.id}">${t("disp.cerrar_antiguo", null, "Cerrar la sesión en el más antiguo")}</button>` : ""}
      <button type="button" class="disp-salir">${t("disp.salir", null, "Salir de este dispositivo")}</button>
    </div>`;
    fondo.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const r = await llamar(supabase, { accion: "cerrar", sesion: b.dataset.id }).catch(() => null);
      if (!r) { b.disabled = false; alert(t("disp.error", null, "No se ha podido cerrar. Inténtalo otra vez.")); return; }
      if (r.exceso) pintar(r); else { fondo.remove(); css.remove(); }
    }));
    fondo.querySelector(".disp-salir").addEventListener("click", async () => {
      await supabase.auth.signOut().catch(() => {});
      location.href = "/login";
    });
  };
  pintar(estado);
}

// Se llama en cada página con sesión. Nunca rompe la página: si algo falla,
// no hace nada (fail-open: un fallo de red no debe dejar fuera a quien paga).
export async function vigilarDispositivos(supabase) {
  if (typeof document === "undefined") return;
  try {
    const est = await llamar(supabase, { accion: "listar" });
    if (!est) return;
    if (est.actual_cerrada) {
      // La cerraron desde otro dispositivo: fuera, con aviso.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      alert(t("disp.cerrada", null, "Se ha cerrado la sesión de este dispositivo desde otro. Vuelve a entrar con tu contraseña."));
      location.href = "/login";
      return;
    }
    if (est.exceso) ventana(supabase, est);
  } catch (e) {
    console.warn("dispositivos:", e?.message);
  }
}
