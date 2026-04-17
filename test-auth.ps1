Stop-Process -Name node -ErrorAction SilentlyContinue
Write-Host "=== Starting Server ==="
$nodeJob = Start-Job -ScriptBlock { cd C:\Users\Yusuf\Desktop\Whatsapp; npm start }
Start-Sleep -Seconds 5

try {
    Write-Host "`n=== Testing Sign Up API ==="
    $signupResponse = curl.exe -s -X POST http://localhost:3000/api/signup `
        -H "Content-Type: application/json" `
        -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"password123"}'
    Write-Host $signupResponse

    Start-Sleep -Seconds 2

    Write-Host "`n=== Testing Login API ==="
    $loginResponse = curl.exe -s -X POST http://localhost:3000/api/login `
        -H "Content-Type: application/json" `
        -d '{"emailOrPhone":"test@example.com","password":"password123"}'
    Write-Host $loginResponse

    Write-Host "`n=== Testing Duplicate Signup ==="
    $dupResponse = curl.exe -s -X POST http://localhost:3000/api/signup `
        -H "Content-Type: application/json" `
        -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"password123"}'
    Write-Host $dupResponse

    Write-Host "`n=== Testing Login with Wrong Password ==="
    $wrongPass = curl.exe -s -X POST http://localhost:3000/api/login `
        -H "Content-Type: application/json" `
        -d '{"emailOrPhone":"test@example.com","password":"wrongpassword"}'
    Write-Host $wrongPass
}
catch {
    Write-Host "Error: $_"
}
finally {
    Write-Host "`n=== Stopping Server ==="
    Stop-Job -Name npm -ErrorAction SilentlyContinue
    Get-Job | Stop-Job -Force -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
    Stop-Process -Name node -ErrorAction SilentlyContinue
}
