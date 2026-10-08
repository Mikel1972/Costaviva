# Batimetría: fuentes, licencias y atribución (verificado 2026-10-08)

Para qué: profundidad del mar delante de cada spot y la alcanzable a 5 km
(índice de pesca, reglas de embarcación) e isóbatas de 20, 50 y 100 m en el mapa.

## EMODnet Bathymetry: fuente principal

- **Producto**: EMODnet Digital Bathymetry (DTM 2024), rejilla de 1/16 de
  minuto de arco (~115 m), elevación en metros (negativo = mar). Cubre los
  mares europeos, incluidos Canarias, Madeira y Azores.
- **Licencia: CC BY 4.0.** Página "Terms of Use for EMODnet online services,
  data and data products"
  (https://emodnet.ec.europa.eu/en/terms-use-emodnet-online-services-data-and-data-products),
  leída el 2026-10-08: "Unless indicated otherwise, data products created by
  EMODnet are owned by the EU and therefore licensed under Creative Commons
  CC-BY 4.0." y "EMODnet operates on the principle of open data and strives
  to ensure that data and data products are provided free of restrictions of
  use and free of costs", con usuarios de "private industry". CC BY 4.0
  permite el uso comercial; exige crédito, enlace a la licencia e indicar
  los cambios (por eso las isóbatas dicen "calculadas por Costaviva").
  Incluye la exención de garantías de la sección 5 de CC BY 4.0. El DTM es un
  producto de EMODnet (no los datos de levantamiento de cada originador, que
  no usamos).
- **Cita pedida** (https://emodnet.ec.europa.eu/en/bathymetry, "How to cite
  EMODnet Bathymetry products"): "EMODnet Digital Bathymetry (DTM 2024).
  EMODnet Bathymetry Consortium https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1".
  El WCS confirma que la cobertura `emodnet__mean` es ese DTM (metadatos
  `cf51df64-...`).
- **Texto en la app** (atribución del mapa al encender la capa, y
  `fuentes.emodnet_dtm_2024` de `especies.json`): "Batimetría: EMODnet
  Bathymetry Consortium (DTM 2024), CC BY 4.0", con enlace al DOI y a la
  licencia.
- **Servicios usados** (públicos, sin clave):
  - WCS 2.0.1 `https://ows.emodnet-bathymetry.eu/wcs`, cobertura
    `emodnet__mean`, `FORMAT=text/plain` (scripts de `scripts/batimetria/`).
    El navegador pide al mismo WCS una caja de ~6 km para los puntos propios
    (CORS abierto: `access-control-allow-origin: *`).
  - REST `https://rest.emodnet-bathymetry.eu/depth_sample?geom=POINT(lon lat)`
    (devuelve `avg`, elevación media de la celda; negativo = mar): comprobado
    que funciona, no se usa (hace falta el fondo alrededor, no el de un punto).
  - WMS `https://ows.emodnet-bathymetry.eu/wms`: la antigua capa "Fondo" (quitada el 2026-10-08: duplicaba el relieve del mapa base y las isóbatas)
    (`emodnet:mean` + `emodnet:contours`). Ojo: `emodnet:contours` solo tiene
    50, 100, 200, 500, 1000, 2000 y 5000 m ("Generalised bathymetric contour
    lines"); la isóbata de 20 m no existe en el WMS y se calcula aquí.

## GEBCO: respaldo

- **Producto**: GEBCO_2026 Grid (15 segundos de arco, ~460 m).
- **Condiciones** (https://www.gebco.net/data-products/gridded-bathymetry/terms-of-use,
  leídas el 2026-10-08): "The GEBCO Grid is placed in the public domain and
  may be used free of charge." Se puede copiar, publicar, adaptar y
  "Commercially exploit The GEBCO Grid, by, for example, combining it with
  other information, or by including it in their own product or
  application". Obligaciones: reconocer la fuente, no sugerir respaldo
  oficial de GEBCO/IHO/IOC, no tergiversarlo. "should NOT be used for
  navigation or for any other purpose involving safety at sea".
- **Atribución pedida**: "GEBCO Compilation Group (2026) GEBCO_2026 Grid
  (doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa)".
- **Acceso**: OPeNDAP de CEDA,
  `https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc`
  (`.ascii?elevation[f0:1:f1][c0:1:c1]`). Solo se usa si EMODnet falla o no
  tiene mar a 1 km de un spot; en la ejecución del 2026-10-08 no hizo falta
  para ningún spot (los 105 salen de EMODnet).

## Aviso

Las profundidades y las isóbatas son orientativas (rejilla de ~115 m,
simplificadas): no sirven para navegar. El texto de la capa lo dice.
