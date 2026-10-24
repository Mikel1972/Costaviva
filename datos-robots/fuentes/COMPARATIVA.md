# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-24T11:32Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8711 | -0.23 | 0.32 | 0.47 |
| Copernicus IBI | 8711 | -0.27 | 0.31 | 0.44 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8711 | +0.3 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8719 | -0.06 | 1.00 | 1.48 |
| Copernicus IBI | 8719 | -0.15 | 0.96 | 1.41 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4988 | -1.44 | 2.47 | 3.17 |
| MET Norway | 4988 | +1.03 | 1.88 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4988 | +4 | 40 | 58 |
| MET Norway | 4988 | +5 | 36 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4363 | +0.3 | 0.6 | 0.8 |
| MET Norway | 4363 | +0.4 | 0.5 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4986 | -1.05 | 1.90 | 2.97 |
| MET Norway | 4986 | -1.20 | 1.73 | 3.06 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.64 (335) | — | 0.24 (335) |
| 1103 AP Bilbao | 0.39 (337) | — | 0.23 (337) |
| 1117 Gijón | 0.20 (316) | — | 0.39 (316) |
| 1239 Langosteira (A Coruña) | 0.68 (337) | — | 0.26 (337) |
| 1414 Las Palmas Este | 0.11 (336) | — | 0.12 (336) |
| 1421 Sta. Cruz de Tenerife | 0.16 (337) | — | 0.30 (337) |
| 1500 Tarifa | 0.25 (333) | — | 0.11 (333) |
| 1504 Algeciras-Pta. Carnero | 0.10 (331) | — | 0.20 (331) |
| 1512 Ceuta | 0.12 (334) | — | 0.15 (334) |
| 1514 Málaga | 0.09 (330) | — | 0.11 (330) |
| 1712 Tarragona | 0.14 (334) | — | 0.13 (334) |
| 1731 Barcelona II | 0.18 (333) | — | 0.24 (333) |
| 2136 Bilbao-Vizcaya | 0.32 (337) | — | 0.28 (337) |
| 2242 Cabo Peñas | 0.55 (337) | — | 0.35 (337) |
| 2244 Estaca de Bares | 0.43 (337) | — | 0.69 (337) |
| 2246 Villano-Sisargas | 0.47 (337) | — | 0.47 (337) |
| 2248 Cabo Silleiro | 0.68 (337) | — | 0.64 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.11 (337) |
| 2442 Gran Canaria | 0.42 (337) | — | 0.50 (337) |
| 2446 Tenerife Sur | 0.20 (337) | — | 0.19 (337) |
| 2548 Cabo de Gata | 0.25 (337) | — | 0.46 (337) |
| 2610 Cabo de Palos | 0.29 (337) | — | 0.36 (337) |
| 2720 Tarragona (exterior) | 0.19 (337) | — | 0.21 (337) |
| 2798 Cabo de Begur | 0.59 (337) | — | 0.62 (337) |
| 2820 Dragonera (Mallorca) | 0.31 (337) | — | 0.33 (337) |
| 2838 Mahón (Menorca) | 0.50 (337) | — | 0.36 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
