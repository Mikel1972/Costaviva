# Zonas marinas sin pesca recreativa en Portugal: notas de extracción (2026-10-12)

## Ficheros

- `zonas.geojson`: 52 zonas en WGS84, con las mismas propiedades que `reservas-es`. Hay 24 `sin_pesca` y 28 `parcial`.
- `zonas.json`: la misma información en el formato de `reservas-es`, con `poligono`, `huecos` y `poligonos_extra`.
- `control.tsv`: una fila por zona con el área, la distancia a un lugar de referencia y la fracción en tierra según OSM.
  - En las áreas oceánicas de Azores, `zonas.json` y `zonas.geojson` guardan además la distancia entre el centroide calculado y el centroide oficial del anexo I.
- `scripts/`: el código que lo genera.
  - `build.py` construye las zonas y `finalize.py` escribe las salidas.
  - `geo.py` contiene utilidades.
  - `pnln_vertices.py` y `azores_pma.json` guardan las coordenadas transcritas.
  - `pnsacv_lattice.py`, `pnsacv_edges.py` y `px2grid.py` georreferencian los planos del PNSACV.
  - `pnln_*.py` comprueban la tabla del PNLN.
  - `plot.py` dibuja los mapas de revisión.
- `raw/`: los PDF oficiales descargados y su texto extraído. `plots/` tiene un PNG por reserva y `plots/src/` los recortes de los planos.
- Para reproducirlo: `python3 -I scripts/build.py scripts && python3 -I scripts/finalize.py scripts`. Necesita `land_pt.pkl`, que se genera con `extract_land.py` a partir de los OSM land polygons.

## Criterio

- **sin_pesca**: el texto prohíbe todas las modalidades de pesca lúdica (desde tierra, embarcada y submarina).
  - En Portugal la pesca lúdica comprende la apanha (marisqueo a pie), la pesca a la línea y la pesca submarina.
- **parcial**: el texto permite alguna modalidad, o la somete a condiciones o a autorización. La regla exacta figura en `regla`.
  - En las áreas de hábitats de Azores la pesca lúdica solo es posible con autorización de la Autoridad de Gestión de la RAMPA. Se marcan como `parcial`: sin autorización no se puede pescar.
- Las coordenadas transcritas están en `coordenadas_originales`. Nada se inventa: cuando una geometría no sale de coordenadas del texto, se indica en `avisos` y baja la `confianza`.

## Fuentes y método

- **Textos**: PDF oficiales de diariodarepublica.pt.
  - Se descargan con `https://diariodarepublica.pt/redirect/LinkFicheiroAntigo.aspx?conteudoId=<id>`. El id se obtiene con el redirect ELI (`/redirect/LinkELI.aspx?search=...`).
  - Los textos de Madeira que no están en el DR se toman del IFCN y del JORAM.
- **Datums**: conversión con pyproj.
  - ED50 (EPSG:4230).
  - Hayford-Gauss Datum Lisboa en coordenadas militares (EPSG:20790). Comprobado: los 8 puntos costeros de la Portaria 143/2009 caen a 1-28 m de la costa OSM.
  - Porto Santo 1995 (EPSG:4663). Comprobado: los dos puntos costeros del Garajau caen a 0 m de la costa OSM; en WGS84 quedarían a 430-550 m.
- **Costa**: OSM land polygons (osmdata.openstreetmap.de, copia del 2026-10-12). Se usa para los cierres por costa, para las franjas de 100 m y de 2 km, y para las 12 millas de las Selvagens.
- **Isóbatas** (Madeira): EMODnet Bathymetry (WCS `emodnet__mean`, celda de unos 115 m). La precisión es de ±100-200 m.
- **Planos ráster** del DR: se usan cuando el texto remite a la planta de síntese. Se georreferencian con su propia cuadrícula y se dan los residuos de cada ajuste.

## Por reserva

### 1. Parque Marinho Professor Luiz Saldanha (Arrábida): no se dibuja

**Norma**: RCM 141/2005 (POPNA), DR I-B n.º 161, 23-8-2005. No tiene modificaciones posteriores. Hay un Programa Especial en elaboración (Despacho 2066/2025) que todavía no está aprobado.

Reglas de pesca lúdica:
- **Protección total**: solo se permite la presencia humana para investigación, vigilancia y emergencias, y el paso inofensivo a más de ¼ de milla de la costa (art. 39). No hay pesca: `sin_pesca`.
- **Protección parcial** (incluido el Portinho da Arrábida): prohibida la pesca lúdica en todas sus modalidades (art. 41.1.g): `sin_pesca`.
- **Protección complementaria**: en todo el parque marino están prohibidas la apanha y la caza submarina (art. 34.1.q). Solo queda la pesca a la línea, pendiente de una regulación específica (art. 47): `parcial`.

**Por qué no hay geometría**:
- El texto no da coordenadas de las zonas. Remite a la planta de síntese 1:25 000.
- En el DR, la planta se publicó como una imagen gris de 1028×698 px de todo el parque, a unos 45 m por píxel. La cuadrícula no se puede leer y los tonos de total y parcial no se distinguen en el mar. Digitalizarla sería inventar.
- El límite exterior (DR 11/2003) tiene coordenadas en Datum Lisboa: P1 38°27'18"N 9°14'W, P2 38°23'54"N 9°14'W, P3 38°23'54"N 9°11'42"W. Pero se cierra hacia el este por las balizas n.º 2 y n.º 4 de la barra de Setúbal, sin coordenadas, y excluye las aguas de la APSS.
- **Pendiente**: pedir al ICNF la capa vectorial o la planta de síntese original del POPNA.

### 2. Reserva Natural das Berlengas: 6 zonas, todas `parcial`

**Norma**: RCM 180/2008. El art. 3.3 indica que todas las posiciones están en la carta IH 26 405, Datum Europeu 1950, así que se usa ED50.

- **Regla común**: la pesca lúdica está permitida en toda la reserva, pero solo con líneas de mano, cañas, curricán y toneira.
  - Prohibidas la submarina y la apanha (arts. 31.1.p y 44).
  - Desde embarcación está prohibido pescar a menos de 50 m de tierra, usar anzuelos de menos de 9 mm y la técnica «chumbadinha».
  - El DR 30/98 (art. 14.6) prohíbe además capturar mero e invertebrados.
- **Protección parcial I** (polígonos A–F y G–K, más la franja de 100 m de las Forcadas): del 1 de mayo al 15 de septiembre está prohibido pescar desde la costa sur de la Berlenga, entre el Carreiro do Mosteiro y la Ponta da França. Esta veda se pone en `regla` y no se dibuja.
- **Forcadas**: son los islotes OSM del rectángulo Farilhões–Forcadas que quedan fuera del polígono Farilhões.
- **Rectángulo exterior** (DR 30/98: 39°24'–39°30'N, 9°28'–9°34'W): no indica datum y se asume ED50 (`confianza: media`).

Comprobación: las seis piezas suman 94,4 km², el área del rectángulo.

### 3. Parque Natural do Litoral Norte: 4 arrecifes `sin_pesca`

**Norma**: RCM 175/2008.
- En las «áreas de protecção parcial do tipo I marinhas», que son los arrecifes y su área de protección, está prohibida la pesca lúdica en todas sus modalidades (art. 43.1.d).
- En el resto del área marina está prohibida la pesca submarina (art. 38.1.i).

**Coordenadas**: el texto no las da.
- La planta de síntese (DR p. 8313) incluye una tabla con los 16 vértices de los 4 cuadriláteros, en lat/lon en grados, minutos y segundos.
- La tabla se leyó de una imagen de baja resolución. Los segundos enteros se validaron:
  - Un ajuste afín de los 16 vértices contra los cuadriláteros detectados en el plano da un rms de 3,5 px.
  - Las proporciones de los lados coinciden.
- **Datum**: la tabla no lo dice y el plano está en Hayford-Gauss Datum Lisboa.
  - Se georreferenció el plano con los vértices bajo cada hipótesis y se comparó la costa del plano con la de OSM en 425 filas.
  - La mediana de la diferencia es de 42 m con WGS84/ETRS89, 115 m con Datum Lisboa y 180 m con ED50. Se adopta WGS84 (`confianza: media`).

**No se dibuja** el resto del área marina (`parcial`, sin pesca submarina): su límite exterior solo existe en el plano (anexo II del DR 6/2005).

### 4. Parque Natural do Sudoeste Alentejano e Costa Vicentina: 7 `sin_pesca` y 1 `parcial`

**Normas**:
- RCM 11-B/2011 (POPNSACV), rectificada por la Declaração de Rectificação 10-B/2011, que no toca la parte marina.
- Portaria 143/2009, modificada por la 458-A/2009 y republicada por la 115-A/2011.

**Reglas**:
- **Protección total y parcial I**: prohibida la pesca lúdica y la deportiva en todas sus modalidades (art. 75.4; Portaria, art. 2.a): `sin_pesca`.
- **Parcial II** (estuarios): prohibida la submarina. No se dibuja porque son aguas fluviales.
- **Complementaria**: pesca permitida con las condiciones de la Portaria. Prohibida los miércoles; máximo 2 cañas y 3 anzuelos de 9 mm o más; vedas de sargo y de maragota (bodião); 7,5 kg al día; apanha solo para residentes.

**Geometría**:
- El texto de 2011 dice «assinaladas na planta de síntese».
- Las coordenadas de la Portaria 143/2009 (anexo I, tabla 1) se revocaron en 2011.
- Se georreferenciaron las hojas de la planta (ráster del DR a 300 dpi) con su cuadrícula Hayford-Gauss Datum Lisboa:
  - Cruces cada 3 km en X y 2 km en Y; rótulos legibles.
  - Entre 39 y 75 cruces por hoja, con rms de 0,37 a 0,46 px (≈6 m).
  - Los bordes se midieron por transición de gris.

| Zona | Medición en el plano | Comparación |
|---|---|---|
| Pessegueiro | Y = 97 769 y 94 967 | Coincide al metro con los puntos 1 y 2 de 2009 (97 769,4 y 94 970,8): las zonas de 2011 son las de 2009. `alta`. |
| Sardão | Norte Y = 70 984 | Igual que el punto 3 de 2009. |
| Sardão | Sur Y ≈ 67 702 | 72 m al sur del punto 4 de 2009. Se usa el plano. |
| «Arrifana» | Y 45 098 a 47 858 (37,37–37,39 N, al norte de Aljezur) | El plano no tiene zona parcial I frente a la playa de Arrifana (37,29–37,31 N), donde la ponía la Portaria de 2009. **Discrepancia** entre texto y plano: se dibuja el plano y se marca `confianza: media`. Comprobado que la georreferencia de esa hoja es correcta: la villa de Aljezur cae a ~50 m de su posición real. |
| Martinhal | Lado oeste diagonal, sur Y ≈ 4 743, este X ≈ 131 750 | Difiere de la zona de 2009. `media`. |

- **Área marina**: franja de 2 km desde la costa continental OSM, sin islotes.
  - Comprobada contra el límite dibujado en el plano en 4 puntos, con diferencias de 1 a 22 m. Si se cuentan los islotes, el límite se aleja hasta 600 m, cosa que el plano no hace.
  - Límite norte (São Torpes): Y ≈ 106 676, medido en la hoja 1. Límite este (Burgau): X ≈ 143 131, medido en la hoja 6.
  - Área total ≈ 300 km², frente a las «aprox. 29 000 ha» del art. 4.c.
- **Protección total** (art. 63: arrecifes nombrados más 100 m): solo 3 de las 9 piedras tienen coordenadas oficiales: Agulha, Gaivotas y Gigante (Portaria 143/2009, tabla 2, coordenadas militares).
  - Se dibujan como un círculo de 100 m más la franja de 100 m del islote OSM, si existe.
  - **No se dibujan** Burrinho, Atalaia, las pedras adyacentes al Pessegueiro, Santoleiro, Baía da Nau y Carraça. No tienen coordenadas en ningún texto; en el plano son manchas de pocos píxeles. Están dentro de la zona naranja, pero son `sin_pesca`.
- **No comprobado**: si la Portaria 143/2009 tuvo modificaciones posteriores a 2011.

### 5. Parque Natural Marinho do Recife do Algarve – Pedra do Valado (añadido, fuera de la lista pedida)

**Normas**: RCM 1/2024 y Despacho de 27-2-2024.
- **Reserva integral** (vértices 5–8 del anexo I): `sin_pesca`.
- **Resto del parque**: `parcial`. La pesca lúdica queda sujeta a la autorización que defina el Programa Especial; mientras tanto rigen las reglas generales. Está prohibida la captura con escafandra.
- **Datum**: no se indica. Se toma WGS84: los puntos costeros 1 y 2 caen a 1-2 m de la costa OSM.
- Área: 156,5 km², frente a los «≈156 km²» del texto.

### 6. Madeira

- **Garajau** (DLR 23/86/M; PEOGRNPG, Resolução 882/2010): prohibida cualquier pesca (`sin_pesca`).
  - Hay coordenadas en Porto Santo 1995 de los dos extremos costeros y de los dos puntos de la isóbata de 50 m.
  - Límite sur: isóbata de 50 m y, «en caso de duda», nunca a menos de 600 m de la costa. Los puntos oficiales de la isóbata quedan a 440-565 m de la costa, menos que esos 600 m.
  - Se usa la unión de la franja de 600 m y la zona de menos de 50 m de EMODnet. Resultado: 3,79 km², frente a 376 ha oficiales.
- **Desertas** (DLR 27/2021/M): reserva hasta la isóbata de 100 m (EMODnet). Total ≈ 101 km² marinos, frente a 114,6 km² oficiales con tierra incluida.
  - **Reserva integral**: prohibida la pesca lúdica y la comercial, salvo la «captura de tunídeos e respetivo isco» (art. 7.1 y 9.1.a), que el texto no limita a profesionales. Se marca `parcial` y se explica en `regla`.
  - **Área crítica del lobo marino** (Rocha do Amarelo–Tabaqueiro, coordenadas en el texto): sin la excepción de los túnidos, `sin_pesca`.
  - **Reserva parcial** (norte): solo pesca embarcada (`parcial`).
  - **Datum**: no se indica. Se toma WGS84: los tres puntos oficiales caen a 10-25 m de la costa OSM.
  - **Rectas de Doca y Fajã Grande**: no tienen coordenadas. Se midieron en el mapa del anexo escalándolo con las latitudes oficiales de Amarelo y Tabaqueiro. Comprobación: la recta de Doca queda a 60 m de la coordenada oficial del «azimute da Furna».
- **Selvagens** (DLR 8/2022/M): prohibida toda pesca, incluida la recreativa, en 12 millas alrededor de las islas (`sin_pesca`).
  - Franja de 22 224 m desde la costa OSM: 2716 km², frente a 2677 km² oficiales.
  - Hubo propuestas de reducirla a 2 mn (2024). Según el IFCN (septiembre de 2025), la prohibición se mantiene. No se ha comprobado si hay modificaciones después de esa fecha.
- **Rocha do Navio** (DLR 11/97/M): se permite la pesca deportiva y a la línea; están prohibidas la caza submarina y la apanha buceando (`parcial`).
  - El texto no da coordenadas. Las puntas Clérigo y São Jorge se tomaron de OSM y la isóbata de 100 m de EMODnet (`confianza: baja`).
  - Área: 17,4 km², frente a 1710 ha oficiales.
- **No dibujadas en Madeira**:
  - **Porto Santo** (DLR 32/2008/M). En el Ilhéu de Cima está prohibida toda pesca (`sin_pesca`); en el Ilhéu da Cal la pesca lúdica y la submarina requieren autorización. Los límites son azimuts desde puntos sin coordenadas más la isóbata de 50 m, y el mapa del anexo no tiene cuadrícula.
  - **Cabo Girão** (DLR 4/2017/M) y **Ponta do Pargo** (DLR 2018): la pesca lúdica está permitida con el régimen general, así que no son zonas restringidas.

### 7. Azores

**Normas**: DLR 28/2011/A, modificado por los DLR 13/2016/A, 14/2024/A, 22/2025/A y 6/2026/A. Se usa la republicación de 3-3-2026.

- **Áreas oceánicas**: anexo I con vértices en WGS84, en grados y minutos decimales, leídos de las imágenes de la tabla.
  - **Reservas naturales marinas** (PMA02, 03, 11, 14, 15, 16, 22, 24 y 31): prohibida la pesca lúdica, incluida la submarina, y toda pesca comercial (art. 76): `sin_pesca`.
  - **Áreas para la gestión de hábitats dentro de la ZEE** (PMA12-A, 13-A, 17-21, 23 y 25-30): la pesca lúdica requiere autorización (art. 81.b): `parcial`. Se les restan las reservas incluidas en ellas (PMA02 y 03 dentro de 13-A).
  - **Excluidas**: PMA04 (Rainbow), PMA08, 09, 10, 12 y 13. Están en la plataforma continental más allá de la ZEE y solo protegen el fondo (art. 69.2 y art. 75: el régimen de usos solo se aplica dentro de las 200 millas).
  - **Validación con el área oficial**: 18 de las 23 zonas quedan dentro de ±1,5 %, por el redondeo a 0,1'.
    - PMA12-A, 16, 17, 18 y 20 tienen entre −2 % y −15 %. En el mapa del anexo II, esos lados siguen el arco del límite de la ZEE y la tabla solo da los vértices. Falta esa franja en el borde de la ZEE y su `confianza` es `media`.
    - Los centroides de las zonas sin arco quedan a 0,0-0,12 km del centroide oficial.
- **Costeras con coordenadas** (anexo III de los parques naturales de isla): Ilhéu de Baixo y Ilhéu da Praia (Graciosa, DLR 45/2008/A) e Ilhéu da Vila (Santa Maria, DLR 47/2008/A, republicado por el 39/2012/A). Son rectángulos.
  - En Graciosa la pesca no ordenada requiere dictamen vinculante.
  - En el Ilhéu da Vila solo se permite la pesca de pequeños pelágicos, con dictamen vinculante. Están prohibidas la submarina y la apanha.
  - Todas `parcial`. El datum no se indica y se toma WGS84; si fuera el local, el rectángulo se desplazaría ~100 m.
- **No dibujadas en Azores**:
  - **Caldeirinhas** (Faial, DLR 46/2008/A, modificado por el DLR 7/2019/A): prohibidas la pesca, la caza submarina y el acceso libre (`sin_pesca`). Su límite es la bahía cerrada por una recta entre sus puntas, sin coordenadas.
  - **Ilhéu de Vila Franca do Campo** (São Miguel, SMG06): prohibida toda pesca, incluida la lúdica. Su límite es el propio islote al nivel medio del mar.
  - Las **≈25 áreas costeras de gestión de recursos** de los parques de isla (COR02, FLO09, SJO10-13, PICO20-22, FAI10-13, GRA07-08, TER15-20, SMG19-23, SMA11-13): cada una tiene su régimen y no se procesaron.
  - Las **fichas de los anexos III-IX** de las reservas oceánicas, que son imágenes y pueden contener zonificación interna: no se leyeron.
  - El **régimen transitorio del plan de situación del espacio marítimo** (art. 32.2): no consultado.

## Avisos generales

- Las franjas «desde la costa» usan la costa OSM, que corresponde aproximadamente a la pleamar, y no la bajamar ni las líneas de base oficiales. El error es de decenas de metros.
- Las zonas de Portugal continental tienen planes de ordenamiento de 2005-2011. Por la Lei 31/2014 se están convirtiendo en «programas especiales» (PEPNSACV, PEPNA). Ninguno estaba aprobado según lo consultado, pero conviene revisarlo cada año.
