# Costa Viva — piloto instalable

Estructura lista para desplegar en Cloudflare Pages, igual que tus otros proyectos:

```
costa-viva-app/
├── index.html              # La app (mapa + datos)
├── login.html               # Pantalla de acceso (Supabase, desactivada por ahora)
├── manifest.json             # Para que se pueda "Añadir a pantalla de inicio"
├── icon.svg                   # Icono de la app
├── start.ps1                   # Arranca todo en local con un clic (Windows)
└── functions/
    ├── prevision.js           # Backend real: scrapea Todosurf en servidor,
    │                           # accesible en /prevision (no /functions/prevision)
    └── webcam/
        └── [slug].js           # Proxy de imágenes de webcam en servidor,
                                  # accesible en /webcam/<slug>
```

## Desplegar en Cloudflare Pages

1. Sube esta carpeta a un repo de GitHub (nuevo o dentro de uno existente)
2. Conéctalo en Cloudflare Pages como ya haces con Etxeapala/Pólizas.ai — sin build command, la carpeta raíz es la carpeta de salida (no hay paso de compilación, es HTML+JS plano)
3. Cloudflare detecta `functions/` automáticamente y publica `/prevision` y `/webcam/<slug>`

## Arrancar en local (Windows, con un clic)

`start.ps1` arranca el servidor local (con las funciones de backend funcionando de verdad, vía Wrangler) y abre el navegador solo.

**Uso manual:** clic derecho sobre `start.ps1` → "Ejecutar con PowerShell"

**Para que se abra solo al encender el ordenador:** instrucciones detalladas al final del propio archivo `start.ps1` (crear un acceso directo en la carpeta de Inicio de Windows).

**Nota honesta:** no he podido validar `start.ps1` con un intérprete de PowerShell real (no está disponible en mi entorno) — solo comprobación básica de sintaxis (llaves y comillas balanceadas). La primera ejecución en tu máquina es la prueba real.

Requisito: Node.js instalado (el script te avisa si falta).

## Cómo se comporta

- Al abrir la app, intenta pedir datos reales a `/prevision`. Si el despliegue funciona, verás los datos de Todosurf del momento en vez de los fijos de hoy (24 ago 2026) que trae por defecto
- Si `/prevision` no responde (por ejemplo, abriendo `index.html` suelto sin desplegar), la app no se rompe — se queda con los datos de respaldo
- Las webcams de Mundaka/Bakio/Sopelana se piden a `/webcam/<slug>` (nuestro propio proxy) — si el proveedor original ha cambiado la URL o la bloquea, el panel avisa en vez de romperse
- Los índices de mar combinado se calculan en el momento; caudal de ríos, nubosidad, precipitación y rayos siguen sin datos reales — fuentes pendientes de conectar (URA/Euskalmet), documentadas en el concepto principal

## Acceso con Supabase (desactivado en este primer despliegue)

`login.html` y el bloque de comprobación de sesión en `index.html` están listos pero **comentados** — se decidió desplegar primero sin login para validar que el backend (scraper + webcams) funciona de verdad contra internet real, antes de invertir tiempo en montar Supabase.

Cuando quieras activar el acceso:
1. Crea un proyecto en [supabase.com](https://supabase.com) (gratis)
2. Crea una tabla `perfiles` con un campo `aprobado` (booleano) — mismo patrón que Etxeapala (Root/Superadmin/Member + aprobación manual)
3. Rellena `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `login.html` y en el bloque comentado de `index.html`
4. Descomenta ese bloque en `index.html`

## Instalar en el móvil

Una vez desplegado con una URL real (`https://algo.pages.dev`), desde el móvil:
- **iOS (Safari):** compartir → "Añadir a pantalla de inicio"
- **Android (Chrome):** menú → "Instalar aplicación" (aparecerá solo, por el `manifest.json`)

Abre a pantalla completa, sin barra de navegador — como una app normal.
