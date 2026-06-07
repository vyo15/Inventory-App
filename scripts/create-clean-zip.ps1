param(
  [string]$OutputPath = "../Inventory-App-clean.zip",
  [string]$Prefix = "Inventory-App/"
)

$ErrorActionPreference = "Stop"

$Root = git rev-parse --show-toplevel
Set-Location $Root

$Status = git status --porcelain
if ($Status) {
  Write-Warning "Working tree belum bersih. ZIP akan dibuat dari commit HEAD, bukan perubahan yang belum di-commit."
}

git archive --format=zip --prefix=$Prefix --output=$OutputPath HEAD

Write-Host "ZIP bersih dibuat: $OutputPath"
Write-Host "Sumber: git archive HEAD"
Write-Host "Runtime database lokal, backup, node_modules, dan dist tidak ikut selama tidak tracked di Git."
