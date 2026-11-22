// functions/_lib/seo/paginas-ib.js — páginas de España y Portugal en otros
// idiomas (portugués europeo e inglés), con las mismas rutas que las
// españolas bajo /pt/ y /en/:
//
//   /<l>/spots/<slug>, /<l>/spots/region/<región>
//   /<l>/mareas/<slug> (en inglés /en/tides/<slug>), /<l>/mareas/region/<región>
//   /<l>/especies (en inglés /en/species), /<l>/especies/<slug>
//
// 2026-11-20, Mikel: «todo lo que hagamos debe estar en todos los idiomas…
// asegúrate que todas son espejo». Sale de paginas-pt.js (portugués, solo
// Portugal, 2026-10-11), ahora para todas las regiones y en dos idiomas.
// Puro: recibe los datos y devuelve { titulo, html }. Solo se publica en
// cada idioma lo que tiene traducción (campo_<l> en especies.json,
// assets/i18n/<l>.js); lo que no la tiene no sale.

import { DOMINIO, esc, documento, migasHtml, migasJsonLd, ctaPt, imagenOg, imagenOgRegion } from "./base.js";
import { ctaEn } from "./paginas-en.js";
import {
  REGIONES_MAREAS, nombreCortoSpot, slugEspecie, especiesDeSpot, profundidadDeSpot,
  camarasPublicasDeSpot, rioDeSpot, spotsCercanos, regionEspeciesDeSpot,
} from "./datos.js";
import * as VA from "../../../assets/js/ventana-actividad.js";
import { textoFondo } from "../../../assets/js/capa-tipo-fondo.js";
import { zonaDeSpot } from "../../../assets/js/regiones.js";
import { I18n } from "../../../assets/js/i18n-modulo.js";

const ORG_LD = { "@type": "Organization", name: "Costaviva", url: `${DOMINIO}/`, logo: `${DOMINIO}/assets/iconos/icono-512.png` };
// Las de España y Portugal están en los tres idiomas.
export const ALTERNOS_IB = ["es", "en", "pt"];
export const spotsIberia = (spots) => (spots || []).filter((s) => s.pais !== "nz" && REGIONES_MAREAS.some((r) => r.spots.has(s.slug)));
export const esSpotIberia = (slug) => REGIONES_MAREAS.some((r) => r.spots.has(slug));
export const regionIb = (slug) => REGIONES_MAREAS.find((r) => r.slug === slug) || null;
const regionDeSpot = (slug) => REGIONES_MAREAS.find((r) => r.spots.has(slug)) || null;

// ---------------------------------------------------------------------------
// Textos por idioma
// ---------------------------------------------------------------------------
const L = {
  pt: {
    lang: "pt-PT", locale: "pt-PT", y: "e",
    meses: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
    todoAno: "Todo o ano",
    modalidad: { costa: "De terra", embarcacion: "Embarcação", submarina: "Pesca submarina" },
    regionEspecie: { cantabrico: "Cantábrico", atlantico_norte: "Galiza", portugal: "Portugal", golfo_cadiz: "Golfo de Cádis", mediterraneo: "Mediterrâneo", baleares: "Baleares", canarias: "Canárias", azores: "Açores", madeira: "Madeira" },
    regiones: { "pais-vasco": "País Basco", cantabria: "Cantábria", asturias: "Astúrias", galicia: "Galiza", portugal: "Portugal", mediterraneo: "Mediterrâneo (Catalunha, C. Valenciana, Múrcia, Andaluzia, Baleares)", "golfo-de-cadiz": "Golfo de Cádis", canarias: "Canárias" },
    regionCorta: { mediterraneo: "Mediterrâneo" },
    pais: (r) => (r === "portugal" ? "Portugal" : "Espanha"),
    evento: { pleamar: "preia-mar", bajamar: "baixa-mar" }, manana: "amanhã ",
    sube: "a encher ▲", baja: "a vazar ▼", coef: "coef.",
    rutaMareas: "mareas", rutaEspecies: "especies",
    fondo: /^Fundo: /, sinDato: /sem dado/i, fondoProx: "Fundo próximo:", fondoEtq: "Fundo",
    prof: { zona: (m) => `Fundo típico a 1 km da costa: cerca de ${m} m.`, hitos: (x) => `Profundidades a partir do pesqueiro: ${x}.`, a: "a", max: (m) => `O mais fundo a 5 km ou menos: cerca de ${m} m (o que alcança uma embarcação que sai daqui).` },
    tabla: { sin: "Sem espécies com dados para este pesqueiro.", si: "sim", no: "não", especie: "Espécie", epoca: "Época", ahora: "agora", veda: "em defeso" },
    intro: {
      base: (n, pais) => `${n} (${pais}) é um dos pesqueiros que a Costaviva acompanha.`,
      orilla: (o, f) => `${o ? `Na beira-mar: ${o}` : "Beira-mar variada"}${f ? `; fundo próximo de ${f}` : ""}.`,
      prof: (a, b) => `A um quilómetro da costa há ${a} de água e a 5 km chega-se a ${b}.`, cerca: (m) => (m <= 1 ? "1 m ou menos" : `cerca de ${m} m`),
      muchas: (mes, n, l) => `Em ${mes} há ${n} espécies da época; entre elas, ${l}.`, pocas: (mes, l) => `Em ${mes} é época de ${l}.`,
      rio: (r) => `Perto desagua o rio ${r}.`, camara: "Tem câmara para ver o mar antes de sair.",
      cercano: (n, km) => `O pesqueiro mais próximo acompanhado pela Costaviva é ${n}, a ${km} km.`,
    },
    hoy: {
      titulo: "Condições de hoje", sinDatos: (url) => `Neste momento não temos os dados de hoje deste pesqueiro. Tente novamente dentro de alguns minutos ou veja a <a href="${url}">maré de hoje</a>.`,
      indice: "Índice de pesca de terra", mejor: "melhor agora", olaPeligro: "⚠️ Onda perigosa para pescar de terra: todo o cuidado é pouco.",
      aFavor: "a favor", contra: "contra", freza: "Está em desova: se o apanhar, devolva-o.",
      ola: "Onda", viento: "Vento", marea: "Maré", agua: "Água",
      pie: (url, n) => `A janela hora a hora, as melhores horas para cada espécie e os alarmes, dentro da Costaviva. Marés de hoje em detalhe: <a href="${url}">maré em ${n}</a>.`,
    },
    spot: {
      titulo: (n) => `Pesca em ${n}: espécies, época, fundo e condições de hoje | Costaviva`,
      desc: (n, pais, ahora) => `Pesca em ${n} (${pais}): ${ahora ? `agora ${ahora}; ` : ""}o que se pesca de terra, de embarcação e na pesca submarina, tipo de fundo, profundidade e o índice de pesca de hoje.`,
      migas: "Pesqueiros", h1: (n) => `Pesca em ${n}`, turismo: "Pesca lúdica",
      queSePesca: (n) => `O que se pesca em ${n}`, notaEspecies: (zona, mes) => `Espécies de ${zona} com a sua época e a modalidade em que se pescam. Em destaque, as de ${mes}.`, laZona: "a zona",
      fondoProf: "Fundo e profundidade", orilla: "Beira-mar", orientativo: "Orientativo, não serve para navegar.",
      rio: "Rio próximo", rioTxt: (r) => `Desagua perto o rio <strong>${r}</strong>. Com muito caudal, a água fica turva junto à foz.`,
      camaras: "Câmaras", camaraApp: (n) => `Com a Costaviva vê a câmara de ${n} junto às condições.`, camarasNota: "Câmaras dos respetivos donos: abrem no site deles.",
      cta: (n) => `Pesque melhor em ${n}`, cercanos: "Pesqueiros próximos", marea: "maré", todos: (r) => `Todos os pesqueiros de ${r} →`,
      imagenAlt: (r) => `Pesca em ${r} com a Costaviva`,
    },
    region: {
      titulo: (r, n) => `Pesqueiros em ${r}: ${n} locais de pesca, espécies e época | Costaviva`,
      desc: (r, n, mes, l) => `Onde pescar hoje em ${r}: ${n} pesqueiros com o índice de pesca de hoje e as espécies da época em ${mes}: ${l}. Fundo, profundidade e condições em tempo real.`,
      h1: (r) => `Pesca em ${r}`,
      intro: (n, r, urlM, urlE) => `${n} pesqueiros em ${r}. Em cada um: espécies por modalidade e época, fundo, profundidade, câmaras e o índice de pesca de hoje. Marés da zona: <a href="${urlM}">marés de hoje em ${r}</a>. Procure também <a href="${urlE}">por espécie</a>.`,
      temporada: (mes) => `Da época em ${mes}`, otras: "Outras zonas",
    },
    especie: {
      veda: { veda_recreativa: "Defeso na pesca lúdica", prohibida: "Captura proibida", solo_captura_y_suelta: "Só captura e devolução" }, vedaGen: "Defeso",
      zonaTalla: { "ES-RD560-I": "Cantábrico-Noroeste e Golfo de Cádis", "ES-RD560-II": "Mediterrâneo", "ES-RD560-III": "Canárias", "UE-SWW": "águas ocidentais austrais", "UE-MED": "Mediterrâneo" },
      intro: (n) => `${n}: onde e quando se pesca em Portugal e Espanha, tamanhos mínimos e iscos.`,
      modalidades: (l) => `Modalidades: ${l}.`, ahora: (mes, l) => `Em ${mes} está na época em ${l}.`,
      talla1: (x) => `Tamanho mínimo: ${x} cm.`, talla2: (a, b) => `Tamanho mínimo: de ${a} a ${b} cm consoante a zona.`,
      titulo: (n) => `${n}: onde e quando pescar, tamanho mínimo e iscos | Costaviva`,
      desc: (n, extra) => `${n}: época por zonas de Portugal e Espanha, modalidades, iscos e pesqueiros onde a pescar.${extra}`, descTalla: (x) => ` Tamanho mínimo desde ${x} cm.`,
      migas: "Espécies", aviso: "Tamanhos mínimos orientativos: prevalece a norma em vigor.", otroIdioma: "espanhol",
      epocaZonas: "Época por zonas", zona: "Zona", mesesCol: "Meses", desova: "Desova", ahora_: "agora", notaDesova: "Em desova: se o apanhar, devolva-o.",
      vedas: "Defesos e proibições", norma: "norma", talla: "Tamanho mínimo", tallaCol: "Tamanho", dondeAplica: "Onde se aplica", normaCol: "Norma", ver: "ver",
      comoSePesca: "Como se pesca", cebos: "Iscos e amostras típicos", cta: (n) => `Quando pica hoje: ${n}?`,
      donde: "Onde pescar", todas: "Todas as espécies →",
      imagenAlt: "Espécies de pesca: tamanhos mínimos, defesos e época",
      tituloIndice: "Espécies de pesca em Portugal e Espanha: época, tamanhos mínimos e iscos | Costaviva",
      descIndice: (n) => `${n} espécies da pesca lúdica em Portugal e Espanha: época por zonas, tamanho mínimo com a sua norma, modalidades, iscos e onde as pescar.`,
      h1Indice: "Espécies de pesca em Portugal e Espanha",
      introIndice: (n, url) => `Fichas de ${n} espécies: quando se pescam em cada zona, tamanho mínimo com a ligação para a norma, modalidades (de terra, de embarcação ou pesca submarina), iscos típicos e os pesqueiros onde as encontrar. Procure também <a href="${url}">por pesqueiro</a>.`,
      ahoraIndice: (mes) => `Da época em ${mes} nalguma zona`, todasH2: "Todas as espécies",
    },
    marea: {
      titulo: (n) => `Maré hoje em ${n}: preia-mar, baixa-mar e ondulação | Costaviva`,
      desc: (n, resumen, ola, viento, agua) => `Maré hoje em ${n}: ${resumen ? `próxima ${resumen}; ` : ""}ondulação ${ola || "sem dados agora"}, vento ${viento || "sem dados agora"}${agua ? `, água a ${agua}` : ""}. Dados reais atualizados a cada hora, grátis e sem conta.`,
      migas: "Marés", h1: (n) => `Maré hoje em ${n}`, actualizado: (x) => `Dados reais, atualizados: ${x}`, proximas: "Próximas marés",
      pleamar: "Próxima preia-mar", bajamar: "Próxima baixa-mar", ahora: "Maré agora", ola: "Ondulação", viento: "Vento", agua: "Água", coef: (c) => `Coeficiente de maré: ${c}.`, ref: (p) => `Alturas acima do zero do porto de ${p}, como na sua tabela de marés. Fonte:`,
      prev: (n) => `Previsão das próximas horas em ${n}`, hora: "Hora",
      nota: (n) => `A Costaviva é uma app de condições costeiras em tempo real (ondulação, marés, corrente, webcams, radar de chuva) e diário de pesca para a costa de Portugal e Espanha. A maré, a ondulação e o vento de ${n} são grátis e não precisam de conta. Horas locais, calculadas com os mesmos dados da app (Open-Meteo, CC BY 4.0). Orientativo: não serve para navegar.`,
      cercanos: "Pesqueiros próximos", pescaEn: (n) => `Pesca em ${n}: espécies, época, fundo e profundidade →`, todaCosta: (r) => `Marés em ${r} →`,
      tituloRegion: (r) => `Marés hoje em ${r}: preia-mar, baixa-mar e ondulação | Costaviva`,
      descRegion: (r, n) => `Marés hoje em ${r}: próxima preia-mar e baixa-mar, ondulação e vento em tempo real de ${n} pesqueiros. Grátis e sem conta.`,
      h1Region: (r) => `Marés hoje em ${r}`, tablaRegion: "Próximas marés e ondulação por pesqueiro", pesqueiro: "Pesqueiro", pleamarCol: "Preia-mar", bajamarCol: "Baixa-mar", onda: "Onda", pesca: "pesca",
      notaRegion: "Horas locais de cada pesqueiro, calculadas com os mesmos dados da app (Open-Meteo, CC BY 4.0). Orientativo: não serve para navegar.",
      queSePesca: (r) => `O que se pesca em ${r}: espécies e época por pesqueiro →`,
    },
    indice: {
      spotsTitulo: "Pesqueiros em Portugal e Espanha: onde pescar hoje por zonas | Costaviva", spotsH1: "Pesqueiros em Portugal e Espanha",
      spotsDesc: (n) => `${n} pesqueiros em Portugal e Espanha com o índice de pesca de hoje, espécies da época, fundo e profundidade, por zonas.`,
      mareasTitulo: "Marés hoje em Portugal e Espanha: preia-mar, baixa-mar e ondulação | Costaviva", mareasH1: "Marés hoje em Portugal e Espanha",
      mareasDesc: (n) => `Marés de hoje em ${n} pesqueiros de Portugal e Espanha: próxima preia-mar e baixa-mar, ondulação e vento, por zonas. Grátis e sem conta.`,
      zonas: "Zonas", pesqueiros: (n) => `${n} pesqueiros`, iberia: "Portugal e Espanha",
    },
    cta: (x) => ctaPt(x),
  },
  en: {
    lang: "en", locale: "en-GB", y: "and",
    meses: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    todoAno: "All year",
    modalidad: { costa: "Shore", embarcacion: "Boat", submarina: "Spearfishing" },
    regionEspecie: { cantabrico: "Bay of Biscay", atlantico_norte: "Galicia", portugal: "Portugal", golfo_cadiz: "Gulf of Cádiz", mediterraneo: "Mediterranean", baleares: "Balearic Islands", canarias: "Canary Islands", azores: "Azores", madeira: "Madeira" },
    regiones: { "pais-vasco": "the Basque Country", cantabria: "Cantabria", asturias: "Asturias", galicia: "Galicia", portugal: "Portugal", mediterraneo: "the Mediterranean (Catalonia, Valencia, Murcia, Andalusia, Balearics)", "golfo-de-cadiz": "the Gulf of Cádiz", canarias: "the Canary Islands" },
    regionCorta: { mediterraneo: "the Mediterranean" },
    pais: (r) => (r === "portugal" ? "Portugal" : "Spain"),
    evento: { pleamar: "high tide", bajamar: "low tide" }, manana: "tomorrow ",
    sube: "rising ▲", baja: "falling ▼", coef: "coef.",
    rutaMareas: "tides", rutaEspecies: "species",
    fondo: /^(Seabed|Bottom|Seafloor): /, sinDato: /no data/i, fondoProx: "Nearby seabed:", fondoEtq: "Seabed",
    prof: { zona: (m) => `Typical depth 1 km offshore: about ${m} m.`, hitos: (x) => `Depths from the spot: ${x}.`, a: "at", max: (m) => `Deepest within 5 km: about ${m} m (what a boat leaving from here can reach).` },
    tabla: { sin: "No species with data for this spot.", si: "yes", no: "no", especie: "Species", epoca: "Season", ahora: "now", veda: "closed season" },
    intro: {
      base: (n, pais) => `${n} (${pais}) is one of the fishing spots Costaviva follows.`,
      orilla: (o, f) => `${o ? `On the shore: ${o}` : "Mixed shoreline"}${f ? `; nearby seabed of ${f}` : ""}.`,
      prof: (a, b) => `One kilometre offshore there is ${a} of water, and within 5 km it reaches ${b}.`, cerca: (m) => (m <= 1 ? "1 m or less" : `about ${m} m`),
      muchas: (mes, n, l) => `In ${mes} there are ${n} species in season, including ${l}.`, pocas: (mes, l) => `In ${mes} it is the season for ${l}.`,
      rio: (r) => `The ${r} river flows out nearby.`, camara: "There is a camera to check the sea before you go.",
      cercano: (n, km) => `The nearest spot Costaviva follows is ${n}, ${km} km away.`,
    },
    hoy: {
      titulo: "Today's conditions", sinDatos: (url) => `We don't have today's data for this spot right now. Try again in a few minutes or see <a href="${url}">today's tide</a>.`,
      indice: "Shore fishing index", mejor: "best now", olaPeligro: "⚠️ Dangerous waves for shore fishing: take extreme care.",
      aFavor: "in favour", contra: "against", freza: "It is spawning: if you catch one, release it.",
      ola: "Waves", viento: "Wind", marea: "Tide", agua: "Water",
      pie: (url, n) => `The hour-by-hour window, the best hours for each species and alerts are in the Costaviva app. Today's tides in detail: <a href="${url}">tide at ${n}</a>.`,
    },
    spot: {
      titulo: (n) => `Fishing at ${n}: species, season, seabed and today's conditions | Costaviva`,
      desc: (n, pais, ahora) => `Fishing at ${n} (${pais}): ${ahora ? `now ${ahora}; ` : ""}what you can catch from the shore, from a boat and spearfishing, seabed type, depth and today's fishing index.`,
      migas: "Spots", h1: (n) => `Fishing at ${n}`, turismo: "Recreational fishing",
      queSePesca: (n) => `What you can catch at ${n}`, notaEspecies: (zona, mes) => `Species of ${zona} with their season and how they are fished. Highlighted: those in season in ${mes}.`, laZona: "the area",
      fondoProf: "Seabed and depth", orilla: "Shore", orientativo: "A guide only, not for navigation.",
      rio: "Nearby river", rioTxt: (r) => `The <strong>${r}</strong> river flows out nearby. With high flow, the water gets murky near the mouth.`,
      camaras: "Cameras", camaraApp: (n) => `In Costaviva you can see the ${n} camera next to the conditions.`, camarasNota: "Cameras belong to their owners: they open on their websites.",
      cta: (n) => `Fish better at ${n}`, cercanos: "Nearby spots", marea: "tide", todos: (r) => `All the spots in ${r} →`,
      imagenAlt: (r) => `Fishing in ${r} with Costaviva`,
    },
    region: {
      titulo: (r, n) => `Fishing spots in ${r}: ${n} places to fish, species and season | Costaviva`,
      desc: (r, n, mes, l) => `Where to fish today in ${r}: ${n} spots with today's fishing index and the species in season in ${mes}: ${l}. Seabed, depth and live conditions.`,
      h1: (r) => `Fishing in ${r}`,
      intro: (n, r, urlM, urlE) => `${n} fishing spots in ${r}. For each one: species by method and season, seabed, depth, cameras and today's fishing index. Tides in the area: <a href="${urlM}">today's tides in ${r}</a>. You can also browse <a href="${urlE}">by species</a>.`,
      temporada: (mes) => `In season in ${mes}`, otras: "Other areas",
    },
    especie: {
      veda: { veda_recreativa: "Closed season for recreational fishing", prohibida: "Catch prohibited", solo_captura_y_suelta: "Catch and release only" }, vedaGen: "Closed season",
      zonaTalla: { "ES-RD560-I": "Cantabrian–Northwest and Gulf of Cádiz", "ES-RD560-II": "Mediterranean", "ES-RD560-III": "Canary Islands", "UE-SWW": "South Western Waters", "UE-MED": "Mediterranean" },
      intro: (n) => `${n}: where and when to fish it in Spain and Portugal, minimum sizes and baits.`,
      modalidades: (l) => `Methods: ${l}.`, ahora: (mes, l) => `In ${mes} it is in season in ${l}.`,
      talla1: (x) => `Minimum size: ${x} cm.`, talla2: (a, b) => `Minimum size: ${a} to ${b} cm depending on the area.`,
      titulo: (n) => `${n}: where and when to fish, minimum size and baits | Costaviva`,
      desc: (n, extra) => `${n}: season by area in Spain and Portugal, methods, baits and spots where to fish it.${extra}`, descTalla: (x) => ` Minimum size from ${x} cm.`,
      migas: "Species", aviso: "Minimum sizes are a guide: the rules in force always prevail.", otroIdioma: "Spanish",
      epocaZonas: "Season by area", zona: "Area", mesesCol: "Months", desova: "Spawning", ahora_: "now", notaDesova: "If it is spawning and you catch one, release it.",
      vedas: "Closed seasons and bans", norma: "rule", talla: "Minimum size", tallaCol: "Size", dondeAplica: "Where it applies", normaCol: "Rule", ver: "see",
      comoSePesca: "How it is fished", cebos: "Typical baits and lures", cta: (n) => `When does ${n} bite today?`,
      donde: "Where to fish it", todas: "All species →",
      imagenAlt: "Fishing species: minimum sizes, closed seasons and season",
      tituloIndice: "Fishing species in Spain and Portugal: season, minimum sizes and baits | Costaviva",
      descIndice: (n) => `${n} recreational fishing species in Spain and Portugal: season by area, minimum size with its rule, methods, baits and where to fish them.`,
      h1Indice: "Fishing species in Spain and Portugal",
      introIndice: (n, url) => `Guides to ${n} species: when they are fished in each area, minimum size with a link to the rule, methods (shore, boat or spearfishing), typical baits and the spots where to find them. You can also browse <a href="${url}">by spot</a>.`,
      ahoraIndice: (mes) => `In season in ${mes} somewhere`, todasH2: "All species",
    },
    marea: {
      titulo: (n) => `Tide today at ${n}: high tide, low tide and swell | Costaviva`,
      desc: (n, resumen, ola, viento, agua) => `Tide today at ${n}: ${resumen ? `next ${resumen}; ` : ""}swell ${ola || "no data right now"}, wind ${viento || "no data right now"}${agua ? `, water at ${agua}` : ""}. Real data updated every hour, free and without an account.`,
      migas: "Tides", h1: (n) => `Tide today at ${n}`, actualizado: (x) => `Real data, updated: ${x}`, proximas: "Next tides",
      pleamar: "Next high tide", bajamar: "Next low tide", ahora: "Tide now", ola: "Swell", viento: "Wind", agua: "Water", coef: (c) => `Tidal coefficient: ${c}.`, ref: (p) => `Heights above the ${p} port datum, as in its tide table. Source:`,
      prev: (n) => `Forecast for the next hours at ${n}`, hora: "Time",
      nota: (n) => `Costaviva is a real-time coastal conditions app (swell, tides, currents, webcams, rain radar) and fishing log for the coasts of Spain and Portugal. The tide, swell and wind at ${n} are free and need no account. Local times, calculated with the same data as the app (Open-Meteo, CC BY 4.0). A guide only, not for navigation.`,
      cercanos: "Nearby spots", pescaEn: (n) => `Fishing at ${n}: species, season, seabed and depth →`, todaCosta: (r) => `Tides in ${r} →`,
      tituloRegion: (r) => `Tides today in ${r}: high tide, low tide and swell | Costaviva`,
      descRegion: (r, n) => `Tides today in ${r}: next high and low tide, swell and wind in real time for ${n} fishing spots. Free and without an account.`,
      h1Region: (r) => `Tides today in ${r}`, tablaRegion: "Next tides and swell by spot", pesqueiro: "Spot", pleamarCol: "High tide", bajamarCol: "Low tide", onda: "Waves", pesca: "fishing",
      notaRegion: "Local times for each spot, calculated with the same data as the app (Open-Meteo, CC BY 4.0). A guide only, not for navigation.",
      queSePesca: (r) => `What you can catch in ${r}: species and season by spot →`,
    },
    indice: {
      spotsTitulo: "Fishing spots in Spain and Portugal: where to fish today by area | Costaviva", spotsH1: "Fishing spots in Spain and Portugal",
      spotsDesc: (n) => `${n} fishing spots in Spain and Portugal with today's fishing index, species in season, seabed and depth, by area.`,
      mareasTitulo: "Tides today in Spain and Portugal: high tide, low tide and swell | Costaviva", mareasH1: "Tides today in Spain and Portugal",
      mareasDesc: (n) => `Today's tides at ${n} fishing spots in Spain and Portugal: next high and low tide, swell and wind, by area. Free and without an account.`,
      zonas: "Areas", pesqueiros: (n) => `${n} spots`, iberia: "Spain and Portugal",
    },
    cta: (x) => ctaEn(x),
  },
};

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------
const fmtL = (l) => (x) => {
  const s = String(Math.round(x * 10) / 10);
  return l === "pt" ? s.replace(".", ",") : s;
};
const listaL = (y) => (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${y} ${xs[xs.length - 1]}`);

export function crearPaginasIb(idioma) {
  const T = L[idioma];
  if (!T) throw new Error(`idioma sin plantilla: ${idioma}`);
  const t = (clave, vars) => I18n.t(clave, vars, idioma);
  const fmt = fmtL(idioma);
  const lista = listaL(T.y);
  // Texto de un dato en el idioma: SOLO campo_<l> (nunca el español de respaldo).
  const solo = (obj, campo) => (obj && typeof obj[`${campo}_${idioma}`] === "string" && obj[`${campo}_${idioma}`].trim()) || null;
  const enIdioma = (fn) => {
    const antes = I18n.idioma();
    I18n.fijarIdioma(idioma);
    try { return fn(); } finally { I18n.fijarIdioma(antes); }
  };
  const p = (ruta) => `/${idioma}${ruta}`;
  const rSpot = (slug) => p(`/spots/${slug}`);
  const rMarea = (slug) => p(`/${T.rutaMareas}/${slug}`);
  const rEspecie = (slug) => p(`/${T.rutaEspecies}/${slug}`);
  const rEspecies = () => p(`/${T.rutaEspecies}`);
  const rRegionSpots = (r) => p(`/spots/region/${r}`);
  const rRegionMareas = (r) => p(`/${T.rutaMareas}/region/${r}`);
  const MESES_CORTOS = T.meses.map((m) => m.slice(0, 3));
  const mesLargo = (m) => T.meses[m - 1];
  const nombreRegion = (slug) => T.regiones[slug] || slug;
  const nombreRegionCorto = (slug) => T.regionCorta[slug] || nombreRegion(slug);
  const opciones = { idioma, alternos: ALTERNOS_IB };

  function textoMeses(meses) {
    const set = [...new Set(meses || [])].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    if (!set.length) return "";
    if (set.length === 12) return T.todoAno;
    const tramos = [];
    for (const m of set) {
      const u = tramos[tramos.length - 1];
      if (u && u[1] === m - 1) u[1] = m;
      else tramos.push([m, m]);
    }
    if (tramos.length > 1 && tramos[0][0] === 1 && tramos[tramos.length - 1][1] === 12) tramos[0][0] = tramos.pop()[0];
    return tramos.map(([a, b]) => (a === b ? MESES_CORTOS[a - 1] : `${MESES_CORTOS[a - 1]}–${MESES_CORTOS[b - 1]}`)).join(", ");
  }

  // Nombre de una especie (nombres.<l>; si no, el científico; si no, el español).
  const nombreEsp = (e) => e?.nombres?.[idioma] || String(e?.cientifico || "").split(" (")[0].trim() || e?.nombres?.es || e?.id;

  function motivo(m, especiesDatos) {
    if (m.clave) return VA.textoMotivo(m.clave, m.vars, idioma, true);
    const regla = (especiesDatos?.reglas_expertas?.reglas || []).find((r) => r.texto === m.texto);
    return solo(regla, "texto");
  }

  const textoEvento = (e) => `${e.manana ? T.manana : ""}${e.hora} (${fmt(e.altura)} m)`;
  const tendencia = (x) => (x === "subiendo" ? T.sube : x === "bajando" ? T.baja : "");

  function condiciones(sp) {
    if (!sp || sp.error) return null;
    const b = sp.bloques?.[0];
    const m = sp.marea;
    if (!b && !m) return null;
    return {
      ola: b?.altura ? `${fmt(b.altura[0])}–${fmt(b.altura[1])} m` : null,
      olaDetalle: b?.periodo ? `${b.periodo} s` : null,
      viento: b?.viento != null ? `${b.viento} km/h${b.dirViento ? ` ${b.dirViento}` : ""}` : null,
      tempAgua: b?.tempAgua != null ? `${fmt(b.tempAgua)} °C` : null,
      marea: m?.altura != null ? `${fmt(m.altura)} m ${tendencia(m.tendencia)}`.trim() : null,
      mareaDetalle: [m?.coeficiente ? `${T.coef} ${m.coeficiente}` : null,
        ...(m?.proximas || []).slice(0, 2).map((e) => `${T.evento[e.tipo] || e.tipo} ${e.manana ? T.manana : ""}${e.hora}`)].filter(Boolean).join(" · ") || null,
      actualizado: sp.actualizado || null,
    };
  }

  function fondoDe(tipoFondo, slug) {
    const e = tipoFondo?.spots?.[slug];
    if (!e) return null;
    const partes = (enIdioma(() => textoFondo(e)) || "").split(" · ");
    let texto = T.fondo.test(partes[0]) && !T.sinDato.test(partes[0]) ? partes[0] : null;
    if (texto) {
      for (const k of ["pradera", "posidonia", "roca", "arena", "grava", "fango"]) {
        texto = texto.replace(new RegExp(`(?<![\\p{L}])${I18n.t(`fondo.clase.${k}`, null, "es")}(?![\\p{L}])`, "gu"), t(`fondo.clase.${k}`));
      }
    }
    const orilla = e.orilla?.tipo ? t(`fondo.orilla.${e.orilla.tipo}`) : null;
    return texto || orilla ? { texto, orilla } : null;
  }

  function profundidadDe(profundidad, slug) {
    const pr = profundidadDeSpot(profundidad, slug);
    if (!pr) return null;
    const raw = profundidad.spots[slug];
    const dist = (m) => (m >= 1000 ? `${fmt(m / 1000)} km` : `${Math.round(m / 10) * 10} m`);
    const frases = [];
    if (Number.isFinite(raw.zona_m)) frases.push(T.prof.zona(Math.round(raw.zona_m)));
    const hitos = [[10, raw.dist_10m_m], [20, raw.dist_20m_m], [30, raw.dist_30m_m], [50, raw.dist_50m_m], [100, raw.dist_100m_m]].filter(([, d]) => Number.isFinite(d));
    if (hitos.length) frases.push(T.prof.hitos(hitos.map(([h, d]) => `${h} m ${T.prof.a} ${dist(d)}`).join(", ")));
    if (Number.isFinite(raw.prof_max_5km_m)) frases.push(T.prof.max(Math.round(raw.prof_max_5km_m)));
    return { frases, zona_m: pr.zona_m, max5: pr.max5 };
  }

  function tablaEspecies(porModalidad, especiesDatos) {
    const porId = new Map((especiesDatos?.especies || []).map((e) => [e.id, e]));
    const filas = new Map();
    for (const m of VA.MODALIDADES) {
      for (const e of porModalidad[m] || []) {
        if (!filas.has(e.id)) filas.set(e.id, { ...e, nombre: nombreEsp(porId.get(e.id)), modos: new Set() });
        filas.get(e.id).modos.add(m);
      }
    }
    const ls = [...filas.values()].sort((a, b) => (b.deTemporada - a.deTemporada) || a.nombre.localeCompare(b.nombre, T.locale));
    if (!ls.length) return `<p class="nota">${esc(T.tabla.sin)}</p>`;
    const marca = (si) => (si ? `<span aria-label="${T.tabla.si}">✓</span>` : `<span aria-label="${T.tabla.no}">–</span>`);
    return `<div class="tabla-env"><table class="tabla-especies"><thead><tr><th scope="col">${T.tabla.especie}</th><th scope="col">${T.tabla.epoca}</th>${VA.MODALIDADES.map((m) => `<th scope="col">${esc(T.modalidad[m])}</th>`).join("")}</tr></thead><tbody>
${ls.map((e) => `<tr${e.deTemporada ? ' class="ahora"' : ""}><th scope="row"><a href="${esc(rEspecie(e.slug))}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a></th><td>${esc(textoMeses(e.meses))}${e.deTemporada ? ` · <strong>${T.tabla.ahora}</strong>` : ""}${e.veda ? ` · <strong>${T.tabla.veda}</strong>` : ""}</td>${VA.MODALIDADES.map((m) => `<td>${marca(e.modos.has(m))}</td>`).join("")}</tr>`).join("\n")}
</tbody></table></div>`;
  }

  function introSpot(spot, { fondo, prof, destacadas, camaras, rio, mes, cercano }) {
    const n = nombreCortoSpot(spot.nombre);
    const r = regionDeSpot(spot.slug);
    const partes = [T.intro.base(n, T.pais(r?.slug))];
    if (fondo?.orilla || fondo?.texto) partes.push(T.intro.orilla(fondo.orilla, fondo.texto ? fondo.texto.replace(T.fondo, "") : null));
    if (prof?.zona_m != null && prof?.max5 != null) partes.push(T.intro.prof(T.intro.cerca(Math.round(prof.zona_m)), T.intro.cerca(Math.round(prof.max5))));
    if (destacadas.length) {
      const l = lista(destacadas.slice(0, 4).map((x) => x.toLowerCase()));
      partes.push(destacadas.length > 4 ? T.intro.muchas(mesLargo(mes), destacadas.length, l) : T.intro.pocas(mesLargo(mes), l));
    }
    if (rio) partes.push(T.intro.rio(rio.nombre));
    if (camaras.externas.length || camaras.enApp) partes.push(T.intro.camara);
    if (cercano?.distancia != null) partes.push(T.intro.cercano(nombreCortoSpot(cercano.nombre), fmt(cercano.distancia < 10 ? cercano.distancia : Math.round(cercano.distancia))));
    return partes.join(" ");
  }

  function bloqueHoy(cond, indice, spot, especiesDatos) {
    if (!cond && !indice) {
      return `<section class="tarjeta hoy" aria-labelledby="t-hoy"><h2 id="t-hoy">${T.hoy.titulo}</h2>
<p class="nota">${T.hoy.sinDatos(esc(rMarea(spot.slug)))}</p></section>`;
    }
    const celda = (etq, val, det) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span>${det ? `<span class="dato-det">${esc(det)}</span>` : ""}</div>` : "");
    let indiceHtml = "";
    if (indice) {
      const esp = indice.especieId ? (especiesDatos?.especies || []).find((e) => e.id === indice.especieId) : null;
      const motivos = indice.motivos.map((m) => ({ ...m, txt: motivo(m, especiesDatos) })).filter((m) => m.txt);
      indiceHtml = `<div class="indice" data-nivel="${indice.nivel}">
  <div class="indice-nota"><span class="nota-nivel" data-nivel="${indice.nivel}">${indice.puntuacion}</span><span class="indice-etq">${T.hoy.indice}${esp ? ` · ${T.hoy.mejor}: <a href="${esc(rEspecie(slugEspecie(esp.id)))}">${esc(nombreEsp(esp).toLowerCase())}</a>` : ""}</span></div>
  ${indice.avisoOla ? `<p class="aviso-ola" role="note">${T.hoy.olaPeligro}</p>` : ""}
  ${motivos.length ? `<ul class="motivos">${motivos.map((m) => `<li class="${m.sube ? "sube" : "baja"}"><span class="flecha" aria-label="${m.sube ? T.hoy.aFavor : T.hoy.contra}">${esc(m.flecha)}</span><span>${esc(m.txt)}</span></li>`).join("")}</ul>` : ""}
  ${indice.freza ? `<p class="nota">${T.hoy.freza}</p>` : ""}
</div>`;
    }
    const hora = cond?.actualizado ? new Date(cond.actualizado).toLocaleString(T.locale, { timeZone: zonaDeSpot(spot), hour: "2-digit", minute: "2-digit" }) : null;
    return `<section class="tarjeta hoy" aria-labelledby="t-hoy">
<h2 id="t-hoy">${T.hoy.titulo}${hora ? ` <small>(${hora})</small>` : ""}</h2>
${indiceHtml}
${cond ? `<div class="datos">${celda(T.hoy.ola, cond.ola, cond.olaDetalle)}${celda(T.hoy.viento, cond.viento, null)}${celda(T.hoy.marea, cond.marea, cond.mareaDetalle)}${celda(T.hoy.agua, cond.tempAgua, null)}</div>` : ""}
<p class="nota">${T.hoy.pie(esc(rMarea(spot.slug)), esc(nombreCortoSpot(spot.nombre)))}</p>
</section>`;
  }

  function paginaSpot(spot, todos, d) {
    const { especiesDatos, tipoFondo, profundidad, caudales, camarasApp, indice, mes, spotPrev } = d;
    const nombre = nombreCortoSpot(spot.nombre);
    const region = regionDeSpot(spot.slug);
    const especies = especiesDeSpot(especiesDatos, spot, mes);
    const porId = new Map((especiesDatos?.especies || []).map((e) => [e.id, e]));
    const destacadas = [];
    for (const m of VA.MODALIDADES) for (const e of especies.porModalidad[m]) if (e.deTemporada && !destacadas.some((x) => x.id === e.id)) destacadas.push(e);
    destacadas.sort((a, b) => a.meses.length - b.meses.length);
    const nombresDest = destacadas.map((e) => nombreEsp(porId.get(e.id)));
    const fondo = fondoDe(tipoFondo, spot.slug);
    const prof = profundidadDe(profundidad, spot.slug);
    const camaras = camarasPublicasDeSpot(spot.slug, camarasApp);
    const rio = rioDeSpot(spot.slug, caudales);
    const ib = spotsIberia(todos);
    const cercanos = ib.length > 1 ? spotsCercanos(ib, spot, 6) : [];
    const intro = introSpot(spot, { fondo, prof, destacadas: nombresDest, camaras, rio, mes, cercano: cercanos[0] });
    const ruta = `/spots/${spot.slug}`;
    const pais = T.pais(region?.slug);
    const titulo = T.spot.titulo(nombre);
    const descripcion = T.spot.desc(nombre, pais, nombresDest.length ? nombresDest.slice(0, 3).map((x) => x.toLowerCase()).join(", ") : "");
    const migas = [{ nombre: T.spot.migas, ruta: rRegionSpots(region?.slug || "portugal") }, { nombre, ruta: p(ruta) }];
    const ld = [
      {
        "@context": "https://schema.org", "@type": ["Place", "TouristAttraction"], name: T.spot.h1(nombre), description: intro,
        url: `${DOMINIO}${p(ruta)}`, inLanguage: T.lang, geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon },
        touristType: T.spot.turismo, containedInPlace: { "@type": "Place", name: pais },
      },
      migasJsonLd(migas),
    ];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(T.spot.h1(nombre))}</h1>
<p class="intro">${esc(intro)}</p>
${bloqueHoy(condiciones(spotPrev), indice, spot, especiesDatos)}
<section aria-labelledby="t-especies"><h2 id="t-especies">${esc(T.spot.queSePesca(nombre))}</h2>
<p class="nota">${esc(T.spot.notaEspecies(T.regionEspecie[especies.region] || T.spot.laZona, mesLargo(mes)))}</p>
${tablaEspecies(especies.porModalidad, especiesDatos)}</section>
${fondo || prof ? `<section class="tarjeta" aria-labelledby="t-fondo"><h2 id="t-fondo">${T.spot.fondoProf}</h2>
${fondo?.orilla ? `<p><strong>${T.spot.orilla}:</strong> ${esc(fondo.orilla)}.</p>` : ""}
${fondo?.texto ? `<p><strong>${esc(fondo.texto.replace(T.fondo, `${T.fondoProx} `))}</strong></p>` : ""}
${prof ? prof.frases.map((f) => `<p>${esc(f)}</p>`).join("") : ""}
<p class="nota">${T.spot.orientativo}</p></section>` : ""}
${rio ? `<section class="tarjeta" aria-labelledby="t-rio"><h2 id="t-rio">${T.spot.rio}</h2><p>${T.spot.rioTxt(esc(rio.nombre))}</p></section>` : ""}
${camaras.externas.length || camaras.enApp ? `<section class="tarjeta" aria-labelledby="t-cam"><h2 id="t-cam">${T.spot.camaras}</h2>
${camaras.enApp ? `<p>${esc(T.spot.camaraApp(nombre))}</p>` : ""}
${camaras.externas.length ? `<ul class="camaras">${camaras.externas.map((c) => `<li><a href="${esc(c.url)}" rel="noopener nofollow" target="_blank">${esc(c.nombre)}</a> <span class="nota">(${esc(c.dueno)})</span></li>`).join("")}</ul><p class="nota">${T.spot.camarasNota}</p>` : ""}
</section>` : ""}
${T.cta(T.spot.cta(nombre))}
${cercanos.length ? `<section aria-labelledby="t-cerca"><h2 id="t-cerca">${T.spot.cercanos}</h2>
<ul class="cercanos">${cercanos.map((s) => `<li><a href="${esc(rSpot(s.slug))}">${esc(nombreCortoSpot(s.nombre))}</a> <span class="nota">${fmt(s.distancia < 10 ? s.distancia : Math.round(s.distancia))} km</span> · <a href="${esc(rMarea(s.slug))}">${T.spot.marea}</a></li>`).join("")}</ul>
${region ? `<p><a href="${esc(rRegionSpots(region.slug))}">${esc(T.spot.todos(nombreRegionCorto(region.slug)))}</a></p>` : ""}
</section>` : ""}`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOgRegion(region || REGIONES_MAREAS[0]), imagenAlt: T.spot.imagenAlt(nombreRegionCorto(region?.slug)) }) };
  }

  function enlacesRegiones(actual, ruta) {
    return `<section aria-labelledby="t-otras"><h2 id="t-otras">${T.region.otras}</h2><ul class="chips">${REGIONES_MAREAS.filter((r) => r.slug !== actual).map((r) => `<li><a href="${esc(ruta(r.slug))}">${esc(nombreRegionCorto(r.slug))}</a></li>`).join("")}</ul></section>`;
  }

  function paginaRegionSpots(regionSlug, spots, especiesDatos, mes) {
    const reg = regionIb(regionSlug);
    if (!reg) return null;
    const del = spotsIberia(spots).filter((s) => reg.spots.has(s.slug)).sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const ruta = `/spots/region/${reg.slug}`;
    const nombreR = nombreRegionCorto(reg.slug);
    const regionesEsp = [...new Set(del.map(regionEspeciesDeSpot))];
    const deTemporada = (especiesDatos?.especies || [])
      .filter((e) => regionesEsp.some((r) => e.presencia?.[r]?.meses?.includes(mes)))
      .map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEsp(e) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const titulo = T.region.titulo(nombreR, del.length);
    const descripcion = T.region.desc(nombreR, del.length, mesLargo(mes), deTemporada.slice(0, 5).map((e) => e.nombre.toLowerCase()).join(", "));
    const migas = [{ nombre: T.spot.migas, ruta: p(ruta) }];
    const ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${p(ruta)}`, inLanguage: T.lang, about: { "@type": "Place", name: nombreRegion(reg.slug) }, publisher: ORG_LD },
      migasJsonLd(migas),
    ];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(T.region.h1(nombreR))}</h1>
<p class="intro">${T.region.intro(del.length, esc(nombreRegion(reg.slug)), esc(rRegionMareas(reg.slug)), esc(rEspecies()))}</p>
<ul class="lista-spots">${del.map((s) => `<li><a href="${esc(rSpot(s.slug))}">${esc(nombreCortoSpot(s.nombre))}</a></li>`).join("")}</ul>
<section aria-labelledby="t-temp"><h2 id="t-temp">${esc(T.region.temporada(mesLargo(mes)))}</h2>
<ul class="chips">${deTemporada.map((e) => `<li><a href="${esc(rEspecie(e.slug))}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
${enlacesRegiones(reg.slug, rRegionSpots)}
${T.cta()}`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOgRegion(reg), imagenAlt: T.spot.imagenAlt(nombreR) }) };
  }

  function fichaEspecie(e, spots, mes) {
    const E = T.especie;
    const temporada = VA.REGIONES.filter((r) => e.presencia?.[r]?.meses?.length).map((r) => {
      const veda = VA.vedaActiva(e, r, mes);
      return {
        region: r, nombre: T.regionEspecie[r] || r, texto: textoMeses(e.presencia[r].meses), ahora: e.presencia[r].meses.includes(mes),
        freza: e.freza?.por_region?.[r]?.meses?.length ? textoMeses(e.freza.por_region[r].meses) : null,
        veda: veda ? (E.veda[veda.tipo] || E.vedaGen) : null,
      };
    });
    const modalidades = VA.MODALIDADES.filter((m) => e.modalidades?.[m]?.aplica === true).map((m) => ({
      id: m, nombre: T.modalidad[m],
      normativa: (e.modalidades[m].normativa || []).map((n) => ({ texto: solo(n, "texto"), url: n.url || null })).filter((n) => n.texto),
    }));
    const tallas = (e.talla_minima || []).filter((x) => Number.isFinite(x.valor_cm)).map((x) => {
      const base = solo(x, "ambito_corto") || solo(x, "ambito");
      if (!base) return null;
      const zona = E.zonaTalla[x.jurisdiccion];
      return { cm: x.valor_cm, ambito: zona ? `${base} · ${zona}` : base, url: x.url || null };
    }).filter(Boolean);
    const vedas = (e.vedas || []).map((v) => ({
      texto: solo(v, "texto") ? `${E.veda[v.tipo] || E.vedaGen}: ${solo(v, "texto")}` : (E.veda[v.tipo] || E.vedaGen),
      meses: textoMeses(v.meses), regiones: (v.regiones || []).map((r) => T.regionEspecie[r] || r), url: v.url || null,
    }));
    const cebos = [];
    const vistos = new Set();
    for (const c of e.cebos || []) {
      const n = solo(c, "nombre");
      if (!n || vistos.has(n.toLowerCase())) continue;
      vistos.add(n.toLowerCase());
      cebos.push({ nombre: n, modalidades: VA.modalidadesDeCebo(c).map((m) => T.modalidad[m]) });
    }
    const conPresencia = new Set(temporada.map((x) => x.region));
    const donde = spotsIberia(spots).filter((s) => conPresencia.has(regionEspeciesDeSpot(s)))
      .map((s) => ({ slug: s.slug, nombre: nombreCortoSpot(s.nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const otros = Object.entries(e.nombres || {}).filter(([k, v]) => k === "es" && v).map(([, v]) => v);
    return { id: e.id, slug: slugEspecie(e.id), emoji: e.emoji || "🐟", nombre: nombreEsp(e), cientifico: String(e.cientifico || "").trim() || null, otros, temporada, modalidades, tallas, vedas, cebos, donde };
  }

  function introEspecie(f, mes) {
    const E = T.especie;
    const partes = [E.intro(`${f.nombre}${f.cientifico && f.cientifico !== f.nombre ? ` (${f.cientifico})` : ""}`)];
    if (f.modalidades.length) partes.push(E.modalidades(lista(f.modalidades.map((m) => m.nombre.toLowerCase()))));
    const ahora = f.temporada.filter((x) => x.ahora && !x.veda).map((x) => x.nombre);
    if (ahora.length) partes.push(E.ahora(mesLargo(mes), lista(ahora)));
    if (f.tallas.length) {
      const min = Math.min(...f.tallas.map((x) => x.cm)), max = Math.max(...f.tallas.map((x) => x.cm));
      partes.push(min === max ? E.talla1(max) : E.talla2(min, max));
    }
    return partes.join(" ");
  }

  function paginaEspecie(e, especiesDatos, spots, mes) {
    const E = T.especie;
    const f = fichaEspecie(e, spots, mes);
    const n = f.nombre;
    const ruta = `/especies/${f.slug}`;
    const pub = rEspecie(f.slug);
    const intro = introEspecie(f, mes);
    const titulo = E.titulo(n);
    const descripcion = E.desc(`${n}${f.cientifico && f.cientifico !== n ? ` (${f.cientifico})` : ""}`, f.tallas.length ? E.descTalla(Math.min(...f.tallas.map((x) => x.cm))) : "");
    const migas = [{ nombre: E.migas, ruta: rEspecies() }, { nombre: n, ruta: pub }];
    const ld = [
      {
        "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}${pub}`, inLanguage: T.lang, description: intro,
        dateModified: especiesDatos.version || undefined,
        about: { "@type": "Thing", name: n, alternateName: [f.cientifico, ...f.otros].filter((x) => x && x !== n) }, publisher: ORG_LD,
      },
      migasJsonLd(migas),
    ];
    const aviso = solo(especiesDatos, "aviso_legal") || E.aviso;
    const cuerpo = `${migasHtml(migas, idioma)}
<h1><span aria-hidden="true">${esc(f.emoji)}</span> ${esc(n)}</h1>
<p class="cientifico">${f.cientifico && f.cientifico !== n ? `<em>${esc(f.cientifico)}</em>` : ""}${f.otros.length ? ` · ${f.otros.map((o) => `${esc(o)} <span class="nota">(${E.otroIdioma})</span>`).join(" · ")}` : ""}</p>
<p class="intro">${esc(intro)}</p>
${f.temporada.length ? `<section class="tarjeta" aria-labelledby="t-temp"><h2 id="t-temp">${E.epocaZonas}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${E.zona}</th><th scope="col">${E.mesesCol}</th><th scope="col">${E.desova}</th></tr></thead><tbody>
${f.temporada.map((x) => `<tr${x.ahora ? ' class="ahora"' : ""}><th scope="row">${esc(x.nombre)}</th><td>${esc(x.texto)}${x.ahora && !x.veda ? ` · <strong>${E.ahora_}</strong>` : ""}${x.veda ? ` · <strong>${esc(x.veda.toLowerCase())}</strong>` : ""}</td><td>${x.freza ? esc(x.freza) : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">${E.notaDesova}</p></section>` : ""}
${f.vedas.length ? `<section class="tarjeta aviso" aria-labelledby="t-veda"><h2 id="t-veda">${E.vedas}</h2><ul>${f.vedas.map((v) => `<li>${esc(v.texto)}${v.meses ? ` <span class="nota">(${esc(v.meses)}${v.regiones.length ? `; ${esc(v.regiones.join(", "))}` : ""})</span>` : ""}${v.url ? ` <a href="${esc(v.url)}" rel="noopener nofollow" target="_blank">${E.norma}</a>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.tallas.length ? `<section class="tarjeta" aria-labelledby="t-talla"><h2 id="t-talla">${E.talla}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${E.tallaCol}</th><th scope="col">${E.dondeAplica}</th><th scope="col">${E.normaCol}</th></tr></thead><tbody>
${f.tallas.map((x) => `<tr><td><strong>${x.cm} cm</strong></td><td>${esc(x.ambito)}</td><td>${x.url ? `<a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">${E.ver}</a>` : "–"}</td></tr>`).join("")}
</tbody></table></div>
<p class="nota">${esc(aviso)}</p></section>` : ""}
${f.modalidades.length ? `<section aria-labelledby="t-mod"><h2 id="t-mod">${E.comoSePesca}</h2><ul class="modos">${f.modalidades.map((m) => `<li><strong>${esc(m.nombre)}</strong>${m.normativa.length ? `<ul>${m.normativa.map((x) => `<li class="nota">${esc(x.texto)}${x.url ? ` <a href="${esc(x.url)}" rel="noopener nofollow" target="_blank">${E.norma}</a>` : ""}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></section>` : ""}
${f.cebos.length ? `<section aria-labelledby="t-cebos"><h2 id="t-cebos">${E.cebos}</h2><ul class="chips">${f.cebos.map((c) => `<li>${esc(c.nombre)}${c.modalidades.length ? ` <span class="nota">(${esc(c.modalidades.join(", ").toLowerCase())})</span>` : ""}</li>`).join("")}</ul></section>` : ""}
${T.cta(E.cta(n.toLowerCase()))}
${f.donde.length ? `<section aria-labelledby="t-donde"><h2 id="t-donde">${E.donde}</h2>
<ul class="chips">${f.donde.map((s) => `<li><a href="${esc(rSpot(s.slug))}">${esc(s.nombre)}</a></li>`).join("")}</ul></section>` : ""}
<p><a href="${esc(rEspecies())}">${E.todas}</a></p>`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ogTipo: "article", ...opciones, imagen: imagenOg("especies"), imagenAlt: E.imagenAlt }) };
  }

  function paginaIndiceEspecies(especiesDatos, mes, extra = "") {
    const E = T.especie;
    const ruta = "/especies";
    const ls = (especiesDatos?.especies || []).filter((e) => !String(e.id).startsWith("nz-"))
      .map((e) => ({ slug: slugEspecie(e.id), nombre: nombreEsp(e), cientifico: e.cientifico, emoji: e.emoji || "🐟", ahora: Object.values(e.presencia || {}).some((pr) => pr?.meses?.includes(mes)) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const titulo = E.tituloIndice;
    const descripcion = E.descIndice(ls.length);
    const migas = [{ nombre: E.migas, ruta: rEspecies() }];
    const ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${rEspecies()}`, inLanguage: T.lang, publisher: ORG_LD },
      migasJsonLd(migas),
    ];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${E.h1Indice}</h1>
<p class="intro">${E.introIndice(ls.length, esc(rRegionSpots("portugal")))}</p>
<section aria-labelledby="t-ahora"><h2 id="t-ahora">${esc(E.ahoraIndice(mesLargo(mes)))}</h2>
<ul class="chips">${ls.filter((e) => e.ahora).map((e) => `<li><a href="${esc(rEspecie(e.slug))}">${esc(e.nombre)}</a></li>`).join("")}</ul></section>
<section aria-labelledby="t-todas"><h2 id="t-todas">${E.todasH2}</h2>
<ul class="lista-especies">${ls.map((e) => `<li><a href="${esc(rEspecie(e.slug))}"><span aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.nombre)}</a>${e.cientifico && e.cientifico !== e.nombre ? ` <em class="nota">${esc(e.cientifico)}</em>` : ""}</li>`).join("")}</ul></section>
${extra}
${T.cta()}`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOg("especies"), imagenAlt: E.imagenAlt }) };
  }

  const hora24 = (etq) => {
    const m = /^(\d+)(am|pm)$/.exec(etq || "");
    if (!m) return etq || "";
    return `${String((Number(m[1]) % 12) + (m[2] === "pm" ? 12 : 0)).padStart(2, "0")}:00`;
  };

  function paginaMarea(sp, todos) {
    const M = T.marea;
    const nombre = nombreCortoSpot(sp.nombre);
    const region = regionDeSpot(sp.slug);
    const ruta = `/mareas/${sp.slug}`;
    const pub = rMarea(sp.slug);
    const proximas = sp.marea?.proximas || [];
    const pleamar = proximas.find((e) => e.tipo === "pleamar");
    const bajamar = proximas.find((e) => e.tipo === "bajamar");
    const cond = condiciones(sp);
    const resumen = [pleamar && `${T.evento.pleamar} ${textoEvento(pleamar)}`, bajamar && `${T.evento.bajamar} ${textoEvento(bajamar)}`].filter(Boolean).join(", ");
    const titulo = M.titulo(nombre);
    const descripcion = M.desc(nombre, resumen, cond?.ola, cond?.viento, cond?.tempAgua);
    const migas = [{ nombre: M.migas, ruta: rRegionMareas(region?.slug || "portugal") }, { nombre, ruta: pub }];
    const ld = [
      { "@context": "https://schema.org", "@type": "Place", name: nombre, geo: { "@type": "GeoCoordinates", latitude: sp.lat, longitude: sp.lon }, url: `${DOMINIO}${pub}` },
      {
        "@context": "https://schema.org", "@type": "WebPage", name: titulo, url: `${DOMINIO}${pub}`, inLanguage: T.lang,
        ...(sp.actualizado ? { dateModified: new Date(sp.actualizado).toISOString() } : {}),
        isPartOf: { "@type": "WebSite", name: "Costaviva", url: `${DOMINIO}/` }, about: { "@type": "Place", name: nombre },
      },
      migasJsonLd(migas),
    ];
    const actualizado = sp.actualizado ? new Date(sp.actualizado).toLocaleString(T.locale, { timeZone: zonaDeSpot(sp) }) : null;
    const filas = (sp.bloques || []).map((x) => `<tr><td>${esc(hora24(x.hora))}</td><td>${x.altura ? `${fmt(x.altura[0])}–${fmt(x.altura[1])} m` : "–"}</td><td>${x.viento ?? "–"} km/h ${esc(x.dirViento ?? "")}</td><td>${x.tempAgua != null ? `${fmt(x.tempAgua)} °C` : "–"}</td></tr>`).join("");
    const cercanos = spotsCercanos(spotsIberia(todos), sp, 8);
    const celda = (etq, val) => (val ? `<div class="dato"><span class="dato-etq">${etq}</span><span class="dato-val">${esc(val)}</span></div>` : "");
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(M.h1(nombre))}</h1>
${actualizado ? `<p class="nota">${esc(M.actualizado(actualizado))}</p>` : ""}
<section class="tarjeta hoy" aria-labelledby="t-marea"><h2 id="t-marea">${M.proximas}</h2>
<div class="datos">${celda(M.pleamar, pleamar ? textoEvento(pleamar) : null)}${celda(M.bajamar, bajamar ? textoEvento(bajamar) : null)}${celda(M.ahora, cond?.marea || null)}${celda(M.ola, cond?.ola || null)}${celda(M.viento, cond?.viento || null)}${celda(M.agua, cond?.tempAgua || null)}</div>
${sp.marea?.coeficiente ? `<p class="nota">${esc(M.coef(sp.marea.coeficiente))}</p>` : ""}
${sp.marea?.referencia ? `<p class="nota">${esc(M.ref(sp.marea.referencia.puerto))} <a href="${esc(sp.marea.referencia.url)}" rel="noopener">${esc(sp.marea.referencia.fuente)}</a>.</p>` : ""}</section>
${T.cta()}
${filas ? `<section aria-labelledby="t-prev"><h2 id="t-prev">${esc(M.prev(nombre))}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${M.hora}</th><th scope="col">${M.ola}</th><th scope="col">${M.viento}</th><th scope="col">${M.agua}</th></tr></thead><tbody>${filas}</tbody></table></div></section>` : ""}
<p class="nota">${esc(M.nota(nombre))}</p>
${cercanos.length ? `<section aria-labelledby="t-cerca"><h2 id="t-cerca">${M.cercanos}</h2><ul class="chips">${cercanos.map((s) => `<li><a href="${esc(rMarea(s.slug))}">${esc(nombreCortoSpot(s.nombre))}</a></li>`).join("")}</ul></section>` : ""}
<p><a href="${esc(rSpot(sp.slug))}">${esc(M.pescaEn(nombre))}</a></p>
${region ? `<p><a href="${esc(rRegionMareas(region.slug))}">${esc(M.todaCosta(nombreRegionCorto(region.slug)))}</a></p>` : ""}`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOgRegion(region || REGIONES_MAREAS[0]), imagenAlt: M.h1(nombre) }) };
  }

  function paginaRegionMareas(regionSlug, spotsPrev) {
    const M = T.marea;
    const reg = regionIb(regionSlug);
    if (!reg) return null;
    const del = (spotsPrev || []).filter((s) => reg.spots.has(s.slug) && !s.error).sort((a, b) => a.nombre.localeCompare(b.nombre, T.locale));
    const ruta = `/mareas/region/${reg.slug}`;
    const pub = rRegionMareas(reg.slug);
    const nombreR = nombreRegionCorto(reg.slug);
    const titulo = M.tituloRegion(nombreR);
    const descripcion = M.descRegion(nombreR, del.length);
    const migas = [{ nombre: M.migas, ruta: pub }];
    const ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${pub}`, inLanguage: T.lang, about: { "@type": "Place", name: nombreRegion(reg.slug) }, publisher: ORG_LD },
      migasJsonLd(migas),
    ];
    const ev = (s, tipo) => (s.marea?.proximas || []).find((e) => e.tipo === tipo);
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(M.h1Region(nombreR))}</h1>
<p class="intro">${esc(descripcion)}</p>
${T.cta()}
<section aria-labelledby="t-tabla"><h2 id="t-tabla">${M.tablaRegion}</h2>
<div class="tabla-env"><table><thead><tr><th scope="col">${M.pesqueiro}</th><th scope="col">${M.pleamarCol}</th><th scope="col">${M.bajamarCol}</th><th scope="col">${M.onda}</th><th scope="col">${M.viento}</th></tr></thead><tbody>
${del.map((s) => {
    const pl = ev(s, "pleamar"), b = ev(s, "bajamar"), o = s.bloques?.[0];
    return `<tr><th scope="row"><a href="${esc(rMarea(s.slug))}">${esc(nombreCortoSpot(s.nombre))}</a> <small><a href="${esc(rSpot(s.slug))}">${M.pesca}</a></small></th><td>${pl ? esc(textoEvento(pl)) : "–"}</td><td>${b ? esc(textoEvento(b)) : "–"}</td><td>${o?.altura ? `${fmt(o.altura[0])}–${fmt(o.altura[1])} m` : "–"}</td><td>${o?.viento != null ? `${o.viento} km/h ${esc(o.dirViento || "")}` : "–"}</td></tr>`;
  }).join("\n")}
</tbody></table></div>
<p class="nota">${M.notaRegion}</p></section>
${enlacesRegiones(reg.slug, rRegionMareas)}
<p><a href="${esc(rRegionSpots(reg.slug))}">${esc(M.queSePesca(nombreR))}</a></p>`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOgRegion(reg), imagenAlt: M.h1Region(nombreR) }) };
  }

  // Lista de regiones de España y Portugal (índices /<l>/spots y /<l>/mareas,
  // o sección dentro de los índices de Nueva Zelanda en inglés).
  function listaRegiones(tipo, spots) {
    const ruta = tipo === "mareas" ? rRegionMareas : rRegionSpots;
    const ib = spotsIberia(spots);
    return `<ul class="chips">${REGIONES_MAREAS.map((r) => `<li><a href="${esc(ruta(r.slug))}">${esc(nombreRegionCorto(r.slug))}</a> <span class="nota">(${esc(T.indice.pesqueiros(ib.filter((s) => r.spots.has(s.slug)).length))})</span></li>`).join("")}</ul>`;
  }
  const seccionIberia = (tipo, spots) => `<section aria-labelledby="t-iberia"><h2 id="t-iberia">${esc(T.indice.iberia)}</h2>${listaRegiones(tipo, spots)}</section>`;

  function paginaIndice(tipo, spots, extra = "") {
    const I = T.indice;
    const ruta = tipo === "mareas" ? "/mareas" : "/spots";
    const pub = tipo === "mareas" ? p(`/${T.rutaMareas}`) : p("/spots");
    const n = spotsIberia(spots).length;
    const titulo = tipo === "mareas" ? I.mareasTitulo : I.spotsTitulo;
    const descripcion = tipo === "mareas" ? I.mareasDesc(n) : I.spotsDesc(n);
    const migas = [{ nombre: tipo === "mareas" ? T.marea.migas : T.spot.migas, ruta: pub }];
    const ld = [{ "@context": "https://schema.org", "@type": "CollectionPage", name: titulo, url: `${DOMINIO}${pub}`, inLanguage: T.lang, publisher: ORG_LD }, migasJsonLd(migas)];
    const cuerpo = `${migasHtml(migas, idioma)}
<h1>${esc(tipo === "mareas" ? I.mareasH1 : I.spotsH1)}</h1>
<p class="intro">${esc(descripcion)}</p>
<section aria-labelledby="t-zonas"><h2 id="t-zonas">${esc(I.zonas)}</h2>${listaRegiones(tipo, spots)}</section>
${extra}
<p><a href="${esc(rEspecies())}">${esc(T.especie.migas)} →</a></p>
${T.cta()}`;
    return { titulo, html: documento({ titulo, descripcion, ruta, cuerpo, ld, ...opciones, imagen: imagenOg("especies"), imagenAlt: titulo }) };
  }

  // URLs del sitemap de este idioma para España y Portugal.
  function urls({ spots, especies, fecha, fechaEspecies }) {
    const u = (ruta, lastmod, changefreq, priority) => ({ loc: `${DOMINIO}${ruta}`, lastmod, changefreq, priority });
    const ib = spotsIberia(spots).sort((a, b) => a.slug.localeCompare(b.slug));
    return [
      ...(idioma === "en" ? [] : [u(p("/spots"), fecha, "daily", "0.85"), u(p(`/${T.rutaMareas}`), fecha, "daily", "0.8")]),
      ...REGIONES_MAREAS.map((r) => u(rRegionSpots(r.slug), fecha, "daily", "0.8")),
      ...REGIONES_MAREAS.map((r) => u(rRegionMareas(r.slug), fecha, "daily", "0.75")),
      ...(idioma === "en" ? [] : [u(rEspecies(), fechaEspecies, "weekly", "0.8")]),
      ...ib.map((s) => u(rSpot(s.slug), fecha, "daily", "0.7")),
      ...ib.map((s) => u(rMarea(s.slug), fecha, "hourly", "0.7")),
      ...[...(especies || [])].filter((e) => !String(e.id).startsWith("nz-")).sort((a, b) => a.id.localeCompare(b.id)).map((e) => u(rEspecie(slugEspecie(e.id)), fechaEspecies, "monthly", "0.6")),
    ];
  }

  return {
    idioma, textoMeses, nombreEsp, motivo, condiciones, introSpot, fichaEspecie, introEspecie, mesLargo,
    paginaSpot, paginaRegionSpots, paginaEspecie, paginaIndiceEspecies, paginaMarea, paginaRegionMareas, paginaIndice, seccionIberia, urls,
    nombreRegion, rutas: { rSpot, rMarea, rEspecie, rEspecies, rRegionSpots, rRegionMareas },
  };
}

export const IB = { pt: crearPaginasIb("pt"), en: crearPaginasIb("en") };
