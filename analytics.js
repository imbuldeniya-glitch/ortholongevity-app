/* ============================================================================
   kneeage.com — first-party funnel analytics + source attribution
   ----------------------------------------------------------------------------
   CONFIG — paste your IDs below. GA4 and Plausible ACTIVATE the moment their
   IDs are set (no redeploy of this logic needed, just the values).

     • GA4 + Plausible run COOKIELESS (GA4 in Consent Mode v2, analytics_storage
       denied). No consent banner is required for these two.
     • Meta Pixel and TikTok Pixel are scaffolded but INTENTIONALLY DORMANT —
       they are NOT loaded while their IDs are blank.

   ⚠️ COMPLIANCE: The moment you set META_PIXEL_ID or TIKTOK_PIXEL_ID, those are
   third-party advertising trackers and you MUST add a deny-by-default cookie
   consent banner (UK GDPR / PECR) and gate them behind opt-in BEFORE enabling.
   They are deliberately left off here so no banner is needed today.
   ============================================================================ */
window.KA_ANALYTICS_CONFIG = {
  GA4_MEASUREMENT_ID: 'G-M4G3F0VQGN',   // kneeage.com web stream (property: ice ortho - GA4)
  PLAUSIBLE_DOMAIN:   '',   // e.g. 'kneeage.com'   ← paste to activate Plausible (cookieless)
  META_PIXEL_ID:      '',   // OPTIONAL / LATER — leave blank. Needs consent banner before enabling.
  TIKTOK_PIXEL_ID:    ''    // OPTIONAL / LATER — leave blank. Needs consent banner before enabling.
};

(function () {
  var C = window.KA_ANALYTICS_CONFIG;

  /* ── 1. Capture UTM + referrer on first landing, persist for the session ── */
  var SS_KEY = 'ka_attribution';
  function buildAttribution() {
    try { var saved = sessionStorage.getItem(SS_KEY); if (saved) return JSON.parse(saved); } catch (e) {}
    var p = new URLSearchParams(location.search);
    var attr = {
      utm_source:   p.get('utm_source')   || '',
      utm_medium:   p.get('utm_medium')   || '',
      utm_campaign: p.get('utm_campaign') || '',
      utm_content:  p.get('utm_content')  || '',
      referrer:     document.referrer || '',
      landing_page: location.pathname,
      landing_ts:   new Date().toISOString()
    };
    // Derive a readable source when no UTM is present (so direct/organic is still attributable)
    if (!attr.utm_source) {
      if (attr.referrer) {
        try { attr.utm_source = 'referral:' + new URL(attr.referrer).hostname; } catch (e) { attr.utm_source = 'referral'; }
      } else {
        attr.utm_source = 'direct';
      }
    }
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(attr)); } catch (e) {}
    return attr;
  }
  var attribution = buildAttribution();
  // Exposed so the quiz/email flows can attach source to their server records
  window.KA_getAttribution = function () { return attribution; };

  /* ── 2. Load providers (only those with IDs configured) ── */
  var ga4Ready = false, plausibleReady = false;

  if (C.GA4_MEASUREMENT_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    // Consent Mode v2 — deny storage by default => cookieless pings, no banner needed
    gtag('consent', 'default', {
      ad_storage: 'denied', analytics_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('config', C.GA4_MEASUREMENT_ID, { anonymize_ip: true });
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA4_MEASUREMENT_ID);
    document.head.appendChild(g);
    ga4Ready = true;
  }

  if (C.PLAUSIBLE_DOMAIN) {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    var pl = document.createElement('script');
    pl.defer = true;
    pl.setAttribute('data-domain', C.PLAUSIBLE_DOMAIN);
    pl.src = 'https://plausible.io/js/script.tagged-events.js'; // auto pageviews + custom events
    document.head.appendChild(pl);
    plausibleReady = true;
  }

  /* Meta / TikTok: intentionally NOT loaded (no IDs, no consent banner).
     To enable later: add a deny-by-default consent banner, then on opt-in load
     fbevents.js (fbq init+PageView) and the TikTok pixel here, and add their
     calls to the track() fan-out below. */

  /* ── 3. Unified event API — fans out to every active provider, with source ── */
  function track(eventName, props) {
    props = props || {};
    var payload = {
      source:   attribution.utm_source,
      medium:   attribution.utm_medium,
      campaign: attribution.utm_campaign,
      content:  attribution.utm_content
    };
    for (var k in props) { if (props.hasOwnProperty(k)) payload[k] = props[k]; }

    if (ga4Ready && window.gtag) { try { gtag('event', eventName, payload); } catch (e) {} }
    if (plausibleReady && window.plausible) { try { window.plausible(eventName, { props: payload }); } catch (e) {} }
    // if (metaReady)  try { fbq('trackCustom', eventName, payload); } catch(e){}
    // if (tiktokReady) try { ttq.track(eventName, payload); } catch(e){}

    if (window.KA_DEBUG) console.log('[ka-track] ' + eventName, payload);
  }
  window.kaTrack = track;

  /* ── 4. landing_view fires on every page load ── */
  track('landing_view', { page: location.pathname });

  /* ── 5. consult_cta_click auto-wired for any book-a-consultation link ── */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim();
    if (/ortholongevity\.co\.uk\/book-an-appointment/i.test(href) ||
        /book\s*a\s*consultation/i.test(label)) {
      track('consult_cta_click', { href: href, label: label.slice(0, 60) });
    }
  }, true);
})();
