# Rutina diaria: Claude etiqueta las olas de las cámaras

Pedido de Mikel (2026-10-08): "puedes calibrar tú la cámara. Debes, de hecho".
Claude MIRA fotogramas de las cámaras y anota la altura de la ola que ve; esas
etiquetas calibran la conversión espuma → metros (`calibracion.mjs`, peso 2).

**Regla de coste:** esto corre como **rutina del plan de Claude** (una sesión de
Claude Code programada), nunca con `claude -p` en GitHub Actions ni con la API
de pago. Los scripts no usan IA: solo bajan fotogramas y calculan. El único
"modelo" es la propia sesión mirando las imágenes con la herramienta de leer
ficheros.

## Pasos

1. **Lote.** Desde una rama nueva `robot/etiquetas-olas-AAAA-MM-DD` sobre
   `main` (con ese prefijo, `robot-diseno-pr.yml` abre la PR al subirla: las
   rutinas no tienen `gh` ni el conector de GitHub):

   ```sh
   L=<scratchpad>/lote            # FUERA del repo: las imágenes no se suben
   python3 scripts/oleaje-camaras/boyas-copernicus.py --salida $L/../boyas.json
   node scripts/oleaje-camaras/preparar-lote-etiquetado.mjs --dir $L --boyas $L/../boyas.json
   ```

   Captura un fotograma de cada encuadre de las 13 cámaras (tarda ~2 min) y
   lo acumula en `$L/lote.json`. Repetirlo 2-4 veces separadas ≥ 30 min da
   franjas distintas (hace falta ≥ 2 franjas de 2 h para que las etiquetas
   de Claude cuenten). Con la migración `20261008180000` aplicada, además:
   `--origen bucket --horas 24` baja las miniaturas que el robot ya guardó
   hoy y que aún no tienen etiqueta de Claude.

   Solo con luz (sol > 8°: más o menos 08:00-16:30 UTC en otoño).

2. **Mirar cada fotograma** (`$L/<id>.jpg`; en las fotos fijas también
   `<id>-grande.jpg`, mejor para ver detalles). Para elegir la banda:
   - Escala: personas, surfistas, barcos, rocas conocidas, el muelle. La
     altura de la cara de la ola (de la base al labio), no la espuma.
   - Bandas: `<0.5`, `0.5-1`, `1-2`, `2-3`, `>3` o `no_se_sabe` (noche,
     niebla, gotas, contraluz que no deja ver, sin zona de rompiente a la
     vista, encuadre que no enseña el mar).
   - Confianza: `alta` (escala clara y olas bien vistas), `media`, `baja`
     (sin escala, lejos, borroso). Las `baja` pesan 1 en vez de 2.
   - Etiquetar lo que SE VE, no lo que dicen la boya o el modelo (vienen en
     `lote.json` solo para detectar disparates). Si la imagen y la boya no
     cuadran, mandar la imagen, con la confianza que toque.
   - Ser conservador: ante la duda entre dos bandas, la confianza baja.

3. **Encuadre.** Solo calibran los fotogramas en el encuadre de referencia:
   - `estado: "ok"` en `lote.json`: ya lo es.
   - `estado: "otro_encuadre"` (fotos fijas): mirar `<id>-roi.jpg` (arriba el
     fotograma, abajo la referencia, el ROI en rojo). Solo si es el MISMO
     encuadre (mismo horizonte, mismas rocas y edificios en el mismo sitio),
     el ROI cae en agua de la zona de rompientes y no hay brillos de sol
     dentro, se añade `--verificado`. Ejemplos del 2026-10-08: Mundaka
     a contraluz suave, sí; Sopela con otro zoom (el ROI caía en mar
     abierto), no; Bakio con el sol de cara (brillos en el ROI), no.

4. **Anotar** (una línea por fotograma en
   `datos-robots/oleaje-camaras/etiquetas-claude.jsonl`):

   ```sh
   node scripts/oleaje-camaras/preparar-lote-etiquetado.mjs --anotar --dir $L \
     --id <id> --banda "1-2" --confianza media --motivo "dos surfistas dan escala: caras de ~1,5 m" [--verificado]
   ```

   El motivo, corto y concreto (la pista visual usada). Se etiquetan también
   los que no calibran (espuma 0, `dudosa`, `no_se_sabe`): son el registro.

5. **Calibrar y comprobar:**

   ```sh
   node scripts/oleaje-camaras/medir-espuma.mjs --solo-calibrar
   node --test test/oleaje-camaras.test.js
   ```

   Reescribe `calibracion.json` (por encuadre: `a`, `p`, `n`,
   `nEtiquetasClaude`, `franjasClaude`, `errorRel`; y `sustitucion` por
   cámara) y dice qué cámaras sustituyen ya al modelo.

6. **Commit y push** de `etiquetas-claude.jsonl` y `calibracion.json`
   (nunca imágenes) a `robot/etiquetas-olas-AAAA-MM-DD`. El asunto del
   commit, "Etiquetas de Claude AAAA-MM-DD", es el título de la PR, y el
   cuerpo del commit es su descripción: cuántos fotogramas por cámara, la
   distribución de bandas, las cámaras que pasan a sustituir al modelo (o
   dejan de hacerlo) y lo raro que se haya visto (cámaras movidas, ROIs que
   ya no caen en la rompiente). `robot-diseno-pr.yml` abre la PR (o un Issue
   con el enlace si GitHub no le deja). No fusionar: la revisa Mikel.

## Cuánto pesa cada cosa

| Origen | Peso |
| --- | --- |
| Foto etiquetada por Mikel (`etiquetar-olas.html`) | 5 |
| "Ola real que veo" desde el spot | 3 |
| **Claude mirando el fotograma** | **2** (1 con confianza baja) |
| Lectura automática con boya de Copernicus | 1 |
| Lectura automática con el modelo | 0,5 |

Una cámara ruidosa sustituye al modelo con 5 etiquetas de personas, o con
etiquetas de Claude que valgan lo mismo a razón de 5/8 cada una (8 solas, o
p. ej. 3 de Mikel + 4 de Claude) **y** de al menos 2 franjas de 2 h **y**
con una calibración que cuadre con ellas (error ≤ 75 %), o con ≥ 3 días de
alturas variadas (`camaraSustituyeModelo()`).

## Texto de la rutina (para crearla en el plan de Claude)

> Eres la rutina diaria de etiquetado de olas de Costaviva (repo
> Mikel1972/costaviva). Trabaja SIN la API de pago: tú miras las imágenes en
> esta sesión. Crea la rama `robot/etiquetas-olas-<fecha de hoy AAAA-MM-DD>`
> desde `origin/main`. Lee `scripts/oleaje-camaras/RUTINA_ETIQUETADO.md` y
> síguelo: (1) prepara el lote en tu carpeta temporal (fuera del repo) con
> `boyas-copernicus.py` y `preparar-lote-etiquetado.mjs`, y repite la
> captura dos veces más separadas al menos 30 minutos, siempre con luz;
> (2) mira cada imagen con la herramienta de leer ficheros y decide la banda
> de altura de la ola que rompe (`<0.5`, `0.5-1`, `1-2`, `2-3`, `>3` o
> `no_se_sabe`), con confianza y un motivo corto basado en lo que se ve
> (personas, barcos, rocas, caras de ola), no en la boya ni en el modelo;
> sé conservador; (3) en los fotogramas `otro_encuadre`, mira `<id>-roi.jpg`
> y usa `--verificado` solo si es el mismo encuadre que la referencia y el ROI
> cae en la zona de rompientes sin brillos; (4) anota cada fotograma con
> `preparar-lote-etiquetado.mjs --anotar`; (5) ejecuta
> `node scripts/oleaje-camaras/medir-espuma.mjs --solo-calibrar` y
> `node --test test/oleaje-camaras.test.js`; (6) haz commit en español de
> `datos-robots/oleaje-camaras/etiquetas-claude.jsonl` y
> `datos-robots/oleaje-camaras/calibracion.json` (nunca imágenes) con el
> asunto "Etiquetas de Claude <fecha>" y, en el cuerpo del commit:
> fotogramas por cámara, distribución de bandas, qué cámaras sustituyen ya
> al modelo y cualquier cámara movida o ROI que ya no vea la rompiente; sube
> la rama (el workflow `robot-diseno-pr.yml` abre la PR por ti). No toques
> `main`, no fusiones nada, no ejecutes SQL y no escribas en la base de
> datos de producción. Si no hay luz o ninguna cámara responde, termina sin
> commit y dilo.
