param(
  [string]$OutputPath = "../Inventory-App-clean.zip",
  [string]$Prefix = "Inventory-App/",
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

$Root = git rev-parse --show-toplevel
Set-Location $Root

$Status = git status --porcelain
if ($Status -and -not $AllowDirty) {
  Write-Error @"
Working tree belum bersih.
ZIP bersih dibuat dari commit HEAD, jadi perubahan yang belum di-commit tidak akan ikut.

$Status

Selesaikan dulu:
  git add .
  git commit -m "pesan perubahan"
  git push origin $(git branch --show-current)

Atau pakai shortcut aman:
  npm run git:push -- "pesan perubahan"

Override sadar risiko:
  powershell -ExecutionPolicy Bypass -File scripts/create-clean-zip.ps1 -AllowDirty
"@
}

git archive --format=zip --prefix=$Prefix --output=$OutputPath HEAD

Write-Host "ZIP bersih dibuat: $OutputPath"
Write-Host "Sumber: git archive HEAD"
Write-Host "Runtime database lokal, backup, node_modules, dan dist tidak ikut. .gitattributes juga menjaga artifact backup/data yang ter-track tidak masuk git archive."
