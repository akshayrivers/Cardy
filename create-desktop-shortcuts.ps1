$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$wsh = New-Object -ComObject WScript.Shell

# Identify desktop directories
$desktops = @()
$oneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
$userDesktop = Join-Path $env:USERPROFILE "Desktop"
$specialDesktop = [Environment]::GetFolderPath("Desktop")

if (Test-Path $specialDesktop) { $desktops += $specialDesktop }
if ((Test-Path $oneDriveDesktop) -and ($desktops -notcontains $oneDriveDesktop)) { $desktops += $oneDriveDesktop }
if ((Test-Path $userDesktop) -and ($desktops -notcontains $userDesktop)) { $desktops += $userDesktop }

Write-Host "Creating shortcuts in the following desktop folders:"
$desktops | ForEach-Object { Write-Host " - $_" }

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
    $chromePath = "$env:SystemRoot\System32\shell32.dll, 220"
} else {
    $chromePath = "$chromePath, 0"
}

$powershellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$launchPs1 = Join-Path $scriptDir "launch-app.ps1"
$stopPs1 = Join-Path $scriptDir "stop-app.ps1"

foreach ($desktop in $desktops) {
    # 1. Launcher shortcut
    $shortcutPath = Join-Path $desktop "GMS Yug Student ID Cards.lnk"
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $powershellExe
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launchPs1`""
    $shortcut.WorkingDirectory = $scriptDir
    $shortcut.IconLocation = $chromePath
    $shortcut.WindowStyle = 7 # Minimized
    $shortcut.Description = "Launch GMS Yug Student ID Card System in Chrome"
    $shortcut.Save()
    Write-Host "Created: $shortcutPath"

    # 2. Stop shortcut
    $stopShortcutPath = Join-Path $desktop "Stop GMS ID Server.lnk"
    $stopShortcut = $wsh.CreateShortcut($stopShortcutPath)
    $stopShortcut.TargetPath = $powershellExe
    $stopShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$stopPs1`""
    $stopShortcut.WorkingDirectory = $scriptDir
    $stopShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll, 131"
    $stopShortcut.WindowStyle = 7 # Minimized
    $stopShortcut.Description = "Stop GMS Yug Student ID Card System dev server"
    $stopShortcut.Save()
    Write-Host "Created: $stopShortcutPath"
}

Write-Host "All shortcuts successfully created and configured!"
