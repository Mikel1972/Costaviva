# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-23T12:01Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8701 | -0.22 | 0.31 | 0.44 |
| Copernicus IBI | 8701 | -0.25 | 0.30 | 0.42 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8701 | +0.3 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8708 | -0.06 | 0.99 | 1.46 |
| Copernicus IBI | 8708 | -0.16 | 0.96 | 1.41 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4974 | -1.39 | 2.42 | 3.12 |
| MET Norway | 4974 | +1.06 | 1.88 | 2.31 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4974 | +5 | 40 | 58 |
| MET Norway | 4974 | +5 | 36 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4351 | +0.3 | 0.6 | 0.8 |
| MET Norway | 4351 | +0.4 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4972 | -1.02 | 1.89 | 2.99 |
| MET Norway | 4972 | -1.19 | 1.73 | 3.09 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.54 (336) | — | 0.21 (336) |
| 1103 AP Bilbao | 0.37 (336) | — | 0.21 (336) |
| 1117 Gijón | 0.19 (321) | — | 0.37 (321) |
| 1239 Langosteira (A Coruña) | 0.61 (336) | — | 0.24 (336) |
| 1414 Las Palmas Este | 0.11 (335) | — | 0.13 (335) |
| 1421 Sta. Cruz de Tenerife | 0.17 (336) | — | 0.28 (336) |
| 1500 Tarifa | 0.24 (332) | — | 0.12 (332) |
| 1504 Algeciras-Pta. Carnero | 0.11 (332) | — | 0.19 (332) |
| 1512 Ceuta | 0.12 (333) | — | 0.15 (333) |
| 1514 Málaga | 0.09 (331) | — | 0.11 (331) |
| 1712 Tarragona | 0.14 (335) | — | 0.14 (335) |
| 1731 Barcelona II | 0.18 (334) | — | 0.24 (334) |
| 2136 Bilbao-Vizcaya | 0.26 (336) | — | 0.25 (336) |
| 2242 Cabo Peñas | 0.49 (336) | — | 0.32 (336) |
| 2244 Estaca de Bares | 0.39 (336) | — | 0.63 (336) |
| 2246 Villano-Sisargas | 0.42 (336) | — | 0.43 (336) |
| 2248 Cabo Silleiro | 0.62 (336) | — | 0.59 (336) |
| 2342 Golfo de Cádiz | 0.15 (336) | — | 0.10 (336) |
| 2442 Gran Canaria | 0.41 (336) | — | 0.50 (336) |
| 2446 Tenerife Sur | 0.20 (336) | — | 0.18 (336) |
| 2548 Cabo de Gata | 0.26 (336) | — | 0.49 (336) |
| 2610 Cabo de Palos | 0.31 (336) | — | 0.35 (336) |
| 2720 Tarragona (exterior) | 0.18 (336) | — | 0.20 (336) |
| 2798 Cabo de Begur | 0.57 (336) | — | 0.59 (336) |
| 2820 Dragonera (Mallorca) | 0.30 (336) | — | 0.31 (336) |
| 2838 Mahón (Menorca) | 0.51 (336) | — | 0.34 (336) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
