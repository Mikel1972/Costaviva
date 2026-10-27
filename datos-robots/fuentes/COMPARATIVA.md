# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-27T12:37Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8724 | -0.27 | 0.36 | 0.52 |
| Copernicus IBI | 8724 | -0.30 | 0.34 | 0.48 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8724 | +0.3 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8731 | -0.07 | 0.99 | 1.48 |
| Copernicus IBI | 8731 | -0.12 | 0.96 | 1.40 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5005 | -1.52 | 2.55 | 3.25 |
| MET Norway | 5005 | +1.03 | 1.90 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5005 | +5 | 40 | 58 |
| MET Norway | 5005 | +6 | 37 | 54 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4379 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4379 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5003 | -0.99 | 1.85 | 2.80 |
| MET Norway | 5003 | -1.09 | 1.67 | 2.90 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.77 (337) | — | 0.30 (337) |
| 1103 AP Bilbao | 0.42 (337) | — | 0.25 (337) |
| 1117 Gijón | 0.24 (316) | — | 0.46 (316) |
| 1239 Langosteira (A Coruña) | 0.79 (337) | — | 0.31 (337) |
| 1414 Las Palmas Este | 0.12 (336) | — | 0.13 (336) |
| 1421 Sta. Cruz de Tenerife | 0.14 (337) | — | 0.35 (337) |
| 1500 Tarifa | 0.25 (335) | — | 0.11 (335) |
| 1504 Algeciras-Pta. Carnero | 0.10 (334) | — | 0.20 (334) |
| 1512 Ceuta | 0.11 (334) | — | 0.15 (334) |
| 1514 Málaga | 0.08 (334) | — | 0.11 (334) |
| 1712 Tarragona | 0.13 (334) | — | 0.12 (334) |
| 1731 Barcelona II | 0.16 (335) | — | 0.23 (335) |
| 2136 Bilbao-Vizcaya | 0.38 (337) | — | 0.33 (337) |
| 2242 Cabo Peñas | 0.66 (337) | — | 0.40 (337) |
| 2244 Estaca de Bares | 0.53 (337) | — | 0.84 (337) |
| 2246 Villano-Sisargas | 0.56 (337) | — | 0.55 (337) |
| 2248 Cabo Silleiro | 0.81 (337) | — | 0.75 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.47 (337) | — | 0.53 (337) |
| 2446 Tenerife Sur | 0.24 (337) | — | 0.19 (337) |
| 2548 Cabo de Gata | 0.26 (337) | — | 0.46 (337) |
| 2610 Cabo de Palos | 0.31 (337) | — | 0.40 (337) |
| 2720 Tarragona (exterior) | 0.18 (337) | — | 0.21 (337) |
| 2798 Cabo de Begur | 0.60 (337) | — | 0.63 (337) |
| 2820 Dragonera (Mallorca) | 0.31 (337) | — | 0.33 (337) |
| 2838 Mahón (Menorca) | 0.49 (337) | — | 0.38 (337) |

## Avisos de esta pasada

- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
