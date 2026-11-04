# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-04T12:30Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8680 | -0.25 | 0.36 | 0.52 |
| Copernicus IBI | 8680 | -0.26 | 0.32 | 0.45 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8680 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8687 | +0.06 | 0.90 | 1.35 |
| Copernicus IBI | 8687 | +0.14 | 0.85 | 1.21 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5342 | -1.24 | 2.29 | 2.94 |
| MET Norway | 5342 | +1.27 | 1.90 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5343 | +4 | 45 | 63 |
| MET Norway | 5343 | +6 | 40 | 59 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4675 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4675 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5339 | -1.06 | 1.80 | 2.69 |
| MET Norway | 5339 | -1.04 | 1.62 | 2.81 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.73 (334) | — | 0.30 (334) |
| 1103 AP Bilbao | 0.41 (336) | — | 0.27 (336) |
| 1117 Gijón | 0.24 (318) | — | 0.43 (318) |
| 1239 Langosteira (A Coruña) | 0.78 (334) | — | 0.38 (334) |
| 1414 Las Palmas Este | 0.17 (324) | — | 0.20 (324) |
| 1421 Sta. Cruz de Tenerife | 0.12 (335) | — | 0.32 (335) |
| 1500 Tarifa | 0.29 (336) | — | 0.12 (336) |
| 1504 Algeciras-Pta. Carnero | 0.13 (334) | — | 0.16 (334) |
| 1512 Ceuta | 0.12 (334) | — | 0.13 (334) |
| 1514 Málaga | 0.08 (331) | — | 0.07 (331) |
| 1712 Tarragona | 0.13 (333) | — | 0.14 (333) |
| 1731 Barcelona II | 0.13 (327) | — | 0.21 (327) |
| 2136 Bilbao-Vizcaya | 0.39 (336) | — | 0.34 (336) |
| 2242 Cabo Peñas | 0.67 (336) | — | 0.42 (336) |
| 2244 Estaca de Bares | 0.54 (336) | — | 0.85 (336) |
| 2246 Villano-Sisargas | 0.63 (336) | — | 0.62 (336) |
| 2248 Cabo Silleiro | 0.81 (336) | — | 0.72 (336) |
| 2342 Golfo de Cádiz | 0.15 (336) | — | 0.11 (336) |
| 2442 Gran Canaria | 0.37 (336) | — | 0.36 (336) |
| 2446 Tenerife Sur | 0.31 (336) | — | 0.13 (336) |
| 2548 Cabo de Gata | 0.14 (336) | — | 0.29 (336) |
| 2610 Cabo de Palos | 0.27 (336) | — | 0.26 (336) |
| 2720 Tarragona (exterior) | 0.22 (336) | — | 0.23 (336) |
| 2798 Cabo de Begur | 0.63 (336) | — | 0.63 (336) |
| 2820 Dragonera (Mallorca) | 0.30 (336) | — | 0.29 (336) |
| 2838 Mahón (Menorca) | 0.53 (336) | — | 0.37 (336) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
