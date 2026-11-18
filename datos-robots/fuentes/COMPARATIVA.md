# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-18T15:56Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7995 | -0.11 | 0.30 | 0.42 |
| Copernicus IBI | 7995 | -0.23 | 0.32 | 0.46 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8615 | +0.2 | 1.5 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7998 | +0.07 | 0.74 | 1.04 |
| Copernicus IBI | 7998 | -0.01 | 0.80 | 1.07 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4514 | -1.26 | 2.44 | 3.04 |
| MET Norway | 4514 | +1.63 | 2.19 | 2.72 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4233 | +1 | 28 | 43 |
| MET Norway | 4233 | +1 | 27 | 41 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3945 | +0.6 | 0.8 | 1.1 |
| MET Norway | 3945 | +0.5 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4514 | -0.99 | 1.64 | 2.86 |
| MET Norway | 4514 | -1.16 | 1.58 | 3.02 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.29 (313) | — | 0.15 (313) |
| 1103 AP Bilbao | 0.17 (311) | — | 0.15 (311) |
| 1117 Gijón | 0.17 (296) | — | 0.21 (296) |
| 1239 Langosteira (A Coruña) | 0.33 (313) | — | 0.23 (313) |
| 1414 Las Palmas Este | 0.27 (310) | — | 0.21 (310) |
| 1421 Sta. Cruz de Tenerife | 0.14 (313) | — | 0.32 (313) |
| 1500 Tarifa | 0.52 (313) | — | 0.33 (313) |
| 1504 Algeciras-Pta. Carnero | 0.40 (313) | — | 0.24 (313) |
| 1512 Ceuta | 0.25 (309) | — | 0.19 (309) |
| 1514 Málaga | 0.11 (309) | — | 0.13 (309) |
| 1712 Tarragona | 0.09 (313) | — | 0.15 (313) |
| 1731 Barcelona II | 0.23 (310) | — | 0.27 (310) |
| 2136 Bilbao-Vizcaya | 0.16 (304) | — | 0.15 (304) |
| 2242 Cabo Peñas | 0.36 (304) | — | 0.21 (304) |
| 2244 Estaca de Bares | 0.37 (305) | — | 0.68 (305) |
| 2246 Villano-Sisargas | 0.40 (302) | — | 0.39 (302) |
| 2248 Cabo Silleiro | 0.48 (304) | — | 0.34 (304) |
| 2342 Golfo de Cádiz | 0.22 (306) | — | 0.21 (306) |
| 2442 Gran Canaria | 0.21 (305) | — | 0.33 (305) |
| 2446 Tenerife Sur | 0.39 (304) | — | 0.09 (304) |
| 2548 Cabo de Gata | 0.19 (306) | — | 0.30 (306) |
| 2610 Cabo de Palos | 0.44 (305) | — | 0.86 (305) |
| 2720 Tarragona (exterior) | 0.35 (305) | — | 0.36 (305) |
| 2798 Cabo de Begur | 0.58 (306) | — | 0.68 (306) |
| 2820 Dragonera (Mallorca) | 0.36 (307) | — | 0.38 (307) |
| 2838 Mahón (Menorca) | 0.42 (309) | — | 0.73 (309) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502
- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
