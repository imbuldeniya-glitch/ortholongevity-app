// api/og.js
// Vercel Edge Function — renders a 1200x630 PNG of the Knee Age result hero.
// Deterministic from ?knee= & ?age= only (no name, no identifying detail).
// The ring, colour-state and pill copy come from hero-core.js — the SAME module
// the on-site result uses — so the two outputs can never drift apart.
import { ImageResponse } from '@vercel/og';
import { heroState, ringSvg } from '../hero-core.js';
import { FONTS_B64 } from '../fonts-embed.js';

export const config = { runtime: 'edge' };

const FOREST = '#0f2d1e', MUTED = 'rgba(247,243,237,0.6)';

// tiny hyperscript so we can build Satori elements without JSX.
// props carries `style` plus element attributes (src/width/height for <img>).
const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } });

export function buildOgElement(kneeIn, ageIn) {
  const s = heroState(kneeIn, ageIn);                              // clamps + colour-state (shared)
  const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(ringSvg(s.knee, s.age)); // shared ring

  return h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: FOREST, padding: '54px 60px', fontFamily: 'DM Sans' } },
    // header
    h('div', { style: { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' } },
      h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 700, color: s.num } }, 'OrthoLongevity™'),
      h('div', { style: { display: 'flex', fontSize: 20, letterSpacing: 2, color: '#5dcaa5' } }, 'KNEE AGE')
    ),
    // ring with the Playfair number overlaid
    h('div', { style: { display: 'flex', position: 'relative', width: 380, height: 380, alignItems: 'center', justifyContent: 'center' } },
      h('img', { src: svg, width: 380, height: 380, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
        h('div', { style: { display: 'flex', fontFamily: 'Playfair Display', fontSize: 168, fontWeight: 700, color: s.num, lineHeight: 1 } }, String(s.knee)),
        h('div', { style: { display: 'flex', fontSize: 22, letterSpacing: 3, color: MUTED, marginTop: 6 } }, 'KNEE AGE')
      )
    ),
    // delta pill (copy + colour from hero-core) + footer
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 600, color: s.pill.color, padding: '12px 26px', borderRadius: 100, border: `2px solid ${s.pill.color}`, marginBottom: 20 } }, s.pill.text),
      h('div', { style: { display: 'flex', fontSize: 24, color: MUTED } }, "What's your Knee Age?  ·  kneeage.com")
    )
  );
}

// Decode the base64-embedded fonts once. No network fetch and no fs access, so
// this works identically in edge and node — no self-fetch to be blocked by a
// protected preview, and no file:// fetch that node can't do. On any unexpected
// failure we return null and fall back to the built-in font, so the image is
// NEVER empty.
let _fontCache; // undefined = not built, null = use built-in, array = loaded
function b64ToArrayBuffer(b64) {
  const bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function loadFonts() {
  if (_fontCache !== undefined) return _fontCache;
  try {
    _fontCache = [
      { name: 'Playfair Display', data: b64ToArrayBuffer(FONTS_B64.playfair700), weight: 700, style: 'normal' },
      { name: 'DM Sans', data: b64ToArrayBuffer(FONTS_B64.dmsans400), weight: 400, style: 'normal' },
      { name: 'DM Sans', data: b64ToArrayBuffer(FONTS_B64.dmsans700), weight: 700, style: 'normal' },
    ];
  } catch (e) {
    _fontCache = null; // built-in font fallback — never empty
  }
  return _fontCache;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const el = buildOgElement(url.searchParams.get('knee'), url.searchParams.get('age'));
  const fonts = loadFonts();
  const opts = { width: 1200, height: 630 };
  if (fonts) opts.fonts = fonts;
  const img = new ImageResponse(el, opts);
  // Re-wrap the PNG stream so we control headers exactly (no duplicated
  // cache-control). Modest cache until the DEPLOYED endpoint is confirmed
  // non-empty; can be raised to immutable once verified live.
  return new Response(img.body, {
    status: 200,
    headers: { 'content-type': 'image/png', 'Cache-Control': 'public, max-age=300, must-revalidate' },
  });
}
