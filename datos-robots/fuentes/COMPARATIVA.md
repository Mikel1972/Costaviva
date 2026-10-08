# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-08T09:04Z.
Ventana: últimos 14 días, 2 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 14 | -0.41 | 0.45 | 0.69 |
| Copernicus IBI | 14 | -0.49 | 0.49 | 0.71 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 14 | -0.1 | 1.0 | 1.3 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 14 | -0.44 | 0.83 | 1.26 |
| Copernicus IBI | 14 | -0.62 | 0.90 | 1.38 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 156 | -1.24 | 2.75 | 3.66 |
| MET Norway | 156 | +1.40 | 2.42 | 2.95 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 156 | +7 | 42 | 65 |
| MET Norway | 156 | +3 | 39 | 56 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 138 | +0.2 | 0.6 | 0.8 |
| MET Norway | 138 | +0.3 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 156 | -1.47 | 2.16 | 3.49 |
| MET Norway | 156 | -1.51 | 2.01 | 3.55 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 2136 Bilbao-Vizcaya | 0.02 (1) | — | 0.08 (1) |
| 2242 Cabo Peñas | 0.31 (1) | — | 0.16 (1) |
| 2244 Estaca de Bares | 0.37 (1) | — | 0.61 (1) |
| 2246 Villano-Sisargas | 0.59 (1) | — | 0.41 (1) |
| 2248 Cabo Silleiro | 1.36 (1) | — | 1.14 (1) |
| 2342 Golfo de Cádiz | 0.01 (1) | — | 0.13 (1) |
| 2442 Gran Canaria | 0.09 (1) | — | 0.29 (1) |
| 2446 Tenerife Sur | 0.23 (1) | — | 0.01 (1) |
| 2548 Cabo de Gata | 0.01 (1) | — | 0.05 (1) |
| 2610 Cabo de Palos | 0.34 (1) | — | 0.64 (1) |
| 2720 Tarragona (exterior) | 0.21 (1) | — | 0.33 (1) |
| 2798 Cabo de Begur | 1.92 (1) | — | 2.03 (1) |
| 2820 Dragonera (Mallorca) | 0.53 (1) | — | 0.44 (1) |
| 2838 Mahón (Menorca) | 0.28 (1) | — | 0.59 (1) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
