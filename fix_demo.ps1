$ErrorActionPreference = 'Stop'
$baseUrl = 'https://old-clothes-app-production.up.railway.app/api'

# 1. Login as SUPER_ADMIN
$body = @{ role = 'SUPER_ADMIN' } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$baseUrl/auth/demo" -Method Post -Body $body -ContentType 'application/json'
$token = $res.token

# 2. Get Partners
$partners = Invoke-RestMethod -Uri "$baseUrl/admin/partners" -Method Get -Headers @{ Authorization = "Bearer $token" }
$demoPartner = $partners.partners | Where-Object { $_.ownerName -match '데모 파트너' -or $_.businessName -match '데모 파트너' }

if (!$demoPartner) {
    Write-Host "Demo partner not found"
    exit
}

$partnerId = $demoPartner.id
Write-Host "Found Demo Partner: $partnerId"

# 3. Add 8 Cities
$cities = @('수원시', '용인시', '성남시', '고양시', '안양시', '안산시', '부천시', '광명시')

foreach ($city in $cities) {
    $addBody = @{ province = '경기도'; city = $city } | ConvertTo-Json
    try {
        $addRes = Invoke-RestMethod -Uri "$baseUrl/admin/partners/$partnerId/coverage" -Method Post -Body $addBody -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" }
        Write-Host "Added $city"
    } catch {
        Write-Host "Error adding $city : $_"
    }
}
