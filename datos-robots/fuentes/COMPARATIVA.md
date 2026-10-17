# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-17T11:07Z.
Ventana: últimos 14 días, 11 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5608 | -0.18 | 0.27 | 0.38 |
| Copernicus IBI | 5608 | -0.21 | 0.25 | 0.37 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 5608 | +0.0 | 1.4 | 2.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5607 | +0.10 | 0.99 | 1.42 |
| Copernicus IBI | 5607 | -0.17 | 0.89 | 1.33 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3420 | -1.08 | 2.18 | 2.87 |
| MET Norway | 3420 | +1.28 | 1.92 | 2.32 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3420 | +5 | 42 | 61 |
| MET Norway | 3420 | +6 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 2992 | +0.2 | 0.5 | 0.7 |
| MET Norway | 2992 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3420 | -0.82 | 1.91 | 3.02 |
| MET Norway | 3420 | -0.97 | 1.69 | 3.02 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.49 (216) | — | 0.18 (216) |
| 1103 AP Bilbao | 0.35 (216) | — | 0.18 (216) |
| 1117 Gijón | 0.16 (207) | — | 0.33 (207) |
| 1239 Langosteira (A Coruña) | 0.51 (216) | — | 0.21 (216) |
| 1414 Las Palmas Este | 0.10 (216) | — | 0.11 (216) |
| 1421 Sta. Cruz de Tenerife | 0.18 (216) | — | 0.26 (216) |
| 1500 Tarifa | 0.21 (212) | — | 0.14 (212) |
| 1504 Algeciras-Pta. Carnero | 0.12 (212) | — | 0.16 (212) |
| 1512 Ceuta | 0.14 (216) | — | 0.15 (216) |
| 1514 Málaga | 0.10 (214) | — | 0.12 (214) |
| 1712 Tarragona | 0.13 (215) | — | 0.13 (215) |
| 1731 Barcelona II | 0.15 (214) | — | 0.20 (214) |
| 2136 Bilbao-Vizcaya | 0.23 (217) | — | 0.22 (217) |
| 2242 Cabo Peñas | 0.43 (217) | — | 0.32 (217) |
| 2244 Estaca de Bares | 0.34 (217) | — | 0.49 (217) |
| 2246 Villano-Sisargas | 0.34 (217) | — | 0.35 (217) |
| 2248 Cabo Silleiro | 0.47 (217) | — | 0.45 (217) |
| 2342 Golfo de Cádiz | 0.14 (217) | — | 0.13 (217) |
| 2442 Gran Canaria | 0.35 (217) | — | 0.49 (217) |
| 2446 Tenerife Sur | 0.17 (217) | — | 0.19 (217) |
| 2548 Cabo de Gata | 0.17 (217) | — | 0.45 (217) |
| 2610 Cabo de Palos | 0.19 (217) | — | 0.19 (217) |
| 2720 Tarragona (exterior) | 0.12 (217) | — | 0.13 (217) |
| 2798 Cabo de Begur | 0.55 (217) | — | 0.55 (217) |
| 2820 Dragonera (Mallorca) | 0.19 (217) | — | 0.17 (217) |
| 2838 Mahón (Menorca) | 0.55 (217) | — | 0.28 (217) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
