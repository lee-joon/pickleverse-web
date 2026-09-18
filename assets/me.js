/*
 * 내 정보 (me.html) — 계정·회원 정보 확인과 수정.
 *
 * 허브 앱의 설정 > 회원정보 수정(HubEditProfileScreen)과 같은 항목·같은 RPC 를 쓴다 —
 * 국적·이름·성별·출생연도·연락처는 `complete_global_profile`.
 *
 * 닉네임은 **의도적으로 없다**. 허브 앱에는 닉네임 입력·표시가 아예 없고(덮어쓰기를
 * 막으려고 값을 읽어 되돌려 보내기만 한다) 표시 이름은 실명이다 — 닉네임은 클럽 앱
 * 개념이다(프로드 프로필 44행 중 닉네임 보유 2건, 2026-09-16). 웹에서 만들지 않으면
 * `update_my_profile` 을 아예 부르지 않게 되어 아바타·DUPR 덮어쓰기 위험도 함께 사라진다.
 *
 * ⚠ 두 RPC 모두 **보낸 값으로 통째로 덮어쓴다**(null 을 보내면 지워진다).
 *   - complete_global_profile 은 거주지(region/city/district)·소속까지 무조건 UPDATE 하므로,
 *     웹 폼이 수집하지 않는 값(앱에서 채워진 값)은 읽어둔 현재 값을 그대로 되돌려 보낸다.
 *   그래서 이 화면은 "읽기 → 폼 → 읽은 값과 합쳐 전송" 순서를 반드시 지킨다.
 *
 * 익명성: 여기서 다루는 값은 전부 본인 행이다. 커뮤니티 표시명과는 무관하고,
 * 이 화면이 다른 사람의 프로필을 읽는 경로는 없다.
 */
(function () {
  'use strict';
  var PV = window.PV || {};
  if (!PV.me && !PV.duprConnect) return;

  /* 팝업(dupr-connect.html)에서 도는 경로 — 우리 오리진이라 같은 세션을 그대로 쓴다.
     DUPR 페이지를 이 창의 iframe 으로 띄우므로 그 페이지가 parent 로 쏘든 opener 로 쏘든
     둘 다 우리 코드가 받는다(팝업에 DUPR 을 직접 띄우면 parent 가 자기 자신이라 못 받는다). */
/* DUPR SSO 가 부모 창으로 결과를 쏘는 출처. 규정상 임베드 iframe 이 유일한 경로라
     (docs/dupr-api.md §1) 우리 페이지가 남의 message 를 받아 처리할 수 있는 상태가 된다 —
     서버가 토큰 소유를 재검증하긴 하지만, 출처를 먼저 막는 게 순서다. dupr.gg 는
     mydupr.com 으로 302 되므로 최종 출처까지 함께 허용한다(실측). */
  /* 실력대 라벨 — 서버 hub_community_skill_band 의 4구간과 같다(app.js SKILL_BANDS 와 동일 문구). */
  var BAND_LABELS = { lt25: '2.5 미만', '25_30': '2.5~3.0', '30_35': '3.0~3.5', gte35: '3.5 이상' };
  var DUPR_ORIGINS = [
    'https://dupr.gg', 'https://www.dupr.gg', 'https://mydupr.com', 'https://www.mydupr.com',
    'https://dashboard.dupr.com', 'https://uat.dupr.gg', 'https://uat.mydupr.com',
  ];


  function bootConnect() {
    var App = window.PVApp;
    if (!App) return;
    App.ready.then(function () {
      var slot = document.getElementById('dc-body');
      if (!slot) return;
      if (!App.session) { slot.innerHTML = '<p class="dc-msg">로그인이 필요합니다. 이 창을 닫고 다시 시도해 주세요.</p>'; return; }
      if (!PV.dupr || !PV.dupr.clientKey) { slot.innerHTML = '<p class="dc-msg">DUPR 연동 설정이 준비되지 않았습니다.</p>'; return; }
      var url = PV.dupr.ssoBase + '/login-external-app/' + btoa(PV.dupr.clientKey);
      slot.innerHTML = '<iframe title="DUPR 로그인" src="' + escAttr(url) + '"></iframe><p class="dc-msg" id="dc-msg" hidden></p>';
      var handled = false;
      function say(t) { var n = document.getElementById('dc-msg'); if (n) { n.textContent = t || ''; n.hidden = !t; } }
      window.addEventListener('message', function (ev) {
        if (handled) return;
        if (DUPR_ORIGINS.indexOf(ev.origin) < 0) return;
        var msg = ev.data;
        if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
        if (!msg || !msg.userToken || !msg.refreshToken || !msg.duprId) return;
        handled = true;
        say('연결하는 중…');
        App.sb.auth.getSession().then(function (r) {
          var token = r && r.data && r.data.session && r.data.session.access_token;
          return App.sb.functions.invoke('dupr-link', {
            body: { action: 'link', userToken: msg.userToken, refreshToken: msg.refreshToken,
                    duprId: msg.duprId, duprNumericId: msg.id },
            headers: token ? { Authorization: 'Bearer ' + token } : undefined,
          });
        }).then(function (res) {
          if (!res.error && res.data && res.data.linked) {
            try { if (window.opener) window.opener.postMessage({ pvDupr: 'linked' }, PV.site); } catch (e) {}
            say('연결됐습니다. 창을 닫습니다.');
            setTimeout(function () { window.close(); }, 700);
            return;
          }
          handled = false;
          say('연결하지 못했습니다. 다시 시도해 주세요.');
        });
      });
    });
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function boot() {
    var App = window.PVApp;
    if (!App) return;
    App.ready.then(start);
    App.onAuth(function () { start(); });

    var sb = App.sb;
    var gate = document.getElementById('me-gate');
    var bodyEl = document.getElementById('me-body');
    var loaded = false;
    var gateLogin = document.getElementById('me-gate-login');
    if (gateLogin) gateLogin.addEventListener('click', function () { App.openAuth('login'); });

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtDay(iso) {
      var t = Date.parse(String(iso || ''));
      if (isNaN(t)) return '—';
      var d = new Date(t), p2 = function (n) { return ('0' + n).slice(-2); };
      return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate());
    }

    /* 이 화면에서만 나오는 서버 문구. */
    var ME_ERR = [
      ['already exists', '그 수단은 이미 다른 계정에 붙어 있습니다. 그 수단으로 로그인하면 그 계정으로 들어갑니다.'],
      ['manual linking', '로그인 수단 연결이 꺼져 있습니다. 운영자에게 알려 주세요.'],
      ['dupr_account_already_linked', '그 DUPR 계정은 이미 다른 회원에 연결돼 있습니다.'],
      ['dupr_token_verification_failed', 'DUPR 인증을 확인하지 못했습니다. 다시 로그인해 주세요.'],
      ['dupr_not_configured', 'DUPR 연동 설정이 아직 준비되지 않았습니다. 운영자에게 알려 주세요.'],
    ];
    function emsg(e) {
      var raw = (e && (e.message || e.error_description || e.msg)) || String(e || '');
      for (var i = 0; i < ME_ERR.length; i++) {
        if (raw.toLowerCase().indexOf(ME_ERR[i][0].toLowerCase()) >= 0) return ME_ERR[i][1];
      }
      return App.msg(e);
    }

    var PROVIDERS = { email: '이메일', google: '구글', kakao: '카카오톡', apple: 'Apple' };
    function providerList() {
      var u = (App.session && App.session.user) || {};
      var list = (u.app_metadata && u.app_metadata.providers) || [];
      if (!list.length && u.app_metadata && u.app_metadata.provider) list = [u.app_metadata.provider];
      return list;
    }

    /* 팝업이 끝났다고 알려 오면 카드를 다시 읽는다. 출처는 우리 사이트로 고정한다. */
    window.addEventListener('message', function (ev) {
      if (ev.origin !== PV.site) return;
      if (!ev.data || ev.data.pvDupr !== 'linked') return;
      loaded = true; load();
    });

    function start() {
      if (!App.session) {
        loaded = false;
        bodyEl.hidden = true;
        gate.hidden = false;
        return;
      }
      gate.hidden = true;
      bodyEl.hidden = false;
      if (loaded) return;
      loaded = true;
      load();
    }

    /* 현재 값 — 폼이 수집하지 않는 필드까지 전부 들고 있어야 저장이 지우지 않는다. */
    var row = null, prof = null, dupr = { linked: false }, bandPref = false, myBand = null;


    function load() {
      var uid = App.session.user.id;
      bodyEl.innerHTML = '<p class="me-loading">불러오는 중…</p>';
      Promise.all([
        sb.from('users').select(
          'email,auth_provider,real_name,nationality_type,gender,birth_year,phone,country,region,city,district,' +
          'affiliation_note,platform_terms_version,platform_terms_accepted_at,privacy_policy_version,' +
          'privacy_policy_accepted_at,hub_visibility_opt_in,created_at',
        ).eq('id', uid).maybeSingle(),
        sb.from('user_profiles').select('dupr_rating').eq('user_id', uid).maybeSingle(),
        sb.rpc('dupr_my_link_status'),
        App.communityPrefs(),
        App.skillBand(),
      ]).then(function (res) {
        if (res[0].error) { bodyEl.innerHTML = '<p class="me-loading">회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>'; return; }
        row = res[0].data || {};
        prof = (res[1] && res[1].data) || {};
        dupr = (res[2] && !res[2].error && res[2].data) || { linked: false };
        bandPref = res[3] === true;
        myBand = res[4] || null;
        render();
      });
    }

    function years() {
      var max = new Date().getFullYear() - 14, out = [];
      for (var y = max; y >= 1930; y--) out.push(y);
      return out;
    }

    function render() {
      var email = row.email || (App.session.user && App.session.user.email) || '';
      var provs = providerList();
      var hasEmailLogin = provs.indexOf('email') >= 0;
      var nat = row.nationality_type || 'domestic';

      bodyEl.innerHTML =
        '<section class="me-card">' +
          '<h2>계정</h2>' +
          '<dl class="me-facts">' +
            '<div><dt>이메일</dt><dd>' + esc(email || '—') + '</dd></div>' +
            // 로그인 수단은 보여만 준다 — 수단을 붙이는 경로는 두지 않는다(오너 지시 2026-09-18).
            '<div><dt>로그인 수단</dt><dd>' + esc(provs.map(function (p) { return PROVIDERS[p] || p; }).join(', ') || '—') +
            '</dd></div>' +
            '<div><dt>가입일</dt><dd>' + esc(fmtDay(row.created_at)) + '</dd></div>' +
          '</dl>' +
          (hasEmailLogin ? '<button type="button" class="btn" id="me-pw">비밀번호 변경</button>' : '') +
        '</section>' +

        '<section class="me-card">' +
          '<h2>회원 정보</h2>' +
          '<p class="pv-note">앱과 같은 계정 정보입니다. 여기서 바꾸면 앱에도 바로 반영됩니다. ' +
            '이름과 연락처는 다른 이용자에게 보이지 않고, 커뮤니티 글은 그대로 익명으로 올라갑니다.</p>' +
          '<form class="pv-form" id="me-profile">' +
            '<fieldset class="pv-radio"><legend>내국인 / 외국인</legend>' +
              '<label><input type="radio" name="nat" value="domestic"' + (nat === 'domestic' ? ' checked' : '') + ' /> 내국인</label>' +
              '<label><input type="radio" name="nat" value="foreign"' + (nat === 'foreign' ? ' checked' : '') + ' /> 외국인</label>' +
            '</fieldset>' +
            '<label>이름<input name="name" type="text" autocomplete="name" maxlength="40" required value="' + esc(row.real_name || '') + '" /></label>' +
            '<label>성별 (선택)<select name="gender">' +
              '<option value=""' + (row.gender ? '' : ' selected') + '>선택 안 함</option>' +
              '<option value="male"' + (row.gender === 'male' ? ' selected' : '') + '>남성</option>' +
              '<option value="female"' + (row.gender === 'female' ? ' selected' : '') + '>여성</option>' +
            '</select></label>' +
            '<label>출생연도 (선택)<select name="birth">' +
              '<option value=""' + (row.birth_year ? '' : ' selected') + '>선택 안 함</option>' +
              years().map(function (y) {
                return '<option value="' + y + '"' + (Number(row.birth_year) === y ? ' selected' : '') + '>' + y + '</option>';
              }).join('') +
            '</select></label>' +
            '<label>연락처 (선택)<input name="phone" type="tel" inputmode="numeric" maxlength="15" placeholder="숫자만" value="' + esc(row.phone || '') + '" /></label>' +
            '<p class="pv-err" hidden></p>' +
            '<div class="me-actions"><button type="submit" class="btn primary">저장</button><span class="me-ok" hidden>저장했습니다.</span></div>' +
          '</form>' +
        '</section>' +

        '<section class="me-card">' +
          '<h2>DUPR</h2>' +
          '<dl class="me-facts">' +
            '<div><dt>레이팅</dt><dd>' + esc(prof.dupr_rating == null ? '미설정' : String(prof.dupr_rating)) +
              (dupr.linked
                ? '<small>DUPR ' + esc(dupr.duprId || '') + ' 연결됨. 레이팅은 DUPR 이 갱신하므로 직접 고칠 수 없습니다.</small>' +
                  (PV.dupr ? '<div class="me-link"><button type="button" class="btn danger" data-dupr="unlink">연동 해제</button></div>' : '')
                : '<small>DUPR 계정을 연결하면 레이팅이 자동으로 들어오고 계속 갱신됩니다.</small>' +
                  (PV.dupr
                    ? '<div class="me-link"><button type="button" class="btn" data-dupr="link">DUPR 연동</button>' +
                      '<small>DUPR 로그인 창이 열립니다. 계정이 없으면 DUPR 앱·웹에서 먼저 가입해 주세요.</small></div>'
                    : '<div class="me-link"><small>연동은 앱에서 할 수 있습니다.</small></div>')) +
            '</dd></div>' +
            // 커뮤니티에서 내 익명 옆에 무엇이 보일지(마이그 441). 스위치는 연동된
            // 사람에게만 — 붙을 배지가 없는데 스위치를 주면 켜도 아무 일이 없다.
            '<div><dt>커뮤니티 표시</dt><dd>' +
              esc(!dupr.linked
                ? 'DUPR 미설정'
                : (bandPref && myBand && BAND_LABELS[myBand]
                    ? 'DUPR 연동 · ' + BAND_LABELS[myBand]
                    : 'DUPR 연동')) +
              (dupr.linked
                ? '<div class="me-link"><label class="me-check">' +
                    '<input type="checkbox" id="me-band"' + (bandPref ? ' checked' : '') + ' /> ' +
                    '익명 옆에 실력대 표시</label></div>'
                : '') +
              '<small>지금부터 쓰는 글에 적용됩니다. 이미 올린 글은 그대로 남습니다.</small>' +
            '</dd></div>' +
          '</dl>' +
        '</section>' +

        '<section class="me-card">' +
          '<h2>약관 동의</h2>' +
          '<dl class="me-facts">' +
            '<div><dt><a href="' + esc(PV.legal) + '/terms.html" target="_blank" rel="noopener">이용약관</a></dt>' +
              '<dd>' + esc(row.platform_terms_version || '—') + ' · ' + esc(fmtDay(row.platform_terms_accepted_at)) + '</dd></div>' +
            '<div><dt><a href="' + esc(PV.legal) + '/privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a></dt>' +
              '<dd>' + esc(row.privacy_policy_version || '—') + ' · ' + esc(fmtDay(row.privacy_policy_accepted_at)) + '</dd></div>' +
          '</dl>' +
          '<p class="pv-note">회원 탈퇴는 앱의 설정 화면에서 할 수 있습니다.</p>' +
        '</section>';

      wire();
    }

    function err(form, text) {
      var e = form.querySelector('.pv-err');
      if (e) { e.textContent = text || ''; e.hidden = !text; }
    }
    function ok(form, on) {
      var o = form.querySelector('.me-ok');
      if (o) o.hidden = !on;
    }
    function busy(form, on) {
      form.querySelectorAll('button,input,select').forEach(function (n) { n.disabled = !!on; });
    }

    /* ── DUPR 연동 (docs/dupr-api.md §1) ─────────────────────────────────
       규정상 SSO 임베드 iframe 이 유일한 연결 경로다 — DUPR ID 수기 입력 연동은
       만들면 안 된다. 로그인+동의가 끝나면 페이지가 부모 창으로 message 를 쏘고,
       그 토큰을 dupr-link Edge 에 넘기면 서버가 소유를 재검증한 뒤 저장하고
       RATING 웹훅을 구독한다(레이팅은 그때부터 서버가 채운다). ── */
    function invokeDuprLink(body) {
      return sb.auth.getSession().then(function (r) {
        var token = r && r.data && r.data.session && r.data.session.access_token;
        return sb.functions.invoke('dupr-link', {
          body: body,
          headers: token ? { Authorization: 'Bearer ' + token } : undefined,
        });
      });
    }
    /* 4xx 는 supabase-js 가 error 로 주고 사유는 응답 본문에 있다(앱 duprService 와 같은 처리). */
    function duprFailure(res) {
      var payload = (res && res.data) || {};
      if (payload.error) return Promise.resolve(payload.error);
      var ctx = res && res.error && res.error.context;
      if (ctx && typeof ctx.json === 'function') {
        return ctx.json().then(function (b) { return (b && b.error) || 'link_failed'; })
          .catch(function () { return 'link_failed'; });
      }
      return Promise.resolve('link_failed');
    }

    function openDuprSso() {
      if (!PV.dupr || !PV.dupr.clientKey) return;
      var url = PV.dupr.ssoBase + '/login-external-app/' + btoa(PV.dupr.clientKey);
      var d = document.createElement('dialog');
      d.className = 'pv pv-wide';
      d.innerHTML = '<button class="x" data-x aria-label="닫기">×</button><h3>DUPR 연동</h3>' +
        '<p class="pv-note">DUPR 계정으로 로그인하고 정보 제공에 동의하면 연결됩니다. 비밀번호는 DUPR 화면에만 입력되고 저희 쪽에 저장되지 않습니다.</p>' +
        '<div class="me-sso"><iframe title="DUPR 로그인" src="' + esc(url) + '"></iframe></div>' +
        '<p class="pv-err" hidden></p><p class="me-sso-status" hidden>연결하는 중…</p>';
      document.body.appendChild(d);

      var handled = false;
      function setStatus(text) {
        var n = d.querySelector('.me-sso-status');
        if (n) { n.textContent = text || ''; n.hidden = !text; }
      }
      function setError(text) {
        var n = d.querySelector('.pv-err');
        if (n) { n.textContent = text || ''; n.hidden = !text; }
      }
      function onMessage(ev) {
        if (handled) return;
        if (DUPR_ORIGINS.indexOf(ev.origin) < 0) return; // 남의 창이 쏜 토큰은 받지 않는다
        var msg = ev.data;
        if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
        if (!msg || !msg.userToken || !msg.refreshToken || !msg.duprId) return; // SSO 결과가 아닌 잡음
        handled = true;
        setError(''); setStatus('연결하는 중…');
        invokeDuprLink({
          action: 'link',
          userToken: msg.userToken,
          refreshToken: msg.refreshToken,
          duprId: msg.duprId,
          duprNumericId: msg.id,
        }).then(function (res) {
          var ok = !res.error && res.data && res.data.linked && res.data.duprId;
          if (ok) { close(); load(); return; }
          return duprFailure(res).then(function (code) {
            handled = false; // 재시도 허용
            setStatus(''); setError(emsg({ message: code }));
          });
        });
      }
      function close() {
        window.removeEventListener('message', onMessage);
        if (d.open) d.close();
      }
      window.addEventListener('message', onMessage);
      d.addEventListener('close', function () { window.removeEventListener('message', onMessage); d.remove(); });
      d.addEventListener('click', function (ev) { if (ev.target === d) close(); });
      d.querySelector('[data-x]').addEventListener('click', close);
      d.showModal();
    }

    function unlinkDupr(btn) {
      if (!confirm('DUPR 연동을 해제할까요? 레이팅 표시도 함께 지워집니다.')) return;
      btn.disabled = true;
      invokeDuprLink({ action: 'unlink' }).then(function (res) {
        if (!res.error && res.data && res.data.linked === false) { load(); return; }
        return duprFailure(res).then(function (code) { alert(emsg({ message: code })); btn.disabled = false; });
      });
    }

    function wire() {
      bodyEl.querySelectorAll('[data-more]').forEach(function (b) {
        b.addEventListener('click', function () {
          var panel = bodyEl.querySelector('[data-more-panel="' + b.dataset.more + '"]');
          if (!panel) return;
          panel.hidden = !panel.hidden;
          b.hidden = !panel.hidden;
        });
      });

      var bandBox = bodyEl.querySelector('#me-band');
      if (bandBox) {
        bandBox.addEventListener('change', function () {
          var next = bandBox.checked;
          bandBox.disabled = true;
          App.setCommunityPrefs(next).then(function (on) {
            bandPref = on;
            render();
          }).catch(function (e) {
            // 실패하면 화면을 되돌린다 — 켜진 것처럼 보이는데 서버는 꺼져 있는 게 제일 나쁘다.
            bandBox.checked = !next;
            bandBox.disabled = false;
            alert(App.msg(e));
          });
        });
      }

      bodyEl.querySelectorAll('[data-dupr]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.dupr !== 'link') { unlinkDupr(b); return; }
          // 새 창이 보기 편하다(오너 2026-09-16). 팝업이 막히면 모달로 떨어진다.
          var w = null;
          try {
            w = window.open(PV.site + '/dupr-connect.html', 'pvdupr',
              'width=520,height=780,noopener=no,noreferrer=no');
          } catch (e) { w = null; }
          if (w) { try { w.focus(); } catch (e) {} } else openDuprSso();
        });
      });

      var pw = document.getElementById('me-pw');
      if (pw) pw.addEventListener('click', changePassword);

      var pf = document.getElementById('me-profile');
      pf.addEventListener('submit', function (ev) {
        ev.preventDefault();
        err(pf, ''); ok(pf, false); busy(pf, true);
        var nat = pf.nat.value;
        var phone = pf.phone.value.replace(/[^0-9]/g, '');
        // 폼이 수집하지 않는 값(거주지·소속·동의 버전·허브 노출)은 읽어둔 현재 값을 그대로 돌려보낸다.
        // 이 RPC 는 보낸 값으로 무조건 덮어쓰므로, 빼먹으면 앱에서 채운 값이 지워진다.
        sb.rpc('complete_global_profile', {
          p_nationality_type: nat,
          p_real_name: pf.name.value.trim(),
          p_gender: pf.gender.value || null,
          p_birth_year: pf.birth.value ? Number(pf.birth.value) : null,
          p_phone: phone,
          p_country: nat === 'foreign' ? 'visitor' : 'KR',
          p_region: row.region || null,
          p_city: row.city || null,
          p_district: row.district || null,
          p_affiliation_note: row.affiliation_note || null,
          p_platform_terms_version: row.platform_terms_version || PV.terms,
          p_platform_terms_accepted: true,
          p_privacy_policy_version: row.privacy_policy_version || PV.privacy,
          p_privacy_policy_accepted: true,
          p_hub_visibility_opt_in: !!row.hub_visibility_opt_in,
        }).then(function (r) {
          busy(pf, false);
          if (r.error) { err(pf, emsg(r.error)); return; }
          if (r.data) row = r.data;
          ok(pf, true);
          if (App.refreshProfile) App.refreshProfile();
        });
      });

    }

    function changePassword() {
      var d = document.createElement('dialog');
      d.className = 'pv';
      d.innerHTML = '<button class="x" data-x aria-label="닫기">×</button><h3>비밀번호 변경</h3>' +
        '<form class="pv-form" id="me-pwform"><label>새 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="6" required /></label>' +
        '<p class="pv-err" hidden></p><button type="submit" class="btn primary">변경</button></form>';
      document.body.appendChild(d);
      d.addEventListener('close', function () { d.remove(); });
      d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
      d.querySelector('[data-x]').addEventListener('click', function () { d.close(); });
      var form = d.querySelector('#me-pwform');
      form.addEventListener('submit', function (ev) {
        ev.preventDefault(); err(form, ''); busy(form, true);
        sb.auth.updateUser({ password: form.password.value }).then(function (r) {
          busy(form, false);
          if (r.error) { err(form, emsg(r.error)); return; }
          form.innerHTML = '<p class="pv-note">비밀번호를 바꿨습니다.</p>';
        });
      });
      d.showModal();
    }
  }

  var entry = PV.duprConnect ? bootConnect : boot;
  if (window.PVApp) entry();
  else document.addEventListener('DOMContentLoaded', entry);
})();
