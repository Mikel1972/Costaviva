# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-05T14:56Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8720 | -0.25 | 0.35 | 0.51 |
| Copernicus IBI | 8720 | -0.26 | 0.32 | 0.45 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8720 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8725 | +0.07 | 0.89 | 1.34 |
| Copernicus IBI | 8725 | +0.14 | 0.86 | 1.20 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4990 | -1.21 | 2.26 | 2.91 |
| MET Norway | 4990 | +1.34 | 1.90 | 2.36 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4991 | +4 | 45 | 64 |
| MET Norway | 4991 | +6 | 40 | 59 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4366 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4366 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4987 | -1.03 | 1.78 | 2.66 |
| MET Norway | 4987 | -1.01 | 1.62 | 2.78 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.66 (337) | — | 0.29 (337) |
| 1103 AP Bilbao | 0.38 (337) | — | 0.26 (337) |
| 1117 Gijón | 0.23 (323) | — | 0.40 (323) |
| 1239 Langosteira (A Coruña) | 0.72 (337) | — | 0.36 (337) |
| 1414 Las Palmas Este | 0.18 (325) | — | 0.21 (325) |
| 1421 Sta. Cruz de Tenerife | 0.11 (336) | — | 0.31 (336) |
| 1500 Tarifa | 0.28 (337) | — | 0.12 (337) |
| 1504 Algeciras-Pta. Carnero | 0.14 (335) | — | 0.16 (335) |
| 1512 Ceuta | 0.12 (336) | — | 0.12 (336) |
| 1514 Málaga | 0.08 (334) | — | 0.07 (334) |
| 1712 Tarragona | 0.12 (336) | — | 0.15 (336) |
| 1731 Barcelona II | 0.18 (330) | — | 0.25 (330) |
| 2136 Bilbao-Vizcaya | 0.36 (337) | — | 0.32 (337) |
| 2242 Cabo Peñas | 0.62 (337) | — | 0.40 (337) |
| 2244 Estaca de Bares | 0.54 (337) | — | 0.84 (337) |
| 2246 Villano-Sisargas | 0.62 (337) | — | 0.62 (337) |
| 2248 Cabo Silleiro | 0.76 (337) | — | 0.67 (337) |
| 2342 Golfo de Cádiz | 0.16 (336) | — | 0.12 (336) |
| 2442 Gran Canaria | 0.34 (337) | — | 0.32 (337) |
| 2446 Tenerife Sur | 0.32 (337) | — | 0.12 (337) |
| 2548 Cabo de Gata | 0.14 (337) | — | 0.29 (337) |
| 2610 Cabo de Palos | 0.29 (337) | — | 0.26 (337) |
| 2720 Tarragona (exterior) | 0.27 (337) | — | 0.26 (337) |
| 2798 Cabo de Begur | 0.64 (337) | — | 0.62 (337) |
| 2820 Dragonera (Mallorca) | 0.34 (337) | — | 0.33 (337) |
| 2838 Mahón (Menorca) | 0.55 (337) | — | 0.38 (337) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
