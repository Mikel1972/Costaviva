# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-22T14:51Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7428 | -0.10 | 0.35 | 0.46 |
| Copernicus IBI | 7428 | -0.24 | 0.36 | 0.50 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8656 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7431 | +0.14 | 0.74 | 1.01 |
| Copernicus IBI | 7431 | +0.05 | 0.76 | 1.01 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4529 | -1.43 | 2.65 | 3.28 |
| MET Norway | 4529 | +1.80 | 2.34 | 2.93 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4284 | +3 | 26 | 41 |
| MET Norway | 4284 | +2 | 25 | 40 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3995 | +0.6 | 0.8 | 1.1 |
| MET Norway | 3995 | +0.5 | 0.8 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4573 | -0.80 | 1.48 | 2.65 |
| MET Norway | 4573 | -1.07 | 1.48 | 2.92 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.51 (289) | — | 0.22 (289) |
| 1103 AP Bilbao | 0.26 (287) | — | 0.25 (287) |
| 1117 Gijón | 0.24 (270) | — | 0.31 (270) |
| 1239 Langosteira (A Coruña) | 0.48 (289) | — | 0.30 (289) |
| 1414 Las Palmas Este | 0.30 (286) | — | 0.24 (286) |
| 1421 Sta. Cruz de Tenerife | 0.12 (289) | — | 0.33 (289) |
| 1500 Tarifa | 0.69 (289) | — | 0.41 (289) |
| 1504 Algeciras-Pta. Carnero | 0.52 (289) | — | 0.26 (289) |
| 1512 Ceuta | 0.30 (285) | — | 0.22 (285) |
| 1514 Málaga | 0.12 (286) | — | 0.15 (286) |
| 1712 Tarragona | 0.12 (289) | — | 0.14 (289) |
| 1731 Barcelona II | 0.14 (285) | — | 0.18 (285) |
| 2136 Bilbao-Vizcaya | 0.27 (289) | — | 0.22 (289) |
| 2242 Cabo Peñas | 0.47 (289) | — | 0.28 (289) |
| 2244 Estaca de Bares | 0.48 (289) | — | 0.87 (289) |
| 2246 Villano-Sisargas | 0.47 (289) | — | 0.45 (289) |
| 2248 Cabo Silleiro | 0.57 (240) | — | 0.39 (240) |
| 2342 Golfo de Cádiz | 0.27 (289) | — | 0.19 (289) |
| 2442 Gran Canaria | 0.28 (289) | — | 0.36 (289) |
| 2446 Tenerife Sur | 0.46 (289) | — | 0.10 (289) |
| 2548 Cabo de Gata | 0.22 (289) | — | 0.30 (289) |
| 2610 Cabo de Palos | 0.43 (289) | — | 1.00 (289) |
| 2720 Tarragona (exterior) | 0.23 (289) | — | 0.26 (289) |
| 2798 Cabo de Begur | 0.52 (288) | — | 0.72 (288) |
| 2820 Dragonera (Mallorca) | 0.27 (289) | — | 0.30 (289) |
| 2838 Mahón (Menorca) | 0.29 (288) | — | 0.80 (288) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
