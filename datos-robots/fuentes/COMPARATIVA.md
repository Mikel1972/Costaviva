# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-12T16:01Z.
Ventana: últimos 14 días, 6 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2487 | -0.20 | 0.28 | 0.43 |
| Copernicus IBI | 2487 | -0.22 | 0.26 | 0.39 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 2487 | -0.0 | 1.5 | 2.9 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2484 | +0.21 | 1.05 | 1.50 |
| Copernicus IBI | 2484 | +0.04 | 0.90 | 1.32 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1871 | -1.19 | 2.30 | 3.03 |
| MET Norway | 1871 | +1.17 | 1.90 | 2.33 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1871 | +5 | 42 | 62 |
| MET Norway | 1871 | +6 | 39 | 59 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1636 | +0.3 | 0.5 | 0.7 |
| MET Norway | 1636 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1871 | -0.97 | 2.03 | 3.25 |
| MET Norway | 1871 | -1.04 | 1.74 | 3.18 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.35 (96) | — | 0.14 (96) |
| 1103 AP Bilbao | 0.35 (96) | — | 0.23 (96) |
| 1117 Gijón | 0.16 (95) | — | 0.31 (95) |
| 1239 Langosteira (A Coruña) | 0.44 (96) | — | 0.21 (96) |
| 1414 Las Palmas Este | 0.11 (96) | — | 0.16 (96) |
| 1421 Sta. Cruz de Tenerife | 0.25 (96) | — | 0.16 (96) |
| 1500 Tarifa | 0.12 (94) | — | 0.11 (94) |
| 1504 Algeciras-Pta. Carnero | 0.09 (93) | — | 0.14 (93) |
| 1512 Ceuta | 0.10 (96) | — | 0.11 (96) |
| 1514 Málaga | 0.11 (95) | — | 0.10 (95) |
| 1712 Tarragona | 0.21 (95) | — | 0.18 (95) |
| 1731 Barcelona II | 0.20 (95) | — | 0.29 (95) |
| 2136 Bilbao-Vizcaya | 0.15 (96) | — | 0.16 (96) |
| 2242 Cabo Peñas | 0.33 (96) | — | 0.27 (96) |
| 2244 Estaca de Bares | 0.29 (96) | — | 0.37 (96) |
| 2246 Villano-Sisargas | 0.26 (96) | — | 0.25 (96) |
| 2248 Cabo Silleiro | 0.56 (96) | — | 0.47 (96) |
| 2342 Golfo de Cádiz | 0.09 (96) | — | 0.16 (96) |
| 2442 Gran Canaria | 0.29 (96) | — | 0.47 (96) |
| 2446 Tenerife Sur | 0.18 (96) | — | 0.13 (96) |
| 2548 Cabo de Gata | 0.11 (96) | — | 0.29 (96) |
| 2610 Cabo de Palos | 0.25 (96) | — | 0.21 (96) |
| 2720 Tarragona (exterior) | 0.15 (96) | — | 0.18 (96) |
| 2798 Cabo de Begur | 1.01 (96) | — | 1.04 (96) |
| 2820 Dragonera (Mallorca) | 0.29 (96) | — | 0.25 (96) |
| 2838 Mahón (Menorca) | 0.88 (96) | — | 0.43 (96) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
