# setup-bolt.ps1 - BoltSDR server installatie en verificatie
# Draai als Administrator op de doelserver

param(
    [string]$InstallDir = 'C:\bolt-sdr',
    [switch]$Fix
)

$errors = @()
$warnings = @()

Write-Host "`n=== BoltSDR Server Setup ===" -ForegroundColor Cyan
Write-Host "Installatie map: $InstallDir`n"

# 1. .NET 10 Runtime
Write-Host "[1/9] .NET Runtime..." -NoNewline
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnet) {
    $runtimes = dotnet --list-runtimes 2>$null | Where-Object { $_ -match 'Microsoft\.AspNetCore\.App 10\.' }
    if ($runtimes) {
        Write-Host " OK ($($runtimes[0].Trim()))" -ForegroundColor Green
    } else {
        Write-Host " MISSING" -ForegroundColor Red
        $errors += ".NET 10 ASP.NET runtime niet gevonden"
        if ($Fix) {
            Write-Host "  -> Installeren..." -ForegroundColor Yellow
            winget install Microsoft.DotNet.AspNetCore.10 --accept-source-agreements --accept-package-agreements
        } else {
            Write-Host "  -> Fix: winget install Microsoft.DotNet.AspNetCore.10" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "dotnet CLI niet gevonden"
    if ($Fix) {
        Write-Host "  -> Installeren..." -ForegroundColor Yellow
        winget install Microsoft.DotNet.AspNetCore.10 --accept-source-agreements --accept-package-agreements
    } else {
        Write-Host "  -> Fix: winget install Microsoft.DotNet.AspNetCore.10" -ForegroundColor Yellow
    }
}

# 2. Visual C++ Redistributable
Write-Host "[2/9] Visual C++ Runtime..." -NoNewline
if (Test-Path 'C:\Windows\System32\vcruntime140.dll') {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "Visual C++ Redistributable x64 niet gevonden"
    if ($Fix) {
        Write-Host "  -> Installeren..." -ForegroundColor Yellow
        winget install Microsoft.VCRedist.2015+.x64 --accept-source-agreements --accept-package-agreements
    } else {
        Write-Host "  -> Fix: winget install Microsoft.VCRedist.2015+.x64" -ForegroundColor Yellow
    }
}

# 3. Native DLLs
Write-Host "[3/9] Native DLLs..." -NoNewline
$nativeDlls = @('wdsp.dll', 'miniaudio.dll', 'fftw3.dll', 'fftw3f.dll', 'libfftw3-3.dll', 'libfftw3f-3.dll', 'codec2.dll', 'zeus_rade.dll')
$missingRoot = @()
$runtimeDir = Join-Path $InstallDir 'runtimes\win-x64\native'
foreach ($dll in $nativeDlls) {
    if (-not (Test-Path (Join-Path $InstallDir $dll))) {
        $runtimePath = Join-Path $runtimeDir $dll
        if (Test-Path $runtimePath) {
            if ($Fix) {
                Copy-Item $runtimePath (Join-Path $InstallDir $dll) -Force
            } else {
                $missingRoot += $dll
            }
        } else {
            $missingRoot += "$dll (ook niet in runtimes)"
        }
    }
}
if ($missingRoot.Count -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    if ($Fix) {
        Write-Host " FIXED (gekopieerd uit runtimes)" -ForegroundColor Yellow
    } else {
        Write-Host " MISSING in root: $($missingRoot -join ', ')" -ForegroundColor Red
        $errors += "Native DLLs missen in $InstallDir"
        Write-Host "  -> Fix: draai setup-bolt.ps1 -Fix" -ForegroundColor Yellow
    }
}

# 4. StationEngine executable
Write-Host "[4/9] StationEngine..." -NoNewline
if (Test-Path (Join-Path $InstallDir 'StationEngine.exe')) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "StationEngine.exe niet gevonden in $InstallDir"
}

# 5. SSL Certificaat
Write-Host "[5/9] SSL Certificaat..." -NoNewline
$certDir = Join-Path $InstallDir 'certs'
$certFile = Join-Path $certDir 'bolt-sdr.pfx'
if (Test-Path $certFile) {
    Write-Host " OK ($certFile)" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Yellow
    $warnings += "SSL certificaat niet gevonden"
    if ($Fix) {
        Write-Host "  -> Genereren..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $certDir -Force | Out-Null
        $cert = New-SelfSignedCertificate -DnsName $env:COMPUTERNAME, 'localhost', (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^169\.' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress) -CertStoreLocation 'Cert:\LocalMachine\My' -NotAfter (Get-Date).AddYears(10)
        $pwd = ConvertTo-SecureString -String 'bolt-sdr' -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $certFile -Password $pwd | Out-Null
        Write-Host "  -> Certificaat aangemaakt: $certFile (wachtwoord: bolt-sdr)" -ForegroundColor Green
    } else {
        Write-Host "  -> Fix: draai setup-bolt.ps1 -Fix" -ForegroundColor Yellow
    }
}

# 6. Firewall regels
Write-Host "[6/9] Firewall regels..." -NoNewline
$ports = @(
    @{ Name = 'BoltSDR HTTPS'; Port = 6443 },
    @{ Name = 'BoltSDR TCI'; Port = 40001 },
    @{ Name = 'BoltSDR CAT'; Port = 19090 }
)
$missingFw = @()
foreach ($p in $ports) {
    $rule = Get-NetFirewallRule -DisplayName $p.Name -ErrorAction SilentlyContinue
    if (-not $rule) { $missingFw += "$($p.Name) ($($p.Port))" }
}
if ($missingFw.Count -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING: $($missingFw -join ', ')" -ForegroundColor Yellow
    $warnings += "Firewall regels missen"
    if ($Fix) {
        foreach ($p in $ports) {
            $existing = Get-NetFirewallRule -DisplayName $p.Name -ErrorAction SilentlyContinue
            if (-not $existing) {
                New-NetFirewallRule -DisplayName $p.Name -Direction Inbound -Protocol TCP -LocalPort $p.Port -Action Allow | Out-Null
                Write-Host "  -> $($p.Name) poort $($p.Port) geopend" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  -> Fix: draai setup-bolt.ps1 -Fix als Administrator" -ForegroundColor Yellow
    }
}

# 7. FFTW Wisdom
Write-Host "[7/9] FFTW Wisdom..." -NoNewline
$wisdomDir = Join-Path $env:LOCALAPPDATA 'Bolt'
$wisdomFiles = Get-ChildItem $wisdomDir -Filter '*.wisdom' -ErrorAction SilentlyContinue
if ($wisdomFiles) {
    Write-Host " OK ($($wisdomFiles.Count) bestanden)" -ForegroundColor Green
} else {
    Write-Host " niet aanwezig (wordt aangemaakt bij eerste start)" -ForegroundColor Yellow
    $warnings += "FFTW wisdom wordt bij eerste start gegenereerd (kan enkele minuten duren)"
}

# 8. Bolt-web bestanden
Write-Host "[8/9] Bolt-web (frontend)..." -NoNewline
$indexHtml = Join-Path $InstallDir 'wwwroot\index.html'
if (Test-Path $indexHtml) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "wwwroot/index.html niet gevonden - frontend niet gedeployed"
}

# 9. Deploy script
Write-Host "[9/9] Deploy script..." -NoNewline
$deployCmd = Join-Path $InstallDir 'deploy-server.cmd'
if (Test-Path $deployCmd) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Yellow
    $warnings += "deploy-server.cmd niet gevonden"
}


# 10. Node.js (voor tci-bridge)
Write-Host "[10] Node.js..." -NoNewline
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVer = node --version 2>$null
    Write-Host " OK ($nodeVer)" -ForegroundColor Green
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "Node.js niet gevonden (nodig voor tci-bridge)"
    if ($Fix) {
        Write-Host "  -> Installeren..." -ForegroundColor Yellow
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    } else {
        Write-Host "  -> Fix: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    }
}

# 11. Python (voor tci-bridge)
Write-Host "[11] Python..." -NoNewline
$py = Get-Command python -ErrorAction SilentlyContinue
if ($py -and $py.Source -notmatch 'WindowsApps') {
    $pyVer = python --version 2>&1
    Write-Host " OK ($pyVer)" -ForegroundColor Green
    # Check venv
    $venvPy = Join-Path $env:LOCALAPPDATA 'Bolt\tci-venv\Scripts\python.exe'
    if (-not (Test-Path $venvPy)) {
        Write-Host "  -> tci-bridge venv mist" -ForegroundColor Yellow
        $warnings += "tci-bridge Python venv niet aangemaakt"
        if ($Fix) {
            python -m venv (Join-Path $env:LOCALAPPDATA 'Bolt\tci-venv')
            Write-Host "  -> venv aangemaakt" -ForegroundColor Green
        }
    }
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $errors += "Python niet gevonden (nodig voor tci-bridge)"
    if ($Fix) {
        winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    } else {
        Write-Host "  -> Fix: winget install Python.Python.3.12" -ForegroundColor Yellow
    }
}
# Samenvatting
Write-Host "`n=== Resultaat ===" -ForegroundColor Cyan
if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "Alles OK! Server is klaar om te starten." -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "ERRORS ($($errors.Count)):" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if ($warnings.Count -gt 0) {
        Write-Host "WAARSCHUWINGEN ($($warnings.Count)):" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
    if (-not $Fix) {
        Write-Host "`nDraai 'setup-bolt.ps1 -Fix' als Administrator om problemen op te lossen." -ForegroundColor Cyan
    }
}
Write-Host ""
