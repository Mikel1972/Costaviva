# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-08T13:48Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8617 | -0.20 | 0.30 | 0.43 |
| Copernicus IBI | 8617 | -0.22 | 0.28 | 0.39 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8617 | +0.3 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8621 | +0.06 | 0.82 | 1.22 |
| Copernicus IBI | 8621 | +0.10 | 0.83 | 1.13 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4879 | -1.02 | 2.08 | 2.67 |
| MET Norway | 4879 | +1.38 | 1.88 | 2.31 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4880 | +3 | 46 | 65 |
| MET Norway | 4880 | +6 | 41 | 60 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4264 | +0.3 | 0.6 | 0.9 |
| MET Norway | 4264 | +0.4 | 0.5 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4876 | -1.10 | 1.83 | 2.74 |
| MET Norway | 4876 | -1.02 | 1.64 | 2.78 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.41 (337) | — | 0.21 (337) |
| 1103 AP Bilbao | 0.27 (337) | — | 0.18 (337) |
| 1117 Gijón | 0.17 (329) | — | 0.29 (329) |
| 1239 Langosteira (A Coruña) | 0.47 (337) | — | 0.26 (337) |
| 1414 Las Palmas Este | 0.19 (325) | — | 0.21 (325) |
| 1421 Sta. Cruz de Tenerife | 0.12 (336) | — | 0.29 (336) |
| 1500 Tarifa | 0.26 (337) | — | 0.13 (337) |
| 1504 Algeciras-Pta. Carnero | 0.15 (337) | — | 0.15 (337) |
| 1512 Ceuta | 0.14 (336) | — | 0.12 (336) |
| 1514 Málaga | 0.08 (334) | — | 0.07 (334) |
| 1712 Tarragona | 0.11 (336) | — | 0.16 (336) |
| 1731 Barcelona II | 0.23 (332) | — | 0.27 (332) |
| 2136 Bilbao-Vizcaya | 0.24 (328) | — | 0.23 (328) |
| 2242 Cabo Peñas | 0.43 (328) | — | 0.30 (328) |
| 2244 Estaca de Bares | 0.37 (329) | — | 0.63 (329) |
| 2246 Villano-Sisargas | 0.52 (326) | — | 0.54 (326) |
| 2248 Cabo Silleiro | 0.60 (328) | — | 0.55 (328) |
| 2342 Golfo de Cádiz | 0.17 (330) | — | 0.13 (330) |
| 2442 Gran Canaria | 0.27 (329) | — | 0.26 (329) |
| 2446 Tenerife Sur | 0.29 (328) | — | 0.09 (328) |
| 2548 Cabo de Gata | 0.14 (330) | — | 0.31 (330) |
| 2610 Cabo de Palos | 0.33 (329) | — | 0.29 (329) |
| 2720 Tarragona (exterior) | 0.36 (329) | — | 0.34 (329) |
| 2798 Cabo de Begur | 0.57 (331) | — | 0.53 (331) |
| 2820 Dragonera (Mallorca) | 0.42 (325) | — | 0.39 (325) |
| 2838 Mahón (Menorca) | 0.54 (334) | — | 0.37 (334) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
