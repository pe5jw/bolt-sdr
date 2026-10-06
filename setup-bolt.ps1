# setup-bolt.ps1 - BoltSDR server installatie en verificatie
param([string]$InstallDir = 'C:\bolt-sdr', [switch]$Fix)
$ErrorActionPreference = 'SilentlyContinue'
$errors = @(); $warnings = @(); $fixed = @()
function Write-Check { param([string]$Num, [string]$Name) Write-Host "[$Num] $Name..." -NoNewline }
function Write-OK { param([string]$Detail = '') if ($Detail) { Write-Host " OK ($Detail)" -ForegroundColor Green } else { Write-Host " OK" -ForegroundColor Green } }
function Write-MISS { param([string]$Detail = '') Write-Host " MISSING" -ForegroundColor Red; if ($Detail) { Write-Host "     -> $Detail" -ForegroundColor Yellow } }
function Write-WARN { param([string]$Detail = '') Write-Host " WAARSCHUWING" -ForegroundColor Yellow; if ($Detail) { Write-Host "     -> $Detail" -ForegroundColor Yellow } }
function Write-FIXED { param([string]$Detail = '') Write-Host " FIXED" -ForegroundColor Yellow; if ($Detail) { Write-Host "     -> $Detail" -ForegroundColor Green } }
Write-Host "`n=== BoltSDR Server Setup v0.1.23 ===" -ForegroundColor Cyan
Write-Host "Map: $InstallDir`n"
Write-Check "01" ".NET 10 ASP.NET Runtime"
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnet) { $rt = & dotnet --list-runtimes 2>$null | Where-Object { $_ -match 'Microsoft\.AspNetCore\.App 10\.' }; if ($rt) { Write-OK ($rt[0].Trim()) } else { $errors += ".NET 10 mist"; if ($Fix) { winget install Microsoft.DotNet.AspNetCore.10 --accept-source-agreements --accept-package-agreements; $fixed += ".NET 10" } else { Write-MISS "winget install Microsoft.DotNet.AspNetCore.10" } } } else { $errors += "dotnet mist"; if ($Fix) { winget install Microsoft.DotNet.AspNetCore.10 --accept-source-agreements --accept-package-agreements; $fixed += ".NET 10" } else { Write-MISS "winget install Microsoft.DotNet.AspNetCore.10" } }
Write-Check "02" "Visual C++ Redistributable x64"
if (Test-Path 'C:\Windows\System32\vcruntime140.dll') { Write-OK } else { $errors += "VC++ mist"; if ($Fix) { winget install Microsoft.VCRedist.2015+.x64 --accept-source-agreements --accept-package-agreements; $fixed += "VC++" } else { Write-MISS "winget install Microsoft.VCRedist.2015+.x64" } }
Write-Check "03" "StationEngine"
if (Test-Path (Join-Path $InstallDir 'StationEngine.exe')) { Write-OK } else { Write-MISS "StationEngine.exe niet gevonden"; $errors += "StationEngine.exe mist" }
Write-Check "04" "Native DLLs"
$dlls = @('wdsp.dll','miniaudio.dll','fftw3.dll','fftw3f.dll','libfftw3-3.dll','libfftw3f-3.dll','codec2.dll','zeus_rade.dll'); $rtDir = Join-Path $InstallDir 'runtimes\win-x64\native'; $md = @(); $fd = @()
foreach ($d in $dlls) { $rp = Join-Path $InstallDir $d; if (-not (Test-Path $rp)) { $rtp = Join-Path $rtDir $d; if (Test-Path $rtp) { if ($Fix) { Copy-Item $rtp $rp -Force; $fd += $d } else { $md += $d } } else { $md += "$d (niet in runtimes)" } } }
if ($fd.Count -gt 0) { Write-FIXED "Gekopieerd: $($fd -join ', ')"; $fixed += "Native DLLs" } elseif ($md.Count -eq 0) { Write-OK } else { Write-MISS "Missen: $($md -join ', ')"; $errors += "Native DLLs missen" }
Write-Check "05" "WDSP support bestanden"
$m5 = @(); if (-not (Test-Path (Join-Path $InstallDir 'zetaHat.bin'))) { $m5 += 'zetaHat.bin' }; if (-not (Test-Path (Join-Path $InstallDir 'calculus'))) { $m5 += 'calculus' }
if ($m5.Count -eq 0) { Write-OK } else { Write-WARN "Mist: $($m5 -join ', ')"; $warnings += "WDSP support mist" }
Write-Check "06" "RNNoise model"
if (Test-Path (Join-Path $InstallDir 'rnnoise-default.bin')) { Write-OK } else { Write-WARN "rnnoise-default.bin mist - NR4 werkt niet"; $warnings += "RNNoise mist" }
Write-Check "07" "SSL Certificaat"
$cf = Join-Path $InstallDir 'certs\bolt-sdr.pfx'
if (Test-Path $cf) { Write-OK $cf } else { if ($Fix) { $cd = Join-Path $InstallDir 'certs'; New-Item -ItemType Directory -Path $cd -Force | Out-Null; $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^169\.' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddress; $cert = New-SelfSignedCertificate -DnsName (@($env:COMPUTERNAME,'localhost') + $ips) -CertStoreLocation 'Cert:\LocalMachine\My' -NotAfter (Get-Date).AddYears(10); Export-PfxCertificate -Cert $cert -FilePath $cf -Password (ConvertTo-SecureString 'bolt-sdr' -Force -AsPlainText) | Out-Null; Write-FIXED "Cert aangemaakt (ww: bolt-sdr)"; $fixed += "SSL cert" } else { Write-WARN "Draai -Fix voor certificaat"; $warnings += "SSL cert mist" } }
Write-Check "08" "Firewall regels"
$ports = @(@{N='BoltSDR HTTPS';P=6443},@{N='BoltSDR TCI';P=40001},@{N='BoltSDR CAT';P=19090},@{N='BoltSDR TCI-Bridge CAT';P=4532},@{N='BoltSDR TCI-Bridge WK';P=5597}); $mf = @()
foreach ($p in $ports) { if (-not (Get-NetFirewallRule -DisplayName $p.N -ErrorAction SilentlyContinue)) { $mf += "$($p.N):$($p.P)" } }
if ($mf.Count -eq 0) { Write-OK } else { if ($Fix) { foreach ($p in $ports) { if (-not (Get-NetFirewallRule -DisplayName $p.N -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName $p.N -Direction Inbound -Protocol TCP -LocalPort $p.P -Action Allow | Out-Null } }; Write-FIXED "Poorten geopend"; $fixed += "Firewall" } else { Write-WARN "Missen: $($mf -join ', ')"; $warnings += "Firewall mist" } }
Write-Check "09" "Bolt-web frontend"
if (Test-Path (Join-Path $InstallDir 'wwwroot\index.html')) { Write-OK } else { Write-MISS "wwwroot/index.html mist"; $errors += "Frontend mist" }
Write-Check "10" "FFTW Wisdom"
$wf = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Bolt') -Filter '*.wisdom' -ErrorAction SilentlyContinue
if ($wf) { Write-OK "$($wf.Count) bestanden" } else { Write-WARN "Wordt aangemaakt bij eerste start"; $warnings += "FFTW wisdom mist" }
Write-Check "11" "Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Write-OK (& node --version 2>$null) } else { if ($Fix) { winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements; $fixed += "Node.js" } else { Write-MISS "winget install OpenJS.NodeJS.LTS"; $errors += "Node.js mist" } }
Write-Check "12" "Python + tci-bridge venv"
$py = Get-Command python -ErrorAction SilentlyContinue; $isStub = $py -and ($py.Source -match 'WindowsApps')
if ($py -and -not $isStub) { $pyV = & python --version 2>&1; $vp = Join-Path $env:LOCALAPPDATA 'Bolt\tci-venv\Scripts\python.exe'; if (Test-Path $vp) { Write-OK "$pyV, venv OK" } else { if ($Fix) { & python -m venv (Join-Path $env:LOCALAPPDATA 'Bolt\tci-venv'); & (Join-Path $env:LOCALAPPDATA 'Bolt\tci-venv\Scripts\pip.exe') install websockets 2>$null; Write-FIXED "$pyV, venv + websockets"; $fixed += "Python venv" } else { Write-WARN "$pyV maar venv mist"; $warnings += "venv mist" } } } else { if ($Fix) { winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements; $fixed += "Python"; Write-Host "     -> Herstart terminal, draai -Fix opnieuw" -ForegroundColor Yellow } else { Write-MISS "winget install Python.Python.3.12"; $errors += "Python mist" } }
Write-Check "13" "Deploy script"
if (Test-Path (Join-Path $InstallDir 'deploy-server.cmd')) { Write-OK } else { Write-WARN "deploy-server.cmd mist"; $warnings += "Deploy script mist" }
Write-Check "14" "Data directories"
$dirs = @("$env:LOCALAPPDATA\Bolt","$env:LOCALAPPDATA\Bolt\dvk","$env:LOCALAPPDATA\Bolt\logs"); $cr = @()
foreach ($d in $dirs) { if (-not (Test-Path $d)) { if ($Fix) { New-Item -ItemType Directory -Path $d -Force | Out-Null; $cr += $d } } }
if ($cr.Count -gt 0) { Write-FIXED "Aangemaakt"; $fixed += "Data dirs" } elseif (($dirs | Where-Object { -not (Test-Path $_) }).Count -eq 0) { Write-OK } else { Write-WARN "Draai -Fix"; $warnings += "Data dirs missen" }
Write-Host "`n=== Resultaat ===" -ForegroundColor Cyan
if ($errors.Count -eq 0 -and $warnings.Count -eq 0) { Write-Host "  Alles OK!" -ForegroundColor Green; Write-Host "  Start: & '$InstallDir\deploy-server.cmd'" -ForegroundColor Cyan }
else { if ($fixed.Count -gt 0) { $fixed | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green } }; if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red } }; if ($warnings.Count -gt 0) { $warnings | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Yellow } }; if (-not $Fix -and $errors.Count -gt 0) { Write-Host "`n  Draai 'setup-bolt.ps1 -Fix' als Administrator" -ForegroundColor Cyan } }
Write-Host ""
