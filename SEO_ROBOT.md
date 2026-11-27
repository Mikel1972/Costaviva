# SEO_ROBOT.md — historial del robot de SEO y diseño

Una entrada por pasada (martes y viernes), añadida al final. Anota números de SEO_ESTADO.md, cambios y qué se espera ver después.

## 2026-10-06 05:2x UTC
- Aviso: SEO_ESTADO.md es del 2026-10-02 (no de hoy); el workflow no dejó dato nuevo.
- Números (primera entrada, sin comparación): indexadas 4 de 115 (3%); 28 días: 3 clics, 14 impresiones, CTR 21,4%, posición media 13,1. 99 URLs "Descubierta: sin indexar", 12 "Google no reconoce esta URL" (castrourdiales, conil, corralejo, corrubedo, costadacaparica, muro, nazare...; están en sitemap y en prevision.js, probablemente solo no rastreadas aún).
- SEO aplicado (commit 8afde0d): en functions/mareas/[slug].js, enlaces a hasta 12 spots más de la misma región y JSON-LD WebPage con dateModified real.
- Diseño: ninguna propuesta esta pasada; sin datos de comportamiento que justifiquen un cambio visible.
- Esperado próxima pasada: más de 4 URLs indexadas o al menos "Descubierta" bajando; si sigue en 4, el cuello es la autoridad/rastreo del dominio, no la página.

## 2026-10-09 UTC (viernes)
- Aviso: SEO_ESTADO.md es del 2026-10-06 10:36 UTC (no de hoy); no hay dato nuevo desde mi última entrada.
- Números: indexadas 4 de 115 (3%), sin variación; 28 días: 3 clics, 21 impresiones (antes 14), CTR 14,3% (antes 21,4%), posición 25,9 (antes 13,1). 94 "Descubierta: sin indexar", 17 "Google no reconoce esta URL". Último rastreo de las 4 indexadas: 2026-09-25.
- SEO aplicado: ninguno. Mi cambio anterior (8afde0d) aún no se puede evaluar con datos de Search Console posteriores; tocar más sin medir sería adivinar. El cuello sigue siendo rastreo/autoridad, no el contenido de las páginas.
- Diseño: ninguna propuesta; sin datos que justifiquen un cambio visible.
- Esperado próxima pasada: SEO_ESTADO.md con fecha nueva; más de 4 indexadas o "Descubierta" por debajo de 94 (IndexNow ayuda a Bing, no a Google).

## 2026-10-12 08:0x UTC (lunes, disparo programado)
- Aviso: SEO_ESTADO.md es del 2026-10-09 10:52 UTC (no de hoy).
- Números: indexadas 8 de 284 (3%); antes 4 de 115 (+4 indexadas: /especies, /especies/lubina, /spots, /spots/bakio entran). 229 "Descubierta: sin indexar", 47 "Google no reconoce esta URL". Clics/impresiones de 28 días: no figuran en el fichero (informe de palabras: 19 búsquedas de todos los países).
- País priorizado: sin objetivos por país con datos (pais_foco vacío, MRR 0); reparto por puntuación de huecos → España (Mundaka y mareas por spot, posiciones 24-34).
- SEO/palabras (PARTE C, rama robot/palabras-2026-10-12-mareas-plural, PR la abre robot-diseno-pr.yml): /mareas/<spot> pasa de "Marea hoy en X" a "Mareas en X hoy" en título, descripción y h1 (+"pleamar y bajamar"), porque las búsquedas con demanda usan el plural ("mareas mundaka" pos. 24, "pleamar mundaka hoy" 27, "bajamar mundaka" 32, "mareas en portosin" 34). Sirve al punto 1. Medición en comun seo/palabras/costaviva-es-cambios.json.
- Huecos dejados: "spinning", "jigging", "surfcasting", "soft bait", "slow jigging" (técnicas, ES/PT/NZ): no hay datos reales con fuente en la app para escribir esas páginas, no se crean. Portugal "traducción pendiente": ya existen /pt/ de spots, mareas y especies en main; el informe está desfasado, a revisar el lunes.
- Diseño: ninguna propuesta; sin datos que la justifiquen.
- Parte D (DeepL): día <= 7 no aplica (día 12). KPIs: pais_foco nulo y 0 MRR; sin cambios de CTA esta pasada.
- Esperado próxima pasada: PR fusionada y los 4 términos con posición igual o mejor a 2 semanas; "Descubierta" por debajo de 229.

## 2026-10-20 05:3x UTC (martes)
- Aviso: SEO_ESTADO.md es del 2026-10-16 08:33 UTC (no de hoy).
- Números: indexadas 13 de 499 inspeccionadas (3%; antes 8 de 284: +5); sitemap con 558 URLs. 396 "Descubierta: sin indexar", 90 "Google no reconoce esta URL" (486 sin rastrear nunca: el freno sigue siendo autoridad/rastreo). 28 días: 7 clics, 103 impresiones (antes sin dato), CTR 6,8 %, posición 18,8.
- País priorizado: España (pais_foco del resumen de KPIs; es también el de más visitas). Cambio del 12-oct ("Mareas en X hoy") ya en main; aún sin veredicto (pendiente a 2-4 semanas).
- SEO aplicado en main: ninguno. Huecos de técnicas (spinning, jigging, surfcasting...) siguen sin datos reales con fuente en la app: no se crean páginas.
- Diseño: ninguna propuesta; sin datos que la justifiquen.
- KPIs (sin cifras): país en foco España; paso más en rojo: altas (visita → alta). Cambio hecho: rama robot/diseno-2026-10-20-kpi-altas (commit 6a6630b): las páginas públicas de /mareas/<spot> y la llamada de /pt/ prometían 7 días de prueba y la real es de 14; corregido. Evaluaciones: no había cambios anteriores. Propuestas para Mikel: ninguna.
- Parte D (DeepL): día 20, no aplica.
- Esperado próxima pasada: PR fusionada; 13 indexadas o más; "Descubierta" por debajo de 396.

## 2026-10-23 05:4x UTC (viernes)
- Aviso: SEO_ESTADO.md es del 2026-10-20 08:56 UTC (no de hoy).
- Números: indexadas 22 de 500 inspeccionadas (4%; antes 13 de 499: +9). Sitemap 558 URLs. 344 "Descubierta: sin indexar", 133 "Google no reconoce esta URL", 477 sin rastrear nunca (el freno sigue siendo autoridad/rastreo). Clics/impresiones de 28 días: no figuran en este fichero (informe de palabras: España semana 05-oct, 28 impresiones, 0 clics, posición 17,1).
- País priorizado: España (pais_foco del resumen de KPIs; es el que más búsquedas tiene). Portugal y NZ solo tienen huecos de técnicas.
- PARTE C (rama robot/palabras-2026-10-23-calamar-chipiron, commit 451fb5e, la PR la abre robot-diseno-pr.yml): /especies/<especie> pasa de "X: dónde y cuándo pescarla…" a "Pesca de X: dónde y cuándo pescarla…" en título y meta description. Términos: "pesca chipiron" (pos. 24), "chipiron pescado" (82), "lubina pesca" (100), "calamar" (78). Sirve al punto 1. Medición en comun seo/palabras/costaviva-es-cambios.json.
- Veredictos: el cambio del 12-oct (Mareas en X hoy) sigue "pendiente" (menos de 2 semanas con datos); nada que revertir.
- Huecos dejados: técnicas (spinning, jigging, surfcasting, soft bait, slow jigging; ES/PT/NZ): sin datos reales con fuente en la app, no se crean páginas.
- SEO invisible (PARTE A) y diseño (PARTE B): ninguno esta pasada; sin datos que lo justifiquen.
- KPIs (PARTE D): es viernes, solo martes. DeepL: día 23, no aplica.
- Esperado próxima pasada: PR fusionada; 22 indexadas o más; "Descubierta" por debajo de 344; posición de los 4 términos igual o mejor a 2 semanas.

## 2026-11-06 05:4x UTC (viernes)
- Aviso: SEO_ESTADO.md es del 2026-11-03 11:17 UTC (no de hoy).
- Números: indexadas 32 de 500 inspeccionadas (6%; antes 22: +10). Sitemap 558 URLs. 380 "Descubierta: sin indexar" (antes 344), 87 "Google no reconoce esta URL" (antes 133), 467 sin rastrear nunca. Google, 28 días: 17 clics, 925 impresiones, CTR 1,8 %, posición 29,8 (la entrada anterior no traía estas cifras). /especies/calamar: 7 clics, 220 impresiones.
- País priorizado: España (pais_foco; real 0 frente a objetivo 7,57 €; Portugal y NZ también en rojo, sin visitas medibles en PT).
- PARTE C: ningún cambio. Los huecos con más puntuación (calamar, chipirón, mareas Euskadi/País Vasco) ya tienen cambios hechos el 23 y 30-oct, aún sin medir; tocarlos otra vez impediría saber si funcionaron. /mareas/<spot> ya lleva pleamar, bajamar y oleaje en título y descripción. Técnicas (spinning…): sin datos reales con fuente, no se crean.
- Veredictos: los dos cambios en comun siguen "pendiente"; nada que revertir.
- PARTE A y B: ninguna; sin datos que lo justifiquen.
- PARTE D: viernes, KPIs solo martes. DeepL: lanzado "Contraste de traducciones con DeepL" (idioma=pt, ref main); el de en, en la pasada siguiente del mes. Informe aún sin leer ni aplicar.
- Esperado próxima pasada: 32 o más indexadas; "Descubierta" estancada o a la baja; primeros veredictos a 2 semanas de los cambios del 23-oct.

## 2026-11-20 06:3x UTC (viernes)
- Aviso: SEO_ESTADO.md es del 2026-11-17 12:19 UTC (no de hoy).
- Números: indexadas 34 de 500 inspeccionadas (7%; antes 32: +2). Sitemap 558 URLs. 292 "Descubierta: sin indexar" (antes 380), 173 "Google no reconoce esta URL" (antes 87), 465 sin rastrear nunca. Google, 28 días: 25 clics, 1825 impresiones, CTR 1,4 %, posición 29,9 (antes 17 clics, 925 impresiones, pos. 29,8).
- País priorizado: España (pais_foco: MRR 0 frente a 14,42 €; PT y NZ también en rojo, sin huecos que no sean técnicas o ya trabajados).
- PARTE C (rama robot/palabras-2026-11-20-sitios-pesca, commit 8161ca6; la PR la abre robot-diseno-pr.yml): /spots cambia título ("Sitios de pesca en España y Portugal: N spots y puntos de pesca") y descripción ("Dónde se pesca…"); h1 y texto igual. Términos: sitios para pescar (pos. 91), sitios de pesca (94,5), donde se pesca (73,5), lugares pesca (78), punto de pesca (41,5). Sirve al punto 1. Medición en comun seo/palabras/costaviva-es-cambios.json.
- No toqué los huecos de regiones (mareas Canarias/Galicia/Mediterráneo/Cádiz, pesca por región), calamar/chipirón ni /mareas|spots/bakio: los títulos se reescribieron el 19-20-nov (#550, #551) y el informe es anterior; tocarlos otra vez impediría medirlos. Lubina: cambio del 23-oct aún en medición.
- Veredictos: 12-oct (pendiente, sin s1-s4 aún) y 23-oct (s1 pos. 46,6 y s2 49,1 frente a 58,4 de antes: mejora); nada que revertir.
- Huecos dejados: "spinning" y demás técnicas, sin datos reales con fuente en la app; NZ ("fishing spots near me", mareas por bahía): sin páginas con datos para ello esta pasada.
- PARTE A y B: ninguna; sin datos que lo justifiquen. PARTE D (DeepL): día 20, no aplica; KPIs solo martes.
- Esperado próxima pasada: PR fusionada; 34 indexadas o más; "Descubierta" a la baja; primeros s1 de los términos de /spots.

## 2026-11-24 06:4x UTC (martes)
- Aviso: SEO_ESTADO.md es del 2026-11-20 21:12 UTC (no de hoy). Números de esa fecha: indexadas 39 de 500 inspeccionadas (8 %; antes 34: +5); sitemap 558 URLs leído por Google; 285 "Google no reconoce esta URL" y 176 "Descubierta: sin indexar"; 461 sin rastrear nunca.
- País priorizado: España (pais_foco, el más lejos de su objetivo; PT y NZ también en rojo sin huecos trabajables esta pasada).
- PARTE C (rama robot/palabras-2026-11-24-especies-pescados, commit c9b51f9; la PR la abre robot-diseno-pr.yml): /especies cambia título ("Pescados y especies de pesca de España y Portugal: …") y descripción ("N pescados y peces de pesca recreativa…"); h1 y texto igual. Término: pescados de españa (pos. 24,5, puntuación 18). Sirve al punto 1. Medición en comun seo/palabras/costaviva-es-cambios.json.
- No toqué las páginas de región (FAQ y títulos cambiados el 23-nov, #611-#612), ni /especies/lubina ni calamar (cambio del 23-oct en medición), ni /mareas/denia (su título depende de la plantilla de los spots, retocada ayer). Técnicas: sin datos reales con fuente.
- Veredictos: 12-oct pendiente; 23-oct s1 y s2 mejoran (pos. 58,4 → 46,6 / 49,1); 20-nov pendiente. Nada que revertir.
- KPIs: país en foco España; paso más en rojo, altas (visita → alta). Evaluación de cambios anteriores: sin cambios evaluables todavía. Cambios nuevos: ninguno (con visitas cerca del objetivo y altas a cero, el problema no parece de texto; ver propuesta). Propuesta para Mikel: costaviva-kpis-bajo-suelo (medir clics al botón de prueba gratis por página antes de tocar textos).
- PARTE A y B: ninguna; sin datos que lo justifiquen. PARTE D (DeepL): día 24, no aplica.
- Esperado próxima pasada: PR fusionada; 40 o más indexadas; primer s1 de /spots (cambio del 20-nov).

## 2026-11-27 06:3x UTC (viernes)
- Aviso: SEO_ESTADO.md es del 2026-11-25 16:35 UTC (no de hoy). Indexadas 103 de 300 inspeccionadas (34 %; el límite de cuota es de 300 URLs, no comparable con las 500 de la entrada anterior); 197 sin rastrear nunca. Google, 28 días: 30 clics y 2940 impresiones (CTR 1,0 %, posición 24,9); últimos 7 días: 18 clics y 2017 impresiones frente a 2 y 641 los 7 anteriores (sube fuerte).
- País priorizado: España (pais_foco, el más lejos de su objetivo; PT y NZ también en rojo).
- PARTE C: ningún cambio de página esta pasada. Los huecos mejor puntuados de España caen en páginas tocadas hace pocos días y aún en medición: /especies/calamar y /especies/lubina (cambio 23-oct, sin veredicto), /especies (24-nov) y las páginas de región (FAQ y títulos del 23-nov); volver a tocarlas impediría medir. /mareas/denia (titular, pos. 10,0) depende de la plantilla de spots, retocada recientemente. Técnicas (spinning, surfcasting en PT): sin datos reales con fuente en la app.
- Veredictos: 12-oct, 23-oct, 20-nov y 24-nov siguen "pendiente" en comun; nada que revertir.
- PARTE A y B: ninguna; sin datos que lo justifiquen. PARTE D (DeepL): día 27, no aplica; KPIs solo martes.
- Esperado próxima pasada: primeros s1/s2 de /spots (20-nov) y /especies (24-nov); 103 o más indexadas; si los veredictos salen, actuar sobre región (Cádiz, Galicia, Canarias).
