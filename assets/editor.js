/*
 * 피클허브 커뮤니티 웹 — 글쓰기 페이지(write.html) 편집기 (오너 결정 2026-09-15).
 *
 * 팝업이 아니라 전용 페이지다. 서식(굵게·기울임·밑줄·색·크기·정렬)과 사진(20MB 이하만 받고
 * 캔버스로 다운사이징·재인코딩해 업로드 — EXIF 도 이때 사라진다), 사진의 크기·정렬·순서 조절.
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
  var uploaded = []; // 이 편집 세션에서 올린 경로(등록 안 하고 떠나면 삭제 시도)

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

  /* ── 로그인 게이트: 페이지 자체가 문지기다 ─────────────────────────────── */
  var gate = $('#ed-gate'), form = $('#ed-form');
  function applyGate() {
    if (App.session) {
      App.checkProfile().then(function (ok) {
        if (!ok) { App.openProfile(applyGate); return; }
        gate.hidden = true; form.hidden = false;
      });
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
    b.addEventListener('click', function () {
      focusBody();
      var cmd = b.dataset.cmd, val = b.dataset.val || null;
      if (cmd === 'fontSize') { document.execCommand('fontSize', false, { sm: '2', md: '3', lg: '5', xl: '7' }[val] || '3'); return; }
      document.execCommand(cmd, false, val);
    });
  });
  var colorInput = $('#ed-color');
  if (colorInput) {
    colorInput.addEventListener('input', function () { focusBody(); document.execCommand('foreColor', false, colorInput.value); });
  }

  /* ── 사진: 선택 → 20MB 검사 → 다운사이징(JPEG) → 업로드 → 커서 위치에 figure ─────── */
  var fileInput = $('#ed-file');
  $('#ed-add-image').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = '';
    if (!files.length) return;
    var current = root.querySelectorAll('figure.ed-img').length;
    if (current + files.length > MAX_IMAGES) { status('사진은 글 하나에 ' + MAX_IMAGES + '장까지 넣을 수 있습니다.', true); return; }
    var chain = Promise.resolve();
    files.forEach(function (f) { chain = chain.then(function () { return addImage(f); }); });
    chain.catch(function (e) { status(errText(e), true); });
  });

  function addImage(file) {
    if (file.size > MAX_ORIGINAL) { status(file.name + ': 20MB 이하 사진만 올릴 수 있습니다.', true); return Promise.resolve(); }
    if (!/^image\//.test(file.type)) { status(file.name + ': 이미지 파일이 아닙니다.', true); return Promise.resolve(); }
    status('사진 처리 중…');
    return downsize(file).then(function (blob) {
      var path = 'posts/' + draftId + '/' + uuid() + '.jpg';
      status('업로드 중…');
      return App.sb.storage.from(Rich.BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (r) {
        if (r.error) throw r.error;
        uploaded.push(path);
        insertFigure(path);
        status('');
      });
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
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('Encode failed')); }, 'image/jpeg', JPEG_Q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이 사진 형식은 브라우저가 열지 못합니다. JPG·PNG·WebP 로 올려 주세요.')); };
      img.src = url;
    });
  }

  function figureHtml(path) {
    return '<figure class="rimg ed-img s-md a-center" contenteditable="false" data-path="' + esc(path) + '"><img src="' + esc(Rich.imageUrl(PV.url, path)) + '" alt="" /></figure>';
  }
  function insertFigure(path) {
    var fig = document.createElement('template'); fig.innerHTML = figureHtml(path);
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
  }

  /* ── 사진 선택 → 크기·정렬·순서·삭제 도구 ──────────────────────────────── */
  var imgbar = $('#ed-imgbar'), selected = null;
  function selectFigure(fig) {
    if (selected) selected.classList.remove('sel');
    selected = fig;
    if (fig) { fig.classList.add('sel'); imgbar.hidden = false; } else { imgbar.hidden = true; }
  }
  root.addEventListener('click', function (ev) {
    var fig = ev.target.closest('figure.ed-img');
    selectFigure(fig && root.contains(fig) ? fig : null);
  });
  document.querySelectorAll('[data-img]').forEach(function (b) {
    b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    b.addEventListener('click', function () {
      if (!selected) return;
      var k = b.dataset.img, v = b.dataset.val;
      if (k === 'size') { selected.classList.remove('s-sm', 's-md', 's-full'); selected.classList.add('s-' + v); }
      else if (k === 'align') { selected.classList.remove('a-left', 'a-center', 'a-right'); selected.classList.add('a-' + v); }
      else if (k === 'up') { var prev = selected.previousElementSibling; if (prev) root.insertBefore(selected, prev); }
      else if (k === 'down') { var next = selected.nextElementSibling; if (next) root.insertBefore(next, selected); }
      else if (k === 'remove') {
        var path = selected.dataset.path; var fig = selected; selectFigure(null); fig.remove();
        App.sb.storage.from(Rich.BUCKET).remove([path]).catch(function () {});
        uploaded = uploaded.filter(function (p) { return p !== path; });
      }
      selected && selected.scrollIntoView({ block: 'nearest' });
    });
  });

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
    function walk(node, st, inBlock) {
      if (node.nodeType === 3) { pushText(node.nodeValue.replace(/ /g, ' '), st); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'FIGURE' && node.classList.contains('ed-img')) {
        flush();
        var img = { t: 'img', path: node.dataset.path };
        img.size = node.classList.contains('s-sm') ? 'sm' : node.classList.contains('s-full') ? 'full' : 'md';
        img.align = node.classList.contains('a-left') ? 'left' : node.classList.contains('a-right') ? 'right' : 'center';
        blocks.push(img); return;
      }
      if (tag === 'BR') { if (cur) pushText('\n', st); return; }
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IMG') return;
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
        Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, next, true); });
        flush();
        return;
      }
      Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, next, inBlock); });
    }
    Array.prototype.forEach.call(root.childNodes, function (c) { walk(c, {}, false); });
    flush();
    // 빈 문단 정리(연속 빈 줄은 하나로)
    var out = [], blank = 0;
    blocks.forEach(function (b) {
      var empty = b.t === 'p' && b.runs.every(function (r) { return !r.text.trim(); });
      if (empty) { blank += 1; if (blank > 1) return; } else blank = 0;
      out.push(b);
    });
    return { v: 1, blocks: out };
  }

  /* ── 등록 ──────────────────────────────────────────────────────────────── */
  var submitting = false;
  $('#ed-submit').addEventListener('click', function () {
    if (submitting) return;
    var title = $('#ed-title').value.trim();
    if (!title) { status('제목을 입력해 주세요.', true); $('#ed-title').focus(); return; }
    var raw = serialize();
    var paths = Rich.richImagePaths(raw);
    var doc = Rich.sanitizeRich(raw, paths);
    var plain = Rich.richToPlainText(doc);
    if (!plain) { status('내용을 입력해 주세요.', true); root.focus(); return; }
    if (plain.length > 5000) { status('내용은 5,000자까지 쓸 수 있습니다. (현재 ' + plain.length + '자)', true); return; }
    var hasFormat = doc.blocks.some(function (b) { return b.t === 'img' || b.align || b.runs.some(function (r) { return r.b || r.i || r.u || r.color || r.size; }); });
    var link = isNews && $('#ed-link') && $('#ed-link').value.trim() ? $('#ed-link').value.trim() : null;
    submitting = true; status('등록 중…');
    $('#ed-submit').disabled = true;
    App.requireMember(function () {
      App.sb.rpc('hub_create_community_post', {
        p_board_kind: PV.board, p_title: title, p_body: plain, p_image_paths: paths, p_link_url: link,
        p_body_rich: hasFormat ? doc : null,
      }).then(function (r) {
        if (r.error) throw r.error;
        var id = r.data && r.data.id;
        uploaded = []; // 글에 귀속됐다 — 떠날 때 지우지 않는다
        var next = isNews && $('#ed-web') && $('#ed-web').checked
          ? App.sb.rpc('hub_set_news_web_publish', { p_post_id: id, p_publish: true })
          : Promise.resolve({});
        return next.then(function () {
          dirty = false;
          location.href = PV.site + '/' + (isNews ? 'news' : 'free') + '/view.html?id=' + encodeURIComponent(id);
        });
      }).catch(function (e) {
        submitting = false; $('#ed-submit').disabled = false; status(errText(e), true);
      });
    });
    // requireMember 가 로그인 다이얼로그로 빠지면 등록은 진행되지 않는다
    setTimeout(function () { if (submitting && !App.session) { submitting = false; $('#ed-submit').disabled = false; status(''); } }, 300);
  });

  /* ── 작성 중 이탈 경고 + 등록 안 한 업로드 정리 ───────────────────────── */
  var dirty = false;
  root.addEventListener('input', function () { dirty = true; });
  $('#ed-title').addEventListener('input', function () { dirty = true; });
  window.addEventListener('beforeunload', function (ev) {
    if (dirty && !submitting) { ev.preventDefault(); ev.returnValue = ''; }
  });
  window.addEventListener('pagehide', function () {
    if (uploaded.length && !submitting) {
      try { App.sb.storage.from(Rich.BUCKET).remove(uploaded.slice()); } catch (e) {}
    }
  });

  // 개발 확인용(모의 서버 검증) — 직렬화 결과를 들여다볼 수 있게 노출. 데이터·권한과 무관.
  window.PVEditor = { serialize: serialize };
})();