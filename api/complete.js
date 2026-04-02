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
    if (!SHEETDB_URL) return err('SHEETDB_URL not configured');

    const row = {
      timestamp: new Date().toISOString(),
      email: String(email),
      age: String(age),
      sex: String(sex),
      knee_age: String(kneeAge),
      score: String(score),
      age_gap: String(ageGap),
      is_teen: String(isTeen),
      q_metabolic: String(answers.q_metabolic || answers.q_weight || ''),
      q_nutrition: String(answers.q_nutrition || answers.q_diet || ''),
      q_sleep: String(answers.q_sleep || ''),
      q_stiffness: String(answers.q_stiffness || ''),
      q_sitting: String(answers.q_sitting || ''),
      q_strength: String(answers.q_strength || ''),
      q_sit_stand: String(answers.q_sit_stand || ''),
      q_pain: String(answers.q_pain || ''),
      q_injury: String(answers.q_injury || ''),
      q_family: String(answers.q_family || ''),
      q_hypermobility: String(answers.q_hypermobility || ''),
      q_menopause: String(answers.q_menopause || ''),
      q_sport_load: String(answers.q_sport_load || answers.q_activity || ''),
      q_teen_hormonal: String(answers.q_teen_hormonal || ''),
      pillar_bio: String(pillarScores.biology || pillarScores.bio || ''),
      pillar_move: String(pillarScores.movement || pillarScores.move || ''),
      pillar_strength: String(pillarScores.strength || ''),
      pillar_injury: String(pillarScores.history || pillarScores.injury || ''),
      pillar_geneti: String(pillarScores.genetic || pillarScores.geneti || ''),
    };

    const sheetRes = await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: row }),
    });

    const sheetText = await sheetRes.text();
    if (!sheetRes.ok) return err(`SheetDB error: ${sheetRes.status}`);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/completions`, {
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
