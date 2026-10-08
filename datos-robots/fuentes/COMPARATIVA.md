# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-08T13:11Z.
Ventana: últimos 14 días, 2 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 118 | -0.28 | 0.39 | 0.60 |
| Copernicus IBI | 118 | -0.37 | 0.39 | 0.56 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 118 | -0.1 | 1.7 | 3.2 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 116 | +0.02 | 0.97 | 1.41 |
| Copernicus IBI | 116 | -0.16 | 0.89 | 1.37 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 284 | -0.98 | 2.69 | 3.46 |
| MET Norway | 284 | +1.42 | 2.34 | 2.81 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 284 | +11 | 44 | 68 |
| MET Norway | 284 | +7 | 40 | 61 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 250 | +0.1 | 0.6 | 0.8 |
| MET Norway | 250 | +0.2 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 284 | -0.58 | 2.04 | 3.12 |
| MET Norway | 284 | -0.87 | 1.82 | 3.14 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.81 (4) | — | 0.29 (4) |
| 1103 AP Bilbao | 0.33 (4) | — | 0.18 (4) |
| 1117 Gijón | 0.09 (4) | — | 0.34 (4) |
| 1239 Langosteira (A Coruña) | 0.82 (4) | — | 0.49 (4) |
| 1414 Las Palmas Este | 0.10 (4) | — | 0.10 (4) |
| 1421 Sta. Cruz de Tenerife | 0.08 (4) | — | 0.22 (4) |
| 1500 Tarifa | 0.05 (4) | — | 0.09 (4) |
| 1504 Algeciras-Pta. Carnero | 0.05 (4) | — | 0.24 (4) |
| 1512 Ceuta | 0.05 (4) | — | 0.18 (4) |
| 1514 Málaga | 0.10 (4) | — | 0.12 (4) |
| 1712 Tarragona | 0.81 (4) | — | 0.05 (4) |
| 1731 Barcelona II | 0.11 (4) | — | 0.30 (4) |
| 2136 Bilbao-Vizcaya | 0.24 (5) | — | 0.24 (5) |
| 2242 Cabo Peñas | 0.54 (5) | — | 0.39 (5) |
| 2244 Estaca de Bares | 0.34 (5) | — | 0.59 (5) |
| 2246 Villano-Sisargas | 0.60 (5) | — | 0.50 (5) |
| 2248 Cabo Silleiro | 1.10 (5) | — | 0.89 (5) |
| 2342 Golfo de Cádiz | 0.03 (5) | — | 0.15 (5) |
| 2442 Gran Canaria | 0.15 (5) | — | 0.36 (5) |
| 2446 Tenerife Sur | 0.13 (5) | — | 0.09 (5) |
| 2548 Cabo de Gata | 0.05 (5) | — | 0.09 (5) |
| 2610 Cabo de Palos | 0.23 (5) | — | 0.49 (5) |
| 2720 Tarragona (exterior) | 0.25 (5) | — | 0.14 (5) |
| 2798 Cabo de Begur | 1.90 (5) | — | 1.97 (5) |
| 2820 Dragonera (Mallorca) | 0.67 (5) | — | 0.57 (5) |
| 2838 Mahón (Menorca) | 0.19 (5) | — | 0.56 (5) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
