# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-28T15:47Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7281 | -0.20 | 0.36 | 0.49 |
| Copernicus IBI | 7281 | -0.27 | 0.36 | 0.50 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8509 | +0.2 | 1.6 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7286 | +0.30 | 0.79 | 1.10 |
| Copernicus IBI | 7286 | +0.26 | 0.76 | 0.97 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4244 | -1.61 | 2.73 | 3.38 |
| MET Norway | 4244 | +1.49 | 2.20 | 2.79 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4142 | +0 | 25 | 40 |
| MET Norway | 4142 | +1 | 28 | 43 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3853 | +0.6 | 0.7 | 1.0 |
| MET Norway | 3853 | +0.6 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4431 | -1.09 | 1.69 | 2.83 |
| MET Norway | 4431 | -1.28 | 1.64 | 3.15 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.62 (289) | — | 0.24 (289) |
| 1103 AP Bilbao | 0.38 (288) | — | 0.27 (288) |
| 1117 Gijón | 0.26 (265) | — | 0.37 (265) |
| 1239 Langosteira (A Coruña) | 0.70 (289) | — | 0.28 (289) |
| 1414 Las Palmas Este | 0.15 (288) | — | 0.18 (288) |
| 1421 Sta. Cruz de Tenerife | 0.11 (289) | — | 0.38 (289) |
| 1500 Tarifa | 0.46 (289) | — | 0.23 (289) |
| 1504 Algeciras-Pta. Carnero | 0.27 (289) | — | 0.22 (289) |
| 1512 Ceuta | 0.17 (285) | — | 0.17 (285) |
| 1514 Málaga | 0.10 (286) | — | 0.14 (286) |
| 1712 Tarragona | 0.13 (289) | — | 0.15 (289) |
| 1731 Barcelona II | 0.17 (282) | — | 0.23 (282) |
| 2136 Bilbao-Vizcaya | 0.34 (289) | — | 0.29 (289) |
| 2242 Cabo Peñas | 0.58 (289) | — | 0.36 (289) |
| 2244 Estaca de Bares | 0.49 (289) | — | 0.74 (289) |
| 2246 Villano-Sisargas | 0.49 (289) | — | 0.42 (289) |
| 2248 Cabo Silleiro | 0.67 (96) | — | 0.49 (96) |
| 2342 Golfo de Cádiz | 0.20 (289) | — | 0.14 (289) |
| 2442 Gran Canaria | 0.41 (289) | — | 0.46 (289) |
| 2446 Tenerife Sur | 0.35 (289) | — | 0.13 (289) |
| 2548 Cabo de Gata | 0.25 (289) | — | 0.33 (289) |
| 2610 Cabo de Palos | 0.45 (289) | — | 0.82 (289) |
| 2720 Tarragona (exterior) | 0.31 (289) | — | 0.34 (289) |
| 2798 Cabo de Begur | 0.75 (289) | — | 0.90 (289) |
| 2820 Dragonera (Mallorca) | 0.35 (289) | — | 0.35 (289) |
| 2838 Mahón (Menorca) | 0.37 (289) | — | 0.72 (289) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
