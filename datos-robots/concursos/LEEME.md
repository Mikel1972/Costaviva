# Concursos de pesca (resultados públicos y reutilizables)

Para qué: un concurso es una muestra real de "qué salió, cuánto y dónde" en un
día y una zona concretos, con condiciones conocidas. Sirve para contrastar el
índice de pesca, igual que las observaciones abiertas.

## Quién publica resultados (comprobado 2026-10-08)

| Fuente | Qué publica | ¿Se puede reutilizar? |
|---|---|---|
| FEPyC (fepyc.es) | Ficha por campeonato con clasificaciones (nombres de deportistas, piezas/puntos) | **No sin permiso.** Aviso legal: "no se cede ningún derecho de propiedad intelectual [...] quedando reservados todos los derechos". |
| FPPD (fppd.pt) | Clasificaciones y reglamentos de los nacionales de mar | **No sin permiso.** Termos: "A reprodução, distribuição ou qualquer outro uso dos conteúdos do site sem autorização prévia por escrito da FPPD é estritamente proibida." |

Ninguna de las dos publica con licencia abierta. Hasta tener su autorización
escrita, `concursos.json` queda vacío. Las federaciones territoriales y los
clubes se revisan uno a uno (rutina de los viernes) y se anotan en
`fuentes.json` aunque sea con `no_permitida_sin_permiso`, para no volver a
mirarlos. Una noticia de prensa sobre un concurso **no** es una fuente
reutilizable (el texto es de la publicación).

**Cómo pedir permiso** (lo hace Mikel, no el robot): correo a la federación o
club pidiendo reutilizar, sin nombres, especie, número de piezas, peso y talla
máxima, fecha, zona y modalidad de sus concursos de mar, citando la fuente. Con
la respuesta, en `fuentes.json`: `reutilizacion: "permiso"` y `permiso:
{ "fecha": "...", "de": "<cargo o club, no persona>", "alcance": "...",
"referencia": "<asunto/fecha del correo, guardado fuera del repo>" }`.

## Formato de `concursos.json`

```json
{
  "id": "fppd-2027-nac1-mar-p1",
  "fuente": "fppd",
  "url": "https://...",
  "fecha": "2027-05-15",
  "hora_inicio": "08:00", "hora_fin": "12:00",
  "modalidad": "costa",
  "disciplina": "Mar-Costa",
  "zona": { "lugar": "Praia de ...", "lat": 41.1, "lon": -8.7, "spot": "porto" },
  "participantes": 40,
  "capturas": [
    { "especie": "sargo", "nombre_publicado": "Sargo", "piezas": 120, "peso_kg": 31.5, "talla_max_cm": 38 }
  ],
  "sin_capturas": false,
  "licencia_o_permiso": "permiso fppd 2027-03-01",
  "fecha_revision": "2027-05-20"
}
```

Reglas (las comprueba `validarConcurso` en `scripts/observaciones/concursos.mjs`):
- **Ningún dato personal**: ni nombres de participantes, ni clubes de una sola
  persona, ni puestos individuales. Solo totales del concurso por especie.
  Campos prohibidos: `participante`, `participantes_lista`, `nombre`,
  `deportista`, `pescador`, `clasificacion`, `ganador`, `club_ganador`.
- `fuente` debe existir en `fuentes.json` con `reutilizacion` `permitida` o
  `permiso`.
- `especie` es un id de `assets/datos/especies.json` o `null` (con
  `nombre_publicado` tal cual lo publica la fuente: nunca adivinar la especie).
- Coordenadas de la zona con 2 decimales como mucho (zona de concurso, no
  puesto).
