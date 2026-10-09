# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-09T13:41Z.
Ventana: últimos 14 días, 3 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 645 | -0.30 | 0.39 | 0.62 |
| Copernicus IBI | 645 | -0.35 | 0.38 | 0.57 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 645 | -0.5 | 1.7 | 3.0 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 644 | +0.21 | 1.07 | 1.55 |
| Copernicus IBI | 644 | +0.14 | 0.99 | 1.48 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 752 | -1.28 | 2.74 | 3.48 |
| MET Norway | 752 | +1.33 | 2.18 | 2.63 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 752 | +7 | 41 | 65 |
| MET Norway | 752 | +7 | 40 | 61 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 658 | +0.2 | 0.6 | 0.8 |
| MET Norway | 658 | +0.2 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 752 | -0.78 | 2.06 | 3.18 |
| MET Norway | 752 | -0.83 | 1.73 | 3.15 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.52 (25) | — | 0.22 (25) |
| 1103 AP Bilbao | 0.38 (25) | — | 0.28 (25) |
| 1117 Gijón | 0.14 (24) | — | 0.39 (24) |
| 1239 Langosteira (A Coruña) | 0.54 (25) | — | 0.26 (25) |
| 1414 Las Palmas Este | 0.14 (25) | — | 0.18 (25) |
| 1421 Sta. Cruz de Tenerife | 0.21 (25) | — | 0.16 (25) |
| 1500 Tarifa | 0.13 (24) | — | 0.11 (24) |
| 1504 Algeciras-Pta. Carnero | 0.07 (25) | — | 0.17 (25) |
| 1512 Ceuta | 0.06 (25) | — | 0.13 (25) |
| 1514 Málaga | 0.10 (25) | — | 0.11 (25) |
| 1712 Tarragona | 0.42 (23) | — | 0.10 (23) |
| 1731 Barcelona II | 0.19 (24) | — | 0.34 (24) |
| 2136 Bilbao-Vizcaya | 0.16 (25) | — | 0.21 (25) |
| 2242 Cabo Peñas | 0.43 (25) | — | 0.36 (25) |
| 2244 Estaca de Bares | 0.31 (25) | — | 0.50 (25) |
| 2246 Villano-Sisargas | 0.42 (25) | — | 0.34 (25) |
| 2248 Cabo Silleiro | 1.00 (25) | — | 0.88 (25) |
| 2342 Golfo de Cádiz | 0.17 (25) | — | 0.26 (25) |
| 2442 Gran Canaria | 0.14 (25) | — | 0.32 (25) |
| 2446 Tenerife Sur | 0.18 (25) | — | 0.10 (25) |
| 2548 Cabo de Gata | 0.10 (25) | — | 0.23 (25) |
| 2610 Cabo de Palos | 0.44 (25) | — | 0.45 (25) |
| 2720 Tarragona (exterior) | 0.15 (25) | — | 0.23 (25) |
| 2798 Cabo de Begur | 1.86 (25) | — | 2.09 (25) |
| 2820 Dragonera (Mallorca) | 0.56 (25) | — | 0.51 (25) |
| 2838 Mahón (Menorca) | 1.43 (25) | — | 0.82 (25) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
