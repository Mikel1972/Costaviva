# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-04T14:50Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8770 | -0.25 | 0.36 | 0.52 |
| Copernicus IBI | 8770 | -0.26 | 0.32 | 0.45 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8770 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8777 | +0.06 | 0.90 | 1.35 |
| Copernicus IBI | 8777 | +0.13 | 0.86 | 1.22 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5359 | -1.24 | 2.29 | 2.94 |
| MET Norway | 5359 | +1.27 | 1.90 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5360 | +4 | 45 | 63 |
| MET Norway | 5360 | +6 | 40 | 59 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4689 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4689 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5356 | -1.05 | 1.80 | 2.69 |
| MET Norway | 5356 | -1.04 | 1.62 | 2.80 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.72 (339) | — | 0.30 (339) |
| 1103 AP Bilbao | 0.41 (339) | — | 0.27 (339) |
| 1117 Gijón | 0.24 (323) | — | 0.43 (323) |
| 1239 Langosteira (A Coruña) | 0.77 (339) | — | 0.37 (339) |
| 1414 Las Palmas Este | 0.17 (327) | — | 0.20 (327) |
| 1421 Sta. Cruz de Tenerife | 0.12 (338) | — | 0.32 (338) |
| 1500 Tarifa | 0.29 (339) | — | 0.12 (339) |
| 1504 Algeciras-Pta. Carnero | 0.13 (337) | — | 0.16 (337) |
| 1512 Ceuta | 0.12 (337) | — | 0.13 (337) |
| 1514 Málaga | 0.08 (336) | — | 0.07 (336) |
| 1712 Tarragona | 0.13 (338) | — | 0.14 (338) |
| 1731 Barcelona II | 0.13 (332) | — | 0.20 (332) |
| 2136 Bilbao-Vizcaya | 0.39 (339) | — | 0.34 (339) |
| 2242 Cabo Peñas | 0.66 (339) | — | 0.41 (339) |
| 2244 Estaca de Bares | 0.54 (339) | — | 0.85 (339) |
| 2246 Villano-Sisargas | 0.63 (339) | — | 0.62 (339) |
| 2248 Cabo Silleiro | 0.81 (339) | — | 0.72 (339) |
| 2342 Golfo de Cádiz | 0.15 (339) | — | 0.11 (339) |
| 2442 Gran Canaria | 0.37 (339) | — | 0.36 (339) |
| 2446 Tenerife Sur | 0.31 (339) | — | 0.13 (339) |
| 2548 Cabo de Gata | 0.15 (339) | — | 0.29 (339) |
| 2610 Cabo de Palos | 0.27 (339) | — | 0.26 (339) |
| 2720 Tarragona (exterior) | 0.22 (339) | — | 0.23 (339) |
| 2798 Cabo de Begur | 0.64 (339) | — | 0.63 (339) |
| 2820 Dragonera (Mallorca) | 0.30 (339) | — | 0.29 (339) |
| 2838 Mahón (Menorca) | 0.52 (339) | — | 0.37 (339) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
