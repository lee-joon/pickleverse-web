/*
 * 내 정보 (me.html) — 계정·회원 정보 확인과 수정.
 *
 * 허브 앱의 설정 > 회원정보 수정(HubEditProfileScreen)과 같은 항목·같은 RPC 를 쓴다.
 * 국적·이름·성별·출생연도·연락처는 `complete_global_profile`, 닉네임은 `update_my_profile`.
 *
 * ⚠ 두 RPC 모두 **보낸 값으로 통째로 덮어쓴다**(null 을 보내면 지워진다).
 *   - complete_global_profile 은 거주지(region/city/district)·소속까지 무조건 UPDATE 하므로,
 *     웹 폼이 수집하지 않는 값(앱에서 채워진 값)은 읽어둔 현재 값을 그대로 되돌려 보낸다.
 *   - update_my_profile 은 avatar_path·dupr_rating 도 함께 덮으므로 같은 방식으로 되돌린다
 *     (DUPR 은 연동 계정이면 서버가 무시한다 — 마이그 392).
 *   그래서 이 화면은 "읽기 → 폼 → 읽은 값과 합쳐 전송" 순서를 반드시 지킨다.
 *
 * 익명성: 여기서 다루는 값은 전부 본인 행이다. 커뮤니티 표시명과는 무관하고,
 * 이 화면이 다른 사람의 프로필을 읽는 경로는 없다.
 */
(function () {
  'use strict';
  var PV = window.PV || {};
  if (!PV.me) return;

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

    /* 이 화면에서만 나오는 서버 문구 — 커뮤니티 레이어(app.js)는 표시명 토큰을 담지 않는다
       (communityAnonymity.test 가 app.js 에서 nickname 류 토큰을 금지한다). */
    var ME_ERR = [['Invalid nickname', '닉네임은 2~24자여야 합니다.']];
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
    var row = null, prof = null;

    function load() {
      var uid = App.session.user.id;
      bodyEl.innerHTML = '<p class="me-loading">불러오는 중…</p>';
      Promise.all([
        sb.from('users').select(
          'email,auth_provider,real_name,nationality_type,gender,birth_year,phone,country,region,city,district,' +
          'affiliation_note,platform_terms_version,platform_terms_accepted_at,privacy_policy_version,' +
          'privacy_policy_accepted_at,hub_visibility_opt_in,created_at',
        ).eq('id', uid).maybeSingle(),
        sb.from('user_profiles').select('nickname,avatar_path,dupr_rating').eq('user_id', uid).maybeSingle(),
      ]).then(function (res) {
        if (res[0].error) { bodyEl.innerHTML = '<p class="me-loading">회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>'; return; }
        row = res[0].data || {};
        prof = (res[1] && res[1].data) || {};
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
            '<div><dt>로그인 수단</dt><dd>' + esc(provs.map(function (p) { return PROVIDERS[p] || p; }).join(', ') || '—') + '</dd></div>' +
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
          '<h2>앱 프로필</h2>' +
          '<p class="pv-note">닉네임은 클럽 앱에서 같은 클럽 회원에게 보이는 이름입니다. 커뮤니티 글에는 쓰이지 않습니다.</p>' +
          '<form class="pv-form" id="me-nick">' +
            '<label>닉네임<input name="nickname" type="text" maxlength="24" placeholder="2~24자" value="' + esc(prof.nickname || '') + '" /></label>' +
            '<p class="pv-err" hidden></p>' +
            '<div class="me-actions"><button type="submit" class="btn primary">저장</button><span class="me-ok" hidden>저장했습니다.</span></div>' +
          '</form>' +
          '<dl class="me-facts">' +
            '<div><dt>DUPR</dt><dd>' + esc(prof.dupr_rating == null ? '미설정' : String(prof.dupr_rating)) +
              '<small>DUPR 연동과 레이팅은 앱에서 관리합니다.</small></dd></div>' +
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

    function wire() {
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

      var nf = document.getElementById('me-nick');
      nf.addEventListener('submit', function (ev) {
        ev.preventDefault();
        err(nf, ''); ok(nf, false);
        var next = nf.nickname.value.trim();
        if (next === (prof.nickname || '')) { ok(nf, true); return; }
        busy(nf, true);
        // 아바타·DUPR 도 같은 호출이 덮는다 — 현재 값을 그대로 돌려보내 보존한다
        // (연동 계정의 DUPR 은 서버가 보낸 값을 무시하고 웹훅 값을 지킨다).
        sb.rpc('update_my_profile', {
          p_nickname: next || null,
          p_avatar_path: prof.avatar_path || null,
          p_dupr_rating: prof.dupr_rating == null ? null : Number(prof.dupr_rating),
          p_self_rating: null,
          p_club_id: null,
        }).then(function (r) {
          busy(nf, false);
          if (r.error) { err(nf, emsg(r.error)); return; }
          if (r.data) prof = r.data;
          ok(nf, true);
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

  if (window.PVApp) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
