// api/og.js
// Vercel Edge Function — renders a 1200x630 PNG of a Knee Age result dial.
// Deterministic from ?knee= & ?age= only (no name, no identifying detail).
// Brand palette only; mirrors the results-screen dial.
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// forest bg, cream, teal->gold (younger), amber->terracotta (older)
const FOREST = '#0f2d1e', CREAM = '#f7f3ed', MUTED = 'rgba(247,243,237,0.6)';

function clampNum(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

// tiny hyperscript so we can build Satori elements without JSX.
// props carries `style` plus element attributes (src/width/height for <img>).
const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } });

function dialSvg(gap) {
  const younger = gap < 0, older = gap > 0;
  const c1 = younger ? '#5dcaa5' : older ? '#c9a84c' : '#5dcaa5';
  const c2 = younger ? '#c9a84c' : older ? '#c0703a' : '#5dcaa5';
  const r = 165, cx = 190, cy = 190, circ = 2 * Math.PI * r;
  // arc length scales with |gap|, always visibly present, never a full lie
  const frac = Math.max(0.16, Math.min(1, Math.abs(gap) / 15));
  const dash = (frac * circ).toFixed(1) + ' ' + (circ - frac * circ).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="0 0 380 380">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="18"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#g)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${cx} ${cy})"/>`
    + `</svg>`;
}

export function buildOgElement(kneeIn, ageIn) {
  const knee = clampNum(kneeIn, 18, 90, 40);
  const age = clampNum(ageIn, 18, 90, 40);
  const gap = knee - age, diff = Math.abs(gap);
  const word = gap < 0 ? 'younger' : gap > 0 ? 'older' : 'in line with';
  const pill = gap === 0
    ? `In line with your age of ${age}`
    : `${diff} year${diff === 1 ? '' : 's'} ${word} than your age of ${age}`;
  const pillCol = gap < 0 ? '#5dcaa5' : gap > 0 ? '#c0703a' : '#c9a84c';
  const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(dialSvg(gap));

  return h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: FOREST, padding: '54px 60px', fontFamily: 'DM Sans' } },
    // header
    h('div', { style: { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' } },
      h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 700, color: CREAM } }, 'OrthoLongevity™'),
      h('div', { style: { display: 'flex', fontSize: 20, letterSpacing: 2, color: '#5dcaa5' } }, 'KNEE AGE')
    ),
    // dial with number overlaid
    h('div', { style: { display: 'flex', position: 'relative', width: 380, height: 380, alignItems: 'center', justifyContent: 'center' } },
      h('img', { src: svg, width: 380, height: 380, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
        h('div', { style: { display: 'flex', fontFamily: 'Playfair Display', fontSize: 168, fontWeight: 700, color: CREAM, lineHeight: 1 } }, String(knee)),
        h('div', { style: { display: 'flex', fontSize: 22, letterSpacing: 3, color: MUTED, marginTop: 6 } }, 'KNEE AGE')
      )
    ),
    // pill + footer
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 600, color: pillCol, padding: '12px 26px', borderRadius: 100, border: `2px solid ${pillCol}`, marginBottom: 20 } }, pill),
      h('div', { style: { display: 'flex', fontSize: 24, color: MUTED } }, "What's your Knee Age?  ·  kneeage.com")
    )
  );
}

// Brand fonts are read from the BUNDLED asset via import.meta.url — no network
// self-fetch, so a protected preview can't return an auth page in place of the
// font (which would make Satori stream an empty image). Each font is validated;
// on any failure we fall back to the built-in font so the image is NEVER empty.
let _fontCache; // undefined = not tried, null = use built-in, array = loaded
async function loadFonts() {
  if (_fontCache !== undefined) return _fontCache;
  const files = [
    ['PlayfairDisplay-700.woff', 'Playfair Display', 700],
    ['DMSans-400.woff', 'DM Sans', 400],
    ['DMSans-700.woff', 'DM Sans', 700],
  ];
  try {
    _fontCache = await Promise.all(files.map(async ([file, name, weight]) => {
      const res = await fetch(new URL('../fonts/' + file, import.meta.url));
      const data = await res.arrayBuffer();
      const valid = data.byteLength > 2000 && new DataView(data).getUint32(0) === 0x774F4646; // 'wOFF'
      if (!valid) throw new Error('invalid font ' + file);
      return { name, data, weight, style: 'normal' };
    }));
  } catch (e) {
    _fontCache = null; // built-in font fallback — never empty
  }
  return _fontCache;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const el = buildOgElement(url.searchParams.get('knee'), url.searchParams.get('age'));
  const fonts = await loadFonts();
  const opts = { width: 1200, height: 630 };
  if (fonts) opts.fonts = fonts;
  const img = new ImageResponse(el, opts);
  return new Response(img.body, {
    status: 200,
    headers: { 'content-type': 'image/png', 'Cache-Control': 'public, max-age=300, must-revalidate' },
  });
}
