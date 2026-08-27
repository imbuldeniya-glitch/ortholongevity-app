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
  const err = (msg) => new Response(JSON.stringify({ success: false, msg }), { status: 200, headers: corsHeaders });

  // Same blank-row hole as /api/complete had: no method check, so a bare GET
  // writes an empty row into the supplementary sheet. Closed here too.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, msg: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Allow': 'POST, OPTIONS' },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ success: false, msg: 'invalid body' }), { status: 400, headers: corsHeaders });
    }
    // Must be tied to a real completion, otherwise it is not a row worth having.
    if (!/^ka-[A-Za-z0-9-]{8,64}$/.test(String(body.result_id || ''))) {
      return new Response(JSON.stringify({ success: false, msg: 'incomplete payload' }), { status: 400, headers: corsHeaders });
    }
    const SHEETDB_URL = process.env.SUPPLEMENTARY_SHEETDB_URL;
    if (!SHEETDB_URL) return err('SHEETDB_URL not configured');
    const row = {
      timestamp: body.timestamp || new Date().toISOString(),
      result_id: body.result_id || '',
      email: body.email || '',
      referral_source: body.referral_source || '',
      region: body.region || '',
      prior_advice: body.prior_advice || '',
      willingness_to_pay: body.willingness_to_pay || '',
      genomics_interest: body.genomics_interest || '',
    };
    const res = await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: row }),
    });
    if (!res.ok) return err('SheetDB error: ' + res.status);
    return ok('saved');
  } catch (e) {
    console.error('Supplementary function error:', e.message);
    return err(e.message);
  }
}
