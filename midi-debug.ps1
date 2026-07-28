# MIDI Debug Script — start server met verbose logging
# Run met: .\midi-debug.ps1

Write-Host "=== MIDI Debug Mode ===" -ForegroundColor Cyan
Write-Host "Starting server with verbose MIDI logging..." -ForegroundColor Yellow
Write-Host ""

# Set environment variables voor verbose logging
$env:LOGGING__LOGLEVEL__ZEUS_MIDI = "Debug"
$env:LOGGING__LOGLEVEL__ZEUS_SERVER_MIDI = "Debug"
$env:LOGGING__LOGLEVEL__DEFAULT = "Information"

# Start server
Write-Host "Server logs will show MIDI events in real-time" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

dotnet run --project OpenhpsdrZeus
