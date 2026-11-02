# Chạy cả TrainAI để phát triển: Python API ở cửa sổ riêng, Next.js ở cửa sổ này.
# Dùng: .\scripts\dev.ps1   (từ thư mục gốc dự án)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "Chưa có .venv. Chạy: python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt"
    exit 1
}
foreach ($file in @(".env", "web\.env.local")) {
    if (-not (Test-Path (Join-Path $root $file))) {
        Write-Host "Thiếu $file. Copy từ file .env.example tương ứng rồi điền giá trị (xem README)."
        exit 1
    }
}
if (-not (Test-Path (Join-Path $root "web\node_modules"))) {
    Push-Location (Join-Path $root "web"); npm install; Pop-Location
}

Write-Host "Mở Python API (http://127.0.0.1:8501) ở cửa sổ mới…"
Start-Process -FilePath $python -ArgumentList "app\server.py" -WorkingDirectory $root

Write-Host "Chạy Next.js (http://localhost:3000)…"
Set-Location (Join-Path $root "web")
npm run dev
