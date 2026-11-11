Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue

$port = 5173
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$logFile = Join-Path $scriptDir "launcher.log"

function Log-Message($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logFile -Value "[$timestamp] [STOP] $msg" -ErrorAction SilentlyContinue
}

Log-Message "Stop requested."

$stoppedCount = 0

# Check port 5173 listeners
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        try {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($p) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                $stoppedCount++
                Log-Message "Killed process $procId ($($p.ProcessName)) on port $port"
            }
        } catch {
            Log-Message "Could not stop PID $procId: $_"
        }
    }
}

# Also find any node process running inside this repository directory
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue
        if ($cim -and $cim.CommandLine -and ($cim.CommandLine -match "student-id-card-system" -or $cim.CommandLine -match "gms-yug-id-card-system")) {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stoppedCount++
            Log-Message "Killed node process $($_.Id)"
        }
    } catch {}
}

if ($stoppedCount -gt 0) {
    Log-Message "Successfully stopped server ($stoppedCount process(es) terminated)."
    [System.Windows.Forms.MessageBox]::Show(
        "GMS Yug Student ID Card System has been stopped.",
        "GMS Yug ID Card System",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
} else {
    Log-Message "Server was not running."
    [System.Windows.Forms.MessageBox]::Show(
        "GMS Yug Student ID Card System is not currently running.",
        "GMS Yug ID Card System",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}
