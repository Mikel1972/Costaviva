# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-30T13:28Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8709 | -0.27 | 0.37 | 0.54 |
| Copernicus IBI | 8709 | -0.30 | 0.34 | 0.49 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8709 | +0.3 | 1.6 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8721 | -0.05 | 0.96 | 1.46 |
| Copernicus IBI | 8721 | +0.00 | 0.93 | 1.35 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5388 | -1.46 | 2.48 | 3.20 |
| MET Norway | 5388 | +1.08 | 1.88 | 2.34 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5388 | +1 | 43 | 61 |
| MET Norway | 5388 | +5 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4715 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4715 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5386 | -1.03 | 1.83 | 2.75 |
| MET Norway | 5386 | -1.06 | 1.64 | 2.83 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.77 (336) | — | 0.31 (336) |
| 1103 AP Bilbao | 0.42 (336) | — | 0.26 (336) |
| 1117 Gijón | 0.24 (318) | — | 0.46 (318) |
| 1239 Langosteira (A Coruña) | 0.81 (336) | — | 0.35 (336) |
| 1414 Las Palmas Este | 0.15 (327) | — | 0.17 (327) |
| 1421 Sta. Cruz de Tenerife | 0.14 (337) | — | 0.33 (337) |
| 1500 Tarifa | 0.29 (335) | — | 0.11 (335) |
| 1504 Algeciras-Pta. Carnero | 0.12 (334) | — | 0.21 (334) |
| 1512 Ceuta | 0.11 (332) | — | 0.15 (332) |
| 1514 Málaga | 0.08 (333) | — | 0.09 (333) |
| 1712 Tarragona | 0.13 (334) | — | 0.13 (334) |
| 1731 Barcelona II | 0.17 (333) | — | 0.25 (333) |
| 2136 Bilbao-Vizcaya | 0.39 (337) | — | 0.35 (337) |
| 2242 Cabo Peñas | 0.66 (337) | — | 0.39 (337) |
| 2244 Estaca de Bares | 0.55 (337) | — | 0.87 (337) |
| 2246 Villano-Sisargas | 0.59 (337) | — | 0.59 (337) |
| 2248 Cabo Silleiro | 0.88 (337) | — | 0.80 (337) |
| 2342 Golfo de Cádiz | 0.16 (337) | — | 0.11 (337) |
| 2442 Gran Canaria | 0.43 (337) | — | 0.45 (337) |
| 2446 Tenerife Sur | 0.29 (337) | — | 0.15 (337) |
| 2548 Cabo de Gata | 0.23 (337) | — | 0.36 (337) |
| 2610 Cabo de Palos | 0.32 (337) | — | 0.39 (337) |
| 2720 Tarragona (exterior) | 0.20 (337) | — | 0.22 (337) |
| 2798 Cabo de Begur | 0.67 (337) | — | 0.70 (337) |
| 2820 Dragonera (Mallorca) | 0.33 (337) | — | 0.34 (337) |
| 2838 Mahón (Menorca) | 0.53 (337) | — | 0.40 (337) |

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
