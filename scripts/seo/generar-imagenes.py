#!/usr/bin/env python3
"""scripts/seo/generar-imagenes.py

Imágenes para compartir (Open Graph, 1200x630) y los iconos de la app (PWA),
dibujadas con Pillow a partir del logo y los colores "Amanecer"
(assets/css/costaviva.css) y las letras Unbounded y Manrope del robot de
Instagram (scripts/marketing/fuentes, licencia OFL). Sin IA y sin red.

    python3 scripts/seo/generar-imagenes.py

Se ejecuta a mano y se hace commit de lo que sale (assets/og/*.jpg y
assets/iconos/*.png). Volver a ejecutarlo si cambia una región
(REGIONES_MAREAS en functions/_lib/seo/datos.js) o el logo: el test
test/seo-extra.test.js avisa si falta la imagen de alguna región.
Requiere Pillow con libraqm (pip install pillow).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
FUENTES = RAIZ / "scripts" / "marketing" / "fuentes"
OG = RAIZ / "assets" / "og"
ICONOS = RAIZ / "assets" / "iconos"

MAR = (11, 30, 63)
MAR_2 = (19, 48, 94)
GRIS_MAR = (169, 180, 208)
BLANCO = (255, 255, 255)
NARANJA = (255, 138, 61)
MAGENTA = (232, 70, 124)
VIOLETA = (123, 63, 228)
SOL = (255, 194, 75)
# --degradado-texto (letras sobre --mar)
TEXTO_GRAD = [(255, 176, 103), (255, 127, 168), (183, 155, 255)]

# Mismas regiones y slugs que REGIONES_MAREAS (functions/_lib/seo/datos.js).
REGIONES = [
    ("pais-vasco", "el País Vasco"),
    ("cantabria", "Cantabria"),
    ("asturias", "Asturias"),
    ("galicia", "Galicia"),
    ("portugal", "Portugal"),
    ("mediterraneo", "el Mediterráneo"),
    ("golfo-de-cadiz", "el Golfo de Cádiz"),
    ("canarias", "Canarias"),
]


def fuente(nombre, tam, peso):
    f = ImageFont.truetype(str(FUENTES / f"{nombre}-latin.woff2"), tam)
    f.set_variation_by_axes([peso])
    return f


def bezier(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def logo(lado):
    """El logo de la cabecera (LOGO en functions/_lib/seo/base.js, viewBox 40),
    dibujado a 4x y reducido para que salga suave."""
    k = lado * 4 / 40
    im = Image.new("RGBA", (lado * 4, lado * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda pts: [(x * k, y * k) for x, y in pts]
    d.ellipse([1 * k, 1 * k, 39 * k, 39 * k], fill=NARANJA)
    cuerpo = bezier((9, 17), (13, 10.5), (23, 10.5), (28, 17)) + bezier((28, 17), (23, 23.5), (13, 23.5), (9, 17))
    d.polygon(P(cuerpo), fill=BLANCO)
    d.polygon(P([(27.5, 17), (33.5, 12.5), (33.5, 21.5)]), fill=BLANCO)
    d.ellipse([(13.5 - 1.4) * k, (16 - 1.4) * k, (13.5 + 1.4) * k, (16 + 1.4) * k], fill=MAGENTA)
    ola = (bezier((5, 28), (8.5, 24.8), (11.5, 24.8), (15, 28)) + bezier((15, 28), (18.5, 31.2), (21.5, 31.2), (25, 28))
           + bezier((25, 28), (28.5, 24.8), (31.5, 24.8), (35, 28)))
    ancho = 3 * k
    d.line(P(ola), fill=MAR, width=round(ancho), joint="curve")
    for x, y in [(5, 28), (35, 28)]:
        d.ellipse([x * k - ancho / 2, y * k - ancho / 2, x * k + ancho / 2, y * k + ancho / 2], fill=MAR)
    return im.resize((lado, lado), Image.LANCZOS)


def degradado(ancho, alto, colores):
    """Degradado horizontal entre varios colores."""
    im = Image.new("RGB", (ancho, alto))
    px = im.load()
    tramos = len(colores) - 1
    for x in range(ancho):
        t = x / max(1, ancho - 1) * tramos
        i = min(int(t), tramos - 1)
        f = t - i
        c = tuple(round(colores[i][j] + (colores[i + 1][j] - colores[i][j]) * f) for j in range(3))
        for y in range(alto):
            px[x, y] = c
    return im


def texto_degradado(base, xy, texto, f):
    caja = ImageDraw.Draw(base).textbbox(xy, texto, font=f)
    w, h = caja[2] - caja[0], caja[3] - caja[1]
    mascara = Image.new("L", base.size, 0)
    ImageDraw.Draw(mascara).text(xy, texto, font=f, fill=255)
    capa = Image.new("RGB", base.size, MAR)
    capa.paste(degradado(w + 2, h + 2, TEXTO_GRAD), (caja[0], caja[1]))
    base.paste(capa, (0, 0), mascara)


def partir(texto, f, ancho_max, draw):
    palabras, lineas, actual = texto.split(), [], ""
    for p in palabras:
        prueba = f"{actual} {p}".strip()
        if draw.textlength(prueba, font=f) <= ancho_max:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas


def imagen_og(nombre, antetitulo, titulo, sub):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), MAR)
    d = ImageDraw.Draw(im)
    # Mar más claro abajo y el "sol" de amanecer arriba a la derecha.
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(round(MAR[j] + (MAR_2[j] - MAR[j]) * t) for j in range(3)))
    base = im.convert("RGBA")
    for r, color in [(250, (*VIOLETA, 40)), (185, (*MAGENTA, 70)), (140, (*NARANJA, 120)), (110, (*SOL, 255))]:
        capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(capa).ellipse([1010 - r, 120 - r, 1010 + r, 120 + r], fill=color)
        base = Image.alpha_composite(base, capa)
    im = base.convert("RGB")
    d = ImageDraw.Draw(im)
    # Franja de amanecer abajo (decorativa, sin texto encima).
    im.paste(degradado(W, 14, [NARANJA, MAGENTA, VIOLETA]), (0, H - 14))

    lg = logo(84)
    im.paste(lg, (72, 64), lg)
    texto_degradado(im, (172, 84), "COSTAVIVA", fuente("Unbounded", 40, 800))

    d = ImageDraw.Draw(im)
    f_ante = fuente("Manrope", 30, 800)
    d.text((72, 214), antetitulo.upper(), font=f_ante, fill=SOL)
    f_tit = fuente("Unbounded", 64, 800)
    lineas = partir(titulo, f_tit, 760, d)
    if len(lineas) > 2:
        f_tit = fuente("Unbounded", 52, 800)
        lineas = partir(titulo, f_tit, 820, d)
    y = 262
    for ln in lineas[:3]:
        d.text((72, y), ln, font=f_tit, fill=BLANCO)
        y += f_tit.size + 18
    f_sub = fuente("Manrope", 32, 600)
    for ln in partir(sub, f_sub, 1040, d)[:2]:
        d.text((72, y + 14), ln, font=f_sub, fill=GRIS_MAR)
        y += 44
    d.text((72, H - 76), "costaviva.org", font=fuente("Manrope", 28, 800), fill=BLANCO)
    OG.mkdir(parents=True, exist_ok=True)
    im.save(OG / f"{nombre}.jpg", "JPEG", quality=86, optimize=True, progressive=True)


def iconos():
    ICONOS.mkdir(parents=True, exist_ok=True)
    # "any": el logo solo, con transparencia (como en la cabecera).
    for lado in (192, 512):
        logo(lado).save(ICONOS / f"icono-{lado}.png", optimize=True)
    # "maskable" y Apple: fondo --mar entero (Android recorta en círculo o
    # squircle; iOS pinta de negro lo transparente). Logo dentro de la zona
    # segura (el 80 % central en maskable).
    for nombre, lado, proporcion in [("icono-maskable-512", 512, 0.62), ("apple-touch-icon", 180, 0.78)]:
        im = Image.new("RGBA", (lado, lado), (*MAR, 255))
        lg = logo(round(lado * proporcion))
        o = (lado - lg.size[0]) // 2
        im.paste(lg, (o, o), lg)
        im.convert("RGB").save(ICONOS / f"{nombre}.png", optimize=True)


if __name__ == "__main__":
    imagen_og("costaviva", "Pesca desde costa", "Condiciones de pesca en tiempo real",
              "Oleaje, viento, mareas, índice de pesca y webcams de la costa de España y Portugal")
    imagen_og("spots", "Spots de pesca", "Dónde pescar hoy en la costa",
              "Especies de temporada, tipo de fondo, profundidad y el índice de pesca de hoy")
    imagen_og("especies", "Especies", "Tallas mínimas, vedas y temporada",
              "Qué se pesca cada mes desde costa, en embarcación y en submarina")
    imagen_og("mareas", "Mareas hoy", "Pleamar y bajamar spot a spot",
              "Horas de marea, coeficiente y oleaje del día en la costa de España y Portugal")
    for slug, nombre in REGIONES:
        imagen_og(f"region-{slug}", "Pesca y mareas", f"Pescar en {nombre}",
                  "Spots, especies de temporada, mareas y condiciones de hoy")
    iconos()
    print("Imágenes en assets/og/ y assets/iconos/")
