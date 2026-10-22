# 매일 자동 홍보 실행 등록 (Windows 작업 스케줄러) — 무료, 관리자 권한 불필요
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File tools\install-task.ps1
#   powershell -ExecutionPolicy Bypass -File tools\install-task.ps1 -Time 08:30
#   powershell -ExecutionPolicy Bypass -File tools\install-task.ps1 -Remove
#
# 등록되는 작업: 매일 지정 시각에 tools\promo-daily.cmd 실행
#   → 페이스북 페이지 게시 1건 + 블로거 발행 1건 + 토큰 채널 1건, 결과는 tools\promo-log.txt
#   확인: node tools\promo-logs.mjs
# PC 가 꺼져 있으면 그 회차는 건너뜁니다(다음에 켜졌을 때 몰아서 올리지 않음).
#
# ※ schtasks 명령을 쓰지 않고 ScheduledTasks 모듈을 쓴다.
#   schtasks 는 없는 작업을 조회할 때도 오류를 내서 스크립트가 중간에 멈췄다(실측).

param(
  [string]$Time = "09:00",
  [switch]$Remove,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$TaskName = "nodong-promo"
$Runner   = Join-Path $PSScriptRoot "promo-daily.cmd"

Import-Module ScheduledTasks -ErrorAction Stop

function Get-NodongTask {
  Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

if ($Remove) {
  if (Get-NodongTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    "삭제했습니다: $TaskName"
  } else {
    "등록된 작업이 없습니다: $TaskName"
  }
  exit 0
}

if (-not (Test-Path -LiteralPath $Runner)) { throw "파일이 없습니다: $Runner" }

if ((Get-NodongTask) -and -not $Force) {
  "이미 등록되어 있습니다: $TaskName"
  "  시각 변경:  powershell -File tools\install-task.ps1 -Time 08:30 -Force"
  "  삭제:       powershell -File tools\install-task.ps1 -Remove"
  "  내용 보기:  Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo"
  exit 0
}

$action  = New-ScheduledTaskAction -Execute $Runner
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

$info = Get-ScheduledTaskInfo -TaskName $TaskName
"등록 완료"
"  작업 이름: $TaskName"
"  실행 시각: 매일 $Time"
"  실행 내용: $Runner"
"  다음 실행: $($info.NextRunTime)"
""
"확인:  powershell -Command ""Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName,State"""
"지금 한 번 돌려보기:  powershell -Command ""Start-ScheduledTask -TaskName $TaskName"""
"삭제:  powershell -ExecutionPolicy Bypass -File tools\install-task.ps1 -Remove"
