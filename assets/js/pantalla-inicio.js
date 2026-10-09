// Pantalla de inicio (#comprobandoAcceso, la foto de la rompiente).
// Mikel (2026-10-09): "dale 2 seg más". La primera vez que se abre la app
// en la sesión, la pantalla se queda 2 s más después de comprobar el
// acceso y se funde; al cambiar de pestaña (Mapa, Diario...) se quita en
// cuanto está lista, para no hacer esperar en cada página.
(function () {
  const EXTRA_MS = 2000;
  const CLAVE = "cv-inicio-visto";
  function primeraVez() {
    try {
      if (sessionStorage.getItem(CLAVE)) return false;
      sessionStorage.setItem(CLAVE, "1");
    } catch {
      // Sin sessionStorage (modo privado): se trata como primera vez.
    }
    return true;
  }
  window.quitarPantallaInicio = function () {
    const el = document.getElementById("comprobandoAcceso");
    if (!el) return;
    if (!primeraVez()) { el.remove(); return; }
    setTimeout(() => {
      el.classList.add("pantalla-inicio--saliendo");
      setTimeout(() => el.remove(), 400);
    }, EXTRA_MS);
  };
})();
