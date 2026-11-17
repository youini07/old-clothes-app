# ==============================================================================
# 올클(ALL-CLEAR) 전용 사무실 문자자동접수 안드로이드 앱 (allclear-app.apk) 원클릭 자동 빌더
# - 왜 별도 Android Studio 설치 없이도 빌드되게 구성했는가:
#   사장님 PC에서도 서버 주소 변경 등이 필요할 때 더블클릭 한 번으로 5초 만에 서명된 APK를
#   재생성할 수 있도록 공식 OpenJDK 17 + Google Android Build-Tools(r34) 경량 파이프라인을 자동화했습니다.
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ProjectRoot   = Split-Path -Parent $PSScriptRoot
$AppMainDir    = Join-Path $PSScriptRoot "app\src\main"
$OutDistDir    = Join-Path $PSScriptRoot "dist"
$WebPubDir     = Join-Path $ProjectRoot "frontend\public\downloads"
$BackendPubDir = Join-Path $ProjectRoot "backend\public\downloads"

# 로컬 AppData의 공용 Android SDK 캐시 재활용 (최초 실행 시에만 자동 다운로드)
$SdkCacheDir = Join-Path $env:LOCALAPPDATA "OtzzangAndroidSdk"
$WorkDir     = Join-Path $env:TEMP "allclear_apk_build_work"

New-Item -ItemType Directory -Force -Path $SdkCacheDir   | Out-Null
New-Item -ItemType Directory -Force -Path $OutDistDir    | Out-Null
New-Item -ItemType Directory -Force -Path $WebPubDir     | Out-Null
New-Item -ItemType Directory -Force -Path $BackendPubDir | Out-Null

Write-Host "[1/5] 공식 OpenJDK 17 및 Android SDK Build-Tools 캐시 확인 중..." -ForegroundColor Cyan

# 1. OpenJDK 17 준비
$JdkSearch = Get-ChildItem -Path $SdkCacheDir -Filter "javac.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $JdkSearch) {
    $JdkZip = Join-Path $SdkCacheDir "jdk17.zip"
    $JdkDir = Join-Path $SdkCacheDir "jdk"
    New-Item -ItemType Directory -Force -Path $JdkDir | Out-Null
    if (-not (Test-Path $JdkZip)) {
        Write-Host "  -> Microsoft OpenJDK 17 다운로드 중 (최초 1회)..."
        & curl.exe -L -sS "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip" -o $JdkZip
    }
    & tar.exe -xf $JdkZip -C $JdkDir
    Remove-Item $JdkZip -Force
    $JdkSearch = Get-ChildItem -Path $JdkDir -Filter "javac.exe" -Recurse | Select-Object -First 1
}
$JdkBin   = $JdkSearch.DirectoryName
$JavaHome = Split-Path -Parent $JdkBin
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JdkBin;$env:PATH"

# 2. Android Build-Tools r34 준비
$AaptSearch = Get-ChildItem -Path $SdkCacheDir -Filter "aapt2.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $AaptSearch) {
    $BtZip = Join-Path $SdkCacheDir "build-tools-34.zip"
    $BtOutDir = Join-Path $SdkCacheDir "build-tools"
    New-Item -ItemType Directory -Force -Path $BtOutDir | Out-Null
    if (-not (Test-Path $BtZip)) {
        Write-Host "  -> Google Android Build-Tools r34 다운로드 중 (최초 1회)..."
        & curl.exe -L -sS "https://dl.google.com/android/repository/build-tools_r34-windows.zip" -o $BtZip
    }
    & tar.exe -xf $BtZip -C $BtOutDir
    Remove-Item $BtZip -Force
    $AaptSearch = Get-ChildItem -Path $BtOutDir -Filter "aapt2.exe" -Recurse | Select-Object -First 1
}
$BtDir = $AaptSearch.DirectoryName

# 3. Android Platform API 34 (android.jar) 준비
$AndroidJarSearch = Get-ChildItem -Path $SdkCacheDir -Filter "android.jar" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $AndroidJarSearch) {
    $PlatZip = Join-Path $SdkCacheDir "platform-34.zip"
    $PlatOutDir = Join-Path $SdkCacheDir "platforms"
    New-Item -ItemType Directory -Force -Path $PlatOutDir | Out-Null
    if (-not (Test-Path $PlatZip)) {
        Write-Host "  -> Google Android Platform API 34 다운로드 중 (최초 1회)..."
        & curl.exe -L -sS "https://dl.google.com/android/repository/platform-34-ext7_r02.zip" -o $PlatZip
    }
    & tar.exe -xf $PlatZip -C $PlatOutDir "*/android.jar"
    Remove-Item $PlatZip -Force
    $AndroidJarSearch = Get-ChildItem -Path $PlatOutDir -Filter "android.jar" -Recurse | Select-Object -First 1
}
$AndroidJar = $AndroidJarSearch.FullName

$Aapt2     = Join-Path $BtDir "aapt2.exe"
$ZipAlign  = Join-Path $BtDir "zipalign.exe"
$D8Jar     = Join-Path $BtDir "lib\d8.jar"
$SignerJar = Join-Path $BtDir "lib\apksigner.jar"
$JavaExe   = Join-Path $JdkBin "java.exe"
$JavacExe  = Join-Path $JdkBin "javac.exe"
$Keytool   = Join-Path $JdkBin "keytool.exe"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# 향후 버전 업그레이드 시 앱 삭제 없이 덮어쓰기 업데이트가 가능하도록 올클 전용 고정 서명키 생성·유지
$KeystorePath = Join-Path $PSScriptRoot "allclear-signing-key.jks"
if (-not (Test-Path $KeystorePath)) {
    & $Keytool -genkeypair -v `
        -keystore $KeystorePath `
        -alias allclear_key `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass allclear2026 `
        -keypass allclear2026 `
        -dname "CN=ALLCLEAR, OU=Logistics, O=AllClear, L=Suwon, ST=Gyeonggi, C=KR" | Out-Null
}

# 한글 경로에서 네이티브 aapt2.exe 인코딩 오류를 피하기 위해 ASCII 임시 폴더로 스테이징 후 컴파일
if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

$StageDir   = Join-Path $WorkDir "stage_main"
$GenDir     = Join-Path $WorkDir "gen"
$ClassesDir = Join-Path $WorkDir "classes"
$DexDir     = Join-Path $WorkDir "dex"
Copy-Item -Path $AppMainDir -Destination $StageDir -Recurse -Force
New-Item -ItemType Directory -Force -Path $GenDir, $ClassesDir, $DexDir | Out-Null

Write-Host "[2/5] 리소스 및 매니페스트 패키징 (aapt2)..." -ForegroundColor Cyan
$ResZip      = Join-Path $WorkDir "compiled_res.zip"
$UnsignedApk = Join-Path $WorkDir "unsigned.apk"
& $Aapt2 compile --dir (Join-Path $StageDir "res") -o $ResZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile 실패" }

& $Aapt2 link -o $UnsignedApk -I $AndroidJar --manifest (Join-Path $StageDir "AndroidManifest.xml") --java $GenDir $ResZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link 실패" }

Write-Host "[3/5] Java 네이티브 소스 컴파일 (javac)..." -ForegroundColor Cyan
$JavaSources = @()
$JavaSources += Get-ChildItem -Path (Join-Path $StageDir "java") -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
$JavaSources += Get-ChildItem -Path $GenDir -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }

& $JavacExe -encoding UTF-8 --release 11 -cp $AndroidJar -d $ClassesDir $JavaSources
if ($LASTEXITCODE -ne 0) { throw "javac 컴파일 실패" }

Write-Host "[4/5] DEX 바이트코드 변환 및 병합 (d8)..." -ForegroundColor Cyan
$ClassFiles = Get-ChildItem -Path $ClassesDir -Filter "*.class" -Recurse | ForEach-Object { $_.FullName }
& $JavaExe -cp $D8Jar com.android.tools.r8.D8 --lib $AndroidJar --min-api 26 --output $DexDir $ClassFiles
if ($LASTEXITCODE -ne 0) { throw "d8 변환 실패" }

$ZipArchive = [System.IO.Compression.ZipFile]::Open($UnsignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $DexEntryPath = Join-Path $DexDir "classes.dex"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $ZipArchive,
        $DexEntryPath,
        "classes.dex",
        [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
} finally {
    $ZipArchive.Dispose()
}

Write-Host "[5/5] zipalign 및 V1+V2+V3 정식 전자서명(apksigner)..." -ForegroundColor Cyan
$AlignedApk  = Join-Path $WorkDir "aligned.apk"
$OutFileName = "allclear-app.apk"
$SignedApk   = Join-Path $WorkDir $OutFileName

& $ZipAlign -f -p 4 $UnsignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign 실패" }

& $JavaExe -jar $SignerJar sign `
    --ks $KeystorePath `
    --ks-key-alias allclear_key `
    --ks-pass pass:allclear2026 `
    --key-pass pass:allclear2026 `
    --v1-signing-enabled true `
    --v2-signing-enabled true `
    --v3-signing-enabled true `
    --out $SignedApk `
    $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner 서명 실패" }

& $JavaExe -jar $SignerJar verify --verbose $SignedApk | Out-Null
if ($LASTEXITCODE -ne 0) { throw "APK 서명 검증 실패" }

$DistTarget    = Join-Path $OutDistDir    $OutFileName
$WebTarget     = Join-Path $WebPubDir     $OutFileName
$BackendTarget = Join-Path $BackendPubDir $OutFileName
Copy-Item -Path $SignedApk -Destination $DistTarget    -Force
Copy-Item -Path $SignedApk -Destination $WebTarget     -Force
Copy-Item -Path $SignedApk -Destination $BackendTarget -Force

$SizeKb = [Math]::Round((Get-Item $WebTarget).Length / 1KB, 1)
Write-Host ""
Write-Host "✅ 올클 문자자동접수 APK 빌드 및 서명 검증 완료! ($SizeKb KB)" -ForegroundColor Green
Write-Host "   - 프론트 배포 경로 : $WebTarget"
Write-Host "   - 백엔드 배포 경로 : $BackendTarget"
