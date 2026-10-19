(() => {
  const milestones = [...document.querySelectorAll('.family-history article')];
  if (!milestones.length || !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('story-timeline-ready');
  let nextReveal = 0;
  let revealUntil = 0;
  const reveal = (index) => {
    const now = performance.now();
    let delay = Math.max(0, revealUntil - now);
    for (let i = nextReveal; i <= index; i += 1) {
      const item = milestones[i];
      if (item) window.setTimeout(() => item.classList.add('is-visible'), delay);
      delay += 180;
    }
    revealUntil = now + delay;
    nextReveal = Math.max(nextReveal, index + 1);
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = milestones.indexOf(entry.target);
      reveal(index);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  milestones.forEach(item => observer.observe(item));
})();
