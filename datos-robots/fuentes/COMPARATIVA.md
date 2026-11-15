# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-15T14:15Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7993 | -0.13 | 0.31 | 0.43 |
| Copernicus IBI | 7993 | -0.23 | 0.31 | 0.44 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8613 | +0.2 | 1.5 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7991 | +0.06 | 0.78 | 1.10 |
| Copernicus IBI | 7991 | +0.02 | 0.84 | 1.13 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4510 | -1.18 | 2.38 | 3.00 |
| MET Norway | 4510 | +1.48 | 2.07 | 2.55 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4511 | +8 | 37 | 55 |
| MET Norway | 4511 | +7 | 34 | 51 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3943 | +0.4 | 0.7 | 1.0 |
| MET Norway | 3943 | +0.5 | 0.7 | 0.9 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4511 | -1.08 | 1.72 | 2.91 |
| MET Norway | 4511 | -1.16 | 1.63 | 3.03 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.27 (312) | — | 0.15 (312) |
| 1103 AP Bilbao | 0.18 (311) | — | 0.16 (311) |
| 1117 Gijón | 0.14 (303) | — | 0.24 (303) |
| 1239 Langosteira (A Coruña) | 0.30 (312) | — | 0.23 (312) |
| 1414 Las Palmas Este | 0.30 (307) | — | 0.24 (307) |
| 1421 Sta. Cruz de Tenerife | 0.15 (311) | — | 0.31 (311) |
| 1500 Tarifa | 0.48 (312) | — | 0.31 (312) |
| 1504 Algeciras-Pta. Carnero | 0.38 (312) | — | 0.21 (312) |
| 1512 Ceuta | 0.23 (310) | — | 0.16 (310) |
| 1514 Málaga | 0.09 (310) | — | 0.09 (310) |
| 1712 Tarragona | 0.12 (312) | — | 0.15 (312) |
| 1731 Barcelona II | 0.23 (310) | — | 0.25 (310) |
| 2136 Bilbao-Vizcaya | 0.16 (304) | — | 0.15 (304) |
| 2242 Cabo Peñas | 0.36 (304) | — | 0.23 (304) |
| 2244 Estaca de Bares | 0.35 (305) | — | 0.67 (305) |
| 2246 Villano-Sisargas | 0.46 (302) | — | 0.46 (302) |
| 2248 Cabo Silleiro | 0.51 (304) | — | 0.41 (304) |
| 2342 Golfo de Cádiz | 0.22 (305) | — | 0.20 (305) |
| 2442 Gran Canaria | 0.24 (305) | — | 0.32 (305) |
| 2446 Tenerife Sur | 0.39 (304) | — | 0.09 (304) |
| 2548 Cabo de Gata | 0.20 (306) | — | 0.35 (306) |
| 2610 Cabo de Palos | 0.44 (305) | — | 0.68 (305) |
| 2720 Tarragona (exterior) | 0.37 (305) | — | 0.37 (305) |
| 2798 Cabo de Begur | 0.62 (306) | — | 0.65 (306) |
| 2820 Dragonera (Mallorca) | 0.43 (307) | — | 0.44 (307) |
| 2838 Mahón (Menorca) | 0.53 (309) | — | 0.61 (309) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502
- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
