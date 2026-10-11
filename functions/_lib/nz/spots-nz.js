// functions/_lib/nz/spots-nz.js
// Los spots de Nueva Zelanda (fase 1 de NZ, 2026-10-09; PÚBLICOS desde el
// lanzamiento del 2026-10-11: "nz" está en REGIONES_ACTIVAS,
// functions/_lib/regiones-activas.js). 60 en la lista, 59 activos.
//
// Origen: plan de NZ de 2026-10-09 (tabla de §4). Coordenadas de
// OpenStreetMap (ODbL 1.0, "© OpenStreetMap contributors"), con el id OSM
// y su etiqueta en `osm`.
//
// Ubicaciones revisadas el 2026-10-11 (lanzamiento): los 52 que eran el
// centro del pueblo, del fiordo o de un edificio se movieron al punto de
// pesca real más cercano al lugar nombrado, con la API de OSM: muelle o
// espigón (man_made=pier/breakwater, en el agua), sitio de pesca
// (leisure=fishing), rampa (leisure=slipway, para los de barco), playa o
// cabo (pegados a la línea de costa) o, si no había nada, el punto de la
// línea de costa (natural=coastline) más cercano. `osm` = el elemento
// elegido, `osm_antes` = el punto de antes, `costa` = la vía de costa de
// OSM contra la que se comprobó y su distancia en metros (siempre < 300).
// test/nz-region.test.js lo comprueba. Dusky Sound queda FUERA
// (`activo: false`): no tiene ningún punto de acceso ni de pesca claro.
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
//                 fiordo o de un edificio y no el pesquero. Solo lo lleva el
//                 que está fuera (activo: false).
//   activo        false = fuera del lanzamiento: no entra en SPOTS_NZ.
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
  { slug: "nz-ninety-mile-beach", nombre: "Ninety Mile Beach (Ahipara)", lat: -35.16688, lon: 173.1473, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "way/1351406913 natural=coastline", osm_antes: "node/1750928663 place=town", costa: { osm: "way/1351406913", m: 0 }, puerto_linz: { id: "6384", nombre: "Ahipara Bay", km: 2.8, tabla: null } },
  { slug: "nz-houhora-heads", nombre: "Houhora Heads", lat: -34.82361, lon: 173.14824, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa","embarcacion"], osm: "node/8459776743 leisure=slipway", osm_antes: "node/1540086325 place=hamlet", costa: { osm: "way/179928154", m: 0 }, puerto_linz: { id: "6387d", nombre: "Houhora Harbour Entrance", km: 1.1, tabla: null } },
  { slug: "nz-whangaroa-harbour", nombre: "Whangaroa Harbour", lat: -35.04914, lon: 173.74341, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "way/91966982 man_made=pier (Marlin Jetty)", osm_antes: "node/581811365 place=village", costa: { osm: "way/180030428", m: 37 }, puerto_linz: { id: "6390", nombre: "Whangaroa", km: 0.6, tabla: "Whangaroa" } },
  { slug: "nz-paihia", nombre: "Paihia (Bay of Islands)", lat: -35.28051, lon: 174.09329, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa","embarcacion"], osm: "way/214016617 man_made=pier (Paihia Wharf)", osm_antes: "way/1442884916 place=town", costa: { osm: "way/218350030", m: 94 }, puerto_linz: { id: "6390f", nombre: "Waitangi", km: 1.8, tabla: null } },
  { slug: "nz-russell", nombre: "Russell (Bay of Islands)", lat: -35.262, lon: 174.12, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "way/214020597 man_made=pier", osm_antes: "node/251192130 place=village", costa: { osm: "way/1325582283", m: 111 }, puerto_linz: { id: "6391", nombre: "Russell", km: 0.6, tabla: null } },
  { slug: "nz-tutukaka", nombre: "Tutukaka", lat: -35.61051, lon: 174.52572, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["embarcacion"], osm: "way/103777043 leisure=slipway", osm_antes: "node/332339615 place=village", costa: { osm: "way/180460095", m: 0 }, puerto_linz: { id: "6393", nombre: "Tutukaka Harbour", km: 1, tabla: null } },
  { slug: "nz-whangarei-heads", nombre: "Whangarei Heads", lat: -35.81649, lon: 174.49739, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "way/91965837 man_made=pier", osm_antes: "node/6778470065 place=village", costa: { osm: "way/1350878845", m: 28 }, puerto_linz: { id: "6394", nombre: "Marsden Point", km: 1.9, tabla: "Marsden Point" } },
  { slug: "nz-kaipara-heads", nombre: "Kaipara Heads (Pouto)", lat: -36.36268, lon: 174.18174, region: "nz_auckland_kermadec", zona: "Northland", modalidades: ["costa"], osm: "node/8358731396 natural=cape (Pōuto Point)", osm_antes: "node/1775938008 place=hamlet", costa: { osm: "way/623586355", m: 0 }, puerto_linz: { id: "6377", nombre: "Pouto Point", km: 0.5, tabla: "Pouto Point" } },
  // Auckland / Hauraki Gulf
  { slug: "nz-mangawhai-heads", nombre: "Mangawhai Heads", lat: -36.0954, lon: 174.59171, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "way/965791037 man_made=pier", osm_antes: "node/1420555131 place=town", costa: { osm: "way/178283889", m: 29 }, puerto_linz: { id: "6396a", nombre: "Mangawhai Heads", km: 1.5, tabla: null } },
  { slug: "nz-leigh", nombre: "Leigh", lat: -36.28858, lon: 174.80739, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa","embarcacion"], osm: "way/1039813847 man_made=pier", osm_antes: "node/251601838 place=village", costa: { osm: "way/617896004", m: 18 }, puerto_linz: { id: "6396b", nombre: "Leigh", km: 0.9, tabla: "Leigh" } },
  { slug: "nz-gulf-harbour", nombre: "Gulf Harbour (Whangaparaoa)", lat: -36.61775, lon: 174.79087, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["embarcacion"], osm: "way/1042804694 leisure=slipway", osm_antes: "node/258771953 place=suburb", costa: { osm: "way/180604219", m: 0 }, puerto_linz: { id: "6399", nombre: "Weiti River Entrance", km: 6.3, tabla: "Weiti River Entrance" } },
  { slug: "nz-half-moon-bay", nombre: "Half Moon Bay (Bucklands Beach)", lat: -36.8789, lon: 174.9008, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["embarcacion"], osm: "way/28530188 leisure=marina", puerto_linz: { id: "6401c", nombre: "Tāmaki River", km: 5, tabla: "Tāmaki River" } },
  { slug: "nz-kawakawa-bay", nombre: "Kawakawa Bay", lat: -36.93918, lon: 175.17507, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa","embarcacion"], osm: "way/91967094 man_made=pier", osm_antes: "node/1027255664 place=village", costa: { osm: "way/894073130", m: 43 }, puerto_linz: { id: "6402a", nombre: "Sandspit Passage", km: 4.4, tabla: null } },
  { slug: "nz-muriwai", nombre: "Muriwai", lat: -36.83786, lon: 174.4271, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "node/12648904478 leisure=fishing", osm_antes: "node/605212636 place=town", costa: { osm: "way/1047368474", m: 0 }, puerto_linz: { id: "6375c", nombre: "Anawhata", km: 10.8, tabla: "Anawhata" } },
  { slug: "nz-manukau-heads", nombre: "Manukau Heads (Awhitu)", lat: -37.04361, lon: 174.5614, region: "nz_auckland_kermadec", zona: "Auckland / Hauraki Gulf", modalidades: ["costa"], osm: "way/1290370761 natural=beach", osm_antes: "node/10677310125 natural=peak", costa: { osm: "way/1450816143", m: 0 }, puerto_linz: { id: "6373", nombre: "Paratutae Island", km: 4, tabla: "Paratutae Island" } },
  // Coromandel
  { slug: "nz-coromandel-town", nombre: "Coromandel town", lat: -36.76772, lon: 175.46521, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["embarcacion"], osm: "way/91965453 man_made=pier", osm_antes: "node/59694792 place=town", costa: { osm: "way/321775783", m: 21 }, puerto_linz: { id: "6405", nombre: "Coromandel Harbour - Whanganui Island", km: 2.2, tabla: null } },
  { slug: "nz-whitianga", nombre: "Whitianga", lat: -36.83315, lon: 175.70826, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["embarcacion"], osm: "way/717031048 leisure=slipway (Whitianga Boat Ramp)", osm_antes: "node/254273924 place=town", costa: { osm: "way/180796535", m: 0 }, puerto_linz: { id: "6411", nombre: "Whitianga", km: 0.7, tabla: "Whitianga" } },
  { slug: "nz-tairua", nombre: "Tairua", lat: -37.00631, lon: 175.86153, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["costa","embarcacion"], osm: "node/1068674905 leisure=slipway", osm_antes: "node/59012508 place=town", costa: { osm: "way/321773593", m: 0 }, puerto_linz: { id: "6412", nombre: "Tairua", km: 1.5, tabla: null } },
  { slug: "nz-whangamata", nombre: "Whangamata", lat: -37.19619, lon: 175.87053, region: "nz_auckland_kermadec", zona: "Coromandel", modalidades: ["costa","embarcacion"], osm: "way/95162729 leisure=slipway", osm_antes: "node/60729253 place=town", costa: { osm: "way/321774504", m: 0 }, puerto_linz: { id: "6413a", nombre: "Whangamatā", km: 1.2, tabla: null } },
  // Bay of Plenty
  { slug: "nz-waihi-beach", nombre: "Waihi Beach / Bowentown", lat: -37.46787, lon: 175.98555, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa"], osm: "node/9723863079 leisure=fishing", osm_antes: "node/11110847390 place=locality", costa: { osm: "way/689404841", m: 0 }, puerto_linz: { id: "6413b", nombre: "Waihi Beach", km: 9.5, tabla: null } },
  { slug: "nz-tauranga", nombre: "Tauranga (Sulphur Point)", lat: -37.66359, lon: 176.16721, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["embarcacion"], osm: "way/589535429 leisure=slipway", osm_antes: "node/3939284015 place=quarter", costa: { osm: "way/1007541394", m: 0 }, puerto_linz: { id: "6415", nombre: "Tauranga", km: 2.1, tabla: "Tauranga" } },
  { slug: "nz-whakatane", nombre: "Whakatane", lat: -37.94964, lon: 176.99799, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa","embarcacion"], osm: "way/660846873 man_made=pier (Otuawhaki Wharf)", osm_antes: "node/248764278 place=town", costa: { osm: "way/318469294", m: 8 }, puerto_linz: { id: "6417b", nombre: "Whakatāne", km: 0.2, tabla: "Whakatāne" } },
  { slug: "nz-te-kaha", nombre: "Te Kaha", lat: -37.73616, lon: 177.67361, region: "nz_auckland_kermadec", zona: "Bay of Plenty", modalidades: ["costa","embarcacion"], osm: "node/11662418903 natural=cape (Matakaoa Point)", osm_antes: "node/1918506971 place=village", costa: { osm: "way/184867524", m: 0 }, puerto_linz: { id: "6419a", nombre: "Te Kaha", km: 3.4, tabla: null } },
  // Gisborne / Hawke's Bay
  { slug: "nz-tolaga-bay-wharf", nombre: "Tolaga Bay Wharf", lat: -38.383, lon: 178.3185, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["costa"], osm: "node/4283656489 historic=monument", puerto_linz: { id: "6423b", nombre: "Tolaga Bay Wharf", km: 0.2, tabla: null } },
  { slug: "nz-gisborne", nombre: "Gisborne", lat: -38.66721, lon: 178.02981, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["embarcacion"], osm: "way/103742801 leisure=slipway", osm_antes: "node/60269696 place=city", costa: { osm: "way/454742423", m: 0 }, puerto_linz: { id: "6425", nombre: "Gisborne", km: 0.3, tabla: "Gisborne" } },
  { slug: "nz-napier", nombre: "Napier (Ahuriri)", lat: -39.48169, lon: 176.89678, region: "nz_central", zona: "Gisborne / Hawke's Bay", modalidades: ["costa","embarcacion"], osm: "way/95913044 man_made=pier", osm_antes: "way/1444522727 place=suburb", costa: { osm: "way/96182123", m: 9 }, puerto_linz: { id: "6432", nombre: "Napier", km: 1.7, tabla: "Napier" } },
  // Waikato oeste
  { slug: "nz-raglan", nombre: "Raglan", lat: -37.79952, lon: 174.86666, region: "nz_auckland_kermadec", zona: "Waikato oeste", modalidades: ["costa","embarcacion"], osm: "way/377950285 man_made=pier", osm_antes: "node/368177945 place=town", costa: { osm: "way/188183895", m: 8 }, puerto_linz: { id: "6371", nombre: "Raglan", km: 1.5, tabla: "Raglan" } },
  { slug: "nz-kawhia", nombre: "Kawhia", lat: -38.06587, lon: 174.82287, region: "nz_auckland_kermadec", zona: "Waikato oeste", modalidades: ["costa","embarcacion"], osm: "node/12659968314 leisure=fishing", osm_antes: "node/249551447 place=village", costa: { osm: "way/318481201", m: 0 }, puerto_linz: { id: "6369", nombre: "Kawhia", km: 0.5, tabla: "Kawhia" } },
  // Taranaki
  { slug: "nz-new-plymouth", nombre: "New Plymouth (Port Taranaki)", lat: -39.0561, lon: 174.0298, region: "nz_central", zona: "Taranaki", modalidades: ["costa","embarcacion"], osm: "relation/16117166 landuse=industrial", puerto_linz: { id: "6366", nombre: "Port Taranaki", km: 0.7, tabla: "Port Taranaki" } },
  { slug: "nz-opunake", nombre: "Opunake", lat: -39.45874, lon: 173.85584, region: "nz_central", zona: "Taranaki", modalidades: ["costa"], osm: "way/351560573 natural=beach (Opunake Beach)", osm_antes: "node/1363970465 place=town", costa: { osm: "way/1004624522", m: 0 }, puerto_linz: { id: "6451", nombre: "Ōpunake Bay", km: 1, tabla: null } },
  // Wellington
  { slug: "nz-mana", nombre: "Mana (Porirua)", lat: -41.09943, lon: 174.86608, region: "nz_central", zona: "Wellington", modalidades: ["embarcacion"], osm: "way/92145131 leisure=slipway", osm_antes: "relation/13470382 place=suburb", costa: { osm: "way/1376429427", m: 0 }, puerto_linz: { id: "6443", nombre: "Mana Marina", km: 0.1, tabla: "Mana Marina" } },
  { slug: "nz-wellington-harbour", nombre: "Wellington Harbour (Seatoun)", lat: -41.31863, lon: 174.83033, region: "nz_central", zona: "Wellington", modalidades: ["costa","embarcacion"], osm: "way/1092098172 man_made=pier (Seatoun Wharf)", osm_antes: "node/277081719 place=suburb", costa: { osm: "way/690123014", m: 57 }, puerto_linz: { id: "6439", nombre: "Wellington", km: 5.6, tabla: "Wellington" } },
  { slug: "nz-palliser-bay", nombre: "Turakirae / Palliser Bay", lat: -41.58726, lon: 175.23335, region: "nz_central", zona: "Wellington", modalidades: ["costa","embarcacion"], osm: "way/824110924 natural=coastline", osm_antes: "node/1068576966 place=hamlet", costa: { osm: "way/824110924", m: 0 }, puerto_linz: { id: "6438a", nombre: "Ngawi", km: 0.4, tabla: null } },
  { slug: "nz-castlepoint", nombre: "Castlepoint", lat: -40.89846, lon: 176.22143, region: "nz_central", zona: "Wellington", modalidades: ["costa"], osm: "way/172902198 natural=beach (Castlepoint Beach)", osm_antes: "node/303655641 place=village", costa: { osm: "way/1025041944", m: 0 }, puerto_linz: { id: "6436", nombre: "Castlepoint", km: 2.1, tabla: "Castlepoint" } },
  // Nelson / Marlborough
  { slug: "nz-nelson", nombre: "Nelson (Tahunanui)", lat: -41.28315, lon: 173.24196, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa"], osm: "way/1341937678 natural=coastline (Tahunanui Beach)", osm_antes: "node/2372957073 place=suburb", costa: { osm: "way/1341937678", m: 0 }, puerto_linz: { id: "6458", nombre: "Nelson", km: 2.8, tabla: "Nelson" } },
  { slug: "nz-kaiteriteri", nombre: "Kaiteriteri", lat: -41.03682, lon: 173.01803, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa","embarcacion"], osm: "way/95913690 natural=beach (Kaiteriteri Beach)", osm_antes: "node/82799650 place=village", costa: { osm: "way/1350640760", m: 0 }, puerto_linz: { id: "6456", nombre: "Kaiteriteri", km: 1.5, tabla: "Kaiteriteri" } },
  { slug: "nz-picton", nombre: "Picton", lat: -41.27561, lon: 173.9997, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["embarcacion"], osm: "way/827524786 man_made=pier (Waimahara Wharf)", osm_antes: "node/53442053 place=town", costa: { osm: "way/1051412586", m: 29 }, puerto_linz: { id: "6477", nombre: "Picton", km: 0.9, tabla: "Picton" } },
  { slug: "nz-french-pass", nombre: "French Pass", lat: -40.9228, lon: 173.8337, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["embarcacion"], osm: "way/780065933 natural=strait", puerto_linz: { id: "6466b", nombre: "Man-o-War Bay / Pāharakeke", km: 1.2, tabla: null } },
  { slug: "nz-collingwood", nombre: "Collingwood (Golden Bay)", lat: -40.67619, lon: 172.68089, region: "nz_challenger", zona: "Nelson / Marlborough", modalidades: ["costa"], osm: "way/1158907313 man_made=breakwater", osm_antes: "node/384966558 place=village", costa: { osm: "way/1370854741", m: 4 }, puerto_linz: { id: "6528", nombre: "Whanganui Inlet", km: 13.2, tabla: null } },
  // Canterbury
  { slug: "nz-kaikoura", nombre: "Kaikoura", lat: -42.41286, lon: 173.70279, region: "nz_kaikoura", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "way/860242621 man_made=pier (New Kaikoura Wharf)", osm_antes: "node/205039578 place=town", costa: { osm: "way/1465794199", m: 16 }, puerto_linz: { id: "6487", nombre: "Kaikōura", km: 0.5, tabla: "Kaikōura" } },
  { slug: "nz-motunau-beach", nombre: "Motunau Beach", lat: -43.04974, lon: 173.0823, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "way/934954188 leisure=slipway", osm_antes: "node/4599132630 place=village", costa: { osm: "way/95743832", m: 0 }, puerto_linz: { id: "6488b", nombre: "Motunau Beach", km: 1.3, tabla: null } },
  { slug: "nz-lyttelton", nombre: "Lyttelton", lat: -43.61137, lon: 172.70622, region: "nz_south_east", zona: "Canterbury", modalidades: ["embarcacion"], osm: "way/95162716 leisure=slipway", osm_antes: "relation/18972001 place=suburb", costa: { osm: "way/95346100", m: 0 }, puerto_linz: { id: "6490", nombre: "Lyttelton", km: 1.5, tabla: "Lyttelton" } },
  { slug: "nz-akaroa", nombre: "Akaroa", lat: -43.80478, lon: 172.96519, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "way/91965103 man_made=pier (Dalys Wharf)", osm_antes: "relation/2726039 boundary=administrative", costa: { osm: "way/156781585", m: 55 }, puerto_linz: { id: "6490f", nombre: "Akaroa", km: 0.5, tabla: "Akaroa" } },
  { slug: "nz-timaru", nombre: "Timaru", lat: -44.39197, lon: 171.26045, region: "nz_south_east", zona: "Canterbury", modalidades: ["costa","embarcacion"], osm: "way/1057046476 leisure=slipway", osm_antes: "node/410464091 place=town", costa: { osm: "way/318611226", m: 0 }, puerto_linz: { id: "6492", nombre: "Timaru", km: 1.3, tabla: "Timaru" } },
  // Otago
  { slug: "nz-oamaru", nombre: "Oamaru", lat: -45.10494, lon: 170.97284, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "way/463189670 man_made=pier (Holmes Wharf)", osm_antes: "node/206015894 place=town", costa: { osm: "way/318915055", m: 10 }, puerto_linz: { id: "6494", nombre: "Oamaru", km: 1, tabla: "Oamaru" } },
  { slug: "nz-moeraki", nombre: "Moeraki", lat: -45.35907, lon: 170.85481, region: "nz_south_east", zona: "Otago", modalidades: ["costa","embarcacion"], osm: "way/91966270 man_made=pier", osm_antes: "node/338530778 place=village", costa: { osm: "way/95187373", m: 31 }, puerto_linz: { id: "6495", nombre: "Moeraki", km: 1.1, tabla: null } },
  { slug: "nz-karitane", nombre: "Karitane", lat: -45.64146, lon: 170.66107, region: "nz_south_east", zona: "Otago", modalidades: ["costa","embarcacion"], osm: "way/1060979648 man_made=breakwater", osm_antes: "node/1802506263 place=village", costa: { osm: "way/318917829", m: 40 }, puerto_linz: { id: "6496", nombre: "Spit Wharf", km: 16.4, tabla: "Spit Wharf" } },
  { slug: "nz-aramoana", nombre: "Aramoana (Otago Harbour mole)", lat: -45.77309, lon: 170.71589, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "way/318916480 natural=coastline (Aramoana Mole)", osm_antes: "node/1636467655 place=village", costa: { osm: "way/318916480", m: 0 }, puerto_linz: { id: "6496", nombre: "Spit Wharf", km: 1.1, tabla: "Spit Wharf" } },
  { slug: "nz-kaka-point", nombre: "Kaka Point (Catlins)", lat: -46.3841, lon: 169.7855, region: "nz_south_east", zona: "Otago", modalidades: ["costa"], osm: "node/11661743217 natural=cape", puerto_linz: { id: "6500", nombre: "Nugget Point", km: 7.7, tabla: null } },
  // Southland
  { slug: "nz-riverton", nombre: "Riverton / Aparima", lat: -46.35355, lon: 168.03076, region: "nz_southland", zona: "Southland", modalidades: ["costa","embarcacion"], osm: "way/1257087616 natural=beach (North Beach)", osm_antes: "node/983008811 place=town", costa: { osm: "way/106618203", m: 0 }, puerto_linz: { id: "6505d", nombre: "Riverton - Aparima", km: 1.8, tabla: "Riverton - Aparima" } },
  { slug: "nz-bluff", nombre: "Bluff", lat: -46.59752, lon: 168.34367, region: "nz_southland", zona: "Southland", modalidades: ["embarcacion"], osm: "way/91965053 man_made=pier", osm_antes: "node/974363520 place=town", costa: { osm: "way/321777039", m: 39 }, puerto_linz: { id: "6504", nombre: "Bluff", km: 0.6, tabla: "Bluff" } },
  { slug: "nz-halfmoon-bay", nombre: "Halfmoon Bay / Oban (Stewart Island)", lat: -46.89714, lon: 168.13117, region: "nz_southland", zona: "Southland", modalidades: ["embarcacion"], osm: "way/837923998 man_made=pier", osm_antes: "node/498807721 amenity=police", costa: { osm: "way/1014262202", m: 61 }, puerto_linz: { id: "6506c", nombre: "Halfmoon Bay - Oban", km: 0.4, tabla: "Halfmoon Bay - Oban" } },
  { slug: "nz-te-waewae-bay", nombre: "Te Waewae Bay (Monkey Island)", lat: -46.3, lon: 167.72771, region: "nz_southland", zona: "Southland", modalidades: ["costa"], osm: "way/188566701 natural=coastline (Monkey Island)", osm_antes: "node/3874219857 tourism=camp_site", costa: { osm: "way/188566701", m: 0 }, puerto_linz: { id: "6506a", nombre: "Kawakaputa Bay", km: 11.5, tabla: null } },
  // Fiordland
  { slug: "nz-milford-sound", nombre: "Milford Sound / Piopiotahi", lat: -44.6769, lon: 167.91869, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "way/91965722 man_made=pier", osm_antes: "relation/10706231 natural=bay", costa: { osm: "way/99446863", m: 14 }, puerto_linz: { id: "6517", nombre: "Fresh Water Basin", km: 1.6, tabla: "Fresh Water Basin" } },
  { slug: "nz-deep-cove", nombre: "Deep Cove (Doubtful Sound)", lat: -45.4644, lon: 167.158, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "node/3464825555 information=board", puerto_linz: { id: "6513", nombre: "Deep Cove", km: 0.7, tabla: "Deep Cove" } },
  { slug: "nz-dusky-sound", nombre: "Tamatea / Dusky Sound", lat: -45.7346, lon: 166.7458, region: "nz_fiordland", zona: "Fiordland", modalidades: ["embarcacion"], osm: "relation/10662288 natural=bay", revisar_ubicacion: true, activo: false, puerto_linz: { id: "6512a", nombre: "Front Islands", km: 1, tabla: null } },
  // West Coast
  { slug: "nz-jackson-bay", nombre: "Jackson Bay", lat: -43.97367, lon: 168.61585, region: "nz_challenger", zona: "West Coast", modalidades: ["costa","embarcacion"], osm: "way/91965451 man_made=pier", osm_antes: "node/1109681116 place=hamlet", costa: { osm: "way/97183379", m: 117 }, puerto_linz: { id: "6518", nombre: "Jackson Bay", km: 1.8, tabla: "Jackson Bay" } },
  { slug: "nz-hokitika-beach", nombre: "Hokitika Beach", lat: -42.6925, lon: 170.99, region: "nz_challenger", zona: "West Coast", modalidades: ["costa"], osm: "way/203314401 natural=beach", puerto_linz: { id: "6523", nombre: "Hokitika River Bar", km: 3.3, tabla: null } },
  { slug: "nz-westport", nombre: "Westport", lat: -41.73063, lon: 171.58314, region: "nz_challenger", zona: "West Coast", modalidades: ["costa","embarcacion"], osm: "way/96886445 natural=coastline (Buller River mouth, tiphead)", osm_antes: "node/174645480 place=town", costa: { osm: "way/96886445", m: 0 }, puerto_linz: { id: "6526", nombre: "Westport", km: 2.6, tabla: "Westport" } },
];

// Todos (también los que están fuera) y los activos, que son los que usa la app.
export const SPOTS_NZ_TODOS = BASE.map((s) => ({ ...s, pais: "nz", tz: ZONA_HORARIA_NZ }));
export const SPOTS_NZ = SPOTS_NZ_TODOS.filter((s) => s.activo !== false);
