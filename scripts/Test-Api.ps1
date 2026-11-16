[CmdletBinding()]
param([string]$ApiUrl = 'http://127.0.0.1:5088', [switch]$TestData)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = $ApiUrl.TrimEnd('/')
function CallApi {
    param([string]$Path, [string]$Method = 'GET', [string]$Token, $Data)
    $argsMap = @{ Uri = "$base$Path"; Method = $Method; TimeoutSec = 25; ErrorAction = 'Stop' }
    if ($Token) { $argsMap.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Data) {
        $argsMap.ContentType = 'application/json; charset=utf-8'
        $argsMap.Body = [System.Text.Encoding]::UTF8.GetBytes(($Data | ConvertTo-Json -Depth 15 -Compress))
    }
    Invoke-RestMethod @argsMap
}
function Check($Condition, [string]$Name) {
    if (-not $Condition) { throw "FAIL $Name" }
    Write-Host "PASS $Name"
}
function Expect([int]$Status, [scriptblock]$Job, [string]$Name) {
    try { & $Job | Out-Null }
    catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq $Status) {
            Write-Host "PASS $Name"; return
        }
        throw
    }
    throw "FAIL $Name"
}

$health = CallApi '/health'
Check ($health.status -eq 'ok') 'API health'
$ready = CallApi '/ready'
Check ($ready.status -eq 'ready') 'SQL and community schema'
$exercises = @(CallApi '/api/Exercise')
$squat = $exercises | Where-Object name -eq 'Squat' | Select-Object -First 1
Check ($null -ne $squat) 'Squat in catalog'
$groups = @($exercises | Select-Object -ExpandProperty category -Unique)
foreach ($group in @('Back','Chest','Arms','Shoulders','Legs','Abs')) {
    Check ($groups -contains $group) "catalog $group"
}
if (-not $TestData) { return }
Write-Host 'Creating two test accounts and a workout in the configured database.'
$suffix = [Guid]::NewGuid().ToString('N').Substring(0,10)
$pwdTest = [Guid]::NewGuid().ToString('N')
$accountA = @{username = "qa_a_$suffix"; password = $pwdTest}
$accountB = @{username = "qa_b_$suffix"; password = $pwdTest}
CallApi '/api/Auth/register' 'POST' -Data $accountA | Out-Null
CallApi '/api/Auth/register' 'POST' -Data $accountB | Out-Null
$a = (CallApi '/api/Auth/login' 'POST' -Data $accountA).token
$b = (CallApi '/api/Auth/login' 'POST' -Data $accountB).token
Check ([bool]$a -and [bool]$b) 'login for A and B'
Expect 401 { CallApi '/api/community/posts' } 'feed requires authentication'

$fixtures = Get-Content -LiteralPath (Join-Path $root 'mobile/assets/pose_fixtures.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sample = @($fixtures)[0]
$replay = CallApi '/api/pose-coach/replay' 'POST' $a @{exercise = 'squat'; frames = $sample.frames}
Check ($replay.summary.completedReps -eq 2 -and $replay.summary.formOkReps -eq 2) 'replay result'
$session = (CallApi '/api/pose-coach/sessions' 'POST' $a @{exerciseId = $squat.id}).sessionId
$framesPath = "/api/pose-coach/sessions/$session/frames"
$finishPath = "/api/pose-coach/sessions/$session/finish"
Expect 404 { CallApi $finishPath 'POST' $b } 'B cannot finish session owned by A'
for ($i=0; $i -lt $sample.frames.Count; $i += 8) {
    $end = [Math]::Min($i + 7, $sample.frames.Count - 1)
    $batch = @($sample.frames[$i..$end])
    $last = CallApi $framesPath 'POST' $a @{frames = $batch}
}
$duplicate = CallApi $framesPath 'POST' $a @{frames = $batch}
Check ($last.latest.completedReps -eq 2 -and $duplicate.trackedFrames -eq $last.trackedFrames) 'live batches and replayed sequence'
$saved = CallApi $finishPath 'POST' $a
$again = CallApi $finishPath 'POST' $a
Check ($saved.analysisId -eq $again.analysisId -and $saved.result.completedReps -eq 2) 'finish saves only once'
$history = @(CallApi '/api/WorkoutAnalysis' -Token $a)
Check (@($history | Where-Object id -eq $saved.analysisId).Count -eq 1) 'history contains saved result'

$posts = '/api/community/posts'
$caption = 'Workout smoke test'
Expect 404 { CallApi $posts 'POST' $b @{content = $caption; analysisId = $saved.analysisId} } 'private workout cannot be attached by B'
$post = (CallApi $posts 'POST' $a @{content = $caption; analysisId = $saved.analysisId}).id
$postPath = "$posts/$post"
try {
    Expect 404 { CallApi $postPath 'PUT' $b @{content = 'Other user edit'} } 'B cannot overwrite post'
    CallApi "$postPath/like" 'PUT' $b | Out-Null
    CallApi "$postPath/like" 'PUT' $b | Out-Null
    $row = (CallApi $posts -Token $b).items | Where-Object id -eq $post
    Check ($row.likeCount -eq 1 -and $row.liked -and $row.reps -eq 2) 'shared result and idempotent likes'
    CallApi "$postPath/comments" 'POST' $b @{content = 'Suggestion from B'; isSuggestion = $true} | Out-Null
    $comment = (CallApi "$postPath/comments" -Token $a).items[0]
    Check ($comment.isSuggestion -and -not $comment.isMine) 'suggestion belongs to B'
    CallApi $postPath 'PUT' $a @{content = $comment.content} | Out-Null
    $updated = (CallApi $posts -Token $a).items | Where-Object id -eq $post
    Check ($updated.content -eq $comment.content) 'author can apply suggestion'
} finally { CallApi $postPath 'DELETE' $a | Out-Null }
Write-Host 'SQL smoke test complete. Test accounts and one workout remain in the test database.'
