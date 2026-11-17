# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-17T16:25Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7988 | -0.12 | 0.30 | 0.42 |
| Copernicus IBI | 7988 | -0.23 | 0.31 | 0.44 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8608 | +0.2 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7989 | +0.06 | 0.76 | 1.06 |
| Copernicus IBI | 7989 | -0.00 | 0.82 | 1.09 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4512 | -1.20 | 2.38 | 2.98 |
| MET Norway | 4512 | +1.54 | 2.10 | 2.60 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4512 | +7 | 35 | 52 |
| MET Norway | 4512 | +7 | 33 | 49 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3944 | +0.5 | 0.7 | 1.1 |
| MET Norway | 3944 | +0.5 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4512 | -1.08 | 1.70 | 2.93 |
| MET Norway | 4512 | -1.20 | 1.61 | 3.05 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.28 (312) | — | 0.15 (312) |
| 1103 AP Bilbao | 0.18 (310) | — | 0.15 (310) |
| 1117 Gijón | 0.15 (299) | — | 0.23 (299) |
| 1239 Langosteira (A Coruña) | 0.29 (312) | — | 0.23 (312) |
| 1414 Las Palmas Este | 0.28 (309) | — | 0.22 (309) |
| 1421 Sta. Cruz de Tenerife | 0.13 (312) | — | 0.31 (312) |
| 1500 Tarifa | 0.49 (312) | — | 0.31 (312) |
| 1504 Algeciras-Pta. Carnero | 0.38 (312) | — | 0.23 (312) |
| 1512 Ceuta | 0.23 (308) | — | 0.18 (308) |
| 1514 Málaga | 0.10 (308) | — | 0.11 (308) |
| 1712 Tarragona | 0.09 (312) | — | 0.15 (312) |
| 1731 Barcelona II | 0.23 (310) | — | 0.27 (310) |
| 2136 Bilbao-Vizcaya | 0.17 (304) | — | 0.16 (304) |
| 2242 Cabo Peñas | 0.35 (304) | — | 0.21 (304) |
| 2244 Estaca de Bares | 0.37 (305) | — | 0.68 (305) |
| 2246 Villano-Sisargas | 0.39 (302) | — | 0.37 (302) |
| 2248 Cabo Silleiro | 0.45 (304) | — | 0.33 (304) |
| 2342 Golfo de Cádiz | 0.22 (306) | — | 0.21 (306) |
| 2442 Gran Canaria | 0.21 (305) | — | 0.33 (305) |
| 2446 Tenerife Sur | 0.38 (304) | — | 0.08 (304) |
| 2548 Cabo de Gata | 0.20 (306) | — | 0.32 (306) |
| 2610 Cabo de Palos | 0.44 (305) | — | 0.76 (305) |
| 2720 Tarragona (exterior) | 0.33 (305) | — | 0.35 (305) |
| 2798 Cabo de Begur | 0.59 (306) | — | 0.67 (306) |
| 2820 Dragonera (Mallorca) | 0.39 (307) | — | 0.42 (307) |
| 2838 Mahón (Menorca) | 0.44 (309) | — | 0.66 (309) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502
- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
