param(
  [string]$OutputPath = "../Inventory-App-clean.zip",
  [string]$Prefix = "Inventory-App/",
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Assert-NativeCommandSucceeded {
  param([string]$Step)

  if ($LASTEXITCODE -ne 0) {
    throw "$Step gagal dengan exit code $LASTEXITCODE. ZIP tidak dibuat."
  }
}

$Root = (& git rev-parse --show-toplevel).Trim()
Assert-NativeCommandSucceeded "Membaca root repository Git"
Set-Location $Root

$Status = & git status --porcelain
Assert-NativeCommandSucceeded "Membaca status repository Git"
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

$VerifyArgs = @("scripts/verify-source-ready.cjs")
if ($AllowDirty) {
  $VerifyArgs += "--allow-dirty"
}
& node @VerifyArgs
Assert-NativeCommandSucceeded "Validasi source readiness"

& git archive --format=zip --prefix=$Prefix --output=$OutputPath HEAD
Assert-NativeCommandSucceeded "Membuat ZIP dari commit HEAD"

if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
  throw "Git archive selesai tanpa menghasilkan file ZIP: $OutputPath"
}

& node scripts/verify-source-ready.cjs --archive-only $OutputPath
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
  throw "Validasi isi ZIP gagal. Artifact yang tidak aman sudah dihapus."
}

Write-Host "ZIP bersih dibuat dan diverifikasi: $OutputPath"
Write-Host "Sumber: git archive HEAD"
Write-Host "Runtime database lokal, backup, node_modules, dan dist tidak ikut. .gitattributes juga menjaga artifact backup/data yang ter-track tidak masuk git archive."
