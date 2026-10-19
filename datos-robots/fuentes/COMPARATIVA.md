# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-19T13:52Z.
Ventana: últimos 14 días, 13 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 6864 | -0.20 | 0.29 | 0.41 |
| Copernicus IBI | 6864 | -0.23 | 0.28 | 0.41 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 6864 | +0.1 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 6865 | +0.04 | 1.00 | 1.45 |
| Copernicus IBI | 6865 | -0.17 | 0.93 | 1.38 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4190 | -1.26 | 2.35 | 3.06 |
| MET Norway | 4190 | +1.25 | 1.97 | 2.38 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4190 | +5 | 41 | 60 |
| MET Norway | 4190 | +5 | 38 | 56 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3665 | +0.2 | 0.5 | 0.8 |
| MET Norway | 3665 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4189 | -0.87 | 1.91 | 3.00 |
| MET Norway | 4189 | -1.04 | 1.70 | 3.02 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.47 (265) | — | 0.20 (265) |
| 1103 AP Bilbao | 0.35 (265) | — | 0.21 (265) |
| 1117 Gijón | 0.18 (254) | — | 0.36 (254) |
| 1239 Langosteira (A Coruña) | 0.49 (265) | — | 0.21 (265) |
| 1414 Las Palmas Este | 0.10 (265) | — | 0.13 (265) |
| 1421 Sta. Cruz de Tenerife | 0.18 (265) | — | 0.25 (265) |
| 1500 Tarifa | 0.22 (261) | — | 0.13 (261) |
| 1504 Algeciras-Pta. Carnero | 0.11 (261) | — | 0.17 (261) |
| 1512 Ceuta | 0.13 (264) | — | 0.15 (264) |
| 1514 Málaga | 0.10 (263) | — | 0.12 (263) |
| 1712 Tarragona | 0.17 (263) | — | 0.15 (263) |
| 1731 Barcelona II | 0.17 (263) | — | 0.22 (263) |
| 2136 Bilbao-Vizcaya | 0.23 (265) | — | 0.23 (265) |
| 2242 Cabo Peñas | 0.43 (265) | — | 0.31 (265) |
| 2244 Estaca de Bares | 0.34 (265) | — | 0.58 (265) |
| 2246 Villano-Sisargas | 0.42 (265) | — | 0.42 (265) |
| 2248 Cabo Silleiro | 0.57 (265) | — | 0.56 (265) |
| 2342 Golfo de Cádiz | 0.16 (265) | — | 0.12 (265) |
| 2442 Gran Canaria | 0.34 (265) | — | 0.47 (265) |
| 2446 Tenerife Sur | 0.18 (265) | — | 0.19 (265) |
| 2548 Cabo de Gata | 0.19 (265) | — | 0.46 (265) |
| 2610 Cabo de Palos | 0.26 (265) | — | 0.25 (265) |
| 2720 Tarragona (exterior) | 0.15 (265) | — | 0.17 (265) |
| 2798 Cabo de Begur | 0.59 (265) | — | 0.61 (265) |
| 2820 Dragonera (Mallorca) | 0.33 (265) | — | 0.32 (265) |
| 2838 Mahón (Menorca) | 0.59 (265) | — | 0.31 (265) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
