<!-- SINTESIS fecha=2026-11-08 hasta_commit=0de7b7ef7aa3388575beff0211a7e3a7bbbac53d -->

## 🛠 Trabajo interno (calibración y datos)
El robot de cámaras caídas pasó el 2026-11-08 (04:55 UTC) con datos frescos de `camaras-estado.json`. En rojo: alicante y torreblanca (`origen_404`, desde el 7 y el 11 de octubre), comillas y sanvicente (`origen_522`, sin poder verificar porque cantabria.es no responde desde la rutina). Pasaia, Bakio y Mundaka están congeladas de noche, algo esperable. Xilxes volvió a dar 200 (fallo puntual). No se cambió código. Próxima pasada: buscar sustituto para Alicante y Torreblanca y revisar cantabria.es de día.
Desde la última síntesis no hay entradas de calibración ni de pasadas de corrientes, presión o caudal en ROBOT.md.
**Cámaras nuevas encontradas:** 0
**Términos de búsqueda:** el robot probó `AlicantePostiguet`, `Alicante1` y `Postiguet` (Turisme CV, Alicante); todos dieron 404. La única cámara de Alicante que sigue viva es `AlicanteExplanada`, pero no tiene mar a la vista, así que no sirve. Ningún término funcionó por primera vez ni apareció un tipo de dueño nuevo.

## 🧪 Experiencia de usuario y patrones de uso
**Robot de experiencia de usuario:** no le tocaba pasar hoy y no hay entrada suya.
**Robot de patrones de uso:** su última entrada es del 2026-11-07, con muestra pequeña (11 perfiles, 3 usuarios activos en 7 días, 8 en 28 días). Abandono: de 10 perfiles con más de 7 días, 3 nunca hicieron nada y 5 llevan 7 días sin actividad. Capas más probadas en 28 días: clorofila, isóbatas y sustrato (5 usuarios cada una). Diario: 1 solo usuario activo; grupos: nada en 28 días. Hay intención de pago (13 `iniciar_checkout` de 3 usuarios, 2 `acepta_condiciones_pago` de 1 usuario el 2026-11-05) pero no hay evento de pago completado.
Propuestas, ninguna aplicada:
1. Revisar con Mikel si la entrada al diario es visible y está explicada.
2. Mantener las capas de mar y dar un acceso claro al aviso de que empiezan apagadas.
3. Medir el embudo con `suscripciones.primer_pago_en` antes de tocar `suscripcion.html`.
4. No tocar el SOS.
También propone añadir los eventos `cambiar_modalidad` y `ver_capa_flota`.

## 🔎 Trabajo externo (investigación de contenido)
No hay entradas de buenas prácticas de otras apps ni de estudios institucionales en las últimas 24 h.
**Robot de especies:** no le tocaba pasar hoy (corre los jueves).

## 🆕 Nuevas fuentes encontradas, pendientes de validar
Ninguna fuente nueva desde la última síntesis.
