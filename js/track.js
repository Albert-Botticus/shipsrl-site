// Conversion tracking, deliberately provider-agnostic and privacy-first.
//
// Why it looks like this: the site is static and has no analytics account wired up
// yet, so this records WHAT happened and never WHO it happened to. It sends an
// event name and, at most, a coarse lane (state-level) - never a name, email,
// phone, company, address, zip, weight, or any other form content.
//
// To switch it on, add ONE provider to the pages (see README "Conversion tracking"):
//   - Google Analytics 4: add the gtag.js snippet; this file will call gtag().
//   - Plausible / Fathom: add their script tag; this file will call plausible().
//   - Google Tag Manager: add the GTM snippet; this file pushes to window.dataLayer.
// With no provider present, every call is a silent no-op, so nothing breaks and
// nothing is transmitted.
(function () {
  var EVENTS = {
    truckload_quote_submitted: 'Truckload quote submitted',
    ltl_quote_submitted: 'LTL quote submitted',
    quote_submit_failed: 'Quote submit failed',
    // Funnel and secondary-conversion events (2026-11-09): started = first keystroke in a
    // quote form; phone_click = a tap on a tel: link (the other way people convert).
    truckload_form_started: 'Truckload form started',
    ltl_form_started: 'LTL form started',
    phone_click: 'Phone number clicked'
  };

  // Only these keys are ever allowed to leave the page. No free text, no contact data.
  function clean(props) {
    var safe = {};
    if (!props) return safe;
    if (props.form === 'truckload' || props.form === 'ltl') safe.form = props.form;
    // Coarse reason for a failure, e.g. "http_429" or "network" - never a message body.
    if (typeof props.reason === 'string' && /^[a-z0-9_]{1,24}$/.test(props.reason)) safe.reason = props.reason;
    return safe;
  }

  window.srlTrack = function (event, props) {
    if (!EVENTS[event]) return;
    var payload = clean(props);
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', event, payload);
      } else if (typeof window.plausible === 'function') {
        window.plausible(EVENTS[event], { props: payload });
      } else if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(Object.assign({ event: event }, payload));
      }
    } catch (err) {
      // Analytics must never break a quote submission.
    }
  };

  // Any link marked data-track="phone_click" (or another whitelisted event name) reports
  // the click. Only names in EVENTS are accepted, so markup cannot invent events.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-track]') : null;
    if (!a) return;
    var name = a.getAttribute('data-track');
    if (EVENTS[name]) window.srlTrack(name, { form: document.getElementById('ltl-form') ? 'ltl' : 'truckload' });
  });

  // Lead attribution (added 2026-11-03). Remembers how the visitor arrived so a
  // quote request can say "Google Ads, search campaign" instead of leaving us to
  // guess. Captures only ad/campaign identifiers from the URL (gclid, gbraid,
  // wbraid, utm_*), the referring site, and the first page viewed - nothing about
  // the person. Kept in sessionStorage so it survives Home -> LTL Quote navigation
  // within one visit, and in localStorage (90 days) so a return visit still shows
  // the original ad click. Storage can be blocked; every access is guarded.
  var ATTR_KEY = 'srl_attribution';
  var ATTR_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  var AD_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function readStore(store) {
    try { var raw = store.getItem(ATTR_KEY); return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
  }
  function writeStore(store, value) {
    try { store.setItem(ATTR_KEY, JSON.stringify(value)); } catch (err) { /* storage blocked */ }
  }
  function fromUrl() {
    var out = {};
    var found = false;
    try {
      var q = window.location.search.replace(/^\?/, '').split('&');
      for (var i = 0; i < q.length; i++) {
        var kv = q[i].split('=');
        var k = decodeURIComponent(kv[0] || '').toLowerCase();
        if (AD_PARAMS.indexOf(k) === -1) continue;
        var v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')).slice(0, 200);
        if (v) { out[k] = v; found = true; }
      }
    } catch (err) { /* malformed query */ }
    return found ? out : null;
  }
  function describe(a) {
    if (!a) return 'unknown';
    // utm_term is filled by the Google Ads {keyword} tag on every ad click, so this reads
    // "Google Ads | keyword: ltl freight quote (ltl-ohio-search)".
    if (a.gclid || a.gbraid || a.wbraid) return 'Google Ads' + (a.utm_term ? ' | keyword: ' + a.utm_term : '') + (a.utm_campaign ? ' (' + a.utm_campaign + ')' : '');
    if (a.msclkid) return 'Microsoft Ads';
    if (a.fbclid) return 'Facebook';
    if (a.utm_source) return a.utm_source + (a.utm_medium ? ' / ' + a.utm_medium : '') + (a.utm_campaign ? ' (' + a.utm_campaign + ')' : '');
    if (a.referrer) {
      var host = a.referrer.replace(/^https?:\/\//, '').split('/')[0];
      if (/(^|\.)google\./.test(host)) return 'Google organic search';
      if (/(^|\.)bing\.com$/.test(host)) return 'Bing organic search';
      return 'Referral from ' + host;
    }
    return 'Direct (typed the address or used a bookmark)';
  }

  function capture() {
    var now = Date.now();
    var params = fromUrl();
    var session = readStore(window.sessionStorage);
    var stored = readStore(window.localStorage);
    if (stored && (!stored.at || now - stored.at > ATTR_TTL_MS)) stored = null;

    var referrer = '';
    try { referrer = (document.referrer || '').slice(0, 200); } catch (err) { /* ignore */ }
    var isInternal = referrer && referrer.indexOf(window.location.host) !== -1;

    // A new ad click always starts a fresh record. Otherwise the first thing we
    // learned about this visitor wins: a stored ad click from an earlier visit
    // beats a plain return visit, and only a brand-new visitor gets a new record.
    if (params || (!session && !stored && !isInternal)) {
      var fresh = Object.assign({}, params || {}, {
        referrer: isInternal ? '' : referrer,
        landing_page: window.location.pathname,
        at: now
      });
      fresh.source = describe(fresh);
      writeStore(window.sessionStorage, fresh);
      writeStore(window.localStorage, fresh);
      session = fresh;
    }
    if (!session && stored) { session = stored; writeStore(window.sessionStorage, stored); }
    return session;
  }

  var current = null;
  try { current = capture(); } catch (err) { current = null; }

  // Returns a small object for the quote forms to include with the request.
  window.srlAttribution = function () {
    var a = current || readStore(window.sessionStorage) || readStore(window.localStorage);
    if (!a) return { source: 'unknown' };
    var out = { source: a.source || describe(a), landing_page: a.landing_page || '', referrer: a.referrer || '', first_seen: a.at ? new Date(a.at).toISOString() : '' };
    for (var i = 0; i < AD_PARAMS.length; i++) if (a[AD_PARAMS[i]]) out[AD_PARAMS[i]] = a[AD_PARAMS[i]];
    return out;
  };
})();
