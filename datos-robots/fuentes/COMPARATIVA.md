# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-21T14:54Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7411 | -0.09 | 0.33 | 0.45 |
| Copernicus IBI | 7411 | -0.23 | 0.34 | 0.49 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8639 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7414 | +0.12 | 0.73 | 1.00 |
| Copernicus IBI | 7414 | +0.01 | 0.77 | 1.02 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4534 | -1.35 | 2.58 | 3.20 |
| MET Norway | 4534 | +1.76 | 2.29 | 2.87 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4267 | +3 | 26 | 41 |
| MET Norway | 4267 | +2 | 26 | 40 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3979 | +0.6 | 0.8 | 1.2 |
| MET Norway | 3979 | +0.5 | 0.8 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4553 | -0.81 | 1.52 | 2.71 |
| MET Norway | 4553 | -1.07 | 1.50 | 2.93 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.46 (289) | — | 0.20 (289) |
| 1103 AP Bilbao | 0.23 (287) | — | 0.23 (287) |
| 1117 Gijón | 0.22 (274) | — | 0.29 (274) |
| 1239 Langosteira (A Coruña) | 0.45 (289) | — | 0.28 (289) |
| 1414 Las Palmas Este | 0.30 (286) | — | 0.22 (286) |
| 1421 Sta. Cruz de Tenerife | 0.14 (289) | — | 0.35 (289) |
| 1500 Tarifa | 0.66 (289) | — | 0.40 (289) |
| 1504 Algeciras-Pta. Carnero | 0.51 (289) | — | 0.25 (289) |
| 1512 Ceuta | 0.31 (285) | — | 0.22 (285) |
| 1514 Málaga | 0.12 (285) | — | 0.15 (285) |
| 1712 Tarragona | 0.11 (289) | — | 0.14 (289) |
| 1731 Barcelona II | 0.13 (285) | — | 0.17 (285) |
| 2136 Bilbao-Vizcaya | 0.26 (285) | — | 0.21 (285) |
| 2242 Cabo Peñas | 0.43 (285) | — | 0.26 (285) |
| 2244 Estaca de Bares | 0.44 (286) | — | 0.81 (286) |
| 2246 Villano-Sisargas | 0.45 (285) | — | 0.43 (285) |
| 2248 Cabo Silleiro | 0.54 (261) | — | 0.39 (261) |
| 2342 Golfo de Cádiz | 0.27 (285) | — | 0.22 (285) |
| 2442 Gran Canaria | 0.27 (286) | — | 0.37 (286) |
| 2446 Tenerife Sur | 0.45 (286) | — | 0.10 (286) |
| 2548 Cabo de Gata | 0.21 (286) | — | 0.30 (286) |
| 2610 Cabo de Palos | 0.40 (286) | — | 0.96 (286) |
| 2720 Tarragona (exterior) | 0.21 (286) | — | 0.25 (286) |
| 2798 Cabo de Begur | 0.49 (285) | — | 0.67 (285) |
| 2820 Dragonera (Mallorca) | 0.25 (286) | — | 0.29 (286) |
| 2838 Mahón (Menorca) | 0.28 (287) | — | 0.76 (287) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
