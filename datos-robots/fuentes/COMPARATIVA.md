# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-23T18:41Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7402 | -0.12 | 0.36 | 0.48 |
| Copernicus IBI | 7402 | -0.26 | 0.37 | 0.52 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8630 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7405 | +0.15 | 0.75 | 1.03 |
| Copernicus IBI | 7405 | +0.10 | 0.76 | 0.99 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4478 | -1.54 | 2.70 | 3.35 |
| MET Norway | 4478 | +1.69 | 2.30 | 2.89 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4261 | +3 | 26 | 42 |
| MET Norway | 4261 | +1 | 26 | 41 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3972 | +0.6 | 0.8 | 1.1 |
| MET Norway | 3972 | +0.5 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4550 | -0.84 | 1.49 | 2.62 |
| MET Norway | 4550 | -1.10 | 1.50 | 2.92 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.53 (289) | — | 0.23 (289) |
| 1103 AP Bilbao | 0.28 (287) | — | 0.26 (287) |
| 1117 Gijón | 0.26 (268) | — | 0.33 (268) |
| 1239 Langosteira (A Coruña) | 0.53 (289) | — | 0.30 (289) |
| 1414 Las Palmas Este | 0.27 (286) | — | 0.23 (286) |
| 1421 Sta. Cruz de Tenerife | 0.13 (289) | — | 0.34 (289) |
| 1500 Tarifa | 0.70 (289) | — | 0.41 (289) |
| 1504 Algeciras-Pta. Carnero | 0.53 (289) | — | 0.26 (289) |
| 1512 Ceuta | 0.30 (285) | — | 0.22 (285) |
| 1514 Málaga | 0.11 (286) | — | 0.14 (286) |
| 1712 Tarragona | 0.12 (288) | — | 0.15 (288) |
| 1731 Barcelona II | 0.14 (285) | — | 0.20 (285) |
| 2136 Bilbao-Vizcaya | 0.28 (289) | — | 0.23 (289) |
| 2242 Cabo Peñas | 0.52 (289) | — | 0.31 (289) |
| 2244 Estaca de Bares | 0.51 (289) | — | 0.89 (289) |
| 2246 Villano-Sisargas | 0.48 (289) | — | 0.45 (289) |
| 2248 Cabo Silleiro | 0.56 (216) | — | 0.38 (216) |
| 2342 Golfo de Cádiz | 0.26 (289) | — | 0.19 (289) |
| 2442 Gran Canaria | 0.30 (289) | — | 0.36 (289) |
| 2446 Tenerife Sur | 0.43 (289) | — | 0.10 (289) |
| 2548 Cabo de Gata | 0.21 (289) | — | 0.27 (289) |
| 2610 Cabo de Palos | 0.45 (289) | — | 1.04 (289) |
| 2720 Tarragona (exterior) | 0.27 (289) | — | 0.31 (289) |
| 2798 Cabo de Begur | 0.64 (289) | — | 0.83 (289) |
| 2820 Dragonera (Mallorca) | 0.30 (289) | — | 0.32 (289) |
| 2838 Mahón (Menorca) | 0.32 (288) | — | 0.87 (288) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
