# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-06T14:34Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8721 | -0.24 | 0.35 | 0.50 |
| Copernicus IBI | 8721 | -0.26 | 0.31 | 0.45 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8721 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8725 | +0.08 | 0.87 | 1.30 |
| Copernicus IBI | 8725 | +0.14 | 0.84 | 1.17 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4991 | -1.16 | 2.16 | 2.82 |
| MET Norway | 4991 | +1.31 | 1.87 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4992 | +3 | 46 | 65 |
| MET Norway | 4992 | +5 | 41 | 60 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4367 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4367 | +0.4 | 0.5 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4988 | -1.09 | 1.84 | 2.73 |
| MET Norway | 4988 | -1.03 | 1.64 | 2.79 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.60 (336) | — | 0.27 (336) |
| 1103 AP Bilbao | 0.34 (337) | — | 0.23 (337) |
| 1117 Gijón | 0.22 (323) | — | 0.38 (323) |
| 1239 Langosteira (A Coruña) | 0.64 (337) | — | 0.34 (337) |
| 1414 Las Palmas Este | 0.18 (325) | — | 0.21 (325) |
| 1421 Sta. Cruz de Tenerife | 0.11 (336) | — | 0.31 (336) |
| 1500 Tarifa | 0.27 (337) | — | 0.12 (337) |
| 1504 Algeciras-Pta. Carnero | 0.13 (335) | — | 0.17 (335) |
| 1512 Ceuta | 0.12 (336) | — | 0.12 (336) |
| 1514 Málaga | 0.08 (335) | — | 0.07 (335) |
| 1712 Tarragona | 0.12 (335) | — | 0.16 (335) |
| 1731 Barcelona II | 0.23 (331) | — | 0.29 (331) |
| 2136 Bilbao-Vizcaya | 0.32 (337) | — | 0.29 (337) |
| 2242 Cabo Peñas | 0.57 (337) | — | 0.38 (337) |
| 2244 Estaca de Bares | 0.48 (337) | — | 0.77 (337) |
| 2246 Villano-Sisargas | 0.59 (337) | — | 0.59 (337) |
| 2248 Cabo Silleiro | 0.69 (337) | — | 0.62 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.32 (337) | — | 0.31 (337) |
| 2446 Tenerife Sur | 0.31 (337) | — | 0.11 (337) |
| 2548 Cabo de Gata | 0.13 (337) | — | 0.29 (337) |
| 2610 Cabo de Palos | 0.31 (337) | — | 0.28 (337) |
| 2720 Tarragona (exterior) | 0.35 (337) | — | 0.34 (337) |
| 2798 Cabo de Begur | 0.68 (337) | — | 0.64 (337) |
| 2820 Dragonera (Mallorca) | 0.40 (337) | — | 0.37 (337) |
| 2838 Mahón (Menorca) | 0.60 (337) | — | 0.40 (337) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
