# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-13T14:52Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3683 | +0.04 | 0.23 | 0.34 |
| Copernicus IBI | 3683 | -0.04 | 0.20 | 0.27 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 3683 | +0.6 | 1.8 | 2.9 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 3683 | +0.56 | 0.91 | 1.23 |
| Copernicus IBI | 3683 | +0.45 | 0.92 | 1.28 |

## Viento (m/s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 626 | -2.05 | 2.37 | 2.84 |
| MET Norway | 626 | +2.17 | 2.45 | 3.02 |

## Dirección del viento (°)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 626 | +5 | 31 | 45 |
| MET Norway | 626 | +3 | 31 | 44 |

## Presión (hPa)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 313 | +0.8 | 0.9 | 1.0 |
| MET Norway | 313 | +0.8 | 0.9 | 1.0 |

## Temperatura del aire (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 626 | +0.54 | 1.30 | 1.57 |
| MET Norway | 626 | +0.38 | 1.11 | 1.37 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1101 Pasaia II | 0.27 (337) | — | 0.16 (337) |
| 1103 AP Bilbao | 0.18 (336) | — | 0.16 (336) |
| 1117 Gijón | 0.14 (328) | — | 0.21 (328) |
| 1239 Langosteira (A Coruña) | 0.31 (337) | — | 0.25 (337) |
| 1414 Las Palmas Este | 0.28 (330) | — | 0.24 (330) |
| 1421 Sta. Cruz de Tenerife | 0.14 (336) | — | 0.31 (336) |
| 1500 Tarifa | 0.45 (337) | — | 0.29 (337) |
| 1504 Algeciras-Pta. Carnero | 0.34 (337) | — | 0.18 (337) |
| 1512 Ceuta | 0.23 (335) | — | 0.15 (335) |
| 1514 Málaga | 0.09 (333) | — | 0.08 (333) |
| 1712 Tarragona | 0.12 (337) | — | 0.16 (337) |

## Avisos de esta pasada

- 2026-11-04 MET Norway: MET Norway HTTP 502
- Boya 1731 Barcelona II: boya 1731 HTTP 429
- Boya 2136 Bilbao-Vizcaya: boya 2136 HTTP 429
- Boya 2242 Cabo Peñas: boya 2242 HTTP 429
- Boya 2244 Estaca de Bares: boya 2244 HTTP 429
- Boya 2246 Villano-Sisargas: boya 2246 HTTP 429
- Boya 2248 Cabo Silleiro: boya 2248 HTTP 429
- Boya 2342 Golfo de Cádiz: boya 2342 HTTP 429
- Boya 2442 Gran Canaria: boya 2442 HTTP 429
- Boya 2446 Tenerife Sur: boya 2446 HTTP 429
- Boya 2548 Cabo de Gata: boya 2548 HTTP 429
- Boya 2610 Cabo de Palos: boya 2610 HTTP 429
- Boya 2720 Tarragona (exterior): boya 2720 HTTP 429
- Boya 2798 Cabo de Begur: boya 2798 HTTP 429
- Boya 2820 Dragonera (Mallorca): boya 2820 HTTP 429
- Boya 2838 Mahón (Menorca): boya 2838 HTTP 429

Fuentes: boyas de Puertos del Estado (uso interno de validación); Open-Meteo.com (CC BY 4.0); MET Norway (CC BY 4.0); Generated using E.U. Copernicus Marine Service Information (10.48670/moi-00025, 10.48670/moi-00027).
