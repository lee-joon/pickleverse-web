/*
 * 피클허브 커뮤니티 웹 — 글쓰기 페이지(write.html) 편집기 (오너 결정 2026-09-15, 네이버 스마트에디터 참고).
 *
 * 구조: 헤더(목록·게시판·임시저장 표시·게시) + 2줄 도구 막대(삽입 / 서식) + 넓은 문서(제목·본문).
 * 서식(굵게·기울임·밑줄·글자색·크기·정렬)과 사진(20MB 이하만 받고 캔버스로 다운사이징·재인코딩해
 * 업로드 — EXIF 도 이때 사라진다). 사진을 누르면 사진 위에 정렬·크기·순서·삭제 도구가 뜬다.
 * 게시는 확인 패널을 거친다(뉴스: 웹 공개 토글·관련 링크). 작성 중 내용은 이 브라우저에 임시저장된다.
 *
 * 저장 형식은 HTML 이 아니라 모델(rich.mjs)이다. contenteditable 의 DOM 을 걸어 모델로 직렬화하는
 * 과정이 곧 정제다 — 허용된 서식만 남고, 붙여넣은 마크업·스크립트는 살아남지 못한다.
 *
 * 의존: window.PVApp(app.js — 세션·로그인·프로필 게이트·에러 문장), window.PVRich(rich.mjs).
 */
(function () {
  'use strict';
  var PV = window.PV || {};
  var root = document.getElementById('ed-body');
  if (!root || !window.PVApp || !window.PVRich) return;
  var App = window.PVApp, Rich = window.PVRich;
  var isNews = PV.board === 'news';
  var draftId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  var MAX_ORIGINAL = 20 * 1024 * 1024; // 오너 결정: 20MB 이하만
  var MAX_EDGE = 1600, JPEG_Q = 0.85, MAX_IMAGES = Rich.LIMITS.images;
  var DRAFT_KEY = null;
  var editorScope, editorEpoch = 0;
  var uploaded = [], originalPaths = [];
  var linkUrl = null; // 뉴스 관련 링크
  // ?edit=<id> 로 들어오면 수정 모드다. 서버(hub_update_community_post)가 본인 글인지 다시 판정한다.
  var editId = (function () { try { return new URLSearchParams(location.search).get('edit'); } catch (e) { return null; } })();
  var loadedEdit = false;
  // 같은 페이지를 새 글과 수정에 함께 쓴다 — 정적 제목은 '글쓰기'라 수정 모드면 여기서 바꾼다.
  if (editId) {
    var editHeading = document.querySelector('.board-heading h1');
    if (editHeading) editHeading.textContent = '글 수정';
    document.title = document.title.replace(/^글쓰기/, '글 수정');
  }

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function status(text, isErr) { var el = $('#ed-status'); if (el) { el.textContent = text || ''; el.classList.toggle('err', !!isErr); } }
  /** 사용자 문장 + (알 수 없는 오류면) 서버 원문 일부 — "잠시 후 다시" 만으로는 원인을 알 수 없었던 사고 이후. */
  function errText(e) {
    var friendly = App.msg(e);
    var raw = e && (e.message || e.error_description || e.error) ? String(e.message || e.error_description || e.error) : '';
    if (raw && friendly.indexOf('잠시 후') >= 0) friendly += ' (' + raw.slice(0, 140) + ')';
    return friendly;
  }
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(16) + Math.random().toString(16).slice(2)); }

  /* ── 실력대 표시 (마이그 437) ────────────────────────────────────────────
     붙을 배지가 있을 때만 드러낸다 — 켜도 아무 일이 없는 체크박스를 보여 주면
     "왜 안 붙지" 만 남는다. 구간 경계는 서버 hub_community_skill_band 와 같다. */
  var bandBox = $('#ed-band'), bandRow = $('#ed-band-row');
  var BAND_LABELS = { lt25: '2.5 미만', '25_30': '2.5~3.0', '30_35': '3.0~3.5', gte35: '3.5 이상' };
  function revealSkillBand() {
    // 수정 모드는 작성 시점 값이라 여기서 바꾸지 않는다(끄고 켜기는 글 화면에서).
    // 프로필 조회는 app.js 가 맡는다. 로컬 초안의 계정 범위는 업로드 경로/페이로드에 넣지 않는다.
    if (!bandRow || editId || !App.skillBand) return;
    var epoch = editorEpoch;
    App.skillBand().then(function (band) {
      if (epoch !== editorEpoch) return;
      if (!band || !BAND_LABELS[band]) return;
      var label = $('#ed-band-label');
      if (label) label.textContent = '(' + BAND_LABELS[band] + ')';
      bandRow.hidden = false;
      // 내 정보에서 정한 기본값(마이그 441)으로 시작한다. 여기서 바꿔도 이 글에만
      // 적용되고 기본값은 그대로다 — 기본값은 내 정보에서만 바뀐다.
      if (bandBox && App.communityPrefs) {
        App.communityPrefs().then(function (on) { if (epoch === editorEpoch) bandBox.checked = !!on; }).catch(function () {});
      }
    }).catch(function () {});
  }

  /* ── 로그인 게이트: 페이지 자체가 문지기다 ─────────────────────────────── */
  var gate = $('#ed-gate'), form = $('#ed-form');
  function resetEditor() {
    editorEpoch += 1;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null; dirty = false; submitting = false;
    form.hidden = true; gate.hidden = false;
    uploaded = []; originalPaths = []; loadedEdit = false; linkUrl = null;
    draftId = uuid();
    root.innerHTML = ''; $('#ed-title').value = ''; $('#ed-draft').textContent = '';
    $('#ed-restore').hidden = true;
    if (bandBox) bandBox.checked = false;
    if (bandRow) bandRow.hidden = true;
    var lb = $('#ed-link-btn'); if (lb) lb.classList.remove('on');
    document.querySelectorAll('dialog.ned-photos, dialog.ned-pub').forEach(function (d) { d.close(); });
    selectFigure(null); status(''); updatePlaceholder();
  }
  function applyGate() {
    if (editorScope !== App.accountScope) {
      if (dirty && !submitting) saveDraft();
      resetEditor();
      editorScope = App.accountScope;
      DRAFT_KEY = editorScope ? 'pv-draft-' + editorScope + '-' + PV.board : null;
    }
    var epoch = editorEpoch;
    if (App.session) {
      if (!form.hidden) return;
      App.checkProfile().then(function (ok) {
        if (epoch !== editorEpoch) return;
        if (!ok) { App.openProfile(applyGate); return; }
        gate.hidden = true; form.hidden = false;
        revealSkillBand();
        if (editId) loadForEdit(); else offerRestore();
      }).catch(function (e) { if (epoch === editorEpoch) status(errText(e), true); });
    } else {
      gate.hidden = false; form.hidden = true;
    }
  }
  App.ready.then(applyGate);
  App.onAuth(applyGate);
  var gateBtn = $('#ed-gate-login'); if (gateBtn) gateBtn.addEventListener('click', function () { App.openAuth('login'); });

  /* ── 서식 도구 (styleWithCSS=false → <b><i><u><font color size> 로 남아 직렬화가 단순) ── */
  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
  function focusBody() { root.focus(); }
  document.querySelectorAll('[data-cmd]').forEach(function (b) {
    b.addEventListener('mousedown', function (ev) { ev.preventDefault(); }); // 선택 유지
    b.addEventListener('click', function () { focusBody(); document.execCommand(b.dataset.cmd, false, null); refreshToolbar(); });
  });
  var sizeSel = $('#ed-size');
  sizeSel.addEventListener('mousedown', function () { savedRange = currentRange(); });
  sizeSel.addEventListener('change', function () {
    restoreRange(); focusBody();
    document.execCommand('fontSize', false, { sm: '2', md: '3', lg: '5', xl: '7' }[sizeSel.value] || '3');
  });
  // 글자색 팔레트
  var pal = $('#ed-pal'), colorBtn = $('#ed-color-btn'), colorInput = $('#ed-color'), swatch = $('#ed-color-swatch');
  var savedRange = null;
  function currentRange() { var s = window.getSelection(); return s && s.rangeCount && root.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null; }
  function restoreRange() { if (!savedRange) return; var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
  function applyColor(c) {
    restoreRange(); focusBody();
    document.execCommand('foreColor', false, c);
    swatch.style.background = c; colorInput.value = c; pal.hidden = true;
  }
  colorBtn.addEventListener('mousedown', function (ev) { ev.preventDefault(); savedRange = currentRange(); });
  colorBtn.addEventListener('click', function () { pal.hidden = !pal.hidden; });
  pal.querySelectorAll('[data-color]').forEach(function (b) {
    b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    b.addEventListener('click', function () { applyColor(b.dataset.color); });
  });
  colorInput.addEventListener('input', function () { applyColor(colorInput.value); });
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.ned-color')) pal.hidden = true; });
  // 커서 위치의 서식을 도구 막대에 반영(B/I/U on, 크기)
  function refreshToolbar() {
    ['bold', 'italic', 'underline'].forEach(function (c) {
      var b = document.querySelector('[data-cmd="' + c + '"]'); if (!b) return;
      var on = false; try { on = document.queryCommandState(c); } catch (e) {}
      b.classList.toggle('on', !!on);
      b.setAttribute('aria-pressed', String(!!on));
    });
    var sel = window.getSelection();
    if (sel && sel.anchorNode && root.contains(sel.anchorNode)) {
      var el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      var font = el && el.closest ? el.closest('font[size]') : null;
      sizeSel.value = font ? sizeOf(font) : 'md';
    }
  }
  document.addEventListener('selectionchange', function () { if (document.activeElement === root) refreshToolbar(); });
  root.addEventListener('keyup', refreshToolbar);
  root.addEventListener('mouseup', refreshToolbar);

  /* ── 사진: 선택 → 20MB 검사 → 다운사이징(JPEG) → **미리보기** → 확인해야 업로드 ───────
     고르자마자 올라가면 잘못 고른 사진도 이미 서버에 남는다(지워도 파일 정리가 한 박자 늦다).
     확인 전까지는 이 브라우저 안에만 있고, 취소하면 아무것도 올라가지 않는다. */
  var fileInput = $('#ed-file');
  $('#ed-add-image').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var epoch = editorEpoch;
    var files = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    var room = MAX_IMAGES - root.querySelectorAll('figure.ed-img').length;
    if (files.length > room) {
      status('사진은 글 하나에 ' + MAX_IMAGES + '장까지 넣을 수 있습니다.' + (room > 0 ? ' (' + room + '장 더 가능)' : ''), true);
      return;
    }
    var ok = files.filter(function (f) {
      if (f.size > MAX_ORIGINAL) { status(f.name + ': 20MB 이하 사진만 올릴 수 있습니다.', true); return false; }
      if (!/^image\//.test(f.type)) { status(f.name + ': 이미지 파일이 아닙니다.', true); return false; }
      return true;
    });
    if (!ok.length) return;
    status('사진 준비 중…');
    Promise.all(ok.map(function (f) {
      return downsize(f).then(function (out) { out.name = f.name; return out; });
    })).then(function (items) {
      if (epoch !== editorEpoch) return;
      status('');
      openPhotoPreview(items);
    }).catch(function (e) { status(errText(e), true); });
  });

  function kb(n) { return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }

  /** 미리보기 — 여기서 확인해야 실제로 올라간다. 취소하면 업로드도, 흔적도 없다. */
  function openPhotoPreview(items) {
    var epoch = editorEpoch, pending = items.slice(), sending = false;
    var urls = items.map(function (it) { return URL.createObjectURL(it.blob); });
    var d = document.createElement('dialog'); d.className = 'pv ned-photos';
    d.setAttribute('aria-label', '사진 확인');
    d.innerHTML =
      '<button class="x" data-x aria-label="닫기">×</button><h3>사진 확인</h3>' +
      '<p class="pv-note">확인을 누르면 올라갑니다. 긴 변 ' + MAX_EDGE + 'px 로 줄이고 위치 정보는 지웠습니다.</p>' +
      '<div class="pv-photos">' + items.map(function (it, i) {
        return '<figure><img src="' + urls[i] + '" alt="" /><figcaption>' +
          it.w + '×' + it.h + ' · ' + kb(it.blob.size) + '</figcaption></figure>';
      }).join('') + '</div>' +
      '<p class="pv-err" hidden></p>' +
      '<div class="foot"><button type="button" class="btn" data-x>취소</button>' +
      '<button type="button" class="btn primary" id="ph-go">확인</button></div>';
    document.body.appendChild(d);
    function cleanup() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); d.remove(); }
    d.addEventListener('close', cleanup);
    d.addEventListener('cancel', function (ev) { if (sending) ev.preventDefault(); });
    d.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.showModal();
    $('#ph-go', d).addEventListener('click', function () {
      if (sending || epoch !== editorEpoch) return;
      sending = true;
      d.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      status('업로드 중…');
      var chain = Promise.resolve();
      pending.slice().forEach(function (it) {
        chain = chain.then(function () { return uploadImage(it, epoch); }).then(function () { pending.shift(); });
      });
      chain.then(function () { sending = false; if (epoch === editorEpoch) status(''); d.close(); })
        .catch(function (e) {
          sending = false;
          if (epoch !== editorEpoch) return;
          d.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
          status('');
          var err = $('.pv-err', d); if (err) { err.textContent = errText(e); err.hidden = false; }
        });
    });
  }

  function uploadImage(out, epoch) {
    if (epoch !== editorEpoch || !editorScope || editorScope !== App.accountScope) return Promise.reject(new Error('로그인 계정이 변경되었습니다.'));
    var path = 'posts/' + draftId + '/' + uuid() + '.jpg';
    return App.sb.storage.from(Rich.BUCKET).upload(path, out.blob, { contentType: 'image/jpeg', upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        if (epoch !== editorEpoch) throw new Error('로그인 계정이 변경되었습니다.');
        uploaded.push(path);
        insertFigure(path, out.w, out.h);
        markDirty();
      });
  }

  /** 긴 변 1600px 이하 JPEG 로 재인코딩 — 용량을 줄이고 EXIF(위치 등)를 떼어낸다. */
  function downsize(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error('Bad image')); return; }
        var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); // PNG 투명 → 흰 배경
        ctx.drawImage(img, 0, 0, cw, ch);
        // 재인코딩 결과의 실제 픽셀 크기를 같이 넘긴다 — 본문 모델의 w/h 가 되어
        // 읽는 쪽이 이미지를 받기 전에 자리를 잡는다(글 튐 방지).
        c.toBlob(function (blob) { blob ? resolve({ blob: blob, w: cw, h: ch }) : reject(new Error('Encode failed')); }, 'image/jpeg', JPEG_Q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이 사진 형식은 브라우저가 열지 못합니다. JPG·PNG·WebP 로 올려 주세요.')); };
      img.src = url;
    });
  }

  var IMG_TOOLS =
    '<div class="ed-imgtools" contenteditable="false">' +
      '<button type="button" data-img="align" data-val="left">왼쪽</button><button type="button" data-img="align" data-val="center">가운데</button><button type="button" data-img="align" data-val="right">오른쪽</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-img="size" data-val="sm">작게</button><button type="button" data-img="size" data-val="md">보통</button><button type="button" data-img="size" data-val="full">문서 너비</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-img="up">위로</button><button type="button" data-img="down">아래로</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-img="remove">삭제</button>' +
    '</div>';
  function figureHtml(path, size, align, w, h) {
    var dim = w && h ? ' width="' + w + '" height="' + h + '"' : '';
    var data = w && h ? ' data-w="' + w + '" data-h="' + h + '"' : '';
    return '<figure class="rimg ed-img s-' + (size || 'md') + ' a-' + (align || 'center') + '" contenteditable="false" data-path="' + esc(path) + '"' + data + '>' +
      '<img src="' + esc(Rich.imageUrl(PV.url, path)) + '"' + dim + ' alt="" />' + IMG_TOOLS + '</figure>';
  }
  function insertFigure(path, w, h) {
    var fig = document.createElement('template'); fig.innerHTML = figureHtml(path, null, null, w, h);
    var node = fig.content.firstElementChild;
    var sel = window.getSelection();
    var block = null;
    if (sel && sel.rangeCount && root.contains(sel.anchorNode)) {
      block = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      while (block && block.parentElement !== root) block = block.parentElement;
    }
    if (block && block !== root) block.insertAdjacentElement('afterend', node);
    else root.appendChild(node);
    var p = document.createElement('div'); p.innerHTML = '<br>';
    node.insertAdjacentElement('afterend', p);
    selectFigure(node);
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── 사진 선택 → 사진 위 도구(정렬·크기·순서·삭제) ───────────────────────── */
  var selected = null;
  function selectFigure(fig) {
    if (selected) selected.classList.remove('sel');
    selected = fig;
    if (fig) { fig.classList.add('sel'); syncImgTools(fig); }
  }
  function syncImgTools(fig) {
    fig.querySelectorAll('[data-img="align"]').forEach(function (b) { b.classList.toggle('on', fig.classList.contains('a-' + b.dataset.val)); });
    fig.querySelectorAll('[data-img="size"]').forEach(function (b) { b.classList.toggle('on', fig.classList.contains('s-' + b.dataset.val)); });
  }
  root.addEventListener('click', function (ev) {
    var tool = ev.target.closest('[data-img]');
    if (tool) { ev.preventDefault(); imgAction(tool.dataset.img, tool.dataset.val, tool.closest('figure.ed-img')); return; }
    var fig = ev.target.closest('figure.ed-img');
    selectFigure(fig && root.contains(fig) ? fig : null);
  });
  root.addEventListener('mousedown', function (ev) { if (ev.target.closest('[data-img]')) ev.preventDefault(); });
  /* 사진 밖을 누르면 도구 막대가 바로 사라진다 — 본문뿐 아니라 제목·도구·머리글·페이지 아무 데나.
     pointerdown(캡처)이라 포커스가 옮겨가기 전에 반응해서 즉시 사라진 것처럼 보인다.
     누른 곳이 지금 선택된 사진 안(도구 버튼 포함)이면 그대로 둔다. */
  document.addEventListener('pointerdown', function (ev) {
    if (!selected) return;
    var t = ev.target;
    if (t && t.closest && t.closest('figure.ed-img') === selected) return;
    selectFigure(null);
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && selected) selectFigure(null);
  });
  function imgAction(k, v, fig) {
    if (!fig) return;
    if (k === 'size') { fig.classList.remove('s-sm', 's-md', 's-full'); fig.classList.add('s-' + v); }
    else if (k === 'align') { fig.classList.remove('a-left', 'a-center', 'a-right'); fig.classList.add('a-' + v); }
    else if (k === 'up') { var prev = fig.previousElementSibling; if (prev) root.insertBefore(fig, prev); }
    else if (k === 'down') { var next = fig.nextElementSibling; if (next) root.insertBefore(next, fig); }
    else if (k === 'remove') {
      selectFigure(null); fig.remove();
      markDirty(); return;
    }
    syncImgTools(fig); markDirty();
    fig.scrollIntoView({ block: 'nearest' });
  }

  /* ── DOM → 모델 (이 걸음이 정제다) ──────────────────────────────────────── */
  function sizeOf(fontEl) {
    var n = parseInt(fontEl.getAttribute('size'), 10);
    if (n <= 2) return 'sm'; if (n === 3 || isNaN(n)) return 'md'; if (n <= 5) return 'lg'; return 'xl';
  }
  function toHex(color) {
    if (!color) return undefined;
    var c = String(color).trim().toLowerCase();
    var m = c.match(/^#([0-9a-f]{6})$/); if (m) return '#' + m[1];
    m = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/); if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + Number(x).toString(16)).slice(-2); }).join('');
    return undefined;
  }
  function serialize() {
    var blocks = [];
    var cur = null;
    function flush() { if (cur && cur.runs.length) { blocks.push(cur); } cur = null; }
    function para(align) { flush(); cur = { t: 'p', runs: [] }; if (align && align !== 'left') cur.align = align; }
    function pushText(text, st) {
      if (!cur) para();
      if (!text) return;
      var run = { text: text };
      if (st.b) run.b = true; if (st.i) run.i = true; if (st.u) run.u = true;
      if (st.color) run.color = st.color; if (st.size && st.size !== 'md') run.size = st.size;
      var last = cur.runs[cur.runs.length - 1];
      if (last && last.b === run.b && last.i === run.i && last.u === run.u && last.color === run.color && last.size === run.size) last.text += text;
      else cur.runs.push(run);
    }
    function alignOf(el) {
      var a = (el.style && el.style.textAlign) || el.getAttribute('align') || '';
      return a === 'center' || a === 'right' ? a : 'left';
    }
    function walk(node, st) {
      if (node.nodeType === 3) { pushText(Rich.normalizeText(node.nodeValue), st); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'FIGURE' && node.classList.contains('ed-img')) {
        flush();
        var img = { t: 'img', path: node.dataset.path };
        img.size = node.classList.contains('s-sm') ? 'sm' : node.classList.contains('s-full') ? 'full' : 'md';
        img.align = node.classList.contains('a-left') ? 'left' : node.classList.contains('a-right') ? 'right' : 'center';
        var dw = parseInt(node.dataset.w, 10), dh = parseInt(node.dataset.h, 10);
        if (dw > 0 && dh > 0) { img.w = dw; img.h = dh; }
        blocks.push(img); return;
      }
      if (tag === 'BR') { if (cur) pushText('\n', st); return; }
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IMG' || node.classList.contains('ed-imgtools')) return;
      var next = { b: st.b, i: st.i, u: st.u, color: st.color, size: st.size };
      if (tag === 'B' || tag === 'STRONG') next.b = true;
      if (tag === 'I' || tag === 'EM') next.i = true;
      if (tag === 'U') next.u = true;
      if (tag === 'FONT') { if (node.getAttribute('color')) next.color = toHex(node.getAttribute('color')) || st.color; if (node.getAttribute('size')) next.size = sizeOf(node); }
      if (node.style) {
        if (node.style.fontWeight && (node.style.fontWeight === 'bold' || parseInt(node.style.fontWeight, 10) >= 600)) next.b = true;
        if (node.style.fontStyle === 'italic') next.i = true;
        if (node.style.textDecoration && /underline/.test(node.style.textDecoration)) next.u = true;
        if (node.style.color) next.color = toHex(node.style.color) || st.color;
      }
      var isBlock = /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|SECTION|ARTICLE|UL|OL)$/.test(tag);
      if (isBlock) {
        para(alignOf(node));
        Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, next); });
        flush();
        return;
      }
      Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, next); });
    }
    Array.prototype.forEach.call(root.childNodes, function (c) { walk(c, {}); });
    flush();
    var out = [], blank = 0;
    blocks.forEach(function (b) {
      var empty = b.t === 'p' && b.runs.every(function (r) { return !r.text.trim(); });
      if (empty) { blank += 1; if (blank > 1) return; } else blank = 0;
      out.push(b);
    });
    return { v: 1, blocks: out };
  }

  /* ── 수정 모드: 서버의 모델을 편집기 DOM 으로 되돌린다 ──────────────────
     serialize() 가 읽는 표현만 쓴다(b/i/u, font size, style color, div text-align,
     figure.ed-img) — 그래야 불러오기→저장 왕복에서 서식이 보존된다. */
  var SIZE_ATTR = { sm: '2', md: '3', lg: '5', xl: '7' };
  function richToEditorHtml(doc) {
    return doc.blocks.map(function (b) {
      if (b.t === 'img') return figureHtml(b.path, b.size, b.align, b.w, b.h);
      var inner = b.runs.map(function (r) {
        var t = esc(r.text).replace(/\n/g, '<br />');
        if (!t) return '';
        var open = '', close = '';
        if (r.size && r.size !== 'md') { open += '<font size="' + (SIZE_ATTR[r.size] || '3') + '">'; close = '</font>' + close; }
        if (r.color) { open += '<span style="color:' + esc(r.color) + '">'; close = '</span>' + close; }
        if (r.b) { open += '<b>'; close = '</b>' + close; }
        if (r.i) { open += '<i>'; close = '</i>' + close; }
        if (r.u) { open += '<u>'; close = '</u>' + close; }
        return open + t + close;
      }).join('');
      var align = b.align && b.align !== 'left' ? ' style="text-align:' + b.align + '"' : '';
      return '<div' + align + '>' + (inner || '<br />') + '</div>';
    }).join('');
  }
  function plainToEditorHtml(text) {
    return String(text || '').split(/\n/).map(function (line) {
      return '<div>' + (esc(line) || '<br />') + '</div>';
    }).join('');
  }
  function loadForEdit() {
    if (loadedEdit) return;
    loadedEdit = true;
    var epoch = editorEpoch;
    status('불러오는 중…');
    App.sb.rpc('get_hub_community_post', { p_post_id: editId, p_comment_limit: 1, p_comment_after_at: null, p_comment_after_id: null })
      .then(function (r) {
        if (epoch !== editorEpoch) return;
        var post = r.data && r.data.post;
        if (r.error || !post) throw (r.error || new Error('Post not found'));
        if (!post.is_mine) throw new Error('Not authorized');
        $('#ed-title').value = post.title || '';
        var paths = Array.isArray(post.image_paths) ? post.image_paths : [];
        var doc = Rich.sanitizeRich(post.body_rich, paths);
        root.innerHTML = (doc && doc.blocks.length) ? richToEditorHtml(doc) : plainToEditorHtml(post.body);
        // 도구 막대는 저장본에 없으므로 여기서 붙인다(게시 때 다시 떼어낸다).
        root.querySelectorAll('figure.ed-img').forEach(function (f) {
          f.querySelectorAll('.ed-imgtools').forEach(function (t) { t.remove(); });
          f.insertAdjacentHTML('beforeend', IMG_TOOLS);
        });
        originalPaths = paths.slice();
        linkUrl = post.link_url || null;
        var lb = $('#ed-link-btn'); if (lb) lb.classList.toggle('on', !!linkUrl);
        updatePlaceholder();
        status('');
      })
      .catch(function (e) {
        if (epoch !== editorEpoch) return;
        status(String(e && e.message) === 'Not authorized' ? '내가 쓴 글만 수정할 수 있습니다.' : errText(e), true);
        form.hidden = true;
      });
  }

  /* 기존 사진은 글 저장 성공 뒤에만 삭제한다. 취소/실패/실행 취소는 원본을 보존한다. */
  function removeFiles(paths) {
    if (!paths || !paths.length) return Promise.resolve();
    return App.sb.storage.from(Rich.BUCKET).remove(paths).catch(function () {});
  }
  function cleanupUnused(keep) {
    var drop = originalPaths.concat(uploaded).filter(function (p) { return keep.indexOf(p) < 0; });
    uploaded = []; originalPaths = keep.slice();
    return removeFiles(drop);
  }
  /** 이 브라우저에 남은 초안을 버린다 — 그 초안이 올린 사진까지 같이. */
  function discardDraft(saved) {
    if (!DRAFT_KEY) return Promise.resolve();
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    return removeFiles((saved && Array.isArray(saved.uploaded)) ? saved.uploaded : []);
  }
  var DRAFT_TTL = 14 * 24 * 60 * 60 * 1000; // 2주 지난 초안은 되살릴 만한 글이 아니다

  /* ── 임시저장(이 브라우저) — 네이버의 임시저장처럼, 떠났다 돌아와도 이어 쓴다 ── */
  var dirty = false, saveTimer = null;
  function markDirty() { dirty = true; updatePlaceholder(); if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 1500); }
  function saveDraft() {
    if (editId) return; // 수정 모드는 새 글 초안과 무관하다
    if (!DRAFT_KEY) return;
    try {
      var title = $('#ed-title').value;
      if (!title.trim() && !root.textContent.trim() && !root.querySelector('figure')) { localStorage.removeItem(DRAFT_KEY); $('#ed-draft').textContent = ''; return; }
      var doc = serialize();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: title, doc: doc, plain: Rich.richToPlainText(doc), linkUrl: linkUrl, at: Date.now(), draftId: draftId, uploaded: uploaded }));
      var d = new Date(); $('#ed-draft').textContent = '임시저장 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    } catch (e) {}
  }
  function offerRestore() {
    if (!DRAFT_KEY) return;
    var bar = $('#ed-restore'); if (!bar) return;
    var saved = null; try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}
    if (!saved || !(saved.title || saved.doc) || $('#ed-title').value || root.textContent.trim()) return;
    // 2주 넘은 초안은 묻지 않고 버린다 — 안 그러면 그 초안이 올린 사진이 영영 남는다.
    if (saved.at && Date.now() - saved.at > DRAFT_TTL) { discardDraft(saved); return; }
    bar.hidden = false;
    $('#ed-restore-yes').onclick = function () {
      $('#ed-title').value = saved.title || '';
      try {
        var restored = Rich.prepareRichWrite(saved.doc).doc;
        restored = Rich.sanitizeRich(restored, Array.isArray(saved.uploaded) ? saved.uploaded : []);
        root.innerHTML = richToEditorHtml(restored);
      } catch (e) {
        root.innerHTML = plainToEditorHtml(saved.plain || '');
        if (saved.plain) status('초안을 텍스트로 복원했습니다. 내용과 서식을 확인해 주세요.');
      }
      // 도구 마크업은 최신으로 다시 붙인다(저장본에 옛 도구가 있어도 무시)
      root.querySelectorAll('figure.ed-img').forEach(function (f) {
        f.querySelectorAll('.ed-imgtools').forEach(function (t) { t.remove(); });
        f.insertAdjacentHTML('beforeend', IMG_TOOLS);
      });
      if (saved.draftId) draftId = saved.draftId;
      if (Array.isArray(saved.uploaded)) uploaded = saved.uploaded.slice();
      linkUrl = saved.linkUrl && /^https:\/\//.test(saved.linkUrl) ? saved.linkUrl : null;
      bar.hidden = true; updatePlaceholder(); markDirty();
    };
    $('#ed-restore-no').onclick = function () { discardDraft(saved); bar.hidden = true; };
  }
  function updatePlaceholder() { root.classList.toggle('blank', !root.textContent.trim() && !root.querySelector('figure')); }
  root.addEventListener('input', markDirty);
  $('#ed-title').addEventListener('input', markDirty);
  updatePlaceholder();

  /* ── 뉴스: 관련 링크 ────────────────────────────────────────────────────── */
  var linkBtn = $('#ed-link-btn');
  if (linkBtn) {
    linkBtn.addEventListener('click', function () {
      var v = window.prompt('관련 링크 (https://)', linkUrl || '');
      if (v === null) return;
      v = v.trim();
      if (v && !/^https:\/\//.test(v)) { status('링크는 https:// 로 시작해야 합니다.', true); return; }
      linkUrl = v || null; linkBtn.classList.toggle('on', !!linkUrl); status(linkUrl ? '관련 링크: ' + linkUrl : '관련 링크를 지웠습니다.');
    });
  }

  /* ── 게시 — 확인 패널을 거친다 ─────────────────────────────────────────── */
  var submitting = false;
  $('#ed-submit').addEventListener('click', function () {
    if (submitting) return;
    var title = $('#ed-title').value.trim();
    if (!title) { status('제목을 입력해 주세요.', true); $('#ed-title').focus(); return; }
    var prepared;
    try { prepared = Rich.prepareRichWrite(serialize()); }
    catch (e) { status(e.message, true); root.focus(); return; }
    if (!App.session) { App.openAuth('login'); return; }
    openPublishPanel(title, prepared.doc, prepared.paths, prepared.plain);
  });

  function openPublishPanel(title, doc, paths, plain) {
    var epoch = editorEpoch, draftKey = DRAFT_KEY;
    var d = document.createElement('dialog'); d.className = 'pv ned-pub';
    d.setAttribute('aria-label', editId ? '수정 저장' : '글 게시');
    var imgCount = paths.length;
    d.innerHTML =
      '<button class="x" data-x aria-label="닫기">×</button><h3>' + (editId ? '수정' : '게시') + '</h3>' +
      '<div class="row"><div><b>' + esc(title) + '</b><span class="sub">' + plain.length + '자' + (imgCount ? ' · 사진 ' + imgCount + '장' : '') + '</span></div></div>' +
      (isNews && !editId
        ? '<div class="row" style="display:block"><div>관련 링크 (선택)</div><input type="url" id="pub-link" placeholder="https://" value="' + esc(linkUrl || '') + '" style="margin-top:8px" /></div>'
        : '') +
      (isNews && editId && linkUrl
        ? '<div class="row"><div>관련 링크<span class="sub">' + esc(linkUrl) + ' — 수정에서는 바꿀 수 없습니다(그대로 유지됩니다).</span></div></div>'
        : '') +
      '<div class="row"><div>' + (isNews ? '뉴스 게시판에 게시' : '익명으로 게시') +
        '<span class="sub">앱과 이 웹사이트에 함께 올라갑니다. 다른 이용자에게는 글 안에서만 고정되는 6자리 코드로 보입니다(운영자 글은 "관리자"로 표시).</span></div></div>' +
      '<p class="pv-err" hidden></p>' +
      '<div class="foot"><button type="button" class="btn" data-x>취소</button><button type="button" class="btn primary" id="pub-go">' + (editId ? '수정 저장' : '게시') + '</button></div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('cancel', function (ev) { if (submitting) ev.preventDefault(); });
    d.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.showModal();
    $('#pub-go', d).addEventListener('click', function () {
      if (submitting || epoch !== editorEpoch) return;
      var err = $('.pv-err', d);
      var link = null;
      if (isNews && !editId) {
        link = ($('#pub-link', d).value || '').trim() || null;
        if (link && !/^https:\/\//.test(link)) { err.textContent = '링크는 https:// 로 시작해야 합니다.'; err.hidden = false; return; }
      }
      var hasFormat = doc.blocks.some(function (b) { return b.t === 'img' || b.align || b.runs.some(function (r) { return r.b || r.i || r.u || r.color || r.size; }); });
      submitting = true; $('#pub-go', d).disabled = true; err.hidden = true; status(editId ? '저장 중…' : '게시 중…');
      d.querySelectorAll('[data-x]').forEach(function (b) { b.disabled = true; });
      App.requireMember().then(function (ok) {
        if (!ok) throw new Error('게시가 취소되었습니다. 회원 정보를 확인해 주세요.');
        if (epoch !== editorEpoch) throw new Error('로그인 계정이 변경되었습니다.');
        var call = editId
          ? App.sb.rpc('hub_update_community_post', {
              p_post_id: editId, p_title: title, p_body: plain,
              p_image_paths: paths, p_body_rich: hasFormat ? doc : null,
            })
          : App.sb.rpc('hub_create_community_post', {
              p_board_kind: PV.board, p_title: title, p_body: plain, p_image_paths: paths, p_link_url: link,
              p_body_rich: hasFormat ? doc : null,
              p_show_skill_band: !!(bandBox && bandBox.checked),
            });
        return call.then(function (r) {
          if (r.error) throw r.error;
          if (epoch !== editorEpoch) return;
          var id = editId || (r.data && r.data.id);
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = null;
          if (!editId) { try { localStorage.removeItem(draftKey); } catch (e) {} }
          // 436: 웹 공개 토글 폐지 — 뉴스도 자유게시판처럼 게시 즉시 앱·웹 모두에 나간다.
          dirty = false;
          return cleanupUnused(paths).then(function () {
            if (epoch === editorEpoch) location.href = PV.site + '/' + (isNews ? 'news' : 'free') + '/view.html?id=' + encodeURIComponent(id);
          });
        });
      }).catch(function (e) {
        if (epoch !== editorEpoch) return;
        submitting = false; $('#pub-go', d).disabled = false;
        d.querySelectorAll('[data-x]').forEach(function (b) { b.disabled = false; });
        err.textContent = errText(e); err.hidden = false; status('');
      });
    });
  }

  /* ── 이탈 경고 + 등록 안 한 업로드 정리 ────────────────────────────────── */
  window.addEventListener('beforeunload', function (ev) {
    if (dirty && !submitting) { saveDraft(); ev.preventDefault(); ev.returnValue = ''; }
  });

  // 개발 확인용(모의 서버 검증) — 직렬화 결과를 들여다볼 수 있게 노출. 데이터·권한과 무관.
  window.PVEditor = { serialize: serialize };
})();
