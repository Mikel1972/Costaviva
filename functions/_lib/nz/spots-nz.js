// functions/_lib/nz/spots-nz.js
// Los 60 spots de Nueva Zelanda (fase 1 de NZ, 2026-10-09). OCULTOS: solo
// entran en SPOTS (prevision.js), el mapa, el SEO, el sitemap o el
// marketing cuando "nz" está en REGIONES_ACTIVAS
// (functions/_lib/regiones-activas.js). Hasta entonces nada de esto se ve.
//
// Origen: plan de NZ de 2026-10-09 (tabla de §4). Coordenadas de Nominatim
// de OpenStreetMap (ODbL 1.0, "© OpenStreetMap contributors"), con el id OSM
// y su etiqueta en `osm`.
//
// Campos (los mismos de los SPOTS de España, más los de región):
//   slug          con prefijo "nz-" para no chocar nunca con uno de España.
//   pais          "nz" (lo que mira el interruptor).
//   region        área de pesca recreativa de MPI (nz_auckland_kermadec,
//                 nz_central, nz_challenger, nz_south_east, nz_kaikoura,
//                 nz_southland, nz_fiordland), la misma clave que usarán
//                 `presencia`/`freza` de especies.json. Asignada a mano por
//                 la costa (FMA 1/9 → Auckland/Kermadec, 2/8 → Central,
//                 7 → Challenger, 3-4 → South-East, 5-6 → Southland): la capa
//                 oficial de límites de MPI es "for internal use only", así
//                 que hay que cotejarla con el texto de la regulación antes de
//                 enseñar normas por región.
//   zona          una de las 14 zonas del plan (para agrupar en pantalla).
//   tz            "Pacific/Auckland".
//   modalidades   costa / embarcacion, como en el plan.
//   revisar_ubicacion  true cuando el punto es el centro del pueblo, del
//                 fiordo o de un edificio y no el pesquero (muelle, punta,
//                 desembocadura). Hay que moverlo con OSM o el Gazetteer de
//                 LINZ antes de publicar.
//   puerto_linz   puerto LINZ de la marea: { id (secundario), nombre, km,
//                 tabla (nombre del CSV propio, o null si se calcula como
//                 secundario de su puerto estándar) }. Lo elige
//                 asignarPuerto() de mareas-linz.js sobre datos/nz/
//                 linz-puertos.json; test/nz-mareas.test.js comprueba que no
//                 se ha quedado desfasado.
//
// Chatham y Kermadec quedan fuera (antimeridiano), como dice el plan.

export const ZONA_HORARIA_NZ = "Pacific/Auckland";

const BASE = [
  // Northland
  { slug: "nz-cape-reinga", nombre: "Cape Reinga / Te Rerenga Wairua", lat: -34.4202, lon: 172.6793, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "node/1883511786 natural=cape", puerto_linz: { id: "6386b", nombre: "Cape Reinga / Te Rerenga Wairua", km: 1.2, tabla: null } },
  { slug: "nz-ninety-mile-beach", nombre: "Ninety Mile Beach (Ahipara)", lat: -35.1713, lon: 173.1534, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "node/1750928663 place=town", revisar_ubicacion: true, puerto_linz: { id: "6384", nombre: "Ahipara Bay", km: 3.4, tabla: null } },
  { slug: "nz-houhora-heads", nombre: "Houhora Heads", lat: -34.8259, lon: 173.1466, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa","embarcacion"], osm: "node/1540086325 place=hamlet", revisar_ubicacion: true, puerto_linz: { id: "6387d", nombre: "Houhora Harbour Entrance", km: 0.9, tabla: null } },
  { slug: "nz-whangaroa-harbour", nombre: "Whangaroa Harbour", lat: -35.0493, lon: 173.7441, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "node/581811365 place=village", revisar_ubicacion: true, puerto_linz: { id: "6390", nombre: "Whangaroa", km: 0.5, tabla: "Whangaroa" } },
  { slug: "nz-paihia", nombre: "Paihia (Bay of Islands)", lat: -35.2812, lon: 174.0921, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa","embarcacion"], osm: "way/1442884916 place=town", revisar_ubicacion: true, puerto_linz: { id: "6390f", nombre: "Waitangi", km: 1.8, tabla: null } },
  { slug: "nz-russell", nombre: "Russell (Bay of Islands)", lat: -35.2618, lon: 174.1215, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "node/251192130 place=village", revisar_ubicacion: true, puerto_linz: { id: "6391", nombre: "Russell", km: 0.7, tabla: null } },
  { slug: "nz-tutukaka", nombre: "Tutukaka", lat: -35.6083, lon: 174.5244, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "node/332339615 place=village", revisar_ubicacion: true, puerto_linz: { id: "6393", nombre: "Tutukaka Harbour", km: 1.2, tabla: null } },
  { slug: "nz-whangarei-heads", nombre: "Whangarei Heads", lat: -35.8165, lon: 174.5054, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "node/6778470065 place=village", revisar_ubicacion: true, puerto_linz: { id: "6394", nombre: "Marsden Point", km: 1.9, tabla: "Marsden Point" } },
  { slug: "nz-kaipara-heads", nombre: "Kaipara Heads (Pouto)", lat: -36.3634, lon: 174.181, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "node/1775938008 place=hamlet", revisar_ubicacion: true, puerto_linz: { id: "6377", nombre: "Pouto Point", km: 0.4, tabla: "Pouto Point" } },
  // Auckland / Hauraki Gulf
  { slug: "nz-mangawhai-heads", nombre: "Mangawhai Heads", lat: -36.0948, lon: 174.5872, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "node/1420555131 place=town", revisar_ubicacion: true, puerto_linz: { id: "6396a", nombre: "Mangawhai Heads", km: 1.7, tabla: null } },
  { slug: "nz-leigh", nombre: "Leigh", lat: -36.2904, lon: 174.8043, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa","embarcacion"], osm: "node/251601838 place=village", revisar_ubicacion: true, puerto_linz: { id: "6396b", nombre: "Leigh", km: 0.9, tabla: "Leigh" } },
  { slug: "nz-gulf-harbour", nombre: "Gulf Harbour (Whangaparaoa)", lat: -36.619, lon: 174.7926, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["embarcacion"], osm: "node/258771953 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6399", nombre: "Weiti River Entrance", km: 6.3, tabla: "Weiti River Entrance" } },
  { slug: "nz-half-moon-bay", nombre: "Half Moon Bay (Bucklands Beach)", lat: -36.8789, lon: 174.9008, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["embarcacion"], osm: "way/28530188 leisure=marina", puerto_linz: { id: "6401c", nombre: "Tāmaki River", km: 5, tabla: "Tāmaki River" } },
  { slug: "nz-kawakawa-bay", nombre: "Kawakawa Bay", lat: -36.9481, lon: 175.169, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa","embarcacion"], osm: "node/1027255664 place=village", revisar_ubicacion: true, puerto_linz: { id: "6402a", nombre: "Sandspit Passage", km: 5.5, tabla: null } },
  { slug: "nz-muriwai", nombre: "Muriwai", lat: -36.8247, lon: 174.4339, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "node/605212636 place=town", revisar_ubicacion: true, puerto_linz: { id: "6375c", nombre: "Anawhata", km: 12.2, tabla: "Anawhata" } },
  { slug: "nz-manukau-heads", nombre: "Manukau Heads (Awhitu)", lat: -37.05, lon: 174.5605, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "node/10677310125 natural=peak", revisar_ubicacion: true, puerto_linz: { id: "6373", nombre: "Paratutae Island", km: 3.9, tabla: "Paratutae Island" } },
  // Coromandel
  { slug: "nz-coromandel-town", nombre: "Coromandel town", lat: -36.7602, lon: 175.4973, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["embarcacion"], osm: "node/59694792 place=town", revisar_ubicacion: true, puerto_linz: { id: "6405", nombre: "Coromandel Harbour - Whanganui Island", km: 4.9, tabla: null } },
  { slug: "nz-whitianga", nombre: "Whitianga", lat: -36.8332, lon: 175.7025, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["embarcacion"], osm: "node/254273924 place=town", revisar_ubicacion: true, puerto_linz: { id: "6411", nombre: "Whitianga", km: 0.2, tabla: "Whitianga" } },
  { slug: "nz-tairua", nombre: "Tairua", lat: -36.9999, lon: 175.8502, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["costa","embarcacion"], osm: "node/59012508 place=town", revisar_ubicacion: true, puerto_linz: { id: "6412", nombre: "Tairua", km: 1.9, tabla: null } },
  { slug: "nz-whangamata", nombre: "Whangamata", lat: -37.2063, lon: 175.872, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["costa","embarcacion"], osm: "node/60729253 place=town", revisar_ubicacion: true, puerto_linz: { id: "6413a", nombre: "Whangamatā", km: 1.2, tabla: null } },
  // Bay of Plenty
  { slug: "nz-waihi-beach", nombre: "Waihi Beach / Bowentown", lat: -37.4655, lon: 175.9856, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa"], osm: "node/11110847390 place=locality", revisar_ubicacion: true, puerto_linz: { id: "6413b", nombre: "Waihi Beach", km: 9.3, tabla: null } },
  { slug: "nz-tauranga", nombre: "Tauranga (Sulphur Point)", lat: -37.6663, lon: 176.1709, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["embarcacion"], osm: "node/3939284015 place=quarter", revisar_ubicacion: true, puerto_linz: { id: "6415", nombre: "Tauranga", km: 2.1, tabla: "Tauranga" } },
  { slug: "nz-whakatane", nombre: "Whakatane", lat: -37.9519, lon: 176.9946, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa","embarcacion"], osm: "node/248764278 place=town", revisar_ubicacion: true, puerto_linz: { id: "6417b", nombre: "Whakatāne", km: 0.5, tabla: "Whakatāne" } },
  { slug: "nz-te-kaha", nombre: "Te Kaha", lat: -37.7392, lon: 177.6786, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa","embarcacion"], osm: "node/1918506971 place=village", revisar_ubicacion: true, puerto_linz: { id: "6419a", nombre: "Te Kaha", km: 3.2, tabla: null } },
  // Gisborne / Hawke's Bay
  { slug: "nz-tolaga-bay-wharf", nombre: "Tolaga Bay Wharf", lat: -38.383, lon: 178.3185, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["costa"], osm: "node/4283656489 historic=monument", puerto_linz: { id: "6423b", nombre: "Tolaga Bay Wharf", km: 0.2, tabla: null } },
  { slug: "nz-gisborne", nombre: "Gisborne", lat: -38.6613, lon: 178.0206, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["embarcacion"], osm: "node/60269696 place=city", revisar_ubicacion: true, puerto_linz: { id: "6425", nombre: "Gisborne", km: 1.3, tabla: "Gisborne" } },
  { slug: "nz-napier", nombre: "Napier (Ahuriri)", lat: -39.4817, lon: 176.8996, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["costa","embarcacion"], osm: "way/1444522727 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6432", nombre: "Napier", km: 1.5, tabla: "Napier" } },
  // Waikato oeste
  { slug: "nz-raglan", nombre: "Raglan", lat: -37.7998, lon: 174.8682, region: "nz_auckland_kermadec", zona: "Waikato oeste", modalidades: ["costa","embarcacion"], osm: "node/368177945 place=town", revisar_ubicacion: true, puerto_linz: { id: "6371", nombre: "Raglan", km: 1.3, tabla: "Raglan" } },
  { slug: "nz-kawhia", nombre: "Kawhia", lat: -38.0644, lon: 174.8226, region: "nz_auckland_kermadec", zona: "Waikato oeste", modalidades: ["costa","embarcacion"], osm: "node/249551447 place=village", revisar_ubicacion: true, puerto_linz: { id: "6369", nombre: "Kawhia", km: 0.6, tabla: "Kawhia" } },
  // Taranaki
  { slug: "nz-new-plymouth", nombre: "New Plymouth (Port Taranaki)", lat: -39.0561, lon: 174.0298, region: "nz_central", zona: "Taranaki", modalidades: ["costa","embarcacion"], osm: "relation/16117166 landuse=industrial", puerto_linz: { id: "6366", nombre: "Port Taranaki", km: 0.7, tabla: "Port Taranaki" } },
  { slug: "nz-opunake", nombre: "Opunake", lat: -39.4547, lon: 173.8602, region: "nz_central", zona: "Taranaki", modalidades: ["costa"], osm: "node/1363970465 place=town", revisar_ubicacion: true, puerto_linz: { id: "6451", nombre: "Ōpunake Bay", km: 1.6, tabla: null } },
  // Wellington
  { slug: "nz-mana", nombre: "Mana (Porirua)", lat: -41.0976, lon: 174.8695, region: "nz_central", zona: "Wellington", modalidades: ["embarcacion"], osm: "relation/13470382 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6443", nombre: "Mana Marina", km: 0.4, tabla: "Mana Marina" } },
  { slug: "nz-wellington-harbour", nombre: "Wellington Harbour (Seatoun)", lat: -41.3236, lon: 174.8334, region: "nz_central", zona: "Wellington", modalidades: ["costa","embarcacion"], osm: "node/277081719 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6439", nombre: "Wellington", km: 6.1, tabla: "Wellington" } },
  { slug: "nz-palliser-bay", nombre: "Turakirae / Palliser Bay", lat: -41.5877, lon: 175.2341, region: "nz_central", zona: "Wellington", modalidades: ["costa","embarcacion"], osm: "node/1068576966 place=hamlet", revisar_ubicacion: true, puerto_linz: { id: "6438a", nombre: "Ngawi", km: 0.5, tabla: null } },
  { slug: "nz-castlepoint", nombre: "Castlepoint", lat: -40.9009, lon: 176.2217, region: "nz_central", zona: "Wellington", modalidades: ["costa"], osm: "node/303655641 place=village", revisar_ubicacion: true, puerto_linz: { id: "6436", nombre: "Castlepoint", km: 1.8, tabla: "Castlepoint" } },
  // Nelson / Marlborough
  { slug: "nz-nelson", nombre: "Nelson (Tahunanui)", lat: -41.2862, lon: 173.2439, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa"], osm: "node/2372957073 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6458", nombre: "Nelson", km: 2.9, tabla: "Nelson" } },
  { slug: "nz-kaiteriteri", nombre: "Kaiteriteri", lat: -41.037, lon: 173.0167, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa","embarcacion"], osm: "node/82799650 place=village", revisar_ubicacion: true, puerto_linz: { id: "6456", nombre: "Kaiteriteri", km: 1.4, tabla: "Kaiteriteri" } },
  { slug: "nz-picton", nombre: "Picton", lat: -41.2909, lon: 174.0069, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["embarcacion"], osm: "node/53442053 place=town", revisar_ubicacion: true, puerto_linz: { id: "6477", nombre: "Picton", km: 1, tabla: "Picton" } },
  { slug: "nz-french-pass", nombre: "French Pass", lat: -40.9228, lon: 173.8337, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["embarcacion"], osm: "way/780065933 natural=strait", puerto_linz: { id: "6466b", nombre: "Man-o-War Bay / Pāharakeke", km: 1.2, tabla: null } },
  { slug: "nz-collingwood", nombre: "Collingwood (Golden Bay)", lat: -40.6773, lon: 172.6827, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa"], osm: "node/384966558 place=village", revisar_ubicacion: true, puerto_linz: { id: "6528", nombre: "Whanganui Inlet", km: 13.4, tabla: null } },
  // Canterbury
  { slug: "nz-kaikoura", nombre: "Kaikoura", lat: -42.4006, lon: 173.6811, region: "nz_kaikoura", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "node/205039578 place=town", revisar_ubicacion: true, puerto_linz: { id: "6487", nombre: "Kaikōura", km: 2.4, tabla: "Kaikōura" } },
  { slug: "nz-motunau-beach", nombre: "Motunau Beach", lat: -43.0463, lon: 173.0713, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "node/4599132630 place=village", revisar_ubicacion: true, puerto_linz: { id: "6488b", nombre: "Motunau Beach", km: 0.6, tabla: null } },
  { slug: "nz-lyttelton", nombre: "Lyttelton", lat: -43.6025, lon: 172.7206, region: "nz_south_east", zona: "Canterbury", modalidades: ["embarcacion"], osm: "relation/18972001 place=suburb", revisar_ubicacion: true, puerto_linz: { id: "6490", nombre: "Lyttelton", km: 0.4, tabla: "Lyttelton" } },
  { slug: "nz-akaroa", nombre: "Akaroa", lat: -43.8043, lon: 172.9678, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "relation/2726039 boundary=administrative", revisar_ubicacion: true, puerto_linz: { id: "6490f", nombre: "Akaroa", km: 0.5, tabla: "Akaroa" } },
  { slug: "nz-timaru", nombre: "Timaru", lat: -44.393, lon: 171.251, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "node/410464091 place=town", revisar_ubicacion: true, puerto_linz: { id: "6492", nombre: "Timaru", km: 1.1, tabla: "Timaru" } },
  // Otago
  { slug: "nz-oamaru", nombre: "Oamaru", lat: -45.1, lon: 170.9698, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "node/206015894 place=town", revisar_ubicacion: true, puerto_linz: { id: "6494", nombre: "Oamaru", km: 1.1, tabla: "Oamaru" } },
  { slug: "nz-moeraki", nombre: "Moeraki", lat: -45.361, lon: 170.8515, region: "nz_south_east", zona: "Otago", modalidades: ["costa","embarcacion"], osm: "node/338530778 place=village", revisar_ubicacion: true, puerto_linz: { id: "6495", nombre: "Moeraki", km: 1.2, tabla: null } },
  { slug: "nz-karitane", nombre: "Karitane", lat: -45.638, lon: 170.6543, region: "nz_south_east", zona: "Otago", modalidades: ["costa","embarcacion"], osm: "node/1802506263 place=village", revisar_ubicacion: true, puerto_linz: { id: "6496", nombre: "Spit Wharf", km: 16.9, tabla: "Spit Wharf" } },
  { slug: "nz-aramoana", nombre: "Aramoana (Otago Harbour mole)", lat: -45.7769, lon: 170.7058, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "node/1636467655 place=village", revisar_ubicacion: true, puerto_linz: { id: "6496", nombre: "Spit Wharf", km: 1.1, tabla: "Spit Wharf" } },
  { slug: "nz-kaka-point", nombre: "Kaka Point (Catlins)", lat: -46.3841, lon: 169.7855, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "node/11661743217 natural=cape", puerto_linz: { id: "6500", nombre: "Nugget Point", km: 7.7, tabla: null } },
  // Southland
  { slug: "nz-riverton", nombre: "Riverton / Aparima", lat: -46.351, lon: 168.0203, region: "nz_southland", zona: "Southland", modalidades: ["costa","embarcacion"], osm: "node/983008811 place=town", revisar_ubicacion: true, puerto_linz: { id: "6505d", nombre: "Riverton - Aparima", km: 1.8, tabla: "Riverton - Aparima" } },
  { slug: "nz-bluff", nombre: "Bluff", lat: -46.5988, lon: 168.3434, region: "nz_southland", zona: "Southland", modalidades: ["embarcacion"], osm: "node/974363520 place=town", revisar_ubicacion: true, puerto_linz: { id: "6504", nombre: "Bluff", km: 0.5, tabla: "Bluff" } },
  { slug: "nz-halfmoon-bay", nombre: "Halfmoon Bay / Oban (Stewart Island)", lat: -46.901, lon: 168.1247, region: "nz_southland", zona: "Southland", modalidades: ["embarcacion"], osm: "node/498807721 amenity=police", revisar_ubicacion: true, puerto_linz: { id: "6506c", nombre: "Halfmoon Bay - Oban", km: 0.7, tabla: "Halfmoon Bay - Oban" } },
  { slug: "nz-te-waewae-bay", nombre: "Te Waewae Bay (Monkey Island)", lat: -46.3005, lon: 167.7284, region: "nz_southland", zona: "Southland", modalidades: ["costa"], osm: "node/3874219857 tourism=camp_site", revisar_ubicacion: true, puerto_linz: { id: "6506a", nombre: "Kawakaputa Bay", km: 11.4, tabla: null } },
  // Fiordland
  { slug: "nz-milford-sound", nombre: "Milford Sound / Piopiotahi", lat: -44.619, lon: 167.8688, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "relation/10706231 natural=bay", revisar_ubicacion: true, puerto_linz: { id: "6517", nombre: "Fresh Water Basin", km: 7.4, tabla: "Fresh Water Basin" } },
  { slug: "nz-deep-cove", nombre: "Deep Cove (Doubtful Sound)", lat: -45.4644, lon: 167.158, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "node/3464825555 information=board", puerto_linz: { id: "6513", nombre: "Deep Cove", km: 0.7, tabla: "Deep Cove" } },
  { slug: "nz-dusky-sound", nombre: "Tamatea / Dusky Sound", lat: -45.7346, lon: 166.7458, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "relation/10662288 natural=bay", revisar_ubicacion: true, puerto_linz: { id: "6512a", nombre: "Front Islands", km: 1, tabla: null } },
  // West Coast
  { slug: "nz-jackson-bay", nombre: "Jackson Bay", lat: -43.9732, lon: 168.6137, region: "nz_challenger", zona: "West Coast", modalidades: ["costa","embarcacion"], osm: "node/1109681116 place=hamlet", revisar_ubicacion: true, puerto_linz: { id: "6518", nombre: "Jackson Bay", km: 1.9, tabla: "Jackson Bay" } },
  { slug: "nz-hokitika-beach", nombre: "Hokitika Beach", lat: -42.6925, lon: 170.99, region: "nz_challenger", zona: "West Coast", modalidades: ["costa"], osm: "way/203314401 natural=beach", puerto_linz: { id: "6523", nombre: "Hokitika River Bar", km: 3.3, tabla: null } },
  { slug: "nz-westport", nombre: "Westport", lat: -41.7542, lon: 171.6036, region: "nz_challenger", zona: "West Coast", modalidades: ["costa","embarcacion"], osm: "node/174645480 place=town", revisar_ubicacion: true, puerto_linz: { id: "6526", nombre: "Westport", km: 0.6, tabla: "Westport" } },
];

export const SPOTS_NZ = BASE.map((s) => ({ ...s, pais: "nz", tz: ZONA_HORARIA_NZ }));
