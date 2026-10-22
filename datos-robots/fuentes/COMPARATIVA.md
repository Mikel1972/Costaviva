# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-22T12:19Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8715 | -0.22 | 0.30 | 0.44 |
| Copernicus IBI | 8715 | -0.26 | 0.30 | 0.43 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8715 | +0.2 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8720 | -0.03 | 1.00 | 1.46 |
| Copernicus IBI | 8720 | -0.15 | 0.95 | 1.41 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4988 | -1.40 | 2.43 | 3.14 |
| MET Norway | 4988 | +1.05 | 1.89 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4988 | +4 | 40 | 58 |
| MET Norway | 4988 | +5 | 37 | 55 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4364 | +0.3 | 0.6 | 0.8 |
| MET Norway | 4364 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4986 | -0.99 | 1.91 | 3.01 |
| MET Norway | 4986 | -1.15 | 1.73 | 3.08 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.50 (336) | — | 0.20 (336) |
| 1103 AP Bilbao | 0.35 (336) | — | 0.20 (336) |
| 1117 Gijón | 0.17 (322) | — | 0.36 (322) |
| 1239 Langosteira (A Coruña) | 0.55 (336) | — | 0.23 (336) |
| 1414 Las Palmas Este | 0.11 (335) | — | 0.12 (335) |
| 1421 Sta. Cruz de Tenerife | 0.18 (336) | — | 0.27 (336) |
| 1500 Tarifa | 0.23 (331) | — | 0.13 (331) |
| 1504 Algeciras-Pta. Carnero | 0.11 (332) | — | 0.19 (332) |
| 1512 Ceuta | 0.13 (333) | — | 0.14 (333) |
| 1514 Málaga | 0.10 (332) | — | 0.11 (332) |
| 1712 Tarragona | 0.16 (334) | — | 0.14 (334) |
| 1731 Barcelona II | 0.18 (334) | — | 0.25 (334) |
| 2136 Bilbao-Vizcaya | 0.24 (337) | — | 0.24 (337) |
| 2242 Cabo Peñas | 0.44 (337) | — | 0.31 (337) |
| 2244 Estaca de Bares | 0.35 (337) | — | 0.58 (337) |
| 2246 Villano-Sisargas | 0.40 (337) | — | 0.41 (337) |
| 2248 Cabo Silleiro | 0.61 (337) | — | 0.60 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.39 (337) | — | 0.50 (337) |
| 2446 Tenerife Sur | 0.19 (337) | — | 0.18 (337) |
| 2548 Cabo de Gata | 0.26 (337) | — | 0.49 (337) |
| 2610 Cabo de Palos | 0.32 (337) | — | 0.37 (337) |
| 2720 Tarragona (exterior) | 0.18 (337) | — | 0.21 (337) |
| 2798 Cabo de Begur | 0.67 (337) | — | 0.70 (337) |
| 2820 Dragonera (Mallorca) | 0.33 (337) | — | 0.34 (337) |
| 2838 Mahón (Menorca) | 0.59 (337) | — | 0.37 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
