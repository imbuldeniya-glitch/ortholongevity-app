// api/complete.js
// Vercel Edge Function — stores full quiz responses in Google Sheets via SheetDB
// Environment variables needed in Vercel:
//   SHEETDB_URL          — your SheetDB API URL
//   SUPABASE_URL         — optional, for live counter
//   SUPABASE_SERVICE_KEY — optional, for live counter

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

  const respond = () =>
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });

  try {
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    const {
      // Headline outputs
      email = '',
      age = null,
      sex = null,
      kneeAge = null,
      score = null,
      isTeen = false,

      // Individual question responses (answers object from quiz)
      answers = {},

      // Domain pillar scores
      domains = {},

    } = body;

    const timestamp = new Date().toISOString();

    // Calculate age gap — negative is good (younger knees), positive is bad
    const ageGap = (kneeAge !== null && age !== null)
      ? kneeAge - age
      : '';

    // ── Write to Google Sheets via SheetDB ──────────────────────────────────
    const SHEETDB_URL = process.env.SHEETDB_URL;

    if (SHEETDB_URL) {
      try {
        const row = {
          // Core outputs
          timestamp,
          email,
          age:       age !== null ? String(age) : '',
          sex:       sex || '',
          knee_age:  kneeAge !== null ? String(kneeAge) : '',
          score:     score !== null ? String(score) : '',
          age_gap:   ageGap !== '' ? String(ageGap) : '',
          is_teen:   isTeen ? 'yes' : 'no',

          // Individual question responses
          q_metabolic:    answers.metabolic    || '',
          q_nutrition:    answers.nutrition    || '',
          q_sleep:        answers.sleep        || '',
          q_stiffness:    answers.stiffness    || '',
          q_sitting:      answers.sitting      || '',
          q_strength:     answers.strength     || '',
          q_sit_stand:    answers.sit_stand    || '',
          q_pain:         answers.pain         || '',
          q_injury:       answers.injury       || '',
          q_family:       answers.family       || '',
          q_hypermobility: answers.hypermobility || '',
          q_menopause:    answers.menopause    || '',
          q_sport_load:   answers.sport_load   || '',
          q_teen_hormonal: answers.teen_hormonal || '',

          // Domain pillar scores (0-100 each)
          pillar_bio:      domains.bio      !== undefined ? String(Math.round(domains.bio))      : '',
          pillar_move:     domains.move     !== undefined ? String(Math.round(domains.move))     : '',
          pillar_strength: domains.strength !== undefined ? String(Math.round(domains.strength)) : '',
          pillar_injury:   domains.injury   !== undefined ? String(Math.round(domains.injury))   : '',
          pillar_genetic:  domains.genetic  !== undefined ? String(Math.round(domains.genetic))  : '',
        };

        await fetch(SHEETDB_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [row] })
        });
      } catch (e) {
        console.error('SheetDB error:', e);
      }
    }

    // ── Supabase counter (optional) ────────────────────────────────────────
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/completions`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            completed_at: timestamp,
            age: age || null,
            sex: sex || null,
            knee_age: kneeAge || null,
            score: score || null,
            is_teen: isTeen || false,
          })
        });
      } catch (e) {
        console.error('Supabase error:', e);
      }
    }

    return respond();

  } catch (err) {
    console.error('Handler error:', err);
    return respond();
  }
}
