(() => {
  const body = document.body;
  if (!body.classList.contains('home-2d')) return;

  const mark = (selector, direction = 'up') => {
    document.querySelectorAll(selector).forEach((el, index) => {
      if (el.hasAttribute('data-slide')) return;
      el.dataset.slide = direction;
      el.style.setProperty('--slide-delay', Math.min(index * 80, 320) + 'ms');
    });
  };

  const direct = (selector, directions) => {
    document.querySelectorAll(selector).forEach((el, index) => {
      el.dataset.slide = directions[index % directions.length];
      el.style.setProperty('--slide-delay', Math.min(index * 70, 280) + 'ms');
    });
  };

  direct('.hero-copy,.hero-visual', ['left','right']);
  mark('.values-strip', 'up');
  mark('.section-heading,.center-heading', 'up');
  direct('.experience-card', ['left','up','right']);
  mark('.more-experiences', 'up');
  mark('.availability-note', 'up');
  direct('.steps article', ['left','up','right']);
  mark('.why-intro', 'left');
  direct('.why-grid article', ['right','right']);
  mark('.safety-intro', 'left');
  direct('.safety-points article', ['right','right','right']);
  direct('.become-section > div', ['left','right']);
  direct('.faq-layout > div', ['left','right']);

  body.classList.add('sathivo-motion-ready');

  const items = [...document.querySelectorAll('[data-slide]')];
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  items.forEach((el, index) => {
    if (index < 2) requestAnimationFrame(() => el.classList.add('is-visible'));
    else observer.observe(el);
  });
})();