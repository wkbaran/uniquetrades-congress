# uniquetrades-congress: generate report then publish
# Designed for use with Windows Task Scheduler

$ProjectDir = "C:\Users\billb\projects\uniquetrades-congress"
$LogDir = "$ProjectDir\logs"
$LogFile = "$LogDir\congress-trades-$(Get-Date -Format 'yyyy-MM-dd').log"
$NodeExe = "node"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp  $Message" | Tee-Object -FilePath $LogFile -Append
}

Set-Location $ProjectDir

Write-Log "=== Starting pipeline ==="

& $NodeExe --env-file-if-exists=.env dist/index.js report:html --publish 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    Write-Log "Pipeline failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
}

Write-Log "Pipeline complete."
