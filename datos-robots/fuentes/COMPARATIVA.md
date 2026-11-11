# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-11T14:40Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8625 | -0.14 | 0.29 | 0.40 |
| Copernicus IBI | 8625 | -0.19 | 0.28 | 0.39 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8625 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8625 | +0.05 | 0.78 | 1.14 |
| Copernicus IBI | 8625 | +0.07 | 0.84 | 1.14 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4883 | -0.95 | 2.13 | 2.69 |
| MET Norway | 4883 | +1.51 | 2.00 | 2.44 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4884 | +6 | 41 | 60 |
| MET Norway | 4884 | +8 | 37 | 54 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4268 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4268 | +0.4 | 0.6 | 0.9 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4880 | -1.12 | 1.77 | 2.85 |
| MET Norway | 4880 | -1.12 | 1.64 | 2.93 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.26 (337) | — | 0.15 (337) |
| 1103 AP Bilbao | 0.17 (337) | — | 0.15 (337) |
| 1117 Gijón | 0.14 (328) | — | 0.21 (328) |
| 1239 Langosteira (A Coruña) | 0.35 (337) | — | 0.26 (337) |
| 1414 Las Palmas Este | 0.25 (330) | — | 0.23 (330) |
| 1421 Sta. Cruz de Tenerife | 0.14 (336) | — | 0.31 (336) |
| 1500 Tarifa | 0.39 (337) | — | 0.23 (337) |
| 1504 Algeciras-Pta. Carnero | 0.27 (337) | — | 0.16 (337) |
| 1512 Ceuta | 0.19 (337) | — | 0.14 (337) |
| 1514 Málaga | 0.08 (334) | — | 0.08 (334) |
| 1712 Tarragona | 0.11 (334) | — | 0.16 (334) |
| 1731 Barcelona II | 0.22 (333) | — | 0.25 (333) |
| 2136 Bilbao-Vizcaya | 0.16 (328) | — | 0.18 (328) |
| 2242 Cabo Peñas | 0.34 (328) | — | 0.24 (328) |
| 2244 Estaca de Bares | 0.33 (329) | — | 0.61 (329) |
| 2246 Villano-Sisargas | 0.44 (326) | — | 0.46 (326) |
| 2248 Cabo Silleiro | 0.54 (328) | — | 0.47 (328) |
| 2342 Golfo de Cádiz | 0.20 (330) | — | 0.16 (330) |
| 2442 Gran Canaria | 0.25 (329) | — | 0.27 (329) |
| 2446 Tenerife Sur | 0.35 (328) | — | 0.08 (328) |
| 2548 Cabo de Gata | 0.16 (330) | — | 0.35 (330) |
| 2610 Cabo de Palos | 0.37 (329) | — | 0.39 (329) |
| 2720 Tarragona (exterior) | 0.36 (329) | — | 0.34 (329) |
| 2798 Cabo de Begur | 0.54 (330) | — | 0.52 (330) |
| 2820 Dragonera (Mallorca) | 0.41 (331) | — | 0.39 (331) |
| 2838 Mahón (Menorca) | 0.53 (333) | — | 0.39 (333) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
