(() => {
  const hero = document.getElementById('hero-visual');
  const path = document.getElementById('hero-trace-path');
  const point = document.getElementById('hero-trace-point');
  const halo = document.getElementById('hero-trace-halo');
  if (!hero || !path || !point || !halo || !path.getTotalLength) return;

  const length = path.getTotalLength();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function render() {
    frame = 0;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const travel = mobile ? Math.max(180, window.innerHeight * 0.35) : Math.min(190, Math.max(130, window.innerHeight * 0.21));
    const start = mobile ? Math.max(0, hero.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.55) : 0;
    const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (window.scrollY - start) / travel));
    const position = path.getPointAtLength(length * progress);

    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length * (1 - progress)}`;
    point.setAttribute('cx', position.x);
    point.setAttribute('cy', position.y);
    halo.setAttribute('cx', position.x);
    halo.setAttribute('cy', position.y);
    hero.style.setProperty('--hero-glow-x', `${position.x / 520 * 100}%`);
    hero.style.setProperty('--hero-glow-y', `${position.y / 300 * 100}%`);
    const pageLength = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pageProgress = reducedMotion.matches ? 0.5 : Math.max(0, Math.min(1, window.scrollY / pageLength));
    document.body.style.setProperty('--page-light-y', `${-12 + pageProgress * 124}%`);
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', schedule);
  else reducedMotion.addListener(schedule);
  render();
})();
