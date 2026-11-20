# Histórico de primera venta en las lonjas de bajura de Galicia

**Fonte: Xunta de Galicia – pescadegalicia.gal** ("Principais indicadores de
vendas nas lonxas"). Su aviso legal permite reutilizar los datos citando la
fuente y sin desnaturalizarlos.

- `<año>.csv.gz`: por día, zona costera de bajura y especie, los kg y euros
  de **peces y cefalópodos**. Columnas: `fecha,zona,grupo,especie,kg,importe`.
  Nombres de especie y grupo tal cual la fuente; los números son la suma de
  las lonjas de cada zona.
- Zonas: campo `zona` de `scripts/lonjas/lonjas-galicia.json`. Fuera las
  lonjas de la flota de altura (Vigo, Marín, Lonja Coruña S.A., Burela y
  Celeiro) y el mercado de Pontevedra: lo que venden no se pescó en la zona.
- `estado.json`: qué años están completos y qué días fallaron.
- Lo escribe `scripts/lonjas/historico-galicia.mjs`
  (`.github/workflows/lonjas-historico.yml`), sin IA, cada noche.
