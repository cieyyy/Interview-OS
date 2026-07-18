$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Executable = Join-Path $ProjectRoot 'release\Interview-OS-0.1.0-x64-portable.exe'
$DataDirectory = Join-Path $ProjectRoot 'data\interview-os'

if (-not (Test-Path -LiteralPath $Executable)) {
    throw "Portable application not found: $Executable"
}

New-Item -ItemType Directory -Force -Path $DataDirectory | Out-Null
$env:INTERVIEW_OS_DATA_DIR = $DataDirectory

Start-Process -FilePath $Executable -WorkingDirectory $ProjectRoot

Write-Output "Interview OS started. Data directory: $DataDirectory"
