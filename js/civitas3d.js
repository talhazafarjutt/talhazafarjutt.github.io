/* ── CIVITAS ARTICLE — CSS 3D figures (signal stack, performance pairs) ──
   The interactive pipeline (Fig. 1) lives in scene3d.js + scenes/civitas.js. */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══════════ 2. RISK SIGNAL STACK (CSS 3D) ══════════ */
  const stk = document.getElementById('stack3d');
  if (stk) {
    const iso = stk.querySelector('.stk-iso');
    const pair = k => [stk.querySelector('.cub[data-k="' + k + '"]'), stk.querySelector('li[data-k="' + k + '"]')];
    stk.querySelectorAll('li[data-k]').forEach(li => {
      const [c] = pair(li.dataset.k);
      li.addEventListener('mouseenter', () => { c && c.classList.add('hot'); li.classList.add('hot'); });
      li.addEventListener('mouseleave', () => { c && c.classList.remove('hot'); li.classList.remove('hot'); });
    });
    tilt(stk.querySelector('.stk-scene'), iso, 58, -40, 'translateZ(-60px)');
  }

  /* ══════════ 3. PERFORMANCE PAIRS (CSS 3D) ══════════ */
  const prf = document.querySelector('.prf');
  if (prf) {
    new IntersectionObserver((es, o) => {
      if (es[0].isIntersecting) { prf.classList.add('on'); o.disconnect(); }
    }, { threshold: 0.35 }).observe(prf);
    prf.querySelectorAll('.prf-card').forEach(c => tilt(c.querySelector('.prf-scene'), c.querySelector('.prf-iso'), 60, -35, 'translateY(85px)'));
  }

  // gentle pointer-follow tilt for the CSS 3D figures
  function tilt(area, iso, rx, rz, extra) {
    if (!area || !iso || RM) return;
    area.addEventListener('pointermove', e => {
      const r = area.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      iso.style.transform = `rotateX(${rx - dy * 14}deg) rotateZ(${rz + dx * 22}deg) ${extra}`;
    });
    area.addEventListener('pointerleave', () => { iso.style.transform = ''; });
  }
})();
