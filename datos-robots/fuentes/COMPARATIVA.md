# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-10T13:00Z.
Ventana: últimos 14 días, 4 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1270 | -0.24 | 0.34 | 0.54 |
| Copernicus IBI | 1270 | -0.26 | 0.32 | 0.48 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 1270 | -0.3 | 1.6 | 2.9 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1268 | +0.21 | 1.03 | 1.49 |
| Copernicus IBI | 1268 | +0.12 | 0.96 | 1.42 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1122 | -1.25 | 2.59 | 3.38 |
| MET Norway | 1122 | +1.28 | 2.11 | 2.54 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1122 | +5 | 39 | 61 |
| MET Norway | 1122 | +6 | 36 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 981 | +0.3 | 0.6 | 0.8 |
| MET Norway | 981 | +0.2 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1122 | -0.92 | 2.06 | 3.24 |
| MET Norway | 1122 | -0.94 | 1.76 | 3.22 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.40 (49) | — | 0.17 (49) |
| 1103 AP Bilbao | 0.34 (49) | — | 0.24 (49) |
| 1117 Gijón | 0.13 (48) | — | 0.33 (48) |
| 1239 Langosteira (A Coruña) | 0.42 (49) | — | 0.20 (49) |
| 1414 Las Palmas Este | 0.13 (49) | — | 0.23 (49) |
| 1421 Sta. Cruz de Tenerife | 0.28 (49) | — | 0.14 (49) |
| 1500 Tarifa | 0.15 (48) | — | 0.15 (48) |
| 1504 Algeciras-Pta. Carnero | 0.10 (49) | — | 0.15 (49) |
| 1512 Ceuta | 0.11 (49) | — | 0.15 (49) |
| 1514 Málaga | 0.11 (49) | — | 0.10 (49) |
| 1712 Tarragona | 0.26 (48) | — | 0.16 (48) |
| 1731 Barcelona II | 0.23 (48) | — | 0.35 (48) |
| 2136 Bilbao-Vizcaya | 0.13 (49) | — | 0.16 (49) |
| 2242 Cabo Peñas | 0.29 (49) | — | 0.24 (49) |
| 2244 Estaca de Bares | 0.25 (49) | — | 0.36 (49) |
| 2246 Villano-Sisargas | 0.27 (49) | — | 0.22 (49) |
| 2248 Cabo Silleiro | 0.72 (49) | — | 0.64 (49) |
| 2342 Golfo de Cádiz | 0.12 (49) | — | 0.18 (49) |
| 2442 Gran Canaria | 0.29 (49) | — | 0.43 (49) |
| 2446 Tenerife Sur | 0.24 (49) | — | 0.09 (49) |
| 2548 Cabo de Gata | 0.14 (49) | — | 0.39 (49) |
| 2610 Cabo de Palos | 0.40 (49) | — | 0.31 (49) |
| 2720 Tarragona (exterior) | 0.11 (49) | — | 0.16 (49) |
| 2798 Cabo de Begur | 1.60 (49) | — | 1.69 (49) |
| 2820 Dragonera (Mallorca) | 0.43 (49) | — | 0.36 (49) |
| 2838 Mahón (Menorca) | 1.28 (49) | — | 0.62 (49) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
