# Zonas marinas sin pesca recreativa en España: notas de extracción (2026-10-12)

Ficheros:
- `zonas.json`: 44 zonas, 35 `sin_pesca` y 9 `parcial`. Polígonos en WGS84 `[lon,lat]` cerrados; `huecos` son los islotes de dentro.
- `zonas.geojson`: la misma geometría en GeoJSON.
- `control.tsv`: comprobación de cada zona (área, distancia al lugar nombrado y fracción en tierra).
- `scripts/`: código que lo reproduce (`build.py`, `finalize.py`, `geo.py`, `tin_georef.py`).
- `raw/`: textos descargados.
- `plots/`: un PNG por reserva para revisarlas a ojo.

## Criterio

- **sin_pesca**: el texto no permite ninguna modalidad de pesca recreativa (desde tierra, desde embarcación ni submarina). Entran las reservas integrales y también las zonas donde solo se autoriza pesca profesional. En aguas exteriores lejos de costa la pesca desde tierra no es posible; si el texto prohíbe la de embarcación y la submarina y no autoriza la de tierra, la zona se marca como sin pesca.
- **parcial**: se permite alguna modalidad. La regla exacta va en `regla`.
- Atención: en **Cabo de Palos, Tabarca y Cabo Tiñoso** está prohibida toda la pesca recreativa en **toda** la parte estatal de la reserva, no solo en la integral. En Tabarca lo dice expresamente el art. 5.1.b: "desde embarcación y desde tierra y la pesca submarina".

## Método geométrico

- **Coordenadas**: se transcriben del texto oficial (campo `coordenadas_originales`).
  - ED50 → WGS84 con pyproj (EPSG:4230 → 4326; ED50 UTM29 = EPSG:23029).
  - WGS84 y ETRS89 se dejan sin cambios.
  - Cuando el texto no indica datum se dice en `datum`. En los textos peninsulares y baleares anteriores a 2000 se asume ED50. En Canarias no se corrige: los puntos costeros nombrados caen a menos de 50 m de la costa de OSM.
- **Líneas de base rectas**: del RD 2510/1977 (BOE-A-1977-23967), tratadas como ED50. Comprobación: el vértice "Islas Hormigas" convertido de ED50 cae a 2 m de la posición WGS84 del faro de la Hormiga que da la Orden de 2017.
- **Costa**: OSM land polygons (osmdata.openstreetmap.de, 2026-10-12). Los "cierre por costa aproximado" y las franjas "hasta 1 milla de la costa" o "0,1 millas del litoral" se calculan con esa costa.
- **Isóbatas** (solo La Palma): EMODnet Bathymetry DTM, celda de unos 115 m. Precisión de ±100–200 m.
- **Cabo Tiñoso**: no tiene coordenadas en el texto. El polígono se digitalizó del mapa del anexo de la Orden (retícula ETRS89 georreferenciada con 6 cruces, residuo menor de 4 m).
- **Círculos**: geodésicos, en la proyección UTM local, con 1 milla = 1.852 m.

## Por reserva

### 1. Cabo de Palos–Islas Hormigas
**Norma:** Orden APM/660/2017 (BOE-A-2017-8146), consolidada sin cambios desde el 08/09/2017.

- **Reserva integral:** círculo de 0,5 mn con centro en el faro de la Hormiga (WGS84, art. 2).
- **Resto de la reserva:** solo pesca profesional. El art. 5.1.b prohíbe la recreativa desde embarcación y la submarina; la de tierra no figura entre los usos permitidos. La zona se marca como sin pesca y se recorta a aguas exteriores.

**Dudas:**
- La línea de base recta pasa por la Hormiga, así que la mitad oeste del círculo son aguas interiores (Región de Murcia).
  - No he podido leer el Decreto murciano 15/1995 (BORM 92, 21-4-1995). El BORM pide captcha.
  - Un dictamen de 2026 menciona un posible "Decreto 31/2026", sin verificar.
  - Dibujo el círculo completo porque su área (269 ha) coincide con las "270 ha de reserva integral" que cita un estudio de seguimiento de la CARM. Es una fuente secundaria.
- La parte de aguas interiores del rectángulo (lado de Cabo de Palos) **no está incluida**. Ahí manda la norma murciana.

### 2. Isla de Tabarca
**Norma:** Orden APA/102/2019 (BOE-A-2019-1680) con la corrección de la Orden APA/233/2019. Coordenadas en WGS84.

- **Reserva integral del Bajo de La Llosa:** 5 vértices.
- **Resto de la reserva (aguas exteriores):** toda pesca recreativa prohibida (art. 5.1.b).

**Notas:**
- El texto lista los vértices A, B, C y D, pero el perímetro correcto es A-B-D-C (C y D están al oeste).
- Las aguas interiores entre Tabarca y Santa Pola (Generalitat Valenciana) no están incluidas; no consultado.

### 3. Islas Columbretes
**Norma:** Orden ARM/3841/2008 (BOE-A-2009-68), consolidada al 07/08/2014. Coordenadas en WGS84.

Sin pesca:
- Dos reservas integrales: las aguas al norte de 39°54,5' N y al sur de 39°51,9' N, dentro del trapecio A-D.
- Tres zonas de usos restringidos: círculos de 0,5, 0,5 y 0,6 mn, donde solo se permite buceo y ciencia.

Parcial: el resto de la reserva, donde solo se permite curricán de superficie desde embarcación, con autorización.

### 4. Cabo de Gata–Níjar
**Norma:** Orden ARM/1744/2011 (BOE-A-2011-10923), consolidada al 30/01/2015. Coordenadas en WGS84.

Cinco reservas integrales:
- Media Naranja, La Polacra, Loma Pelada y Cabo de Gata: franjas "desde la línea de base recta hasta 1 milla de la costa", cortadas por un paralelo y una recta, o entre dos meridianos.
- Morrón de Genoveses: círculo de 0,15 mn alrededor de un vértice geodésico en tierra.

**Avisos:**
- Las franjas dependen de la costa OSM y de la línea de base de 1977. Confianza media.
- El "resto" (pesca recreativa desde embarcación permitida) no se dibuja: el límite oeste es "la desembocadura de la Rambla del Agua" y el texto no da sus coordenadas.
- Las aguas interiores de la Junta de Andalucía no se han consultado.

### 5. Isla de Alborán
**Norma:** Orden de 8-9-1998 (BOE-A-1998-22628), consolidada al 08/11/2025. Las modificaciones posteriores solo afectan a la reserva de pesca exterior.

- **Integral 1:** 0,5 mn desde la isla. No hay líneas de base rectas en Alborán, así que se mide desde la costa OSM.
- **Integral 2 (Piedra Escuela):** círculo de 0,5 mn.
  - El PDF original escribe `35 o 57’ 95” N, 2 o 58’ 60” W`, con "segundos" 95 y 60, que son imposibles. Se lee como minutos decimales: 35°57,95' N y 2°58,60' W.
  - No se indica datum; se asume ED50.
- **Parcial:** de media milla a una milla, solo curricán.

### 6. Isla Graciosa e islotes del norte de Lanzarote
**Norma:** Orden de 19-5-1995 (BOE-A-1995-13433), modificada en 1999 y 2001.

- **Reserva integral:** círculo de 1 milla "centrado en el Roque del Este". **La orden no da coordenadas.** Como centro se usa el punto "Roque del Este" (29°16,50' N, 13°20,00' W) del RD 2510/1977, que es un texto legal oficial pero de 1977 y sin datum.
- **Franja hasta 3 mn del centro:** el art. 4.4 solo permite el curricán "a no menos de dos millas de la reserva integral", así que en esa franja no se permite ninguna pesca recreativa. Es mi interpretación (sin_pesca, confianza media).
- **Parcial:** el resto del rectángulo, sin recortar a aguas exteriores. Gran parte son aguas interiores (Decreto canario 62/1995, no consultado).

### 7. Punta de La Restinga–Mar de las Calmas (El Hierro)
**Norma:** Orden de 24-1-1996 (BOE-A-1996-2391), sin modificaciones de zonificación. La Orden APA/89/2005 solo regula el buceo.

- **Sin pesca:**
  - Reserva integral: polígono Herradura–Roque de Naos, que solo permite la pesca profesional de túnidos.
  - Zonas R-1 y R-2: solo pesca profesional con liña y de túnidos. El texto consolidado escribe "Zona 11-2" por "R-2".
- **Parcial:** el resto de la reserva, donde solo se permite pesca recreativa con caña desde tierra.

**Avisos:**
- Datum no indicado.
- Buena parte queda dentro de la línea de base Pta. de la Restinga–Pta. de Orchilla, es decir, en aguas interiores del Gobierno de Canarias, que tiene su propio decreto (no consultado).

### 8. Isla de La Palma
**Norma:** Orden ARM/2094/2010 (BOE-A-2010-12323), modificada por la Orden APA/422/2023. Coordenadas en WGS84.

- **Reserva integral:** de la costa a la isóbata de 500 m, entre 28°30,406' N y 28°32,936' N.
- **Parcial:** de la costa a la isóbata de 1.000 m, donde solo se permite caña desde tierra.

Las isóbatas son de EMODnet y aproximadas.

### 9. Masía Blanca
**Norma:** Orden de 21-12-1999 (BOE-A-2000-398), con vedas prorrogadas hasta el 10-7-2029 por la Orden APA/600/2026.

- **Núcleo:** círculo de 0,2 mn, sin pesca de ningún tipo.
- **Amortiguación:** corona de 0,6 mn; solo pesca profesional con palangre de fondo y trasmallo, así que no se permite la recreativa.

**Avisos:**
- Centro sin datum; se asume ED50.
- El puerto deportivo de Coma-ruga está excluido por el texto. Solo se resta la tierra de OSM, así que las dársenas pueden quedar dentro.

### 10. Cabo Tiñoso
**Norma:** Orden APM/844/2017 (BOE-A-2017-10338).

Toda la reserva es integral: aguas exteriores entre la línea de base y la isóbata de 50 m. No hay coordenadas en el texto; el polígono está digitalizado del anexo. Mide unos 0,07 km², una franja de unos 700 × 150 m al sur del faro.

### 11. Levante de Mallorca–Cala Rajada
**Norma:** Orden APA/690/2018 (BOE-A-2018-8990). Coordenadas en ETRS89.

- **Reserva integral de Cabo Ferrutx:** triángulo entre el meridiano 3°23,850' E, el paralelo 39°49' N y la línea de base C. Formentor–C. del Freu.
- **Zona de usos restringidos de Cala Agulla:** la orden estatal no le pone restricciones de pesca. Se deja dentro del "resto" (parcial).

**Avisos:** las aguas interiores (Decreto balear 71/2016, BOIB 158) no se han consultado. Pueden tener sus propias zonas sin pesca.

### 12. Isla de la Dragonera
**Norma:** Orden APA/1024/2020 (BOE-A-2020-13657). Coordenadas en ETRS89.

- **Reserva integral:** franja de 0,1 mn a lo largo del litoral oeste de la isla. Incluye las zonas de usos restringidos de 50 m.
- **Parcial:** el resto, donde solo se permite pesca desde embarcación con autorización; la de tierra y la submarina están prohibidas.

Las aguas interiores (Govern balear) no se han consultado.

### 13. Os Miñarzos (Galicia)
**Norma:** Decreto 87/2007 (DOG 8-5-2007), modificado por el Decreto 240/2008. Las fuentes dudan entre el 240/2008 y el 241/2008. Coordenadas en WGS84.

- **Sin pesca:** reservas integrales Norte y Sur, entre la costa y la poligonal.
- **Parcial:** el resto, donde se permite pesca recreativa "en superficie" pero no la submarina.

**Dudas:**
- **El texto lo leí en una copia del DOG** (ceida.org), no en el portal de la Xunta.
- No he verificado si el Decreto 240/2008 cambió las coordenadas.
- La mención "estatal y gallega" no se confirma: la reserva es de aguas interiores, de la Xunta.

### 14. Cabo de San Antonio (Comunitat Valenciana)
**Norma:** Decreto 19/2015 (DOGV 7466), consolidado por la GVA al 17-06-2017.

Toda la reserva: aguas interiores entre la línea de base C. de S. Antonio–Dénia y la costa, desde la punta este del cabo hasta el meridiano 0°08'10" E. La pesca recreativa está prohibida en todas sus modalidades (art. 3.1.b).

**Aviso:** con la costa OSM la línea de base de 1977 cruza tierra junto al cabo. Sale una cuña principal frente a Les Rotes más unas astillas. El anexo V dibuja una franja continua. Confianza media.

### 15. Parque Nacional de Cabrera
Todo el ámbito marino de los límites de 2019 se marca como sin pesca: 895 km², dato coherente con las 90.800 ha del parque menos la parte terrestre.

- **Límites:** puntos A–I en ETRS89, Resolución de 7-2-2019 (BOE-A-2019-2215).
- **Base legal de la prohibición:**
  - Ley 14/1991, art. 3.1: prohíbe toda explotación directa de recursos salvo la pesca artesanal profesional.
  - Ley 30/2014, art. 7.3.a: la pesca deportiva y recreativa es incompatible con un parque nacional.
  - El RD 941/2001 solo regula la pesca profesional.
- **Pendiente:** el PRUG balear (Decreto 58/2006), no consultado.

### 16. Parque Nacional de las Islas Atlánticas de Galicia
Cíes, Ons y Sálvora, con los polígonos del anexo de la Ley 15/2002. Están en UTM sin datum; se asume ED50 huso 29. Las áreas cuadran con las del texto: 26,5, 22,1 y 23,4 km² frente a 26,6, 21,7 y 23,1 km².

- **Base legal:** la pesca deportiva es infracción grave (art. 13.3.b), el art. 4 solo exceptúa la pesca artesanal profesional, y la Ley 30/2014 la declara incompatible.
- **Fuera:** Cortegada, que es terrestre.
- **Pendiente:** el PRUG (Decreto 177/2018), no consultado.

Confianza media.

### 17. Illes Medes (Catalunya)
**Norma:** Ley 15/2010 (BOE-A-2010-10214).

- **Reserva natural parcial marina (sin pesca):** polígono a–f del anexo 3.1, en ED50 explícito. El art. 7 prohíbe "la tenencia de utensilios de pesca, así como la pesca".
- **Zona periférica (parcial):** pesca recreativa con una sola caña por licencia; submarina prohibida (art. 8). El datum no se indica en la tabla; se asume ED50.

No he comprobado modificaciones posteriores a 2010.

## No extraído o pendiente

**Gaztelugatxe (Euskadi)**
- No he encontrado el texto oficial (Decreto 229/1998 del biotopo) ni el decreto de Monumento Natural de 2022 que, según prensa, lo sustituye. **Sin coordenadas.**

**Aguas interiores de reservas mixtas (sin consultar)**
- Cabo de Palos (Murcia).
- Tabarca (Generalitat Valenciana).
- Cabo de Gata (Andalucía).
- Graciosa y La Restinga (Canarias).
- Levante de Mallorca y Dragonera (Baleares).

**Otras reservas autonómicas no abordadas**
- Baleares: Badia de Palma, Migjorn de Mallorca, Freus d'Eivissa i Formentera, Illa del Toro, Illes Malgrats, Nord de Menorca, Llevant de Mallorca interior, Es Vedrà…
- Catalunya: Cap de Creus, Ses Negres.
- Galicia: Ría de Cedeira.
- Murcia, Andalucía y Canarias: sus reservas en aguas interiores.

**Cabo de Gata, "resto" (parcial):** sin polígono, porque el límite oeste no tiene coordenadas.

**Cierres temporales** decididos por los órganos de gestión, como los de Os Miñarzos: no incluidos.

## Comprobación (`control.tsv`)

- Las zonas quedan en el mar: la fracción en tierra según OSM es como mucho 0,3 %, en el borde de la costa.
- Están a menos de 5 km del lugar nombrado, con dos excepciones previstas:
  - Cabo de Gata: medido desde el faro, y las integrales se reparten por 35 km de costa hasta Carboneras.
  - La Palma y Cabo Ferrutx: el lugar de referencia (Tazacorte, Cala Rajada) está a 8–11 km.
- Las áreas cuadran con las oficiales donde las conozco: Columbretes 55 km², Os Miñarzos 20,6 km² (2.074 ha), Cabrera e Islas Atlánticas (ver arriba).
