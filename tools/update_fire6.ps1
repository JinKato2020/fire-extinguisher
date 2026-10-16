# 消防6類 コードOTA（EAS Update）発行スクリプト
# ------------------------------------------------------------------
# 画面・ロジック(JS/TS)の変更を、ビルド・審査なしで配信する。
# 反映は「土台ビルド(1004以降=expo-updates入り)を入れたアプリを再起動」したとき。
#
# 重要:
#   ・必ず --platform ios を付ける（app.json に web があるため all だと web依存で export 失敗）。
#   ・CI=1 を付ける（--non-interactive は expo export では無効）。
#   ・コンテンツ(問題/教材/図=content/*.json)はこれではなく R2 配信ワークフローで配る。
#
# 使い方:
#   pwsh tools/update_fire6.ps1 "第4章の誤字修正"
# ------------------------------------------------------------------
param(
  [Parameter(Mandatory = $true)][string]$Message
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$env:CI = '1'
Write-Host "▶ EAS Update 発行: branch=production platform=ios" -ForegroundColor Cyan
Write-Host "  message: $Message"
& npx eas update --branch production --platform ios --message "$Message"
if ($LASTEXITCODE -ne 0) { throw "eas update が失敗しました" }
Write-Host "`n✅ 配信しました。実機アプリを再起動すると反映されます（土台ビルド1004以降が必要）。" -ForegroundColor Green
