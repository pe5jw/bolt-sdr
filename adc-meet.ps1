# ADC Meet Script - bedient radio en logt ADC waarden
$base = "http://localhost:6061"

function Get-AdcData {
    $d = Invoke-RestMethod -Uri "$base/api/station/dsp-diagnostics"
    return [PSCustomObject]@{
        AttenDb = $d.rxDynamicRange.attenDb
        EffAttenDb = $d.rxDynamicRange.effectiveAttenDb
        AdcPk = $d.rxMeters.adcPkDbfs
        AdcAv = $d.rxMeters.adcAvDbfs
        Headroom = $d.rxMeters.adcHeadroomDb
        OverloadRisk = $d.rxDynamicRange.overloadRisk
        HeadroomOptimal = $d.rxDynamicRange.headroomOptimal
        Status = $d.rxMeters.status
    }
}

Write-Host "=== ADC Meting ===" -ForegroundColor Yellow
Write-Host "Doel headroom: 6-30 dB (ADC piek tussen -6 en -30 dBFS)" -ForegroundColor Cyan
Write-Host ""

foreach ($att in @(0, 6, 12, 18, 24, 30)) {
    Invoke-RestMethod -Uri "$base/api/attenuator" -Method POST -ContentType "application/json" -Body "{`"db`": $att}" | Out-Null
    Start-Sleep -Seconds 2
    $data = Get-AdcData
    $color = if ($data.HeadroomOptimal) { "Green" } elseif ($data.OverloadRisk) { "Red" } else { "White" }
    Write-Host ("ATT={0,2}dB  ADCpk={1,6:N1}  ADCav={2,6:N1}  Headroom={3,5:N1}  Optimaal={4}  Status={5}" -f `
        $att, $data.AdcPk, $data.AdcAv, $data.Headroom, $data.HeadroomOptimal, $data.Status) -ForegroundColor $color
}
