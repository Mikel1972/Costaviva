// functions/_lib/seo/paginas-nz.js — páginas de Nueva Zelanda en español y
// portugués (2026-11-20, Mikel: «todo lo que hagamos debe estar en todos los
// idiomas… asegúrate que todas son espejo»). Mismas páginas que las inglesas
// de paginas-en.js, con las rutas de cada idioma:
//
//   /spots/<nz-…>, /spots/region/<zona>      (pt: /pt/spots/…)
//   /mareas/<nz-…>, /mareas/region/<zona>    (pt: /pt/mareas/…)
//   /especies/<nz-…>                          (pt: /pt/especies/…)
//
// Mismas reglas que las inglesas: ninguna cifra de normativa (solo enlaces a
// MPI), aviso de rāhui, atribución literal de LINZ (en inglés, es la fórmula
// que exige su licencia) y nada interno. Los nombres propios (zonas, áreas de
// MPI, puertos) se quedan como en Nueva Zelanda.
import { preguntasSpotsRegion, preguntasMareasRegion, faqHtml, faqLd } from "./faq-region.js";
import { DOMINIO, esc, documento, migasHtml, migasJsonLd, cta, ctaPt, ctaArriba, imagenOg } from "./base.js";
import { bloqueProfundidadNZ, bloqueCamarasNZ, bloqueCambiosTemporadaNZ } from "./extra-nz.js";
import { ZONAS_NZ, zonaDeSpotNZ } from "../nz/zonas-nz.js";
import { AREAS_MPI, URL_APP_MPI, URL_REGLAS_MPI, normativaArea } from "../../../assets/js/normativa-nz.js";
import { ATRIBUCION_LINZ, AVISO_LINZ } from "../nz/mareas-linz.js";
import { ATRIBUCION_DOC, URL_DOC_RESERVAS, sinPesca } from "../nz/reservas-doc.js";
import { slugEspecie } from "./datos.js";
import { ATRIBUCION_LINZ_HTML, spotsNZ, especiesNZ, cercanosNZ, ZONA_NZ } from "./paginas-en.js";

const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
const MODALIDADES = ["costa", "embarcacion", "submarina"];
export const ALTERNOS_NZ = ["es", "en", "pt"];

const L = {
  es: {
    lang: "es", locale: "es-ES", y: "y", prefijo: "",
    meses: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    todoAno: "Todo el año",
    modalidad: { costa: "Desde costa", embarcacion: "Embarcación", submarina: "Pesca submarina" },
    modalidadCorta: { costa: "desde costa", embarcacion: "desde embarcación", submarina: "en pesca submarina" },
    rahui: "Los rāhui (cierres temporales que ponen los tangata whenua) pueden aplicarse en cualquier momento y no están en ningún registro: respeta los carteles y avisos locales.",
    nz: "Nueva Zelanda",
    pie: () => `Meteorología marina: Open-Meteo (CC BY 4.0). Mareas: ${ATRIBUCION_LINZ_HTML} ${esc(AVISO_LINZ)} ${esc(ATRIBUCION_DOC)}. Datos del mapa © colaboradores de OpenStreetMap (ODbL). La normativa cambia: consulta siempre las <a href="${esc(URL_REGLAS_MPI)}" rel="noopener" target="_blank">reglas oficiales de MPI</a>.`,
    normas: { titulo: "Normativa de pesca", txt: "Las tallas mínimas, los cupos diarios y las zonas cerradas cambian. Consulta las reglas oficiales antes de salir:", area: (a) => `Reglas de MPI: área ${a}`, general: "Reglas de pesca recreativa de MPI", app: "App NZ Fishing Rules (MPI, gratis)" },
    reservas: { aqui: "(en este spot)", km: (k) => `(a unos ${k} km)`, cerrada: "Zona sin pesca cerca", fondo: "Zona de protección del fondo cerca",
      cerradaTxt: "Dentro de una reserva marina o de una zona de alta protección del golfo de Hauraki no se puede pescar ni coger ningún ser vivo.",
      fondoTxt: "En una zona de protección del fondo se permiten la pesca con caña, la pesca submarina y la recolección a mano; no el arrastre de fondo, el dragado ni la red de cerco danesa.",
      limite: (url) => `Comprueba el límite exacto en la <a href="${url}" rel="noopener" target="_blank">web del Department of Conservation</a> antes de pescar.`, simplificado: "Contorno simplificado, no es un límite exacto." },
    marea: { manana: "mañana ", pleamar: "Pleamar", bajamar: "Bajamar", puerto: (n, km, sec) => `Puerto de marea: ${n} (${km} km${sec ? ", puerto secundario" : ""}). `, cero: "Alturas sobre el cero hidrográfico.", sube: "▲ subiendo", baja: "▼ bajando", pl: "pleamar", bj: "bajamar" },
    hoy: { titulo: "Condiciones de hoy", sinDatos: (url) => `Ahora mismo no tenemos los datos de hoy de este spot. Prueba dentro de unos minutos o mira las <a href="${url}">mareas</a>.`,
      olas: "Olas", viento: "Viento", marea: "Marea", agua: "Agua", desde: "del", pie: (url, n) => `La ventana hora a hora, las mejores horas para cada especie y las alarmas, en la app de Costaviva. Mareas completas: <a href="${url}">mareas de ${n}</a>.` },
    spot: {
      intro: (n, zona, area) => `${n} es uno de los spots de pesca de Nueva Zelanda que sigue Costaviva${zona ? `, en ${zona}` : ""}${area ? ` (área de pesca ${area} de MPI)` : ""}.`,
      modos: (l) => `Se pesca ${l}.`, temporada: (mes, l) => `En ${mes} es temporada de ${l}.`, linz: (p) => `Mareas de las predicciones de LINZ para ${p}.`,
      titulo: (n) => `Pesca en ${n} (Nueva Zelanda): especies, temporada, mareas y condiciones de hoy | Costaviva`,
      desc: (n, zona) => `Pesca en ${n}${zona ? ` (${zona})` : ""}, Nueva Zelanda: qué se pesca desde costa, desde embarcación y en submarina, temporada por meses, mareas de LINZ, olas y viento de hoy y enlaces a la normativa de MPI.`,
      migas: "Spots", h1: (n) => `Pesca en ${n}`, turismo: "Pesca recreativa", queSePesca: (n) => `Qué se pesca en ${n}`,
      notaEsp: (a, mes) => `Especies del área ${a} de MPI y su temporada. Destacadas: las de temporada en ${mes}.`,
      cta: (n) => `Pesca mejor en ${n}`, cercanos: "Spots cercanos", mareas: "mareas", todos: (z) => `Todos los spots de ${z} →`, imagenAlt: (n) => `Pesca en ${n} con Costaviva`,
    },
    tabla: { sin: "No hay especies registradas para este spot.", si: "sí", no: "no", especie: "Especie", temporada: "Temporada" },
    zona: {
      titulo: (z, n) => `Pesca en ${z} (Nueva Zelanda): ${n} spots, especies y temporada | Costaviva`,
      desc: (z, n, mes, l) => `Spots de pesca en ${z}, Nueva Zelanda (${n}) y especies de temporada en ${mes}: ${l}. Mareas de LINZ y condiciones de hoy.`,
      h1: (z) => `Pesca en ${z}`, intro: (n, z, url) => `${n} spots de pesca en ${z}. En cada uno: especies por modalidad y temporada, mareas y condiciones de hoy. Mareas de la zona: <a href="${url}">mareas de ${z}</a>.`,
      temporada: (mes) => `De temporada en ${mes}`, todaNz: "Toda Nueva Zelanda →",
      mareasTitulo: (z, n) => `Mareas hoy en ${z} (Nueva Zelanda): ${n} spots | Costaviva`, mareasDesc: (z, n) => `Mareas de hoy en ${z}, Nueva Zelanda: pleamares y bajamares de ${n} spots según las predicciones de LINZ, con olas y viento.`,
      mareasH1: (z) => `Mareas hoy en ${z}`, mareasIntro: (n, z, url) => `Mareas de ${n} spots de pesca en ${z}. Guía de pesca de la zona: <a href="${url}">pesca en ${z}</a>.`,
    },
    mareas: {
      titulo: (n) => `Mareas hoy en ${n} (Nueva Zelanda): pleamar, bajamar y olas | Costaviva`,
      desc: (n, r, ola, viento) => `Mareas de hoy en ${n}, Nueva Zelanda${r ? `: ${r}` : ""}${ola ? `; olas ${ola}` : ""}${viento ? `, viento ${viento}` : ""}. Predicciones de LINZ, gratis y sin cuenta.`,
      proxPl: "próxima pleamar", proxBj: "bajamar",
      migas: "Mareas", h1: (n) => `Mareas hoy en ${n}`, ahora: "Marea ahora", ahoraEtq: "Ahora", sigPl: "Próxima pleamar", sigBj: "Próxima bajamar",
      tabla: "Pleamares y bajamares hoy y mañana", dia: "Día", tipo: "Marea", hora: "Hora (NZ)", altura: "Altura", hoyD: "Hoy", mananaD: "Mañana", sinTabla: "Ahora mismo no hay horas de marea para este spot.",
      prev: "Olas y viento en las próximas horas", horaCol: "Hora", olas: "Olas", viento: "Viento", agua: "Agua", notaPrev: "Meteorología marina: Open-Meteo (CC BY 4.0). Previsión del modelo: en la orilla puede ser distinta.",
      cercanos: "Mareas en spots cercanos", todaZona: (z) => `Todas las mareas de ${z} →`, pescaEn: (n) => `Pesca en ${n}: especies, temporada y normativa →`, imagenAlt: (n) => `Mareas de ${n}`,
    },
    especie: {
      titulo: (n, mi) => `${n}${mi ? ` (${mi})` : ""}: dónde y cuándo pescarlo en Nueva Zelanda | Costaviva`,
      desc: (n, c) => `${n}${c ? ` (${c})` : ""} en Nueva Zelanda: temporada por área de pesca de MPI, cómo se pesca, hábitat y spots donde pescarlo. Tallas y cupos: MPI.`,
      migas: "Especies", intro: (n, mi, c, modos, ahora) => `${n}${mi ? ` (en maorí: ${mi})` : ""}${c ? `, ${c}` : ""}. ${modos}${ahora}`,
      modos: (l) => `Se pesca ${l}.`, ahora: (mes, l) => ` En ${mes} está de temporada en ${l}.`, maori: "maorí",
      temporada: "Temporada por área de pesca", area: "Área de MPI", mesesCol: "Meses", freza: "Freza", ahoraTxt: "ahora",
      normasT: "Tallas y cupos", normasTxt: "Las tallas mínimas, los cupos diarios y los cierres dependen del área y cambian con el tiempo. Costaviva no los copia: consulta MPI para cada área.", normasArea: (a) => `Reglas de MPI: ${a}`,
      comoSePesca: "Cómo se pesca", habitat: "Dónde vive", prof: (a, b, m) => `Profundidad habitual: ${a}–${b} m${m ? ` (hasta unos ${m} m)` : ""}.`, fuente: "Fuente: Fisheries New Zealand / MPI (CC BY 4.0).",
      cta: (n) => `¿Cuándo pica hoy ${n}?`, donde: (n) => `Dónde pescar ${n}`, todas: "Todas las especies →", imagenAlt: "Especies de pesca de Nueva Zelanda",
    },
    seccionNz: "Nueva Zelanda",
    rutaMareas: "mareas", rutaEspecies: "especies",
    cta: (x) => cta(x),
  },
  pt: {
    lang: "pt-PT", locale: "pt-PT", y: "e", prefijo: "/pt",
    meses: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
    todoAno: "Todo o ano",
    modalidad: { costa: "De terra", embarcacion: "Embarcação", submarina: "Pesca submarina" },
    modalidadCorta: { costa: "de terra", embarcacion: "de embarcação", submarina: "na pesca submarina" },
    rahui: "Os rāhui (encerramentos temporários decididos pelos tangata whenua) podem aplicar-se a qualquer momento e não constam de nenhum registo: respeite os avisos e a sinalização locais.",
    nz: "Nova Zelândia",
    pie: () => `Meteorologia marinha: Open-Meteo (CC BY 4.0). Marés: ${ATRIBUCION_LINZ_HTML} ${esc(AVISO_LINZ)} ${esc(ATRIBUCION_DOC)}. Dados do mapa © contribuidores do OpenStreetMap (ODbL). As regras de pesca mudam: consulte sempre as <a href="${esc(URL_REGLAS_MPI)}" rel="noopener" target="_blank">regras oficiais do MPI</a>.`,
    normas: { titulo: "Regras de pesca", txt: "Os tamanhos mínimos, os limites diários e as zonas fechadas mudam. Consulte as regras oficiais antes de sair:", area: (a) => `Regras do MPI: área ${a}`, general: "Regras de pesca lúdica do MPI", app: "App NZ Fishing Rules (MPI, grátis)" },
    reservas: { aqui: "(neste pesqueiro)", km: (k) => `(a cerca de ${k} km)`, cerrada: "Zona sem pesca próxima", fondo: "Zona de proteção do fundo próxima",
      cerradaTxt: "Dentro de uma reserva marinha ou de uma zona de alta proteção do golfo de Hauraki não se pode pescar nem apanhar nenhum ser vivo.",
      fondoTxt: "Numa zona de proteção do fundo são permitidas a pesca à linha, a pesca submarina e a apanha à mão; não o arrasto de fundo, a dragagem nem a rede de cerco dinamarquesa.",
      limite: (url) => `Confirme o limite exato no <a href="${url}" rel="noopener" target="_blank">site do Department of Conservation</a> antes de pescar.`, simplificado: "Contorno simplificado, não é um limite exato." },
    marea: { manana: "amanhã ", pleamar: "Preia-mar", bajamar: "Baixa-mar", puerto: (n, km, sec) => `Porto de maré: ${n} (${km} km${sec ? ", porto secundário" : ""}). `, cero: "Alturas acima do zero hidrográfico.", sube: "▲ a encher", baja: "▼ a vazar", pl: "preia-mar", bj: "baixa-mar" },
    hoy: { titulo: "Condições de hoje", sinDatos: (url) => `Neste momento não temos os dados de hoje deste pesqueiro. Tente dentro de alguns minutos ou veja as <a href="${url}">marés</a>.`,
      olas: "Ondas", viento: "Vento", marea: "Maré", agua: "Água", desde: "de", pie: (url, n) => `A janela hora a hora, as melhores horas para cada espécie e os alarmes, na app Costaviva. Marés completas: <a href="${url}">marés de ${n}</a>.` },
    spot: {
      intro: (n, zona, area) => `${n} é um dos pesqueiros da Nova Zelândia que a Costaviva acompanha${zona ? `, em ${zona}` : ""}${area ? ` (área de pesca ${area} do MPI)` : ""}.`,
      modos: (l) => `Pesca-se ${l}.`, temporada: (mes, l) => `Em ${mes} é época de ${l}.`, linz: (p) => `Marés das previsões da LINZ para ${p}.`,
      titulo: (n) => `Pesca em ${n} (Nova Zelândia): espécies, época, marés e condições de hoje | Costaviva`,
      desc: (n, zona) => `Pesca em ${n}${zona ? ` (${zona})` : ""}, Nova Zelândia: o que se pesca de terra, de embarcação e na pesca submarina, época por meses, marés da LINZ, ondas e vento de hoje e ligações às regras do MPI.`,
      migas: "Pesqueiros", h1: (n) => `Pesca em ${n}`, turismo: "Pesca lúdica", queSePesca: (n) => `O que se pesca em ${n}`,
      notaEsp: (a, mes) => `Espécies da área ${a} do MPI e a sua época. Em destaque: as da época em ${mes}.`,
      cta: (n) => `Pesque melhor em ${n}`, cercanos: "Pesqueiros próximos", mareas: "marés", todos: (z) => `Todos os pesqueiros de ${z} →`, imagenAlt: (n) => `Pesca em ${n} com a Costaviva`,
    },
    tabla: { sin: "Sem espécies registadas para este pesqueiro.", si: "sim", no: "não", especie: "Espécie", temporada: "Época" },
    zona: {
      titulo: (z, n) => `Pesca em ${z} (Nova Zelândia): ${n} pesqueiros, espécies e época | Costaviva`,
      desc: (z, n, mes, l) => `Pesqueiros em ${z}, Nova Zelândia (${n}) e espécies da época em ${mes}: ${l}. Marés da LINZ e condições de hoje.`,
      h1: (z) => `Pesca em ${z}`, intro: (n, z, url) => `${n} pesqueiros em ${z}. Em cada um: espécies por modalidade e época, marés e condições de hoje. Marés da zona: <a href="${url}">marés de ${z}</a>.`,
      temporada: (mes) => `Da época em ${mes}`, todaNz: "Toda a Nova Zelândia →",
      mareasTitulo: (z, n) => `Marés hoje em ${z} (Nova Zelândia): ${n} pesqueiros | Costaviva`, mareasDesc: (z, n) => `Marés de hoje em ${z}, Nova Zelândia: preia-mares e baixa-mares de ${n} pesqueiros segundo as previsões da LINZ, com ondas e vento.`,
      mareasH1: (z) => `Marés hoje em ${z}`, mareasIntro: (n, z, url) => `Marés de ${n} pesqueiros em ${z}. Guia de pesca da zona: <a href="${url}">pesca em ${z}</a>.`,
    },
    mareas: {
      titulo: (n) => `Marés hoje em ${n} (Nova Zelândia): preia-mar, baixa-mar e ondas | Costaviva`,
      desc: (n, r, ola, viento) => `Marés de hoje em ${n}, Nova Zelândia${r ? `: ${r}` : ""}${ola ? `; ondas ${ola}` : ""}${viento ? `, vento ${viento}` : ""}. Previsões da LINZ, grátis e sem conta.`,
      proxPl: "próxima preia-mar", proxBj: "baixa-mar",
      migas: "Marés", h1: (n) => `Marés hoje em ${n}`, ahora: "Maré agora", ahoraEtq: "Agora", sigPl: "Próxima preia-mar", sigBj: "Próxima baixa-mar",
      tabla: "Preia-mares e baixa-mares hoje e amanhã", dia: "Dia", tipo: "Maré", hora: "Hora (NZ)", altura: "Altura", hoyD: "Hoje", mananaD: "Amanhã", sinTabla: "Neste momento não há horas de maré para este pesqueiro.",
      prev: "Ondas e vento nas próximas horas", horaCol: "Hora", olas: "Ondas", viento: "Vento", agua: "Água", notaPrev: "Meteorologia marinha: Open-Meteo (CC BY 4.0). Previsão do modelo: junto à costa pode ser diferente.",
      cercanos: "Marés em pesqueiros próximos", todaZona: (z) => `Todas as marés de ${z} →`, pescaEn: (n) => `Pesca em ${n}: espécies, época e regras →`, imagenAlt: (n) => `Marés de ${n}`,
    },
    especie: {
      titulo: (n, mi) => `${n}${mi ? ` (${mi})` : ""}: onde e quando pescar na Nova Zelândia | Costaviva`,
      desc: (n, c) => `${n}${c ? ` (${c})` : ""} na Nova Zelândia: época por área de pesca do MPI, como se pesca, habitat e pesqueiros onde o pescar. Tamanhos e limites: MPI.`,
      migas: "Espécies", intro: (n, mi, c, modos, ahora) => `${n}${mi ? ` (em maori: ${mi})` : ""}${c ? `, ${c}` : ""}. ${modos}${ahora}`,
      modos: (l) => `Pesca-se ${l}.`, ahora: (mes, l) => ` Em ${mes} está na época em ${l}.`, maori: "maori",
      temporada: "Época por área de pesca", area: "Área do MPI", mesesCol: "Meses", freza: "Desova", ahoraTxt: "agora",
      normasT: "Tamanhos e limites", normasTxt: "Os tamanhos mínimos, os limites diários e os encerramentos dependem da área e mudam com o tempo. A Costaviva não os copia: consulte o MPI para cada área.", normasArea: (a) => `Regras do MPI: ${a}`,
      comoSePesca: "Como se pesca", habitat: "Onde vive", prof: (a, b, m) => `Profundidade habitual: ${a}–${b} m${m ? ` (até cerca de ${m} m)` : ""}.`, fuente: "Fonte: Fisheries New Zealand / MPI (CC BY 4.0).",
      cta: (n) => `Quando pica hoje: ${n}?`, donde: (n) => `Onde pescar: ${n}`, todas: "Todas as espécies →", imagenAlt: "Espécies de pesca da Nova Zelândia",
    },
    seccionNz: "Nova Zelândia",
    rutaMareas: "mareas", rutaEspecies: "especies",
    cta: (x) => ctaPt(x),
  },
};

export function crearPaginasNZ(idioma) {
  const T = L[idioma];
  if (!T) throw new Error(`idioma sin plantilla NZ: ${idioma}`);
  const p = (ruta) => `${T.prefijo}${ruta}`;
  const rSpot = (s) => p(`/spots/${s}`), rMarea = (s) => p(`/${T.rutaMareas}/${s}`), rEspecie = (s) => p(`/${T.rutaEspecies}/${s}`);
  const rZonaSpots = (z) => p(`/spots/region/${z}`), rZonaMareas = (z) => p(`/${T.rutaMareas}/region/${z}`);
  const MESES_CORTOS = T.meses.map((m) => m.slice(0, 3));
  const mesLargo = (m) => T.meses[m - 1];
  const lista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${T.y} ${xs[xs.length - 1]}`);
  // Texto del dato en el idioma: es = el campo base; pt = campo_pt (nunca otro idioma).
  const txt = (obj, campo) => {
    const v = idioma === "es" ? obj?.[campo] : obj?.[`${campo}_${idioma}`];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const nombreEsp = (e) => e?.nombres?.[idioma] || e?.nombres?.en || e?.id;
  const nombreCientifico = (e) => String(e?.cientifico || "").split(" (")[0].trim() || null;
  const kmTexto = (km) => String(km < 10 ? Math.round(km * 10) / 10 : Math.round(km)).replace(".", idioma === "pt" || idioma === "es" ? "," : ".");
  // Nombres de zona: propios de NZ, solo se traduce lo que no es nombre propio.
  const ZONA_TXT = { es: { "Waikato west coast": "Costa oeste de Waikato", "West Coast": "West Coast (costa oeste)" }, pt: { "Waikato west coast": "Costa oeste de Waikato", "West Coast": "West Coast (costa oeste)" } };
  const zonaT = (z) => (z ? { ...z, nombre: ZONA_TXT[idioma][z.nombre] || z.nombre.replace(/ & /g, ` ${T.y} `) } : null);
  // El pie de es/pt es el de España: las fuentes de NZ (LINZ con su fórmula
  // de licencia, DOC, MPI) van al final del cuerpo, en todas las páginas.
  const doc = (o) => documento({ ...o, cuerpo: `${o.cuerpo}\n<p class="nota fuentes-nz">${T.pie()}</p>`, idioma, alternos: ALTERNOS_NZ });

  function textoMeses(meses) {
    const set = [...new Set(meses || [])].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    if (!set.length) return "";
    if (set.length === 12) return T.todoAno;
    const tramos = [];
    for (const m of set) {
      const t = tramos[tramos.length - 1];
      if (t && t[1] === m - 1) t[1] = m;
      else tramos.push([m, m]);
    }
    if (tramos.length > 1 && tramos[0][0] === 1 && tramos[tramos.length - 1][1] === 12) tramos[0][0] = tramos.pop()[0];
    return tramos.map(([a, b]) => (a === b ? MESES_CORTOS[a - 1] : `${MESES_CORTOS[a - 1]}–${MESES_CORTOS[b - 1]}`)).join(", ");
  }

  function especiesDeSpot(datos, spot, mes) {
    const porModalidad = {};
    for (const m of MODALIDADES) {
      porModalidad[m] = especiesNZ(datos)
        .filter((e) => e.presencia?.[spot.region]?.meses?.length && e.modalidades?.[m]?.aplica === true)
        .map((e) => {
          const meses = e.presencia[spot.region].meses;
          return { id: e.id, slug: slugEspecie(e.id), nombre: nombreEsp(e), maori: e.nombres?.mi || null, emoji: e.emoji || "🐟", temporada: textoMeses(meses), ahora: meses.includes(mes), meses };
        })
        .sort((a, b) => (b.ahora - a.ahora) || a.nombre.localeCompare(b.nombre, T.locale));
    }
    return porModalidad;
  }

  function bloqueNormativa(region) {
    const n = normativaArea(region);
    return `<section class="tarjeta aviso" aria-labelledby="t-normas"><h2 id="t-normas">${T.normas.titulo}</h2>
<p>${T.normas.txt}</p>
<ul>${n ? `<li><a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(T.normas.area(n.area))}</a></li>` : `<li><a href="${esc(URL_REGLAS_MPI)}" rel="noopener" target="_blank">${T.normas.general}</a></li>`}
<li><a href="${esc(URL_APP_MPI)}" rel="noopener" target="_blank">${T.normas.app}</a></li></ul>
<p class="nota">${esc(T.rahui)}</p></section>`;
  }

  function bloqueReservas(reservas) {
    if (!reservas?.length) return "";
    const R = T.reservas;
    const li = (r) => `<li><strong>${esc(r.nombre)}</strong> ${r.km === 0 ? R.aqui : esc(R.km(kmTexto(r.km)))}</li>`;
    const cerradas = reservas.filter(sinPesca), fondo = reservas.filter((r) => !sinPesca(r));
    return `<section class="tarjeta aviso" aria-labelledby="t-reservas"><h2 id="t-reservas">${cerradas.length ? R.cerrada : R.fondo}</h2>
${cerradas.length ? `<ul>${cerradas.map(li).join("")}</ul><p>${R.cerradaTxt}</p>` : ""}
${fondo.length ? `<ul>${fondo.map(li).join("")}</ul><p>${R.fondoTxt}</p>` : ""}
<p>${R.limite(esc(URL_DOC_RESERVAS))}</p>
<p class="nota">${esc(ATRIBUCION_DOC)}. ${R.simplificado}</p></section>`;
  }

  const textoEvento = (e) => `${e.manana ? T.marea.manana : ""}${e.hora} (${e.altura} m)`;
  function notaLinz(puerto) {
    return `<p class="nota">${puerto ? esc(T.marea.puerto(puerto.nombre, String(puerto.km), puerto.metodo === "secundario")) : ""}${T.marea.cero} ${ATRIBUCION_LINZ_HTML} ${esc(AVISO_LINZ)}</p>`;
  }

  function condicionesHoy(spotPrev, spot) {
    const b = spotPrev?.bloques?.[0];
    const m = spotPrev?.marea;
    const H = T.hoy;
    if (!b && !m) return `<section class="tarjeta hoy" aria-labelledby="t-hoy"><h2 id="t-hoy">${H.titulo}</h2><p class="nota">${H.sinDatos(esc(rMarea(spot.slug)))}</p></section>`;
    const f = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
    const celda = (etq, val, det) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span>${det ? `<span class="dato-det">${esc(det)}</span>` : ""}</div>` : "");
    const ola = b?.altura ? `${f(b.altura[0])}–${f(b.altura[1])} m` : null;
    const olaDet = [b?.periodo ? `${b.periodo} s` : null, b?.dirOla ? `${H.desde} ${b.dirOla.split(" ")[0]}` : null].filter(Boolean).join(" · ");
    const marea = m?.altura != null ? `${f(m.altura)} m ${m.tendencia === "subiendo" ? T.marea.sube : m.tendencia === "bajando" ? T.marea.baja : ""}`.trim() : null;
    const mareaDet = (m?.proximas || []).slice(0, 2).map((e) => `${e.tipo === "pleamar" ? T.marea.pl : T.marea.bj} ${e.manana ? T.marea.manana : ""}${e.hora}`).join(" · ");
    const hora = spotPrev?.actualizado ? new Date(spotPrev.actualizado).toLocaleString(T.locale, { timeZone: ZONA_NZ, hour: "2-digit", minute: "2-digit" }) : null;
    return `<section class="tarjeta hoy" aria-labelledby="t-hoy">
<h2 id="t-hoy">${H.titulo}${hora ? ` <small>(${esc(hora)})</small>` : ""}</h2>
<div class="datos">${celda(H.olas, ola, olaDet)}${celda(H.viento, b?.viento != null ? `${b.viento} km/h` : null, b?.dirViento ? `${H.desde} ${b.dirViento}` : null)}${celda(H.marea, marea, mareaDet)}${celda(H.agua, b?.tempAgua != null ? `${f(b.tempAgua)} °C` : null, null)}</div>
${m ? notaLinz(m.puerto) : ""}
<p class="nota">${H.pie(esc(rMarea(spot.slug)), esc(spot.nombre))}</p>
</section>`;
  }

  function tablaEspecies(porModalidad) {
    const filas = new Map();
    for (const m of MODALIDADES) for (const e of porModalidad[m] || []) {
      if (!filas.has(e.id)) filas.set(e.id, { ...e, modos: new Set() });
      filas.get(e.id).modos.add(m);
    }
    const ls = [...filas.values()].sort((a, b) => ((b.ahora && b.meses.length < 12) - (a.ahora && a.meses.length < 12)) || a.nombre.localeCompare(b.nombre, T.locale));
    if (!ls.length) return `<p class="nota">${T.tabla.sin}</p>`;
    const marca = (si) => (si ? `<span aria-label="${T.tabla.si}">✓</span>` : `<span aria-label="${T.tabla.no}">–</span>`);
    return `<div class="tabla-env"><table class="tabla-especies"><thead><tr><th scope="col">${T.tabla.especie}</th><th scope="col">${T.tabla.temporada}</th>${MODALIDADES.map((m) => `<th scope="col">${esc(T.modalidad[m])}</th>`).join("")}</tr></thead><tbody>
${ls.map((e) => `<tr${e.ahora && e.meses.length < 12 ? ' class="ahora"' : ""}><th scope="row"><a href="${esc(rEspecie(e.slug))}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a>${e.maori ? ` <span class="nota">${esc(e.maori)}</span>` : ""}</th><td>${esc(e.temporada)}</td>${MODALIDADES.map((m) => `<td>${marca(e.modos.has(m))}</td>`).join("")}</tr>`).join("\n")}
</tbody></table></div>`;
  }

  function paginaSpot(spot, todos, d) {
    const { especiesDatos, spotPrev, reservas, profundidad, mes } = d;
    const S = T.spot;
    const zona = zonaT(zonaDeSpotNZ(spot));
    const porModalidad = especiesDeSpot(especiesDatos, spot, mes);
    const area = AREAS_MPI[spot.region]?.nombre;
    const partes = [S.intro(spot.nombre, zona?.nombre, area), S.modos(lista(spot.modalidades.map((m) => T.modalidadCorta[m]).filter(Boolean)))];
    const ahora = [...new Map(MODALIDADES.flatMap((m) => porModalidad[m]).filter((e) => e.ahora && e.meses.length < 12).map((e) => [e.id, e.nombre.toLowerCase()])).values()];
    if (ahora.length) partes.push(S.temporada(mesLargo(mes), lista(ahora.slice(0, 4))));
    if (spot.puerto_linz) partes.push(S.linz(spot.puerto_linz.nombre));
    const intro = partes.join(" ");
    const ruta = `/spots/${spot.slug}`;
    const titulo = S.titulo(spot.nombre);
    const descripcion = S.desc(spot.nombre, zona?.nombre);
    const migas = [{ nombre: S.migas, ruta: p("/spots") }, ...(zona ? [{ nombre: zona.nombre, ruta: rZonaSpots(zona.slug) }] : []), { nombre: spot.nombre, ruta: rSpot(spot.slug) }];
    const ld = [
      { "@context": "https://schema.org", "@type": ["Place", "TouristAttraction"], name: S.h1(spot.nombre), description: intro, url: `${DOMINIO}${rSpot(spot.slug)}`, inLanguage: T.lang,
        geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon }, touristType: S.turismo, containedInPlace: { "@type": "Place", name: zona ? `${zona.nombre}, ${T.nz}` : T.nz } },
      migasJsonLd(migas),
    ];
    const cercanos = cercanosNZ(todos, spot, 6);
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(S.h1(spot.nombre))}</h1>
<p class="intro">${esc(intro)}</p>
${condicionesHoy(spotPrev, spot)}
${ctaArriba(idioma, "spot")}
${bloqueReservas(reservas)}
<section aria-labelledby="t-especies"><h2 id="t-especies">${esc(S.queSePesca(spot.nombre))}</h2>
<p class="nota">${esc(S.notaEsp(area || "", mesLargo(mes)))}</p>
${tablaEspecies(porModalidad)}</section>
${bloqueProfundidadNZ(profundidad, spot.slug, idioma)}
${bloqueCamarasNZ(spot.slug, idioma)}
${bloqueNormativa(spot.region)}
${T.cta(S.cta(spot.nombre))}
<section aria-labelledby="t-cerca"><h2 id="t-cerca">${S.cercanos}</h2>
<ul class="cercanos">${cercanos.map((s) => `<li><a href="${esc(rSpot(s.slug))}">${esc(s.nombre)}</a> <span class="nota">${kmTexto(s.km)} km</span> · <a href="${esc(rMarea(s.slug))}">${S.mareas}</a></li>`).join("")}</ul>
${zona ? `<p><a href="${esc(rZonaSpots(zona.slug))}">${esc(S.todos(zona.nombre))}</a></p>` : ""}
</section>`;
    return { titulo, html: doc({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("spots"), imagenAlt: S.imagenAlt(spot.nombre) }) };
  }

  const listaSpots = (spots, ruta) => `<ul class="lista-spots">${spots.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale)).map((s) => `<li><a href="${esc(ruta(s.slug))}">${esc(s.nombre)}</a></li>`).join("")}</ul>`;

  function paginaZonaSpots(zonaNz, todos, especiesDatos, mes) {
    const zona = zonaT(zonaNz);
    const Z = T.zona;
    const del = spotsNZ(todos).filter((s) => s.zona === zona.zona);
    const ruta = `/spots/region/${zona.slug}`;
    const areas = new Set(del.map((s) => s.region));
    const deTemporada = especiesNZ(especiesDatos).filter((e) => [...areas].some((a) => e.presencia?.[a]?.meses?.includes(mes)))
      .map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEsp(e) })).sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const titulo = Z.titulo(zona.nombre, del.length);
    const descripcion = Z.desc(zona.nombre, del.length, mesLargo(mes), deTemporada.slice(0, 5).map((e) => e.nombre.toLowerCase()).join(", "));
    const migas = [{ nombre: T.spot.migas, ruta: p("/spots") }, { nombre: zona.nombre, ruta: rZonaSpots(zona.slug) }];
    const preguntas = preguntasSpotsRegion({ deTemporada, regionSlug: zona.slug, lugar: zona.nombre, mes: mesLargo(mes), idioma });
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${rZonaSpots(zona.slug)}`, inLanguage: T.lang, about: { "@type": "Place", name: `${zona.nombre}, ${T.nz}` } }, migasJsonLd(migas), ...(preguntas.length ? [faqLd(preguntas, T.lang)] : [])];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(Z.h1(zona.nombre))}</h1>
<p class="intro">${Z.intro(del.length, esc(zona.nombre), esc(rZonaMareas(zona.slug)))}</p>
${listaSpots(del, rSpot)}
<section aria-labelledby="t-temp"><h2 id="t-temp">${esc(Z.temporada(mesLargo(mes)))}</h2>
<ul class="chips">${deTemporada.map((e) => `<li><a href="${esc(rEspecie(e.slug))}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
${bloqueCambiosTemporadaNZ({ especies: especiesNZ(especiesDatos), areas, mes, mesTexto: mesLargo(mes), idioma, enlace: (e) => ({ href: rEspecie(slugEspecie(e.id)), nombre: nombreEsp(e) }) })}
${[...areas].map((a) => bloqueNormativa(a)).slice(0, 1).join("")}
${faqHtml(preguntas, idioma)}
${T.cta()}
<p><a href="${esc(p("/spots"))}">${Z.todaNz}</a></p>`;
    return { titulo, html: doc({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("spots"), imagenAlt: T.spot.imagenAlt(zona.nombre) }) };
  }

  function paginaMarea(spot, todos, d) {
    const { spotPrev, dias = [] } = d;
    const M = T.mareas;
    const m = spotPrev?.marea || null;
    const zona = zonaT(zonaDeSpotNZ(spot));
    const ruta = `/mareas/${spot.slug}`;
    const pleamar = m?.proximas?.find((e) => e.tipo === "pleamar");
    const bajamar = m?.proximas?.find((e) => e.tipo === "bajamar");
    const b = spotPrev?.bloques?.[0];
    const resumen = [pleamar && `${M.proxPl} ${textoEvento(pleamar)}`, bajamar && `${M.proxBj} ${textoEvento(bajamar)}`].filter(Boolean).join(", ");
    const titulo = M.titulo(spot.nombre);
    const descripcion = M.desc(spot.nombre, resumen, b?.altura ? `${b.altura[0]}–${b.altura[1]} m` : null, b?.viento != null ? `${b.viento} km/h${b.dirViento ? ` ${b.dirViento}` : ""}` : null);
    const migas = [{ nombre: M.migas, ruta: p(`/${T.rutaMareas}`) }, ...(zona ? [{ nombre: zona.nombre, ruta: rZonaMareas(zona.slug) }] : []), { nombre: spot.nombre, ruta: rMarea(spot.slug) }];
    const ld = [
      { "@context": "https://schema.org", "@type": "Place", name: spot.nombre, geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon }, url: `${DOMINIO}${rMarea(spot.slug)}` },
      { "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}${rMarea(spot.slug)}`, inLanguage: T.lang, isPartOf: { "@type": "WebSite", name: "Costaviva", url: `${DOMINIO}/` }, about: { "@type": "Place", name: spot.nombre } },
      migasJsonLd(migas),
    ];
    const tabla = dias.length
      ? `<div class="tabla-env"><table><thead><tr><th scope="col">${M.dia}</th><th scope="col">${M.tipo}</th><th scope="col">${M.hora}</th><th scope="col">${M.altura}</th></tr></thead><tbody>
${dias.map((e) => `<tr${e.pasada ? ' class="nota"' : ""}><td>${e.dia === "today" ? M.hoyD : M.mananaD}</td><td>${e.tipo === "pleamar" ? T.marea.pleamar : T.marea.bajamar}</td><td>${esc(e.hora)}</td><td>${e.altura} m</td></tr>`).join("")}
</tbody></table></div>`
      : `<p class="nota">${M.sinTabla}</p>`;
    const filas = (spotPrev?.bloques || []).map((x) => `<tr><td>${esc(x.hora)}</td><td>${x.altura?.[0]}–${x.altura?.[1]} m</td><td>${x.viento ?? "–"} km/h ${esc(x.dirViento ?? "")}</td><td>${x.tempAgua != null ? `${x.tempAgua} °C` : "–"}</td></tr>`).join("");
    const cercanos = cercanosNZ(todos, spot, 6);
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(M.h1(spot.nombre))}</h1>
${m ? `<section class="tarjeta hoy" aria-labelledby="t-ahora"><h2 id="t-ahora">${M.ahora}</h2>
<div class="datos"><div class="dato"><span class="dato-etq">${M.ahoraEtq}</span><span class="dato-val">${esc(String(m.altura))} m ${m.tendencia === "subiendo" ? T.marea.sube : m.tendencia === "bajando" ? T.marea.baja : ""}</span></div>
${pleamar ? `<div class="dato"><span class="dato-etq">${M.sigPl}</span><span class="dato-val">${esc(textoEvento(pleamar))}</span></div>` : ""}
${bajamar ? `<div class="dato"><span class="dato-etq">${M.sigBj}</span><span class="dato-val">${esc(textoEvento(bajamar))}</span></div>` : ""}</div></section>` : ""}
${ctaArriba(idioma, "marea")}
<section aria-labelledby="t-tabla"><h2 id="t-tabla">${M.tabla}</h2>
${tabla}
${notaLinz(m?.puerto || (spot.puerto_linz ? { ...spot.puerto_linz, metodo: spot.puerto_linz.tabla ? "tabla" : "secundario" } : null))}</section>
${filas ? `<section aria-labelledby="t-prev"><h2 id="t-prev">${M.prev}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${M.horaCol}</th><th scope="col">${M.olas}</th><th scope="col">${M.viento}</th><th scope="col">${M.agua}</th></tr></thead><tbody>${filas}</tbody></table></div>
<p class="nota">${M.notaPrev}</p></section>` : ""}
${T.cta()}
<section aria-labelledby="t-cerca"><h2 id="t-cerca">${M.cercanos}</h2>
<ul class="chips">${cercanos.map((s) => `<li><a href="${esc(rMarea(s.slug))}">${esc(s.nombre)}</a></li>`).join("")}</ul>
${zona ? `<p><a href="${esc(rZonaMareas(zona.slug))}">${esc(M.todaZona(zona.nombre))}</a></p>` : ""}</section>
<p><a href="${esc(rSpot(spot.slug))}">${esc(M.pescaEn(spot.nombre))}</a></p>`;
    return { titulo, html: doc({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("mareas"), imagenAlt: M.imagenAlt(spot.nombre) }) };
  }

  function paginaZonaMareas(zonaNz, todos, spotsPrev = []) {
    const zona = zonaT(zonaNz);
    const Z = T.zona;
    const del = spotsNZ(todos).filter((s) => s.zona === zona.zona);
    const ruta = `/mareas/region/${zona.slug}`;
    const titulo = Z.mareasTitulo(zona.nombre, del.length);
    const descripcion = Z.mareasDesc(zona.nombre, del.length);
    const migas = [{ nombre: T.mareas.migas, ruta: p(`/${T.rutaMareas}`) }, { nombre: zona.nombre, ruta: rZonaMareas(zona.slug) }];
    // Preguntas frecuentes con las mareas de LINZ de los spots de la zona.
    const slugs = new Set(del.map((s) => s.slug));
    const preguntas = preguntasMareasRegion({ spots: (spotsPrev || []).filter((s) => slugs.has(s.slug)), regionSlug: zona.slug, lugar: zona.nombre, idioma, conTabla: false });
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${rZonaMareas(zona.slug)}`, inLanguage: T.lang, about: { "@type": "Place", name: `${zona.nombre}, ${T.nz}` } }, migasJsonLd(migas), ...(preguntas.length ? [faqLd(preguntas, T.lang)] : [])];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(Z.mareasH1(zona.nombre))}</h1>
<p class="intro">${Z.mareasIntro(del.length, esc(zona.nombre), esc(rZonaSpots(zona.slug)))}</p>
${listaSpots(del, rMarea)}
<p class="nota">${ATRIBUCION_LINZ_HTML} ${esc(AVISO_LINZ)}</p>
${faqHtml(preguntas, idioma)}
${T.cta()}
<p><a href="${esc(p(`/${T.rutaMareas}`))}">${Z.todaNz}</a></p>`;
    return { titulo, html: doc({ titulo, descripcion, ruta, cuerpo, ld, imagen: imagenOg("mareas"), imagenAlt: Z.mareasH1(zona.nombre) }) };
  }

  function paginaEspecie(e, especiesDatos, todos, mes) {
    const E = T.especie;
    const areas = Object.keys(AREAS_MPI).filter((a) => e.presencia?.[a]?.meses?.length);
    const temporada = areas.map((a) => ({ nombre: AREAS_MPI[a].nombre, url: AREAS_MPI[a].url, texto: textoMeses(e.presencia[a].meses), ahora: e.presencia[a].meses.includes(mes),
      freza: e.freza?.por_region?.[a]?.meses?.length ? textoMeses(e.freza.por_region[a].meses) : null }));
    const modalidades = MODALIDADES.filter((m) => e.modalidades?.[m]?.aplica === true);
    const habitat = e.habitat?.verificado ? txt(e.habitat, "valor") : null;
    const prof = e.profundidad_m?.verificado && Array.isArray(e.profundidad_m.valor) ? e.profundidad_m : null;
    const notaFreza = Object.values(e.freza?.por_region || {}).map((f) => txt(f, "nota")).find(Boolean) || null;
    const spots = spotsNZ(todos).filter((s) => areas.includes(s.region));
    const porZona = ZONAS_NZ.map((z) => ({ ...zonaT(z), spots: spots.filter((s) => s.zona === z.zona) })).filter((z) => z.spots.length);
    const n = nombreEsp(e), mi = e.nombres?.mi || null, c = nombreCientifico(e), slug = slugEspecie(e.id);
    const ruta = `/especies/${slug}`;
    const titulo = E.titulo(n, mi && mi !== n ? mi : null);
    const descripcion = E.desc(n, c);
    const migas = [{ nombre: E.migas, ruta: p(`/${T.rutaEspecies}`) }, { nombre: n, ruta: rEspecie(slug) }];
    const ahoraL = temporada.filter((t) => t.ahora).map((t) => t.nombre);
    const intro = E.intro(n, mi, c, modalidades.length ? E.modos(lista(modalidades.map((m) => T.modalidadCorta[m]))) : "", ahoraL.length ? E.ahora(mesLargo(mes), lista(ahoraL)) : "");
    const ld = [
      { "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}${rEspecie(slug)}`, inLanguage: T.lang, description: intro, dateModified: especiesDatos.version || undefined,
        about: { "@type": "Thing", name: n, alternateName: [mi, c, e.nombres?.en].filter((x) => x && x !== n) }, publisher: ORG_LD },
      migasJsonLd(migas),
    ];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1><span aria-hidden="true">${esc(e.emoji || "🐟")}</span> ${esc(n)}</h1>
<p class="cientifico">${c ? `<em>${esc(c)}</em>` : ""}${mi ? ` · ${esc(mi)} <span class="nota">(${E.maori})</span>` : ""}</p>
<p class="intro">${esc(intro)}</p>
${temporada.length ? `<section class="tarjeta" aria-labelledby="t-temp"><h2 id="t-temp">${E.temporada}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${E.area}</th><th scope="col">${E.mesesCol}</th><th scope="col">${E.freza}</th></tr></thead><tbody>
${temporada.map((t) => `<tr${t.ahora ? ' class="ahora"' : ""}><th scope="row">${esc(t.nombre)}</th><td>${esc(t.texto)}${t.ahora ? ` · <strong>${E.ahoraTxt}</strong>` : ""}</td><td>${t.freza ? esc(t.freza) : "–"}</td></tr>`).join("")}
</tbody></table></div>
${notaFreza ? `<p class="nota">${esc(notaFreza)}</p>` : ""}</section>` : ""}
<section class="tarjeta aviso" aria-labelledby="t-normas"><h2 id="t-normas">${E.normasT}</h2>
<p>${E.normasTxt}</p>
<ul>${temporada.map((t) => `<li><a href="${esc(t.url)}" rel="noopener" target="_blank">${esc(E.normasArea(t.nombre))}</a></li>`).join("")}
<li><a href="${esc(URL_APP_MPI)}" rel="noopener" target="_blank">${T.normas.app}</a></li></ul>
<p class="nota">${esc(T.rahui)}</p></section>
${modalidades.length ? `<section aria-labelledby="t-mod"><h2 id="t-mod">${E.comoSePesca}</h2><ul class="modos">${modalidades.map((m) => `<li><strong>${T.modalidad[m]}</strong></li>`).join("")}</ul></section>` : ""}
${habitat || prof ? `<section aria-labelledby="t-hab"><h2 id="t-hab">${E.habitat}</h2>
${habitat ? `<p>${esc(habitat)}</p>` : ""}${prof ? `<p>${esc(E.prof(prof.valor[0], prof.valor[1], prof.maximo))}</p>` : ""}
<p class="nota">${E.fuente}</p></section>` : ""}
${T.cta(E.cta(n.toLowerCase()))}
${porZona.length ? `<section aria-labelledby="t-donde"><h2 id="t-donde">${esc(E.donde(n.toLowerCase()))}</h2>
${porZona.map((z) => `<h3><a href="${esc(rZonaSpots(z.slug))}">${esc(z.nombre)}</a></h3><ul class="chips">${z.spots.map((s) => `<li><a href="${esc(rSpot(s.slug))}">${esc(s.nombre)}</a></li>`).join("")}</ul>`).join("")}
</section>` : ""}
<p><a href="${esc(p(`/${T.rutaEspecies}`))}">${E.todas}</a></p>`;
    return { titulo, html: doc({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", imagen: imagenOg("especies"), imagenAlt: E.imagenAlt }) };
  }

  // Sección «Nueva Zelanda» para los índices (spots, mareas, especies).
  function seccionNZ(tipo, todos, especiesDatos) {
    const nz = spotsNZ(todos);
    if (tipo === "especies") {
      const ls = especiesNZ(especiesDatos).map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEsp(e) })).sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
      return `<section aria-labelledby="t-nz"><h2 id="t-nz">${T.seccionNz}</h2><ul class="chips">${ls.map((e) => `<li><a href="${esc(rEspecie(e.slug))}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>`;
    }
    const ruta = tipo === "mareas" ? rZonaMareas : rZonaSpots;
    const zonas = ZONAS_NZ.filter((z) => nz.some((s) => s.zona === z.zona));
    return `<section aria-labelledby="t-nz"><h2 id="t-nz">${T.seccionNz}</h2><ul class="chips">${zonas.map((z) => `<li><a href="${esc(ruta(z.slug))}">${esc(zonaT(z).nombre)}</a> <span class="nota">(${nz.filter((s) => s.zona === z.zona).length})</span></li>`).join("")}</ul></section>`;
  }

  function urls({ spots, especies, fecha }) {
    const nz = spotsNZ(spots).slice().sort((a, b) => a.slug.localeCompare(b.slug));
    const zonas = ZONAS_NZ.filter((z) => nz.some((s) => s.zona === z.zona));
    const u = (ruta, changefreq, priority) => ({ loc: `${DOMINIO}${ruta}`, lastmod: fecha, changefreq, priority });
    return [
      ...zonas.map((z) => u(rZonaSpots(z.slug), "daily", "0.7")),
      ...zonas.map((z) => u(rZonaMareas(z.slug), "daily", "0.65")),
      ...nz.map((s) => u(rSpot(s.slug), "daily", "0.6")),
      ...nz.map((s) => u(rMarea(s.slug), "hourly", "0.6")),
      ...especiesNZ({ especies }).slice().sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(rEspecie(slugEspecie(e.id)), "monthly", "0.6")),
    ];
  }

  return { idioma, paginaSpot, paginaZonaSpots, paginaMarea, paginaZonaMareas, paginaEspecie, seccionNZ, urls, nombreEsp, textoMeses };
}

export const NZ = { es: crearPaginasNZ("es"), pt: crearPaginasNZ("pt") };
