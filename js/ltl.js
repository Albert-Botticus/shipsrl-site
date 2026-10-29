// LTL quote form: repeatable item rows, running totals, and a structured
// submission that Albert (SRL's automation) can parse without guessing.
//
// Delivery: set FORM_ENDPOINT to a form-to-email service URL (Formspree, Basin,
// or similar) and the request is POSTed as JSON plus a plain-text copy. Until
// then the form falls back to opening the visitor's email app with the same
// text, addressed to the SRL team inbox.
(function () {
  var FORM_ENDPOINT = 'https://formspree.io/f/mqpplker';
  var TO_ADDRESS = 'SRLteam@armstrongtransport.com';

  var form = document.getElementById('ltl-form');
  if (!form) return;
  var items = document.getElementById('items');
  var template = document.getElementById('item-template');
  var totals = document.getElementById('totals');

  function renumber() {
    items.querySelectorAll('.item').forEach(function (item, index) {
      item.querySelector('.n').textContent = String(index + 1);
      item.querySelector('.remove').style.visibility = items.children.length > 1 ? 'visible' : 'hidden';
    });
    recalc();
  }

  function addItem() {
    var node = template.content.cloneNode(true);
    items.appendChild(node);
    var item = items.lastElementChild;
    item.querySelector('.remove').addEventListener('click', function () { item.remove(); renumber(); });
    item.querySelectorAll('input, select').forEach(function (el) { el.addEventListener('input', recalc); });
    renumber();
  }

  function num(el) { var v = parseFloat(el && el.value); return isNaN(v) ? 0 : v; }

  function itemRows() {
    return Array.prototype.map.call(items.querySelectorAll('.item'), function (item) {
      var f = function (name) { return item.querySelector('[name="' + name + '"]'); };
      var units = num(f('item_units'));
      var L = num(f('item_length')), W = num(f('item_width')), H = num(f('item_height'));
      var weight = num(f('item_weight'));
      var cubic = L && W && H ? (L * W * H / 1728) * units : 0;
      return {
        units: units,
        unit_type: f('item_unit_type').value,
        pieces: f('item_pieces').value,
        weight_lb: weight,
        length_in: L, width_in: W, height_in: H,
        freight_class: f('item_class').value || 'Not sure',
        nmfc: f('item_nmfc').value.trim(),
        description: f('item_description').value.trim(),
        cubic_feet: cubic ? Math.round(cubic * 10) / 10 : null,
        pcf: cubic ? Math.round((weight / cubic) * 10) / 10 : null
      };
    });
  }

  function recalc() {
    var rows = itemRows();
    var weight = rows.reduce(function (s, r) { return s + r.weight_lb; }, 0);
    var cubic = rows.reduce(function (s, r) { return s + (r.cubic_feet || 0); }, 0);
    var units = rows.reduce(function (s, r) { return s + r.units; }, 0);
    var text = 'Total: ' + units + ' handling unit' + (units === 1 ? '' : 's') + ', ' + weight + ' lb';
    if (cubic) text += ', ' + (Math.round(cubic * 10) / 10) + ' cu ft, ' + (Math.round((weight / cubic) * 10) / 10) + ' PCF';
    totals.textContent = text;
  }

  var hazToggle = document.getElementById('hazmat-toggle');
  var hazFields = document.getElementById('hazmat-fields');
  hazToggle.addEventListener('change', function () { hazFields.classList.toggle('hidden', !hazToggle.checked); });

  document.getElementById('add-item').addEventListener('click', addItem);
  addItem();

  // Default ship date: next business day.
  var ship = document.getElementById('ship-date');
  if (ship && !ship.value) {
    var d = new Date(); d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    ship.value = d.toISOString().slice(0, 10);
    ship.min = new Date().toISOString().slice(0, 10);
  }

  function checked(name) {
    return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (el) { return el.value; });
  }
  function val(name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }

  function buildRequest() {
    return {
      type: 'LTL_QUOTE_REQUEST',
      version: 1,
      submitted_at: new Date().toISOString(),
      contact: { name: val('contact_name'), company: val('contact_company'), email: val('contact_email'), phone: val('contact_phone') },
      shipment: {
        ship_date: val('ship_date'),
        origin_zip: val('origin_zip'), origin_city: val('origin_city'),
        destination_zip: val('destination_zip'), destination_city: val('destination_city'),
        declared_value: val('declared_value'),
        linear_feet_override: val('linear_feet'),
        stackable: form.elements['stackable'].checked
      },
      accessorials: { pickup: checked('pickup_accessorial'), delivery: checked('delivery_accessorial') },
      items: itemRows(),
      hazmat: hazToggle.checked ? {
        un_number: val('hazmat_un'), hazard_class: val('hazmat_class'), packing_group: val('hazmat_packing_group'),
        shipping_name: val('hazmat_shipping_name'), emergency_contact: val('hazmat_emergency_contact')
      } : null,
      notes: val('notes')
    };
  }

  // Plain-text version: readable for a person, line-per-field for a parser.
  function toText(r) {
    var lines = [];
    lines.push('LTL QUOTE REQUEST');
    lines.push('Submitted: ' + r.submitted_at);
    lines.push('');
    lines.push('Contact name: ' + r.contact.name);
    lines.push('Company: ' + r.contact.company);
    lines.push('Email: ' + r.contact.email);
    lines.push('Phone: ' + r.contact.phone);
    lines.push('');
    lines.push('Ship date: ' + r.shipment.ship_date);
    lines.push('Origin zip: ' + r.shipment.origin_zip + (r.shipment.origin_city ? ' (' + r.shipment.origin_city + ')' : ''));
    lines.push('Destination zip: ' + r.shipment.destination_zip + (r.shipment.destination_city ? ' (' + r.shipment.destination_city + ')' : ''));
    lines.push('Declared value: ' + (r.shipment.declared_value || 'none'));
    lines.push('Pickup accessorials: ' + (r.accessorials.pickup.join(', ') || 'none'));
    lines.push('Delivery accessorials: ' + (r.accessorials.delivery.join(', ') || 'none'));
    lines.push('Linear feet override: ' + (r.shipment.linear_feet_override || 'none'));
    lines.push('Stackable: ' + (r.shipment.stackable ? 'yes' : 'no'));
    lines.push('');
    r.items.forEach(function (it, i) {
      lines.push('Item ' + (i + 1) + ': ' + it.units + ' ' + it.unit_type + ' | pieces ' + (it.pieces || '-') + ' | ' + it.weight_lb + ' lb | ' +
        (it.length_in && it.width_in && it.height_in ? it.length_in + 'x' + it.width_in + 'x' + it.height_in + ' in' : 'dims -') +
        ' | class ' + it.freight_class + ' | NMFC ' + (it.nmfc || '-') + ' | ' + (it.description || '-'));
    });
    lines.push('');
    lines.push('Hazmat: ' + (r.hazmat ? 'yes | UN ' + r.hazmat.un_number + ' | class ' + r.hazmat.hazard_class + ' | PG ' + r.hazmat.packing_group + ' | ' + r.hazmat.shipping_name + ' | emergency ' + r.hazmat.emergency_contact : 'no'));
    lines.push('Notes: ' + (r.notes || 'none'));
    lines.push('');
    lines.push('--- JSON ---');
    lines.push(JSON.stringify(r));
    return lines.join('\n');
  }

  function validate() {
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (el) {
      el.classList.add('touched');
      if (!el.checkValidity()) ok = false;
    });
    return ok;
  }

  var sending = false;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var status = document.getElementById('ltl-status');
    var button = form.querySelector('button[type="submit"]');
    // One submission at a time: a second click mid-flight duplicates the lead and
    // burns another of the 50 monthly Formspree submissions.
    if (sending) return;
    // Honeypot: hidden from real visitors, so anything in it is a bot. Reported as
    // sent so the bot does not retry, but nothing is transmitted.
    if (val('_gotcha')) {
      status.textContent = 'Sent. We will reply with your quote.';
      if (button) button.disabled = true;
      return;
    }
    if (!validate()) {
      status.textContent = 'Please fill in the required fields marked with *.';
      var bad = form.querySelector(':invalid');
      if (bad) bad.focus();
      return;
    }
    var request = buildRequest();
    var subject = 'LTL Quote Request: ' + request.shipment.origin_zip + ' to ' + request.shipment.destination_zip + ' (' + request.contact.company + ')';
    var text = toText(request);

    // Fallback only. It never claims the request was sent.
    var fallback = function (reason) {
      sending = false;
      if (button) button.disabled = false;
      if (window.srlTrack) window.srlTrack('quote_submit_failed', { form: 'ltl', reason: reason });
      status.textContent = 'That did not go through. Opening your email app instead - or email ' + TO_ADDRESS + ' or call 614-855-9504.';
      window.location.href = 'mailto:' + TO_ADDRESS + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    };

    if (FORM_ENDPOINT) {
      sending = true;
      if (button) button.disabled = true;
      status.textContent = 'Sending...';
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ _subject: subject, email: request.contact.email, _replyto: request.contact.email, message: text })
      }).then(function (res) {
        if (!res.ok) throw new Error('http_' + res.status);
        // Success is only ever declared here, after Formspree accepts the POST.
        sending = false;
        status.textContent = 'Sent. We will reply to ' + request.contact.email + ' with your quote.';
        if (button) button.disabled = true;
        if (window.srlTrack) window.srlTrack('ltl_quote_submitted', { form: 'ltl' });
      }).catch(function (err) {
        var reason = String(err && err.message || '').indexOf('http_') === 0 ? err.message : 'network';
        fallback(reason);
      });
      return;
    }
    window.location.href = 'mailto:' + TO_ADDRESS + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    status.textContent = 'Your email app should open with the request filled in. If it does not, email ' + TO_ADDRESS + ' or call 614-855-9504.';
  });
})();
