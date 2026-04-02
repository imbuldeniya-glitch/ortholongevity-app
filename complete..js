export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  const ok = (msg, data = {}) => new Response(JSON.stringify({ success: true, msg, ...data }), { status: 200, headers: corsHeaders });
  const err = (msg) => new Response(JSON.stringify({ success: false, msg }), { status: 200, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    console.log('Complete called with body:', JSON.stringify(body));

    const {
      email = '',
      age = '',
      sex = '',
      kneeAge = '',
      score = '',
      isTeen = false,
      ageGap = '',
      answers = {},
      pillarScores = {}
    } = body;

    const SHEETDB_URL = process.env.SHEETDB_URL;
    console.log('SHEETDB_URL present:', !!SHEETDB_URL);

    if (!SHEETDB_URL) {
      console.error('SHEETDB_URL environment variable is not set');
      return err('SHEETDB_URL not configured');
    }

    const row = {
      timestamp: new Date().toISOString(),
      email: String(email),
      age: String(age),
      sex: String(sex),
      knee_age: String(kneeAge),
      score: String(score),
      is_teen: String(isTeen),
      age_gap: String(ageGap),
      q_pain: String(answers.q_pain || ''),
      q_stiffness: String(answers.q_stiffness || ''),
      q_sit_stand: String(answers.q_sit_stand || ''),
      q_sitting: String(answers.q_sitting || ''),
      q_sleep: String(answers.q_sleep || ''),
      q_weight: String(answers.q_weight || ''),
      q_diet: String(answers.q_diet || ''),
      q_strength: String(answers.q_strength || ''),
      q_injury: String(answers.q_injury || ''),
      q_family: String(answers.q_family || ''),
      q_hypermobility: String(answers.q_hypermobility || ''),
      q_activity: String(answers.q_activity || ''),
      pillar_biology: String(pillarScores.biology || ''),
      pillar_movement: String(pillarScores.movement || ''),
      pillar_strength: String(pillarScores.strength || ''),
      pillar_history: String(pillarScores.history || ''),
      pillar_genetic: String(pillarScores.genetic || ''),
    };

    console.log('Sending row to SheetDB:', JSON.stringify(row));

    const sheetRes = await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: row }),
    });

    const sheetText = await sheetRes.text();
    console.log('SheetDB response status:', sheetRes.status);
    console.log('SheetDB response body:', sheetText);

    if (!sheetRes.ok) {
      console.error('SheetDB write failed:', sheetRes.status, sheetText);
      return err(`SheetDB error: ${sheetRes.status}`);
    }

    // Also write to Supabase if configured
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supRes = await fetch(`${SUPABASE_URL}/rest/v1/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            age: age ? parseInt(age) : null,
            sex: sex || null,
            knee_age: kneeAge ? parseInt(kneeAge) : null,
            score: score ? parseInt(score) : null,
            is_teen: !!isTeen,
          }),
        });
        console.log('Supabase response:', supRes.status);
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return ok('saved', { sheetdb: sheetText });

  } catch (e) {
    console.error('Complete function error:', e.message);
    return err(e.message);
  }
}
