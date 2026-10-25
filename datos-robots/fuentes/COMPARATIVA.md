# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-25T11:57Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8720 | -0.25 | 0.34 | 0.50 |
| Copernicus IBI | 8720 | -0.28 | 0.32 | 0.46 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8720 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8728 | -0.07 | 1.00 | 1.49 |
| Copernicus IBI | 8728 | -0.14 | 0.96 | 1.41 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5004 | -1.48 | 2.49 | 3.20 |
| MET Norway | 5004 | +1.03 | 1.89 | 2.33 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5004 | +5 | 39 | 57 |
| MET Norway | 5004 | +5 | 36 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4378 | +0.4 | 0.6 | 0.8 |
| MET Norway | 4378 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5002 | -1.01 | 1.87 | 2.90 |
| MET Norway | 5002 | -1.18 | 1.71 | 3.03 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.70 (337) | — | 0.26 (337) |
| 1103 AP Bilbao | 0.41 (337) | — | 0.24 (337) |
| 1117 Gijón | 0.22 (315) | — | 0.44 (315) |
| 1239 Langosteira (A Coruña) | 0.74 (337) | — | 0.30 (337) |
| 1414 Las Palmas Este | 0.11 (336) | — | 0.12 (336) |
| 1421 Sta. Cruz de Tenerife | 0.16 (337) | — | 0.33 (337) |
| 1500 Tarifa | 0.25 (334) | — | 0.11 (334) |
| 1504 Algeciras-Pta. Carnero | 0.10 (333) | — | 0.20 (333) |
| 1512 Ceuta | 0.11 (334) | — | 0.15 (334) |
| 1514 Málaga | 0.09 (332) | — | 0.11 (332) |
| 1712 Tarragona | 0.14 (336) | — | 0.12 (336) |
| 1731 Barcelona II | 0.17 (334) | — | 0.23 (334) |
| 2136 Bilbao-Vizcaya | 0.36 (337) | — | 0.31 (337) |
| 2242 Cabo Peñas | 0.62 (337) | — | 0.39 (337) |
| 2244 Estaca de Bares | 0.49 (337) | — | 0.78 (337) |
| 2246 Villano-Sisargas | 0.51 (337) | — | 0.49 (337) |
| 2248 Cabo Silleiro | 0.73 (337) | — | 0.69 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.44 (337) | — | 0.52 (337) |
| 2446 Tenerife Sur | 0.22 (337) | — | 0.20 (337) |
| 2548 Cabo de Gata | 0.25 (337) | — | 0.45 (337) |
| 2610 Cabo de Palos | 0.30 (337) | — | 0.37 (337) |
| 2720 Tarragona (exterior) | 0.18 (337) | — | 0.21 (337) |
| 2798 Cabo de Begur | 0.58 (337) | — | 0.61 (337) |
| 2820 Dragonera (Mallorca) | 0.31 (337) | — | 0.33 (337) |
| 2838 Mahón (Menorca) | 0.50 (337) | — | 0.36 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
