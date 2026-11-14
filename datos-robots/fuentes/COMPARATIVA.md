# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-14T13:46Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8595 | -0.13 | 0.31 | 0.43 |
| Copernicus IBI | 8595 | -0.23 | 0.31 | 0.43 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8621 | +0.2 | 1.5 | 2.5 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8594 | +0.06 | 0.77 | 1.11 |
| Copernicus IBI | 8594 | +0.04 | 0.83 | 1.13 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4865 | -1.20 | 2.37 | 2.97 |
| MET Norway | 4865 | +1.47 | 2.06 | 2.55 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4866 | +7 | 37 | 55 |
| MET Norway | 4866 | +7 | 34 | 51 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4252 | +0.4 | 0.7 | 1.0 |
| MET Norway | 4252 | +0.5 | 0.7 | 0.9 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4862 | -1.09 | 1.72 | 2.89 |
| MET Norway | 4862 | -1.15 | 1.64 | 3.01 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.27 (336) | — | 0.15 (336) |
| 1103 AP Bilbao | 0.19 (335) | — | 0.16 (335) |
| 1117 Gijón | 0.14 (326) | — | 0.24 (326) |
| 1239 Langosteira (A Coruña) | 0.32 (336) | — | 0.23 (336) |
| 1414 Las Palmas Este | 0.29 (329) | — | 0.24 (329) |
| 1421 Sta. Cruz de Tenerife | 0.15 (335) | — | 0.31 (335) |
| 1500 Tarifa | 0.48 (336) | — | 0.30 (336) |
| 1504 Algeciras-Pta. Carnero | 0.37 (336) | — | 0.20 (336) |
| 1512 Ceuta | 0.24 (334) | — | 0.16 (334) |
| 1514 Málaga | 0.09 (332) | — | 0.09 (332) |
| 1712 Tarragona | 0.12 (336) | — | 0.15 (336) |
| 1731 Barcelona II | 0.22 (332) | — | 0.25 (332) |
| 2136 Bilbao-Vizcaya | 0.16 (327) | — | 0.16 (327) |
| 2242 Cabo Peñas | 0.36 (327) | — | 0.23 (327) |
| 2244 Estaca de Bares | 0.35 (327) | — | 0.66 (327) |
| 2246 Villano-Sisargas | 0.47 (325) | — | 0.47 (325) |
| 2248 Cabo Silleiro | 0.53 (327) | — | 0.43 (327) |
| 2342 Golfo de Cádiz | 0.22 (329) | — | 0.19 (329) |
| 2442 Gran Canaria | 0.24 (328) | — | 0.31 (328) |
| 2446 Tenerife Sur | 0.39 (326) | — | 0.09 (326) |
| 2548 Cabo de Gata | 0.20 (329) | — | 0.36 (329) |
| 2610 Cabo de Palos | 0.44 (328) | — | 0.64 (328) |
| 2720 Tarragona (exterior) | 0.36 (328) | — | 0.37 (328) |
| 2798 Cabo de Begur | 0.60 (329) | — | 0.63 (329) |
| 2820 Dragonera (Mallorca) | 0.42 (330) | — | 0.44 (330) |
| 2838 Mahón (Menorca) | 0.52 (332) | — | 0.58 (332) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502
- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
