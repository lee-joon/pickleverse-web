// 클럽앱 미리보기 체험 — 화면. 원본은 proposal/v2/screens 의 screens-hero(홈·일정·일정 상세·대진표),
// screens-styles(프리셋 4종 홈), screens-cases(대관·게스트·아카데미), screens-b(게시판·채팅·프로필).
// 클럽 이름·로고·브랜드 색·운영 방식·기능을 인자(ctx)로 받게 고쳤다. 이름·사진·숫자는 전부 예시다(실제 회원 정보 금지).
// 디자인 프리셋은 홈 배치 + 전체 색 + 탭바 모양을 바꾼다. 다른 탭은 색만 바뀐다.
import { avatar, button, C, card, chip, courtArt, esc, icon, kitCss, navBtn, phone, photoUrl, screen, withTheme } from './kit.mjs';
import { derivePalette } from './color.mjs';

const css = (s) => `<style>${s}</style>`;
const scrim = 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 100%)';
const TABS = ['home', 'calendar', 'board', 'chat', 'profile'];

// ── 프리셋 색 (screens-styles.ts 의 CARD · OPS · WARM · QUIET) ─────────────────────────
export const PALETTES = {
  card: {
    bg: '#07090D', surface: 'rgba(30,38,52,.55)', surfaceSolid: '#1A212D', surfaceMuted: 'rgba(16,21,29,.6)', input: '#1A212D', text: '#F5F7FB', text2: '#B4BDCD', text3: '#959EB2',
    border: '#2A3342', primary: '#14A39B', primaryDark: '#0E7C76', primarySoft: 'rgba(20,163,155,.24)', primaryText: '#6ADDD5', accent: '#F5B04E', error: '#FF6B5F',
  },
  ops: {
    bg: '#F3F5F8', surface: '#FFFFFF', surfaceSolid: '#FFFFFF', surfaceMuted: '#EAEEF3', input: '#EAEEF3', text: '#111A2B', text2: '#465266', text3: '#5B677A',
    border: '#D6DCE5', primary: '#1F56C4', primaryDark: '#17449C', primarySoft: '#E5EDFB', primaryText: '#1A4BAF', error: '#B83B3B',
  },
  warm: {
    bg: '#F5F1E8', surface: '#FFFFFF', surfaceSolid: '#FFFFFF', surfaceMuted: '#ECE4CF', input: '#EFE8D6', text: '#1F2419', text2: '#5C604F', text3: '#6A6E5C',
    border: '#E3DCC8', primary: '#3E6B35', primaryDark: '#2E5227', primarySoft: '#E6EDD3', primaryText: '#335A2B', ball: '#C5D84A', ballInk: '#2F3A00',
  },
  quiet: {
    bg: '#FFFFFF', surface: '#FFFFFF', surfaceSolid: '#FFFFFF', surfaceMuted: '#F4F4F5', input: '#F4F4F5', text: '#0A0A0A', text2: '#55595F', text3: '#6B6F76',
    border: '#E6E6E6', primary: '#111111', primaryDark: '#000000', primarySoft: '#F2F2F2', primaryText: '#111111',
  },
};
// 프리셋마다 기본 브랜드 색 — 로고에서 색을 못 뽑았을 때 쓴다.
export const presetBrand = (preset) => PALETTES[preset].primary;
// 카드형은 primarySoft 가 반투명이라 계산용 바탕을 따로 둔다.
const SOLID_BG = { card: '#07090D' };

// 프리셋별 탭바 · 상태바 (screens-styles.ts flatTabBar · lightStatus)
const flatTabBar = (border, bg, iconsOnly = false) => `
  .tabbar{left:0;right:0;bottom:0;height:90px;border-radius:0;background:${bg};backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;border-top:1px solid ${border};padding:0 8px 30px}
  .tabbar::after{bottom:8px}.tab{background:transparent!important;height:56px}.edge{display:none}${iconsOnly ? '.tab span{display:none}' : ''}`;
const chromeCss = (preset) => {
  if (preset === 'card') return css(`.status svg{filter:invert(1)}.status .time{color:#fff}.homebar{background:#fff}
    .tabbar{background:rgba(22,28,40,.78);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.16)}.tabbar::after{background:#fff}.tab{background:transparent!important}.edge{display:none}
    .card{border:1px solid rgba(255,255,255,.09)}`);
  if (preset === 'ops') return css(flatTabBar(C.border, '#FFFFFF') + '.tab span{font-weight:800}');
  if (preset === 'quiet') return css(flatTabBar(C.border, '#FFFFFF', true) + `.tab[style]::after{content:'';width:5px;height:5px;border-radius:3px;background:${C.primary};margin-top:5px}`);
  return '';
};

// ── 예시 데이터 (운영 방식별) ─────────────────────────────────────────────────────
// needs: 그 기능을 골랐을 때만 보이는 일정. kind: lesson(레슨 색) · dupr · rental · guest
const EVENTS = {
  rental: [
    { d: '토', day: '18', t: '07:00', end: '09:00', title: '새벽 오픈 플레이', place: 'A·B코트', n: 6, max: 8, photo: 7 },
    { d: '토', day: '18', t: '14:00', end: '16:00', title: '단체 대관', place: '전 코트', n: 16, max: 16, photo: 3, kind: 'rental' },
    { d: '토', day: '18', t: '19:00', end: '21:00', title: '저녁 오픈 플레이', place: '전 코트', n: 14, max: 16, photo: 4, wait: 2 },
    { d: '월', day: '20', t: '19:00', end: '21:00', title: 'DUPR 매치', place: 'A코트 · DUPR 3.0 이상', n: 8, max: 8, photo: 8, kind: 'dupr', needs: 'dupr' },
  ],
  member: [
    { d: '토', day: '18', t: '10:00', end: '12:00', title: '토요 정기 모임', place: '실내 A', n: 12, max: 16, photo: 1 },
    { d: '토', day: '18', t: '19:00', end: '21:00', title: '저녁 게임', place: '실내 A', n: 8, max: 8, photo: 4, wait: 2 },
    { d: '월', day: '20', t: '20:00', end: '22:00', title: '야간 게임', place: '실내 B', n: 7, max: 16, photo: 12 },
    { d: '수', day: '22', t: '19:00', end: '21:00', title: 'DUPR 매치', place: '실내 A · DUPR 3.0 이상', n: 6, max: 8, photo: 8, kind: 'dupr', needs: 'dupr' },
  ],
  guest: [
    { d: '토', day: '18', t: '14:00', end: '17:00', title: '토요 오픈 플레이', place: '실내 2코트 · 게스트 가능', n: 9, max: 12, photo: 2, kind: 'guest' },
    { d: '일', day: '19', t: '10:00', end: '12:00', title: '초보 환영 드롭인', place: '실내 1코트 · 패들 대여', n: 12, max: 12, photo: 5, kind: 'guest', wait: 3 },
    { d: '수', day: '22', t: '19:00', end: '21:00', title: 'DUPR 매치', place: '실내 A · DUPR 3.0 이상', n: 6, max: 8, photo: 8, kind: 'dupr', needs: 'dupr' },
    { d: '목', day: '23', t: '20:00', end: '22:00', title: '회원 게임', place: '실내 B', n: 7, max: 12, photo: 12 },
  ],
  academy: [
    { d: '목', day: '16', t: '19:00', end: '20:30', title: '중급반 B', place: '코치 한지민 · 2코트', n: 5, max: 6, photo: 1, kind: 'lesson', needs: 'lesson_court' },
    { d: '토', day: '18', t: '10:00', end: '11:00', title: '개인 레슨', place: '코치 오태양 · 1코트', n: 1, max: 1, photo: 6, kind: 'lesson', needs: 'lesson_court' },
    { d: '일', day: '19', t: '15:00', end: '17:00', title: '그룹 레슨 · 서브 집중', place: '코치 한지민', n: 6, max: 8, photo: 13 },
    { d: '월', day: '20', t: '20:00', end: '22:00', title: '수강생 연습 게임', place: '전 코트', n: 9, max: 16, photo: 4 },
  ],
};
const eventsFor = (ctx) => EVENTS[ctx.theme].filter((e) => !e.needs || ctx.has(e.needs));
const state = (e, ctx) => {
  if (e.n < e.max) return { label: `${e.max - e.n}자리 남음`, short: `${e.max - e.n}자리`, full: false };
  if (e.wait && ctx.has('waitlist')) return { label: `대기 ${e.wait}명`, short: `대기 ${e.wait}`, full: true };
  return { label: '마감', short: '마감', full: true };
};
const N = ['김민준', '이서연', '박지훈', '최유진', '정하늘', '강도윤', '윤서아', '장현우', '임수빈', '한지민', '오태양', '서지우'];

// 클럽 표시 — 로고가 있으면 로고, 없으면 첫 글자
const mark = (ctx, size = 28, radius = 8) => ctx.logo
  ? `<img src="${ctx.logo}" alt="" style="width:${size}px;height:${size}px;border-radius:${radius}px;object-fit:contain;flex:none;background:#fff">`
  : `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${C.primary};color:${C.onPrimary};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.45)}px;font-weight:900;flex:none">${esc(ctx.name.slice(0, 1) || '클')}</div>`;
const nm = (ctx) => esc(ctx.name || '우리 클럽');
const go = (target, inner, extra = '') => `<div data-go="${target}" style="cursor:pointer;${extra}">${inner}</div>`;

const linkRow = (ctx) => ctx.has('links') ? `<div style="display:flex;gap:8px;padding:12px 16px 0">${['코트 예약', '오픈채팅', '인스타그램'].map((t) => `<span style="display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:999px;background:${C.surface};border:1px solid ${C.border};font-size:13px;font-weight:700;color:${C.text}">${icon('link', 14, C.primaryText)}${t}</span>`).join('')}</div>` : '';

// ── 홈 4종 ──────────────────────────────────────────────────────────────────
const glass = (inner, extra = '') => `<div style="background:${C.surface};border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:16px;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);${extra}">${inner}</div>`;
const homeCard = (ctx) => {
  const ev = eventsFor(ctx);
  const next = ev[0];
  const tiles = [];
  if (ctx.has('membership')) tiles.push(glass(`<div style="font-size:13px;color:${C.text2}">남은 이용권</div>
      <div style="margin-top:6px"><span class="num" style="font-size:52px;letter-spacing:-2px;color:${C.accent}">2</span><span style="font-size:16px;font-weight:700;margin-left:4px">/ 8회</span></div>
      <div style="display:flex;gap:3px;margin-top:10px">${Array.from({ length: 8 }, (_, i) => `<div style="flex:1;height:5px;border-radius:3px;background:${i < 6 ? C.accent : 'rgba(255,255,255,.14)'}"></div>`).join('')}</div>`));
  tiles.push(glass(`<div style="font-size:13px;color:${C.text2}">10월 참여</div>
      <div style="margin-top:6px"><span class="num" style="font-size:52px;letter-spacing:-2px">6</span><span style="font-size:16px;font-weight:700;margin-left:4px">회</span></div>
      <div style="font-size:12.5px;color:${C.primaryText};margin-top:10px;font-weight:700">지난달보다 2회 많음</div>`));
  if (ctx.has('dupr') && tiles.length < 2) tiles.push(glass(`<div style="font-size:13px;color:${C.text2}">DUPR</div><div class="num" style="font-size:44px;margin-top:10px">3.84</div>`));
  const quick = [['calendar', '일정'], ctx.has('attendance') ? ['userCheck', '출석'] : null, ['board', '공지'], ctx.has('photos') ? ['image', '사진'] : ['chat', '문의']].filter(Boolean);
  return screen(`
  <div style="display:flex;align-items:center;gap:10px;padding:12px 20px 0">${mark(ctx)}
    <span style="font-size:20px;font-weight:800;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm(ctx)}</span>${icon('bell', 22, C.text)}
  </div>
  <div style="font-size:26px;font-weight:800;letter-spacing:-.5px;padding:14px 20px 0">이번 주 일정 ${ev.length}개</div>
  <div style="padding:14px 16px 0">${go('event:0', `
    <div style="position:relative;height:186px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12)">
      ${courtArt(next.photo, 'position:absolute;inset:0')}<div style="position:absolute;inset:0;background:${scrim}"></div>
      <span style="position:absolute;left:14px;top:14px;font-size:12px;font-weight:800;background:${C.accent};color:#2B1A00;padding:5px 10px;border-radius:999px">다음 일정</span>
      <div style="position:absolute;left:16px;right:16px;bottom:14px;display:flex;align-items:flex-end;color:#fff">
        <div style="flex:1"><div style="font-size:22px;font-weight:800">${next.title}</div><div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:3px">${next.d}요일 <span class="num">${next.t}</span> · ${next.place.split(' · ')[0]}</div></div>
        <div class="num" style="font-size:24px">${next.n}/${next.max}</div>
      </div>
    </div>`)}
  </div>
  <div style="display:grid;grid-template-columns:${tiles.length > 1 ? '1.2fr 1fr' : '1fr'};gap:10px;padding:10px 16px 0">${tiles.join('')}</div>
  ${linkRow(ctx)}
  <div style="padding:10px 16px 0">
    ${glass(`<div style="display:grid;grid-template-columns:repeat(${quick.length},1fr)">${quick.map(([ic, t]) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:46px;height:46px;border-radius:14px;background:${C.primarySoft};display:flex;align-items:center;justify-content:center">${icon(ic, 22, C.primaryText)}</div><span style="font-size:13px;font-weight:700">${t}</span></div>`).join('')}</div>`, 'padding:16px 8px')}
  </div>
  <div style="padding:10px 16px 0">
    ${glass(ev.slice(1, 3).map((e, i) => go(`event:${i + 1}`, `
      <div style="display:flex;align-items:center;gap:12px;padding:9px 0;${i ? 'border-top:1px solid rgba(255,255,255,.08)' : ''}">${courtArt(e.photo, 'width:44px;height:44px;border-radius:12px;flex:none')}
        <div style="flex:1"><div style="font-size:15px;font-weight:700">${e.title}</div><div style="font-size:12.5px;color:${C.text2};margin-top:2px">${e.d} <span class="num">${e.t}</span></div></div><span style="font-size:12.5px;font-weight:700;color:${state(e, ctx).full ? C.error : C.text2}">${e.n}/${e.max} · ${state(e, ctx).short}</span></div>`)).join(''), 'padding:8px 16px')}
  </div>
  ${css(`.screen::before{content:'';position:absolute;inset:-60px;background:url('${photoUrl(6)}') center/cover;filter:blur(36px) brightness(.32) saturate(1.3);z-index:0}`)}`, { tab: 'home', tabs: TABS });
};

const band = (t, r = '') => `<div style="display:flex;justify-content:space-between;padding:18px 20px 8px;font-size:13px;font-weight:800;color:${C.text2}"><span>${t}</span><span style="font-weight:600">${r}</span></div>`;
const homeOps = (ctx) => {
  const ev = eventsFor(ctx).slice(0, 3);
  const todo = [
    ['userCheck', '참석 확인이 필요한 일정', '1건'],
    ['board', '읽지 않은 공지', '2건'],
    ctx.has('join_review') ? ['users', '가입 신청 확인', '2건'] : null,
    ctx.has('guest_events') ? ['userCheck', '게스트 참가 승인', '4건'] : null,
    ctx.has('dupr') ? ['flag', 'DUPR 경기 결과 확인', '3경기'] : null,
  ].filter(Boolean);
  const stats = [['오늘 일정', String(ev.length)], ['확인할 것', String(todo.length)], ctx.has('membership') ? ['이용권', '2회'] : ['10월 참여', '6회']];
  return screen(`
  <div style="background:${C.surface};border-bottom:1px solid ${C.border};padding:8px 20px 14px">
    <div style="display:flex;align-items:center;gap:8px">${mark(ctx, 24, 6)}<span style="font-size:15px;font-weight:800;color:${C.primaryText};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm(ctx)}</span>${icon('bell', 21, C.text)}</div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px"><span style="font-size:30px;font-weight:800;letter-spacing:-.6px">오늘</span><span style="font-size:15px;color:${C.text2}">10월 18일 토요일</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);border:1px solid ${C.border};border-radius:8px;margin-top:12px">
      ${stats.map(([l, v], i) => `<div style="padding:10px 12px;${i ? `border-left:1px solid ${C.border}` : ''}"><div style="font-size:12px;color:${C.text2};font-weight:700">${l}</div><div class="num" style="font-size:22px;margin-top:5px">${v}</div></div>`).join('')}
    </div>
  </div>
  ${linkRow(ctx)}
  ${band('다가오는 일정', `${ev.length}개`)}
  ${ev.map((e, i) => go(`event:${i}`, `
  <div style="display:flex;align-items:center;gap:12px;padding:11px 20px;background:${C.surface};${i ? '' : `border-top:1px solid ${C.border};`}border-bottom:1px solid ${C.border}">
    ${courtArt(e.photo, 'width:56px;height:56px;border-radius:6px;flex:none')}
    <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700"><span class="num" style="font-size:15px;color:${C.primaryText}">${e.t}</span> ${e.title}</div><div style="font-size:13px;color:${C.text2};margin-top:3px">${e.d} · ${e.place.split(' · ')[0]} · <span class="num">${e.n}/${e.max}</span>명</div>
      <div style="height:4px;border-radius:2px;background:${C.surfaceMuted};margin-top:7px;width:120px"><div style="height:4px;border-radius:2px;background:${C.primary};width:${Math.round((e.n / e.max) * 100)}%"></div></div></div>
    <div style="height:34px;padding:0 12px;border-radius:6px;display:flex;align-items:center;font-size:13.5px;font-weight:700;${i === 0 ? `color:${C.primaryText};border:1.5px solid ${C.primary}` : `background:${C.primary};color:${C.onPrimary};border:1.5px solid ${C.primary}`}">${i === 0 ? '참석 중' : state(e, ctx).full ? '대기' : '참석'}</div>
  </div>`)).join('')}
  ${band('확인할 것', `${todo.length}건`)}
  <div style="border-top:1px solid ${C.border}">
    ${todo.map(([ic, t, r]) => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:${C.surface};border-bottom:1px solid ${C.border}">
        <div style="width:32px;height:32px;border-radius:6px;border:1.5px solid ${C.border};display:flex;align-items:center;justify-content:center">${icon(ic, 17, C.text)}</div>
        <span style="flex:1;font-size:15px;font-weight:600">${t}</span><span style="font-size:14px;font-weight:800;color:${C.primaryText}">${r}</span>${icon('chevronRight', 18, C.text3)}
      </div>`).join('')}
  </div>`, { tab: 'home', tabs: TABS });
};

const homeWarm = (ctx) => {
  const ev = eventsFor(ctx);
  const next = ev[0];
  return screen(`
  <div style="position:relative;height:330px;overflow:hidden">
    ${courtArt(2, 'position:absolute;inset:0')}
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(20,30,15,.55) 0%, rgba(20,30,15,0) 38%, rgba(30,45,22,.86) 100%)"></div>
    <div style="position:absolute;left:20px;right:20px;top:66px;display:flex;align-items:center;gap:10px">${mark(ctx, 30)}<span style="font-size:23px;font-weight:800;color:#fff;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm(ctx)}</span>${icon('bell', 22, '#fff')}</div>
    <div style="position:absolute;left:20px;right:20px;bottom:42px;color:#fff">
      <div style="font-size:24px;font-weight:800;letter-spacing:-.5px">이번 주 함께한 회원 24명</div>
      <div style="display:flex;align-items:center;margin-top:10px">${['김', '이', '박', '최', '정'].map((n, i) => `<div style="margin-left:${i ? -9 : 0}px;border:2px solid rgba(255,255,255,.9);border-radius:50%">${avatar(n, 30, i)}</div>`).join('')}
        ${go('event:0', `<span style="display:inline-flex;height:34px;padding:0 16px;border-radius:999px;background:${C.ball};color:${C.ballInk};align-items:center;font-size:14px;font-weight:800">${next.title} 참석</span>`, 'margin-left:auto')}</div>
    </div>
  </div>
  <div style="position:relative;margin:-24px 0 0;background:${C.bg};border-radius:24px 24px 0 0;padding:16px 0 0">
    <div style="padding:0 16px">${go('event:0', `<div style="display:flex;align-items:center;gap:12px;background:${C.surface};border-radius:18px;padding:12px">
      ${courtArt(next.photo, 'width:58px;height:58px;border-radius:14px;flex:none')}
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:${C.primaryText}">다음 일정</div><div style="font-size:16px;font-weight:800;margin-top:2px">${next.title}</div><div style="font-size:13px;color:${C.text2};margin-top:2px">${next.d} <span class="num" style="font-size:14px;color:${C.text}">${next.t}</span> · ${next.place.split(' · ')[0]}</div></div>
      <div style="text-align:right"><div class="num" style="font-size:20px;color:${C.primaryText}">${next.n}/${next.max}</div><div style="font-size:11.5px;color:${C.text2};margin-top:3px">${state(next, ctx).short}</div></div>
    </div>`)}</div>
    ${linkRow(ctx)}
    ${ctx.has('photos') ? `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:18px 20px 0"><span style="font-size:18px;font-weight:800">앨범</span><span style="font-size:13.5px;font-weight:700;color:${C.primaryText}">전체 보기</span></div>
    <div style="display:flex;gap:14px;padding:12px 20px 0">
      ${[[1, '토요 모임'], [9, '초급 클리닉'], [2, '10월 모임'], [13, '추석 이벤트'], [4, '코트 공사']].map(([v, t], i) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:62px"><div style="padding:2.5px;border-radius:50%;background:${i < 2 ? `linear-gradient(135deg, ${C.ball}, ${C.primary})` : C.border}"><div style="padding:2px;border-radius:50%;background:${C.bg}">${courtArt(v, 'width:52px;height:52px;border-radius:50%')}</div></div><span style="font-size:11.5px;font-weight:700;white-space:nowrap">${t}</span></div>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:20px 20px 0"><span style="font-size:18px;font-weight:800">최근 사진</span><span style="font-size:13px;color:${C.text2}">12장 · 2시간 전</span></div>
    <div style="display:grid;grid-template-columns:2fr 1fr;grid-template-rows:96px 96px;gap:6px;padding:12px 16px 0">
      ${courtArt(11, 'grid-row:span 2;border-radius:18px 6px 6px 18px')}${courtArt(0, 'border-radius:6px 18px 6px 6px')}${courtArt(14, 'border-radius:6px 6px 18px 6px')}
    </div>` : `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:20px 20px 0"><span style="font-size:18px;font-weight:800">다가오는 일정</span><span style="font-size:13.5px;font-weight:700;color:${C.primaryText}">전체 보기</span></div>
    <div style="padding:10px 16px 0">${ev.slice(1, 3).map((e, i) => go(`event:${i + 1}`, `<div style="display:flex;align-items:center;gap:12px;background:${C.surface};border-radius:18px;padding:11px 12px;margin-bottom:8px">${courtArt(e.photo, 'width:46px;height:46px;border-radius:12px;flex:none')}<div style="flex:1"><div style="font-size:15px;font-weight:700">${e.title}</div><div style="font-size:12.5px;color:${C.text2};margin-top:2px">${e.d} <span class="num">${e.t}</span></div></div><span class="num" style="font-size:16px;color:${C.primaryText}">${e.n}/${e.max}</span></div>`)).join('')}</div>`}
  </div>
  ${css(`.content{top:0!important}.status svg{filter:invert(1)}.status .time{color:#fff}.tab{background:transparent!important}.tab[data-tab=home]{background:${C.primarySoft}!important}`)}`, { tab: 'home', tabs: TABS });
};

const homeQuiet = (ctx) => {
  const ev = eventsFor(ctx);
  const next = ev[0];
  const stats = [['10월 참여', '6', '회'], ctx.has('membership') ? ['남은 이용권', '2', '/ 8'] : null, ctx.has('dupr') ? ['DUPR', '3.84', ''] : ['다음 달 일정', '12', '개']].filter(Boolean);
  const qRow = (e, i) => go(`event:${i}`, `
  <div style="display:flex;align-items:center;gap:16px;padding:12px 0;${i === 1 ? '' : `border-top:1px solid ${C.border}`}">
    <div style="width:52px;font-size:12.5px;color:${C.text2}">${e.d}<div class="num" style="font-size:16px;color:${C.text};font-weight:600;margin-top:2px">${e.t}</div></div>
    <div style="flex:1"><div style="font-size:15.5px">${e.title}</div><div style="font-size:12.5px;color:${C.text2};margin-top:2px">${e.place.split(' · ')[0]}</div></div>
    <span style="font-size:13px;color:${C.text2}">${state(e, ctx).short}</span>
  </div>`);
  return screen(`
  <div style="padding:14px 28px 0;display:flex;align-items:center;gap:10px">${mark(ctx, 22, 4)}<span style="font-size:15px;font-weight:700;flex:1;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm(ctx)}</span>${icon('bell', 20, C.text)}</div>
  <div style="padding:14px 28px 0">${courtArt(12, 'height:176px;border-radius:2px;filter:grayscale(1) contrast(1.1)')}</div>
  <div style="padding:18px 28px 0">
    <div style="display:flex;align-items:baseline;justify-content:space-between"><span style="font-size:13.5px;color:${C.text2}">다음 일정 · ${next.d}요일</span><span style="font-size:13.5px;color:${C.text2}">${next.max}명 중 ${next.n}명</span></div>
    <div style="display:flex;align-items:flex-end;gap:14px;margin-top:4px"><span class="num" style="font-size:64px;font-weight:300;letter-spacing:-3px">${next.t}</span><span style="font-size:17px;padding-bottom:8px">${next.title}<br><span style="font-size:13.5px;color:${C.text2}">${next.place.split(' · ')[0]}</span></span></div>
    <div style="display:flex;align-items:center;gap:20px;margin-top:14px">
      ${go('event:0', `<div style="height:42px;padding:0 22px;border-radius:2px;background:${C.primary};color:${C.onPrimary};display:flex;align-items:center;font-size:15px;font-weight:600">참석하기</div>`)}
      ${go('tab:calendar', '<span style="font-size:15px;text-decoration:underline;text-underline-offset:4px">일정 전체</span>')}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${stats.length},1fr);margin:22px 28px 0;border-top:1px solid ${C.text};border-bottom:1px solid ${C.border}">
    ${stats.map(([l, v, u], i) => `<div style="padding:12px 0 12px ${i ? 14 : 0}px;${i ? `border-left:1px solid ${C.border}` : ''}"><div style="font-size:12px;color:${C.text2}">${l}</div><div style="margin-top:5px"><span class="num" style="font-size:26px;font-weight:400">${v}</span><span style="font-size:13px;color:${C.text2};margin-left:3px">${u}</span></div></div>`).join('')}
  </div>
  <div style="padding:16px 28px 0">
    <div style="font-size:13.5px;color:${C.text2};margin-bottom:2px">이번 주</div>
    ${ev.slice(1, 4).map((e, i) => qRow(e, i + 1)).join('')}
  </div>`, { tab: 'home', tabs: TABS });
};
const HOMES = { card: homeCard, ops: homeOps, warm: homeWarm, quiet: homeQuiet };

// ── 일정 ────────────────────────────────────────────────────────────────────
const bar = (n, max, full = false) => `<div style="flex:1;height:4px;border-radius:2px;background:${C.border}"><div style="width:${Math.min(100, Math.round((n / max) * 100))}%;height:100%;border-radius:2px;background:${full ? C.text3 : C.primary}"></div></div>`;
const kindChip = (e, ctx) => e.kind === 'lesson' ? `<span style="font-size:10.5px;font-weight:800;color:${C.lessonLabel};background:${C.lessonCard};padding:2px 7px;border-radius:8px">참여자만</span>`
  : e.kind === 'dupr' ? `<span style="font-size:10.5px;font-weight:800;color:${C.ballInk};background:${C.ball};padding:2px 7px;border-radius:8px">DUPR</span>`
  : e.kind === 'rental' ? chip('대관', 'outline', 'height:20px;font-size:10.5px;padding:0 7px')
  : e.kind === 'guest' && ctx.has('guest_events') ? chip('게스트', 'primary', 'height:20px;font-size:10.5px;padding:0 7px') : '';

// 대관 — 시간대 목록(screens-cases rentDay)
const calendarRental = (ctx) => {
  const ev = eventsFor(ctx).filter((e) => e.day === '18');
  return `
  ${ctx.has('membership') ? `<div style="margin:12px 20px 0;padding:16px 18px;border-radius:14px;background:${C.primarySoft};display:flex;align-items:flex-end;justify-content:space-between">
    <div><div style="font-size:13px;font-weight:700;color:${C.primaryText}">10회권 · 남은 횟수</div><div style="font-size:12px;color:${C.text2};margin-top:4px">12월 31일까지 · 참석하면 1회 차감</div></div>
    <div><span class="num" style="font-size:46px;color:${C.primaryText}">7</span><span style="font-size:14px;color:${C.text2};font-weight:700"> / 10</span></div>
  </div>` : ''}
  <div style="display:flex;gap:6px;padding:18px 20px 4px">
    ${[['16', '목'], ['17', '금'], ['18', '토'], ['19', '일'], ['20', '월'], ['21', '화'], ['22', '수']].map(([d, w]) => {
      const sel = d === '18';
      return `<div style="flex:1;padding:8px 0 7px;border-radius:12px;text-align:center;${sel ? `background:${C.primary};color:${C.onPrimary}` : `color:${C.text}`}"><div style="font-size:11px;font-weight:700;${sel ? '' : `color:${C.text3}`}">${w}</div><div class="num" style="font-size:22px;margin-top:5px">${d}</div></div>`;
    }).join('')}
  </div>
  <div class="pad" style="margin-top:8px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px"><span style="font-size:16px;font-weight:800">10월 18일 토요일</span><span style="font-size:12.5px;color:${C.text2}">코트 4면</span></div>
    ${ev.map((e) => {
      const s = state(e, ctx);
      return go(`event:${EVENTS[ctx.theme].indexOf(e)}`, `<div style="display:flex;gap:14px;padding:14px 0;border-top:1px solid ${C.border}">
      <div style="width:62px;flex:none"><div class="num" style="font-size:21px">${e.t}</div><div class="num" style="font-size:15px;color:${C.text3};margin-top:4px">${e.end}</div></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:15.5px;font-weight:700">${e.title}</span>${kindChip(e, ctx)}</div>
        <div style="font-size:12.5px;color:${C.text2};margin-top:3px">${e.place}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:9px">${bar(e.n, e.max, s.full)}<span class="num" style="font-size:16px;color:${s.full ? C.text2 : C.primaryText}">${e.n}/${e.max}</span>
          <span style="font-size:11.5px;font-weight:700;color:${s.full ? C.error : C.text2};width:70px;text-align:right;white-space:nowrap">${s.label}</span></div>
      </div></div>`);
    }).join('')}
  </div>`;
};

// 월 달력 + 하루 목록(screens-hero calendar) — 회원·게스트·아카데미
const dots = { 3: 'other', 4: 'mine', 7: 'other', 11: 'other', 14: 'other', 16: 'mine', 18: 'mine', 19: 'mine', 20: 'other', 22: 'other', 25: 'mine', 28: 'other', 31: 'other' };
const monthGrid = () => {
  const cells = ['<div></div>', '<div></div>', '<div></div>'];
  for (let d = 1; d <= 31; d += 1) {
    const sel = d === 18;
    const dot = dots[d];
    // 달력 칸: 숫자 16px · 선택은 동그라미(iOS 캘린더 비율). 원본 키트의 19px·각진 상자는 칸이 커 보였다(오너 지적 2026-11-12).
    cells.push(`<div style="height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
      <div class="num" style="width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:${sel || dot ? 600 : 500};${sel ? `background:${C.primary};color:${C.onPrimary}` : `color:${dot ? C.text : C.text3}`}">${d}</div>
      <div style="width:5px;height:5px;border-radius:3px;background:${sel ? 'transparent' : dot === 'mine' ? C.primary : dot ? C.text3 : 'transparent'}"></div></div>`);
  }
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr)">${cells.join('')}</div>`;
};
const dayTile = (e, i, ctx) => {
  const s = state(e, ctx);
  const lesson = e.kind === 'lesson';
  return go(`event:${i}`, `<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:${C.surface};margin-bottom:8px">
    <div style="width:62px;height:54px;border-radius:14px;background:${lesson ? C.lessonCard : C.primarySoft};display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none">
      <div class="num" style="font-size:21px;color:${lesson ? C.lessonLabel : C.primaryText}">${e.t}</div><div class="num" style="font-size:14px;color:${lesson ? C.lessonLabel : C.text2};margin-top:3px">${e.end}</div></div>
    <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:15.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.title}</span>${kindChip(e, ctx)}</div>
      <div style="font-size:12.5px;color:${C.text2};margin-top:3px">${e.d}요일 · ${e.place}</div></div>
    <div style="text-align:right;flex:none"><div class="num" style="font-size:19px;color:${s.full ? C.text2 : C.primaryText}">${e.n}/${e.max}</div><div style="font-size:11px;font-weight:700;color:${s.full ? C.error : C.text2};margin-top:3px">${s.short}</div></div>
  </div>`);
};
const calendarMonth = (ctx) => {
  const all = EVENTS[ctx.theme];
  return `
  ${ctx.theme === 'academy' && ctx.has('membership') ? `<div style="margin:12px 20px 0;padding:14px 16px;border-radius:14px;background:${C.primarySoft};display:flex;align-items:center;gap:12px">
    <div style="flex:1"><div style="font-size:13px;font-weight:700;color:${C.primaryText}">10월 수강권 · 월 8회</div><div style="display:flex;gap:4px;margin-top:8px">${Array.from({ length: 8 }, (_, i) => `<div style="flex:1;height:6px;border-radius:3px;background:${i < 3 ? C.text3 : C.primary}"></div>`).join('')}</div></div>
    <div><span class="num" style="font-size:40px;color:${C.primaryText}">5</span><span style="font-size:13px;font-weight:700;color:${C.text2}"> 회 남음</span></div></div>` : ''}
  <div style="padding:10px 16px 0"><div style="background:${C.surface};border-radius:24px;padding:12px 8px 6px">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11.5px;font-weight:700;color:${C.text3};margin-bottom:2px">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<div>${w}</div>`).join('')}</div>${monthGrid()}
  </div></div>
  <div style="padding:16px 16px 0">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 4px 10px"><span style="font-size:16px;font-weight:800">이번 주</span><span style="font-size:12.5px;color:${C.text2}">일정 ${eventsFor(ctx).length}개</span></div>
    ${eventsFor(ctx).map((e) => dayTile(e, all.indexOf(e), ctx)).join('')}
    ${ctx.theme === 'academy' && ctx.has('lesson_court') ? `<div class="cap3" style="margin:6px 4px 0">참여자만 공개한 레슨은 내가 추가된 일정만 보여요.</div>` : ''}
  </div>`;
};
const calendarTab = (ctx) => screen(`
  <div style="display:flex;align-items:center;padding:8px 20px 0">
    <span style="font-size:28px;font-weight:800;letter-spacing:-.5px">10월</span><span style="font-size:15px;color:${C.text3};margin-left:8px;padding-top:6px">2026</span>
    <span style="flex:1"></span>
    <div style="display:flex;gap:12px;align-items:center">${ctx.has('attendance') ? icon('userCheck', 21, C.text2) : ''}<div style="width:44px;height:44px;border-radius:16px;background:${C.primary};display:flex;align-items:center;justify-content:center">${icon('plus', 20, C.onPrimary, 2.6)}</div></div>
  </div>
  ${ctx.theme === 'rental' ? calendarRental(ctx) : calendarMonth(ctx)}`, { tab: 'calendar', tabs: TABS });

// ── 일정 상세 ───────────────────────────────────────────────────────────────
const infoRow = (ic, main, sub = '') => `<div style="display:flex;align-items:center;gap:14px;padding:10px 0">
  <div style="width:40px;height:40px;border-radius:12px;background:${C.surfaceMuted};display:flex;align-items:center;justify-content:center">${icon(ic, 21, C.text)}</div>
  <div><div style="font-size:15.5px;font-weight:700">${main}</div>${sub ? `<div style="font-size:13px;color:${C.text2};margin-top:2px">${sub}</div>` : ''}</div></div>`;
const stack = (names, size = 26, ring = '#fff') => `<div style="display:flex">${names.map((n, i) => `<div style="margin-left:${i ? -8 : 0}px;border:2px solid ${ring};border-radius:50%">${avatar(n, size, i)}</div>`).join('')}</div>`;
const eventDetail = (ctx, idx) => {
  const e = EVENTS[ctx.theme][idx] ?? eventsFor(ctx)[0];
  const s = state(e, ctx);
  const guest = e.kind === 'guest' && ctx.has('guest_events');
  const cta = s.full ? (ctx.has('waitlist') && e.wait ? `대기 신청 · ${e.wait + 1}번째` : '마감') : guest ? '참석 신청(승인제)' : e.kind === 'lesson' ? '참여자로 지정됨' : '참석하기';
  return screen(`
  <div style="position:relative;height:280px">
    ${courtArt(e.photo, 'position:absolute;inset:0')}<div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 100%)"></div>
    <div style="position:absolute;left:16px;right:16px;top:58px;display:flex;align-items:center;gap:10px">${go('back', navBtn('chevronLeft', true))}<span style="flex:1"></span>${navBtn('share', true)}</div>
    <div style="position:absolute;left:20px;bottom:40px;display:flex;gap:6px">${e.kind === 'dupr' ? `<span style="font-size:12px;font-weight:800;background:${C.ball};color:${C.ballInk};padding:5px 10px;border-radius:999px">DUPR 3.0 이상</span>` : ''}${guest ? `<span style="font-size:12px;font-weight:700;color:#fff;background:rgba(0,0,0,.45);padding:5px 10px;border-radius:999px">게스트 자리 4</span>` : ''}${e.kind === 'lesson' ? `<span style="font-size:12px;font-weight:700;color:#fff;background:rgba(0,0,0,.45);padding:5px 10px;border-radius:999px">레슨 · 참여자만</span>` : ''}</div>
  </div>
  <div style="position:relative;margin-top:-26px;background:${C.surfaceSolid};border-radius:28px 28px 0 0;padding:22px 20px 120px">
    <div style="display:flex;align-items:flex-start"><div style="flex:1"><div style="font-size:25px;font-weight:800;letter-spacing:-.6px">${e.title}</div><div style="font-size:14px;color:${C.text2};margin-top:4px">${nm(ctx)} · 운영진 개설</div></div><div style="text-align:right"><div class="num" style="font-size:26px">${e.n}/${e.max}</div><div style="font-size:12px;font-weight:800;color:${s.full ? C.error : C.text2};margin-top:3px">${s.label}</div></div></div>
    <div style="margin-top:8px">
      ${infoRow('calendar', `10월 ${e.day}일 ${e.d}요일`, '취소는 하루 전까지')}
      ${infoRow('clock', `${e.t} – ${e.end}`)}
      ${infoRow('mapPin', e.place)}
      ${ctx.has('membership') ? infoRow('ticket', '이용권 1회 차감', '남은 이용권 2회') : ''}
    </div>
    ${guest ? `<div style="margin-top:8px;padding:12px 14px;border-radius:14px;background:${C.primarySoft};font-size:13px;line-height:1.5;color:${C.text}">게스트는 신청하면 운영진이 확인한 뒤 확정돼요.</div>` : ''}
    <div style="height:1px;background:${C.border};margin:12px 0 14px"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between"><span style="font-size:17px;font-weight:800">참석자</span><span style="font-size:13.5px;font-weight:700;color:${C.primaryText}">전체 보기</span></div>
    <div style="display:flex;align-items:center;margin-top:12px">${stack(N.slice(0, Math.min(8, e.n)), 36, C.surfaceSolid)}${s.full && e.wait && ctx.has('waitlist') ? `<span style="font-size:13.5px;color:${C.text2};margin-left:10px">대기 ${e.wait}명</span>` : ''}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 34px;display:flex;gap:10px;align-items:center;z-index:10;background:${C.surfaceSolid};border-top:1px solid ${C.border}">
    ${ctx.has('matchup') ? go('matchup', button('대진표', 'ghost', 'height:54px;font-size:15px'), 'flex:1') : ''}${button(cta, s.full && !(ctx.has('waitlist') && e.wait) ? 'muted' : 'primary', 'flex:2;height:54px;font-size:16px')}
  </div>
  ${css('.content{top:0!important;padding-bottom:0!important}.status svg{filter:invert(1)}.status .time{color:#fff}')}`);
};

// ── 대진표(screens-hero matchup) ─────────────────────────────────────────────
const game = (ctx, court, st, a, b, sa, sb, dupr = false) => {
  const live = st === '진행 중';
  const aw = sa !== '-' && Number(sa) > Number(sb);
  const bw = sb !== '-' && Number(sb) > Number(sa);
  const ink = live ? C.ballInk : C.text;
  const sub = live ? 'rgba(47,58,0,.66)' : C.text2;
  return `<div style="padding:14px 16px 16px;border-radius:22px;margin-bottom:10px;background:${live ? C.ball : C.surface}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:13px;font-weight:800;color:${ink}">${court}</span>
      ${live ? `<span style="font-size:11.5px;font-weight:800;color:${C.ballInk};background:rgba(47,58,0,.1);padding:3px 8px;border-radius:999px">진행 중</span>` : `<span style="font-size:12px;color:${C.text3};font-weight:700">${st}</span>`}
      <span style="flex:1"></span>${dupr && ctx.has('dupr') ? `<span style="font-size:11px;font-weight:700;color:${C.primaryText};display:flex;gap:4px;align-items:center">${icon('lock', 11, C.primaryText)}DUPR 제출됨</span>` : ''}</div>
    <div style="display:flex;align-items:center">
      <div style="flex:1;font-size:14px;line-height:1.55;font-weight:${aw ? 800 : 500};color:${aw ? ink : sub}">${a[0]}<br>${a[1]}</div>
      <div style="display:flex;align-items:center;gap:10px"><span class="num" style="font-size:46px;width:52px;text-align:right;color:${sa === '-' ? C.text3 : aw ? ink : sub}">${sa}</span><span class="num" style="font-size:24px;color:${live ? sub : C.text3}">:</span><span class="num" style="font-size:46px;width:52px;color:${sb === '-' ? C.text3 : bw ? ink : sub}">${sb}</span></div>
      <div style="flex:1;text-align:right;font-size:14px;line-height:1.55;font-weight:${bw ? 800 : 500};color:${bw ? ink : sub}">${b[0]}<br>${b[1]}</div>
    </div></div>`;
};
const matchup = (ctx) => screen(`
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px 0">${go('back', navBtn('chevronLeft'))}<span style="font-size:16px;font-weight:700">대진표</span><span style="width:44px"></span></div>
  <div style="padding:14px 16px 0">
    <div style="display:flex;align-items:center;gap:6px;padding:5px;border-radius:18px;background:${C.surface};margin-bottom:12px">
      ${[1, 2, 3, 4].map((r) => `<div style="flex:1;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:4px;${r === 2 ? `background:${C.primary};color:${C.onPrimary}` : `color:${C.text2}`}"><span style="font-size:12px;font-weight:700">라운드</span><span class="num" style="font-size:21px;padding-top:3px">${r}</span></div>`).join('')}
    </div>
    ${game(ctx, '1코트', '완료', ['김민준', '정하늘'], ['박지훈', '윤서아'], '11', '7', true)}
    ${game(ctx, '2코트', '진행 중', ['이서연', '강도윤'], ['최유진', '장현우'], '9', '8')}
    ${game(ctx, '3코트', '다음', ['임수빈', '오태양'], ['한지민', '서지우'], '-', '-')}
    <div style="font-size:12.5px;color:${C.text3};text-align:center;margin:4px 0 12px">점수는 참가자 모두의 화면에 바로 반영돼요</div>
  </div>`);

// ── 게시판(screens-b board) ──────────────────────────────────────────────────
const boardTab = (ctx) => {
  const c = (n) => ctx.has('board_comments') ? ` · 댓글 ${n}` : '';
  const post = (chips, title, preview, meta, art) => `
  <div style="display:flex;gap:12px;padding:15px 0;border-bottom:1px solid ${C.border}">
    <div style="flex:1;min-width:0">
      ${chips ? `<div style="display:flex;gap:6px;margin-bottom:6px">${chips}</div>` : ''}
      <div style="font-size:16px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px">${title}</div>
      <div style="font-size:13.5px;color:${C.text2};line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${preview}</div>
      <div class="cap3" style="margin-top:7px">${meta}</div>
    </div>
    ${art === null ? '' : courtArt(art, 'width:76px;height:76px;border-radius:12px;flex:none;align-self:center')}
  </div>`;
  const first = { rental: ['11월 코트 대관 신청 안내', '11월 단체 대관은 이번 달 25일까지 신청을 받습니다. 시간대별 남은 코트는 일정 탭에서 확인해 주세요.'],
    member: ['10월 정기 모임 안내', '이번 달 정기 모임은 셋째 주 토요일입니다. 참석 신청은 일정 탭에서 해 주세요.'],
    guest: ['처음 오시는 게스트 안내', '주차와 입장 방법, 패들 대여 안내입니다. 참석 신청 전에 한 번 읽어 주세요.'],
    academy: ['11월 레슨반 편성 안내', '11월 중급반·초급반 시간표가 나왔습니다. 배정된 레슨은 일정 탭에서 확인할 수 있어요.'] }[ctx.theme];
  return screen(`
  <div class="topbar"><div class="t" style="font-size:27px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">공지</div><div class="ic">${icon('search', 23)}</div></div>
  <div class="pad">
    ${post(chip('고정', 'solid', 'height:21px;font-size:10.5px'), first[0], first[1], `운영진 · 10.14${c(12)}`, 0)}
    ${post(chip('읽지 않음', 'accent', 'height:21px;font-size:10.5px'), '오픈 토너먼트 참가 신청', '11월 둘째 주 주말, 복식 오픈 토너먼트를 엽니다. 게시글의 신청 링크로 접수해 주세요.', `운영진 · 10.13${c(8)}`, 3)}
    ${post('', ctx.has('photos') ? '추석 이벤트 사진 올렸습니다' : '추석 이벤트 결과', '참석해 주셔서 감사합니다. 결과와 다음 일정을 정리했습니다.', `운영진 · 10.07${c(21)}`, 2)}
    ${post('', '10월 코트 이용 시간 변경', '실내 B코트 공사로 10/20~10/24 저녁 시간이 조정됩니다.', `운영진 · 10.02${c(3)}`, null)}
    <div class="cap3" style="margin-top:12px">글은 운영진이 올리고${ctx.has('board_comments') ? ', 회원은 댓글과 답글을 달 수 있어요.' : ' 회원은 읽기만 해요.'}</div>
  </div>`, { tab: 'board', tabs: TABS });
};

// ── 채팅(screens-b chatList · chatRoom) ─────────────────────────────────────
const chatRow = (title, sub, time, unread, kind, i, tag) => `<div style="display:flex;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid ${C.border}">
    ${kind === 'admin' ? `<div class="av" style="width:46px;height:46px;border-radius:18px;background:${C.primarySoft}">${icon('shield', 20, C.primaryText)}</div>` : `<div class="av" style="width:46px;height:46px;border-radius:18px;background:${['#2E5E8C', '#7A4E9E', '#9E6A3A', '#3A7F6A'][i % 4]}">${icon('users', 20, '#EAF2FF')}</div>`}
    <div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center"><span style="font-size:15.5px;font-weight:800">${title}</span>${tag ? chip(tag, kind === 'admin' ? 'primary' : 'muted', 'height:19px;font-size:10px;padding:0 6px') : ''}</div>
    <div style="font-size:13px;color:${C.text2};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="cap3">${time}</span>${unread ? `<span style="min-width:20px;height:20px;border-radius:10px;background:${C.primary};color:${C.onPrimary};font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 6px">${unread}</span>` : ''}</div>
  </div>`;
const chatTab = (ctx) => screen(`
  <div class="topbar"><div class="t" style="font-size:27px">채팅</div></div>
  <div class="pad">
    ${go('chat-room', chatRow('관리자 문의', '다음 주 일정은 화요일로 확정됐어요.', '오전 10:14', 1, 'admin', 0, '1:1 문의'))}
    ${ctx.has('group_chat') ? chatRow(`${nm(ctx)} 운영진`, '이번 주 코트 배정 공유합니다', '어제', 2, 'group', 2, '단체 · 6명') + chatRow('토요 모임방', '사진첩에 단체 사진 올렸습니다', '10.12', 0, 'group', 5, '단체 · 24명') : ''}
    ${card(`<div style="display:flex;gap:10px">${icon('lock', 18, C.text2)}<div style="font-size:13px;color:${C.text2};line-height:1.5">회원끼리 개인 채팅은 하지 않아요. 문의는 관리자에게${ctx.has('group_chat') ? ', 단체방은 운영진이 만들어요.' : ' 보내요.'}</div></div>`, `margin-top:14px;padding:13px 14px;border:1px solid ${C.border}`)}
  </div>`, { tab: 'chat', tabs: TABS });
const bubble = (text, mine, time, name) => `
  <div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};margin-bottom:12px">
    ${name ? `<div style="font-size:12.5px;font-weight:800;color:${C.primaryText};margin:0 0 5px 4px">${name}</div>` : ''}
    <div style="display:flex;align-items:flex-end;gap:6px;flex-direction:${mine ? 'row-reverse' : 'row'}">
      <div style="max-width:250px;padding:10px 14px;border-radius:18px;font-size:14.5px;line-height:1.45;${mine ? `background:${C.primary};color:${C.onPrimary};border-bottom-right-radius:6px` : `background:${C.surfaceSolid};border:1px solid ${C.border};border-bottom-left-radius:6px`}">${text}</div>
      <span class="cap3" style="font-size:11px">${time}</span>
    </div></div>`;
const chatRoom = () => screen(`
  <div class="navbar">${go('back', navBtn('chevronLeft'))}<div class="t">관리자 문의</div><span style="width:44px"></span></div>
  <div class="pad">
    <div style="text-align:center;margin:6px 0 14px">${chip('오늘', 'muted')}</div>
    ${bubble('안녕하세요. 이번 주 토요일 처음 가는데 패들 대여가 되나요?', true, '오전 9:58')}
    ${bubble('네, 현장에서 무료로 대여해 드려요. 시작 10분 전에 와 주세요.', false, '오전 10:03', '관리자')}
    ${bubble('다음 주 일정은 화요일로 확정됐어요.', false, '오전 10:14', '관리자')}
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:10px 14px 34px;background:${C.surfaceSolid};border-top:1px solid ${C.border};display:flex;gap:10px;align-items:center;z-index:10">${icon('image', 23, C.text2)}<div class="input" style="flex:1;height:42px;border-radius:21px">메시지 입력</div>${icon('send', 22, C.primaryText)}</div>
  ${css('.content{bottom:86px!important}')}`);

// ── 내 정보(screens-b profile) ───────────────────────────────────────────────
const info = (k, v) => `<div style="display:flex;justify-content:space-between;padding:9px 0;font-size:14.5px"><span style="color:${C.text2}">${k}</span><span style="font-weight:700">${v}</span></div>`;
const profileTab = (ctx) => {
  const admin = [
    ctx.has('join_review') ? ['users', '가입 신청 검토', '2건'] : null,
    ctx.has('guest_events') ? ['userCheck', '게스트 참가 승인', '4건'] : null,
    ctx.has('attendance') ? ['calendar', '출석부', ''] : null,
    ctx.has('recurring') ? ['refresh', '반복 일정 만들기', ''] : null,
    ctx.has('lesson_court') ? ['award', '레슨 참여자 지정', ''] : null,
  ].filter(Boolean);
  const tiles = [
    ctx.has('dupr') ? card(`<div class="cap3">DUPR 더블스</div><div class="num" style="font-size:30px;margin-top:6px">3.84</div><div class="cap3" style="margin-top:4px">매일 자동 동기화</div>`, 'flex:1;padding:14px') : null,
    ctx.has('membership') ? card(`<div class="cap3">이용권</div><div style="margin-top:6px"><span class="num" style="font-size:30px">5</span><span style="font-size:15px;color:${C.text2};margin-left:4px">/ 8회</span></div><div class="cap3" style="margin-top:4px">11.01 갱신</div>`, 'flex:1;padding:14px') : null,
  ].filter(Boolean);
  return screen(`
  <div class="topbar"><div class="t" style="font-size:27px">내 정보</div></div>
  <div class="pad">
    ${card(`<div class="row">${avatar('김민준', 60, 0)}<div style="flex:1"><div style="font-size:20px;font-weight:800">김민준</div><div style="display:flex;gap:6px;margin-top:6px">${chip('중급', 'muted')}${ctx.has('dupr') ? chip('DUPR 연동', 'primary') : ''}</div></div>${chip('수정', 'outline', 'height:30px;padding:0 12px')}</div>`, 'border-radius:20px')}
    ${tiles.length ? `<div style="display:flex;gap:10px;margin-top:12px">${tiles.join('')}</div>` : ''}
    ${card(`${info('회원 구분', '회원')}${ctx.has('membership') ? info('멤버십', '러너') : ''}${info('참석 횟수', '37회')}`, 'margin-top:12px;padding:8px 16px')}
    ${admin.length ? `<div style="font-size:13px;font-weight:800;color:${C.text2};margin:20px 4px 8px">운영진 메뉴</div>${card(admin.map(([ic, t, r], i) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;${i ? `border-top:1px solid ${C.border}` : ''}">${icon(ic, 19, C.primaryText)}<span style="flex:1;font-size:15px;font-weight:600">${t}</span>${r ? `<span style="font-size:13.5px;font-weight:800;color:${C.primaryText}">${r}</span>` : ''}${icon('chevronRight', 18, C.text3)}</div>`).join(''), 'padding:2px 16px')}` : ''}
    ${card(['알림 설정', ctx.has('english') ? '언어 · 한국어 / English' : null, '이용약관 · 개인정보 처리방침', '로그아웃'].filter(Boolean).map((t, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;${i ? `border-top:1px solid ${C.border}` : ''};font-size:15px;font-weight:600">${t}${icon('chevronRight', 18, C.text3)}</div>`).join(''), 'margin-top:12px;padding:2px 16px')}
  </div>`, { tab: 'profile', tabs: TABS });
};

// ── 진입점 ──────────────────────────────────────────────────────────────────
// view: 'home' | 'calendar' | 'board' | 'chat' | 'profile' | 'event:N' | 'matchup' | 'chat-room'
// opts.thumb: 디자인 고르기 썸네일(홈만, 선택 기능 없이)
export const paletteFor = (preset, brand) => {
  const base = PALETTES[preset];
  return brand ? { ...base, ...derivePalette(brand, SOLID_BG[preset] ?? base.bg) } : base;
};
export const renderPhone = (input, view = 'home') => {
  const ctx = { ...input, has: (k) => input.features.includes(k) };
  return withTheme(paletteFor(ctx.preset, ctx.brand), () => {
    let body;
    if (view === 'home') body = HOMES[ctx.preset](ctx);
    else if (view === 'calendar') body = calendarTab(ctx);
    else if (view === 'board') body = boardTab(ctx);
    else if (view === 'chat') body = chatTab(ctx);
    else if (view === 'profile') body = profileTab(ctx);
    else if (view.startsWith('event:')) body = eventDetail(ctx, Number(view.slice(6)));
    else if (view === 'matchup' && ctx.has('matchup')) body = matchup(ctx);
    else if (view === 'chat-room') body = chatRoom();
    else body = HOMES[ctx.preset](ctx);
    return { html: phone(body + chromeCss(ctx.preset)), css: kitCss() };
  });
};
