[CmdletBinding()]
param([string]$ApiUrl = 'http://10.0.2.2:5088', [string]$Device, [switch]$Check)
$ErrorActionPreference = 'Stop'
$mobile = Join-Path (Split-Path -Parent $PSScriptRoot) 'mobile'
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw 'Install Flutter and Android SDK first.' }
$uri = [uri]$ApiUrl
if (-not $uri.IsAbsoluteUri -or $uri.Scheme -notin @('http','https')) { throw 'ApiUrl must be an HTTP/HTTPS URL.' }
$android = Join-Path $mobile 'android'
if (-not (Test-Path -LiteralPath $android)) {
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("fitness_flutter_" + [Guid]::NewGuid().ToString('N'))
    $template = Join-Path $tempRoot 'fitness_lifestyle'
    [void](New-Item -Path $tempRoot -ItemType Directory)
    try {
        & flutter create --no-pub --platforms=android --org vn.fitness --project-name fitness_lifestyle $template
        if ($LASTEXITCODE -ne 0) { throw 'flutter create failed.' }

        $androidTemp = Join-Path $template 'android'
        $namespace = 'http://schemas.android.com/apk/res/android'
        $mainPath = Join-Path $androidTemp 'app/src/main/AndroidManifest.xml'
        $main = New-Object System.Xml.XmlDocument
        $main.Load($mainPath)
        foreach ($name in @('android.permission.INTERNET','android.permission.CAMERA')) {
            if (-not ($main.manifest.SelectNodes('uses-permission') | Where-Object {
                $_.GetAttribute('name', $namespace) -eq $name
            })) {
                $element = $main.CreateElement('uses-permission')
                $attribute = $main.CreateAttribute('android','name',$namespace)
                $attribute.Value = $name
                [void]$element.Attributes.Append($attribute)
                [void]$main.manifest.InsertBefore($element, $main.manifest.application)
            }
        }
        $main.Save($mainPath)
        $debugPath = Join-Path $androidTemp 'app/src/debug/AndroidManifest.xml'
        $debug = New-Object System.Xml.XmlDocument
        $debug.Load($debugPath)
        $app = $debug.SelectSingleNode('/manifest/application')
        if ($null -eq $app) { $app = $debug.CreateElement('application'); [void]$debug.manifest.AppendChild($app) }
        $attribute = $debug.CreateAttribute('android','usesCleartextTraffic',$namespace)
        $attribute.Value = 'true'
        [void]$app.Attributes.SetNamedItem($attribute)
        $debug.Save($debugPath)

        $gradle = Join-Path $androidTemp 'app/build.gradle.kts'
        if (-not (Test-Path -LiteralPath $gradle)) { $gradle = Join-Path $androidTemp 'app/build.gradle' }
        $raw = [System.IO.File]::ReadAllText($gradle)
        $patched = $raw -replace '(?m)^(\s*)(?:minSdkVersion|minSdk)\s*=?\s*flutter\.minSdkVersion\s*$', '$1minSdk = 24'
        if ($patched -eq $raw -and $raw -notmatch '(?:minSdkVersion|minSdk)\s*=?\s*(?:2[4-9]|[3-9][0-9])\b') {
            throw 'Cannot set Android minSdk. Open the Gradle file and set minSdk to at least 24.'
        }
        [System.IO.File]::WriteAllText($gradle, $patched, (New-Object System.Text.UTF8Encoding($false)))
        Copy-Item -LiteralPath $androidTemp -Destination $android -Recurse
        Copy-Item -LiteralPath (Join-Path $template '.metadata') -Destination (Join-Path $mobile '.metadata')
    } finally { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}

Push-Location $mobile
try {
    & flutter pub get
    if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed.' }
    if ($Check) {
        & flutter analyze
        if ($LASTEXITCODE -ne 0) { throw 'flutter analyze found issues.' }
        & flutter test
        if ($LASTEXITCODE -ne 0) { throw 'flutter test failed.' }
    }
    $run = @('run', "--dart-define=API_URL=$ApiUrl")
    if ($Device) { $run += @('-d', $Device) }
    & flutter @run
    if ($LASTEXITCODE -ne 0) { throw 'Flutter did not start. Check flutter devices and the output above.' }
} finally { Pop-Location }
