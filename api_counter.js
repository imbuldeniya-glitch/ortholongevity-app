// api/counter.js
// Vercel Edge Function — reads completion count from Supabase
// Called by the landing page to display live counter

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60', // cache for 60 seconds
  };

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ count: 30 }), { status: 200, headers: corsHeaders });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/completions?select=count`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'count=exact',
      }
    });

    const rangeHeader = res.headers.get('content-range') || '';
    const total = parseInt(rangeHeader.split('/')[1] || '30', 10);
    // Add 30 as baseline (tests before Supabase was live)
    const displayCount = total + 30;

    return new Response(JSON.stringify({ count: displayCount }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ count: 30 }), { status: 200, headers: corsHeaders });
  }
}
