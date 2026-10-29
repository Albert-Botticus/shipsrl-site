// SRL Logistics site: mobile nav and the quote form.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  // The site is static, so the quote form posts to Formspree, which emails the
  // request to the SRL team inbox. If that fails, it falls back to opening the
  // visitor's email client with the same text.
  var FORM_ENDPOINT = 'https://formspree.io/f/mqpplker';
  var form = document.getElementById('quote-form');
  if (form) {
    var sending = false;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = document.getElementById('form-status');
      var button = form.querySelector('button[type="submit"]');
      var get = function (name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; };
      // One submission at a time: a second click while the first is in flight would
      // send a duplicate lead and burn a second Formspree submission.
      if (sending) return;
      // Honeypot: a real visitor never sees this field, so anything in it is a bot.
      // Reported as sent so the bot does not retry, but nothing is transmitted.
      if (get('_gotcha')) {
        if (status) status.textContent = 'Sent. We will reply shortly.';
        if (button) button.disabled = true;
        return;
      }
      if (!get('name') || !get('email')) {
        if (status) status.textContent = 'Please add your name and email so we can reply.';
        return;
      }
      var lines = [
        'Name: ' + get('name'),
        'Company: ' + get('company'),
        'Email: ' + get('email'),
        'Phone: ' + get('phone'),
        'SMS consent: ' + (form.elements['sms_consent'] && form.elements['sms_consent'].checked ? 'YES (consented to SMS on shipsrl.com)' : 'no'),
        'Origin: ' + get('origin'),
        'Destination: ' + get('destination'),
        'Equipment: ' + get('equipment'),
        'Ship date: ' + get('date'),
        '',
        'Details:',
        get('details')
      ];
      var subject = 'Quote request: ' + (get('origin') || 'origin') + ' to ' + (get('destination') || 'destination') + (get('company') ? ' (' + get('company') + ')' : '');
      var text = lines.join('\n');
      // Fallback only. It never claims the request was sent: the visitor is told it
      // did not go through and that their email app is opening with the same text.
      var fallback = function (reason) {
        sending = false;
        if (button) button.disabled = false;
        if (window.srlTrack) window.srlTrack('quote_submit_failed', { form: 'truckload', reason: reason });
        if (status) status.textContent = 'That did not go through. Opening your email app instead - or email SRLteam@armstrongtransport.com or call 614-855-9504.';
        window.location.href = 'mailto:SRLteam@armstrongtransport.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      };
      if (!FORM_ENDPOINT) return fallback('no_endpoint');
      sending = true;
      if (button) button.disabled = true;
      if (status) status.textContent = 'Sending...';
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ _subject: subject, email: get('email'), _replyto: get('email'), message: text, kind: 'TRUCKLOAD_QUOTE_REQUEST' })
      }).then(function (res) {
        if (!res.ok) throw new Error('http_' + res.status);
        // Success is only ever declared here, after Formspree accepts the POST.
        sending = false;
        if (status) status.textContent = 'Sent. We will reply to ' + get('email') + ' shortly.';
        if (button) button.disabled = true;
        if (window.srlTrack) window.srlTrack('truckload_quote_submitted', { form: 'truckload' });
      }).catch(function (err) {
        var reason = String(err && err.message || '').indexOf('http_') === 0 ? err.message : 'network';
        fallback(reason);
      });
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
