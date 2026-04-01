// api/subscribe.js
// Vercel Edge Function — proxies email to Kit (ConvertKit)
// Deploy this file to your Vercel project at /api/subscribe.js
// Set KIT_API_KEY as an environment variable in your Vercel dashboard

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // CORS — allow your domain and localhost for dev
  const origin = req.headers.get('origin') || '';
  const allowed = [
    'https://ortholongevity.ai',
    'https://www.ortholongevity.ai',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, firstName, tags, kneeAge, score } = body;

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: corsHeaders
      });
    }

    const KIT_API_KEY = process.env.KIT_API_KEY;
    const FORM_ID = '9207706';

    if (!KIT_API_KEY) {
      console.error('KIT_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        status: 500, headers: corsHeaders
      });
    }

    // Subscribe via Kit API v3
    // Uses the form subscription endpoint which handles tags automatically
    const kitRes = await fetch(
      `https://api.kit.com/v3/forms/${FORM_ID}/subscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: KIT_API_KEY,
          email,
          first_name: firstName || '',
          fields: {
            knee_age: kneeAge ? String(kneeAge) : '',
            knee_score: score ? String(score) : '',
            source: 'knee-age-quiz',
          },
          tags: tags || ['knee-age-quiz'],
        }),
      }
    );

    const kitData = await kitRes.json();

    if (!kitRes.ok) {
      console.error('Kit error:', kitData);
      return new Response(JSON.stringify({ error: 'Subscription failed', detail: kitData }), {
        status: 502, headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, subscriber: kitData.subscription?.subscriber?.id }), {
      status: 200, headers: corsHeaders
    });

  } catch (err) {
    console.error('Subscribe error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: corsHeaders
    });
  }
}
