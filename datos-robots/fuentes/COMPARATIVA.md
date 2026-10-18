# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-18T11:39Z.
Ventana: últimos 14 días, 12 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 6242 | -0.19 | 0.28 | 0.39 |
| Copernicus IBI | 6242 | -0.22 | 0.27 | 0.38 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 6242 | +0.0 | 1.4 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 6242 | +0.07 | 1.00 | 1.43 |
| Copernicus IBI | 6242 | -0.17 | 0.91 | 1.36 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3806 | -1.18 | 2.27 | 2.97 |
| MET Norway | 3806 | +1.25 | 1.93 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3806 | +5 | 41 | 60 |
| MET Norway | 3806 | +5 | 38 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3329 | +0.2 | 0.5 | 0.7 |
| MET Norway | 3329 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3806 | -0.83 | 1.91 | 3.01 |
| MET Norway | 3806 | -1.00 | 1.69 | 3.03 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.49 (241) | — | 0.20 (241) |
| 1103 AP Bilbao | 0.36 (241) | — | 0.21 (241) |
| 1117 Gijón | 0.17 (232) | — | 0.36 (232) |
| 1239 Langosteira (A Coruña) | 0.51 (241) | — | 0.21 (241) |
| 1414 Las Palmas Este | 0.10 (241) | — | 0.12 (241) |
| 1421 Sta. Cruz de Tenerife | 0.18 (241) | — | 0.25 (241) |
| 1500 Tarifa | 0.22 (237) | — | 0.14 (237) |
| 1504 Algeciras-Pta. Carnero | 0.11 (237) | — | 0.17 (237) |
| 1512 Ceuta | 0.13 (241) | — | 0.15 (241) |
| 1514 Málaga | 0.10 (239) | — | 0.12 (239) |
| 1712 Tarragona | 0.14 (238) | — | 0.15 (238) |
| 1731 Barcelona II | 0.16 (239) | — | 0.21 (239) |
| 2136 Bilbao-Vizcaya | 0.24 (241) | — | 0.24 (241) |
| 2242 Cabo Peñas | 0.44 (241) | — | 0.32 (241) |
| 2244 Estaca de Bares | 0.34 (241) | — | 0.55 (241) |
| 2246 Villano-Sisargas | 0.40 (241) | — | 0.40 (241) |
| 2248 Cabo Silleiro | 0.54 (241) | — | 0.52 (241) |
| 2342 Golfo de Cádiz | 0.16 (241) | — | 0.12 (241) |
| 2442 Gran Canaria | 0.34 (241) | — | 0.47 (241) |
| 2446 Tenerife Sur | 0.18 (241) | — | 0.19 (241) |
| 2548 Cabo de Gata | 0.18 (241) | — | 0.45 (241) |
| 2610 Cabo de Palos | 0.20 (241) | — | 0.20 (241) |
| 2720 Tarragona (exterior) | 0.15 (241) | — | 0.16 (241) |
| 2798 Cabo de Begur | 0.55 (241) | — | 0.56 (241) |
| 2820 Dragonera (Mallorca) | 0.19 (241) | — | 0.18 (241) |
| 2838 Mahón (Menorca) | 0.55 (241) | — | 0.28 (241) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
