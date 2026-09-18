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
 * 설정: window.PV = { url, key, site, board, post, view, page, staticIds, total, terms, privacy, legal, store, oauth }
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
    ready: new Promise(function (res) { readyResolve = res; }),
    onAuth: function (cb) { authListeners.push(cb); },
    openAuth: function (m) { openAuth(m); },
    openProfile: function (cb) { openProfile(cb); },
    checkProfile: function () { return checkProfile(); },
    /* 저장 뒤 캐시를 버리고 다시 읽는다 — 머리글의 이름이 옛 값으로 남지 않게. */
    refreshProfile: function () { profileOk = null; return checkProfile(); },
    get me() { return me; },
    requireMember: function (cb) { requireMember(cb); },
    msg: function (e) { return msg(e); },
    /** 내 실력대 구간(없으면 null) — 편집기가 체크박스를 드러낼지 판단한다. */
    skillBand: function () { return mySkillBand(); },
  };
  window.PVApp = App;

  /* ── 유틸 ─────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtFull(iso) { return String(iso || '').slice(0, 16).replace('T', ' ').replace(/-/g, '.'); }
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
    ['rate limit', '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
    ['Rate limited', '잠시 후 다시 시도해 주세요. (시간당 작성 한도)'],
    ['Blocked term', '사용할 수 없는 표현이 포함되어 있습니다.'],
    ['Community write suspended', '커뮤니티 작성이 정지된 계정입니다.'],
    ['Not authenticated', '로그인이 필요합니다.'],
    ['Not authorized', '뉴스 게시판은 운영자만 쓸 수 있습니다. 자유게시판에 글을 남겨 주세요.'],
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
    return d;
  }
  function setErr(d, text) { var e = $('.pv-err', d); if (e) { e.textContent = text || ''; e.hidden = !text; } }
  function busy(form, on) { form.querySelectorAll('button,input,textarea').forEach(function (n) { n.disabled = !!on; }); }

  /* ── 세션 / 계정 슬롯 ──────────────────────────────────────────────────── */
  var session = null;
  var me = null; // 본인 행(users) — 본인 화면에만 쓴다. 다른 사람의 행을 읽는 경로는 없다.
  function renderAccount() {
    var slot = $('#pv-account'); if (!slot) return;
    if (session) {
      var name = (me && me.real_name) || (session.user && session.user.email) || '회원';
      slot.innerHTML = '<span class="me" title="다른 이용자에게는 익명으로 보입니다">' + esc(name) + '</span>' +
        '<a class="lnk" href="' + esc(PV.site + '/me.html') + '">내 정보</a>' +
        '<button class="lnk" data-pv="logout">로그아웃</button>';
    } else {
      slot.innerHTML = '<button class="lnk" data-pv="login">로그인</button><button class="lnk" data-pv="signup">회원가입</button>';
    }
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
  function checkProfile() {
    if (!session) return Promise.resolve(false);
    if (profileOk !== null) return Promise.resolve(profileOk);
    return sb.from('users').select('nationality_type,platform_terms_accepted_at,privacy_policy_accepted_at,real_name')
      .eq('id', session.user.id).maybeSingle()
      .then(function (r) {
        var u = r.data;
        me = u || null;
        renderAccount();
        profileOk = !!(u && u.real_name && u.nationality_type && u.platform_terms_accepted_at && u.privacy_policy_accepted_at);
        return profileOk;
      });
  }
  function openProfile(onDone) {
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button>' +
      '<h3>회원 정보 확인</h3><p class="pv-note">커뮤니티 글은 익명으로 올라가지만, 계정에는 앱과 같은 기본 정보가 필요합니다. 이름은 다른 이용자에게 표시되지 않습니다.</p>' +
      '<form class="pv-form" id="pv-profile">' +
        '<fieldset class="pv-radio"><legend>내국인 / 외국인</legend>' +
          '<label><input type="radio" name="nat" value="domestic" checked /> 내국인</label>' +
          '<label><input type="radio" name="nat" value="foreign" /> 외국인</label></fieldset>' +
        '<label>이름<input name="name" type="text" autocomplete="name" maxlength="40" placeholder="한글 본명" required /></label>' +
        '<label class="pv-check"><input type="checkbox" name="terms" required /> <a href="' + esc(PV.legal) + '/terms.html" target="_blank" rel="noopener">이용약관</a>에 동의합니다</label>' +
        '<label class="pv-check"><input type="checkbox" name="privacy" required /> <a href="' + esc(PV.legal) + '/privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a>에 동의합니다</label>' +
        '<p class="pv-err" hidden></p>' +
        '<button type="submit" class="btn primary">완료</button>' +
      '</form>'
    );
    var form = $('#pv-profile', d);
    form.addEventListener('change', function () {
      var nat = form.nat.value;
      form.name.placeholder = nat === 'domestic' ? '한글 본명' : 'Name in English';
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); setErr(d, ''); busy(form, true);
      var nat = form.nat.value;
      sb.rpc('complete_global_profile', {
        p_nationality_type: nat,
        p_real_name: form.name.value.trim(),
        p_gender: null,
        p_birth_year: null,
        p_phone: '',
        p_country: nat === 'domestic' ? 'KR' : 'visitor',
        p_region: null, p_city: null, p_district: null, p_affiliation_note: null,
        p_platform_terms_version: PV.terms,
        p_platform_terms_accepted: true,
        p_privacy_policy_version: PV.privacy,
        p_privacy_policy_accepted: true,
        p_hub_visibility_opt_in: false,
      }).then(function (r) {
        busy(form, false);
        if (r.error) { setErr(d, msg(r.error)); return; }
        profileOk = true; me = { real_name: form.name.value.trim() }; renderAccount(); d.close(); if (onDone) onDone();
      });
    });
  }
  /** 로그인 + 프로필 완성이 끝난 뒤에만 cb 를 부른다. */
  function requireMember(cb) {
    if (!session) { openAuth('login'); return; }
    checkProfile().then(function (ok) { if (ok) cb(); else openProfile(cb); });
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
  function refreshList() {
    var tbody = $('#pv-list'); if (!tbody || PV.page !== 1) return;
    var staticIds = {}; (PV.staticIds || []).forEach(function (id) { staticIds[id] = true; });
    sb.rpc('get_hub_community_posts', { p_board_kind: PV.board, p_limit: 50, p_cursor_pinned: null, p_cursor_at: null, p_cursor_id: null })
      .then(function (r) {
        if (r.error || !r.data) return;
        var posts = r.data.posts || [];
        posts.forEach(function (p) {
          var row = tbody.querySelector('tr[data-id="' + p.id + '"]');
          if (row) {
            if (p.is_mine && !row.querySelector('.mine')) { row.classList.add('is-mine'); row.querySelector('.tit').appendChild(el('<span class="mine">내 글</span>')); }
            var cmt = row.querySelector('.cmt');
            if (p.comment_count > 0) { if (!cmt) { cmt = el('<span class="cmt"></span>'); row.querySelector('.tit').appendChild(cmt); } cmt.textContent = '[' + p.comment_count + ']'; }
            else if (cmt) cmt.remove();
            var vw = row.querySelector('.views');
            if (vw && typeof p.view_count === 'number') vw.textContent = p.view_count;
          }
        });
        /* 정적 페이지는 최대 2시간 묵는다 — 그 사이 지워진 글이 남아 있으면 눌러도 없는 글이고,
           새 글은 아예 안 보인다. 1페이지는 최신 30건이고 여기서 50건을 받아오므로,
           받아온 목록에 없는 행은 (밀려난 게 아니라) 지워진 행이다. */
        var live = {}; posts.forEach(function (p) { live[p.id] = true; });
        tbody.querySelectorAll('tr[data-id]').forEach(function (row) {
          if (!live[row.dataset.id]) row.remove();
        });
        var fresh = posts.filter(function (p) { return !staticIds[p.id] && !p.is_pinned; });
        if (fresh.length === 0) return;
        var empty = tbody.querySelector('tr.empty'); if (empty) empty.remove();
        var total = (PV.total || 0) + fresh.length;
        // 한 줄씩 firstChild 앞에 끼우면 순서가 뒤집혀 번호가 5,6,4 처럼 나온다 —
        // 조각(fragment)에 순서대로 담아 한 번에 넣는다. 공지 행이 있으면 그 아래에.
        var frag = document.createDocumentFragment();
        fresh.forEach(function (p, i) {
          var cmt = p.comment_count > 0 ? ' <span class="cmt">[' + p.comment_count + ']</span>' : '';
          var mine = p.is_mine ? '<span class="mine">내 글</span>' : '';
          frag.appendChild(el(
            '<tr data-id="' + esc(p.id) + '" class="fresh' + (p.is_mine ? ' is-mine' : '') + '">' +
              '<td class="num">' + (total - i) + '</td>' +
              '<td class="tit"><a href="' + esc(viewUrl + '?id=' + p.id) + '">' + esc(p.title) + '</a>' + cmt + mine + '</td>' +
              '<td class="who">' + (p.author_kind === 'admin' ? '관리자' : '익명 ' + communityAlias(p.id, 0)) + skillBadge(p) + '</td><td class="date" data-at="' + esc(p.published_at) + '">' + esc(fmtList(p.published_at)) + '</td>' +
              '<td class="views">' + (typeof p.view_count === 'number' ? p.view_count : 0) + '</td>' +
              '<td class="likes">' + (typeof p.like_count === 'number' ? p.like_count : 0) + '</td>' +
            '</tr>'));
        });
        var anchor = tbody.querySelector('tr:not(.notice)');
        tbody.insertBefore(frag, anchor || null);
        retimeDates(tbody);
        var tot = $('#pv-total');
        if (tot) {
          tot.textContent = total;
          // 빌드 시점에 글이 0건이면 카운트가 hidden 으로 나간다 — 글이 생겼으니 되살린다.
          var wrap = tot.closest('span[hidden]'); if (wrap) wrap.removeAttribute('hidden');
        }
      });
  }

  /* ── 글 페이지: 댓글 최신화 + 댓글 쓰기 + 본인 글/댓글 삭제 ─────────────── */
  var postId = PV.post || null;
  if (PV.view) { try { postId = new URLSearchParams(location.search).get('id'); } catch (e) { postId = null; } }

  function renderComments(comments) {
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
              ' aria-pressed="' + (c.my_reaction === 1 ? 'true' : 'false') + '" title="좋아요">' +
              THUMB_UP + '<b>' + (c.like_count || 0) + '</b></button>' +
            '<button class="rbtn down' + (c.my_reaction === -1 ? ' on' : '') + '" data-react-down="' + esc(c.id) + '"' +
              ' aria-pressed="' + (c.my_reaction === -1 ? 'true' : 'false') + '" title="싫어요">' +
              THUMB_DOWN + '<b>' + (c.dislike_count || 0) + '</b></button>' +
          '</span>';
        return '<li' + (c.is_mine ? ' class="is-mine"' : '') + '><span class="who ' + a.cls + '">' + esc(a.label) + badge + mine + '</span>' + txt + react +
          '<span class="when">' + esc(fmtFull(c.created_at)) + (acts.length ? '<span class="acts">' + acts.join('') + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    var h = $('#pv-ccount'); if (h) h.textContent = comments.length;
  }
  function renderCommentForm() {
    var lock = $('#pv-cform-slot'); if (!lock) return;
    lock.className = 'cform-slot';
    lock.innerHTML =
      '<form class="pv-form pv-cform" id="pv-cform">' +
        '<textarea name="body" rows="3" maxlength="1000" placeholder="' + (session ? '댓글을 입력하세요 (익명)' : '로그인하면 댓글을 쓸 수 있습니다') + '" required></textarea>' +
        '<div class="pv-row"><p class="pv-err" hidden></p><button type="submit" class="btn primary">' + (session ? '등록' : '로그인하고 댓글 쓰기') + '</button></div>' +
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
          loadPost();
        });
      });
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
      (p.link_url ? '<div class="link">관련 링크: <a href="' + esc(p.link_url) + '" rel="noopener">' + esc(p.link_url) + '</a></div>' : '') +
      '<div class="likes"><button class="likebtn' + (p.my_reaction === 1 ? ' on' : '') + '" data-like-post' +
        ' aria-pressed="' + (p.my_reaction === 1 ? 'true' : 'false') + '" title="좋아요">' +
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
  function loadPost() {
    if (!postId) return;
    sb.rpc('get_hub_community_post', { p_post_id: postId, p_comment_limit: 100, p_comment_after_at: null, p_comment_after_id: null })
      .then(function (r) {
        var data = r.data;
        if (r.error || !data || !data.post || !data.post.id) {
          if (PV.view) { var art = $('#pv-article'); if (art) art.innerHTML = '<div class="body"><p>글을 찾을 수 없습니다. 삭제되었을 수 있습니다.</p></div><div class="foot"><a class="btn" href="' + esc(base + '/') + '">목록</a></div>'; }
          return;
        }
        if (PV.view) renderArticle(data.post);
        renderComments(data.comments || []);
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
      });
  }

  /* ── 이벤트 위임 ───────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-pv],[data-del-comment],[data-del-post],[data-mute],[data-unmute],[data-report-comment],[data-report-post],[data-pin],[data-like-post],[data-react-up],[data-react-down]'); if (!t) return;
    if (t.hasAttribute('data-like-post')) {
      if (!session) { openAuth('login'); return; }
      t.disabled = true;
      sb.rpc('hub_react_community_post', { p_post_id: postId, p_on: t.getAttribute('aria-pressed') !== 'true' })
        .then(function (r) { if (r.error) alert(msg(r.error)); loadPost(); });
    }
    else if (t.dataset.reactUp || t.dataset.reactDown) {
      if (!session) { openAuth('login'); return; }
      var up = !!t.dataset.reactUp;
      var already = t.getAttribute('aria-pressed') === 'true';
      t.disabled = true;
      sb.rpc('hub_react_community_comment', {
        p_comment_id: up ? t.dataset.reactUp : t.dataset.reactDown,
        p_value: already ? 0 : (up ? 1 : -1),
      }).then(function (r) { if (r.error) alert(msg(r.error)); loadPost(); });
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
    session = s || null; profileOk = null; if (!session) me = null;
    renderAccount();
    authListeners.forEach(function (cb) { try { cb(event); } catch (e) {} });
    if (event === 'PASSWORD_RECOVERY') openNewPassword();
    if (event === 'SIGNED_IN') { checkProfile().then(function (ok) { if (!ok) openProfile(); }); }
    if (postId) { renderCommentForm(); checkAdmin().then(loadPost); }
  });
  sb.auth.getSession().then(function (r) {
    session = (r.data && r.data.session) || null;
    renderAccount();
    if (session) checkProfile();
    readyResolve();
    retimeDates();
    refreshList();
    if (postId) { renderCommentForm(); checkAdmin().then(loadPost); bumpView(); }
  });
})();
