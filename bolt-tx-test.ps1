# bolt-tx-test.ps1
$base = "http://localhost:6060"

function Api($method, $path, $body = $null) {
    try {
        $params = @{ Uri = "$base$path"; Method = $method; ContentType = "application/json"; ErrorAction = "Stop" }
        if ($body) { $params.Body = ($body | ConvertTo-Json) }
        $r = Invoke-WebRequest @params
        if ($r.Content -and $r.Content.Trim() -ne "" -and $r.Content[0] -eq "{" -or $r.Content[0] -eq "[") { 
            return $r.Content | ConvertFrom-Json 
        }
        return $true
    } catch { 
        if ($_.Exception.Response.StatusCode -eq 400) {
            $body = $_.ErrorDetails.Message
            Write-Host "  WARN: $body" -ForegroundColor Yellow
        }
        return $null 
    }
}

function Pass($msg) { Write-Host "  PASS: $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "  INFO: $msg" -ForegroundColor Cyan }
function Step($msg) { Write-Host "`n[$msg]" -ForegroundColor Yellow }

function Show-TxStatus($label) {
    $tx = Api GET "/api/radio/tx-status"
    if ($tx -and $tx -ne $true) {
        $color = if ($tx.moxOn -or $tx.tunOn) { "Red" } else { "Gray" }
        Write-Host "  TX[$label]: mox=$($tx.moxOn) tun=$($tx.tunOn) drive=$($tx.drivePct)% tune=$($tx.tunePct)%" -ForegroundColor $color
    }
}

function Monitor-Tx($seconds) {
    $end = (Get-Date).AddSeconds($seconds)
    $i = 0
    while ((Get-Date) -lt $end) {
        $tx = Api GET "/api/radio/tx-status"
        if ($tx -and $tx -ne $true) {
            $color = if ($tx.moxOn -or $tx.tunOn) { "Red" } else { "Gray" }
            Write-Host "  [$i] mox=$($tx.moxOn) tun=$($tx.tunOn) drv=$($tx.drivePct)%" -ForegroundColor $color
        }
        $i++
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "=== BOLT SDR TX TEST ===" -ForegroundColor Magenta

Step "1. Server bereikbaar"
$state = Api GET "/api/radio/state"
if ($state -and $state -ne $true) { Pass "Server OK" } else { Fail "Server niet bereikbaar"; exit }

Step "2. Radio verbonden"
if ($state.status -eq "Connected") { Pass "Radio connected - protocol=$($state.connectedProtocol) freq=$($state.vfoHz)" }
else { Fail "Radio niet verbonden: $($state.status)"; exit }

Step "3. Mic device"
$audio = Api GET "/api/audio/device-settings"
if ($audio -and $audio -ne $true -and $audio.inputDeviceId) { Info "Mic ID length=$($audio.inputDeviceId.Length)" }
else { Info "Mic: default device" }

Step "4. Drive instellen op 80%"
Api POST "/api/radio/drive" @{pct=80} | Out-Null
Start-Sleep -Milliseconds 300
Show-TxStatus "na drive"

Step "5. MOX test (4 seconden)"
Write-Host "  >> MOX AAN..." -ForegroundColor White
Api POST "/api/radio/mox" @{on=$true} | Out-Null
Monitor-Tx 4
Api POST "/api/radio/mox" @{on=$false} | Out-Null
Write-Host "  >> MOX UIT" -ForegroundColor White
Show-TxStatus "na mox"

Step "6. TUNE test (4 seconden)"
Api POST "/api/radio/tune-drive" @{pct=50} | Out-Null
Write-Host "  >> TUNE AAN..." -ForegroundColor White
Api POST "/api/radio/tune" @{on=$true} | Out-Null
Monitor-Tx 4
Api POST "/api/radio/tune" @{on=$false} | Out-Null
Write-Host "  >> TUNE UIT" -ForegroundColor White
Show-TxStatus "na tune"

Step "7. Monitor test (4 seconden - spreek in mic)"
Api POST "/api/radio/tx-monitor" @{enabled=$true} | Out-Null
Write-Host "  >> MONITOR AAN - spreek in microfoon..." -ForegroundColor White
Monitor-Tx 4
Api POST "/api/radio/tx-monitor" @{enabled=$false} | Out-Null
Write-Host "  >> MONITOR UIT" -ForegroundColor White

Write-Host "`n=== TEST KLAAR ===" -ForegroundColor Magenta
