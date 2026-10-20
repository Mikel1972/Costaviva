# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-20T12:03Z.
Ventana: últimos 14 días, 14 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7435 | -0.20 | 0.29 | 0.41 |
| Copernicus IBI | 7435 | -0.24 | 0.28 | 0.41 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 7435 | +0.2 | 1.5 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7437 | +0.01 | 1.00 | 1.46 |
| Copernicus IBI | 7437 | -0.17 | 0.94 | 1.39 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4542 | -1.30 | 2.36 | 3.07 |
| MET Norway | 4542 | +1.18 | 1.93 | 2.36 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4542 | +4 | 41 | 61 |
| MET Norway | 4542 | +5 | 38 | 56 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3973 | +0.2 | 0.5 | 0.8 |
| MET Norway | 3973 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4540 | -0.91 | 1.92 | 3.02 |
| MET Norway | 4540 | -1.08 | 1.73 | 3.07 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.44 (287) | — | 0.19 (287) |
| 1103 AP Bilbao | 0.33 (287) | — | 0.20 (287) |
| 1117 Gijón | 0.17 (276) | — | 0.34 (276) |
| 1239 Langosteira (A Coruña) | 0.48 (287) | — | 0.20 (287) |
| 1414 Las Palmas Este | 0.11 (287) | — | 0.13 (287) |
| 1421 Sta. Cruz de Tenerife | 0.19 (287) | — | 0.25 (287) |
| 1500 Tarifa | 0.21 (282) | — | 0.12 (282) |
| 1504 Algeciras-Pta. Carnero | 0.10 (283) | — | 0.18 (283) |
| 1512 Ceuta | 0.13 (286) | — | 0.14 (286) |
| 1514 Málaga | 0.10 (285) | — | 0.12 (285) |
| 1712 Tarragona | 0.17 (285) | — | 0.15 (285) |
| 1731 Barcelona II | 0.19 (285) | — | 0.26 (285) |
| 2136 Bilbao-Vizcaya | 0.22 (287) | — | 0.22 (287) |
| 2242 Cabo Peñas | 0.41 (287) | — | 0.29 (287) |
| 2244 Estaca de Bares | 0.33 (287) | — | 0.56 (287) |
| 2246 Villano-Sisargas | 0.40 (287) | — | 0.41 (287) |
| 2248 Cabo Silleiro | 0.57 (287) | — | 0.57 (287) |
| 2342 Golfo de Cádiz | 0.15 (287) | — | 0.12 (287) |
| 2442 Gran Canaria | 0.36 (287) | — | 0.47 (287) |
| 2446 Tenerife Sur | 0.20 (287) | — | 0.18 (287) |
| 2548 Cabo de Gata | 0.20 (287) | — | 0.46 (287) |
| 2610 Cabo de Palos | 0.31 (287) | — | 0.30 (287) |
| 2720 Tarragona (exterior) | 0.18 (287) | — | 0.20 (287) |
| 2798 Cabo de Begur | 0.59 (287) | — | 0.62 (287) |
| 2820 Dragonera (Mallorca) | 0.35 (287) | — | 0.36 (287) |
| 2838 Mahón (Menorca) | 0.59 (287) | — | 0.33 (287) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
