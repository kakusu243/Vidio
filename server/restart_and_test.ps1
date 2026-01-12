# Kill all python processes (to clear REPL)
try { taskkill /F /IM python.exe /T } catch { }
Start-Sleep -Seconds 1

# Start the Flask server in background
Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList 'server\app.py' -WindowStyle Hidden
Start-Sleep -Seconds 6

# Run the test download script and capture output
$py = "";
try {
  $py = & ".\.venv\Scripts\python.exe" "server\test_download.py" 2>&1
} catch {
  $py = "ERROR: $_"
}
Set-Content -Path "server\test_output.txt" -Value $py

# Call the extract endpoint and append the JSON (or error)
$res = ''
try {
  $res = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/extract?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ" -UseBasicParsing | ConvertTo-Json -Depth 2
} catch {
  $res = "EXTRACT_ERROR: $_"
}
Add-Content -Path "server\test_output.txt" -Value "`n--- extract ---`n$res"

Write-Output "Done. Results saved to server\test_output.txt"