# Costa Viva — piloto instalable

Estructura lista para desplegar en Cloudflare Pages, igual que tus otros proyectos:

```
costa-viva-app/
├── index.html              # La app (mapa + datos)
├── login.html              # Pantalla de acceso (Supabase, activa)
├── alarma.html             # Alarma SOS: detección de caída + aviso manual
├── diario.html             # Cuaderno de pesca (salidas, capturas, fotos)
├── manifest.json           # Para que se pueda "Añadir a pantalla de inicio"
├── icon.svg                # Icono de la app
├── start.ps1               # Arranca todo en local con un clic (Windows)
├── supabase/
│   ├── schema.sql                  # Tabla perfiles + RLS + trigger de alta
│   └── schema_diario_alarma.sql    # salidas_pesca/capturas/contactos_emergencia/alertas_sos + RLS
└── functions/                      # Cloudflare Pages Functions (edge, sin build step)
    ├── prevision.js         # Oleaje/viento/marea/corriente reales (Open-Meteo + boyas Puertos del Estado) — /prevision
    ├── luna.js              # Fase y posición lunar por coordenadas — /luna
    ├── rayos-imagen.js      # Proxy del mapa de rayos de AEMET — /rayos-imagen
    ├── sos-alerta.js        # Envía el aviso SOS a los contactos de emergencia — /sos-alerta (POST, requiere token de sesión)
    └── webcam/
        └── [slug].js        # Proxy de imágenes de webcam — /webcam/<slug>
```

Ver `CLAUDE.md` para el detalle de cada endpoint, el proyecto Supabase real y las convenciones de despliegue.

## Desplegar en Cloudflare Pages

1. Sube esta carpeta a un repo de GitHub (nuevo o dentro de uno existente)
2. Conéctalo en Cloudflare Pages como ya haces con Etxeapala/Pólizas.ai — sin build command, la carpeta raíz es la carpeta de salida (no hay paso de compilación, es HTML+JS plano)
3. Cloudflare detecta `functions/` automáticamente y publica `/prevision`, `/luna`, `/rayos-imagen`, `/sos-alerta` y `/webcam/<slug>`

## Arrancar en local (Windows, con un clic)

`start.ps1` arranca el servidor local (con las funciones de backend funcionando de verdad, vía Wrangler) y abre el navegador solo.

**Uso manual:** clic derecho sobre `start.ps1` → "Ejecutar con PowerShell"

**Para que se abra solo al encender el ordenador:** instrucciones detalladas al final del propio archivo `start.ps1` (crear un acceso directo en la carpeta de Inicio de Windows).

**Nota honesta:** no he podido validar `start.ps1` con un intérprete de PowerShell real (no está disponible en mi entorno) — solo comprobación básica de sintaxis (llaves y comillas balanceadas). La primera ejecución en tu máquina es la prueba real.

Requisito: Node.js instalado (el script te avisa si falta).

## Cómo se comporta

- Al abrir la app, intenta pedir datos reales a `/prevision`. Si el despliegue funciona, verás oleaje y viento calculados a partir de Open-Meteo (Marine + Forecast API, gratis y sin API key) en vez de los fijos de hoy (24 ago 2026) que trae por defecto. Ya no se scrapea Todosurf: pedimos altura/periodo/dirección de ola y viento en crudo por coordenadas, y calculamos nosotros el resto (rumbos en texto, índice de mar combinado)
- Si `/prevision` no responde (por ejemplo, abriendo `index.html` suelto sin desplegar), la app no se rompe — se queda con los datos de respaldo
- Las webcams de Mundaka/Bakio/Sopelana se piden a `/webcam/<slug>` (nuestro propio proxy) y se refrescan solas cada minuto mientras el panel está abierto (indicador "EN DIRECTO") — si el proveedor original ha cambiado la URL o la bloquea, el panel avisa en vez de romperse
- Temperatura del agua, nubosidad y precipitación vienen de Open-Meteo; marea (altura, tendencia, próxima pleamar/bajamar) y corriente marina también, calculadas a partir de la curva horaria real del modelo. Además hay 3 boyas reales de Puertos del Estado (Gijón, Bilbao-Vizcaya, Pasaia II) con oleaje y temperatura MEDIDOS, no modelados
- Rayos: botón ⚡ en el mapa, muestra el mapa nacional de AEMET (imagen, actualizada cada hora, sin API key). AEMET no publica coordenadas por rayo en abierto — comprobado tanto en su API oficial como en el código de su propia web — así que no es una capa de puntos de esta zona, es una imagen de referencia de toda España
- Los índices de mar combinado se calculan en el momento; caudal de ríos es real en Sella, Besaya, Pas, Asón, Eo, Júcar, Turia, Mijares, Segura y Lagares (Confederaciones Hidrográficas + Augas de Galicia) — los ríos vascos (Lea, Oka, Butroe...) siguen en `null` porque URA/Bizkaia bloquea el acceso automático a su SAIH

## Acceso con Supabase (activo)

`login.html` y el bloque de comprobación de sesión en `index.html` (y en `alarma.html`/`diario.html`) están activos de verdad: sin sesión, la app redirige a `/login.html`. El proyecto Supabase real es `imncbmizxkorotpeisic` — mismo patrón que Etxeapala (tabla `perfiles` con `aprobado` booleano, aprobación manual desde el Table Editor).

Ver `CLAUDE.md` para el detalle de tablas, políticas RLS y endpoints que dependen de la sesión (en particular `functions/sos-alerta.js`, que maneja el aviso SOS).

## Instalar en el móvil

Una vez desplegado con una URL real (`https://algo.pages.dev`), desde el móvil:
- **iOS (Safari):** compartir → "Añadir a pantalla de inicio"
- **Android (Chrome):** menú → "Instalar aplicación" (aparecerá solo, por el `manifest.json`)

Abre a pantalla completa, sin barra de navegador — como una app normal.
