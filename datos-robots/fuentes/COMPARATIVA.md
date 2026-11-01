# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-01T13:44Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8716 | -0.25 | 0.36 | 0.53 |
| Copernicus IBI | 8716 | -0.27 | 0.33 | 0.47 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8716 | +0.3 | 1.6 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8728 | -0.03 | 0.94 | 1.42 |
| Copernicus IBI | 8728 | +0.06 | 0.88 | 1.28 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5376 | -1.36 | 2.37 | 3.06 |
| MET Norway | 5376 | +1.12 | 1.87 | 2.34 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5376 | +3 | 44 | 62 |
| MET Norway | 5376 | +6 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4703 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4703 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5370 | -1.08 | 1.82 | 2.74 |
| MET Norway | 5370 | -1.08 | 1.65 | 2.82 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.72 (337) | — | 0.29 (337) |
| 1103 AP Bilbao | 0.39 (337) | — | 0.25 (337) |
| 1117 Gijón | 0.23 (320) | — | 0.41 (320) |
| 1239 Langosteira (A Coruña) | 0.78 (337) | — | 0.36 (337) |
| 1414 Las Palmas Este | 0.15 (326) | — | 0.18 (326) |
| 1421 Sta. Cruz de Tenerife | 0.13 (337) | — | 0.34 (337) |
| 1500 Tarifa | 0.30 (336) | — | 0.12 (336) |
| 1504 Algeciras-Pta. Carnero | 0.14 (335) | — | 0.19 (335) |
| 1512 Ceuta | 0.12 (333) | — | 0.14 (333) |
| 1514 Málaga | 0.08 (332) | — | 0.08 (332) |
| 1712 Tarragona | 0.13 (336) | — | 0.13 (336) |
| 1731 Barcelona II | 0.17 (332) | — | 0.25 (332) |
| 2136 Bilbao-Vizcaya | 0.37 (337) | — | 0.33 (337) |
| 2242 Cabo Peñas | 0.62 (337) | — | 0.38 (337) |
| 2244 Estaca de Bares | 0.52 (337) | — | 0.79 (337) |
| 2246 Villano-Sisargas | 0.52 (337) | — | 0.53 (337) |
| 2248 Cabo Silleiro | 0.81 (337) | — | 0.73 (337) |
| 2342 Golfo de Cádiz | 0.15 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.42 (337) | — | 0.42 (337) |
| 2446 Tenerife Sur | 0.30 (337) | — | 0.13 (337) |
| 2548 Cabo de Gata | 0.21 (337) | — | 0.36 (337) |
| 2610 Cabo de Palos | 0.32 (337) | — | 0.37 (337) |
| 2720 Tarragona (exterior) | 0.20 (337) | — | 0.22 (337) |
| 2798 Cabo de Begur | 0.65 (337) | — | 0.68 (337) |
| 2820 Dragonera (Mallorca) | 0.36 (337) | — | 0.37 (337) |
| 2838 Mahón (Menorca) | 0.52 (337) | — | 0.40 (337) |

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
