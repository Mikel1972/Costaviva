# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-10-31T13:00Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8722 | -0.26 | 0.36 | 0.53 |
| Copernicus IBI | 8722 | -0.28 | 0.34 | 0.48 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 8722 | +0.4 | 1.6 | 2.7 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 8734 | -0.05 | 0.96 | 1.45 |
| Copernicus IBI | 8734 | +0.03 | 0.91 | 1.32 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5376 | -1.41 | 2.43 | 3.14 |
| MET Norway | 5376 | +1.09 | 1.88 | 2.34 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5376 | +2 | 43 | 62 |
| MET Norway | 5376 | +6 | 39 | 57 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 4703 | +0.4 | 0.6 | 0.9 |
| MET Norway | 4703 | +0.4 | 0.6 | 0.8 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 5374 | -1.07 | 1.84 | 2.76 |
| MET Norway | 5374 | -1.10 | 1.66 | 2.85 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.73 (337) | — | 0.31 (337) |
| 1103 AP Bilbao | 0.40 (337) | — | 0.27 (337) |
| 1117 Gijón | 0.24 (321) | — | 0.43 (321) |
| 1239 Langosteira (A Coruña) | 0.77 (337) | — | 0.36 (337) |
| 1414 Las Palmas Este | 0.15 (328) | — | 0.18 (328) |
| 1421 Sta. Cruz de Tenerife | 0.14 (337) | — | 0.33 (337) |
| 1500 Tarifa | 0.29 (336) | — | 0.11 (336) |
| 1504 Algeciras-Pta. Carnero | 0.12 (335) | — | 0.20 (335) |
| 1512 Ceuta | 0.11 (333) | — | 0.14 (333) |
| 1514 Málaga | 0.08 (334) | — | 0.09 (334) |
| 1712 Tarragona | 0.14 (335) | — | 0.14 (335) |
| 1731 Barcelona II | 0.18 (334) | — | 0.26 (334) |
| 2136 Bilbao-Vizcaya | 0.38 (337) | — | 0.34 (337) |
| 2242 Cabo Peñas | 0.63 (337) | — | 0.37 (337) |
| 2244 Estaca de Bares | 0.52 (337) | — | 0.83 (337) |
| 2246 Villano-Sisargas | 0.56 (337) | — | 0.55 (337) |
| 2248 Cabo Silleiro | 0.84 (337) | — | 0.77 (337) |
| 2342 Golfo de Cádiz | 0.16 (337) | — | 0.12 (337) |
| 2442 Gran Canaria | 0.42 (337) | — | 0.44 (337) |
| 2446 Tenerife Sur | 0.29 (337) | — | 0.14 (337) |
| 2548 Cabo de Gata | 0.22 (337) | — | 0.35 (337) |
| 2610 Cabo de Palos | 0.31 (337) | — | 0.38 (337) |
| 2720 Tarragona (exterior) | 0.21 (337) | — | 0.23 (337) |
| 2798 Cabo de Begur | 0.66 (337) | — | 0.70 (337) |
| 2820 Dragonera (Mallorca) | 0.35 (337) | — | 0.36 (337) |
| 2838 Mahón (Menorca) | 0.53 (337) | — | 0.40 (337) |

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
