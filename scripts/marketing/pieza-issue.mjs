// scripts/marketing/pieza-issue.mjs
// La pieza (post o reel) viaja dentro de su Issue de revisión como un bloque
// JSON invisible, para que el workflow manual "Publicar post de Instagram"
// la publique en Instagram y/o Facebook con solo el número del Issue
// (2026-10-09). Lógica pura: test/calendario-marketing.test.js.

const INICIO = "<!-- PIEZA ";
const FIN = " -->";

export function incrustarPieza(pieza) {
  // "--" no puede ir dentro de un comentario HTML: se escapa en el JSON.
  return `${INICIO}${JSON.stringify(pieza).replace(/--/g, "-\\u002d")}${FIN}`;
}

export function extraerPieza(cuerpo) {
  const texto = String(cuerpo || "");
  const i = texto.lastIndexOf(INICIO);
  if (i < 0) return null;
  const j = texto.indexOf(FIN, i + INICIO.length);
  if (j < 0) return null;
  try {
    const p = JSON.parse(texto.slice(i + INICIO.length, j));
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

// Input "redes" del workflow -> lista. Por defecto, las dos.
export function redesPedidas(texto) {
  const t = String(texto || "").toLowerCase();
  if (t.includes("solo instagram")) return ["instagram"];
  if (t.includes("solo facebook")) return ["facebook"];
  return ["instagram", "facebook"];
}

// Errores de Meta: 190/OAuthException = token caducado (código de salida 3,
// el de siempre); 10/200/(#200)/permisos = falta un permiso (código 4).
export const SALIDA_TOKEN_CADUCADO = 3;
export const SALIDA_SIN_PERMISO = 4;
export function tipoDeError(datos) {
  const e = datos?.error;
  if (!e) return null;
  if (e.code === 190) return "token";
  if (e.code === 10 || e.code === 200 || (e.code >= 200 && e.code < 300) || /permission|permiso/i.test(e.message || "")) return "permiso";
  if (e.type === "OAuthException") return "token";
  return "otro";
}

// Texto del Issue de revisión (los dos textos, cuándo publicar, cómo).
export function cuerpoIssue({ pieza, previa, cuando, caduca, facebookListo }) {
  const esReel = !!pieza.esReel;
  return [
    `Pieza preparada para **${cuando}** (hora de España). Aún no se ha publicado nada en ninguna red.`,
    "",
    esReel ? `🎬 Vídeo: ${previa}` : `![vista previa](${previa})`,
    "",
    "**Texto para Instagram:**",
    "",
    "```",
    pieza.captionInstagram,
    "```",
    "",
    "**Texto para Facebook:**",
    "",
    "```",
    pieza.captionFacebook,
    "```",
    "",
    "---",
    "",
    "### Para publicarla",
    "",
    "Actions → **Publicar post de Instagram** → *Run workflow* → `issue_number`: el número de este Issue. En `redes` elige las dos (por defecto), solo Instagram o solo Facebook.",
    "",
    pieza.creationId
      ? `- Instagram: borrador listo (contenedor \`${pieza.creationId}\`), **caduca ${caduca}**. Si caduca, vuelve a lanzar el robot para esa fecha.`
      : "- Instagram: no se pudo crear el borrador (mira el log del robot).",
    facebookListo
      ? "- Facebook: se publica directamente al aprobar (Facebook no guarda borradores por la API); nada sale antes."
      : "- Facebook: **sin configurar** (falta la variable META_PAGE_ID o el permiso pages_manage_posts del token; ver CLAUDE.md, \"Facebook\").",
    "",
    "Si no la apruebas, no hagas nada: no se publica sola.",
    "",
    incrustarPieza(pieza),
  ].join("\n");
}
