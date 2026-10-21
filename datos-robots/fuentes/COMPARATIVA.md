# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-21T12:18Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8095 | -0.20 | 0.30 | 0.42 |
| Copernicus IBI | 8095 | -0.25 | 0.29 | 0.42 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8095 | +0.2 | 1.6 | 2.8 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8098 | -0.02 | 1.00 | 1.46 |
| Copernicus IBI | 8098 | -0.16 | 0.95 | 1.40 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4956 | -1.37 | 2.43 | 3.15 |
| MET Norway | 4956 | +1.12 | 1.92 | 2.35 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4956 | +4 | 40 | 59 |
| MET Norway | 4956 | +5 | 37 | 55 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4336 | +0.3 | 0.6 | 0.8 |
| MET Norway | 4336 | +0.3 | 0.5 | 0.7 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4954 | -0.95 | 1.91 | 3.02 |
| MET Norway | 4954 | -1.11 | 1.73 | 3.09 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.46 (312) | — | 0.20 (312) |
| 1103 AP Bilbao | 0.33 (312) | — | 0.20 (312) |
| 1117 Gijón | 0.17 (301) | — | 0.35 (301) |
| 1239 Langosteira (A Coruña) | 0.50 (312) | — | 0.21 (312) |
| 1414 Las Palmas Este | 0.11 (311) | — | 0.13 (311) |
| 1421 Sta. Cruz de Tenerife | 0.18 (312) | — | 0.27 (312) |
| 1500 Tarifa | 0.22 (307) | — | 0.13 (307) |
| 1504 Algeciras-Pta. Carnero | 0.11 (308) | — | 0.18 (308) |
| 1512 Ceuta | 0.13 (310) | — | 0.14 (310) |
| 1514 Málaga | 0.10 (308) | — | 0.12 (308) |
| 1712 Tarragona | 0.16 (310) | — | 0.14 (310) |
| 1731 Barcelona II | 0.19 (310) | — | 0.25 (310) |
| 2136 Bilbao-Vizcaya | 0.22 (313) | — | 0.22 (313) |
| 2242 Cabo Peñas | 0.41 (313) | — | 0.29 (313) |
| 2244 Estaca de Bares | 0.34 (313) | — | 0.57 (313) |
| 2246 Villano-Sisargas | 0.40 (313) | — | 0.41 (313) |
| 2248 Cabo Silleiro | 0.58 (313) | — | 0.57 (313) |
| 2342 Golfo de Cádiz | 0.15 (313) | — | 0.12 (313) |
| 2442 Gran Canaria | 0.38 (313) | — | 0.49 (313) |
| 2446 Tenerife Sur | 0.20 (313) | — | 0.18 (313) |
| 2548 Cabo de Gata | 0.25 (313) | — | 0.49 (313) |
| 2610 Cabo de Palos | 0.32 (313) | — | 0.35 (313) |
| 2720 Tarragona (exterior) | 0.18 (313) | — | 0.21 (313) |
| 2798 Cabo de Begur | 0.62 (313) | — | 0.65 (313) |
| 2820 Dragonera (Mallorca) | 0.35 (313) | — | 0.36 (313) |
| 2838 Mahón (Menorca) | 0.59 (313) | — | 0.36 (313) |

## Avisos de esta pasada

- 2026-10-07 Copernicus IBI: sin instantánea mar/spots.json (falta la cuenta de Copernicus o la migración del bucket)
- 2026-10-15 MET Norway: MET Norway HTTP 503

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
