# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-26T13:30Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8713 | -0.26 | 0.35 | 0.52 |
| Copernicus IBI | 8713 | -0.29 | 0.34 | 0.47 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8713 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8722 | -0.07 | 1.00 | 1.49 |
| Copernicus IBI | 8722 | -0.13 | 0.96 | 1.41 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5003 | -1.49 | 2.53 | 3.24 |
| MET Norway | 5003 | +1.04 | 1.91 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5003 | +5 | 39 | 57 |
| MET Norway | 5003 | +6 | 36 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4378 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4378 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5001 | -1.00 | 1.87 | 2.87 |
| MET Norway | 5001 | -1.14 | 1.69 | 2.97 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.78 (336) | — | 0.30 (336) |
| 1103 AP Bilbao | 0.43 (337) | — | 0.25 (337) |
| 1117 Gijón | 0.22 (314) | — | 0.44 (314) |
| 1239 Langosteira (A Coruña) | 0.76 (336) | — | 0.30 (336) |
| 1414 Las Palmas Este | 0.12 (335) | — | 0.12 (335) |
| 1421 Sta. Cruz de Tenerife | 0.15 (337) | — | 0.35 (337) |
| 1500 Tarifa | 0.26 (333) | — | 0.11 (333) |
| 1504 Algeciras-Pta. Carnero | 0.10 (333) | — | 0.21 (333) |
| 1512 Ceuta | 0.11 (334) | — | 0.16 (334) |
| 1514 Málaga | 0.09 (332) | — | 0.11 (332) |
| 1712 Tarragona | 0.13 (335) | — | 0.12 (335) |
| 1731 Barcelona II | 0.17 (333) | — | 0.23 (333) |
| 2136 Bilbao-Vizcaya | 0.39 (337) | — | 0.34 (337) |
| 2242 Cabo Peñas | 0.66 (337) | — | 0.40 (337) |
| 2244 Estaca de Bares | 0.50 (337) | — | 0.80 (337) |
| 2246 Villano-Sisargas | 0.51 (337) | — | 0.50 (337) |
| 2248 Cabo Silleiro | 0.76 (337) | — | 0.71 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.11 (337) |
| 2442 Gran Canaria | 0.48 (337) | — | 0.55 (337) |
| 2446 Tenerife Sur | 0.23 (337) | — | 0.20 (337) |
| 2548 Cabo de Gata | 0.26 (337) | — | 0.46 (337) |
| 2610 Cabo de Palos | 0.32 (337) | — | 0.40 (337) |
| 2720 Tarragona (exterior) | 0.18 (337) | — | 0.20 (337) |
| 2798 Cabo de Begur | 0.60 (337) | — | 0.63 (337) |
| 2820 Dragonera (Mallorca) | 0.31 (337) | — | 0.33 (337) |
| 2838 Mahón (Menorca) | 0.50 (337) | — | 0.38 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
