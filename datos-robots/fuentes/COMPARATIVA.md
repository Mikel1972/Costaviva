# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-24T18:14Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7366 | -0.14 | 0.36 | 0.48 |
| Copernicus IBI | 7366 | -0.26 | 0.37 | 0.51 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8594 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7369 | +0.16 | 0.75 | 1.04 |
| Copernicus IBI | 7369 | +0.13 | 0.75 | 0.98 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4433 | -1.58 | 2.73 | 3.38 |
| MET Norway | 4433 | +1.64 | 2.28 | 2.88 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4236 | +2 | 27 | 44 |
| MET Norway | 4236 | +1 | 27 | 43 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3948 | +0.6 | 0.8 | 1.1 |
| MET Norway | 3948 | +0.6 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4525 | -0.86 | 1.51 | 2.56 |
| MET Norway | 4525 | -1.10 | 1.51 | 2.90 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.54 (288) | — | 0.23 (288) |
| 1103 AP Bilbao | 0.31 (286) | — | 0.26 (286) |
| 1117 Gijón | 0.26 (268) | — | 0.35 (268) |
| 1239 Langosteira (A Coruña) | 0.56 (288) | — | 0.27 (288) |
| 1414 Las Palmas Este | 0.25 (285) | — | 0.22 (285) |
| 1421 Sta. Cruz de Tenerife | 0.12 (288) | — | 0.34 (288) |
| 1500 Tarifa | 0.65 (288) | — | 0.37 (288) |
| 1504 Algeciras-Pta. Carnero | 0.47 (288) | — | 0.25 (288) |
| 1512 Ceuta | 0.28 (284) | — | 0.20 (284) |
| 1514 Málaga | 0.11 (284) | — | 0.14 (284) |
| 1712 Tarragona | 0.12 (288) | — | 0.15 (288) |
| 1731 Barcelona II | 0.16 (282) | — | 0.22 (282) |
| 2136 Bilbao-Vizcaya | 0.29 (289) | — | 0.24 (289) |
| 2242 Cabo Peñas | 0.53 (289) | — | 0.32 (289) |
| 2244 Estaca de Bares | 0.51 (289) | — | 0.87 (289) |
| 2246 Villano-Sisargas | 0.48 (289) | — | 0.44 (289) |
| 2248 Cabo Silleiro | 0.55 (192) | — | 0.39 (192) |
| 2342 Golfo de Cádiz | 0.26 (289) | — | 0.20 (289) |
| 2442 Gran Canaria | 0.30 (289) | — | 0.38 (289) |
| 2446 Tenerife Sur | 0.40 (289) | — | 0.10 (289) |
| 2548 Cabo de Gata | 0.20 (289) | — | 0.28 (289) |
| 2610 Cabo de Palos | 0.42 (289) | — | 0.97 (289) |
| 2720 Tarragona (exterior) | 0.27 (289) | — | 0.31 (289) |
| 2798 Cabo de Begur | 0.64 (289) | — | 0.83 (289) |
| 2820 Dragonera (Mallorca) | 0.29 (289) | — | 0.31 (289) |
| 2838 Mahón (Menorca) | 0.34 (289) | — | 0.86 (289) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
