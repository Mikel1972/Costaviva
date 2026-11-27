# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-27T16:56Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7307 | -0.19 | 0.36 | 0.48 |
| Copernicus IBI | 7307 | -0.28 | 0.37 | 0.51 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8535 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7312 | +0.26 | 0.78 | 1.08 |
| Copernicus IBI | 7312 | +0.23 | 0.77 | 0.97 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4292 | -1.69 | 2.80 | 3.44 |
| MET Norway | 4292 | +1.50 | 2.21 | 2.80 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4166 | +1 | 26 | 41 |
| MET Norway | 4166 | +0 | 27 | 42 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3877 | +0.5 | 0.7 | 1.0 |
| MET Norway | 3877 | +0.6 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4455 | -1.00 | 1.63 | 2.74 |
| MET Norway | 4455 | -1.24 | 1.61 | 3.07 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.59 (289) | — | 0.23 (289) |
| 1103 AP Bilbao | 0.37 (288) | — | 0.27 (288) |
| 1117 Gijón | 0.27 (266) | — | 0.39 (266) |
| 1239 Langosteira (A Coruña) | 0.62 (289) | — | 0.25 (289) |
| 1414 Las Palmas Este | 0.16 (288) | — | 0.18 (288) |
| 1421 Sta. Cruz de Tenerife | 0.11 (289) | — | 0.37 (289) |
| 1500 Tarifa | 0.50 (289) | — | 0.24 (289) |
| 1504 Algeciras-Pta. Carnero | 0.30 (289) | — | 0.24 (289) |
| 1512 Ceuta | 0.19 (285) | — | 0.19 (285) |
| 1514 Málaga | 0.10 (286) | — | 0.14 (286) |
| 1712 Tarragona | 0.13 (289) | — | 0.15 (289) |
| 1731 Barcelona II | 0.16 (283) | — | 0.24 (283) |
| 2136 Bilbao-Vizcaya | 0.32 (289) | — | 0.27 (289) |
| 2242 Cabo Peñas | 0.57 (289) | — | 0.36 (289) |
| 2244 Estaca de Bares | 0.49 (289) | — | 0.80 (289) |
| 2246 Villano-Sisargas | 0.49 (289) | — | 0.45 (289) |
| 2248 Cabo Silleiro | 0.68 (120) | — | 0.50 (120) |
| 2342 Golfo de Cádiz | 0.20 (289) | — | 0.14 (289) |
| 2442 Gran Canaria | 0.38 (289) | — | 0.44 (289) |
| 2446 Tenerife Sur | 0.36 (289) | — | 0.13 (289) |
| 2548 Cabo de Gata | 0.25 (289) | — | 0.33 (289) |
| 2610 Cabo de Palos | 0.47 (289) | — | 0.90 (289) |
| 2720 Tarragona (exterior) | 0.31 (289) | — | 0.35 (289) |
| 2798 Cabo de Begur | 0.75 (289) | — | 0.91 (289) |
| 2820 Dragonera (Mallorca) | 0.35 (289) | — | 0.36 (289) |
| 2838 Mahón (Menorca) | 0.38 (289) | — | 0.79 (289) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
