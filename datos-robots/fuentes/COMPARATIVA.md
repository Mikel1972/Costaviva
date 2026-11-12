# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-12T15:33Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8622 | -0.12 | 0.29 | 0.40 |
| Copernicus IBI | 8622 | -0.18 | 0.27 | 0.38 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8622 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8622 | +0.04 | 0.78 | 1.12 |
| Copernicus IBI | 8622 | +0.05 | 0.83 | 1.14 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4883 | -0.92 | 2.17 | 2.75 |
| MET Norway | 4883 | +1.53 | 2.06 | 2.53 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4884 | +7 | 40 | 59 |
| MET Norway | 4884 | +8 | 36 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4268 | +0.4 | 0.7 | 1.0 |
| MET Norway | 4268 | +0.5 | 0.6 | 0.9 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4880 | -1.10 | 1.75 | 2.83 |
| MET Norway | 4880 | -1.11 | 1.64 | 2.94 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.25 (336) | — | 0.14 (336) |
| 1103 AP Bilbao | 0.17 (337) | — | 0.15 (337) |
| 1117 Gijón | 0.13 (329) | — | 0.20 (329) |
| 1239 Langosteira (A Coruña) | 0.31 (337) | — | 0.24 (337) |
| 1414 Las Palmas Este | 0.27 (329) | — | 0.24 (329) |
| 1421 Sta. Cruz de Tenerife | 0.15 (336) | — | 0.31 (336) |
| 1500 Tarifa | 0.42 (337) | — | 0.27 (337) |
| 1504 Algeciras-Pta. Carnero | 0.31 (337) | — | 0.17 (337) |
| 1512 Ceuta | 0.22 (335) | — | 0.14 (335) |
| 1514 Málaga | 0.09 (333) | — | 0.08 (333) |
| 1712 Tarragona | 0.11 (335) | — | 0.16 (335) |
| 1731 Barcelona II | 0.21 (333) | — | 0.24 (333) |
| 2136 Bilbao-Vizcaya | 0.16 (328) | — | 0.17 (328) |
| 2242 Cabo Peñas | 0.31 (328) | — | 0.21 (328) |
| 2244 Estaca de Bares | 0.31 (329) | — | 0.58 (329) |
| 2246 Villano-Sisargas | 0.41 (326) | — | 0.42 (326) |
| 2248 Cabo Silleiro | 0.48 (328) | — | 0.41 (328) |
| 2342 Golfo de Cádiz | 0.22 (330) | — | 0.18 (330) |
| 2442 Gran Canaria | 0.25 (329) | — | 0.29 (329) |
| 2446 Tenerife Sur | 0.36 (328) | — | 0.08 (328) |
| 2548 Cabo de Gata | 0.17 (330) | — | 0.35 (330) |
| 2610 Cabo de Palos | 0.37 (329) | — | 0.44 (329) |
| 2720 Tarragona (exterior) | 0.36 (329) | — | 0.35 (329) |
| 2798 Cabo de Begur | 0.52 (330) | — | 0.51 (330) |
| 2820 Dragonera (Mallorca) | 0.42 (331) | — | 0.41 (331) |
| 2838 Mahón (Menorca) | 0.49 (333) | — | 0.42 (333) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
