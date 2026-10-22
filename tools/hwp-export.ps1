# HTML 문서를 한글(HWP) 파일로 변환 — 한글 프로그램의 자동화 기능(COM)을 씁니다.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File tools\hwp-export.ps1 -Source "..\문서.source.html"
#   powershell -ExecutionPolicy Bypass -File tools\hwp-export.ps1 -Source "..\문서.source.html" -Out "..\내문서.hwp"
#
# 원본 HTML(UTF-8)은 그대로 두고, 변환용 사본만 임시로 만들어 씁니다.
#
# 왜 임시 사본을 만드나:
#   원본 HTML 을 그대로 열지 않고 사본을 쓴다 — cp949 에 없는 문자(—, 화살표)나
#   `&gt;` 같은 엔티티를 미리 안전한 문자로 바꿔서 넣기 위해서다.
#
# 인코딩 주의 (2026-09-17 확인):
#   이 PC 는 시스템 기본 코드페이지가 UTF-8(65001)이다. 한글은 파일을 그 기준으로 읽으므로
#   사본도 UTF-8(BOM 없음)로 쓴다.
#   또 GetTextFile 로 본문을 문자열로 받으면 한글이 깨진다 — 반드시 파일로 받아
#   cp949 로 읽어야 제대로 읽힌다(아래 검사 코드가 그렇게 한다).
#
# ponytail: 한글 첫 실행이 느리다(10~90초). 스크립트를 고치기 전에 한 번 더 돌려 볼 것.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Out
)

$ErrorActionPreference = "Stop"
$src = (Resolve-Path $Source).Path

if (-not $Out) {
  # "문서.source.html" → "문서.hwp" (원본 표시인 .source 는 이름에서 뗀다)
  $base = [IO.Path]::GetFileNameWithoutExtension($src)
  if ($base.EndsWith(".source")) { $base = $base.Substring(0, $base.Length - 7) }
  $Out = Join-Path (Split-Path -Parent $src) "$base.hwp"
}
$outPath = [IO.Path]::GetFullPath($Out)
if (Test-Path $outPath) { throw "이미 있습니다: $outPath  (지우거나 -Out 으로 다른 이름을 주세요)" }

# --- 변환용 사본 만들기 ---
$html = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)
$html = $html.Replace([string][char]0x2014, '-')      # em dash
$html = $html.Replace([string][char]0x2013, '-')      # en dash
$html = $html.Replace([string][char]0x2026, '...')    # …
$html = $html.Replace('&gt;', [string][char]0x2192)   # &gt; 를 화살표로
$html = $html.Replace('&lt;', [string][char]0x2190)
$html = $html.Replace('&amp;', '&')

$tmp = Join-Path $env:TEMP ("hwp-src-" + [guid]::NewGuid().ToString('N') + ".html")
[IO.File]::WriteAllText($tmp, $html, (New-Object System.Text.UTF8Encoding($false)))

$hwp = $null
try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject

  # 스크립트에서 파일을 열 때 뜨는 보안 경고를 넘긴다 (DLL 이 등록된 PC 에서만 동작)
  try { $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule") | Out-Null } catch { }

  # 대화상자 자동 처리 — 조판(0x00010000) + 파일(0x00020000) 둘 다 필요하다
  try { $hwp.SetMessageBoxMode(0x00010000) | Out-Null } catch { }
  try { $hwp.SetMessageBoxMode(0x00020000) | Out-Null } catch { }
  try { $hwp.XHwpWindows.Item(0).Visible = $false } catch { }

  $hwp.Open($tmp, "HTML", "forceopen:true") | Out-Null

  # 저장 전에 본문을 확인 — 인코딩이 깨졌으면 여기서 걸러낸다.
  # GetTextFile 로 문자열을 받으면 이 PC 에서는 깨진다(한글 쪽 버그).
  # 본문을 TEXT 파일로 벗겨낸 뒤 cp949 로 읽어야 제대로 읽힌다.
  $rawTxt = Join-Path $env:TEMP ("hwp-extract-" + [guid]::NewGuid().ToString('N') + ".txt")
  $hwp.SaveAs($rawTxt, "TEXT", "") | Out-Null
  if (-not (Test-Path $rawTxt)) { throw "본문을 읽지 못했습니다 (TEXT 저장 실패)" }
  $text = [Text.Encoding]::GetEncoding(949).GetString([IO.File]::ReadAllBytes($rawTxt))
  Remove-Item $rawTxt -Force -ErrorAction SilentlyContinue

  $hangul = ([regex]::Matches($text, '[\uAC00-\uD7A3]')).Count
  $bad = ([regex]::Matches($text, [string][char]0xFFFD)).Count

  # 본문을 텍스트로 내보내 두면 눈으로 대조할 수 있다
  $dump = Join-Path $env:TEMP "hwp-last-extract.txt"
  [IO.File]::WriteAllText($dump, $text, (New-Object System.Text.UTF8Encoding($false)))

  if ($hangul -lt 200) { throw "한글 글자가 너무 적습니다($hangul 자) — 변환이 잘못됐습니다. 본문 확인: $dump" }

  # SaveAs(경로, 형식, 옵션) — 3개 인자를 요구한다. 본문을 확인한 뒤 저장한다.
  $hwp.SaveAs($outPath, "HWP", "") | Out-Null

  "변환 완료: $outPath"
  "  크기: {0:N0} 바이트 · 본문 {1:N0}자 (한글 {2:N0}자)" -f (Get-Item $outPath).Length, $text.Length, $hangul
  "  본문 대조용 텍스트: $dump"
  if ($bad -gt 0) { "  경고: 읽을 수 없는 글자 $bad 자 — 문서를 열어 해당 부분을 확인하세요" }
}
finally {
  if ($hwp) { try { $hwp.Quit() } catch { } }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}
