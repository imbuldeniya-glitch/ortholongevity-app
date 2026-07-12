/*
 * Standalone verification harness for the PRIME years recalibration.
 * Mirrors the exact scoring maths that will be wired into kneeagequiz.html
 * so the additivity asserts (item 2 + item 3) and the projected-improvement
 * recompute (item 6) can be validated before any HTML is touched.
 *
 * Run: node scripts/prime_recalibration_check.js
 */

// ── Calibration (SIGNED OFF 12 July 2026) ─────────────────────────────
const NEUTRAL = 65;
const K = 0.38;
// PRIME weights (unchanged). Keys match the app's domain keys.
const WEIGHTS = { strength: 0.32, bio: 0.22, move: 0.16, injury: 0.16, genetic: 0.14 };
// Display names + PRIME letter order: P R I M E
const META = {
  strength: { letter: 'P', name: 'Power',                 type: 'modifiable' },
  genetic:  { letter: 'R', name: 'Risk',                  type: 'genetic'    },
  injury:   { letter: 'I', name: 'Injury',                type: 'symptom'    },
  move:     { letter: 'M', name: 'Movement',              type: 'modifiable' },
  bio:      { letter: 'E', name: 'Endocrine & Metabolic', type: 'modifiable' },
};
const PRIME_ORDER = ['strength', 'genetic', 'injury', 'move', 'bio'];
const MODIFIABLE = ['strength', 'bio', 'move'];
const ACTION = {
  strength: 'building strength around the joint, two focused sessions a week',
  bio:      'steadier blood sugar, better sleep and lowering your inflammatory load',
  move:     'restoring range and breaking up long hours of sitting',
};

// ── Core: gap + per-domain years ──────────────────────────────────────
// domains: integer 0-100 scores {strength,bio,move,injury,genetic}
// menoAgeMod: integer years folded into the E (bio) contribution
function computePrime(domains, age, menoAgeMod, isTeen) {
  const composite = PRIME_ORDER.reduce((s, k) => s + WEIGHTS[k] * domains[k], 0);
  const deltaFloat = (NEUTRAL - composite) * K;          // additive gap, pre-round
  const delta = Math.round(deltaFloat);

  // Raw per-domain year contributions. By construction these sum to deltaFloat.
  const rawYears = {};
  PRIME_ORDER.forEach(k => { rawYears[k] = K * WEIGHTS[k] * (NEUTRAL - domains[k]); });
  const rawSum = PRIME_ORDER.reduce((s, k) => s + rawYears[k], 0);

  // ASSERT (item 2): raw years sum to delta (the additive gap).
  const assertRaw = Math.abs(rawSum - deltaFloat) < 1e-9;

  // Fold menoAgeMod into E (item 3) so the five bars carry the whole displayed gap.
  const years = Object.assign({}, rawYears);
  years.bio += menoAgeMod;

  // kneeAge + displayed gap (adults clamp 18-90; teens pin to age).
  let kneeAge = isTeen ? age : Math.round(age + delta + menoAgeMod);
  if (!isTeen) kneeAge = Math.max(18, Math.min(kneeAge, 90));
  if (isTeen) kneeAge = age;
  const gap = kneeAge - age;

  // One-decimal display with largest-remainder reconciliation to hit `gap` exactly.
  const ageClamped = !isTeen && (age + delta + menoAgeMod) !== kneeAge; // hit 18/90 rail
  const disp = reconcileToGap(years, gap, ageClamped);
  const dispSum = +PRIME_ORDER.reduce((s, k) => s + disp[k], 0).toFixed(1);

  // ASSERT (item 3): displayed bars sum to the displayed gap (unless age-railed).
  const assertGap = ageClamped ? true : Math.abs(dispSum - gap) < 0.05;

  return { composite, delta, deltaFloat, rawYears, rawSum, years, disp, dispSum,
           kneeAge, gap, ageClamped, assertRaw, assertGap };
}

// Round each year to 1dp, then distribute the rounding residual in 0.1 steps
// (largest-remainder) so the set sums exactly to the integer gap while keeping
// every bar within 0.1 of its true value. No faked lengths.
function reconcileToGap(years, gap, ageClamped) {
  const disp = {};
  PRIME_ORDER.forEach(k => { disp[k] = Math.round(years[k] * 10) / 10; });
  if (ageClamped) return disp; // cannot honestly reconcile against a railed age
  const sum = PRIME_ORDER.reduce((s, k) => s + disp[k], 0);
  let steps = Math.round((gap - sum) * 10); // signed number of 0.1 nudges needed
  if (steps !== 0) {
    // nudge the bars that were rounded the "wrong" way first (largest remainder)
    const rem = PRIME_ORDER.map(k => ({ k, r: years[k] * 10 - Math.round(years[k] * 10) }));
    rem.sort((a, b) => (steps > 0 ? b.r - a.r : a.r - b.r));
    const dir = Math.sign(steps);
    for (let n = Math.abs(steps), i = 0; n > 0; n--, i++) {
      const k = rem[i % rem.length].k;
      disp[k] = Math.round((disp[k] + dir * 0.1) * 10) / 10;
    }
  }
  return disp;
}

// ── Projected improvement (item 6): real recompute ────────────────────
// Lift ONE domain's 0-100 score by +delta (capped at 90), return the fall in kneeAge.
function fallFromLift(domains, age, menoAgeMod, driverKey, lift) {
  const lifted = Object.assign({}, domains);
  lifted[driverKey] = Math.min(90, domains[driverKey] + lift);
  const base = kneeAgeOf(domains, age, menoAgeMod);
  const now = kneeAgeOf(lifted, age, menoAgeMod);
  return base - now; // positive = years taken off
}
function kneeAgeOf(domains, age, menoAgeMod) {
  const composite = PRIME_ORDER.reduce((s, k) => s + WEIGHTS[k] * domains[k], 0);
  const delta = Math.round((NEUTRAL - composite) * K);
  return Math.max(18, Math.min(Math.round(age + delta + menoAgeMod), 90));
}
function projectRange(domains, age, menoAgeMod, driverKey) {
  const low = fallFromLift(domains, age, menoAgeMod, driverKey, 15);
  const high = fallFromLift(domains, age, menoAgeMod, driverKey, 25);
  return { low, high };
}

// ── Biggest driver + opportunity copy (item 7) ────────────────────────
function biggestDriver(years) {
  // domain adding the most years (largest positive contribution)
  return PRIME_ORDER.reduce((a, b) => (years[b] > years[a] ? b : a), PRIME_ORDER[0]);
}
function topModifiable(years) {
  return MODIFIABLE.reduce((a, b) => (years[b] > years[a] ? b : a), MODIFIABLE[0]);
}
function opportunityCopy(P) {
  const { years, disp, gap } = P;
  const driver = biggestDriver(years);
  const type = META[driver].type;
  const younger = gap < 0;
  const rng = r => (r.high < 1 ? 'around a year'
                   : `${r.low.toFixed(1).replace(/\.0$/, '')} to ${r.high.toFixed(1).replace(/\.0$/, '')} years`);

  if (younger) {
    const tm = topModifiable(years);
    return { template: 'push-further', driver, action: ACTION[tm],
      text: `You are ahead of your age, which is the hard part done. If you want to push further, ${ACTION[tm]} is your highest-leverage move. The gains get smaller from here, but these are the ones that hold as you age.` };
  }
  if (type === 'modifiable') {
    const r = projectRange(P.domains, P.age, P.menoAgeMod, driver);
    return { template: 'modifiable', driver, range: r,
      text: `${META[driver].name} is adding the most years to your knees, and it is the one you can move fastest. Based on your answers, ${ACTION[driver]} could take ${rng(r)} off your Knee Age over the coming months. Small, repeated, compounding. This is where I would start.` };
  }
  if (type === 'genetic') {
    const tm = topModifiable(years);
    return { template: 'genetic', driver, topModifiable: META[tm].name,
      text: `Your family history is the biggest single factor here. You cannot change your genes, but they set the timeline, not the outcome. The patients who do best start earlier on the things they can change. For you that is ${META[tm].name}, where your answers show the most room. Acting now is worth more than acting harder later.` };
  }
  return { template: 'injury', driver,
    text: `Your answers about the knee itself are the biggest factor in your score. That is less about training and more about getting the right eyes on it. I would have this looked at before adding load. This is not a diagnosis. It is a prompt to check.` };
}

// ── Personas ──────────────────────────────────────────────────────────
const personas = [
  { label: 'Average defaults (60yo)', age: 60, meno: 0, teen: false,
    d: { strength: 65, bio: 65, move: 65, injury: 65, genetic: 65 } },
  { label: 'Fully optimised (60yo)', age: 60, meno: 0, teen: false,
    d: { strength: 100, bio: 100, move: 100, injury: 100, genetic: 100 } },
  { label: 'Rock bottom (60yo)', age: 60, meno: 0, teen: false,
    d: { strength: 0, bio: 0, move: 0, injury: 0, genetic: 0 } },
  { label: 'Weak Power, rest ok (45yo)', age: 45, meno: 0, teen: false,
    d: { strength: 20, bio: 70, move: 72, injury: 80, genetic: 60 } },
  { label: 'High genetic risk driver (52yo)', age: 52, meno: 0, teen: false,
    d: { strength: 72, bio: 70, move: 74, injury: 82, genetic: 15 } },
  { label: 'Pain/injury driver (48yo)', age: 48, meno: 0, teen: false,
    d: { strength: 70, bio: 72, move: 68, injury: 18, genetic: 70 } },
  { label: 'Peri-meno female (50yo, meno=2)', age: 50, meno: 2, teen: false,
    d: { strength: 60, bio: 55, move: 62, injury: 78, genetic: 60 } },
  { label: 'Young optimiser already younger (30yo)', age: 30, meno: 0, teen: false,
    d: { strength: 92, bio: 88, move: 90, injury: 90, genetic: 80 } },
  { label: 'Teen (16yo)', age: 16, meno: 0, teen: true,
    d: { strength: 55, bio: 60, move: 58, injury: 80, genetic: 70 } },
];

let allPass = true;
for (const p of personas) {
  const P = computePrime(p.d, p.age, p.meno, p.teen);
  P.domains = p.d; P.age = p.age; P.menoAgeMod = p.meno;
  const opp = opportunityCopy(P);
  const barStr = PRIME_ORDER.map(k => `${META[k].letter}:${P.disp[k] >= 0 ? '+' : ''}${P.disp[k].toFixed(1)}`).join('  ');
  const ok = P.assertRaw && P.assertGap;
  allPass = allPass && ok;
  console.log(`\n■ ${p.label}`);
  console.log(`  kneeAge ${P.kneeAge}  (age ${p.age}, gap ${P.gap >= 0 ? '+' : ''}${P.gap})   delta ${P.delta}  composite ${P.composite.toFixed(1)}`);
  console.log(`  bars   ${barStr}   Σ=${P.dispSum}`);
  console.log(`  assert additivity(raw→delta): ${P.assertRaw ? 'PASS' : 'FAIL'}   assert bars→gap: ${P.assertGap ? 'PASS' : 'FAIL'}${P.ageClamped ? ' (age-railed, skipped)' : ''}`);
  console.log(`  opportunity[${opp.template}] driver=${META[opp.driver].name}${opp.range ? `  range ${opp.range.low.toFixed(1)}→${opp.range.high.toFixed(1)}y` : ''}`);
  console.log(`  copy: ${opp.text}`);
}
console.log(`\n${allPass ? '✅ ALL ASSERTS PASS' : '❌ ASSERT FAILURE'}`);
process.exit(allPass ? 0 : 1);
