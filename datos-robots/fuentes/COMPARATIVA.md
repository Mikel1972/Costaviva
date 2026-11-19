# Comparativa de fuentes contra boyas de Puertos del Estado

Generado sin IA por `scripts/fuentes/comparar-boyas.mjs` el 2026-11-19T16:00Z.
Ventana: últimos 14 días, 15 pronóstico(s) archivado(s) (cada uno, las 24 h siguientes a su hora).

Cómo leerlo: **sesgo** = previsión − boya (negativo = la fuente se queda corta); **MAE** = error medio absoluto;
**RMSE** penaliza los errores grandes; **n** = horas-boya comparadas, las MISMAS para todas las fuentes de cada tabla. Mejor fuente = MAE y RMSE más bajos.
La altura de ola es la del modelo en bruto (sin el factor ×1,38 que /prevision aplica en Gipuzkoa).
El viento de las boyas se mide a pocos metros sobre el mar y los modelos lo dan a 10 m: el sesgo absoluto del viento dice poco; compara las fuentes entre sí.

## Altura de ola (m)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 294 | +0.07 | 0.19 | 0.29 |
| Copernicus IBI | 294 | -0.22 | 0.24 | 0.32 |

## Periodo de pico (s)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Copernicus IBI | 318 | +0.4 | 1.0 | 1.6 |

## Temperatura del agua (°C)

| Fuente | n | Sesgo | MAE | RMSE |
|---|---:|---:|---:|---:|
| Open-Meteo | 294 | +0.07 | 0.65 | 0.71 |
| Copernicus IBI | 294 | -0.53 | 0.60 | 0.73 |

## Altura de ola por boya (MAE en m, n entre paréntesis)

| Boya | Open-Meteo | MET Norway | Copernicus IBI |
|---|---:|---:|---:|
| 1117 Gijón | 0.19 (294) | — | 0.24 (294) |

## Avisos de esta pasada

- 2026-11-14 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- 2026-11-19 Open-Meteo: Open-Meteo (forecast) sin respuesta: fetch failed
- Boya 1101 Pasaia II: boya 1101 HTTP 429
- Boya 1103 AP Bilbao: boya 1103 HTTP 429
- Boya 1239 Langosteira (A Coruña): boya 1239 HTTP 429
- Boya 1414 Las Palmas Este: boya 1414 HTTP 429
- Boya 1421 Sta. Cruz de Tenerife: boya 1421 HTTP 429
- Boya 1500 Tarifa: boya 1500 HTTP 429
- Boya 1504 Algeciras-Pta. Carnero: boya 1504 HTTP 429
- Boya 1512 Ceuta: boya 1512 HTTP 429
- Boya 1514 Málaga: boya 1514 HTTP 429
- Boya 1712 Tarragona: boya 1712 HTTP 429
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
