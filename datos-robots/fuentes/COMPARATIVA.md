# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-29T13:39Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8719 | -0.28 | 0.38 | 0.54 |
| Copernicus IBI | 8719 | -0.31 | 0.35 | 0.49 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8719 | +0.3 | 1.6 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8729 | -0.05 | 0.98 | 1.48 |
| Copernicus IBI | 8729 | -0.03 | 0.95 | 1.38 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5006 | -1.56 | 2.56 | 3.27 |
| MET Norway | 5006 | +1.03 | 1.88 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5006 | +2 | 41 | 60 |
| MET Norway | 5006 | +6 | 38 | 56 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4380 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4380 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5004 | -1.02 | 1.83 | 2.76 |
| MET Norway | 5004 | -1.06 | 1.64 | 2.84 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.80 (337) | — | 0.32 (337) |
| 1103 AP Bilbao | 0.43 (337) | — | 0.27 (337) |
| 1117 Gijón | 0.24 (317) | — | 0.47 (317) |
| 1239 Langosteira (A Coruña) | 0.84 (337) | — | 0.35 (337) |
| 1414 Las Palmas Este | 0.14 (329) | — | 0.16 (329) |
| 1421 Sta. Cruz de Tenerife | 0.14 (337) | — | 0.34 (337) |
| 1500 Tarifa | 0.28 (336) | — | 0.11 (336) |
| 1504 Algeciras-Pta. Carnero | 0.11 (335) | — | 0.22 (335) |
| 1512 Ceuta | 0.10 (333) | — | 0.15 (333) |
| 1514 Málaga | 0.08 (334) | — | 0.10 (334) |
| 1712 Tarragona | 0.13 (335) | — | 0.12 (335) |
| 1731 Barcelona II | 0.17 (334) | — | 0.24 (334) |
| 2136 Bilbao-Vizcaya | 0.40 (337) | — | 0.36 (337) |
| 2242 Cabo Peñas | 0.69 (337) | — | 0.41 (337) |
| 2244 Estaca de Bares | 0.56 (337) | — | 0.90 (337) |
| 2246 Villano-Sisargas | 0.60 (337) | — | 0.60 (337) |
| 2248 Cabo Silleiro | 0.89 (337) | — | 0.82 (337) |
| 2342 Golfo de Cádiz | 0.17 (337) | — | 0.11 (337) |
| 2442 Gran Canaria | 0.44 (337) | — | 0.45 (337) |
| 2446 Tenerife Sur | 0.28 (337) | — | 0.15 (337) |
| 2548 Cabo de Gata | 0.25 (337) | — | 0.41 (337) |
| 2610 Cabo de Palos | 0.33 (337) | — | 0.40 (337) |
| 2720 Tarragona (exterior) | 0.18 (337) | — | 0.21 (337) |
| 2798 Cabo de Begur | 0.66 (337) | — | 0.70 (337) |
| 2820 Dragonera (Mallorca) | 0.32 (337) | — | 0.34 (337) |
| 2838 Mahón (Menorca) | 0.51 (337) | — | 0.40 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
