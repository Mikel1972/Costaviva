# start.ps1
# Arranca Costa Viva en local con Wrangler (el CLI de Cloudflare), incluyendo
# las funciones de backend (/prevision, /webcam/<slug>), y abre el navegador.
#
# Requisito: Node.js instalado (https://nodejs.org). Si no lo tienes, este
# script te avisa en vez de fallar en silencio.
#
# Uso: clic derecho sobre este archivo > "Ejecutar con PowerShell"
# (o, para que se abra solo al encender el ordenador, ver instrucciones al
# final de este mismo archivo)

$ErrorActionPreference = "Stop"
$carpetaApp = $PSScriptRoot

Write-Host "Costa Viva — arrancando entorno local..." -ForegroundColor Cyan

# 1) Comprobar Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js no está instalado o no está en el PATH." -ForegroundColor Red
    Write-Host "Instálalo desde https://nodejs.org (versión LTS) y vuelve a ejecutar este script." -ForegroundColor Yellow
    Read-Host "Pulsa Enter para cerrar"
    exit 1
}

# 2) Ir a la carpeta de la app
Set-Location $carpetaApp

# 3) Arrancar Wrangler (npx lo descarga solo la primera vez, no hace falta
#    instalarlo a mano) en segundo plano, y abrir el navegador cuando el
#    servidor esté listo
Write-Host "Arrancando servidor local (wrangler pages dev)..." -ForegroundColor Cyan

$proceso = Start-Process -FilePath "npx" `
    -ArgumentList "wrangler pages dev . --port 8788" `
    -PassThru -NoNewWindow

# Esperar a que el servidor responda antes de abrir el navegador
$listo = $false
$intentos = 0
while (-not $listo -and $intentos -lt 30) {
    Start-Sleep -Seconds 1
    $intentos++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8788" -UseBasicParsing -TimeoutSec 1
        if ($resp.StatusCode -eq 200) { $listo = $true }
    } catch {
        # todavía no está listo, seguimos esperando
    }
}

if ($listo) {
    Write-Host "Listo. Abriendo navegador..." -ForegroundColor Green
    Start-Process "http://localhost:8788"
} else {
    Write-Host "El servidor está tardando más de lo normal. Abre http://localhost:8788 manualmente cuando termine de arrancar en la otra ventana." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deja esta ventana abierta mientras uses la app (aquí corre el servidor)." -ForegroundColor DarkGray
Write-Host "Para pararla: cierra esta ventana o pulsa Ctrl+C." -ForegroundColor DarkGray

Wait-Process -Id $proceso.Id

# ---------------------------------------------------------------------------
# Para que esto se ejecute solo al encender el ordenador (Windows):
#
# 1. Win + R > escribe "shell:startup" > Enter (abre tu carpeta de Inicio)
# 2. Crea un acceso directo a este archivo (start.ps1) dentro de esa carpeta
# 3. Clic derecho sobre el acceso directo > Propiedades > en "Destino", pon:
#    powershell.exe -ExecutionPolicy Bypass -File "RUTA\A\start.ps1"
#    (sustituye RUTA\A por la ruta real donde tengas esta carpeta)
#
# Así, cada vez que enciendas el ordenador, se abrirá una ventana de
# PowerShell arrancando el servidor y el navegador se abrirá solo.
# ---------------------------------------------------------------------------
