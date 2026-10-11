# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-11T13:27Z.
Ventana: últimos 14 días, 5 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1879 | -0.21 | 0.30 | 0.47 |
| Copernicus IBI | 1879 | -0.22 | 0.28 | 0.42 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 1879 | -0.1 | 1.6 | 3.1 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1877 | +0.21 | 1.03 | 1.48 |
| Copernicus IBI | 1877 | +0.07 | 0.92 | 1.36 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1502 | -1.18 | 2.42 | 3.17 |
| MET Norway | 1502 | +1.20 | 1.97 | 2.39 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1502 | +4 | 41 | 62 |
| MET Norway | 1502 | +7 | 38 | 58 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1314 | +0.3 | 0.5 | 0.7 |
| MET Norway | 1314 | +0.2 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1502 | -0.98 | 2.06 | 3.26 |
| MET Norway | 1502 | -1.00 | 1.74 | 3.18 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.37 (72) | — | 0.15 (72) |
| 1103 AP Bilbao | 0.35 (72) | — | 0.24 (72) |
| 1117 Gijón | 0.16 (71) | — | 0.30 (71) |
| 1239 Langosteira (A Coruña) | 0.39 (72) | — | 0.20 (72) |
| 1414 Las Palmas Este | 0.12 (72) | — | 0.19 (72) |
| 1421 Sta. Cruz de Tenerife | 0.27 (72) | — | 0.17 (72) |
| 1500 Tarifa | 0.14 (70) | — | 0.13 (70) |
| 1504 Algeciras-Pta. Carnero | 0.09 (70) | — | 0.13 (70) |
| 1512 Ceuta | 0.11 (72) | — | 0.11 (72) |
| 1514 Málaga | 0.09 (72) | — | 0.08 (72) |
| 1712 Tarragona | 0.22 (71) | — | 0.17 (71) |
| 1731 Barcelona II | 0.21 (71) | — | 0.33 (71) |
| 2136 Bilbao-Vizcaya | 0.14 (73) | — | 0.16 (73) |
| 2242 Cabo Peñas | 0.28 (73) | — | 0.21 (73) |
| 2244 Estaca de Bares | 0.25 (73) | — | 0.31 (73) |
| 2246 Villano-Sisargas | 0.22 (73) | — | 0.22 (73) |
| 2248 Cabo Silleiro | 0.58 (73) | — | 0.50 (73) |
| 2342 Golfo de Cádiz | 0.09 (73) | — | 0.16 (73) |
| 2442 Gran Canaria | 0.31 (73) | — | 0.48 (73) |
| 2446 Tenerife Sur | 0.22 (73) | — | 0.09 (73) |
| 2548 Cabo de Gata | 0.13 (73) | — | 0.35 (73) |
| 2610 Cabo de Palos | 0.29 (73) | — | 0.23 (73) |
| 2720 Tarragona (exterior) | 0.14 (73) | — | 0.18 (73) |
| 2798 Cabo de Begur | 1.25 (73) | — | 1.30 (73) |
| 2820 Dragonera (Mallorca) | 0.33 (73) | — | 0.29 (73) |
| 2838 Mahón (Menorca) | 1.06 (73) | — | 0.51 (73) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
