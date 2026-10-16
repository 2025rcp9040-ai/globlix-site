// Globlix site script: mobile menu, campaign tags on forms, and AJAX form
// submission to /api/lead (the forms still work without JavaScript).
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Keep UTM tags from the landing URL for this browser session, so a lead
  // that arrives via a campaign link is tagged even after browsing around.
  var keys = ['utm_source', 'utm_medium', 'utm_campaign'];
  var params = new URLSearchParams(location.search);
  keys.forEach(function (k) {
    var v = params.get(k);
    try { if (v) sessionStorage.setItem(k, v.slice(0, 100)); } catch (e) { /* storage blocked */ }
  });

  document.querySelectorAll('form.lead-form').forEach(function (form) {
    keys.forEach(function (k) {
      var input = form.querySelector('input[name="' + k + '"]');
      var v = null;
      try { v = sessionStorage.getItem(k); } catch (e) { /* storage blocked */ }
      if (input && v) input.value = v;
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      var button = form.querySelector('button[type="submit"]');
      var error = form.querySelector('.form-error');
      var label = button.textContent;
      button.disabled = true;
      button.textContent = form.dataset.sending || 'Sending…';
      if (error) error.hidden = true;

      // Join multi-select checkboxes into one value, e.g. "USA, Japan"
      var data = new FormData(form);
      var merged = {};
      data.forEach(function (value, key) {
        merged[key] = merged[key] ? merged[key] + ', ' + value : String(value);
      });
      var body = new URLSearchParams(merged).toString();

      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body,
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (!res.ok || !json.ok) throw new Error((json && json.error) || 'HTTP ' + res.status);
            window.location.href = form.dataset.thanks || '/thank-you/';
          });
        })
        .catch(function (err) {
          // Usually: Sheets/HubSpot secrets not set in Cloudflare, or the
          // spam check failed. The visitor can still send it on WhatsApp.
          if (window.console) console.warn('Form submit failed:', err && err.message);
          var ts = form.querySelector('.cf-turnstile');
          if (ts && window.turnstile) { try { window.turnstile.reset(ts); } catch (e) { /* ignore */ } }
          button.disabled = false;
          button.textContent = label;
          if (!error) return;
          error.textContent = form.dataset.error;
          // Safety net: let the visitor send the same details on WhatsApp.
          if (form.dataset.wa) {
            var lines = ['name', 'phone', 'email', 'company', 'product', 'hsn_code', 'target_markets', 'message']
              .filter(function (k) { return merged[k]; })
              .map(function (k) { return k.replace('_', ' ') + ': ' + merged[k]; });
            var a = document.createElement('a');
            a.className = 'btn btn-wa';
            a.target = '_blank';
            a.rel = 'noopener';
            a.href = 'https://wa.me/' + form.dataset.wa + '?text=' + encodeURIComponent('Globlix website enquiry\n' + lines.join('\n'));
            a.textContent = form.dataset.waLabel || 'Send on WhatsApp';
            error.appendChild(document.createElement('br'));
            error.appendChild(a);
          }
          error.hidden = false;
        });
    });
  });
})();
