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

## 2026-10-27 05:4x UTC (martes)
- Aviso: SEO_ESTADO.md es del 2026-10-23 08:54 UTC (no de hoy).
- Números: indexadas 23 de 499 inspeccionadas (5%; antes 22 de 500: +1). Sitemap 558 URLs. 386 "Descubierta: sin indexar", 89 "Google no reconoce esta URL", 475 sin rastrear nunca (el freno sigue siendo autoridad/rastreo). Clics/impresiones de 28 días: no figuran en este fichero; informe de palabras (España, semana 12-oct): 120 impresiones, 5 clics, CTR 4,2 %, posición 18,8.
- País priorizado: España (pais_foco del resumen de KPIs).
- SEO aplicado en main (PARTE A) y PARTE C: ninguno esta pasada. Los huecos que quedan son técnicas (spinning, jigging, surfcasting...; ES/PT/NZ) sin datos reales con fuente en la app: no se crean páginas.
- Veredictos: los cambios del 12-oct (Mareas en X hoy) y del 23-oct (Pesca de X) siguen "pendiente"; nada que revertir.
- Diseño: ninguna propuesta; sin datos que la justifiquen.
- KPIs (sin cifras): país en foco España; paso más en rojo: pago (prueba → pago), pero con apenas cuentas válidas aún no hay pruebas terminadas con las que juzgarlo, así que no se hace cambio. Evaluaciones: el cambio del 20-oct (prueba de 14 días en páginas públicas) aún sin fusionar ni evaluable. Propuestas para Mikel: ninguna.
- Parte D (DeepL): día 27, no aplica.
- Esperado próxima pasada: 23 indexadas o más; "Descubierta" por debajo de 386; veredicto a 2 semanas del cambio del 12-oct.
