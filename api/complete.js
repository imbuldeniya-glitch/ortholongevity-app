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

  // ── Blank-row guard (added 27 Aug 2026) ───────────────────────────────────
  // There was no method check, so a bare GET from a crawler wrote an empty row.
  // 15 such rows accumulated between 3 Apr and 27 Aug. Anything that is not a
  // POST carrying a genuine completion is now rejected before any write.
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
    // A real completion always carries a result_id and an age. Without both this
    // is not a quiz completion and must not become a row.
    const hasResultId = typeof body.result_id === 'string' && /^ka-[A-Za-z0-9-]{8,64}$/.test(body.result_id);
    const hasAge = body.age !== undefined && body.age !== null && body.age !== '' && Number.isFinite(Number(body.age));
    if (!hasResultId || !hasAge) {
      return new Response(JSON.stringify({ success: false, msg: 'incomplete payload' }), { status: 400, headers: corsHeaders });
    }

    const {
      result_id = '',
      email = '',
      age = '',
      sex = '',
      kneeAge = '',
      score = '',
      isTeen = false,
      ageGap = '',
      answers = {},
      pillarScores = {},
      domains = {},
      attribution = {}
    } = body;
    const attr = attribution || {};
    const SHEETDB_URL = process.env.SHEETDB_URL;
    if (!SHEETDB_URL) return err('SHEETDB_URL not configured');
    const getBio = function() { if (pillarScores.biology !== undefined) return pillarScores.biology; if (pillarScores.bio !== undefined) return pillarScores.bio; if (domains.bio !== undefined) return domains.bio; return ''; };
    const getMove = function() { if (pillarScores.movement !== undefined) return pillarScores.movement; if (pillarScores.move !== undefined) return pillarScores.move; if (domains.move !== undefined) return domains.move; return ''; };
    const getStrength = function() { if (pillarScores.strength !== undefined) return pillarScores.strength; if (domains.strength !== undefined) return domains.strength; return ''; };
    const getInjury = function() { if (pillarScores.history !== undefined) return pillarScores.history; if (domains.injury !== undefined) return domains.injury; return ''; };
    const getGenetic = function() { if (pillarScores.genetic !== undefined) return pillarScores.genetic; if (domains.genetic !== undefined) return domains.genetic; return ''; };
    const row = {
      timestamp: new Date().toISOString(),
      result_id: String(result_id),
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
      pillar_bio: String(getBio()),
      pillar_move: String(getMove()),
      pillar_strength: String(getStrength()),
      pillar_injury: String(getInjury()),
      pillar_geneti: String(getGenetic()),
      utm_source: String(attr.utm_source || ''),
      utm_medium: String(attr.utm_medium || ''),
      utm_campaign: String(attr.utm_campaign || ''),
      utm_content: String(attr.utm_content || ''),
      referrer: String(attr.referrer || ''),
    };
    const sheetRes = await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: row }),
    });
    const sheetText = await sheetRes.text();
    if (!sheetRes.ok) return err('SheetDB error: ' + sheetRes.status);
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(SUPABASE_URL + '/rest/v1/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            age: age ? parseInt(age) : null,
            sex: sex || null,
            knee_age: kneeAge ? parseInt(kneeAge) : null,
            score: score ? parseInt(score) : null,
            is_teen: !!isTeen,
            utm_source: attr.utm_source || null,
            utm_medium: attr.utm_medium || null,
            utm_campaign: attr.utm_campaign || null,
            utm_content: attr.utm_content || null,
            referrer: attr.referrer || null,
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
