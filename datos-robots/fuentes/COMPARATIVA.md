# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-10T15:12Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8597 | -0.15 | 0.29 | 0.40 |
| Copernicus IBI | 8597 | -0.20 | 0.27 | 0.38 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8597 | +0.4 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8601 | +0.05 | 0.79 | 1.16 |
| Copernicus IBI | 8601 | +0.07 | 0.84 | 1.14 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4879 | -0.96 | 2.12 | 2.70 |
| MET Norway | 4879 | +1.48 | 1.97 | 2.42 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4880 | +4 | 43 | 61 |
| MET Norway | 4880 | +6 | 38 | 56 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4266 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4266 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4876 | -1.10 | 1.78 | 2.81 |
| MET Norway | 4876 | -1.09 | 1.65 | 2.89 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.29 (335) | — | 0.16 (335) |
| 1103 AP Bilbao | 0.20 (335) | — | 0.15 (335) |
| 1117 Gijón | 0.14 (327) | — | 0.23 (327) |
| 1239 Langosteira (A Coruña) | 0.37 (335) | — | 0.26 (335) |
| 1414 Las Palmas Este | 0.22 (323) | — | 0.22 (323) |
| 1421 Sta. Cruz de Tenerife | 0.12 (334) | — | 0.29 (334) |
| 1500 Tarifa | 0.33 (335) | — | 0.18 (335) |
| 1504 Algeciras-Pta. Carnero | 0.21 (335) | — | 0.16 (335) |
| 1512 Ceuta | 0.17 (334) | — | 0.13 (334) |
| 1514 Málaga | 0.09 (332) | — | 0.08 (332) |
| 1712 Tarragona | 0.11 (334) | — | 0.16 (334) |
| 1731 Barcelona II | 0.22 (330) | — | 0.25 (330) |
| 2136 Bilbao-Vizcaya | 0.18 (328) | — | 0.19 (328) |
| 2242 Cabo Peñas | 0.34 (328) | — | 0.25 (328) |
| 2244 Estaca de Bares | 0.33 (329) | — | 0.61 (329) |
| 2246 Villano-Sisargas | 0.47 (326) | — | 0.50 (326) |
| 2248 Cabo Silleiro | 0.56 (328) | — | 0.50 (328) |
| 2342 Golfo de Cádiz | 0.19 (330) | — | 0.14 (330) |
| 2442 Gran Canaria | 0.23 (329) | — | 0.23 (329) |
| 2446 Tenerife Sur | 0.35 (328) | — | 0.08 (328) |
| 2548 Cabo de Gata | 0.17 (330) | — | 0.36 (330) |
| 2610 Cabo de Palos | 0.35 (329) | — | 0.33 (329) |
| 2720 Tarragona (exterior) | 0.36 (329) | — | 0.34 (329) |
| 2798 Cabo de Begur | 0.56 (330) | — | 0.52 (330) |
| 2820 Dragonera (Mallorca) | 0.42 (331) | — | 0.40 (331) |
| 2838 Mahón (Menorca) | 0.54 (333) | — | 0.37 (333) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
