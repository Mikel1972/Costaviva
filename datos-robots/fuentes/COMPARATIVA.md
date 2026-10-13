# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-13T14:32Z.
Ventana: últimos 14 días, 7 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3094 | -0.20 | 0.27 | 0.42 |
| Copernicus IBI | 3094 | -0.21 | 0.25 | 0.37 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 3094 | +0.0 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3093 | +0.20 | 1.04 | 1.49 |
| Copernicus IBI | 3093 | +0.00 | 0.89 | 1.31 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2255 | -1.07 | 2.18 | 2.88 |
| MET Norway | 2255 | +1.22 | 1.89 | 2.30 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2255 | +4 | 43 | 63 |
| MET Norway | 2255 | +6 | 39 | 58 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 1972 | +0.3 | 0.5 | 0.7 |
| MET Norway | 1972 | +0.2 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2255 | -0.97 | 2.03 | 3.25 |
| MET Norway | 2255 | -1.07 | 1.75 | 3.19 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.42 (118) | — | 0.16 (118) |
| 1103 AP Bilbao | 0.37 (120) | — | 0.22 (120) |
| 1117 Gijón | 0.15 (115) | — | 0.32 (115) |
| 1239 Langosteira (A Coruña) | 0.44 (120) | — | 0.20 (120) |
| 1414 Las Palmas Este | 0.12 (120) | — | 0.15 (120) |
| 1421 Sta. Cruz de Tenerife | 0.24 (120) | — | 0.17 (120) |
| 1500 Tarifa | 0.13 (115) | — | 0.10 (115) |
| 1504 Algeciras-Pta. Carnero | 0.09 (117) | — | 0.15 (117) |
| 1512 Ceuta | 0.09 (120) | — | 0.11 (120) |
| 1514 Málaga | 0.11 (116) | — | 0.10 (116) |
| 1712 Tarragona | 0.18 (117) | — | 0.17 (117) |
| 1731 Barcelona II | 0.20 (116) | — | 0.27 (116) |
| 2136 Bilbao-Vizcaya | 0.21 (120) | — | 0.20 (120) |
| 2242 Cabo Peñas | 0.38 (120) | — | 0.30 (120) |
| 2244 Estaca de Bares | 0.29 (120) | — | 0.38 (120) |
| 2246 Villano-Sisargas | 0.26 (120) | — | 0.24 (120) |
| 2248 Cabo Silleiro | 0.50 (120) | — | 0.43 (120) |
| 2342 Golfo de Cádiz | 0.10 (120) | — | 0.14 (120) |
| 2442 Gran Canaria | 0.31 (120) | — | 0.49 (120) |
| 2446 Tenerife Sur | 0.16 (120) | — | 0.14 (120) |
| 2548 Cabo de Gata | 0.10 (120) | — | 0.25 (120) |
| 2610 Cabo de Palos | 0.23 (120) | — | 0.20 (120) |
| 2720 Tarragona (exterior) | 0.15 (120) | — | 0.16 (120) |
| 2798 Cabo de Begur | 0.84 (120) | — | 0.86 (120) |
| 2820 Dragonera (Mallorca) | 0.26 (120) | — | 0.22 (120) |
| 2838 Mahón (Menorca) | 0.78 (120) | — | 0.38 (120) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
