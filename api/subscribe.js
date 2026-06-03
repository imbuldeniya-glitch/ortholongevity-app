// api/subscribe.js
// Vercel Edge Function — adds subscriber to Kit form 9207706
// Set KIT_API_KEY in Vercel environment variables
// Falls back to Kit public form endpoint if API key not set

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const ok = () => new Response(JSON.stringify({ success: true }), {
    status: 200, headers: corsHeaders
  });

  try {
    const body = await req.json().catch(() => ({}));
    const { email, tags, kneeAge, score } = body;
    const attr = body.attribution || {};

    if (!email || !email.includes('@')) return ok();

    const FORM_ID = '9207706';
    const KIT_API_KEY = process.env.KIT_API_KEY;

    if (KIT_API_KEY) {
      // Method 1: Kit API v3 — full control, tags, custom fields
      try {
        const res = await fetch(
          `https://api.kit.com/v3/forms/${FORM_ID}/subscribe`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: KIT_API_KEY,
              email,
              fields: {
                knee_age:     kneeAge ? String(kneeAge) : '',
                knee_score:   score   ? String(score)   : '',
                source:       'knee-age-quiz',
                utm_source:   attr.utm_source   || '',
                utm_medium:   attr.utm_medium   || '',
                utm_campaign: attr.utm_campaign || '',
                utm_content:  attr.utm_content  || '',
                referrer:     attr.referrer     || '',
              },
              tags: tags || ['knee-age-quiz'],
            }),
          }
        );
        if (res.ok) return ok();
      } catch(e) {
        console.error('Kit API error:', e);
      }
    }

    // Method 2: Kit public form endpoint — no API key needed
    // Works as fallback, triggers incentive email automatically
    try {
      await fetch(
        `https://app.kit.com/forms/${FORM_ID}/subscriptions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `email_address=${encodeURIComponent(email)}`,
        }
      );
    } catch(e) {
      console.error('Kit public form error:', e);
    }

    return ok();

  } catch (err) {
    console.error('Handler error:', err);
    return ok(); // Always return 200 — never break the user journey
  }
}
