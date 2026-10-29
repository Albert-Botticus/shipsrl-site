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
    quote_submit_failed: 'Quote submit failed'
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
})();
