[CmdletBinding()]
param(
    [ValidatePattern('^[a-zA-Z0-9._\\,()\-:]+$')][string]$SqlServer = '.\SQLEXPRESS',
    [ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Database = 'FitnessLifestyle_DACN',
    [ValidateRange(1,65535)][int]$Port = 5088,
    [switch]$Migrate,
    [switch]$Lan
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install .NET 8 SDK first.' }
$sdks = & dotnet --list-sdks
if (-not ($sdks -match '^8\.')) { throw 'Install .NET 8 SDK (not only the runtime).' }

# Supply a connection string through the environment for SQL Authentication.
if ([string]::IsNullOrWhiteSpace($env:ConnectionStrings__DefaultConnection)) {
    $env:ConnectionStrings__DefaultConnection = "Server=$SqlServer;Database=$Database;Trusted_Connection=True;Encrypt=False;TrustServerCertificate=True;Connect Timeout=5"
}
if ([string]::IsNullOrWhiteSpace($env:Jwt__Key)) {
    $config = Join-Path $root '.local'
    [void](New-Item -Path $config -ItemType Directory -Force)
    $keyFile = Join-Path $config 'jwt-key.txt'
    if (-not (Test-Path -LiteralPath $keyFile)) {
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $bytes = New-Object byte[] 48
            $random.GetBytes($bytes)
            [System.IO.File]::WriteAllText($keyFile, [Convert]::ToBase64String($bytes))
        } finally { $random.Dispose() }
    }
    $env:Jwt__Key = [System.IO.File]::ReadAllText($keyFile).Trim()
}
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:LocalDemo__AllowHttp = 'true'
$address = if ($Lan) { '0.0.0.0' } else { '127.0.0.1' }

Push-Location $root
try {
    if ($Migrate) {
        & dotnet tool restore
        if ($LASTEXITCODE -ne 0) { throw 'dotnet tool restore failed.' }
        & dotnet ef database update --project .\backend --startup-project .\backend
        if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Check the SQL instance and your database rights.' }
    }
    Write-Host "API: http://127.0.0.1:$Port/health"
    Write-Host "Database readiness: http://127.0.0.1:$Port/ready"
    & dotnet run --project .\backend --no-launch-profile -- --urls "http://${address}:$Port"
    if ($LASTEXITCODE -ne 0) { throw 'API did not start. Check the .NET output above.' }
} finally { Pop-Location }
