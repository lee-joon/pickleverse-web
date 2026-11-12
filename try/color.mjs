// 브랜드 색 한 개로 primary 계열 4색을 만든다. 명암 기준은 WCAG AA(본문 4.5:1).
// - primary: 흰 글자를 얹는 채움색 → 흰색 대비 4.5:1 이 될 때까지 어둡게.
// - primaryText: 바탕(bg)과 primarySoft 위 글자 → 둘 다 4.5:1 이 될 때까지 (밝은 바탕은 어둡게, 어두운 바탕은 밝게).

const hex2rgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(hex2rgb(a)), lum(hex2rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
export const mix = (a, b, t) => rgb2hex(mixRgb(hex2rgb(a), hex2rgb(b), t));
export const isHex = (h) => hex2rgb(h) !== null;
export const normHex = (h) => rgb2hex(hex2rgb(h));

// toward 쪽으로 조금씩 섞어 가며 ok() 가 참이 되는 첫 색. 끝까지 안 되면 toward 자체.
const pushUntil = (start, toward, ok) => {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const c = mix(start, toward, Math.min(t, 1));
    if (ok(c)) return c;
  }
  return normHex(toward);
};

// 브랜드 색을 그대로 채움색으로 쓰고, 그 위 글자색(onPrimary)을 흰색/같은 색조의 진한 색 중 대비가 되는 쪽으로 고른다.
// 밝은 색(살구·노랑 등)을 흰 글자에 맞추려고 어둡게 누르면 갈색으로 탁해진다(2026-11-12 오너 지적) — 그래서 글자 쪽을 바꾼다.
// 흰색도 진한 글자도 4.5:1 이 안 되는 중간 밝기만 채움색을 어둡게 한다.
export const derivePalette = (brand, bg) => {
  const dark = lum(hex2rgb(bg)) < 0.2;
  const ink = mix(brand, '#000000', 0.82); // 같은 색조의 아주 진한 색
  let primary = normHex(brand);
  let onPrimary = '#FFFFFF';
  if (contrast(primary, '#FFFFFF') < 4.5) {
    if (contrast(primary, ink) >= 4.5) onPrimary = ink;
    else primary = pushUntil(brand, '#000000', (c) => contrast(c, '#FFFFFF') >= 4.5);
  }
  const primaryDark = mix(primary, '#000000', 0.22);
  const primarySoft = dark ? mix(bg, brand, 0.22) : mix(brand, '#FFFFFF', 0.86);
  // 바탕 위 강조 글자: 원래 브랜드 색에서 출발해 어두운 바탕이면 밝게, 밝은 바탕이면 진하게.
  const primaryText = pushUntil(brand, dark ? '#FFFFFF' : '#000000', (c) => contrast(c, bg) >= 4.5 && contrast(c, primarySoft) >= 4.5);
  return { primary, primaryDark, primarySoft, primaryText, onPrimary };
};
