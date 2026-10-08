# Evidencia científica de los factores del índice de pesca

Investigación del 2026-10-08 (tanda grande en sesión, sin API). Objetivo de
Mikel: saber con fuente **cómo** afecta cada factor ambiental a cada especie
principal, para cambiar heurísticas por reglas con fuente y para confirmar o
desmentir sus reglas locales.

- **Nada de esto está activo.** Las propuestas están en
  `assets/datos/especies.json` → `propuestas_evidencia` (reglas, ajustes,
  fuentes y top 10), que el índice no lee. `test/indice-pesca-v2.test.js`
  comprueba que están bien formadas y que se pueden mover tal cual a
  `reglas_expertas.reglas` cuando Mikel las apruebe.
- **Cómo se leyó:** casi todo por resumen, registro de repositorio o resumen
  secundario; el texto completo solo en unos pocos (marcado `leido` en cada
  fuente). Los umbrales numéricos de las reglas que no salen de la fuente están
  marcados como "traducción de Claude".
- **Confianza:** alta = varios estudios de campo concordantes en la especie o en
  la región; media = un estudio de campo o de laboratorio en la especie;
  baja = especie parecida, escala distinta (anual frente a horaria) o
  literatura gris.
- Efecto: ↑ más capturas/actividad, ↓ menos, ↕ mixto o depende, = sin efecto,
  ? sin evidencia encontrada.

## Lo más importante en una página

1. **Temperatura, luz y corriente** son, según la revisión de referencia sobre
   capturabilidad con cebo (Stoner 2004), las variables con más efecto: pueden
   multiplicar por 10 la captura por unidad de esfuerzo. La **presión
   atmosférica** no tiene ni un experimento controlado a favor en peces marinos.
2. **Salinidad:** los cefalópodos (pulpo, sepia, calamar) son los que peor
   llevan el agua dulce. Un río crecido o una lluvia torrencial les afecta mucho
   más que a los peces. La lisa y la dorada son eurihalinas.
3. **Bonito:** sigue una ventana de temperatura del agua de 16-18 °C, no los
   frentes. La mar agitada y la mezcla del agua bajan las capturas de superficie.
4. **Lubina:** muy residente (áreas de 1-3 km, vuelve al mismo sitio cada año),
   en la costa de mayo a octubre y mar adentro para frezar en invierno. Cambia de
   ritmo: de día en primavera y verano, de noche en invierno. De noche come por
   el olfato, así que el agua tomada no le impide comer.
5. **Viento del este en el Cantábrico:** en primavera y verano provoca
   afloramiento (agua fría y clara pegada a la costa). Es el mecanismo físico
   más probable de la regla de Mikel, pero no hay ningún estudio de capturas.

## Tabla especie × factor

Las fuentes son los ids de `propuestas_evidencia.fuentes` (o de `fuentes` si ya
existían). Las URL están al final.

### Lubina (*Dicentrarchus labrax*)

| Factor | Efecto | Mecanismo | Condiciones / umbrales | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Turbidez | ↕ (no impide comer) | De noche localiza la comida por quimiorrecepción, no por la línea lateral; caza también a vista | Sin umbral medido en la especie. En peces visuales la distancia de reacción baja con la turbidez | Lab. (Francia) | faucher_2006_bss, stoner_2004 | baja-media |
| Temperatura | ↑ con agua templada (hasta ~26 °C en el Mediterráneo) | Crecimiento e ingesta suben con la temperatura | Freza entre 9 y 17 °C; la población mediterránea crece al máximo hacia 26 °C | Mediterráneo (lab.), golfo (ICES) | bss_temperatura_med, ices_bss_8c9a_sa | media |
| Estacionalidad / migración | ↑ mayo-oct en la costa, ↓ en invierno | Freza en alta mar | Adultos a menos de 16 km de mayo a octubre; se dispersan desde noviembre; en Cork salen en oct-nov y vuelven en may-jun | Atlántico NE, Irlanda | pawson_2007_bss, doyle_2017_bss | alta |
| Salinidad / caudal | ↕ | Eurihalina; los juveniles usan estuarios | El caudal del río explica la abundancia de juveniles en unos estuarios sí y en otros no | Islas Británicas | frontiers_2023_bss_estuarios | baja (para adultos) |
| Oleaje | ↕ | ? | La flota artesanal sale menos y pesca menos lubina con más ola (esfuerzo y capturabilidad mezclados) | Inglaterra | bss_flota_decisiones_2022 | baja |
| Presión | ? | — | Ningún estudio en la especie | — | stoner_2004 | — |
| Marea / corriente | ? (residencia) | — | La telemetría muestra residencia en áreas pequeñas; no se encontró análisis por fase de marea | Irlanda, Galicia | doyle_2017_bss, pita_freire_2011 | — |
| Luz / hora | ↕ según la época | Ritmo dual: diurno en primavera-verano, nocturno en invierno; los individuos solos son nocturnos | Inversión del ritmo en invierno | Cautividad (Murcia), marisma (La Rochelle) | azzaydi_1998_bss, begout_1997_bss | media |
| Oxígeno disuelto | ↓ con hipoxia | Evita el agua del fondo hipóxica y come menos al 40 % de saturación | Solo relevante en estuarios interiores en verano | Lab. | (resumen; sin regla) | media |

### Sargo (*Diplodus sargus / vulgaris*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Oleaje / rompiente | ↕ (predictor fuerte, signo no publicado en el resumen) | Usa la zona de rompiente (surge) de roca y la espuma de playa | La altura de ola, la temperatura y el viento son los mejores predictores de abundancia en la rompiente | Cádiz | puerto_sargo_rompiente | baja-media |
| Marea | ↕ | Se mueve más en mareas muertas y de día | Interacción marea × hora | SW Portugal | belo_2016_sargo | media |
| Luz | ↑ de día | Diurno | Más movimiento de día | SW Portugal | belo_2016_sargo | media |
| Temperatura / viento | ? | Supervivencia de juveniles frente a viento, ola y corriente | — | Mediterráneo occidental | plos_dsargus_2018 | baja |

### Dorada (*Sparus aurata*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Salinidad | = / ↑ en lagunas | Eurihalina: adultos en lagunas salobres hasta 11 meses al año, también en invierno | No se aparta con agua menos salada | Golfo de León | mercier_2012_dorada | alta |
| Temperatura | ↓ por encima de ~27 °C | Umbral subletal de 29 °C; migra al mar cuando la laguna supera 27,4 °C de media | Verano | NW Mediterráneo | movecol_saurata_2026 | media |
| Marea | ? | — | Solo la guía local de Rota | — | app_index | baja |

### Jurel / chicharro (*Trachurus trachurus*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Temperatura / afloramiento | ↕ (escala anual) | El reclutamiento sigue al eje térmico y de afloramiento (r = 0,78) | Escala de años, no de horas | Golfo de Bizkaia e Iberia | lavin_2007_hom_alb | media (anual) |
| Turbidez / luz | ? | Pelágico visual (heurística actual) | — | — | — | — |

### Caballa (*Scomber scombrus*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Luz | = de noche (puede comer) | Umbral de luz para comer muy bajo: come de noche cerca de la superficie | — | Atlántico NW (lab.) | macy_1998_caballa | media |
| Temperatura | ? | No se encontró un rango verificado (se repite "11-14 °C" sin cita) | — | — | — | — |

### Bonito del norte (*Thunnus alalunga*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Temperatura del agua | ↑ en la ventana 16-18 °C | Preferencia térmica de los juveniles en la migración trófica | Ventana significativa con 17 años de cuadernos de pesca; con el agua muy caliente se aleja de la costa | Golfo de Bizkaia | sagarminaga_2010_alb, deia_2025_bonito | alta |
| Frentes de SST | = | Sin adhesión consistente a los gradientes térmicos | Posible asociación con frentes de clorofila en agosto-septiembre | Golfo de Bizkaia | sagarminaga_2010_alb, sagarminaga_2014_alb_frentes | media |
| Mezcla / mar agitada | ↓ en artes de superficie | Capa de mezcla más profunda: el bonito baja y se dispersa | La mezcla resta en curricán y cebo vivo; CPUE de los de 2 años más baja con agitación del mar | Golfo de Bizkaia | goni_2015_alb, iccat_2013_alb, hegaluze_2010_alb | media-alta |
| Viento zonal (oeste) | ↕ (escala anual) | Transporte de Ekman hacia la costa con viento del oeste; agua oceánica cálida en la plataforma | La disponibilidad anual se explica con SST, PEA y la componente zonal del viento | Golfo de Bizkaia | lavin_2007_hom_alb, ices_afloramiento_biscay | baja (para días) |
| Insolación | ↓ | ? | La CPUE baja con más horas de sol | Golfo de Bizkaia | hegaluze_2010_alb | baja |
| Marea | = | Oceánico | — | — | — | — |

### Calamar (*Loligo vulgaris*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Luna | ↑ con luna llena (jigging) | Más luz natural: caza a vista | p < 0,01; el jig rojo es el mejor. En otros calamares (Australia) es al revés | Egeo | ulas_2011_calamar | media-baja |
| Temperatura / afloramiento | ↕ | Las paralarvas siguen a la temperatura y al afloramiento; capturas entre 13 y 16 °C en un estudio dudoso | — | Portugal | (resúmenes; sin regla) | baja |
| Salinidad / río | ↓ | Cefalópodo estenohalino (por analogía con pulpo y sepia) | — | — | iglesias_2016_pulpo_salinidad (pulpo) | media |
| Turbidez | ↓ (heurística actual) | Caza a vista | — | — | — | baja |

### Sepia (*Sepia officinalis*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Salinidad | ↓ con agua dulce | Adultos tolerantes (sobreviven a 18 ± 2 si se aclimatan despacio) pero prefieren la parte salada de la ría; los huevos no eclosionan por debajo de ~24 | Ría de Vigo: 20-35,5 en toda la ría, con preferencia por las cuencas media y externa | Galicia, Holanda | guerra_2006_sepia | alta |
| Temperatura / estación | ↑ en primavera y verano cerca de la costa | Desove en aguas someras a 12-15 °C; invierno a 100-200 m | — | Galicia, Canal | guerra_2006_sepia | media-alta |

### Pulpo (*Octopus vulgaris*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Salinidad / lluvia / río | ↓↓ | Osmorregulación: a 20 psu deja de comer y muere en un día; hay mortandades tras lluvias torrenciales | Límite práctico ~30 psu | Galicia (jaulas), Portugal, lab. | iglesias_2016_pulpo_salinidad | alta |
| Lluvia (escala anual) | ↓ | Afecta al reclutamiento | Más lluvia el año anterior, menos pulpo | Golfo de Cádiz | sobrino_2020_pulpo | media |
| Viento / afloramiento (escala anual) | ↕ | Supervivencia de las paralarvas | Hasta el 85 % de la variación interanual de capturas | Galicia | otero_2008_pulpo | alta (anual) |
| Temperatura | ↑ entre 16 y 21 °C | Óptimo de crecimiento a 17,5 °C e ingesta máxima a 20 °C; pierde peso por encima de ~23 °C | — | Lab. | aguado_2002_pulpo | media |

### Lisa (mugílidos: *Chelon labrosus*, *Liza ramada*…)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Salinidad / río | ↑ (*L. ramada*), = (*C. labrosus*) | Eurihalinas; *L. ramada* prefiere salinidad < 15 en primavera-verano. *L. aurata* y *L. saliens* evitan el agua dulce | En otoño la mayoría se va al mar | Menorca | cardona_2006_mugilidos | media-alta |

### Congrio (*Conger conger*)

| Factor | Efecto | Mecanismo | Condiciones | Región | Fuente | Confianza |
|---|---|---|---|---|---|---|
| Luz | ↑ de noche | Sale del refugio al anochecer o de noche | Activo el 12 % del tiempo, sobre todo de noche | A Coruña, SW Portugal | pita_freire_2011, pereira_2017_congrio | alta |
| Luna | ↑ en cuartos | ? | Solo 6 peces y 2 meses | SW Portugal | pereira_2017_congrio | baja |

### Faneca (*Trisopterus luscus*)

No se encontró ningún estudio sobre su respuesta a factores a corto plazo. Solo
hay datos generales: fondos de roca y pecios donde forma bancos de día; freza
en febrero-abril en la plataforma gallega. **Sin propuesta.**

### Factores transversales

| Factor | Qué dice la evidencia | Fuente | Confianza |
|---|---|---|---|
| Presión barométrica | Sin experimentos controlados en el mar; correlaciones solo en agua dulce. El único ensayo de laboratorio encontrado (perca) no ve efecto. Los tiburones de poco fondo se van a aguas profundas al caer la presión antes de un temporal; en el pez ballesta el movimiento durante el temporal lo explica la ola, no la presión | stoner_2004, vanderweyst_2014, heupel_2003, bacheler_2019, udyawer_2013 | media (de que no hay evidencia a favor) |
| Temporales / ola grande | Los peces se mueven y emigran hacia aguas profundas (sobre todo de noche) | bacheler_2019, udyawer_2013 | media |
| Temperatura | De las variables con más efecto en la capturabilidad (×10 en la captura por esfuerzo) | stoner_2004 | alta |
| Corriente | La corriente arrastra el olor del cebo; sin corriente el rastro no llega lejos | stoner_2004 | media |
| Luna | Depende de la especie: en torneos de altura de Australia unas especies responden y otras no | (resumen Lowry et al. 2007) | baja |
| Viento E en el Cantábrico | Afloramiento intermitente en primavera-verano (12-14 días/mes favorables de junio a septiembre en el oeste del Cantábrico), con agua fría pegada a la costa | ices_afloramiento_biscay, alvarez_afloramiento_cantabrico | alta (física); sin datos de capturas |
| Viento W en el Cantábrico | Empuja agua cálida hacia la costa e invierte la corriente de plataforma (hundimiento) | ices_afloramiento_biscay | media |
| Oxígeno disuelto | Solo cuenta en estuarios interiores (máximo de turbidez del Loira con anoxia; lubina que evita el fondo hipóxico). En la costa abierta no limita | (resúmenes) | media |

## Reglas locales de Mikel: veredicto

### 1. "Cuando baja la presión comen antes del temporal"
(`presion_bajando_6h`, `presion_bajando_24h`, `presion_subiendo_tras_frente`)

**Sin evidencia a favor; algo de evidencia indirecta en contra.** La revisión
de referencia (Stoner 2004) dice que no hay experimentos controlados y que es
casi imposible separar la presión de la nubosidad, el viento o la ola. El único
ensayo de laboratorio encontrado no ve efecto. En telemetría, lo que se ve es
que los peces y tiburones de poco fondo **se van** a aguas más profundas antes
o durante el temporal (Heupel 2003, Udyawer 2013, Bacheler 2019), y el
movimiento lo explica mejor el oleaje que la presión. La presión puede seguir
valiendo como **aviso de cambio de tiempo** (nubes, luz baja, mar que empieza a
moverse), que sí tienen mecanismo.
→ Propuesta: mantener las reglas, pero con confianza 0,4/0,35/0,3 y la mitad
de peso para la tendencia de presión por defecto (`presion_confianza_baja`,
`presion_defecto_peso`). Se calibra con el diario.

### 2. "El mar algo revuelto ayuda a la lubina, al sargo… desde costa"
(`mar_movida_depredadores_costa`)

**Apoyo parcial, sin magnitud.** El sargo vive en la rompiente y la altura de
ola es de los mejores predictores de su abundancia en playas de Cádiz (el
resumen no da el signo). La lubina come de noche por el olfato, así que el agua
tomada por la espuma no le impide comer. En contra: con mar grande los peces se
van a aguas profundas (estudios de temporal) y la flota de lubina pesca menos
con más ola. Encaja con una **banda moderada** como la de Mikel (1-2,5 m), no
con "cuanto más, mejor".
→ Sin cambio. Si el diario lo permite, revisar el tramo de 2-2,5 m.

### 3. "Con mucho caudal la lubina se arrima a la desembocadura y el resto se aparta"
(`rio_crecido_lubina_desembocadura`, `rio_crecido_salinidad_resto`)

- **"El resto se aparta": apoyado, y más fuerte de lo que dice la regla para
  los cefalópodos.** El pulpo muere a 20 psu en un día y hay mortandades tras
  lluvias torrenciales; la sepia prefiere la parte salada y sus huevos no
  eclosionan con agua dulce. → `rio_crecido_cefalopodos` (-1,0) y
  `lluvia_fuerte_pulpo`.
- **Excepciones bien apoyadas:** la lisa (ya excluida; *L. ramada* incluso
  prefiere el agua salobre → `lisa_rio_crecido`) y la **dorada**, que vive
  meses en lagunas salobres → sacarla de la regla negativa
  (`rio_crecido_resto_excluir_dorada`).
- **"La lubina se arrima": plausible, sin estudio directo en adultos.** Es
  eurihalina y sus juveniles usan los estuarios, pero el efecto del caudal en
  la abundancia cambia de un estuario a otro. → Sin cambio (sigue siendo la
  experiencia de Mikel por validar).

### 4. "En el Cantábrico los vientos del este son malos para pescar"
(`levante_cantabrico`)

**Sin estudio de capturas; mecanismo físico plausible en primavera y verano.**
En una costa orientada al norte, el viento del este produce transporte de Ekman
hacia mar abierto y **afloramiento**: agua más fría y clara pegada a la costa
en 1-2 días, sobre todo de junio a septiembre. El agua fría baja el apetito
(la temperatura es de los factores con más efecto) y el agua clara hace
desconfiar a los depredadores que cazan con espuma. En invierno no se encontró
mecanismo documentado.
→ Propuesta: medir el efecto directamente con `enfriamiento_brusco_agua`
(bajada de 1,5 °C o más en 48 h) y bajar la confianza de la regla del viento a
0,5 (`levante_cantabrico_confianza`). Si el diario confirma que el levante
resta también en invierno, se sube otra vez.

### 5. "En verano los temporales del oeste meten el bonito en el golfo"
(`bonito_temporales_oeste`)

**Contradicho a corto plazo; plausible con retraso; sin estudio a escala de
días.** Tres fuentes de la pesquería vasca dicen que la mezcla del agua y la
mar agitada **bajan** las capturas de curricán y cebo vivo (Goñi 2015, ICCAT
2013, Hegaluze 2010). El bonito sigue el agua de 16-18 °C, no los frentes. A
favor del mecanismo: el viento del oeste empuja agua oceánica cálida hacia la
costa cantábrica (hundimiento) y la componente zonal del viento entra en el
modelo anual de disponibilidad del bonito (Lavín 2007).
→ Propuesta: mantener la confianza en 0,3, exigir que el viento ya haya
calmado (`bonito_temporales_oeste_calma`), restar cuando la mar estuvo muy
agitada el día anterior (`bonito_mar_agitada_previa`) y usar 16-18 °C como
rango de temperatura (`bonito_rango_temperatura`).

## Top 10 de propuestas por impacto

Detalle completo (condiciones, efecto, fuentes) en
`especies.json → propuestas_evidencia`.

| # | Id | Qué cambia | Efecto | Confianza |
|---|---|---|---|---|
| 1 | `rio_crecido_cefalopodos` | Pulpo, sepia y calamar con río crecido a ≤ 3 km | -1,0 log-odds (hoy -0,5) | 0,7 |
| 2 | `presion_confianza_baja` | Confianza de las 3 reglas de presión de Mikel | 0,6/0,5/0,5 → 0,4/0,35/0,3 | 0,6 |
| 3 | `bonito_mar_agitada_previa` | Bonito con ola media ≥ 2,5 m entre hace 36 y hace 6 h | -0,4 | 0,5 |
| 4 | `bonito_rango_temperatura` | Rango de temperatura del bonito con fuente | [16, 19] → [16, 18] | 0,7 |
| 5 | `bonito_temporales_oeste_calma` | La regla del oeste solo con el viento ya calmado (< 20 km/h en 12 h) | condición nueva | 0,5 |
| 6 | `enfriamiento_brusco_agua` | Depredadores costeros con bajada del agua ≥ 1,5 °C en 48 h | -0,4 (escala hasta -4 °C) | 0,4 |
| 7 | `rio_crecido_resto_excluir_dorada` | Dorada (y cefalópodos, que pasan a su regla) fuera de la regla negativa del río | exclusión | 0,5 |
| 8 | `pulpo_rango_temperatura` | El pulpo puntúa la temperatura | null → [16, 21] | 0,5 |
| 9 | `lubina_noche_invierno` | Lubina de noche de noviembre a marzo, desde costa | +0,3 | 0,4 |
| 10 | `lluvia_fuerte_pulpo` | Pulpo y sepia con ≥ 40 mm de lluvia en 48 h | -0,5 (escala hasta 100 mm) | 0,4 |

Otras: `lisa_rio_crecido` (+0,3), `levante_cantabrico_confianza` (0,7 → 0,5),
`calamar_luna_llena` y `congrio_luna_cuartos` (necesitan una variable `luna`
que el motor aún no tiene), `sepia_fuente_temperatura`, `presion_defecto_peso`.

## Huecos (no se encontró evidencia útil)

- Presión atmosférica en cualquier especie marina de la lista.
- Fase de marea en la lubina: la telemetría existe (Cork, Dart, Wadden), pero
  sus resúmenes no analizan la marea.
- Faneca, jurel y caballa a escala de horas: nada.
- Rango de temperatura no NC para sargo, congrio, jurel y caballa.
- Turbidez medida en lubina o sargo (solo analogías con otros peces visuales).

## Fuentes

| Id | Referencia | URL |
|---|---|---|
| stoner_2004 | Stoner 2004, J. Fish Biol. 65: 1445-1471 | https://doi.org/10.1111/j.0022-1112.2004.00593.x |
| heupel_2003 | Heupel et al. 2003, J. Fish Biol. 63 | https://doi.org/10.1046/j.1095-8649.2003.00241.x |
| bacheler_2019 | Bacheler et al. 2019, Sci. Rep. | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6365635/ |
| udyawer_2013 | Udyawer et al. 2013, MEPS 480 | https://int-res.com/abstracts/meps/v480/p171-183 |
| vanderweyst_2014 | VanderWeyst 2014, Bemidji State | https://faculty.bemidjistate.edu/ahafs/wp-content/uploads/sites/2/2024/10/2014-VanderWeyst-D.-The-effect-of-barometric-pressure-on-feeding-activity-of-yellow-perch.pdf |
| doyle_2017_bss | Doyle et al. 2017, Sci. Rep. 7: 45841 | https://doi.org/10.1038/srep45841 |
| pawson_2007_bss | Pawson et al. 2007, ICES JMS 64: 332-345 | https://fishbase.ca/references/FBRefSummary.php?id=90070 |
| begout_1997_bss | Bégout Anras et al. 1997, CJFAS 54 | https://doi.org/10.1139/f96-253 |
| azzaydi_1998_bss | Azzaydi et al. 1998, Chronobiol. Int. | https://doi.org/10.3109/07420529808993197 |
| faucher_2006_bss | Faucher et al. 2006, Aquaculture 252 | https://archimer.ifremer.fr/doc/00000/2267 |
| bss_temperatura_med | Crecimiento y temperatura, lubina mediterránea (Ifremer) | https://archimer.ifremer.fr/doc/00000/626 |
| frontiers_2023_bss_estuarios | Frontiers in Marine Science 2023 | https://doi.org/10.3389/fmars.2023.1209311 |
| bss_flota_decisiones_2022 | PLoS ONE 2022 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8970468/ |
| pita_freire_2011 | Pita y Freire 2011, Sci. Mar. 75(4) | https://scientiamarina.revistas.csic.es/index.php/scientiamarina/article/view/1298 |
| belo_2016_sargo | Belo et al. 2016, Mar. Env. Res. 114 | https://rdpc.uevora.pt/handle/10174/19554 |
| puerto_sargo_rompiente | Puerto-Martínez et al., UCA (póster) | https://ccmaryambientales.uca.es/wp-content/uploads/2023/05/P1-Daniel_Puerto-Martinez.pdf |
| mercier_2012_dorada | Mercier et al. 2012, MEPS 444 | https://int-res.com/abstracts/meps/v444/p175-194 |
| lavin_2007_hom_alb | Lavín et al. 2007, ICES JMS 64: 425-438 | https://doi.org/10.1093/icesjms/fsl042 |
| macy_1998_caballa | Macy et al. 1998, MEPS 172 | https://int-res.com/abstracts/meps/v172/p89-100 |
| sagarminaga_2010_alb | Sagarminaga y Arrizabalaga 2010, Fish. Oceanogr. | https://doi.org/10.1111/j.1365-2419.2010.00532.x |
| sagarminaga_2014_alb_frentes | Sagarminaga y Arrizabalaga 2014 (AZTI) | https://dspace.aztidata.es/handle/24689/329 |
| goni_2015_alb | Goñi et al. 2015, DSR II 113 | https://doi.org/10.1016/j.dsr2.2015.01.012 |
| iccat_2013_alb | ICCAT 2013, evaluación del atún blanco | https://archimer.ifremer.fr/doc/00166/27702/25894.pdf |
| hegaluze_2010_alb | Proyecto Hegaluze 2010 (AZTI/ICCAT) | https://www.researchgate.net/publication/285661325_Ongoing_albacore_research_in_the_Bay_of_Biscay_Northeast_Atlantic_the_Hegaluze_2010_project |
| deia_2025_bonito | Deia, 2025-08-07 (prensa) | https://www.deia.eus/economia/2025/08/07/flota-vasca-capturado-7-100-9960840.html |
| ices_afloramiento_biscay | ICES CM, afloramiento de verano 1993-2000 | https://ices-library.figshare.com/articles/report/Aspects_concerning_the_occurrence_of_summer_upwelling_along_the_southern_Bay_of_Biscay_during_1993-2000/19271861/1 |
| alvarez_afloramiento_cantabrico | Álvarez et al., EPhysLab (UVigo) | https://ephyslab.uvigo.es/publica/documents/file_1JMS_Upwelling_Cantabrico_Ines_10.pdf |
| ulas_2011_calamar | Ulaş y Aydın 2011, Afr. J. Biotechnol. 10(9) | https://ajol.info/index.php/ajb/article/view/92991 |
| guerra_2006_sepia | Guerra 2006, Vie et Milieu 56(2) | https://wwwphp.obs-banyuls.fr/Viemilieu/index.php/volume-56-2006/56-issue-2/562-article-4/download.html |
| iglesias_2016_pulpo_salinidad | Iglesias et al. 2016, J. Appl. Aquac. | https://produccioncientifica.ugr.es/documentos/64fffc67ab53484a60024ee5 |
| sobrino_2020_pulpo | Sobrino et al. 2020, golfo de Cádiz | https://agris.fao.org/search/fr/records/679ba4d4969e37f4376eee94 |
| otero_2008_pulpo | Otero et al. 2008, MEPS 362 | https://int-res.com/abstracts/meps/v362/p181-192 |
| aguado_2002_pulpo | Aguado y García 2002, Aquac. Int. 10 | https://marineinfo.org/doc/publication/34847 |
| cardona_2006_mugilidos | Cardona 2006, Sci. Mar. 70(3) | https://scientiamarina.revistas.csic.es/index.php/scientiamarina/article/view/96 |
| pereira_2017_congrio | Pereira et al. 2017, MEPS 584 | https://doi.org/10.3354/meps12379 |
