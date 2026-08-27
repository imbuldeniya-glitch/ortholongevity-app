// api/subscribe.js
// Vercel Edge Function — adds/updates a Kit subscriber on form 9207706 with the
// quiz result as custom fields, plus numeric tag IDs.
//
// Set KIT_API_KEY in Vercel environment variables.
//
// ── Why this was rewritten (27 Aug 2026) ────────────────────────────────────
// Kit received nothing but email addresses for five months. Three faults:
//   1. WRONG HOST. The v3 call was sent to https://api.kit.com/v3/... but v3
//      lives on https://api.convertkit.com/v3/. api.kit.com only serves v4.
//      Every API call therefore failed, silently, and execution fell through to
//      the public form endpoint below — which accepts ONLY email_address. That
//      is precisely why 239 subscribers exist with every custom field null.
//   2. TAGS BY NAME. Kit v3 wants numeric tag IDs, not names. (The name being
//      sent, 'knee-age-quiz-completed', does not exist in the account either.)
//   3. SILENT FAILURE. `if (res.ok) return ok();` discarded the status and body
//      on failure, so nothing was ever logged. Now every failure is
//      console.error'd with the real status and response body.
// The user still always gets a 200 — the journey is never broken by Kit.

export const config = { runtime: 'edge' };

const FORM_ID = '9207706';                       // "OrthoLongevity Wait list"

// Numeric Kit tag IDs (created 27 Aug 2026). Names are for readability only —
// Kit is addressed by ID.
const TAG = {
  quiz:        22801320,  // knee-age-quiz         — every subscriber
  older:       22801321,  // knees-older           — knee_age > age
  same:        22801322,  // knees-same            — knee_age == age
  younger:     22801323,  // knees-younger         — knee_age < age
  menoFemale:  22801324,  // menopause-age-female  — female AND age 45–60
  unlocked:    22801325,  // unlocked-full-report  — reached the full report
};

// Derive tag IDs from the result. Server-side so there is one source of truth.
function tagsFor({ kneeAge, age, sex, unlocked }) {
  const t = [TAG.quiz];
  const ka = Number(kneeAge);
  const ag = Number(age);
  if (Number.isFinite(ka) && Number.isFinite(ag)) {
    if (ka > ag) t.push(TAG.older);
    else if (ka < ag) t.push(TAG.younger);
    else t.push(TAG.same);
  }
  const s = String(sex || '').trim().toLowerCase();
  if (s === 'female' && Number.isFinite(ag) && ag >= 45 && ag <= 60) t.push(TAG.menoFemale);
  if (unlocked) t.push(TAG.unlocked);
  return t;
}

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

  // Always 200 to the browser — Kit problems must never break the user journey.
  const ok = (detail) => new Response(JSON.stringify({ success: true, ...(detail || {}) }), {
    status: 200, headers: corsHeaders
  });

  try {
    if (req.method !== 'POST') return ok({ skipped: 'method' });

    const body = await req.json().catch(() => ({}));
    const { email, kneeAge, score, age, sex, resultId, unlocked } = body;
    const attr = body.attribution || {};

    if (!email || !String(email).includes('@')) return ok({ skipped: 'email' });

    // age_gap = knee_age - chronological age. Negative means younger knees.
    // Was never sent at all before today.
    const ka = Number(kneeAge), ag = Number(age);
    const ageGap = (Number.isFinite(ka) && Number.isFinite(ag)) ? String(ka - ag) : '';

    const fields = {
      knee_age:     Number.isFinite(ka) ? String(ka) : '',
      knee_score:   (score === 0 || score) ? String(score) : '',
      age_gap:      ageGap,
      result_id:    resultId ? String(resultId) : '',
      source:       'knee-age-quiz',
      utm_source:   attr.utm_source   || '',
      utm_medium:   attr.utm_medium   || '',
      utm_campaign: attr.utm_campaign || '',
      utm_content:  attr.utm_content  || '',
      referrer:     attr.referrer     || '',
    };

    const tagIds = tagsFor({ kneeAge, age, sex, unlocked });
    const KIT_API_KEY = process.env.KIT_API_KEY;

    if (!KIT_API_KEY) {
      // Loud, because this is the difference between a tagged subscriber and a
      // bare email address. Deliberately not fatal to the user.
      console.error('[kit] KIT_API_KEY is NOT SET in this environment — falling back to the public form endpoint, which stores email only. No custom fields, no tags.');
    } else {
      // ── Attempt 1: Kit API v3 on its correct host ──────────────────────────
      // One call subscribes to the form, sets custom fields and applies tags.
      try {
        const res = await fetch(`https://api.convertkit.com/v3/forms/${FORM_ID}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: KIT_API_KEY, email, fields, tags: tagIds }),
        });
        if (res.ok) return ok({ via: 'v3', tags: tagIds, age_gap: ageGap });
        const detail = await res.text().catch(() => '<unreadable body>');
        console.error(`[kit] v3 subscribe FAILED status=${res.status} body=${detail.slice(0, 800)}`);
      } catch (e) {
        console.error('[kit] v3 subscribe threw:', e && e.message);
      }

      // ── Attempt 2: Kit API v4 ─────────────────────────────────────────────
      // Used when KIT_API_KEY turns out to be a v4 key (v4 keys are issued
      // separately from v3 keys and are rejected by v3, and vice versa).
      // v4 needs three calls: upsert subscriber, join form, apply each tag.
      try {
        const h = { 'Content-Type': 'application/json', 'X-Kit-Api-Key': KIT_API_KEY };
        const sub = await fetch('https://api.kit.com/v4/subscribers', {
          method: 'POST', headers: h,
          body: JSON.stringify({ email_address: email, fields }),
        });
        if (!sub.ok) {
          const detail = await sub.text().catch(() => '<unreadable body>');
          console.error(`[kit] v4 subscriber upsert FAILED status=${sub.status} body=${detail.slice(0, 800)}`);
        } else {
          await fetch(`https://api.kit.com/v4/forms/${FORM_ID}/subscribers`, {
            method: 'POST', headers: h,
            body: JSON.stringify({ email_address: email }),
          }).then(async (r) => {
            if (!r.ok) console.error(`[kit] v4 form join FAILED status=${r.status} body=${(await r.text().catch(() => '')).slice(0, 400)}`);
          }).catch((e) => console.error('[kit] v4 form join threw:', e && e.message));

          for (const id of tagIds) {
            await fetch(`https://api.kit.com/v4/tags/${id}/subscribers`, {
              method: 'POST', headers: h,
              body: JSON.stringify({ email_address: email }),
            }).then(async (r) => {
              if (!r.ok) console.error(`[kit] v4 tag ${id} FAILED status=${r.status} body=${(await r.text().catch(() => '')).slice(0, 400)}`);
            }).catch((e) => console.error(`[kit] v4 tag ${id} threw:`, e && e.message));
          }
          return ok({ via: 'v4', tags: tagIds, age_gap: ageGap });
        }
      } catch (e) {
        console.error('[kit] v4 path threw:', e && e.message);
      }
    }

    // ── Fallback: Kit public form endpoint — email only, no key needed ───────
    // Retained so a subscriber is never lost, but it CANNOT carry fields/tags.
    try {
      const r = await fetch(`https://app.kit.com/forms/${FORM_ID}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email_address=${encodeURIComponent(email)}`,
      });
      if (!r.ok) {
        console.error(`[kit] public form FAILED status=${r.status} body=${(await r.text().catch(() => '')).slice(0, 400)}`);
      } else {
        console.error('[kit] DEGRADED: subscriber saved via public form endpoint — email only, no custom fields and no tags.');
      }
    } catch (e) {
      console.error('[kit] public form threw:', e && e.message);
    }

    return ok({ via: 'public-form-fallback' });

  } catch (err) {
    console.error('[kit] handler error:', err && err.message);
    return ok({ error: 'handled' }); // Always 200 — never break the user journey.
  }
}
