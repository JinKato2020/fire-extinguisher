# 消防6類 ビルド起動スクリプト（CAE build_cae.ps1 を iOS専用へ）
# ------------------------------------------------------------------
# Build番号 = 1 + コミット数 を自動計算し、必ず -f build_number で渡す。
# → GitHub Actions の run 名が「消防6類 v<version> (<番号>) — iOS ビルド」になる。
# アプリ設定画面のビルド番号表示(src/buildInfo.ts)も、この番号でビルド時に埋め込まれる。
#
# 使い方:
#   pwsh tools/build_fire6.ps1                 # iOSビルド → TestFlight 提出
#   pwsh tools/build_fire6.ps1 -NoSubmit       # ビルドのみ(提出しない)
#   pwsh tools/build_fire6.ps1 -ForceIos       # 1日上限ガードを無視して提出
# ------------------------------------------------------------------
param(
  [switch]$NoSubmit,
  [switch]$ForceIos
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# 1) ビルド番号 = 1 + コミット数
$commits = [int](git rev-list --count HEAD)
$build = 1 + $commits

# 2) アプリ版は app.json から取得(ベタ書きしない)
$appVersion = (Get-Content app.json -Raw | ConvertFrom-Json).expo.version

# 3) CI はリモート main を checkout するので、未push だと番号(コミット数)がズレる → 事前チェック
git fetch origin main --quiet 2>$null
$localHead = (git rev-parse HEAD).Trim()
$remoteHead = (git rev-parse origin/main 2>$null)
if ($remoteHead) { $remoteHead = $remoteHead.Trim() }
if ($localHead -ne $remoteHead) {
  Write-Host "⚠ ローカル HEAD と origin/main が不一致です。先に git push してください（未pushだとCIの番号がズレます）。" -ForegroundColor Yellow
  Write-Host "  local=$localHead  remote=$remoteHead"
  $ans = Read-Host "このまま起動しますか? (y/N)"
  if ($ans -ne 'y') { Write-Host "中止しました。"; exit 1 }
}

$submit = if ($NoSubmit) { 'false' } else { 'true' }
$runName = "消防6類 v$appVersion ($build) — iOS ビルド"
Write-Host "▶ 起動: $runName" -ForegroundColor Cyan
Write-Host "  submit=$submit  force_ios=$([bool]$ForceIos)"

$ghArgs = @(
  'workflow', 'run', 'build-fire6.yml', '--ref', 'main',
  '-f', "build_number=$build",
  '-f', "app_version=$appVersion",
  '-f', "submit=$submit"
)
if ($ForceIos) { $ghArgs += @('-f', 'force_ios=true') }

& gh @ghArgs
if ($LASTEXITCODE -ne 0) { throw "gh workflow run が失敗しました" }

Start-Sleep -Seconds 3
Write-Host "`n最新の実行:" -ForegroundColor Cyan
gh run list --workflow=build-fire6.yml -L 1
Write-Host "`n✅ 起動しました。run名に v$appVersion ($build) が入ります。" -ForegroundColor Green
