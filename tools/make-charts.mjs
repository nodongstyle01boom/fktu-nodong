// 노동연대 블로그용 SVG 차트·도표 10종 생성기
// 출력: img/chart-*.svg  (블로그·사이트 양쪽에서 <img src="https://nodong.seoulblue.com/img/chart-xxx.svg"> 로 사용)
// 사용: node tools/make-charts.mjs
// 검산: 생성 후 파일 존재 + 각 SVG에 </svg> 태그 확인. 색은 site 팔레트(#c0392b 레드 계열)를 따른다.
// 원칙: 실제 통계 수치는 넣지 않는다(출처·연도 표기 문제). 개념 설명용 도표와 "예시" 라벨이 붙은 가상 예시만 다룬다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'img');
mkdirSync(OUT, { recursive: true });

const RED = '#c0392b';
const RED_DARK = '#96281b';
const INK = '#222';
const MUTED = '#666';
const BG = '#fff5f5';
const LINE = '#e5e5e5';
const BLUE = '#2c5f8a';
const GREEN = '#3d7a4f';
const FONT = 'font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"';

const wrap = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>` +
  `<rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;

const text = (x, y, s, { size = 14, fill = INK, weight = '', anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${weight ? `font-weight="${weight}"` : ''} text-anchor="${anchor}">${s}</text>`;

// 1. 연차 발생·소멸 흐름도
const chartAnnual = wrap(760, 300, `
  ${text(380, 34, '연차휴가 — 발생에서 수당까지', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['1년 미만', '개월 수에 따라\n1개월 만근 시 1일', 60],
    ['1년 이상', '8개 이상 만근 시\n15일 발생', 290],
    ['미사용 시', '사용 촉진 절차 후\n소멸 가능', 520],
  ].map(([t, d, x]) => `
    <rect x="${x}" y="70" width="180" height="96" rx="10" fill="${BG}" stroke="${RED}" stroke-width="2"/>
    ${text(x + 90, 100, t, { size: 16, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${d.split('\n').map((l, i) => text(x + 90, 128 + i * 20, l, { size: 12.5, anchor: 'middle', fill: INK })).join('')}
  `).join('')}
  <path d="M240 118 L290 118" stroke="${RED}" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M470 118 L520 118" stroke="${RED}" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="230" y="200" width="520" height="70" rx="8" fill="#fff" stroke="${LINE}"/>
  ${text(490, 228, '촉진 절차를 지키지 않으면 연차는 소멸하지 않는다', { size: 14, weight: 'bold', anchor: 'middle', fill: RED_DARK })}
  ${text(490, 252, '사용 시기 결정권은 원칙적으로 근로자에게 있음', { size: 12.5, anchor: 'middle', fill: MUTED })}
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="${RED}" stroke-width="1.5"/></marker></defs>
`);

// 2. 통상임금·평균임금 비교표 이미지
const chartWage = wrap(760, 330, `
  ${text(380, 34, '평균임금과 통상임금 — 무엇이 다른가', { size: 18, weight: 'bold', anchor: 'middle' })}
  <rect x="50" y="60" width="320" height="220" rx="10" fill="#f8fbff" stroke="${BLUE}" stroke-width="2"/>
  ${text(210, 92, '평균임금', { size: 17, weight: 'bold', fill: BLUE, anchor: 'middle' })}
  ${['산정: 퇴직 등 사유 발생일 전\n3개월간 지급액 ÷ 총 일수', '쓰임: 퇴직금', '· 산재 휴업급여', '· 해고예고수당'].map(s =>
    s.split('\n').map((l, i) => text(210, 126 + i * 24, l, { size: 13, anchor: 'middle' })).join('')).join('')}
  <rect x="390" y="60" width="320" height="220" rx="10" fill="${BG}" stroke="${RED}" stroke-width="2"/>
  ${text(550, 92, '통상임금', { size: 17, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
  ${['정의: 정기·일률적으로', '· 근로에 대한 대가로 지급', '쓰임: 연장·야간·휴일수당', '· 연차수당 계산 기준'].map(s =>
    s.split('\n').map((l, i) => text(550, 126 + i * 24, l, { size: 13, anchor: 'middle' })).join('')).join('')}
  ${text(380, 312, '두 기준이 달라 같은 월급이라도 계산 결과가 다르다', { size: 13.5, fill: MUTED, anchor: 'middle' })}
`);

// 3. 임금체불 대응 절차 타임라인
const chartWageClaim = wrap(760, 280, `
  ${text(380, 34, '임금체불 — 순서대로 대응하기', { size: 18, weight: 'bold', anchor: 'middle' })}
  <line x1="70" y1="130" x2="690" y2="130" stroke="${LINE}" stroke-width="3"/>
  ${[
    ['1', '증거 모으기', '근로계약서·임금명세서\n출탁기록·통장 사본'],
    ['2', '사내 요구', '내용증명으로\n지급 요구'],
    ['3', '진정서', '관할 노동청에\n진정서 제출'],
    ['4', '형사 고소', '노동법 위반\n고소도 가능'],
  ].map(([n, t, d], i) => {
    const x = 70 + i * 186;
    return `
    <circle cx="${x}" cy="130" r="22" fill="${RED}"/>
    ${text(x, 136, n, { size: 16, weight: 'bold', fill: '#fff', anchor: 'middle' })}
    ${text(x, 88, t, { size: 15, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${d.split('\n').map((l, j) => text(x, 176 + j * 20, l, { size: 12, anchor: 'middle', fill: MUTED })).join('')}`;
  }).join('')}
  ${text(380, 258, '소멸시효 전에 움직여야 한다 — 임금채권도 시간이 지나면 사라진다', { size: 13.5, fill: RED_DARK, anchor: 'middle' })}
`);

// 4. 산재 처리 흐름도
const chartSafety = wrap(760, 320, `
  ${text(380, 34, '산업재해 — 신고부터 급여까지', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['사고 발생', '요양 필요', 60, 70],
    ['의료기관 진료', '산재 지정병원 확인', 60, 190],
    ['요양급여 신청', '사업주가 신청\n안 하면 본인도 가능', 400, 70],
    ['급여 결정·지급', '휴업급여 등', 400, 190],
  ].map(([t, d, x, y]) => `
    <rect x="${x}" y="${y}" width="300" height="86" rx="10" fill="#fff" stroke="${RED}" stroke-width="2"/>
    ${text(x + 150, y + 32, t, { size: 15.5, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${d.split('\n').map((l, i) => text(x + 150, y + 56 + i * 19, l, { size: 12, anchor: 'middle', fill: MUTED })).join('')}
  `).join('')}
  <path d="M360 113 L400 113 L400 190 L360 190" fill="none" stroke="${RED}" stroke-width="2"/>
  ${text(380, 306, '회사가 "산재로 처리하지 말라"고 하면 산재 은폐 — 노동청·경찰에 신고 가능', { size: 13.5, fill: RED_DARK, anchor: 'middle' })}
`);

// 5. 근로계약서 확인 포인트 체크이미지
const chartContract = wrap(760, 300, `
  ${text(380, 34, '근로계약서 — 반드시 확인할 6가지', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['임금', '구성·지급일·지급 방법'],
    ['근로시간', '시작·끝·휴게시간'],
    ['업무 내용', '계약서와 실제 일치?'],
    ['계약 기간', '기간제라면 갱신 조건'],
    ['퇴직금', 'DB·DC·IRP 여부'],
    ['규칙', '취업규칙 불리한 변경 없나'],
  ].map(([t, d], i) => {
    const x = 60 + (i % 3) * 220;
    const y = 66 + Math.floor(i / 3) * 108;
    return `
    <rect x="${x}" y="${y}" width="200" height="88" rx="10" fill="${BG}" stroke="${RED}" stroke-width="1.6"/>
    ${text(x + 100, y + 34, `${i + 1}. ${t}`, { size: 15, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${text(x + 100, y + 62, d, { size: 12, anchor: 'middle', fill: INK })}`;
  }).join('')}
  ${text(380, 286, '근로계약서를 회사가 안 주면 노동청에 신고할 수 있다', { size: 13.5, fill: MUTED, anchor: 'middle' })}
`);

// 6. 해고 — 절차와 구제 (예시 막대그래프 포함 개념도)
const chartFiring = wrap(760, 320, `
  ${text(380, 34, '해고 — 법이 요구하는 절차', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['해고 사유', '정리해고는 4요건 별도 충족', 60],
    ['30일 전 예고', '또는 예고수당 30일분', 310],
    ['서면 통지', '구두 해고는 무효 가능', 560],
  ].map(([t, d, x]) => `
    <rect x="${x}" y="66" width="200" height="86" rx="10" fill="#fff" stroke="${BLUE}" stroke-width="2"/>
    ${text(x + 100, 96, t, { size: 15, weight: 'bold', fill: BLUE, anchor: 'middle' })}
    ${text(x + 100, 124, d, { size: 12, anchor: 'middle', fill: MUTED })}
  `).join('')}
  <path d="M260 109 L310 109" stroke="${BLUE}" stroke-width="2" marker-end="url(#a2)"/>
  <path d="M510 109 L560 109" stroke="${BLUE}" stroke-width="2" marker-end="url(#a2)"/>
  <rect x="90" y="190" width="620" height="86" rx="10" fill="${BG}" stroke="${RED}" stroke-width="2"/>
  ${text(400, 222, '절차 위반 해고라면 — 노동위원회 구제신청', { size: 15, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
  ${text(400, 250, '부당해고 구제신청은 해고일부터 3개월 안에', { size: 12.5, anchor: 'middle', fill: MUTED })}
  <defs><marker id="a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="${BLUE}" stroke-width="1.5"/></marker></defs>
  ${text(400, 308, '해고는 "이유 + 절차" 둘 다 있어야만 법적으로 유효하다', { size: 13, fill: MUTED, anchor: 'middle' })}
`);

// 7. 예시: 월급 300만원 근로자의 수당 계산 구조 (예시 명시)
const chartCalc = wrap(760, 340, `
  ${text(380, 34, '수당 계산 구조 (예시)', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${text(380, 58, '※ 아래 숫자는 계산 방식 설명을 위한 가상 예시입니다', { size: 12, fill: MUTED, anchor: 'middle' })}
  ${[
    ['기본급', 180, 2000000, RED],
    ['연장수당', 120, 350000, BLUE],
    ['야간수당', 80, 250000, BLUE],
    ['휴일수당', 60, 200000, BLUE],
    ['연차수당', 100, 200000, GREEN],
  ].map(([label, w, v, color], i) => {
    const y = 84 + i * 44;
    return `
    ${text(150, y + 22, label, { size: 13.5, weight: 'bold' })}
    <rect x="230" y="${y}" width="${w * 2}" height="30" rx="5" fill="${color}" opacity="0.85"/>
    ${text(230 + w * 2 + 12, y + 21, v.toLocaleString() + '원', { size: 12.5, fill: MUTED })}`;
  }).join('')}
  <line x1="230" y1="300" x2="670" y2="300" stroke="${LINE}" stroke-width="2"/>
  ${text(230, 326, '합계', { size: 14, weight: 'bold' })}
  ${text(470, 326, '3,000,000원', { size: 14, weight: 'bold', fill: RED_DARK })}
  ${text(660, 326, '(가상 예시)', { size: 11.5, fill: MUTED, anchor: 'end' })}
`);

// 8. 노동조합 가입 효과 도표
const chartUnion = wrap(760, 300, `
  ${text(380, 34, '노동조합이 있는 사업장 vs 없는 사업장', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${text(380, 58, '※ 일반적 경향을 그린 개념도입니다 (특정 통계 아님)', { size: 12, fill: MUTED, anchor: 'middle' })}
  <rect x="90" y="90" width="250" height="60" rx="8" fill="${GREEN}" opacity="0.85"/>
  ${text(215, 126, '교섭으로 임금·조건 개선', { size: 14, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  <rect x="90" y="170" width="250" height="60" rx="8" fill="${GREEN}" opacity="0.6"/>
  ${text(215, 206, '부당 대우에 대한 집단 대응', { size: 14, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  <rect x="420" y="90" width="250" height="60" rx="8" fill="#bbb"/>
  ${text(545, 126, '혼자서 회사와 맞서야 함', { size: 14, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  <rect x="420" y="170" width="250" height="60" rx="8" fill="#ccc"/>
  ${text(545, 206, '조건 변경 요구도 개인 단위', { size: 14, weight: 'bold', fill: '#555', anchor: 'middle' })}
  ${text(215, 268, '조합 있음', { size: 14, weight: 'bold', fill: GREEN, anchor: 'middle' })}
  ${text(545, 268, '조합 없음', { size: 14, weight: 'bold', fill: MUTED, anchor: 'middle' })}
`);

// 9. 사회보험 요약 표
const chartInsurance = wrap(760, 330, `
  ${text(380, 34, '4대 사회보험 — 누가 내는가', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${text(380, 58, '※ 요율은 매년 바뀌므로 표기하지 않음 — 각 기관 공시로 확인', { size: 12, fill: MUTED, anchor: 'middle' })}
  <rect x="60" y="80" width="640" height="40" fill="${RED}"/>
  ${text(200, 106, '국민연금', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${text(340, 106, '건강보험', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${text(490, 106, '고용보험', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${text(620, 106, '산재보험', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${[
    ['근로자 부담', 'O', 'O', 'O', 'X'],
    ['사업주 부담', 'O', 'O', 'O', 'O'],
    ['실업급여 관련', '-', '-', 'O', '-'],
    ['산재 급여 관련', '-', '-', '-', 'O'],
  ].map(([row, ...cells], i) => {
    const y = 120 + i * 44;
    return `
    ${text(200, y + 26, row, { size: 13.5, weight: 'bold' })}
    ${cells.map((c, j) => text([340, 490, 620][j], y + 26, c, { size: 15, weight: 'bold', fill: c === 'O' ? GREEN : c === 'X' ? RED : MUTED, anchor: 'middle' })).join('')}
    <line x1="60" y1="${y + 40}" x2="700" y2="${y + 40}" stroke="${LINE}"/>`;
  }).join('')}
  ${text(380, 322, '산재보험은 전액 사업주 부담 — 근로자가 낼 돈이 아니다', { size: 13.5, fill: RED_DARK, anchor: 'middle' })}
`);

// 10. 괴롭힘·갑질 신고 절차
const chartReport = wrap(760, 300, `
  ${text(380, 34, '직장 괴롭힘 — 신고 절차', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['기록', '일시·장소·내용·목격자', 70],
    ['회사 신고', '사내 신고 채널 이용', 290],
    ['외부 신고', '고용노동부 신고·상담', 510],
  ].map(([t, d, x]) => `
    <rect x="${x}" y="70" width="180" height="90" rx="10" fill="${BG}" stroke="${RED}" stroke-width="2"/>
    ${text(x + 90, 100, t, { size: 15.5, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${d.split('\n').map((l, i) => text(x + 90, 126 + i * 19, l, { size: 12, anchor: 'middle', fill: INK })).join('')}
  `).join('')}
  <path d="M250 115 L290 115" stroke="${RED}" stroke-width="2" marker-end="url(#a3)"/>
  <path d="M470 115 L510 115" stroke="${RED}" stroke-width="2" marker-end="url(#a3)"/>
  <rect x="120" y="200" width="520" height="64" rx="8" fill="#fff" stroke="${LINE}"/>
  ${text(380, 228, '신고했다는 이유로 불이익을 주면 별도의 위법행위가 된다', { size: 14, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
  ${text(380, 250, '신고 기록은 날짜까지 남긴다', { size: 12.5, anchor: 'middle', fill: MUTED })}
  <defs><marker id="a3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="${RED}" stroke-width="1.5"/></marker></defs>
`);

// 11. 증거 노트 5단계 도표
const chartEvidence = wrap(760, 300, `
  ${text(380, 34, '증거 노트 — 5단계로 만들기', { size: 18, weight: 'bold', anchor: 'middle' })}
  ${[
    ['1', '폴더 나누기', '체불 / 해고 /\n산재 / 괴롭힘'],
    ['2', '날짜 순 기록', '일어난 일을\n5W1H로 적기'],
    ['3', '원본 보관', '채팅·메일은 원본과\n캡처 함께'],
    ['4', '월별 대조', '통장 기록과\n임금명세서 대조'],
    ['5', '목격자 메모', '이름과\n연락처 남기기'],
  ].map(([n, t, d], i) => {
    const x = 48 + i * 142;
    return `
    <rect x="${x}" y="70" width="128" height="120" rx="10" fill="${BG}" stroke="${RED}" stroke-width="1.6"/>
    <circle cx="${x + 64}" cy="100" r="18" fill="${RED}"/>
    ${text(x + 64, 106, n, { size: 15, weight: 'bold', fill: '#fff', anchor: 'middle' })}
    ${text(x + 64, 140, t, { size: 13, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
    ${d.split('\n').map((l, j) => text(x + 64, 162 + j * 18, l, { size: 10.5, anchor: 'middle', fill: MUTED })).join('')}`;
  }).join('')}
  ${text(380, 244, '녹음은 대화 당사자가 하면 적법성 문제가 적다', { size: 13.5, fill: RED_DARK, anchor: 'middle' })}
  ${text(380, 270, '캡처만 남기고 원본을 지우지 말 것', { size: 12.5, fill: MUTED, anchor: 'middle' })}
`);

// 12. 기간제·단시간 권리 도표 (오해 vs 실제)
const chartLimits = wrap(760, 300, `
  ${text(380, 34, '기간제·단시간 — 오해 vs 실제', { size: 18, weight: 'bold', anchor: 'middle' })}
  <rect x="70" y="64" width="300" height="30" fill="#999"/>
  <rect x="390" y="64" width="300" height="30" fill="${RED}"/>
  ${text(220, 85, '오해', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${text(540, 85, '실제', { size: 14.5, weight: 'bold', fill: '#fff', anchor: 'middle' })}
  ${[
    ['계약직은 해고예고가 필요 없다', '계약직도 해고 절차가 필요하다'],
    ['단시간 근로자는 연차가 없다', '근로시간 비율로 연차가 생긴다'],
    ['수당은 정규직만 받는다', '연장·야간·휴일근로 시 똑같이 발생'],
    ['기간 끝나면 알아서 끝난다', '계속 근로 시 갱신 요구 권리가 있다'],
  ].map(([myth, fact], i) => {
    const y = 94 + i * 44;
    return `
    ${text(85, y + 24, myth, { size: 12.5, fill: MUTED })}
    ${text(405, y + 24, fact, { size: 12.5, weight: 'bold', fill: RED_DARK })}
    <line x1="70" y1="${y + 40}" x2="690" y2="${y + 40}" stroke="${LINE}"/>`;
  }).join('')}
  ${text(380, 288, '같거나 유사한 업무라면 차별적 처우는 법 위반 — 노동위에 시정 신청 가능', { size: 13, fill: RED_DARK, anchor: 'middle' })}
`);

// 13. 내용증명 vs 진정서 비교 도표
const chartNotice = wrap(760, 300, `
  ${text(380, 34, '내용증명 vs 진정서 — 언제 무엇을', { size: 18, weight: 'bold', anchor: 'middle' })}
  <rect x="60" y="70" width="300" height="180" rx="10" fill="#f8fbff" stroke="${BLUE}" stroke-width="2"/>
  ${text(210, 102, '내용증명', { size: 16, weight: 'bold', fill: BLUE, anchor: 'middle' })}
  ${['사적 통지 — 우체국 접수', '받는 곳: 사용자(회사)', '효과: 요구 기록·시효 중단', '시점: 사내 요구 첫 단계'].map((l, i) => text(210, 138 + i * 26, l, { size: 12.5, anchor: 'middle' })).join('')}
  <rect x="400" y="70" width="300" height="180" rx="10" fill="${BG}" stroke="${RED}" stroke-width="2"/>
  ${text(550, 102, '진정서', { size: 16, weight: 'bold', fill: RED_DARK, anchor: 'middle' })}
  ${['공적 절차 — 행정기관 접수', '받는 곳: 관할 노동청', '효과: 조사·지도로 이어짐', '시점: 사내 요구로 안 될 때'].map((l, i) => text(550, 138 + i * 26, l, { size: 12.5, anchor: 'middle' })).join('')}
  ${text(380, 286, '둘 다 사실 위주로 쓰고, 증거 목록을 붙인다', { size: 13.5, fill: RED_DARK, anchor: 'middle' })}
`);

const charts = [
  ['chart-annual.svg', chartAnnual],
  ['chart-wage.svg', chartWage],
  ['chart-wage-claim.svg', chartWageClaim],
  ['chart-safety.svg', chartSafety],
  ['chart-contract.svg', chartContract],
  ['chart-firing.svg', chartFiring],
  ['chart-calc.svg', chartCalc],
  ['chart-union.svg', chartUnion],
  ['chart-insurance.svg', chartInsurance],
  ['chart-report.svg', chartReport],
  ['chart-evidence.svg', chartEvidence],
  ['chart-limits.svg', chartLimits],
  ['chart-notice.svg', chartNotice],
];

for (const [name, svg] of charts) {
  if (!svg.includes('</svg>')) throw new Error(`SVG 닫힘 태그 없음: ${name}`);
  writeFileSync(join(OUT, name), svg, 'utf8');
  console.log(`생성: img/${name} (${svg.length} bytes)`);
}
console.log(`완료: ${charts.length}개`);
