Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

$ErrorActionPreference = "Stop"

# Ensure Node.js is in PATH
if ($env:PATH -notmatch "nodejs") {
    if (Test-Path "C:\Program Files\nodejs") {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    } elseif (Test-Path "C:\Program Files (x86)\nodejs") {
        $env:PATH = "C:\Program Files (x86)\nodejs;$env:PATH"
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectDir = Join-Path $scriptDir "student-id-card-system"
$logFile = Join-Path $scriptDir "launcher.log"
$serverLog = Join-Path $scriptDir "dev-server.log"
$port = 5173
$url = "http://localhost:$port"

function Log-Message($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logFile -Value "[$timestamp] $msg" -ErrorAction SilentlyContinue
}

function Test-PortReady($targetPort) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect("127.0.0.1", $targetPort, $null, $null)
        $wait = $async.AsyncWaitHandle.WaitOne(400, $false)
        if ($wait -and $tcp.Connected) {
            $tcp.EndConnect($async)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

Log-Message "=== Launch triggered ==="

# Check if Vite server is already listening
$alreadyRunning = Test-PortReady -targetPort $port

if (-not $alreadyRunning) {
    Log-Message "Server is not running on port $port. Starting npm run dev..."
    
    # Start dev server in hidden window redirecting logs
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c npm run dev > `"$serverLog`" 2>&1"
    $psi.WorkingDirectory = $projectDir
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $true

    try {
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    } catch {
        Log-Message "Error starting dev server process: $_"
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to start dev server: $_",
            "GMS Yug ID Card System",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        exit 1
    }

    # Wait for the server to become responsive (up to 30 seconds)
    $maxAttempts = 60
    $isReady = $false
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-PortReady -targetPort $port) {
            $isReady = $true
            break
        }
    }

    if (-not $isReady) {
        Log-Message "Timeout waiting for port $port to become ready. See dev-server.log"
        [System.Windows.Forms.MessageBox]::Show(
            "The app server took longer than expected to start.`n`nPlease check '$serverLog' for details.",
            "GMS Yug ID Card System",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
        exit 1
    }

    Log-Message "Server successfully verified ready on port $port."
} else {
    Log-Message "Server is already running on port $port. Opening browser directly."
}

# Find Chrome
$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromeExe) {
    Log-Message "Launching Chrome: $chromeExe $url"
    Start-Process -FilePath $chromeExe -ArgumentList $url
} else {
    Log-Message "Chrome not found at standard locations. Launching default browser: $url"
    Start-Process $url
}

Log-Message "Launch process complete."
