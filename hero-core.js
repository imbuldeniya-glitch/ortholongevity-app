// hero-core.js
// SINGLE SOURCE for the Knee Age hero: input clamps, the colour-state/threshold
// function, ring geometry, delta-pill copy, and the text-free ring SVG.
// Imported by api/og.js and api/r.js (edge ESM) AND loaded by kneeagequiz.html
// (browser, via <script type="module"> which sets window.KneeHero).
// OrthoLongevity brand hex only — never WHOOP's palette.

// Brand palette
const TEAL = '#5dcaa5', GREEN = '#1d9e75', GOLD = '#c9a84c', TERRA = '#c0703a',
      CREAM = '#f7f3ed', NEUTRAL = '#a7a29a';

// Ring geometry (shared by DOM and /api/og so layout stays consistent)
export const RING = { view: 400, cx: 200, cy: 200, r: 150, stroke: 16 };

// Inputs clamped 18..90 in every path (DOM, api/og, api/r).
export function clampAge(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 40;
  return Math.max(18, Math.min(90, n));
}

// The ONE colour-state / threshold function. Imported by both render paths so
// on-site and /api/og can never disagree.
//   knee <= age -> teal-green ring & glow (at or below chronological age)
//   knee  > age -> amber-terracotta ring & glow (above)
//   pill matches the ring state; exact match uses a neutral colour + "same age" copy.
export function heroState(kneeRaw, ageRaw) {
  const knee = clampAge(kneeRaw), age = clampAge(ageRaw);
  const gap = knee - age, diff = Math.abs(gap);
  const older = gap > 0;
  const ring = older ? { from: GOLD, to: TERRA } : { from: TEAL, to: GREEN };
  const glow = older ? TERRA : GREEN;
  let pill;
  if (gap === 0)      pill = { text: `the same age as ${age}`, color: NEUTRAL };
  else if (gap < 0)   pill = { text: `${diff} year${diff === 1 ? '' : 's'} younger than ${age}`, color: TEAL };
  else                pill = { text: `${diff} year${diff === 1 ? '' : 's'} older than ${age}`, color: TERRA };
  return { knee, age, gap, diff, older, younger: gap < 0, same: gap === 0, ring, glow, num: CREAM, pill };
}

// The ring itself: soft radial glow + faint track + colour-coded arc + a few
// sparse accent dots. NO text — each path draws the number/label/pill with its
// own font engine using heroState() colours + copy, so both share this SVG verbatim.
export function ringSvg(kneeRaw, ageRaw) {
  const s = heroState(kneeRaw, ageRaw);
  const { view, cx, cy, r, stroke } = RING;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0.16, Math.min(1, s.diff / 15));       // arc length scales with the gap
  const dash = (frac * circ).toFixed(1) + ' ' + (circ - frac * circ).toFixed(1);
  const dots = [-58, 46, 210].map(function (deg) {              // 3 sparse ambient accent dots
    const a = deg * Math.PI / 180, dr = r + stroke * 1.7;
    const x = (cx + dr * Math.cos(a)).toFixed(1), y = (cy + dr * Math.sin(a)).toFixed(1);
    return '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + s.glow + '" opacity="0.55"/>';
  }).join('');
  // Unique gradient ids so multiple rings on one page never inherit each other's colours.
  const uid = 'kh' + s.knee + '_' + s.age, arc = uid + 'arc', gl = uid + 'glow';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + view + '" height="' + view + '" viewBox="0 0 ' + view + ' ' + view + '">'
    + '<defs>'
    + '<linearGradient id="' + arc + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + s.ring.from + '"/><stop offset="1" stop-color="' + s.ring.to + '"/></linearGradient>'
    + '<radialGradient id="' + gl + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + s.glow + '" stop-opacity="0.30"/><stop offset="55%" stop-color="' + s.glow + '" stop-opacity="0.10"/><stop offset="100%" stop-color="' + s.glow + '" stop-opacity="0"/></radialGradient>'
    + '</defs>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + stroke) + '" fill="url(#' + gl + ')"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="' + stroke + '"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="url(#' + arc + ')" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
    + dots
    + '</svg>';
}

// Browser global so the classic inline script in kneeagequiz.html can use it.
if (typeof window !== 'undefined') {
  window.KneeHero = { RING, clampAge, heroState, ringSvg };
}
