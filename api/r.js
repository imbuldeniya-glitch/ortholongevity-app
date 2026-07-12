// api/r.js
// Vercel Edge Function — shareable result page with SERVER-SIDE Open Graph meta.
// Social crawlers do not run client JS, so og:image is emitted here and points at
// /api/og. Humans get a light result view with a button back to the free test.
// Only two numbers travel in the URL (knee, age); no name or identifying detail.
export const config = { runtime: 'edge' };

function clampNum(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = url.origin;
  const knee = clampNum(url.searchParams.get('knee'), 18, 90, 40);
  const age = clampNum(url.searchParams.get('age'), 18, 90, 40);
  const gap = knee - age, diff = Math.abs(gap);
  const word = gap < 0 ? 'younger' : gap > 0 ? 'older' : 'in line with';
  const gapLine = gap === 0 ? `in line with the age of ${age}` : `${diff} year${diff === 1 ? '' : 's'} ${word} than the age of ${age}`;
  const ogImg = `${origin}/api/og?knee=${knee}&age=${age}`;
  const title = `These knees are ${knee}. Real age ${age}.`;
  const desc = `A surgeon-built test scores the biological age of your knees in 60 seconds. Find out your own Knee Age, free.`;
  const testUrl = `${origin}/kneeagequiz.html`;
  const pillCol = gap < 0 ? '#5dcaa5' : gap > 0 ? '#c0703a' : '#c9a84c';

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta name="robots" content="noindex, follow"/>
<link rel="canonical" href="${origin}/"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="OrthoLongevity™"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${origin}/r?knee=${knee}&age=${age}"/>
<meta property="og:image" content="${ogImg}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${ogImg}"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f2d1e;color:#f7f3ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px}
  .wm{font-size:15px;font-weight:700;letter-spacing:.02em;margin-bottom:40px}
  .wm span{color:#5dcaa5}
  .num{font-size:120px;font-weight:800;line-height:1}
  .lbl{font-size:14px;letter-spacing:.2em;color:rgba(247,243,237,.55);text-transform:uppercase;margin-top:4px}
  .pill{display:inline-block;margin:22px 0 32px;padding:11px 24px;border-radius:100px;border:2px solid ${pillCol};color:${pillCol};font-size:17px;font-weight:600}
  .q{font-size:22px;font-weight:700;margin-bottom:20px}
  .cta{display:inline-block;background:#c9a84c;color:#173d2c;font-weight:700;font-size:17px;text-decoration:none;padding:15px 34px;border-radius:100px}
  .foot{margin-top:36px;font-size:12px;color:rgba(247,243,237,.4);max-width:420px;line-height:1.6}
</style>
</head>
<body>
  <div class="wm">Ortho<span>Longevity™</span></div>
  <div class="num">${knee}</div>
  <div class="lbl">Knee Age</div>
  <div class="pill">${esc(gapLine)}</div>
  <div class="q">What's your Knee Age?</div>
  <a class="cta" href="${testUrl}">Take the free 60-second test →</a>
  <div class="foot">Educational only, not a medical diagnosis. Built by Dr Arj Imbuldeniya, Consultant Orthopaedic Knee &amp; Hip Surgeon.</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
