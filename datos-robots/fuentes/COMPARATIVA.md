# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-07T13:29Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8638 | -0.22 | 0.32 | 0.46 |
| Copernicus IBI | 8638 | -0.24 | 0.30 | 0.42 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8638 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8642 | +0.07 | 0.85 | 1.26 |
| Copernicus IBI | 8642 | +0.13 | 0.84 | 1.15 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4921 | -1.09 | 2.10 | 2.71 |
| MET Norway | 4921 | +1.35 | 1.87 | 2.31 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4922 | +3 | 47 | 65 |
| MET Norway | 4922 | +5 | 42 | 60 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4304 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4304 | +0.4 | 0.5 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4918 | -1.08 | 1.82 | 2.71 |
| MET Norway | 4918 | -1.02 | 1.63 | 2.77 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.48 (335) | — | 0.24 (335) |
| 1103 AP Bilbao | 0.31 (335) | — | 0.21 (335) |
| 1117 Gijón | 0.20 (324) | — | 0.35 (324) |
| 1239 Langosteira (A Coruña) | 0.56 (335) | — | 0.31 (335) |
| 1414 Las Palmas Este | 0.18 (323) | — | 0.21 (323) |
| 1421 Sta. Cruz de Tenerife | 0.11 (336) | — | 0.30 (336) |
| 1500 Tarifa | 0.26 (335) | — | 0.12 (335) |
| 1504 Algeciras-Pta. Carnero | 0.14 (335) | — | 0.15 (335) |
| 1512 Ceuta | 0.12 (334) | — | 0.11 (334) |
| 1514 Málaga | 0.08 (333) | — | 0.07 (333) |
| 1712 Tarragona | 0.11 (334) | — | 0.16 (334) |
| 1731 Barcelona II | 0.23 (329) | — | 0.28 (329) |
| 2136 Bilbao-Vizcaya | 0.27 (332) | — | 0.26 (332) |
| 2242 Cabo Peñas | 0.51 (332) | — | 0.35 (332) |
| 2244 Estaca de Bares | 0.44 (332) | — | 0.71 (332) |
| 2246 Villano-Sisargas | 0.56 (330) | — | 0.57 (330) |
| 2248 Cabo Silleiro | 0.65 (331) | — | 0.59 (331) |
| 2342 Golfo de Cádiz | 0.15 (334) | — | 0.11 (334) |
| 2442 Gran Canaria | 0.29 (332) | — | 0.29 (332) |
| 2446 Tenerife Sur | 0.30 (331) | — | 0.10 (331) |
| 2548 Cabo de Gata | 0.13 (333) | — | 0.29 (333) |
| 2610 Cabo de Palos | 0.33 (329) | — | 0.29 (329) |
| 2720 Tarragona (exterior) | 0.36 (332) | — | 0.34 (332) |
| 2798 Cabo de Begur | 0.58 (333) | — | 0.54 (333) |
| 2820 Dragonera (Mallorca) | 0.41 (334) | — | 0.38 (334) |
| 2838 Mahón (Menorca) | 0.57 (335) | — | 0.38 (335) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
