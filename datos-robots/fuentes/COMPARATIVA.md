# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-20T15:43Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7372 | -0.09 | 0.32 | 0.44 |
| Copernicus IBI | 7372 | -0.22 | 0.33 | 0.48 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8616 | +0.1 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 7375 | +0.10 | 0.73 | 1.00 |
| Copernicus IBI | 7375 | -0.00 | 0.78 | 1.04 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4508 | -1.37 | 2.60 | 3.20 |
| MET Norway | 4508 | +1.76 | 2.31 | 2.89 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4233 | +2 | 26 | 40 |
| MET Norway | 4233 | +2 | 25 | 39 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3945 | +0.6 | 0.8 | 1.2 |
| MET Norway | 3945 | +0.6 | 0.8 | 1.1 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4514 | -0.84 | 1.55 | 2.75 |
| MET Norway | 4514 | -1.09 | 1.52 | 2.96 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.39 (289) | — | 0.18 (289) |
| 1103 AP Bilbao | 0.18 (287) | — | 0.21 (287) |
| 1117 Gijón | 0.20 (273) | — | 0.25 (273) |
| 1239 Langosteira (A Coruña) | 0.40 (289) | — | 0.26 (289) |
| 1414 Las Palmas Este | 0.28 (286) | — | 0.20 (286) |
| 1421 Sta. Cruz de Tenerife | 0.15 (289) | — | 0.35 (289) |
| 1500 Tarifa | 0.61 (289) | — | 0.38 (289) |
| 1504 Algeciras-Pta. Carnero | 0.48 (289) | — | 0.24 (289) |
| 1512 Ceuta | 0.29 (285) | — | 0.21 (285) |
| 1514 Málaga | 0.12 (285) | — | 0.14 (285) |
| 1712 Tarragona | 0.11 (289) | — | 0.14 (289) |
| 1731 Barcelona II | 0.15 (286) | — | 0.18 (286) |
| 2136 Bilbao-Vizcaya | 0.23 (280) | — | 0.19 (280) |
| 2242 Cabo Peñas | 0.41 (280) | — | 0.25 (280) |
| 2244 Estaca de Bares | 0.42 (281) | — | 0.77 (281) |
| 2246 Villano-Sisargas | 0.44 (278) | — | 0.43 (278) |
| 2248 Cabo Silleiro | 0.55 (280) | — | 0.40 (280) |
| 2342 Golfo de Cádiz | 0.25 (282) | — | 0.21 (282) |
| 2442 Gran Canaria | 0.24 (281) | — | 0.35 (281) |
| 2446 Tenerife Sur | 0.42 (280) | — | 0.10 (280) |
| 2548 Cabo de Gata | 0.20 (282) | — | 0.31 (282) |
| 2610 Cabo de Palos | 0.43 (281) | — | 0.97 (281) |
| 2720 Tarragona (exterior) | 0.23 (281) | — | 0.26 (281) |
| 2798 Cabo de Begur | 0.48 (282) | — | 0.65 (282) |
| 2820 Dragonera (Mallorca) | 0.28 (283) | — | 0.32 (283) |
| 2838 Mahón (Menorca) | 0.30 (285) | — | 0.75 (285) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
