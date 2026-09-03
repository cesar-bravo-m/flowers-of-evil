<#
.SYNOPSIS
    Run Les Fleurs du mal locally, with edit mode available.

.DESCRIPTION
    Starts tools/dev-server.mjs and opens the site in your browser.

    The site itself needs no server -- index.html opens straight off disk. This
    is for edit mode, which needs somewhere to write to: the guard in index.html
    only injects the authoring code when the page is served over http from
    localhost, and edit.js waits for /api/edit/status to answer before it shows
    anything at all.

    Ctrl+C stops the server.

    If the server is already running on this port, the script just opens the
    browser at it rather than starting a second one -- two editing tabs writing
    to the same poem file would race.

.PARAMETER Port
    Port to serve on. Defaults to 8181.

.PARAMETER NoBrowser
    Start the server without opening a browser window.

.EXAMPLE
    .\dev.ps1

.EXAMPLE
    .\dev.ps1 -Port 9000 -NoBrowser

.NOTES
    To check the syllable counter after changing syllables.js:
      node tools/selftest.mjs        hand-verified cases, all three languages
      node tools/check-meter.mjs     score French against the whole corpus
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8181,

    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root   = $PSScriptRoot
$server = Join-Path $root 'tools\dev-server.mjs'
$url    = "http://localhost:$Port/"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node is not on PATH. Install Node.js, then run this again."
}
if (-not (Test-Path -LiteralPath $server)) {
    throw "Cannot find $server -- run this script from inside the repository."
}

# Is something already listening? If it is our own server, use it; if it is
# somebody else's, say so rather than failing obscurely inside node.
#
# -NoProxy because a loopback request has no business going through one, and
# the timeout is generous because the first web request of a PowerShell session
# pays a couple of seconds to warm the HTTP stack -- too short a one here reads
# a healthy server as a stranger.
function Test-OurServer {
    try {
        $r = Invoke-RestMethod -Uri "${url}api/edit/status" -TimeoutSec 5 -NoProxy
        return [bool]$r.ok
    } catch {
        return $false
    }
}

$listening = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listening) {
    if (Test-OurServer) {
        Write-Host "Already serving on port $Port." -ForegroundColor Yellow
        if (-not $NoBrowser) { Start-Process $url }
        return
    }
    throw "Port $Port is in use by something else. Pass -Port with another number."
}

Write-Host "Les Fleurs du mal" -ForegroundColor DarkRed
Write-Host "  $url"
Write-Host "  edit mode: the pencil at the foot of the sidebar"
Write-Host "  Ctrl+C to stop"
Write-Host ""

$proc = Start-Process -FilePath 'node' `
                      -ArgumentList @($server, "--port=$Port") `
                      -WorkingDirectory $root `
                      -NoNewWindow -PassThru

try {
    if (-not $NoBrowser) {
        # Wait for it to actually answer -- opening the browser at a port that
        # is not up yet just shows a connection error.
        $deadline = (Get-Date).AddSeconds(10)
        while ((Get-Date) -lt $deadline) {
            if ($proc.HasExited) { break }
            if (Test-OurServer) { Start-Process $url; break }
            Start-Sleep -Milliseconds 200
        }
    }
    Wait-Process -Id $proc.Id
} finally {
    if (-not $proc.HasExited) {
        Write-Host "`nStopping the server..." -ForegroundColor DarkGray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}
