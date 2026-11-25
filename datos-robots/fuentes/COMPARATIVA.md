# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-25T17:34Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7348 | -0.16 | 0.36 | 0.48 |
| Copernicus IBI | 7348 | -0.28 | 0.37 | 0.52 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8576 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7353 | +0.19 | 0.77 | 1.06 |
| Copernicus IBI | 7353 | +0.16 | 0.76 | 0.97 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4388 | -1.65 | 2.82 | 3.47 |
| MET Norway | 4388 | +1.62 | 2.29 | 2.91 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4214 | +2 | 27 | 43 |
| MET Norway | 4214 | +0 | 27 | 43 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3925 | +0.6 | 0.8 | 1.1 |
| MET Norway | 3925 | +0.6 | 0.7 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4503 | -0.89 | 1.53 | 2.57 |
| MET Norway | 4503 | -1.15 | 1.55 | 2.95 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.56 (287) | — | 0.24 (287) |
| 1103 AP Bilbao | 0.37 (287) | — | 0.28 (287) |
| 1117 Gijón | 0.27 (268) | — | 0.39 (268) |
| 1239 Langosteira (A Coruña) | 0.59 (289) | — | 0.26 (289) |
| 1414 Las Palmas Este | 0.21 (287) | — | 0.20 (287) |
| 1421 Sta. Cruz de Tenerife | 0.10 (289) | — | 0.33 (289) |
| 1500 Tarifa | 0.59 (289) | — | 0.31 (289) |
| 1504 Algeciras-Pta. Carnero | 0.41 (289) | — | 0.25 (289) |
| 1512 Ceuta | 0.26 (283) | — | 0.19 (283) |
| 1514 Málaga | 0.11 (285) | — | 0.15 (285) |
| 1712 Tarragona | 0.13 (287) | — | 0.16 (287) |
| 1731 Barcelona II | 0.17 (283) | — | 0.24 (283) |
| 2136 Bilbao-Vizcaya | 0.32 (289) | — | 0.26 (289) |
| 2242 Cabo Peñas | 0.58 (289) | — | 0.35 (289) |
| 2244 Estaca de Bares | 0.51 (289) | — | 0.85 (289) |
| 2246 Villano-Sisargas | 0.49 (289) | — | 0.46 (289) |
| 2248 Cabo Silleiro | 0.57 (168) | — | 0.41 (168) |
| 2342 Golfo de Cádiz | 0.24 (289) | — | 0.19 (289) |
| 2442 Gran Canaria | 0.31 (289) | — | 0.38 (289) |
| 2446 Tenerife Sur | 0.38 (289) | — | 0.13 (289) |
| 2548 Cabo de Gata | 0.25 (289) | — | 0.34 (289) |
| 2610 Cabo de Palos | 0.42 (289) | — | 0.94 (289) |
| 2720 Tarragona (exterior) | 0.30 (289) | — | 0.34 (289) |
| 2798 Cabo de Begur | 0.66 (289) | — | 0.85 (289) |
| 2820 Dragonera (Mallorca) | 0.33 (289) | — | 0.35 (289) |
| 2838 Mahón (Menorca) | 0.35 (289) | — | 0.86 (289) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
