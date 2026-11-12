// 클럽앱 미리보기 체험 — 단계 진행. 의존성 0.
// 로고는 브라우저 안에서만 쓰다가 '이 구성으로 상담 요청'을 누를 때만 서버로 보낸다(오너 결정 2026-11-12).
// TRY_CONFIG.fn 이 null 이면 로컬 시험 모드: 코드 DEMO 만 통과하고 제출은 보내지 않는다.
import { ANSWERS, BASE_FEATURES, FEATURES, LIMITS, PRESETS, THEMES } from './catalog.mjs';
import { renderPhone, presetBrand } from './screens.mjs';
import { isHex, normHex } from './color.mjs';

const CFG = window.TRY_CONFIG || { fn: null };
const MOCK = !CFG.fn;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STEP_NAMES = ['입장', '클럽 정보', '운영 방식', '기능', '디자인', '미리보기'];
const SAVE_KEY = 'pv-try-v1';

const blank = () => ({
  step: 0, code: '', name: '', logo: null, logoColors: [], brand: null, theme: null, features: [], featuresTouched: false,
  preset: 'warm', answers: { size: null, weekly: null, tools: [], pain: '' }, view: 'home', back: [], sent: false,
});
let S = blank();
try {
  const saved = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null');
  if (saved && typeof saved === 'object') S = { ...blank(), ...saved, back: [] };
} catch { /* 개인 창 · 저장 차단 — 처음부터 */ }
const save = () => { try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ ...S, back: [] })); } catch { /* 용량 초과 등 — 무시 */ } };

// ── 서버 ─────────────────────────────────────────────────────────────────
const REASON = {
  invalid: '코드를 찾을 수 없습니다. 받은 코드를 다시 확인해 주세요.',
  expired: '기간이 지난 코드입니다. 새 코드를 요청해 주세요.',
  used_up: '이 코드로 보낼 수 있는 횟수를 다 썼습니다. 새 코드를 요청해 주세요.',
  rate_limited: '시도가 너무 많습니다. 10분 뒤에 다시 입력해 주세요.',
  bad_input: '입력값을 확인해 주세요.',
  network: '연결에 실패했습니다. 잠시 뒤 다시 시도해 주세요.',
};
const normCode = (c) => c.toUpperCase().replace(/[^0-9A-Z]/g, '');
async function call(body) {
  try {
    const res = await fetch(CFG.fn, body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return j && typeof j.ok === 'boolean' ? j : { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
const verify = (code) => MOCK
  ? new Promise((r) => setTimeout(() => r(code === 'DEMO' ? { ok: true } : { ok: false, reason: 'invalid' }), 300))
  : call({ action: 'verify', code });

// ── 로고: 512px PNG 로 다시 그림(EXIF 제거) + 대표 색 뽑기 ─────────────────────
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
function loadLogo(file) {
  return new Promise((resolve, reject) => {
    if (!LOGO_TYPES.includes(file.type)) return reject(new Error('PNG, JPG, WebP 파일만 올릴 수 있습니다.'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('10MB 이하 파일을 올려 주세요.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return reject(new Error('이미지를 열지 못했습니다.'));
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const k = Math.min(512 / w, 512 / h);
      const dw = Math.round(w * k), dh = Math.round(h * k);
      c.getContext('2d').drawImage(img, (512 - dw) / 2, (512 - dh) / 2, dw, dh);
      resolve({ dataUrl: c.toDataURL('image/png'), colors: pickColors(img) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 파일은 브라우저가 열지 못합니다. PNG, JPG, WebP 로 올려 주세요.')); };
    img.src = url;
  });
}
// 48px 로 줄여 4비트 양자화 → 채도 있는 색 중 많이 나온 순서로 3개. 흰색·검정·회색은 뺀다.
function pickColors(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  const count = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
    if (max < 40 || min > 225 || max - min < 40) continue;
    const key = ((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4);
    count.set(key, (count.get(key) || 0) + 1);
  }
  const picked = [];
  for (const [k] of [...count.entries()].sort((a, b) => b[1] - a[1])) {
    const rgb = [k >> 8, (k >> 4) & 15, k & 15];
    // 양자화 칸 5개 이상 떨어진 색만 — 안티앨리어싱으로 생긴 비슷한 색을 거른다
    if (picked.every((p) => Math.abs(p[0] - rgb[0]) + Math.abs(p[1] - rgb[1]) + Math.abs(p[2] - rgb[2]) >= 5)) picked.push(rgb);
    if (picked.length === 3) break;
  }
  return picked.map((c) => '#' + c.map((v) => (v * 16 + 8).toString(16).padStart(2, '0')).join('').toUpperCase());
}
const dataUrlToBlob = async (u) => (await fetch(u)).blob();

// ── 휴대폰 미리보기 (Shadow DOM — 페이지 CSS 와 섞이지 않게) ─────────────────────
const host = $('#phone');
const shadow = host.attachShadow({ mode: 'open' });
const PREVIEW_CSS = `
  .phone{font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif}
  .content{overflow-y:auto;scrollbar-width:none;padding-bottom:120px}.content::-webkit-scrollbar{display:none}
  [data-tab],[data-go]{cursor:pointer}[data-tab]:focus-visible,[data-go]:focus-visible{outline:3px solid #D6E64A;outline-offset:-3px;border-radius:16px}`;
const previewInput = () => ({ name: S.name.trim(), logo: S.logo, brand: S.brand, theme: S.theme || 'member', preset: S.preset, features: S.features });
function drawPhone() {
  const { html, css } = renderPhone(previewInput(), S.view);
  shadow.innerHTML = `<style>${css}${PREVIEW_CSS}</style>${html}`;
  shadow.querySelectorAll('[data-tab],[data-go]').forEach((el) => {
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    if (el.dataset.tab) el.setAttribute('aria-label', el.textContent.trim() + ' 탭');
  });
  fitPhone();
}
function navigate(el) {
  const target = el.dataset.tab ? el.dataset.tab : el.dataset.go;
  if (target === 'back') S.view = S.back.pop() || 'home';
  else if (target.startsWith('tab:')) { S.back = []; S.view = target.slice(4); }
  else if (el.dataset.tab) { S.back = []; S.view = target; }
  else { S.back.push(S.view); S.view = target; }
  drawPhone();
}
shadow.addEventListener('click', (e) => { const el = e.target.closest('[data-tab],[data-go]'); if (el) navigate(el); });
shadow.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-tab],[data-go]');
  if (el) { e.preventDefault(); navigate(el); }
});
function fitPhone() {
  const wrap = $('#phoneWrap');
  const stage = $('#stage');
  const wide = matchMedia('(min-width: 960px)').matches;
  const availW = Math.min(stage.clientWidth - 32, wide ? 999 : 426);
  const availH = wide ? window.innerHeight - 110 : 9999;
  const k = Math.max(0.5, Math.min(1, availW / 426, availH / 898));
  host.style.transform = `scale(${k})`;
  wrap.style.width = `${426 * k}px`;
  wrap.style.height = `${898 * k}px`;
}
addEventListener('resize', fitPhone);

// ── 단계 화면 ────────────────────────────────────────────────────────────
const nav = (nextLabel = '다음', { back = true, disabled = false } = {}) => `<div class="nav">
  ${back ? '<button type="button" class="btn btn-ghost" data-act="prev">이전</button>' : ''}
  <button type="submit" class="btn btn-primary"${disabled ? ' disabled' : ''}>${nextLabel}</button></div>`;
const themeName = (k) => (THEMES.find((t) => t[0] === k) || [])[1] || '';
const recommended = (k) => (THEMES.find((t) => t[0] === k) || [, , , []])[3];

const VIEWS = [
  // 1 입장
  () => `<form class="step" data-step="0" novalidate>
    <h1>초대 코드를 입력해 주세요</h1>
    <p class="lede">받으신 코드로 들어오면 클럽 이름과 로고로 앱 화면을 꾸며 보고, 일정·게시판·채팅 화면을 직접 눌러 볼 수 있습니다.</p>
    <div class="field"><label for="code">초대 코드</label>
      <input id="code" class="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" value="${esc(S.code)}" aria-describedby="code-err code-hint">
      <p class="hint" id="code-hint">${MOCK ? '로컬 시험 모드입니다. DEMO 를 입력하면 들어갑니다.' : '예: K7QM-2HXR-9DPA'}</p>
      <p class="err" id="code-err"></p></div>
    ${nav('입장하기', { back: false })}
  </form>`,
  // 2 클럽 정보
  () => `<form class="step" data-step="1" novalidate>
    <h1>클럽 이름과 로고</h1>
    <p class="lede">앱 맨 위와 홈 화면에 들어갑니다. 로고는 이 브라우저 안에서만 쓰고, 마지막에 상담 요청을 보낼 때만 함께 전송됩니다.</p>
    <div class="field"><label for="name">클럽 이름</label>
      <input id="name" type="text" maxlength="${LIMITS.nameMax}" autocomplete="off" value="${esc(S.name)}" aria-describedby="name-err">
      <p class="hint">${LIMITS.nameMax}자까지</p><p class="err" id="name-err"></p></div>
    <div class="field"><span class="label" id="logo-l">로고 (선택)</span>
      <div class="logo-row">
        <div class="logo-box">${S.logo ? `<img src="${S.logo}" alt="올린 로고">` : '<span class="hint" style="margin:0">없음</span>'}</div>
        <div>
          <span class="btn btn-ghost file-btn">${S.logo ? '다른 파일 고르기' : '파일 고르기'}<input type="file" id="logo" accept="image/png,image/jpeg,image/webp" aria-labelledby="logo-l"></span>
          ${S.logo ? '<button type="button" class="btn btn-ghost" data-act="logo-clear" style="margin-left:6px">지우기</button>' : ''}
          <p class="hint">PNG, JPG, WebP · 10MB 이하. 없으면 클럽 이름 첫 글자로 표시합니다.</p>
        </div>
      </div><p class="err" id="logo-err"></p></div>
    <div class="field"><span class="label">대표 색</span>
      <div class="swatches" role="group" aria-label="대표 색">
        ${[...S.logoColors, presetBrand(S.preset)].filter((c, i, a) => a.indexOf(c) === i).map((c) => `<button type="button" class="sw" style="background:${c}" data-color="${c}" aria-pressed="${(S.brand || presetBrand(S.preset)) === c}" aria-label="색 ${c}"></button>`).join('')}
        <label class="sw sw-custom" aria-label="직접 고르기"><input type="color" id="custom-color" value="${S.brand || presetBrand(S.preset)}"></label>
      </div>
      <p class="hint">${S.logoColors.length ? '로고에서 뽑은 색입니다. ' : ''}버튼과 강조색에 쓰입니다. 글자가 잘 읽히도록 필요하면 조금 진하게 맞춥니다.</p></div>
    ${nav()}
  </form>`,
  // 3 운영 방식
  () => `<form class="step" data-step="2" novalidate>
    <h1>어떻게 운영하시나요?</h1>
    <p class="lede">가장 가까운 방식을 골라 주세요. 고른 방식에 맞는 기능을 다음 단계에서 미리 체크해 둡니다.</p>
    <fieldset><legend class="sr">운영 방식</legend><div class="choices">
      ${THEMES.map(([k, t, d, rec]) => `<label class="choice"><input type="radio" name="theme" value="${k}"${S.theme === k ? ' checked' : ''}><span class="box"></span>
        <span><span class="t">${t}</span><span class="d" style="display:block">${d}</span><span class="d" style="display:block">추천: ${rec.map((f) => FEATURES.find((x) => x[0] === f)[1]).join(', ')}</span></span></label>`).join('')}
    </div></fieldset><p class="err" id="theme-err"></p>
    ${nav()}
  </form>`,
  // 4 기능 설문
  () => {
    const rec = recommended(S.theme);
    const pills = (key, multi) => ANSWERS[key].map(([v, t]) => `<label class="pill"><input type="${multi ? 'checkbox' : 'radio'}" name="${key}" value="${v}"${(multi ? S.answers[key].includes(v) : S.answers[key] === v) ? ' checked' : ''}><span>${t}</span></label>`).join('');
    return `<form class="step" data-step="3" novalidate>
    <h1>원하는 기능</h1>
    <p class="lede">${esc(themeName(S.theme))} 방식에 맞는 기능을 미리 체크했습니다. 필요한 대로 바꿔 주세요.</p>
    <div class="field"><span class="label">기본으로 들어가는 기능</span><div class="base">${BASE_FEATURES.map((f) => `<span>${f[1]}</span>`).join('')}</div></div>
    <fieldset><legend>더할 기능</legend><div class="choices">
      ${FEATURES.map(([k, t, d]) => `<label class="choice"><input type="checkbox" name="feature" value="${k}"${S.features.includes(k) ? ' checked' : ''}><span class="box"></span>
        <span><span class="t">${t}</span>${rec.includes(k) ? '<span class="rec">추천</span>' : ''}<span class="d" style="display:block">${d}</span></span></label>`).join('')}
    </div></fieldset>
    <fieldset><legend>회원 규모</legend><div class="pills">${pills('size', false)}</div></fieldset>
    <fieldset><legend>한 주에 여는 일정 수</legend><div class="pills">${pills('weekly', false)}</div></fieldset>
    <fieldset><legend>지금 쓰는 도구 (여러 개 선택)</legend><div class="pills">${pills('tools', true)}</div></fieldset>
    <div class="field"><label for="pain">지금 운영에서 가장 불편한 점 (선택)</label>
      <textarea id="pain" maxlength="${LIMITS.painMax}" aria-describedby="pain-hint">${esc(S.answers.pain)}</textarea>
      <p class="hint" id="pain-hint">${LIMITS.painMax}자까지. 이름이나 전화번호 같은 개인정보는 적지 마세요.</p></div>
    ${nav()}
  </form>`;
  },
  // 5 디자인
  () => `<form class="step" data-step="4" novalidate>
    <h1>디자인</h1>
    <p class="lede">실제 앱에서 고를 수 있는 디자인 네 가지입니다. 같은 홈 화면을 각 디자인으로 그렸고, 색은 앞에서 고른 대표 색으로 바뀝니다.</p>
    <fieldset><legend class="sr">디자인</legend><div class="designs">
      ${PRESETS.map(([k, , t, d]) => `<label class="design"><input type="radio" name="preset" value="${k}"${S.preset === k ? ' checked' : ''}>
        <span class="thumb" data-thumb="${k}" style="height:${Math.round(898 * 0.36)}px"></span><span class="t">${t}</span><span class="d">${d}</span></label>`).join('')}
    </div></fieldset>
    ${nav('미리보기 보기')}
  </form>`,
  // 6 미리보기
  () => S.sent ? `<div class="step">
    <div class="done-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    <h1>상담 요청을 보냈습니다</h1>
    <p class="lede">보내 주신 구성을 확인한 뒤 초대 코드를 보낸 연락처로 연락드리겠습니다. 예시 화면은 계속 눌러 볼 수 있습니다.</p>
    <div class="nav"><button type="button" class="btn btn-ghost" data-act="edit">구성 바꾸기</button></div>
  </div>` : `<form class="step" data-step="5" novalidate>
    <h1>${esc(S.name.trim() || '우리 클럽')} 앱 미리보기</h1>
    <p class="lede">예시 화면의 탭과 일정을 눌러 보세요<span class="mobile-only">(아래로 내리면 화면이 있습니다)</span>. 이전 단계로 돌아가 바꾸면 화면이 바로 바뀝니다.</p>
    <dl class="summary">
      <div><dt>운영 방식</dt><dd>${esc(themeName(S.theme))}</dd></div>
      <div><dt>디자인</dt><dd>${esc(PRESETS.find((p) => p[0] === S.preset)[2])}</dd></div>
      <div><dt>더할 기능</dt><dd>${S.features.length ? S.features.map((k) => esc(FEATURES.find((f) => f[0] === k)[1])).join(', ') : '없음'}</dd></div>
    </dl>
    <p class="notice">예시 화면이며 실제 앱과 다를 수 있습니다. 상담 요청을 누르면 클럽 이름, 로고, 고른 구성과 설문 답이 운영자에게 전달됩니다. 연락처는 받지 않습니다.</p>
    <p class="err" id="send-err"></p>
    ${nav('이 구성으로 상담 요청')}
  </form>`,
];

function render() {
  $('#steps').innerHTML = STEP_NAMES.map((n, i) => `<li class="${i < S.step ? 'done' : i === S.step ? 'now' : ''}"${i === S.step ? ' aria-current="step"' : ''}><span class="sr">${i + 1}단계 </span><span class="lbl">${n}</span></li>`).join('');
  $('#view').innerHTML = VIEWS[S.step]();
  $('#stage').hidden = S.step === 0;
  drawPhone();
  if (S.step === 4) drawThumbs();
  save();
}
function drawThumbs() {
  document.querySelectorAll('[data-thumb]').forEach((el) => {
    const preset = el.dataset.thumb;
    const k = el.clientWidth / 426;
    const sh = el.shadowRoot || el.attachShadow({ mode: 'open' });
    const { html, css } = renderPhone({ ...previewInput(), preset }, 'home');
    sh.innerHTML = `<style>${css}:host{display:block;overflow:hidden}.phone{position:absolute;left:0;top:0;transform:scale(${k});transform-origin:top left;font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif}</style>${html}`;
    el.style.height = `${Math.round(898 * k)}px`;
  });
}
const goStep = (n) => {
  S.step = n;
  if (n === 5) { S.view = 'home'; S.back = []; }
  render();
  const h = $('#view h1');
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  window.scrollTo({ top: 0 });
};

// ── 입력 ──────────────────────────────────────────────────────────────────
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'name') { S.name = t.value.slice(0, LIMITS.nameMax); drawPhone(); save(); }
  else if (t.id === 'pain') { S.answers.pain = t.value.slice(0, LIMITS.painMax); save(); }
  else if (t.id === 'code') { S.code = t.value; t.setAttribute('aria-invalid', 'false'); $('#code-err').textContent = ''; }
  else if (t.id === 'custom-color') { S.brand = normHex(t.value); drawPhone(); save(); document.querySelectorAll('.sw[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === S.brand))); }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'logo' && t.files && t.files[0]) {
    const err = $('#logo-err');
    err.textContent = '';
    try {
      const { dataUrl, colors } = await loadLogo(t.files[0]);
      S.logo = dataUrl;
      S.logoColors = colors;
      if (colors[0]) S.brand = colors[0];
      render();
    } catch (x) { err.textContent = x.message; }
  } else if (t.name === 'theme') {
    S.theme = t.value;
    if (!S.featuresTouched) S.features = [...recommended(S.theme)];
    $('#theme-err').textContent = '';
    drawPhone(); save();
  } else if (t.name === 'feature') {
    S.featuresTouched = true;
    S.features = [...document.querySelectorAll('input[name=feature]:checked')].map((i) => i.value);
    drawPhone(); save();
  } else if (t.name === 'size' || t.name === 'weekly') { S.answers[t.name] = t.value; save(); }
  else if (t.name === 'tools') { S.answers.tools = [...document.querySelectorAll('input[name=tools]:checked')].map((i) => i.value); save(); }
  else if (t.name === 'preset') { S.preset = t.value; drawPhone(); save(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-color]');
  if (!b) return;
  if (b.dataset.color) { S.brand = b.dataset.color; render(); return; }
  const act = b.dataset.act;
  if (act === 'prev') goStep(Math.max(0, S.step - 1));
  else if (act === 'logo-clear') { S.logo = null; S.logoColors = []; S.brand = null; render(); }
  else if (act === 'edit') { S.sent = false; goStep(1); }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const step = Number(form.dataset.step);
  const btn = form.querySelector('[type=submit]');
  if (step === 0) {
    const code = normCode(S.code);
    const input = $('#code');
    if (!code) { $('#code-err').textContent = '초대 코드를 입력해 주세요.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    btn.disabled = true; btn.textContent = '확인 중';
    const r = await verify(code);
    if (!r.ok) {
      btn.disabled = false; btn.textContent = '입장하기';
      $('#code-err').textContent = REASON[r.reason] || REASON.invalid;
      input.setAttribute('aria-invalid', 'true'); input.focus();
      return;
    }
    S.code = code;
    goStep(1);
  } else if (step === 1) {
    if (!S.name.trim()) { $('#name-err').textContent = '클럽 이름을 입력해 주세요.'; $('#name').setAttribute('aria-invalid', 'true'); $('#name').focus(); return; }
    goStep(2);
  } else if (step === 2) {
    if (!S.theme) { $('#theme-err').textContent = '운영 방식을 하나 골라 주세요.'; return; }
    goStep(3);
  } else if (step === 3 || step === 4) {
    goStep(step + 1);
  } else if (step === 5) {
    btn.disabled = true; btn.textContent = '보내는 중';
    const r = await submit();
    if (!r.ok) {
      btn.disabled = false; btn.textContent = '이 구성으로 상담 요청';
      $('#send-err').textContent = REASON[r.reason] || REASON.network;
      return;
    }
    S.sent = true;
    render();
  }
});

async function submit() {
  const payload = {
    club_name: S.name.trim(), theme: S.theme, design_preset: S.preset,
    brand_color: isHex(S.brand || '') ? normHex(S.brand) : normHex(presetBrand(S.preset)),
    features: S.features, answers: S.answers,
  };
  if (MOCK) { console.info('[로컬 시험] 보낼 내용', payload, S.logo ? '로고 있음' : '로고 없음'); return new Promise((r) => setTimeout(() => r({ ok: true }), 500)); }
  const fd = new FormData();
  fd.append('action', 'submit');
  fd.append('code', S.code);
  fd.append('payload', JSON.stringify(payload));
  if (S.logo) fd.append('logo', await dataUrlToBlob(S.logo), 'logo.png');
  return call(fd);
}

// 코드 없이 중간 단계로 들어오지 못하게 — 저장된 코드가 없으면 입장부터
if (!S.code || S.step > 5) S.step = 0;
render();
