// functions/mareas/_regiones.js
// Compartido entre index.js, [slug].js y region/[region].js -- el guion
// bajo al principio del nombre hace que Cloudflare Pages NO lo trate
// como una ruta (mismo mecanismo que _middleware.js), es solo un módulo
// de utilidad para importar.
//
// Nivel intermedio de páginas por región (Fase 2 de SEO, pedido
// explícito del usuario 2026-09-19): entre el índice general (/mareas)
// y cada spot, para que Google entienda mejor la jerarquía del sitio y
// puedan rankear también búsquedas de ámbito regional ("mareas País
// Vasco").
//
// Mediterráneo/Golfo de Cádiz/Canarias reutilizan EXACTAMENTE los mismos
// slugs ya curados a mano en index.html (SPOTS_MEDITERRANEO/
// SPOTS_GOLFO_CADIZ/SPOTS_CANARIAS) -- mantener sincronizado a mano si
// cambian allí, mismo criterio que otras listas duplicadas del repo
// (WEBCAMS_HLS, etc.) porque este fichero no puede importar un <script>
// de un .html directamente.
//
// Galicia/Asturias/Cantabria/País Vasco/Portugal se clasificaron a mano
// 2026-09-19 revisando las coordenadas reales de los 53 spots que
// quedaban fuera de esas tres listas (no es una aproximación por
// longitud -- se comprobó pueblo a pueblo, incluidos los casos límite
// como Ribadeo -- que es Galicia, no Asturias, aunque roza la frontera
// -- y Castro Urdiales -- que es Cantabria, no País Vasco, aunque su
// longitud sola habría sugerido lo contrario).

const MEDITERRANEO = new Set(["roses","blanes","cambrils","peniscola","valencia","gandia","denia","calpe","cartagena","aguilas","cabodepalos","malaga","nerja","almeria","roquetas","palma","ciutadella","formentera","alicante","altea","benidorm","guardamardelsegura","vilajoiosa","orihuelacosta","pilardelahoradada","santapola","javea","alcossebre","benicassim","burriana","castellon","xilxes","oropesa","torreblanca","vinaros","alboraya","canetdeberenguer","cullera","pobladefarnals","oliva","piles","calamillor","sonbou","muro"]);
const GOLFO_CADIZ = new Set(["cadiz","conil","chipiona","puntaumbria"]);
const CANARIAS = new Set(["laspalmas","santacruztenerife","elmedano","corralejo"]);
const PORTUGAL = new Set(["cascais","ericeira","peniche","costadacaparica","nazare","sagres","troia","sines","figueiradafoz","vianadocastelo","milfontes","povoadevarzim","aveiro","matosinhos","lagos","faro","moledo"]);
const GALICIA = new Set(["camarinas","corrubedo","ons","portosin","aguarda","baiona","sanxenxo","cangas","cies","acoruna","ribadeo"]);
const ASTURIAS = new Set(["ribadesella","llanes"]);
const CANTABRIA = new Set(["sanvicente","comillas","suances","santander","santona","laredo","castrourdiales"]);
const PAIS_VASCO = new Set(["getxo","sopelana","plentzia","bakio","mundaka","lekeitio","ondarroa","mutriku","deba","zumaia","getaria","zarautz","orio","donostia","pasaia","hondarribia"]);

export const REGIONES = [
  { slug: "pais-vasco", nombre: "País Vasco", alias: "Euskadi", spots: PAIS_VASCO },
  { slug: "cantabria", nombre: "Cantabria", spots: CANTABRIA },
  { slug: "asturias", nombre: "Asturias", spots: ASTURIAS },
  { slug: "galicia", nombre: "Galicia", spots: GALICIA },
  { slug: "portugal", nombre: "Portugal", spots: PORTUGAL },
  { slug: "mediterraneo", nombre: "Mediterráneo (Cataluña, C. Valenciana, Murcia, Andalucía, Baleares)", spots: MEDITERRANEO },
  { slug: "golfo-de-cadiz", nombre: "Golfo de Cádiz", spots: GOLFO_CADIZ },
  { slug: "canarias", nombre: "Canarias", spots: CANARIAS },
];

// Títulos para buscadores (2026-11-19, Mikel: «cambia todos»). La gente
// busca por pueblo ("mareas bilbao", "mareas cádiz hoy", "mareas
// cantabria"), y el título solo decía la región. Cada región lleva:
//   - lugar: cómo se busca la región ("Euskadi", "Cádiz"...);
//   - pueblos: 3-4 pueblos con spot, los más buscados (título de mareas);
//   - zonas: comarcas o provincias (título de pesca).
// Solo pueblos y zonas donde HAY spots de la región (ver los Set de arriba).
export const TITULOS_REGION = {
  "pais-vasco": { lugar: "Euskadi", lugarPesca: "Euskadi", pueblos: "Getxo, Bakio, Mundaka y Donostia", zonas: "Bizkaia y Gipuzkoa" },
  cantabria: { lugar: "Cantabria", lugarPesca: "Cantabria", pueblos: "Santander, Laredo y Castro Urdiales", zonas: "Santander, Laredo y Castro" },
  asturias: { lugar: "Asturias", lugarPesca: "Asturias", pueblos: "Llanes y Ribadesella", zonas: "Llanes y Ribadesella" },
  galicia: { lugar: "Galicia", lugarPesca: "Galicia", pueblos: "A Coruña, Baiona, Sanxenxo y Cangas", zonas: "Rías Baixas, Costa da Morte y A Coruña" },
  portugal: { lugar: "Portugal", lugarPesca: "Portugal", pueblos: "Peniche, Ericeira, Cascais y Nazaré", zonas: "Algarve, Lisboa, Peniche y el Norte" },
  mediterraneo: { lugar: "el Mediterráneo", lugarPesca: "el Mediterráneo", pueblos: "Dénia, Valencia, Alicante y Málaga", zonas: "Cataluña, Levante, Andalucía y Baleares" },
  "golfo-de-cadiz": { lugar: "Cádiz", lugarPesca: "el Golfo de Cádiz", pueblos: "Cádiz, Conil, Chipiona y Punta Umbría", zonas: "Cádiz y Huelva" },
  canarias: { lugar: "Canarias", lugarPesca: "Canarias", pueblos: "Las Palmas, Tenerife y Corralejo", zonas: "Gran Canaria, Tenerife y Fuerteventura" },
};
export const tituloMareasRegion = (r) => {
  const t = TITULOS_REGION[r.slug];
  return t ? `Mareas hoy en ${t.lugar}: ${t.pueblos} | Costaviva` : `Mareas hoy en ${r.nombre}: pleamar, bajamar y oleaje | Costaviva`;
};
export const tituloPescaRegion = (r, n) => {
  const t = TITULOS_REGION[r.slug];
  return t ? `Pesca en ${t.lugarPesca}: ${n} spots en ${t.zonas} | Costaviva` : null;
};

export function regionDeSlug(slugSpot) {
  return REGIONES.find((r) => r.spots.has(slugSpot)) || null;
}
