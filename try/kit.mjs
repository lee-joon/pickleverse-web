// 클럽앱 미리보기 체험(/try/) 화면 부품. 원본은 소개서 키트 proposal/v2/screens/kit.ts(git 밖, 오너 결정 2026-11-12로 복제).
// 브라우저 ESM — 의존성 0. 바뀐 점: asset 은 상대 경로, pageShell 대신 kitCss(), 탭에 채팅·내 정보 추가.
// 값의 출처: src/design/presets.ts, src/design/theme.ts, src/constants/colors.ts,
// src/navigation/AppNavigator.tsx(탭바), src/modules/calendar/lessonColors.ts.
// 데이터는 전부 예시(가짜)다 — 실제 회원 이름·사진·연락처를 넣지 않는다.
import { PH } from './icons-phosphor.mjs';

const BASE = new URL('./', import.meta.url).href;
export const asset = (rel) => BASE + rel;

export const C = {
  // 2026-10-18 커뮤니티형(3pickle) 으로 전체 전환 — 크림 바탕 · 올리브 그린 · 볼 라임은 채움에만 · 카드 모서리 18.
  // 값의 출처: src/design/presets.ts 3pickle light. 보조 글자색만 크림 바탕 대비 4.5:1 이상으로 진하게 잡았다.
  bg: '#F5F1E8',
  surface: '#FFFFFF',
  surfaceSolid: '#FFFFFF',
  surfaceMuted: '#ECE4CF',
  raised: '#FFFFFF',
  text: '#1F2419',
  text2: '#5C604F',
  text3: '#6A6E5C',
  border: '#E3DCC8',
  input: '#EFE8D6',
  primary: '#3E6B35',
  primaryDark: '#2E5227',
  primarySoft: '#E6EDD3',
  primaryText: '#335A2B',
  onPrimary: '#FFFFFF', // primary 채움 위 글자 — 밝은 브랜드 색이면 color.mjs 가 어두운 글자로 바꾼다
  ball: '#C5D84A',
  ballInk: '#2F3A00',
  accent: '#A86A00',
  error: '#C8283F',
  success: '#5E8A1E',
  warning: '#B5612F',
  lessonRail: '#7C5CE6',
  lessonLabel: '#5B3DC4',
  lessonCard: '#F3EFFF',
  tabBar: '#FFFFFF',
};

// 화면별 색 덮어쓰기 — 운영 사례 화면은 가상의 다른 클럽이라 브랜드 색이 다르다.
// 체험 화면은 고른 디자인·브랜드 색을 withTheme 로 잠시 덮어쓴다(화면 + kitCss 모두 그 안에서 만든다).

export const THEMES = {};
export const withTheme = (over, fn) => {
  const prev = { ...C };
  Object.assign(C, over);
  try {
    return fn();
  } finally {
    Object.assign(C, prev);
  }
};

// ── 아이콘 (Feather 외곽선) ──────────────────────────────────────────────
const P = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  board: '<rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  slash: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
};

// 아이콘 — Phosphor(MIT). 굵기: 기본 regular, stroke ≥ 2.4 면 bold, weight='fill' 은 채운 모양(선택된 탭 등).
// Phosphor 에 없는 이름만 위 Feather 경로(P)로 그린다.
export const icon = (name, size = 22, color = C.text, stroke = 2, weight) => {
  const ph = PH[name];
  if (ph) return `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}" style="flex:none;display:block">${ph[weight ?? (stroke >= 2.4 ? 'bold' : 'regular')]}</svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">${P[name] ?? ''}</svg>`;
};

// iOS 26 식 상단 유리 버튼 (뒤로 · 편집 · 닫기). 사진 위에서는 dark=true.
export const navBtn = (name, dark = false, color) =>
  `<div style="width:44px;height:44px;border-radius:22px;flex:none;display:flex;align-items:center;justify-content:center;${dark ? 'background:rgba(0,0,0,.32);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.25)' : 'background:rgba(255,255,255,.78);box-shadow:0 2px 10px rgba(0,0,0,.06),inset 0 0 0 .5px rgba(0,0,0,.08)'};-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)">${icon(name, 22, color ?? (dark ? '#fff' : C.text), 2.4)}</div>`;

// ── 공통 조각 ───────────────────────────────────────────────────────────
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const chip = (label, tone = 'muted', extra = '') => {
  const tones = {
    primary: `background:${C.primarySoft};color:${C.primaryText};border:1px solid ${C.primaryDark}`,
    solid: `background:${C.primary};color:${C.onPrimary};border:1px solid ${C.primary}`,
    accent: `background:#F6FAD0;color:${C.ballInk};border:1px solid #E1EA8A`,
    muted: `background:rgba(0,0,0,.04);color:${C.text2};border:1px solid ${C.border}`,
    lesson: `background:${C.lessonCard};color:${C.lessonLabel};border:1px solid rgba(139,92,246,.45)`,
    error: `background:rgba(255,107,95,.12);color:${C.error};border:1px solid rgba(255,107,95,.35)`,
    success: `background:rgba(92,216,137,.12);color:${C.success};border:1px solid rgba(92,216,137,.3)`,
    outline: `background:transparent;color:${C.text};border:1px solid ${C.border}`,
  };
  return `<span class="chip" style="${tones[tone]};${extra}">${label}</span>`;
};

// 프로필 이니셜 — 상용 앱처럼 옅은 바탕 + 진한 글자 (실제 얼굴 사진은 쓰지 않는다)
const HUES = [['#DCEBFF', '#1E4E9C'], ['#FFE3D6', '#9A3A12'], ['#E3F4D9', '#2F6B1A'], ['#EFE3FF', '#5B33A8'], ['#FFF1C7', '#7A5600'], ['#D8F2EE', '#13675D'], ['#FFDDE6', '#A1264B'], ['#E6E8EC', '#3A4250']];
export const avatar = (name, size = 40, i = 0) => {
  const [bg, ink] = HUES[i % HUES.length];
  return `<div class="av" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${ink};font-size:${Math.round(size * 0.4)}px">${name.slice(0, 1)}</div>`;
};

export const card = (inner, extra = '') => `<div class="card" style="${extra}">${inner}</div>`;

export const button = (label, tone = 'primary', extra = '') => {
  const tones = {
    primary: `background:${C.primary};color:${C.onPrimary};border:1px solid ${C.primary}`,
    ghost: `background:transparent;color:${C.text};border:1px solid ${C.border}`,
    danger: `background:transparent;color:${C.error};border:1px solid rgba(255,107,95,.45)`,
    muted: `background:rgba(0,0,0,.04);color:${C.text3};border:1px solid ${C.border}`,
  };
  return `<div class="btn" style="${tones[tone]};${extra}">${label}</div>`;
};

export const toggle = (on) =>
  `<div class="tg" style="background:${on ? C.primary : '#C9D0CC'}"><div class="tg-k" style="left:${on ? 22 : 2}px"></div></div>`;

export const badge = (n) => `<span class="badge">${n}</span>`;

export const sectionTitle = (title, right = '') =>
  `<div class="sec"><span>${title}</span>${right ? `<span class="sec-r">${right}</span>` : ''}</div>`;

export const row = (left, right = '', extra = '') =>
  `<div class="row" style="${extra}"><div style="flex:1;min-width:0">${left}</div>${right}</div>`;

export const divider = () => `<div style="height:1px;background:${C.border};margin:4px 0"></div>`;

// 사진 자리 — assets/photos 의 Unsplash 무료 사진(credits.md). 실제 회원 사진이 아니다.
// p09(후원사 현수막) · p10 · p11(얼굴이 보임)은 돌려 쓰지 않는다.
const PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 18];
export const photoUrl = (v) => asset(`photos/p${String(PHOTOS[v % PHOTOS.length]).padStart(2, '0')}.jpg`);
export const courtArt = (v = 0, extra = '') =>
  `<div class="art" style="background:#C9CED3 url('${photoUrl(v)}') center/cover no-repeat;${extra}"></div>`;

// ── 상태바 · 탭바 ───────────────────────────────────────────────────────
export const statusBar = () => `<div class="status">
  <span class="time">9:41</span>
  <span class="status-r">
    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 L5.6 9.1 A3.4 3.4 0 0 1 10.4 9.1 Z" fill="#111"/><path d="M3.4 6.9 A6.5 6.5 0 0 1 12.6 6.9 L11.2 8.3 A4.5 4.5 0 0 0 4.8 8.3 Z" fill="#111"/><path d="M1 4.5 A9.9 9.9 0 0 1 15 4.5 L13.6 5.9 A7.9 7.9 0 0 0 2.4 5.9 Z" fill="#111"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(0,0,0,.35)"/><rect x="2" y="2" width="18" height="9" rx="2" fill="#111"/><rect x="24.5" y="4.2" width="1.6" height="4.6" rx=".8" fill="rgba(255,255,255,.45)"/></svg>
  </span>
</div>`;


const TAB_DEF = {
  link: ['링크', 'info'],
  home: ['홈', 'home'],
  calendar: ['일정', 'calendar'],
  board: ['게시판', 'board'],
  photos: ['사진', 'image'],
  members: ['회원', 'users'],
  chat: ['채팅', 'chat'],
  profile: ['내 정보', 'userCheck'],
};
export const tabBar = (active, tabs = ['home', 'calendar', 'board', 'photos', 'members'], labels) =>
  `<div class="tabbar">${tabs.map((t) => {
    const on = t === active;
    const col = on ? C.primaryText : C.text3;
    return `<div class="tab" data-tab="${t}"${on ? ` style="background:${C.primarySoft}"` : ''}>${icon(TAB_DEF[t][1], 24, col, 2, on ? 'fill' : 'regular')}<span style="color:${col}">${labels?.[t] ?? TAB_DEF[t][0]}</span></div>`;
  }).join('')}</div>`;

// ── 화면 틀 ─────────────────────────────────────────────────────────────

export const screen = (content, opts = {}) => {
  const tab = opts.tab === undefined ? null : opts.tab;
  // 스크롤이 없을 땐 래퍼에 transform 을 걸지 않는다 — transform 은 absolute 자식(하단 입력창 등)의 기준을 바꾼다.
  const inner = opts.scroll ? `<div style="transform:translateY(-${opts.scroll}px)">${content}</div>` : content;
  return `<div class="screen${opts.plain ? ' plain' : ''}"${opts.bg ? ` style="background:${opts.bg}"` : ''}>
    ${statusBar()}
    <div class="content" style="bottom:0">${inner}</div>
    ${tab ? `<div class="edge"></div>${tabBar(tab, opts.tabs, opts.tabLabels)}` : '<div class="homebar"></div>'}
    ${opts.overlay ?? ''}
  </div>`;
};

// 기기 틀 + 화면 CSS. 원본 pageShell 의 html/body 크기는 .phone 으로 옮겼다(Shadow DOM 안에서 쓴다).
export const kitCss = () => `
*{box-sizing:border-box;margin:0;padding:0}
.phone{position:relative;width:426px;height:898px;overflow:hidden;font-family:'Pretendard Variable','Pretendard','Apple SD Gothic Neo',sans-serif;color:${C.text};word-break:keep-all;-webkit-font-smoothing:antialiased;letter-spacing:-.2px}
.device{position:absolute;left:0;top:0;width:426px;height:898px;border-radius:64px;background:#0A0B0C;box-shadow:inset 0 0 0 3px #C7CBCF,inset 0 0 0 4px #9EA3A8}
.screen{position:absolute;left:12px;top:12px;width:402px;height:874px;border-radius:52px;overflow:hidden;background:${C.bg}}
.screen.plain{background:${C.bg}}
.island{position:absolute;left:50%;top:23px;transform:translateX(-50%);width:122px;height:36px;border-radius:18px;background:#000;z-index:50}
.status{position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 46px;z-index:40}
.status .time{font-size:17px;font-weight:600;letter-spacing:-.3px}
.status-r{display:flex;gap:6px;align-items:center}
.content{position:absolute;top:54px;left:0;right:0;overflow:hidden;z-index:2}
.tabbar{position:absolute;left:16px;right:16px;bottom:26px;height:64px;background:rgba(255,255,255,.72);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);border-radius:32px;box-shadow:0 8px 30px rgba(0,0,0,.08),inset 0 0 0 .5px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.9);display:flex;align-items:center;padding:0 6px;z-index:20}
.tabbar::after{content:'';position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#111}
.edge{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(to bottom,${C.bg}00 0%,${C.bg}D9 62%,${C.bg} 100%);z-index:15}
.homebar{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#111;z-index:30}
.tab{flex:1;height:54px;border-radius:27px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.tab span{font-size:11px;font-weight:700}
.pad{padding:0 20px}
.topbar{display:flex;align-items:center;gap:10px;height:62px;padding:0 20px}
.topbar .t{font-size:31px;font-weight:800;flex:1;letter-spacing:-.8px}
.topbar .ic{display:flex;gap:16px;align-items:center}
.navbar{display:flex;align-items:center;height:50px;padding:0 14px;gap:8px}
.navbar .t{flex:1;text-align:center;font-size:17px;font-weight:600}
.card{background:${C.surface};border-radius:18px;padding:16px}
.num{font-family:'Pretendard Variable','Pretendard',-apple-system,system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.hair{height:1px;background:${C.border}}
.chip{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.btn{height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;gap:8px}
.av{display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.tg{position:relative;width:46px;height:26px;border-radius:13px;flex:none}
.tg-k{position:absolute;top:2px;width:22px;height:22px;border-radius:11px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.badge{position:absolute;top:-6px;right:-9px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:${C.error};color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid ${C.bg}}
.sec{display:flex;align-items:baseline;justify-content:space-between;font-size:17px;font-weight:800;margin:22px 0 10px}
.sec-r{font-size:13px;font-weight:600;color:${C.text2}}
.row{display:flex;align-items:center;gap:12px}
.cap{font-size:13px;color:${C.text2}}
.cap3{font-size:12px;color:${C.text3}}
.h1{font-size:24px;font-weight:800;letter-spacing:-.6px}
.art{position:relative;overflow:hidden}
.input{height:48px;border-radius:14px;background:${C.input};border:none;display:flex;align-items:center;padding:0 14px;font-size:15px;color:${C.text3}}
.sheet{position:absolute;left:0;right:0;bottom:0;background:${C.surfaceSolid};border-top-left-radius:28px;border-top-right-radius:28px;border-top:1px solid ${C.border};z-index:60;padding:10px 20px 40px}
.grab{width:40px;height:5px;border-radius:3px;background:#C9D0CC;margin:0 auto 14px}
.dim{position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:55}
`;
export const phone = (body) => `<div class="phone"><div class="device"></div><div class="island"></div>${body}</div>`;
