# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-02T16:29Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8705 | -0.24 | 0.35 | 0.52 |
| Copernicus IBI | 8705 | -0.26 | 0.32 | 0.45 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8705 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8716 | -0.00 | 0.92 | 1.39 |
| Copernicus IBI | 8716 | +0.09 | 0.87 | 1.25 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5374 | -1.30 | 2.31 | 2.98 |
| MET Norway | 5374 | +1.18 | 1.87 | 2.33 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5374 | +3 | 44 | 63 |
| MET Norway | 5374 | +6 | 40 | 58 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4702 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4702 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5369 | -1.06 | 1.81 | 2.73 |
| MET Norway | 5369 | -1.05 | 1.65 | 2.85 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.73 (336) | — | 0.29 (336) |
| 1103 AP Bilbao | 0.40 (336) | — | 0.25 (336) |
| 1117 Gijón | 0.22 (320) | — | 0.40 (320) |
| 1239 Langosteira (A Coruña) | 0.80 (336) | — | 0.37 (336) |
| 1414 Las Palmas Este | 0.16 (324) | — | 0.19 (324) |
| 1421 Sta. Cruz de Tenerife | 0.12 (336) | — | 0.34 (336) |
| 1500 Tarifa | 0.31 (335) | — | 0.13 (335) |
| 1504 Algeciras-Pta. Carnero | 0.14 (334) | — | 0.18 (334) |
| 1512 Ceuta | 0.13 (333) | — | 0.14 (333) |
| 1514 Málaga | 0.08 (331) | — | 0.08 (331) |
| 1712 Tarragona | 0.12 (335) | — | 0.13 (335) |
| 1731 Barcelona II | 0.16 (331) | — | 0.24 (331) |
| 2136 Bilbao-Vizcaya | 0.37 (337) | — | 0.32 (337) |
| 2242 Cabo Peñas | 0.63 (337) | — | 0.39 (337) |
| 2244 Estaca de Bares | 0.52 (337) | — | 0.78 (337) |
| 2246 Villano-Sisargas | 0.54 (337) | — | 0.55 (337) |
| 2248 Cabo Silleiro | 0.78 (337) | — | 0.70 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.41 (337) | — | 0.40 (337) |
| 2446 Tenerife Sur | 0.32 (337) | — | 0.13 (337) |
| 2548 Cabo de Gata | 0.20 (337) | — | 0.33 (337) |
| 2610 Cabo de Palos | 0.28 (337) | — | 0.33 (337) |
| 2720 Tarragona (exterior) | 0.21 (337) | — | 0.23 (337) |
| 2798 Cabo de Begur | 0.63 (337) | — | 0.65 (337) |
| 2820 Dragonera (Mallorca) | 0.27 (337) | — | 0.27 (337) |
| 2838 Mahón (Menorca) | 0.52 (337) | — | 0.40 (337) |

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
