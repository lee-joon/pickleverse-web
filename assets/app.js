/*
 * 피클허브 커뮤니티 웹 — 상호작용 레이어 (오너 결정 2026-09-15: 웹에서도 가입·글쓰기).
 *
 * 정적 HTML(생성기 build-community-web.mjs)이 먼저 완전히 렌더되고, 이 스크립트는 그 위에
 * 로그인·회원가입·프로필 완성·글쓰기·댓글·삭제를 얹는다. JS 가 없어도 읽기는 그대로 된다.
 *
 * 계정 체계는 앱과 같다 — Supabase Auth(이메일·구글·카카오) + complete_global_profile
 * (이름·국적·약관 동의). 웹에서 만든 계정으로 앱에 로그인해도 같은 회원이다.
 *
 * 익명성: 작성자 표기는 서버가 주는 author_kind/author_seq 로만 조립한다. 본인 여부는
 * is_mine 하나로만 알 수 있고, 이 스크립트는 다른 사람의 프로필을 조회하는 경로가 없다.
 *
 * 의존성: supabase-js UMD(전역 `supabase`) — 생성기가 jsDelivr 핀 버전 + SRI 로 로드한다.
 * 설정: window.PV = { url, key, site, board, post, view, page, staticIds, total, terms, privacy, legal, store, play, oauth }
 */
(function () {
  'use strict';
  var PV = window.PV || {};
  if (!PV.url || !PV.key || !window.supabase) return;

  var sb = window.supabase.createClient(PV.url, PV.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  /* 편집기(editor.js) 등 다른 스크립트가 쓰는 최소 API — 세션·로그인·프로필 게이트·에러 문장. */
  var authListeners = [], readyResolve;
  var App = {
    sb: sb,
    get session() { return session; },
    get accountScope() { return session ? session.user.id : null; },
    ready: new Promise(function (res) { readyResolve = res; }),
    onAuth: function (cb) { authListeners.push(cb); },
    openAuth: function (m) { openAuth(m); },
    openProfile: function (cb) { return openProfile(cb); },
    checkProfile: function () { return checkProfile(); },
    /* 저장 뒤 캐시를 버리고 다시 읽는다 — 머리글의 이름이 옛 값으로 남지 않게. */
    refreshProfile: function () { profileOk = null; return checkProfile(); },
    get me() { return me; },
    requireMember: function (cb) { return requireMember(cb); },
    msg: function (e) { return msg(e); },
    /** 내 실력대 구간(없으면 null) — 편집기가 체크박스를 드러낼지 판단한다. */
    skillBand: function () { return mySkillBand(); },
    /** 커뮤니티 표시 기본값(마이그 441). 못 읽으면 꺼진 쪽으로 — 의도치 않은 노출보다 낫다. */
    communityPrefs: function () {
      if (!session) return Promise.resolve(false);
      return sb.rpc('hub_get_community_prefs')
        .then(function (r) { return !!(r && r.data && r.data.show_skill_band); })
        .catch(function () { return false; });
    },
    setCommunityPrefs: function (on) {
      return sb.rpc('hub_set_community_prefs', { p_show_skill_band: !!on })
        .then(function (r) { if (r && r.error) throw r.error; return !!(r.data && r.data.show_skill_band); });
    },
  };
  window.PVApp = App;

  /* ── 유틸 ─────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 전체 시각 — 한국 시각 'YYYY.MM.DD HH:MM'. 생성기(pageMeta.kstFull)와 같은 규칙이라 정적
     페이지와 하이드레이션 뒤 글자가 같다. 서버 시각은 UTC 문자열이라 잘라 쓰면 9시간 이르다
     (2026-09-26 리뷰). 두 복사본은 communityWebBehavior.test 가 같은 입력으로 대조한다. */
  function fmtFull(iso) {
    var t = Date.parse(String(iso || '').replace(/(\.\d{3})\d+/, '$1'));
    if (isNaN(t)) return '';
    var d = new Date(t + 9 * 60 * 60 * 1000), p2 = function (n) { return ('0' + n).slice(-2); };
    return d.getUTCFullYear() + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCDate()) + ' ' +
      p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes());
  }
  /* 오늘 글이면 HH:MM, 어제까지면 MM.DD, 지난 해면 YYYY.MM.DD — 게시판 통상 규칙.
     정적 페이지는 최대 2시간 묵어서 빌드 시점의 "오늘"이 어긋날 수 있다. 그래서
     읽는 시점의 로컬 시각으로 다시 계산한다(셀의 data-at 이 원본 시각). */
  function fmtList(iso) {
    var t = Date.parse(String(iso || ''));
    if (isNaN(t)) return '';
    var d = new Date(t), now = new Date();
    var p2 = function (n) { return ('0' + n).slice(-2); };
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      return p2(d.getHours()) + ':' + p2(d.getMinutes());
    }
    var md = p2(d.getMonth() + 1) + '.' + p2(d.getDate());
    return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + '.' + md;
  }
  function retimeDates(root) {
    (root || document).querySelectorAll('td.date[data-at]').forEach(function (td) {
      var v = fmtList(td.dataset.at); if (v) td.textContent = v;
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function body2html(s) {
    return String(s || '').split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br />') + '</p>'; }).join('');
  }
  /* 익명 코드 — src/apps/hub/services/communityAlias.ts 와 동일 알고리즘(계약 테스트가 상수 고정). */
  function communityAlias(postId, seq) {
    var input = postId + ':' + seq, h = 2166136261;
    for (var i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return String(100000 + (h % 900000));
  }
  var base = PV.board === 'news' ? PV.site : PV.site + '/free';
  var viewUrl = PV.site + (PV.board === 'news' ? '/news' : '/free') + '/view.html';
  var opLabel = '글쓴이';

  /* 436: 운영자 표기는 판이 아니라 작성자로 정해진다. 자유게시판은 운영자라도 익명이라
     서버가 'admin' 을 주지 않는다 — 여기서 판을 다시 따지지 않는다. */
  /* 실력대 배지 — 서버가 준 코드만 그린다. 없으면 아무것도 그리지 않는다
     (빈칸을 설명하는 글자를 넣으면 그 빈칸이 정보가 된다). */
  var SKILL_BANDS = { lt25: '2.5 미만', '25_30': '2.5~3.0', '30_35': '3.0~3.5', gte35: '3.5 이상' };
  /* 레이팅 → 구간. 서버 hub_community_skill_band 와 같은 경계다.
     본인 행만 읽는다 — 편집기는 이 함수를 부르기만 하고 사용자 식별자를 쥐지 않는다. */
  function bandOf(raw) {
    var n = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof n !== 'number' || !isFinite(n)) return null;
    if (n < 2.5) return 'lt25';
    if (n < 3.0) return '25_30';
    if (n < 3.5) return '30_35';
    return 'gte35';
  }
  function mySkillBand() {
    if (!session) return Promise.resolve(null);
    return sb.from('user_profiles').select('dupr_rating').eq('user_id', session.user.id).maybeSingle()
      .then(function (r) { return r && r.data ? bandOf(r.data.dupr_rating) : null; })
      .catch(function () { return null; });
  }
  function skillBadge(p) {
    var label = p && SKILL_BANDS[p.skill_band];
    return label ? '<span class="band">DUPR ' + esc(label) + '</span>' : '';
  }

  /* 반응 아이콘 — 글은 패들, 댓글은 엄지척/엄지다운. 모양만 보고도 무엇에 대한
     반응인지 구분된다(오너 지시 2026-09-17). 카운트는 서버가 준 값만 그린다. */
  var PADDLE = function (filled) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ico-paddle">' +
      '<path d="M12 2.4c4.2 0 7.3 3.1 7.3 7.1 0 3.5-2.4 6.4-5.6 7v3.3a1.7 1.7 0 0 1-3.4 0v-3.3c-3.2-.6-5.6-3.5-5.6-7 0-4 3.1-7.1 7.3-7.1z" fill="' +
      (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="' + (filled ? 0 : 1.7) + '" stroke-linejoin="round"/></svg>';
  };
  var THUMB_UP = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ico-thumb">' +
    '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
  var THUMB_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ico-thumb">' +
    '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>';

  function authorLabel(c) {
    if (c.author_kind === 'withdrawn' || c.author_seq == null) return { label: '탈퇴한 회원', cls: 'gone' };
    if (c.author_kind === 'admin') return { label: '관리자', cls: 'op' };
    if (c.author_seq === 0) return { label: '익명 ' + communityAlias(postId, 0), badge: opLabel, cls: 'op' };
    return { label: '익명 ' + communityAlias(postId, c.author_seq), cls: '' };
  }

  /* 서버 예외 문자열 → 사용자 문장. 서버는 영어 식별 문자열을 던진다(i18n 은 클라 책임). */
  var ERR = [
    ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않습니다.'],
    ['Email not confirmed', '가입 확인 메일의 링크를 먼저 눌러 주세요.'],
    ['User already registered', '이미 가입된 이메일입니다. 로그인해 주세요.'],
    ['Password should be at least', '비밀번호는 6자 이상이어야 합니다.'],
    ['Unable to validate email', '이메일 형식이 올바르지 않습니다.'],
    ['For security purposes', '조금 전에 보냈습니다. 1분쯤 뒤에 다시 시도해 주세요.'],
    // 부분일치 첫 승이다 — 'rate limited' 는 'rate limit' 을 포함하므로
    // 좁은 쪽(전용 문구)이 반드시 위에 있어야 도달한다.
    ['Rate limited', '잠시 후 다시 시도해 주세요. (시간당 작성 한도)'],
    ['rate limit', '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
    ['Blocked term', '사용할 수 없는 표현이 포함되어 있습니다.'],
    ['Community write suspended', '커뮤니티 작성이 정지된 계정입니다.'],
    ['Not authenticated', '로그인이 필요합니다.'],
    ['Not authorized', '이 작업을 할 권한이 없습니다. 로그인한 계정을 확인해 주세요.'],
    ['Invalid rich body', '본문 서식에 허용되지 않은 내용이 있습니다. 다시 시도해 주세요.'],
    ['Invalid image path', '사진 정보가 올바르지 않습니다. 사진을 다시 넣어 주세요.'],
    ['Too many images', '사진은 글 하나에 10장까지 넣을 수 있습니다.'],
    ['Payload too large', '사진 용량이 너무 큽니다.'],
    ['row-level security', '업로드 권한이 없습니다. 로그인 상태를 확인해 주세요.'],
    ['permission denied', '권한 확인에 실패했습니다. 잠시 후 다시 시도하거나 운영자에게 알려 주세요.'],
    ['Bucket not found', '사진 저장소가 아직 준비되지 않았습니다. 운영자에게 알려 주세요.'],
    ['mime type', '이 사진 형식은 올릴 수 없습니다. JPG·PNG·WebP 로 올려 주세요.'],
    ['Post not found', '글을 찾을 수 없습니다. 삭제되었을 수 있습니다.'],
    ['Comment not found', '댓글을 찾을 수 없습니다.'],
    ['Invalid real_name length', '이름은 2~40자여야 합니다.'],
    ['Domestic users must use Korean name', '내국인은 한글 이름만 입력할 수 있습니다.'],
    ['Domestic name must be Korean or Latin letters', '이름은 한글만 또는 영문만으로 입력해 주세요(섞어 쓸 수 없습니다).'],
    ['Invalid phone format', '연락처는 숫자만 9~15자리로 입력해 주세요.'],
    ['Invalid birth year', '출생연도를 다시 확인해 주세요. 만 14세 이상만 가입할 수 있습니다.'],
    ['Invalid gender', '성별 값이 올바르지 않습니다.'],
    ['Foreign users must use Latin name', '외국인은 영문 이름만 입력할 수 있습니다.'],
    ['Platform terms must be accepted', '이용약관에 동의해 주세요.'],
    ['Privacy policy must be accepted', '개인정보 처리방침에 동의해 주세요.'],
  ];
  function msg(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
    for (var i = 0; i < ERR.length; i++) if (m.toLowerCase().indexOf(ERR[i][0].toLowerCase()) >= 0) return ERR[i][1];
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  /* 신고 사유 — src/modules/moderation/reportService.ts 의 REPORT_REASONS 와 같은 코드·순서.
     라벨은 ko/hub.json community/report.reason 과 같은 문구를 쓴다(웹은 한국어 단일). */
  var REPORT_REASONS = [
    ['spam', '스팸/도배'],
    ['harassment', '괴롭힘/욕설'],
    ['sexual', '음란성/선정성'],
    ['violence', '폭력/위협'],
    ['other', '기타'],
  ];

  /* ── 다이얼로그 ────────────────────────────────────────────────────────── */
  function dialog(html) {
    var d = el('<dialog class="pv">' + html + '</dialog>');
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    var x = $('[data-x]', d); if (x) x.addEventListener('click', function () { d.close(); });
    d.showModal();
    var heading = $('h3', d);
    if (heading) { heading.id = 'pv-dialog-' + (++dialogSeq); d.setAttribute('aria-labelledby', heading.id); }
    d.querySelectorAll('.pv-err').forEach(function (e) { e.setAttribute('role', 'alert'); });
    return d;
  }
  var dialogSeq = 0;
  function setErr(d, text) { var e = $('.pv-err', d); if (e) { e.textContent = text || ''; e.hidden = !text; } }
  function busy(form, on) { form.querySelectorAll('button,input,textarea').forEach(function (n) { n.disabled = !!on; }); }

  /* ── 세션 / 계정 슬롯 ──────────────────────────────────────────────────── */
  var session = null;
  var me = null; // 본인 행(users) — 본인 화면에만 쓴다. 다른 사람의 행을 읽는 경로는 없다.
  function renderAccount() {
    var slot = $('#pv-account'); if (!slot) return;
    var html;
    if (session) {
      var name = (me && me.real_name) || (session.user && session.user.email) || '회원';
      html = '<span class="account-name" title="다른 이용자에게는 익명으로 보입니다">' + esc(name) + '</span>' +
        '<a class="lnk" href="' + esc(PV.site + '/me.html') + '">내 정보</a>' +
        '<button class="lnk" data-pv="logout">로그아웃</button>';
    } else {
      html = '<button class="lnk" data-pv="login">로그인</button><button class="lnk" data-pv="signup">회원가입</button>';
    }
    slot.innerHTML = '<span class="account-desktop">' + html + '</span>' +
      '<details class="account-mobile"><summary>계정</summary><div class="account-actions">' + html + '</div></details>';
  }

  /* 소셜 로그인 버튼 — 어떤 제공자를 켤지는 생성기(PV.oauth)가 정한다.
     애플은 Supabase 에 OAuth 비밀키가 들어가야 동작해서 준비되기 전에는 빠진다. */
  var OAUTH_LABELS = { google: '구글로 계속하기', kakao: '카카오로 계속하기', apple: 'Apple로 계속하기' };
  /* 각 제공자의 브랜드 마크 — 로그인 버튼에 쓰라고 배포되는 표식이다. 색·비율은 건드리지 않는다.
     인라인 SVG 로 둔다(외부 요청 0, CSP 무관, 다크/라이트 무관). */
  var OAUTH_ICONS = {
    google: '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>',
    kakao: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="#191600" d="M12 3C6.99 3 3 6.2 3 10.14c0 2.5 1.66 4.7 4.17 5.96-.18.65-.66 2.4-.76 2.78-.12.47.17.46.36.34.15-.1 2.4-1.63 3.37-2.29.6.09 1.22.13 1.86.13 5.01 0 9-3.2 9-7.14S17.01 3 12 3z"/>' +
      '</svg>',
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="#FFFFFF" d="M16.36 12.73c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.7zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.67 1.37-.59.68-1.1 1.76-.96 2.8 1.01.08 2.05-.51 2.69-1.27z"/>' +
      '</svg>',
  };
  function socialButtons() {
    var list = (PV.oauth && PV.oauth.length ? PV.oauth : ['google', 'kakao'])
      .filter(function (k) { return OAUTH_LABELS[k]; });
    return list.map(function (k) {
      return '<button type="button" data-oauth="' + k + '">' + (OAUTH_ICONS[k] || '') + OAUTH_LABELS[k] + '</button>';
    }).join('');
  }

  function openAuth(mode) {
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button>' +
      '<div class="pv-tabs"><button type="button" data-tab="login">로그인</button><button type="button" data-tab="signup">회원가입</button></div>' +
      '<div class="pv-social">' + socialButtons() + '</div><div class="pv-or">또는 이메일로</div>' +
      '<form class="pv-form" id="pv-auth">' +
        '<label>이메일<input name="email" type="email" autocomplete="email" required /></label>' +
        '<label>비밀번호<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>' +
        '<p class="pv-err" hidden></p>' +
        '<button type="submit" class="btn primary"></button>' +
        '<button type="button" class="lnk" data-forgot>비밀번호를 잊으셨나요?</button>' +
        '<button type="button" class="lnk" data-resend hidden>확인 메일 다시 보내기</button>' +
        '<p class="pv-note" data-signup-note hidden>가입하면 확인 메일이 갑니다. 메일의 링크를 누른 뒤 로그인해 주세요. 가입 후 이름·약관 동의를 한 번 더 확인합니다.</p>' +
      '</form>'
    );
    var form = $('#pv-auth', d), submit = $('button[type=submit]', form), cur = mode || 'login';
    function tab(m) {
      cur = m;
      d.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === m); });
      submit.textContent = m === 'login' ? '로그인' : '이메일로 가입';
      $('[data-signup-note]', form).hidden = m !== 'signup';
      $('[data-forgot]', form).hidden = m !== 'login';
      $('[data-resend]', form).hidden = true;
      $('input[name=password]', form).autocomplete = m === 'login' ? 'current-password' : 'new-password';
      setErr(d, '');
    }
    d.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.tab); }); });
    tab(cur);

    d.querySelectorAll('[data-oauth]').forEach(function (b) {
      b.addEventListener('click', function () {
        sb.auth.signInWithOAuth({ provider: b.dataset.oauth, options: { redirectTo: location.href.split('#')[0] } })
          .then(function (r) { if (r.error) setErr(d, msg(r.error)); });
      });
    });
    $('[data-forgot]', form).addEventListener('click', function () {
      var email = form.email.value.trim();
      if (!email) { setErr(d, '이메일을 먼저 입력해 주세요.'); return; }
      sb.auth.resetPasswordForEmail(email, { redirectTo: PV.site + '/' }).then(function (r) {
        setErr(d, r.error ? msg(r.error) : '비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 주세요.');
      });
    });

    /* 확인 메일 재발송 — 메일이 유실되면 가입도 로그인도 안 되는 상태로 갇힌다
       (이미 가입된 이메일이라 재가입 불가, 미확인이라 로그인 불가). 빠져나올 문이 필요하다. */
    function resendConfirm(email) {
      if (!email) { setErr(d, '이메일을 먼저 입력해 주세요.'); return; }
      sb.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: location.href.split('#')[0] } })
        .then(function (r) {
          setErr(d, r.error ? msg(r.error)
            : '확인 메일을 다시 보냈습니다. 스팸함·격리함도 확인해 주세요.');
        });
    }
    $('[data-resend]', form).addEventListener('click', function () { resendConfirm(form.email.value.trim()); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); setErr(d, ''); busy(form, true);
      var email = form.email.value.trim(), password = form.password.value;
      var p = cur === 'login'
        ? sb.auth.signInWithPassword({ email: email, password: password })
        : sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: location.href.split('#')[0] } });
      p.then(function (r) {
        busy(form, false);
        if (r.error) {
          setErr(d, msg(r.error));
          // 코드가 없는 구버전 응답도 있어 문구로도 판정한다.
          var unconfirmed = (r.error.code === 'email_not_confirmed')
            || String(r.error.message || '').toLowerCase().indexOf('email not confirmed') >= 0;
          if (unconfirmed) $('[data-resend]', form).hidden = false;
          return;
        }
        if (cur === 'signup' && !(r.data && r.data.session)) {
          form.innerHTML =
            '<p class="pv-note">확인 메일을 보냈습니다. <b>' + esc(email) + '</b> 의 메일함에서 링크를 누른 뒤 로그인해 주세요. '
            + '회사 메일은 스팸함이나 격리함으로 갈 수 있습니다.</p>' +
            '<p class="pv-err" hidden></p>' +
            '<button type="button" class="lnk" data-resend-sent>메일이 안 오면 다시 보내기</button>';
          $('[data-resend-sent]', form).addEventListener('click', function () { resendConfirm(email); });
          return;
        }
        d.close();
      });
    });
  }

  /* ── 프로필 완성 게이트 (앱의 CompleteProfile 과 같은 RPC) ─────────────── */
  var profileOk = null; // null=미확인, true/false
  /* 진행 중인 조회. 캐시는 **응답이 온 뒤에야** 채워지므로, 이게 없으면 부트·
     SIGNED_IN·편집기 게이트가 동시에 물어보고 **각자 창을 띄운다**(회원 정보
     확인이 두 개 겹쳐 뜨던 원인, 2026-09-18). 먼저 뜬 조회에 합류시킨다. */
  var profileCheck = null;
  function checkProfile() {
    if (!session) return Promise.resolve(false);
    if (profileOk !== null) return Promise.resolve(profileOk);
    if (profileCheck) return profileCheck;
    // uid 는 아래 "계정이 바뀌었나" 비교용이다. 질의 자체는 session.user.id 를
    // 그대로 써서 "본인 행 고정" 가드(communityAnonymity.test)의 모양을 유지한다.
    var uid = session.user.id;
    profileCheck = sb.from('users').select('nationality_type,platform_terms_accepted_at,privacy_policy_accepted_at,real_name')
      .eq('id', session.user.id).maybeSingle()
      .then(function (r) {
        profileCheck = null;
        // 조회 중에 계정이 바뀌었으면 남의 결과다 — 캐시에 넣지 않는다.
        if (!session || session.user.id !== uid) return false;
        var u = r.data;
        me = u || null;
        renderAccount();
        profileOk = !!(u && u.real_name && u.nationality_type && u.platform_terms_accepted_at && u.privacy_policy_accepted_at);
        return profileOk;
      }, function (e) { profileCheck = null; throw e; });
    return profileCheck;
  }
  /* 열려 있는 회원정보 창과 그 창이 끝나면 부를 콜백들. 창은 하나만 뜬다 —
     ①로 대부분 막히지만, 서로 모르는 두 경로가 각각 열려 할 수 있으므로 여기서도 막는다. */
  var profileDialog = null, profileResult = null;
  /* 이 창이 보낼 값. complete_global_profile 은 받은 값으로 통째로 덮어쓴다(299) — 이 창이 받지
     않는 값(성별·출생연도·연락처·거주지·소속·허브 노출)은 읽어 둔 현재 값을 그대로 되돌려 보낸다.
     me.js 와 같은 규칙이다. 빈 값을 보내면 동의일 하나만 빠진 기존 회원이 웹에 처음 들어와 이 창을
     마칠 때 연락처 등이 조용히 지워진다(2026-09-26 리뷰). 약관은 이 창의 체크박스로 받은 동의다. */
  var PROFILE_KEEP = 'gender,birth_year,phone,region,city,district,affiliation_note,hub_visibility_opt_in';
  function completionPayload(nat, name, row) {
    row = row || {};
    return {
      p_nationality_type: nat,
      p_real_name: name,
      p_gender: row.gender || null,
      p_birth_year: row.birth_year || null,
      p_phone: row.phone || '',
      p_country: nat === 'domestic' ? 'KR' : 'visitor',
      p_region: row.region || null, p_city: row.city || null, p_district: row.district || null,
      p_affiliation_note: row.affiliation_note || null,
      p_platform_terms_version: PV.terms,
      p_platform_terms_accepted: true,
      p_privacy_policy_version: PV.privacy,
      p_privacy_policy_accepted: true,
      p_hub_visibility_opt_in: !!row.hub_visibility_opt_in,
    };
  }
  function openProfile(onDone) {
    if (profileDialog) {
      if (onDone) profileResult.then(function (ok) { if (ok) onDone(); });
      return profileResult;
    }
    var scope = App.accountScope;
    // 이미 있는 이름·국적은 채워 둔다 — 비워 두면 외국인 회원이 기본값(내국인)으로 바뀌거나
    // 이름을 다시 쳐서 달라질 수 있다. me 는 checkProfile 이 읽은 본인 행이다.
    var known = me || {};
    var natNow = known.nationality_type === 'foreign' ? 'foreign' : 'domestic';
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button>' +
      '<h3>회원 정보 확인</h3><p class="pv-note">커뮤니티 글은 익명으로 올라가지만, 계정에는 앱과 같은 기본 정보가 필요합니다. 이름은 다른 이용자에게 표시되지 않습니다.</p>' +
      '<form class="pv-form" id="pv-profile">' +
        '<fieldset class="pv-radio"><legend>내국인 / 외국인</legend>' +
          '<label><input type="radio" name="nat" value="domestic"' + (natNow === 'domestic' ? ' checked' : '') + ' /> 내국인</label>' +
          '<label><input type="radio" name="nat" value="foreign"' + (natNow === 'foreign' ? ' checked' : '') + ' /> 외국인</label></fieldset>' +
        '<label>이름<input name="name" type="text" autocomplete="name" maxlength="40" required value="' + esc(known.real_name || '') + '" /></label>' +
        '<label class="pv-check"><input type="checkbox" name="terms" required /> <a href="' + esc(PV.legal) + '/terms.html" target="_blank" rel="noopener">이용약관</a>에 동의합니다</label>' +
        '<label class="pv-check"><input type="checkbox" name="privacy" required /> <a href="' + esc(PV.legal) + '/privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a>에 동의합니다</label>' +
        '<p class="pv-err" hidden></p>' +
        '<button type="submit" class="btn primary">완료</button>' +
      '</form>'
    );
    profileDialog = d;
    var resolve, completed = false;
    var result = new Promise(function (done) { resolve = done; });
    profileResult = result;
    if (onDone) result.then(function (ok) { if (ok) onDone(); });
    d.addEventListener('close', function () {
      if (profileDialog === d) { profileDialog = null; profileResult = null; }
      resolve(completed);
    });
    var form = $('#pv-profile', d);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); setErr(d, ''); busy(form, true);
      if (scope !== App.accountScope) { d.close(); return; }
      var nat = form.nat.value, name = form.name.value.trim();
      // 이 창이 받지 않는 값을 먼저 읽는다. 읽지 못하면 저장하지 않는다 — 빈 값으로 보내면 지운다.
      sb.from('users').select(PROFILE_KEEP).eq('id', session.user.id).maybeSingle().then(function (cur) {
        if (scope !== App.accountScope) return null;
        if (cur.error) throw cur.error;
        return sb.rpc('complete_global_profile', completionPayload(nat, name, cur.data));
      }).then(function (r) {
        if (!r || scope !== App.accountScope) return;
        busy(form, false);
        if (r.error) { setErr(d, msg(r.error)); return; }
        profileOk = true; me = { real_name: name, nationality_type: nat }; renderAccount();
        completed = true; d.close();
      }).catch(function (e) {
        busy(form, false); setErr(d, msg(e));
      });
    });
    return result;
  }
  /** 로그인 + 프로필 완성이 끝난 뒤에만 cb 를 부른다. */
  function requireMember(cb) {
    if (!session) { openAuth('login'); return Promise.resolve(false); }
    var scope = App.accountScope;
    return checkProfile().then(function (ok) { return ok || openProfile(); }).then(function (ok) {
      if (!ok || scope !== App.accountScope) return false;
      if (cb) cb();
      return true;
    });
  }

  /* ── 신고 — 앱과 같은 report_content RPC. 같은 사람이 같은 글을 두 번 신고하면
     서버가 already_reported 를 돌려주므로 중복 신고는 자연히 막힌다. ── */
  function openReport(contentType, contentId, onDone) {
    var isPost = contentType === 'hub_community_post';
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button>' +
      '<h3>신고 사유</h3>' +
      '<p class="pv-note">' + (isPost ? '신고한 글은 내 화면에서 바로 보이지 않습니다.' : '신고한 댓글은 내 화면에서 바로 가려집니다.') + ' 운영자가 확인 후 조치합니다.</p>' +
      '<div class="pv-reasons">' +
        REPORT_REASONS.map(function (r) {
          return '<button type="button" class="btn" data-reason="' + r[0] + '">' + esc(r[1]) + '</button>';
        }).join('') +
      '</div><p class="pv-err" hidden></p>'
    );
    d.querySelectorAll('[data-reason]').forEach(function (b) {
      b.addEventListener('click', function () {
        d.querySelectorAll('button').forEach(function (n) { n.disabled = true; });
        sb.rpc('report_content', {
          p_content_type: contentType, p_content_id: contentId, p_reason_code: b.dataset.reason, p_detail: null,
        }).then(function (r) {
          if (r.error) throw r.error;
          d.close();
          var already = r.data && r.data.status === 'already_reported';
          if (onDone) onDone(already);
        }).catch(function (e) {
          d.querySelectorAll('button').forEach(function (n) { n.disabled = false; });
          setErr(d, msg(e));
        });
      });
    });
  }

  /* 신고한 글은 서버가 'Post not found' 로 막으므로 다시 읽지 않고 목록으로 보낸다. */
  function afterPostReport(already) {
    alert(already ? '이미 신고한 글입니다.' : '신고가 접수되었습니다. 검토 후 조치할게요.');
    location.href = base + '/';
  }

  /* ── 목록 페이지: 빌드 이후 올라온 글을 위에 얹고 댓글 수를 갱신 ────────── */
  /* 목록 행 한 줄. 새 글 얹기와 검색 결과가 같이 쓴다 — 두 벌로 두면 열을 하나
     더할 때 한쪽만 고쳐져 칸 수가 어긋난다(계약 테스트가 칸 수를 고정한다). */
  function listRowHtml(p, num, extraClass) {
    var cmt = p.comment_count > 0 ? ' <span class="cmt">[' + p.comment_count + ']</span>' : '';
    var mine = p.is_mine ? '<span class="mine">내 글</span>' : '';
    var viewUrl = (p.board_kind === 'news' ? '/news' : '/free') + '/view.html';
    return '<tr data-id="' + esc(p.id) + '" class="' + esc(extraClass || '') + (p.is_mine ? ' is-mine' : '') + '">' +
      '<td class="num">' + num + '</td>' +
      '<td class="tit"><a href="' + esc(viewUrl + '?id=' + p.id) + '">' + esc(p.title) + '</a>' + cmt + mine + '</td>' +
      '<td class="who">' + (p.author_kind === 'admin' ? '관리자' : '익명 ' + communityAlias(p.id, 0)) + skillBadge(p) + '</td>' +
      '<td class="date" data-at="' + esc(p.published_at) + '">' + esc(fmtList(p.published_at)) + '</td>' +
      '<td class="views">' + (typeof p.view_count === 'number' ? p.view_count : 0) + '</td>' +
      '<td class="likes">' + (typeof p.like_count === 'number' ? p.like_count : 0) + '</td>' +
      '</tr>';
  }

  /* 빈 목록 한 줄 — 생성기가 <template id="pv-empty"> 로 실어 둔 게시판별 문구·버튼을 그대로 쓴다.
     여기서 문구를 따로 지으면 정적 화면과 어긋난다(2026-09-23: 빈 게시판의 '첫 글 쓰기'·
     '자유게시판 보기' 버튼이 이 함수 자리의 공통 문구에 덮여 사라졌다). */
  function emptyRowHtml() {
    var t = document.getElementById('pv-empty');
    return t ? t.innerHTML : '<tr class="empty"><td colspan="6"><strong>아직 글이 없습니다</strong></td></tr>';
  }

  var listRequest = 0;
  function refreshList() {
    var tbody = $('#pv-list');
    if (!tbody || PV.page !== 1 || new URLSearchParams(location.search).get('q')) return;
    var request = ++listRequest;
    var staticIds = {}; (PV.staticIds || []).forEach(function (id) { staticIds[id] = true; });
    return sb.rpc('get_hub_community_posts', { p_board_kind: PV.board, p_limit: 50, p_cursor_pinned: null, p_cursor_at: null, p_cursor_id: null, p_popular: !!PV.popular })
      .then(function (r) {
        if (request !== listRequest) return;
        if (r.error || !r.data) return;
        var posts = r.data.posts || [];
        if (PV.popular) {
          tbody.innerHTML = posts.length ? posts.map(function (post) { return listRowHtml(post, '–', ''); }).join('')
            : emptyRowHtml();
          var count = $('#pv-total'); if (count) count.textContent = posts.length;
          retimeDates(tbody);
          return;
        }
        posts.forEach(function (p) {
          var row = tbody.querySelector('tr[data-id="' + p.id + '"]');
          if (row) {
            if (p.is_mine && !row.querySelector('.mine')) { row.classList.add('is-mine'); row.querySelector('.tit').appendChild(el('<span class="mine">내 글</span>')); }
            var cmt = row.querySelector('.cmt');
            if (p.comment_count > 0) { if (!cmt) { cmt = el('<span class="cmt"></span>'); row.querySelector('.tit').appendChild(cmt); } cmt.textContent = '[' + p.comment_count + ']'; }
            else if (cmt) cmt.remove();
            var vw = row.querySelector('.views');
            if (vw && typeof p.view_count === 'number') vw.textContent = p.view_count;
            var likes = row.querySelector('.likes');
            if (likes && typeof p.like_count === 'number') likes.textContent = p.like_count;
          }
        });
        /* 정적 페이지는 최대 2시간 묵는다 — 그 사이 지워진 글이 남아 있으면 눌러도 없는 글이고,
           새 글은 아예 안 보인다. 1페이지는 최신 30건이고 여기서 50건을 받아오므로,
           받아온 목록에 없는 행은 (밀려난 게 아니라) 지워진 행이다. */
        var live = {}; posts.forEach(function (p) { live[p.id] = true; });
        tbody.querySelectorAll('tr[data-id]').forEach(function (row) {
          if (!live[row.dataset.id]) row.remove();
        });
        var fresh = posts.filter(function (p) { return !staticIds[p.id]; });
        if (fresh.length === 0) {
          // 정적 빈 행이 이미 있으면 그대로 둔다. 빌드 뒤 글이 전부 지워져 행이 하나도 안
          // 남았을 때만 같은 빈 행을 넣는다.
          if (!posts.length && !tbody.querySelector('tr')) tbody.innerHTML = emptyRowHtml();
          return;
        }
        var empty = tbody.querySelector('tr.empty'); if (empty) empty.remove();
        var total = (PV.total || 0) + fresh.filter(function (p) { return !p.is_pinned; }).length;
        // 한 줄씩 firstChild 앞에 끼우면 순서가 뒤집혀 번호가 5,6,4 처럼 나온다 —
        // 조각(fragment)에 순서대로 담아 한 번에 넣는다. 공지 행이 있으면 그 아래에.
        var frag = document.createDocumentFragment();
        var pins = document.createDocumentFragment();
        var normalIndex = 0;
        fresh.forEach(function (p) {
          if (p.is_pinned) pins.appendChild(el(listRowHtml(p, '공지', 'notice')));
          else frag.appendChild(el(listRowHtml(p, total - normalIndex++, 'fresh')));
        });
        tbody.insertBefore(pins, tbody.firstChild);
        var anchor = tbody.querySelector('tr:not(.notice)');
        tbody.insertBefore(frag, anchor || null);
        retimeDates(tbody);
        var tot = $('#pv-total');
        if (tot) {
          tot.textContent = total;
          // 빌드 시점에 글이 0건이면 카운트가 hidden 으로 나간다 — 글이 생겼으니 되살린다.
          var wrap = tot.closest('span[hidden]'); if (wrap) wrap.removeAttribute('hidden');
        }
      }).catch(function () {});
  }

  /* ── 게시판 검색 (마이그 443) ──────────────────────────────────────────────
     결과는 클라에서 그린다 — 검색 결과 페이지는 색인 대상이 아니고(정적 페이지가
     아니다), 목록 RPC 에 인자 하나만 더한 것이라 서버 경로도 하나다.
     ?q= 를 URL 에 남겨 뒤로가기와 링크 공유가 되게 한다. */
  function searchUrl(q) {
    var path = location.pathname;
    return q ? path + '?q=' + encodeURIComponent(q) : path;
  }

  function runSearch(q) {
    var tbody = $('#pv-list'); if (!tbody) return;
    var request = ++listRequest;
    var note = $('.search-note');
    if (!note) {
      note = el('<p class="search-note"></p>');
      note.setAttribute('role', 'status');
      var table = $('table.list');
      if (table && table.parentNode) table.parentNode.insertBefore(note, table);
    }
    note.textContent = '검색 중…';
    // 페이지 번호와 최신/인기 전환은 정적 목록의 것이다 — 검색 중에는 뜻이 없다.
    var paging = $('.paging'); if (paging) paging.hidden = true;
    var sorts = $('.sorts'); if (sorts) sorts.hidden = true;

    return sb.rpc('get_hub_community_posts', {
      p_board_kind: PV.board, p_limit: 50,
      p_cursor_pinned: null, p_cursor_at: null, p_cursor_id: null,
      p_popular: false, p_query: q,
    }).then(function (r) {
      if (request !== listRequest) return;
      if (r.error) { note.textContent = msg(r.error); return; }
      var posts = (r.data && r.data.posts) || [];
      tbody.innerHTML = '';
      if (posts.length === 0) {
        tbody.appendChild(el('<tr class="empty"><td colspan="6">검색 결과가 없습니다.</td></tr>'));
      } else {
        var frag = document.createDocumentFragment();
        // 번호 칸은 비운다. 게시판 번호는 전체 목록에서의 자리로 정해지는데 서버가
        // 그 값을 주지 않는다 — 검색 결과 안의 순번을 대신 넣으면 게시판에서 37번인
        // 글이 3번으로 보인다. 모르는 값을 지어내느니 없다고 말하는 편이 낫다.
        posts.forEach(function (post) { frag.appendChild(el(listRowHtml(post, '–', ''))); });
        tbody.appendChild(frag);
        retimeDates(tbody);
      }
      note.innerHTML = '<b>' + esc(q) + '</b> 검색 결과 ' + posts.length + '건 · ' +
        '<a href="' + esc(searchUrl('')) + '">전체 목록</a>';
    }).catch(function (e) { if (request === listRequest) note.textContent = msg(e); });
  }

  function initSearch() {
    var form = $('#pv-search'); if (!form) return;
    var input = $('#pv-q');
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    if (q) { if (input) input.value = q; runSearch(q); }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var next = (input && input.value || '').trim();
      // 빈 검색은 정적 목록으로 되돌린다 — 그 편이 링크로도 정직하다.
      if (!next) { location.href = searchUrl(''); return; }
      history.pushState({ q: next }, '', searchUrl(next));
      runSearch(next);
    });
    window.addEventListener('popstate', function () {
      var back = (new URLSearchParams(location.search).get('q') || '').trim();
      if (back) { if (input) input.value = back; runSearch(back); }
      else location.reload();
    });
  }

  /* ── 글 페이지: 댓글 최신화 + 댓글 쓰기 + 본인 글/댓글 삭제 ─────────────── */
  var postId = PV.post || null;
  if (PV.view) { try { postId = new URLSearchParams(location.search).get('id'); } catch (e) { postId = null; } }

  function renderComments(comments, total) {
    var box = $('#pv-comments'); if (!box) return;
    if (comments.length === 0) { box.innerHTML = ''; }
    else {
      box.innerHTML = '<ul>' + comments.map(function (c) {
        var a = authorLabel(c);
        var txt = c.hidden || c.body == null ? '<span class="txt tomb">숨김 처리된 댓글입니다.</span>' : '<span class="txt">' + esc(c.body) + '</span>';
        var mine = c.is_mine ? '<span class="mine">나</span>' : '';
        var badge = a.badge ? '<span class="opb">' + esc(a.badge) + '</span>' : '';
        // 조건은 앱(HubCommunityPostScreen)과 같다 — 숨기기는 can_mute 이고 아직 안 가려졌을 때, 신고는 내 댓글이 아닐 때.
        var acts = [];
        if (session) {
          if (c.is_mine) acts.push('<button class="lnk pv-del" data-del-comment="' + esc(c.id) + '">삭제</button>');
          if (c.can_mute && !c.hidden) acts.push('<button class="lnk" data-mute="' + esc(c.id) + '">숨기기</button>');
          if (c.can_mute && c.hidden) acts.push('<button class="lnk" data-unmute="' + esc(c.id) + '">숨김 해제</button>');
          if (!c.is_mine) acts.push('<button class="lnk" data-report-comment="' + esc(c.id) + '">신고</button>');
        }
        // 숨긴 댓글에는 반응을 붙이지 않는다 — 툼스톤에 투표할 이유가 없다.
        var react = c.hidden ? '' :
          '<span class="react">' +
            '<button class="rbtn' + (c.my_reaction === 1 ? ' on' : '') + '" data-react-up="' + esc(c.id) + '"' +
              ' aria-label="댓글 좋아요" aria-pressed="' + (c.my_reaction === 1 ? 'true' : 'false') + '" title="좋아요">' +
              THUMB_UP + '<b>' + (c.like_count || 0) + '</b></button>' +
            '<button class="rbtn down' + (c.my_reaction === -1 ? ' on' : '') + '" data-react-down="' + esc(c.id) + '"' +
              ' aria-label="댓글 싫어요" aria-pressed="' + (c.my_reaction === -1 ? 'true' : 'false') + '" title="싫어요">' +
              THUMB_DOWN + '<b>' + (c.dislike_count || 0) + '</b></button>' +
          '</span>';
        return '<li' + (c.is_mine ? ' class="is-mine"' : '') + '><span class="who ' + a.cls + '">' + esc(a.label) + badge + mine + '</span>' + txt + react +
          '<span class="when">' + esc(fmtFull(c.created_at)) + (acts.length ? '<span class="acts">' + acts.join('') + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    var h = $('#pv-ccount'); if (h) h.textContent = typeof total === 'number' ? total : comments.length;
  }
  function renderCommentForm() {
    var lock = $('#pv-cform-slot'); if (!lock) return;
    lock.className = 'cform-slot';
    lock.innerHTML =
      '<form class="pv-form pv-cform" id="pv-cform">' +
        '<textarea name="body" aria-label="댓글" rows="3" maxlength="1000" placeholder="' + (session ? '댓글을 입력하세요 (익명)' : '로그인하면 댓글을 쓸 수 있습니다') + '"' + (session ? ' required' : '') + '></textarea>' +
        '<div class="pv-row"><p class="pv-err" role="alert" hidden></p><button type="submit" class="btn primary">' + (session ? '등록' : '로그인하고 댓글 쓰기') + '</button></div>' +
      '</form>';
    var form = $('#pv-cform', lock);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!session) { openAuth('login'); return; }
      requireMember(function () {
        busy(form, true);
        sb.rpc('hub_create_community_comment', { p_post_id: postId, p_body: form.body.value.trim() }).then(function (r) {
          busy(form, false);
          if (r.error) { var e = $('.pv-err', form); e.textContent = msg(r.error); e.hidden = false; return; }
          form.body.value = '';
          loadPost({ revealComment: r.data && r.data.id });
        }).catch(function (e) { busy(form, false); setErr(form, msg(e)); });
      }).catch(function (e) { setErr(form, msg(e)); });
    });
  }
  function richBody(p) {
    var R = window.PVRich;
    if (R && p.body_rich) {
      var doc = R.sanitizeRich(p.body_rich, Array.isArray(p.image_paths) ? p.image_paths : []);
      if (doc && doc.blocks.length) return R.renderRichHtml(doc, PV.url);
    }
    return body2html(p.body);
  }
  function renderArticle(p) {
    var art = $('#pv-article'); if (!art) return;
    document.title = p.title + ' — ' + (p.board_kind === 'news' ? '뉴스 게시판' : '자유게시판') + ' — 피클허브 커뮤니티';
    var who = p.author_kind === 'admin' ? '관리자' : '익명 ' + communityAlias(p.id, 0);
    art.innerHTML =
      '<div class="head">' + (p.is_pinned ? '<span class="badge">공지</span>' : '') + '<h2 style="display:inline">' + esc(p.title) + '</h2>' +
        '<div class="meta" style="margin-top:8px"><span>글쓴이 <b>' + who + '</b>' + skillBadge(p) + '</span><span>작성일 <b>' + esc(fmtFull(p.published_at)) + '</b></span>' +
        '<span>조회 <b id="pv-views">' + (typeof p.view_count === 'number' ? p.view_count : 0) + '</b></span>' +
        (p.edited_at ? '<span>수정 <b>' + esc(fmtFull(p.edited_at)) + '</b></span>' : '') + '</div></div>' +
      '<div class="body rich">' + richBody(p) + '</div>' +
      (p.link_url ? '<div class="link">관련 링크: <a href="' + esc(p.link_url) + '" rel="ugc nofollow noopener">' + esc(p.link_url) + '</a></div>' : '') +
      '<div class="likerow"><button class="likebtn' + (p.my_reaction === 1 ? ' on' : '') + '" data-like-post' +
        ' aria-label="글 좋아요" aria-pressed="' + (p.my_reaction === 1 ? 'true' : 'false') + '" title="좋아요">' +
        PADDLE(p.my_reaction === 1) + '<b id="pv-likes">' + (p.like_count || 0) + '</b></button></div>' +
      '<div class="foot"><a class="btn" href="' + esc(base + '/') + '">목록</a><span id="pv-postactions"></span></div>';
  }
  /* 조회수는 DOM 이 아니라 여기에 들고 최대값만 남긴다.
     이유 둘: (1) 읽기 응답과 증가 응답이 경쟁해서 늦게 온 낮은 값이 화면을 되돌릴 수 있다.
     (2) view.html 은 renderArticle() 이 메타 줄을 통째로 다시 그려 노드를 갈아끼우므로,
     DOM 에만 써두면 증가분이 읽기 값으로 덮인다 — 실제로 서버는 1인데 화면은 0 이었다
     (2026-09-16 실측). 그래서 재렌더 뒤 setViews() 가 다시 불리면 최대값이 복원된다. */
  var viewsSeen = null;
  var amAdmin = false;
  function checkAdmin() {
    if (!session) { amAdmin = false; return Promise.resolve(false); }
    return sb.rpc('is_platform_admin', {}).then(function (r) {
      amAdmin = r.data === true; return amAdmin;
    }).catch(function () { amAdmin = false; return false; });
  }

  function setViews(n) {
    if (typeof n === 'number' && (viewsSeen === null || n > viewsSeen)) viewsSeen = n;
    if (viewsSeen === null) return;
    var v = $('#pv-views'); if (v) v.textContent = viewsSeen;
  }
  /* 조회수 +1 — 탭 세션당 글 하나에 한 번. loadPost() 는 로그인 이벤트와 댓글 작성
     뒤에도 다시 도는데 거기 붙이면 한 사람이 여러 번 세진다. 실패는 조용히 넘긴다. */
  var viewBumped = false;
  function bumpView() {
    if (!postId || viewBumped) return;
    viewBumped = true;
    var key = 'pv-v-' + postId;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
    sb.rpc('hub_community_bump_post_view', { p_post_id: postId }).then(function (r) {
      if (!r.error) setViews(r.data);
    });
  }
  var postRequest = 0, commentsShown = [], commentTotal = 0, commentCursor = null;
  var moreComments = false, commentsBusy = false;
  function postPage(after) {
    return sb.rpc('get_hub_community_post', {
      p_post_id: postId, p_comment_limit: 100,
      p_comment_after_at: after ? after.at : null, p_comment_after_id: after ? after.id : null,
    });
  }
  function cursorFor(rows) {
    var last = rows[rows.length - 1];
    return last ? { at: last.created_at, id: last.id } : null;
  }
  function renderCommentPaging(error) {
    var slot = $('#pv-comment-paging'); if (!slot) return;
    slot.innerHTML = (error ? '<p role="alert">' + esc(error) + '</p>' : '') +
      (moreComments ? '<button type="button" class="btn" data-more-comments' + (commentsBusy ? ' disabled' : '') + '>' +
        (commentsBusy ? '불러오는 중…' : '댓글 더보기') + '</button>' : '');
    var button = $('[data-more-comments]', slot);
    if (button) button.addEventListener('click', loadMoreComments);
  }
  function loadMoreComments() {
    if (!moreComments || commentsBusy || !commentCursor) return Promise.resolve();
    var request = postRequest;
    commentsBusy = true; renderCommentPaging();
    return postPage(commentCursor).then(function (r) {
      if (request !== postRequest) return;
      if (r.error) throw r.error;
      var rows = (r.data && r.data.comments) || [];
      var known = new Set(commentsShown.map(function (c) { return c.id; }));
      commentsShown = commentsShown.concat(rows.filter(function (c) { return !known.has(c.id); }));
      commentTotal = r.data.post.comment_count;
      commentCursor = cursorFor(rows);
      moreComments = rows.length === 100 && commentsShown.length < commentTotal;
      renderComments(commentsShown, commentTotal);
      commentsBusy = false; renderCommentPaging();
    }).catch(function (e) {
      if (request !== postRequest) return;
      commentsBusy = false; renderCommentPaging(msg(e));
    });
  }
  function loadPost(options) {
    if (!postId) return Promise.resolve();
    options = options && typeof options === 'object' ? options : {};
    var request = ++postRequest, accumulated = [];
    var wanted = Math.max(100, commentsShown.length);
    commentsBusy = false;
    function read(after) {
      return postPage(after).then(function (r) {
        if (request !== postRequest || r.error || !r.data || !r.data.post) return r;
        var rows = r.data.comments || [];
        accumulated = accumulated.concat(rows);
        var next = cursorFor(rows);
        var missing = options.revealComment && !accumulated.some(function (c) { return c.id === options.revealComment; });
        if (rows.length === 100 && accumulated.length < r.data.post.comment_count &&
            (missing || accumulated.length < wanted) && (!after || next.id !== after.id)) return read(next);
        r.data.comments = accumulated;
        return r;
      });
    }
    return read(null)
      .then(function (r) {
        if (request !== postRequest) return;
        var data = r.data;
        if (r.error || !data || !data.post || !data.post.id) {
          if (r.error && !/Post not found/i.test(r.error.message || '')) throw r.error;
          var art = $('#pv-article'); if (art) art.innerHTML = '<div class="body"><p>글을 찾을 수 없습니다. 삭제되었을 수 있습니다.</p></div><div class="foot"><a class="btn" href="' + esc(base + '/') + '">목록</a></div>';
          commentsShown = []; moreComments = false;
          renderComments([], 0); renderCommentPaging();
          var formSlot = $('#pv-cform-slot'); if (formSlot) formSlot.hidden = true;
          return;
        }
        renderArticle(data.post);
        commentsShown = data.comments || []; commentTotal = data.post.comment_count;
        commentCursor = cursorFor(commentsShown);
        moreComments = commentsShown.length < commentTotal && commentsShown.length > 0;
        renderComments(commentsShown, commentTotal); renderCommentPaging();
        var formSlot = $('#pv-cform-slot'); if (formSlot) formSlot.hidden = false;
        setViews(data.post.view_count);
        var acts = $('#pv-postactions');
        if (acts) {
          var html = data.post.is_mine
            ? '<a class="btn" href="' + esc(PV.site + '/' + (data.post.board_kind === 'news' ? 'news' : 'free') + '/write.html?edit=' + data.post.id) + '">수정</a>' +
              '<button class="btn danger pv-del" data-del-post>삭제</button>'
            : (session ? '<button class="btn" data-report-post>신고</button>' : '');
          // 상단 고정은 운영자 전용·뉴스 전용 — 서버(hub_pin_community_post)가 다시 판정한다.
          // 판정은 페이지(PV.board)가 아니라 그 글(board_kind)로 한다 — view.html 은 어느 판 글이든 연다.
          if (amAdmin && data.post.board_kind === 'news') {
            // 글자는 그대로 두고 켜짐만 색으로 보인다 — 글자가 바뀌면 버튼이 사라진 줄 안다.
            html += '<button class="btn' + (data.post.is_pinned ? ' on' : '') + '"' +
              ' aria-pressed="' + (data.post.is_pinned ? 'true' : 'false') + '"' +
              ' title="' + (data.post.is_pinned ? '목록 맨 위에 고정돼 있습니다. 누르면 해제됩니다.' : '누르면 목록 맨 위에 고정됩니다.') + '"' +
              ' data-pin="' + (data.post.is_pinned ? '0' : '1') + '">상단 고정</button>';
          }
          acts.innerHTML = html;
        }
        var metaWho = $('#pv-article .meta b, .view .meta b');
        if (data.post.is_mine && metaWho && !metaWho.querySelector('.mine')) metaWho.appendChild(el('<span class="mine">내 글</span>'));
      }).catch(function (e) {
        if (request !== postRequest) return;
        var slot = $('#pv-comment-paging');
        if (slot) {
          slot.innerHTML = '<p role="alert">' + esc(msg(e)) + '</p><button class="btn" type="button">다시 불러오기</button>';
          $('button', slot).addEventListener('click', function () { loadPost(); });
        }
      });
  }

  /* ── 이벤트 위임 ───────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-pv],[data-del-comment],[data-del-post],[data-mute],[data-unmute],[data-report-comment],[data-report-post],[data-pin],[data-like-post],[data-react-up],[data-react-down]'); if (!t) return;
    var accountMenu = t.closest('.account-mobile'); if (accountMenu) accountMenu.open = false;
    if (t.hasAttribute('data-like-post')) {
      if (!session) { openAuth('login'); return; }
      t.disabled = true;
      sb.rpc('hub_react_community_post', { p_post_id: postId, p_on: t.getAttribute('aria-pressed') !== 'true' })
        .then(function (r) { if (r.error) throw r.error; return loadPost(); })
        .catch(function (e) { alert(msg(e)); }).finally(function () { t.disabled = false; });
    }
    else if (t.dataset.reactUp || t.dataset.reactDown) {
      if (!session) { openAuth('login'); return; }
      var up = !!t.dataset.reactUp;
      var already = t.getAttribute('aria-pressed') === 'true';
      t.disabled = true;
      sb.rpc('hub_react_community_comment', {
        p_comment_id: up ? t.dataset.reactUp : t.dataset.reactDown,
        p_value: already ? 0 : (up ? 1 : -1),
      }).then(function (r) { if (r.error) throw r.error; return loadPost(); })
        .catch(function (e) { alert(msg(e)); }).finally(function () { t.disabled = false; });
    }
    else if (t.dataset.pin) {
      t.disabled = true;
      sb.rpc('hub_pin_community_post', { p_post_id: postId, p_pinned: t.dataset.pin === '1' })
        .then(function (r) { if (r.error) { alert(msg(r.error)); t.disabled = false; } else loadPost(); });
    }
    else if (t.dataset.pv === 'login') openAuth('login');
    else if (t.dataset.pv === 'signup') openAuth('signup');
    else if (t.dataset.pv === 'logout') sb.auth.signOut({ scope: 'local' });
    else if (t.dataset.delComment) {
      if (!confirm('이 댓글을 삭제할까요?')) return;
      sb.rpc('hub_delete_community_comment', { p_comment_id: t.dataset.delComment }).then(function (r) { if (r.error) alert(msg(r.error)); else loadPost(); });
    } else if (t.dataset.mute) {
      sb.rpc('hub_mute_community_author', { p_comment_id: t.dataset.mute })
        .then(function (r) { if (r.error) throw r.error; loadPost(); })
        .catch(function (e) { alert(msg(e)); });
    } else if (t.dataset.unmute) {
      sb.rpc('hub_unmute_community_author', { p_comment_id: t.dataset.unmute })
        .then(function (r) { if (r.error) throw r.error; loadPost(); })
        .catch(function (e) { alert(msg(e)); });
    } else if (t.dataset.reportComment) {
      openReport('hub_community_comment', t.dataset.reportComment, function (already) {
        if (already) alert('이미 신고한 댓글입니다.');
        loadPost();
      });
    } else if (t.hasAttribute('data-report-post')) {
      openReport('hub_community_post', postId, afterPostReport);
    } else if (t.hasAttribute('data-del-post')) {
      if (!confirm('이 글을 삭제할까요? 댓글도 함께 사라집니다.')) return;
      sb.rpc('hub_delete_community_post', { p_post_id: postId }).then(function (r) { if (r.error) alert(msg(r.error)); else location.href = base + '/'; });
    }
  });

  /* 폰 계정 메뉴(<details>)는 스스로 닫히지 않는다 — 바깥을 누르거나 Esc 를 누르면 닫는다.
     메뉴 안을 누른 경우는 그대로 둔다(항목 동작은 위 위임 핸들러가 닫는다). 포커스가 메뉴 안에
     있었다면 여는 버튼으로 돌려놓아 키보드 사용자가 제자리를 잃지 않게 한다. */
  function closeAccountMenus(keep) {
    document.querySelectorAll('.account-mobile[open]').forEach(function (d) {
      if (keep && d.contains(keep)) return;
      var hadFocus = d.contains(document.activeElement);
      d.open = false;
      if (hadFocus) { var s = d.querySelector('summary'); if (s) s.focus(); }
    });
  }
  document.addEventListener('click', function (ev) { closeAccountMenus(ev.target); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeAccountMenus(null); });

  /* 머리글 '앱 다운로드'의 정적 링크는 App Store 다. 안드로이드 폰에서는 Play 스토어로 바꾼다 —
     폰 머리글에 이 링크가 다시 보이게 되면서(2026-09-23) 안드로이드 사용자를 iOS 스토어로 보내면 안 된다. */
  function preferPlayStore(ua) {
    if (!PV.play || !/Android/i.test(ua || '')) return;
    document.querySelectorAll('.top .cta').forEach(function (a) { a.href = PV.play; });
  }
  preferPlayStore(navigator.userAgent);

  /* ── 비밀번호 재설정 링크로 돌아온 경우 ───────────────────────────────── */
  function openNewPassword() {
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button><h3>새 비밀번호</h3>' +
      '<form class="pv-form" id="pv-newpw"><label>새 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="6" required /></label>' +
      '<p class="pv-err" hidden></p><button type="submit" class="btn primary">변경</button></form>'
    );
    var form = $('#pv-newpw', d);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); busy(form, true);
      sb.auth.updateUser({ password: form.password.value }).then(function (r) {
        busy(form, false);
        if (r.error) { setErr(d, msg(r.error)); return; }
        d.close();
      });
    });
  }

  /* ── 부트 ──────────────────────────────────────────────────────────────── */
  sb.auth.onAuthStateChange(function (event, s) {
    // 계정이 바뀌면 진행 중인 조회도 버린다 — 남기면 이전 계정의 결과가
    // 새 호출자에게 돌아가 창이 또 뜬다.
    var previousScope = App.accountScope;
    session = s || null;
    var accountChanged = previousScope !== App.accountScope;
    if (accountChanged) {
      profileOk = null; profileCheck = null; me = null;
      if (profileDialog) profileDialog.close();
      postRequest += 1; commentsShown = [];
    }
    renderAccount();
    authListeners.forEach(function (cb) { try { cb(event); } catch (e) {} });
    if (event === 'PASSWORD_RECOVERY') openNewPassword();
    if (event === 'SIGNED_IN') { checkProfile().then(function (ok) { if (!ok && session) openProfile(); }).catch(function () {}); }
    if (postId && accountChanged) { renderCommentForm(); checkAdmin().then(loadPost); }
  });
  sb.auth.getSession().then(function (r) {
    session = (r.data && r.data.session) || null;
    renderAccount();
    if (session) checkProfile();
    readyResolve();
    retimeDates();
    refreshList();
    initSearch();
    if (postId) { renderCommentForm(); checkAdmin().then(loadPost); bumpView(); }
  });
})();
