/* ── CONTACT FORM — posts to the Cloudflare Worker (/contact), shows the result in place ──
   Without JavaScript the form still works: it posts to the same URL and the Worker answers with a
   small confirmation page. Spam traps: the hidden "website" field and a minimum fill time (t). */
(function () {
  'use strict';
  const ENDPOINT = 'https://visits.talha-zafar-j.workers.dev/contact';
  const FALLBACK = 'Could not send. Please email talha.zafar.j@gmail.com instead.';
  const opened = Date.now();

  document.querySelectorAll('form.msg-form').forEach(form => {
    const status = form.querySelector('.mf-status');
    const button = form.querySelector('button[type="submit"]');
    const say = (text, tone) => { status.textContent = text; status.className = 'mf-status' + (tone ? ' ' + tone : ''); };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const f = new FormData(form);
      const body = {
        name: f.get('name'), email: f.get('email'), company: f.get('company'), message: f.get('message'),
        website: f.get('website'), page: location.pathname, t: Date.now() - opened,
      };
      button.disabled = true;
      say('Sending…');
      try {
        // text/plain keeps this a "simple" cross-origin request (no preflight)
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          form.reset();
          say("Thanks — message received. I'll reply within 24 hours.", 'ok');
        } else {
          say(data.error || FALLBACK, 'err');
        }
      } catch (_) {
        say(FALLBACK, 'err');
      } finally {
        button.disabled = false;
      }
    });
  });
})();
