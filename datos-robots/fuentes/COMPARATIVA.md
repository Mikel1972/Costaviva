# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-15T12:01Z.
Ventana: últimos 14 días, 9 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4349 | -0.18 | 0.26 | 0.39 |
| Copernicus IBI | 4349 | -0.20 | 0.25 | 0.36 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 4349 | -0.0 | 1.4 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4349 | +0.15 | 1.01 | 1.45 |
| Copernicus IBI | 4349 | -0.11 | 0.88 | 1.30 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3022 | -1.03 | 2.16 | 2.82 |
| MET Norway | 3022 | +1.26 | 1.90 | 2.30 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3022 | +6 | 43 | 62 |
| MET Norway | 3022 | +6 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2643 | +0.3 | 0.5 | 0.7 |
| MET Norway | 2643 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3022 | -0.86 | 1.95 | 3.09 |
| MET Norway | 3022 | -1.03 | 1.71 | 3.08 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.45 (168) | — | 0.16 (168) |
| 1103 AP Bilbao | 0.36 (168) | — | 0.19 (168) |
| 1117 Gijón | 0.16 (163) | — | 0.31 (163) |
| 1239 Langosteira (A Coruña) | 0.46 (168) | — | 0.20 (168) |
| 1414 Las Palmas Este | 0.10 (168) | — | 0.12 (168) |
| 1421 Sta. Cruz de Tenerife | 0.20 (168) | — | 0.24 (168) |
| 1500 Tarifa | 0.19 (163) | — | 0.13 (163) |
| 1504 Algeciras-Pta. Carnero | 0.11 (164) | — | 0.13 (164) |
| 1512 Ceuta | 0.13 (168) | — | 0.15 (168) |
| 1514 Málaga | 0.11 (166) | — | 0.12 (166) |
| 1712 Tarragona | 0.15 (167) | — | 0.15 (167) |
| 1731 Barcelona II | 0.16 (166) | — | 0.22 (166) |
| 2136 Bilbao-Vizcaya | 0.22 (168) | — | 0.19 (168) |
| 2242 Cabo Peñas | 0.39 (168) | — | 0.30 (168) |
| 2244 Estaca de Bares | 0.32 (168) | — | 0.43 (168) |
| 2246 Villano-Sisargas | 0.28 (168) | — | 0.27 (168) |
| 2248 Cabo Silleiro | 0.44 (168) | — | 0.40 (168) |
| 2342 Golfo de Cádiz | 0.13 (168) | — | 0.14 (168) |
| 2442 Gran Canaria | 0.36 (168) | — | 0.55 (168) |
| 2446 Tenerife Sur | 0.16 (168) | — | 0.21 (168) |
| 2548 Cabo de Gata | 0.12 (168) | — | 0.36 (168) |
| 2610 Cabo de Palos | 0.19 (168) | — | 0.17 (168) |
| 2720 Tarragona (exterior) | 0.13 (168) | — | 0.14 (168) |
| 2798 Cabo de Begur | 0.66 (168) | — | 0.66 (168) |
| 2820 Dragonera (Mallorca) | 0.21 (168) | — | 0.18 (168) |
| 2838 Mahón (Menorca) | 0.66 (168) | — | 0.32 (168) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
