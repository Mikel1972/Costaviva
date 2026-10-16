# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-16T11:51Z.
Ventana: últimos 14 días, 10 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4992 | -0.18 | 0.26 | 0.38 |
| Copernicus IBI | 4992 | -0.20 | 0.25 | 0.36 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 4992 | +0.0 | 1.4 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4992 | +0.13 | 1.01 | 1.44 |
| Copernicus IBI | 4992 | -0.15 | 0.89 | 1.31 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3038 | -1.02 | 2.15 | 2.81 |
| MET Norway | 3038 | +1.26 | 1.90 | 2.29 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3038 | +6 | 43 | 62 |
| MET Norway | 3038 | +6 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2657 | +0.3 | 0.5 | 0.7 |
| MET Norway | 2657 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3038 | -0.85 | 1.95 | 3.08 |
| MET Norway | 3038 | -1.02 | 1.71 | 3.07 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.47 (193) | — | 0.17 (193) |
| 1103 AP Bilbao | 0.36 (193) | — | 0.19 (193) |
| 1117 Gijón | 0.15 (185) | — | 0.31 (185) |
| 1239 Langosteira (A Coruña) | 0.48 (193) | — | 0.19 (193) |
| 1414 Las Palmas Este | 0.10 (193) | — | 0.11 (193) |
| 1421 Sta. Cruz de Tenerife | 0.19 (193) | — | 0.25 (193) |
| 1500 Tarifa | 0.21 (187) | — | 0.14 (187) |
| 1504 Algeciras-Pta. Carnero | 0.12 (189) | — | 0.15 (189) |
| 1512 Ceuta | 0.14 (193) | — | 0.16 (193) |
| 1514 Málaga | 0.11 (191) | — | 0.13 (191) |
| 1712 Tarragona | 0.14 (192) | — | 0.14 (192) |
| 1731 Barcelona II | 0.15 (191) | — | 0.21 (191) |
| 2136 Bilbao-Vizcaya | 0.21 (193) | — | 0.20 (193) |
| 2242 Cabo Peñas | 0.42 (192) | — | 0.32 (192) |
| 2244 Estaca de Bares | 0.32 (192) | — | 0.44 (192) |
| 2246 Villano-Sisargas | 0.28 (193) | — | 0.29 (193) |
| 2248 Cabo Silleiro | 0.43 (193) | — | 0.40 (193) |
| 2342 Golfo de Cádiz | 0.13 (192) | — | 0.14 (192) |
| 2442 Gran Canaria | 0.36 (193) | — | 0.52 (193) |
| 2446 Tenerife Sur | 0.16 (193) | — | 0.20 (193) |
| 2548 Cabo de Gata | 0.16 (193) | — | 0.45 (193) |
| 2610 Cabo de Palos | 0.19 (193) | — | 0.19 (193) |
| 2720 Tarragona (exterior) | 0.12 (193) | — | 0.14 (193) |
| 2798 Cabo de Begur | 0.59 (193) | — | 0.59 (193) |
| 2820 Dragonera (Mallorca) | 0.20 (193) | — | 0.18 (193) |
| 2838 Mahón (Menorca) | 0.59 (193) | — | 0.30 (193) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
