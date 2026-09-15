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
 * 설정: window.PV = { url, key, site, board, post, view, page, staticIds, total, terms, privacy, legal, store }
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
    requireMember: function (cb) { requireMember(cb); },
    msg: function (e) { return msg(e); },
  };
  window.PVApp = App;

  /* ── 유틸 ─────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtFull(iso) { return String(iso || '').slice(0, 16).replace('T', ' ').replace(/-/g, '.'); }
  function fmtList(iso) {
    var d = String(iso || '').slice(0, 10);
    if (d.length !== 10) return '';
    var y = new Date().getUTCFullYear();
    return Number(d.slice(0, 4)) === y ? d.slice(5).replace('-', '.') : d.replace(/-/g, '.');
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
  var opLabel = PV.board === 'news' ? '운영자' : '글쓴이';

  function authorLabel(c) {
    if (c.author_kind === 'withdrawn' || c.author_seq == null) return { label: '탈퇴한 회원', cls: 'gone' };
    if (c.author_seq === 0) {
      return PV.board === 'news' ? { label: opLabel, cls: 'op' } : { label: '익명 ' + communityAlias(postId, 0), badge: opLabel, cls: 'op' };
    }
    return { label: '익명 ' + communityAlias(postId, c.author_seq), cls: '' };
  }

  /* 서버 예외 문자열 → 사용자 문장. 서버는 영어 식별 문자열을 던진다(i18n 은 클라 책임). */
  var ERR = [
    ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않습니다.'],
    ['Email not confirmed', '가입 확인 메일의 링크를 먼저 눌러 주세요.'],
    ['User already registered', '이미 가입된 이메일입니다. 로그인해 주세요.'],
    ['Password should be at least', '비밀번호는 6자 이상이어야 합니다.'],
    ['Unable to validate email', '이메일 형식이 올바르지 않습니다.'],
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
    ['Foreign users must use Latin name', '외국인은 영문 이름만 입력할 수 있습니다.'],
    ['Platform terms must be accepted', '이용약관에 동의해 주세요.'],
    ['Privacy policy must be accepted', '개인정보 처리방침에 동의해 주세요.'],
  ];
  function msg(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || '');
    for (var i = 0; i < ERR.length; i++) if (m.toLowerCase().indexOf(ERR[i][0].toLowerCase()) >= 0) return ERR[i][1];
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

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
        '<button class="lnk" data-pv="logout">로그아웃</button>';
    } else {
      slot.innerHTML = '<button class="lnk" data-pv="login">로그인</button><button class="lnk" data-pv="signup">회원가입</button>';
    }
  }

  function openAuth(mode) {
    var d = dialog(
      '<button class="x" data-x aria-label="닫기">×</button>' +
      '<div class="pv-tabs"><button type="button" data-tab="login">로그인</button><button type="button" data-tab="signup">회원가입</button></div>' +
      '<div class="pv-social">' +
        '<button type="button" data-oauth="google">구글로 계속하기</button>' +
        '<button type="button" data-oauth="kakao">카카오로 계속하기</button>' +
      '</div><div class="pv-or">또는 이메일로</div>' +
      '<form class="pv-form" id="pv-auth">' +
        '<label>이메일<input name="email" type="email" autocomplete="email" required /></label>' +
        '<label>비밀번호<input name="password" type="password" autocomplete="current-password" minlength="6" required /></label>' +
        '<p class="pv-err" hidden></p>' +
        '<button type="submit" class="btn primary"></button>' +
        '<button type="button" class="lnk" data-forgot>비밀번호를 잊으셨나요?</button>' +
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
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); setErr(d, ''); busy(form, true);
      var email = form.email.value.trim(), password = form.password.value;
      var p = cur === 'login'
        ? sb.auth.signInWithPassword({ email: email, password: password })
        : sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: location.href.split('#')[0] } });
      p.then(function (r) {
        busy(form, false);
        if (r.error) { setErr(d, msg(r.error)); return; }
        if (cur === 'signup' && !(r.data && r.data.session)) {
          form.innerHTML = '<p class="pv-note">확인 메일을 보냈습니다. <b>' + esc(email) + '</b> 의 메일함에서 링크를 누른 뒤 로그인해 주세요.</p>';
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
            var cnt = row.querySelector('.cnt'); if (cnt) cnt.textContent = p.comment_count;
            var cmt = row.querySelector('.cmt');
            if (p.comment_count > 0) { if (!cmt) { cmt = el('<span class="cmt"></span>'); row.querySelector('.tit').appendChild(cmt); } cmt.textContent = '[' + p.comment_count + ']'; }
            else if (cmt) cmt.remove();
          }
        });
        // 뉴스는 운영자가 "웹 공개"를 켠 글만 나가므로 신규 행을 얹지 않는다(anon RPC 는 미공개 뉴스도 준다).
        if (PV.board !== 'free') return;
        var fresh = posts.filter(function (p) { return !staticIds[p.id] && !p.is_pinned; });
        if (fresh.length === 0) return;
        var empty = tbody.querySelector('tr.empty'); if (empty) empty.remove();
        var total = (PV.total || 0) + fresh.length;
        fresh.forEach(function (p, i) {
          var cmt = p.comment_count > 0 ? ' <span class="cmt">[' + p.comment_count + ']</span>' : '';
          var mine = p.is_mine ? '<span class="mine">내 글</span>' : '';
          tbody.insertBefore(el(
            '<tr data-id="' + esc(p.id) + '" class="fresh' + (p.is_mine ? ' is-mine' : '') + '">' +
              '<td class="num">' + (total - i) + '</td>' +
              '<td class="tit"><a href="' + esc(PV.site + '/free/view.html?id=' + p.id) + '">' + esc(p.title) + '</a>' + cmt + mine + '</td>' +
              '<td class="who">익명 ' + communityAlias(p.id, 0) + '</td><td class="date">' + esc(fmtList(p.published_at)) + '</td><td class="cnt">' + p.comment_count + '</td>' +
            '</tr>'), tbody.firstChild);
        });
        var tot = $('#pv-total'); if (tot) tot.textContent = total;
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
        var del = c.is_mine ? '<button class="lnk pv-del" data-del-comment="' + esc(c.id) + '">삭제</button>' : '';
        var mine = c.is_mine ? '<span class="mine">나</span>' : '';
        var badge = a.badge ? '<span class="opb">' + esc(a.badge) + '</span>' : '';
        return '<li' + (c.is_mine ? ' class="is-mine"' : '') + '><span class="who ' + a.cls + '">' + esc(a.label) + badge + mine + '</span>' + txt + '<span class="when">' + esc(fmtFull(c.created_at)) + del + '</span></li>';
      }).join('') + '</ul>';
    }
    var h = $('#pv-ccount'); if (h) h.textContent = comments.length;
    var m = $('#pv-mcount'); if (m) m.textContent = comments.length;
  }
  function renderCommentForm() {
    var lock = $('#pv-cform-slot'); if (!lock) return;
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
    document.title = p.title + ' — ' + (PV.board === 'news' ? '뉴스 게시판' : '자유게시판') + ' — 피클허브 커뮤니티';
    var who = PV.board === 'news' ? '피클허브' : '익명 ' + communityAlias(p.id, 0);
    art.innerHTML =
      '<div class="head">' + (p.is_pinned ? '<span class="badge">공지</span>' : '') + '<h2 style="display:inline">' + esc(p.title) + '</h2>' +
        '<div class="meta" style="margin-top:8px"><span>글쓴이 <b>' + who + '</b></span><span>작성일 <b>' + esc(fmtFull(p.published_at)) + '</b></span>' +
        (p.edited_at ? '<span>수정 <b>' + esc(fmtFull(p.edited_at)) + '</b></span>' : '') + '<span>댓글 <b id="pv-mcount">' + (p.comment_count || 0) + '</b></span></div></div>' +
      '<div class="body rich">' + richBody(p) + '</div>' +
      (p.link_url ? '<div class="link">관련 링크: <a href="' + esc(p.link_url) + '" rel="noopener">' + esc(p.link_url) + '</a></div>' : '') +
      '<div class="foot"><a class="btn" href="' + esc(base + '/') + '">목록</a><span id="pv-postactions"></span></div>';
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
        var acts = $('#pv-postactions');
        if (acts) acts.innerHTML = data.post.is_mine ? '<button class="btn pv-del" data-del-post>삭제</button>' : '<a class="btn primary" href="' + esc(PV.store) + '">앱에서 열기</a>';
        var metaWho = $('#pv-article .meta b, .view .meta b');
        if (data.post.is_mine && metaWho && !metaWho.querySelector('.mine')) metaWho.appendChild(el('<span class="mine">내 글</span>'));
      });
  }

  /* ── 이벤트 위임 ───────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-pv],[data-del-comment],[data-del-post]'); if (!t) return;
    if (t.dataset.pv === 'login') openAuth('login');
    else if (t.dataset.pv === 'signup') openAuth('signup');
    else if (t.dataset.pv === 'logout') sb.auth.signOut({ scope: 'local' });
    else if (t.dataset.delComment) {
      if (!confirm('이 댓글을 삭제할까요?')) return;
      sb.rpc('hub_delete_community_comment', { p_comment_id: t.dataset.delComment }).then(function (r) { if (r.error) alert(msg(r.error)); else loadPost(); });
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
    if (postId) { renderCommentForm(); loadPost(); }
  });
  sb.auth.getSession().then(function (r) {
    session = (r.data && r.data.session) || null;
    renderAccount();
    if (session) checkProfile();
    readyResolve();
    refreshList();
    if (postId) { renderCommentForm(); loadPost(); }
  });
})();