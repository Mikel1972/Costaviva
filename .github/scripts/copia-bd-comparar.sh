#!/usr/bin/env bash
# Compara los recuentos de producción con los de la copia restaurada
# (copia-bd.yml). Uso: copia-bd-comparar.sh prod.tsv base.tsv restaurada.tsv
#   prod.tsv        filas en producción justo antes de la copia
#   base.tsv        filas en la base de prueba ANTES de restaurar (tablas
#                   internas de Supabase que la imagen ya trae llenas: no se
#                   comparan)
#   restaurada.tsv  filas en la base de prueba después de restaurar
# Falla si una tabla con datos en producción queda vacía o con más de un 5 %
# (y más de 5 filas) de diferencia: entre el recuento y la copia pasan unos
# segundos y alguien puede haber escrito. El repo es PÚBLICO: solo se
# escriben nombres de tabla y porcentajes, nunca cuántas filas hay.
set -euo pipefail
awk -F'\t' '
  FILENAME == ARGV[1] { prod[$1] = $2; next }
  FILENAME == ARGV[2] { base[$1] = $2; next }
  { rest[$1] = $2 }
  END {
    malas = 0; vistas = 0
    for (t in prod) {
      if (base[t] + 0 > 0) continue
      vistas++
      p = prod[t] + 0; r = (t in rest) ? rest[t] + 0 : -1
      if (r < 0) { print "FALTA la tabla " t " en la copia"; malas++; continue }
      d = p - r; if (d < 0) d = -d
      if (p > 0 && r == 0) { print "VACÍA en la copia: " t; malas++; continue }
      if (d > 5 && d > p * 0.05) { printf "DIFERENCIA en %s: %.0f %%\n", t, 100 * d / p; malas++ }
    }
    printf "%d tablas comparadas, %d con problemas.\n", vistas, malas
    if (vistas == 0) { print "No se ha comparado ninguna tabla."; exit 1 }
    exit malas > 0
  }' "$1" "$2" "$3"
