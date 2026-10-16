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

## 2026-10-16 UTC (viernes, disparo programado)
- Aviso: SEO_ESTADO.md es del 2026-10-13 11:01 UTC (no de hoy). Clics/impresiones de 28 días no figuran en el fichero.
- Números: indexadas 9 de 500 inspeccionadas (sitemap: 450 URLs; antes 8 de 284): entra /mareas/mundaka entre las indexadas listadas. 291 "Descubierta: sin indexar", 200 "Google no reconoce esta URL" (sobre todo /en/, /pt/ y regiones, sin rastrear nunca).
- País priorizado: sin MRR ni objetivos por país con datos; reparto por puntuación de huecos (España).
- SEO/palabras: ningún cambio. El cambio del 2026-10-12 ("Mareas en X hoy", ya en main) aún no tiene medida a 1 semana; el título de /mareas/region/<región> ya es "Mareas hoy en País Vasco…", que coincide con "mareas pais vasco". Tocar más sin medir sería adivinar; el cuello sigue siendo rastreo/autoridad (491 URLs nunca rastreadas).
- Huecos dejados: técnicas (spinning, surfcasting, jigging, eging) sin datos reales con fuente en la app; "mareas vivas bizkaia" sin página.
- Diseño: ninguna propuesta. Parte D (DeepL): día 16 > 7, no aplica; KPIs: no es martes.
- Esperado próxima pasada: veredicto a 1 semana de "mareas-plural"; "Descubierta" por debajo de 291.
