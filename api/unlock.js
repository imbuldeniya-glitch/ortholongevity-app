// api/unlock.js
// Backfills the captured email onto the existing Quiz Responses row (matched by
// result_id) after the user unlocks their full report. The row was written by
// /api/complete at result display, before any email existed.
// Uses SheetDB's PATCH-by-column endpoint: PATCH {SHEETDB_URL}/result_id/{value}.
// Requires a result_id column in the Quiz Responses sheet. Fails soft: the
// supplementary row still carries email + result_id, so the join never depends
// on this endpoint succeeding.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  const ok = (msg) => new Response(JSON.stringify({ success: true, msg }), { status: 200, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const resultId = String(body.result_id || '').trim();
    const email = String(body.email || '').trim();
    const SHEETDB_URL = process.env.SHEETDB_URL;

    // Soft-validate: never break the user journey.
    if (!SHEETDB_URL || !resultId || !email || email.indexOf('@') < 0) return ok('skipped');
    // result_id is client-generated; keep the path segment strictly safe.
    if (!/^[A-Za-z0-9-]{8,64}$/.test(resultId)) return ok('skipped');

    const res = await fetch(
      SHEETDB_URL.replace(/\/$/, '') + '/result_id/' + encodeURIComponent(resultId),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { email: email } }),
      }
    );
    return ok(res.ok ? 'backfilled' : 'sheetdb ' + res.status);
  } catch (e) {
    console.error('Unlock backfill error:', e.message);
    return ok('error');
  }
}
