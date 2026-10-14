# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-14T12:18Z.
Ventana: últimos 14 días, 8 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3702 | -0.19 | 0.27 | 0.40 |
| Copernicus IBI | 3702 | -0.20 | 0.24 | 0.36 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 3702 | -0.1 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3702 | +0.17 | 1.02 | 1.46 |
| Copernicus IBI | 3702 | -0.06 | 0.87 | 1.29 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2635 | -1.04 | 2.18 | 2.85 |
| MET Norway | 2635 | +1.27 | 1.92 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2635 | +5 | 42 | 62 |
| MET Norway | 2635 | +5 | 39 | 58 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2306 | +0.3 | 0.5 | 0.7 |
| MET Norway | 2306 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2635 | -0.93 | 1.99 | 3.19 |
| MET Norway | 2635 | -1.06 | 1.74 | 3.16 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.45 (142) | — | 0.15 (142) |
| 1103 AP Bilbao | 0.38 (142) | — | 0.20 (142) |
| 1117 Gijón | 0.14 (137) | — | 0.30 (137) |
| 1239 Langosteira (A Coruña) | 0.43 (142) | — | 0.19 (142) |
| 1414 Las Palmas Este | 0.11 (142) | — | 0.13 (142) |
| 1421 Sta. Cruz de Tenerife | 0.22 (142) | — | 0.21 (142) |
| 1500 Tarifa | 0.15 (137) | — | 0.10 (137) |
| 1504 Algeciras-Pta. Carnero | 0.11 (139) | — | 0.13 (139) |
| 1512 Ceuta | 0.11 (142) | — | 0.12 (142) |
| 1514 Málaga | 0.11 (140) | — | 0.10 (140) |
| 1712 Tarragona | 0.17 (141) | — | 0.16 (141) |
| 1731 Barcelona II | 0.18 (140) | — | 0.25 (140) |
| 2136 Bilbao-Vizcaya | 0.22 (144) | — | 0.19 (144) |
| 2242 Cabo Peñas | 0.38 (144) | — | 0.28 (144) |
| 2244 Estaca de Bares | 0.31 (144) | — | 0.39 (144) |
| 2246 Villano-Sisargas | 0.24 (144) | — | 0.22 (144) |
| 2248 Cabo Silleiro | 0.45 (144) | — | 0.39 (144) |
| 2342 Golfo de Cádiz | 0.12 (144) | — | 0.15 (144) |
| 2442 Gran Canaria | 0.35 (144) | — | 0.55 (144) |
| 2446 Tenerife Sur | 0.16 (144) | — | 0.19 (144) |
| 2548 Cabo de Gata | 0.09 (144) | — | 0.27 (144) |
| 2610 Cabo de Palos | 0.21 (144) | — | 0.19 (144) |
| 2720 Tarragona (exterior) | 0.14 (144) | — | 0.15 (144) |
| 2798 Cabo de Begur | 0.75 (144) | — | 0.76 (144) |
| 2820 Dragonera (Mallorca) | 0.23 (144) | — | 0.20 (144) |
| 2838 Mahón (Menorca) | 0.70 (144) | — | 0.34 (144) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
