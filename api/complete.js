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
      pillarScores = {},
      domains = {}
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
      q_metabolic: String(answers.metabolic || ''),
      q_nutrition: String(answers.nutrition || ''),
      q_sleep: String(answers.sleep || ''),
      q_stiffness: String(answers.stiffness || ''),
      q_sitting: String(answers.sitting || ''),
      q_strength: String(answers.strength || ''),
      q_sit_stand: String(answers.sit_stand || ''),
      q_pain: String(answers.pain || ''),
      q_injury: String(answers.injury || ''),
      q_family: String(answers.family || ''),
      q_hypermobility: String(answers.hypermobility || ''),
      q_menopause: String(answers.menopause || ''),
      q_sport_load: String(answers.sport_load || ''),
      q_teen_hormonal: String(answers.teen_hormonal || ''),
      pillar_bio: String((pillarScores.biology ?? pillarScores.bio ?? domains.bio) ?? ''),
      pillar_move: String((pillarScores.movement ?? pillarScores.move ?? domains.move) ?? ''),
      pillar_strength: String(pillarScores.strength ?? domains.strength ?? ''),
      pillar_injury: String(pillarScores.history ?? domains.injury ?? ''),
      pillar_geneti: String(pillarScores.genetic ?? domains.genetic ?? ''),
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
