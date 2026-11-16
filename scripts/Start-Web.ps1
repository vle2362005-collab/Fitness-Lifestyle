[CmdletBinding()]
param([string]$ApiUrl = 'http://localhost:5088', [switch]$Install, [switch]$Build)
$ErrorActionPreference = 'Stop'
$web = Join-Path (Split-Path -Parent $PSScriptRoot) 'web'
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js and npm first.' }
$uri = [uri]$ApiUrl
if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http','https')) { throw 'ApiUrl must be an HTTP/HTTPS URL.' }
$env:NEXT_PUBLIC_API_URL = ($ApiUrl.TrimEnd('/') -replace '/api$','') + '/api'
Push-Location $web
try {
    if ($Install -or -not (Test-Path -LiteralPath 'node_modules/next/package.json')) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    }
    if ($Build) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Next.js build failed.' }
        & npm.cmd run start
    } else {
        & npm.cmd run dev
    }
    if ($LASTEXITCODE -ne 0) { throw 'Web did not start.' }
} finally { Pop-Location }
