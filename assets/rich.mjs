/**
 * 커뮤니티 서식 본문 — 웹 공용 모듈 (생성기(Node)·app.js·편집기(브라우저) 공용).
 * 규칙은 src/apps/hub/services/communityRich.ts 와 동일하다(계약 테스트가 상수를 대조).
 *
 * 모델: { v:1, blocks:[ {t:'p', align?, runs:[{text,b?,i?,u?,color?,size?}]}, {t:'img', path, size?, align?} ] }
 * 렌더는 모델에서 요소를 만들지 HTML 을 파싱하지 않는다 — 텍스트는 전부 이스케이프, 속성은 집합에서만.
 */

const IMAGE_PATH_RE = /^posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;
const COLOR_RE = /^#[0-9a-f]{6}$/;
const SIZES = ['sm', 'md', 'lg', 'xl'];
const IMG_SIZES = ['sm', 'md', 'full'];
const ALIGNS = ['left', 'center', 'right'];
export const LIMITS = { blocks: 300, runs: 200, runText: 4000, images: 10 };
export const BUCKET = 'hub-community';

export function imageUrl(supabaseUrl, path) {
  return `${String(supabaseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${String(path).replace(/^\/+/, '')}`;
}

export function isValidImagePath(p) {
  return typeof p === 'string' && IMAGE_PATH_RE.test(p);
}

export function sanitizeRich(raw, allowedPaths) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v !== 1 && raw.v !== '1') return null;
  if (!Array.isArray(raw.blocks)) return null;
  const blocks = [];
  for (const b of raw.blocks.slice(0, LIMITS.blocks)) {
    if (!b || typeof b !== 'object') continue;
    const align = ALIGNS.includes(b.align) ? b.align : undefined;
    if (b.t === 'p') {
      const runs = [];
      for (const r of (Array.isArray(b.runs) ? b.runs : []).slice(0, LIMITS.runs)) {
        if (!r || typeof r !== 'object' || typeof r.text !== 'string') continue;
        const out = { text: r.text.slice(0, LIMITS.runText) };
        if (r.b === true) out.b = true;
        if (r.i === true) out.i = true;
        if (r.u === true) out.u = true;
        if (typeof r.color === 'string' && COLOR_RE.test(r.color)) out.color = r.color;
        if (SIZES.includes(r.size)) out.size = r.size;
        runs.push(out);
      }
      const p = { t: 'p', runs };
      if (align) p.align = align;
      blocks.push(p);
    } else if (b.t === 'img') {
      if (!isValidImagePath(b.path)) continue;
      if (allowedPaths && !allowedPaths.includes(b.path)) continue;
      const img = { t: 'img', path: b.path };
      if (IMG_SIZES.includes(b.size)) img.size = b.size;
      if (align) img.align = align;
      blocks.push(img);
    }
  }
  return { v: 1, blocks };
}

export function richToPlainText(doc) {
  return doc.blocks
    .map((b) => (b.t === 'img' ? '[사진]' : b.runs.map((r) => r.text).join('')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function richImagePaths(doc) {
  const out = [];
  for (const b of doc.blocks) if (b.t === 'img' && !out.includes(b.path)) out.push(b.path);
  return out.slice(0, LIMITS.images);
}

const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** 정제된 문서 → HTML. 속성값은 전부 집합에서 나오고 텍스트는 이스케이프된다. */
export function renderRichHtml(doc, supabaseUrl) {
  const out = [];
  for (const b of doc.blocks) {
    if (b.t === 'img') {
      const cls = `rimg s-${b.size ?? 'md'} a-${b.align ?? 'center'}`;
      out.push(`<figure class="${cls}"><img src="${esc(imageUrl(supabaseUrl, b.path))}" alt="" loading="lazy" /></figure>`);
      continue;
    }
    const runs = b.runs
      .map((r) => {
        let t = esc(r.text).replaceAll('\n', '<br />');
        if (t === '') return '';
        const cls = [];
        if (r.b) cls.push('b');
        if (r.i) cls.push('i');
        if (r.u) cls.push('u');
        if (r.size && r.size !== 'md') cls.push(`f-${r.size}`);
        // 작성자 색은 --c 로 넘기고, 다크 테마에서는 CSS 가 color-mix 로 밝힌다(어두운 배경 위 어두운 색 방지).
        if (r.color) cls.push('c');
        const style = r.color ? ` style="--c:${r.color}"` : '';
        return cls.length || style ? `<span class="${cls.join(' ')}"${style}>${t}</span>` : t;
      })
      .join('');
    const align = b.align && b.align !== 'left' ? ` class="a-${b.align}"` : '';
    out.push(`<p${align}>${runs || '<br />'}</p>`);
  }
  return out.join('\n');
}

/** 렌더 CSS — 생성기가 페이지 CSS 에 넣는다. 편집기도 같은 클래스를 쓴다. */
export const RICH_CSS = `
  .rich .b { font-weight:700; } .rich .i { font-style:italic; } .rich .u { text-decoration:underline; }
  .rich .c { color:var(--c); }
  @media (prefers-color-scheme: dark) { .rich .c { color:color-mix(in srgb, var(--c) 55%, #ffffff); } }
  .rich .f-sm { font-size:.85em; } .rich .f-lg { font-size:1.3em; } .rich .f-xl { font-size:1.65em; line-height:1.4; }
  .rich p.a-center { text-align:center; } .rich p.a-right { text-align:right; }
  .rich figure.rimg { margin:14px 0; display:flex; }
  .rich figure.rimg.a-left { justify-content:flex-start; } .rich figure.rimg.a-center { justify-content:center; } .rich figure.rimg.a-right { justify-content:flex-end; }
  .rich figure.rimg img { display:block; max-width:100%; height:auto; border-radius:6px; }
  .rich figure.rimg.s-sm img { width:40%; } .rich figure.rimg.s-md img { width:70%; } .rich figure.rimg.s-full img { width:100%; }
  @media (max-width:640px) { .rich figure.rimg.s-sm img { width:60%; } .rich figure.rimg.s-md img { width:100%; } }
`;

if (typeof globalThis !== 'undefined') {
  globalThis.PVRich = { sanitizeRich, richToPlainText, richImagePaths, renderRichHtml, imageUrl, isValidImagePath, LIMITS, BUCKET };
}
