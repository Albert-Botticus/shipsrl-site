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
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = document.getElementById('form-status');
      var get = function (name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; };
      if (!get('name') || !get('email')) {
        if (status) status.textContent = 'Please add your name and email so we can reply.';
        return;
      }
      var lines = [
        'Name: ' + get('name'),
        'Company: ' + get('company'),
        'Email: ' + get('email'),
        'Phone: ' + get('phone'),
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
      var fallback = function () {
        window.location.href = 'mailto:SRLteam@armstrongtransport.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
        if (status) status.textContent = 'Your email app should open with the request filled in. If it does not, email SRLteam@armstrongtransport.com or call 614-855-9504.';
      };
      if (!FORM_ENDPOINT) return fallback();
      if (status) status.textContent = 'Sending...';
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ _subject: subject, email: get('email'), _replyto: get('email'), message: text, kind: 'TRUCKLOAD_QUOTE_REQUEST' })
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (status) status.textContent = 'Sent. We will reply to ' + get('email') + ' shortly.';
        form.querySelector('button[type="submit"]').disabled = true;
      }).catch(fallback);
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
