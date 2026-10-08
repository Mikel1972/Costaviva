# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-08T01:25Z.
Ventana: últimos 14 días, 1 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 40 | -0.23 | 0.29 | 0.41 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 40 | -0.13 | 0.99 | 1.37 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 14 | -0.96 | 2.34 | 2.90 |
| MET Norway | 14 | +1.75 | 2.21 | 2.64 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 14 | -0 | 36 | 58 |
| MET Norway | 14 | -12 | 37 | 53 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 13 | -0.3 | 0.6 | 0.7 |
| MET Norway | 13 | +0.0 | 0.5 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 14 | -1.78 | 2.29 | 3.71 |
| MET Norway | 14 | -1.76 | 2.04 | 3.78 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 1.09 (1) | — | — |
| 1103 AP Bilbao | 0.91 (1) | — | — |
| 1117 Gijón | 0.19 (1) | — | — |
| 1239 Langosteira (A Coruña) | 0.49 (1) | — | — |
| 1414 Las Palmas Este | 0.07 (1) | — | — |
| 1421 Sta. Cruz de Tenerife | 0.18 (1) | — | — |
| 1500 Tarifa | 0.11 (1) | — | — |
| 1504 Algeciras-Pta. Carnero | 0.01 (1) | — | — |
| 1512 Ceuta | 0.02 (1) | — | — |
| 1514 Málaga | 0.22 (1) | — | — |
| 1712 Tarragona | 0.16 (1) | — | — |
| 1731 Barcelona II | 0.19 (1) | — | — |
| 2136 Bilbao-Vizcaya | 0.18 (2) | — | — |
| 2242 Cabo Peñas | 0.70 (2) | — | — |
| 2244 Estaca de Bares | 0.06 (2) | — | — |
| 2246 Villano-Sisargas | 0.38 (2) | — | — |
| 2248 Cabo Silleiro | 1.00 (2) | — | — |
| 2342 Golfo de Cádiz | 0.03 (2) | — | — |
| 2442 Gran Canaria | 0.15 (2) | — | — |
| 2446 Tenerife Sur | 0.22 (2) | — | — |
| 2548 Cabo de Gata | 0.18 (2) | — | — |
| 2610 Cabo de Palos | 0.37 (2) | — | — |
| 2720 Tarragona (exterior) | 0.24 (2) | — | — |
| 2798 Cabo de Begur | 0.21 (2) | — | — |
| 2820 Dragonera (Mallorca) | 0.20 (2) | — | — |
| 2838 Mahón (Menorca) | 0.11 (2) | — | — |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
