# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-09T16:49Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8622 | -0.17 | 0.29 | 0.41 |
| Copernicus IBI | 8622 | -0.20 | 0.27 | 0.38 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8622 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8626 | +0.05 | 0.80 | 1.18 |
| Copernicus IBI | 8626 | +0.08 | 0.84 | 1.13 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4884 | -0.96 | 2.08 | 2.65 |
| MET Norway | 4884 | +1.44 | 1.92 | 2.37 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4885 | +3 | 45 | 64 |
| MET Norway | 4885 | +6 | 40 | 59 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4269 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4269 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4881 | -1.10 | 1.79 | 2.76 |
| MET Norway | 4881 | -1.05 | 1.64 | 2.84 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.32 (337) | — | 0.17 (337) |
| 1103 AP Bilbao | 0.23 (337) | — | 0.16 (337) |
| 1117 Gijón | 0.16 (329) | — | 0.26 (329) |
| 1239 Langosteira (A Coruña) | 0.42 (337) | — | 0.25 (337) |
| 1414 Las Palmas Este | 0.20 (325) | — | 0.22 (325) |
| 1421 Sta. Cruz de Tenerife | 0.11 (336) | — | 0.28 (336) |
| 1500 Tarifa | 0.27 (337) | — | 0.14 (337) |
| 1504 Algeciras-Pta. Carnero | 0.15 (337) | — | 0.15 (337) |
| 1512 Ceuta | 0.14 (336) | — | 0.12 (336) |
| 1514 Málaga | 0.09 (334) | — | 0.08 (334) |
| 1712 Tarragona | 0.11 (336) | — | 0.16 (336) |
| 1731 Barcelona II | 0.22 (332) | — | 0.26 (332) |
| 2136 Bilbao-Vizcaya | 0.19 (328) | — | 0.19 (328) |
| 2242 Cabo Peñas | 0.36 (328) | — | 0.26 (328) |
| 2244 Estaca de Bares | 0.35 (329) | — | 0.61 (329) |
| 2246 Villano-Sisargas | 0.51 (326) | — | 0.53 (326) |
| 2248 Cabo Silleiro | 0.58 (328) | — | 0.54 (328) |
| 2342 Golfo de Cádiz | 0.18 (330) | — | 0.14 (330) |
| 2442 Gran Canaria | 0.22 (329) | — | 0.23 (329) |
| 2446 Tenerife Sur | 0.33 (328) | — | 0.08 (328) |
| 2548 Cabo de Gata | 0.16 (330) | — | 0.35 (330) |
| 2610 Cabo de Palos | 0.32 (329) | — | 0.27 (329) |
| 2720 Tarragona (exterior) | 0.35 (329) | — | 0.33 (329) |
| 2798 Cabo de Begur | 0.54 (330) | — | 0.50 (330) |
| 2820 Dragonera (Mallorca) | 0.41 (331) | — | 0.39 (331) |
| 2838 Mahón (Menorca) | 0.54 (334) | — | 0.35 (334) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
