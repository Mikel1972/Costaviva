# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-26T17:16Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7317 | -0.18 | 0.37 | 0.49 |
| Copernicus IBI | 7317 | -0.30 | 0.38 | 0.53 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8545 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7322 | +0.22 | 0.77 | 1.07 |
| Copernicus IBI | 7322 | +0.20 | 0.76 | 0.97 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4336 | -1.75 | 2.86 | 3.50 |
| MET Norway | 4336 | +1.54 | 2.24 | 2.84 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4187 | +1 | 26 | 41 |
| MET Norway | 4187 | -0 | 27 | 42 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3899 | +0.5 | 0.8 | 1.0 |
| MET Norway | 3899 | +0.5 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4476 | -0.98 | 1.59 | 2.69 |
| MET Norway | 4476 | -1.23 | 1.60 | 3.04 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.61 (288) | — | 0.25 (288) |
| 1103 AP Bilbao | 0.39 (286) | — | 0.28 (286) |
| 1117 Gijón | 0.28 (264) | — | 0.41 (264) |
| 1239 Langosteira (A Coruña) | 0.59 (288) | — | 0.26 (288) |
| 1414 Las Palmas Este | 0.18 (288) | — | 0.19 (288) |
| 1421 Sta. Cruz de Tenerife | 0.10 (288) | — | 0.36 (288) |
| 1500 Tarifa | 0.54 (288) | — | 0.28 (288) |
| 1504 Algeciras-Pta. Carnero | 0.35 (288) | — | 0.25 (288) |
| 1512 Ceuta | 0.22 (284) | — | 0.19 (284) |
| 1514 Málaga | 0.10 (285) | — | 0.14 (285) |
| 1712 Tarragona | 0.14 (288) | — | 0.15 (288) |
| 1731 Barcelona II | 0.17 (282) | — | 0.24 (282) |
| 2136 Bilbao-Vizcaya | 0.33 (289) | — | 0.27 (289) |
| 2242 Cabo Peñas | 0.59 (289) | — | 0.37 (289) |
| 2244 Estaca de Bares | 0.51 (289) | — | 0.84 (289) |
| 2246 Villano-Sisargas | 0.50 (289) | — | 0.46 (289) |
| 2248 Cabo Silleiro | 0.63 (144) | — | 0.46 (144) |
| 2342 Golfo de Cádiz | 0.21 (289) | — | 0.16 (289) |
| 2442 Gran Canaria | 0.35 (289) | — | 0.41 (289) |
| 2446 Tenerife Sur | 0.37 (289) | — | 0.13 (289) |
| 2548 Cabo de Gata | 0.27 (289) | — | 0.36 (289) |
| 2610 Cabo de Palos | 0.47 (289) | — | 0.99 (289) |
| 2720 Tarragona (exterior) | 0.31 (288) | — | 0.35 (288) |
| 2798 Cabo de Begur | 0.73 (289) | — | 0.92 (289) |
| 2820 Dragonera (Mallorca) | 0.36 (289) | — | 0.38 (289) |
| 2838 Mahón (Menorca) | 0.37 (289) | — | 0.89 (289) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
