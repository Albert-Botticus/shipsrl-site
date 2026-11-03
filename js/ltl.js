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

  // NMFC density scale (13 subs, Docket 2025-1, in effect since July 2025):
  // minimum lb per cubic foot for each class, densest first. Only an estimate;
  // commodities with a fixed NMFC class rate on that class regardless of density.
  var DENSITY_SCALE = [
    [50, '50'], [35, '55'], [30, '60'], [22.5, '65'], [15, '70'], [12, '85'], [10, '92.5'],
    [8, '100'], [6, '125'], [4, '175'], [2, '250'], [1, '300'], [0, '400']
  ];
  function densityClass(pcf) {
    if (!pcf || pcf <= 0) return '';
    for (var i = 0; i < DENSITY_SCALE.length; i++) if (pcf >= DENSITY_SCALE[i][0]) return DENSITY_SCALE[i][1];
    return '400';
  }

  function itemRows() {
    return Array.prototype.map.call(items.querySelectorAll('.item'), function (item) {
      var f = function (name) { return item.querySelector('[name="' + name + '"]'); };
      var units = num(f('item_units'));
      var L = num(f('item_length')), W = num(f('item_width')), H = num(f('item_height'));
      var weight = num(f('item_weight'));
      var cubic = L && W && H ? (L * W * H / 1728) * units : 0;
      var pcf = cubic ? Math.round((weight / cubic) * 10) / 10 : null;
      var chosen = f('item_class').value;
      return {
        units: units,
        unit_type: f('item_unit_type').value,
        pieces: f('item_pieces').value,
        weight_lb: weight,
        length_in: L, width_in: W, height_in: H,
        freight_class: chosen || 'Not sure',
        class_source: chosen ? 'customer' : (pcf ? 'estimated' : 'unknown'),
        estimated_class: pcf ? densityClass(pcf) : null,
        nmfc: f('item_nmfc').value.trim(),
        description: f('item_description').value.trim(),
        cubic_feet: cubic ? Math.round(cubic * 10) / 10 : null,
        pcf: pcf
      };
    });
  }

  // Per-item readout under the class dropdown, and the reclass acknowledgment
  // that only appears when at least one item is left on "Not sure".
  var ackWrap = document.getElementById('class-ack');
  var ackBox = document.getElementById('class-ack-box');
  function updateClassHints(rows) {
    var nodes = items.querySelectorAll('.item');
    var anyUnknown = false;
    rows.forEach(function (r, i) {
      var out = nodes[i] && nodes[i].querySelector('.class-est');
      if (!out) return;
      out.classList.remove('warn');
      if (r.freight_class === 'Not sure') {
        anyUnknown = true;
        if (r.estimated_class) out.textContent = 'Estimated from density: class ' + r.estimated_class + ' (' + r.pcf + ' lb/cu ft). We will confirm it.';
        else out.textContent = 'Enter weight and dimensions and we will estimate the class.';
      } else if (r.estimated_class && r.estimated_class !== r.freight_class && !r.nmfc) {
        out.textContent = 'Density suggests class ' + r.estimated_class + ' (' + r.pcf + ' lb/cu ft). We will check it before quoting.';
        out.classList.add('warn');
      } else {
        out.textContent = '';
      }
    });
    if (ackWrap && ackBox) {
      ackWrap.classList.toggle('hidden', !anyUnknown);
      ackBox.required = anyUnknown;
      if (!anyUnknown) ackBox.classList.remove('touched');
    }
    return anyUnknown;
  }

  function recalc() {
    var rows = itemRows();
    var weight = rows.reduce(function (s, r) { return s + r.weight_lb; }, 0);
    var cubic = rows.reduce(function (s, r) { return s + (r.cubic_feet || 0); }, 0);
    var units = rows.reduce(function (s, r) { return s + r.units; }, 0);
    var text = 'Total: ' + units + ' handling unit' + (units === 1 ? '' : 's') + ', ' + weight + ' lb';
    if (cubic) text += ', ' + (Math.round(cubic * 10) / 10) + ' cu ft, ' + (Math.round((weight / cubic) * 10) / 10) + ' PCF';
    totals.textContent = text;
    updateClassHints(rows);
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
    var rows = itemRows();
    var unknown = rows.filter(function (r) { return r.freight_class === 'Not sure'; }).length;
    return {
      type: 'LTL_QUOTE_REQUEST',
      version: 2,
      submitted_at: new Date().toISOString(),
      contact: { name: val('contact_name'), company: val('contact_company'), email: val('contact_email'), phone: val('contact_phone'), website: val('contact_website'), sms_consent: !!(form.elements['contact_sms_consent'] && form.elements['contact_sms_consent'].checked) },
      shipment: {
        ship_date: val('ship_date'),
        origin_zip: val('origin_zip'), origin_city: val('origin_city'),
        destination_zip: val('destination_zip'), destination_city: val('destination_city'),
        declared_value: val('declared_value'),
        linear_feet_override: val('linear_feet'),
        stackable: form.elements['stackable'].checked
      },
      accessorials: { pickup: checked('pickup_accessorial'), delivery: checked('delivery_accessorial') },
      // Reclass notice: how many items the customer could not class, and whether
      // they acknowledged that an estimated class may be corrected by the carrier.
      freight_class_notice: { items_without_class: unknown, acknowledged: !!(ackBox && ackBox.checked) },
      items: rows,
      hazmat: hazToggle.checked ? {
        un_number: val('hazmat_un'), hazard_class: val('hazmat_class'), packing_group: val('hazmat_packing_group'),
        shipping_name: val('hazmat_shipping_name'), emergency_contact: val('hazmat_emergency_contact')
      } : null,
      notes: val('notes'),
      // How the visitor found us (Google Ads click id, campaign tags, referrer). See js/track.js.
      attribution: window.srlAttribution ? window.srlAttribution() : { source: 'unknown' }
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
    lines.push('Website: ' + (r.contact.website || '-'));
    lines.push('SMS consent: ' + (r.contact.sms_consent ? 'YES (consented to SMS on shipsrl.com)' : 'no'));
    lines.push('Source: ' + ((r.attribution && r.attribution.source) || 'unknown') + (r.attribution && r.attribution.gclid ? ' | gclid ' + r.attribution.gclid : '') + (r.attribution && r.attribution.landing_page ? ' | landed on ' + r.attribution.landing_page : ''));
    lines.push('');
    lines.push('Ship date: ' + r.shipment.ship_date);
    lines.push('Origin zip: ' + r.shipment.origin_zip + (r.shipment.origin_city ? ' (' + r.shipment.origin_city + ')' : ''));
    lines.push('Destination zip: ' + r.shipment.destination_zip + (r.shipment.destination_city ? ' (' + r.shipment.destination_city + ')' : ''));
    lines.push('Declared value: ' + (r.shipment.declared_value || 'none'));
    lines.push('Pickup accessorials: ' + (r.accessorials.pickup.join(', ') || 'none'));
    lines.push('Delivery accessorials: ' + (r.accessorials.delivery.join(', ') || 'none'));
    lines.push('Linear feet override: ' + (r.shipment.linear_feet_override || 'none'));
    lines.push('Stackable: ' + (r.shipment.stackable ? 'yes' : 'no'));
    lines.push('Freight class notice: ' + (r.freight_class_notice.items_without_class
      ? r.freight_class_notice.items_without_class + ' item(s) without a class; customer acknowledged possible reclass: ' + (r.freight_class_notice.acknowledged ? 'yes' : 'no')
      : 'all items classed by customer'));
    lines.push('');
    r.items.forEach(function (it, i) {
      lines.push('Item ' + (i + 1) + ': ' + it.units + ' ' + it.unit_type + ' | pieces ' + (it.pieces || '-') + ' | ' + it.weight_lb + ' lb | ' +
        (it.length_in && it.width_in && it.height_in ? it.length_in + 'x' + it.width_in + 'x' + it.height_in + ' in' : 'dims -') +
        ' | class ' + it.freight_class + ' | NMFC ' + (it.nmfc || '-') + ' | ' + (it.description || '-') +
        ' | est. class ' + (it.estimated_class ? it.estimated_class + ' (' + it.pcf + ' PCF)' : '-'));
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
      var bad = form.querySelector(':invalid');
      status.textContent = bad === ackBox
        ? 'Please tick the freight class box so we know you understand the class may be corrected by the carrier.'
        : 'Please fill in the required fields marked with *.';
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
      status.textContent = 'That did not go through. Opening your email app instead, or email ' + TO_ADDRESS + ' or call 380-235-7422.';
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
    status.textContent = 'Your email app should open with the request filled in. If it does not, email ' + TO_ADDRESS + ' or call 380-235-7422.';
  });
})();
