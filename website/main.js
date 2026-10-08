const mobileMenu = document.querySelector('.mobile-nav');
const header = document.querySelector('.site-header');
const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"], .mobile-nav a[href^="#"]')];
const sections = [...document.querySelectorAll('main section[id]')];
let scrollQueued = false;
let navLockUntil = 0;
let navigationTimer;

if (mobileMenu) {
  const menuLabel = mobileMenu.querySelector('summary');
  mobileMenu.addEventListener('toggle', () => {
    menuLabel.textContent = mobileMenu.open ? 'Close' : 'Menu';
    menuLabel.setAttribute('aria-label', mobileMenu.open ? 'Close navigation menu' : 'Open navigation menu');
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => mobileMenu.removeAttribute('open'));
  });

  document.addEventListener('click', (event) => {
    if (!mobileMenu.contains(event.target)) mobileMenu.removeAttribute('open');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') mobileMenu.removeAttribute('open');
  });
}

function setActiveSection(id) {
  navLinks.forEach((link) => {
    const active = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

function updateNavigation() {
  scrollQueued = false;
  header?.classList.toggle('is-scrolled', window.scrollY > 10);
  if (Date.now() < navLockUntil || !sections.length) return;

  const marker = window.scrollY + (header?.offsetHeight ?? 0) + Math.min(window.innerHeight * 0.3, 180);
  let current = sections[0].id;
  sections.forEach((section) => {
    if (section.offsetTop <= marker) current = section.id;
  });
  setActiveSection(current);
}

window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  window.requestAnimationFrame(updateNavigation);
}, { passive: true });
window.addEventListener('resize', updateNavigation);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.getAttribute('href')?.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0);
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'instant' : 'smooth' });
    if (window.location.hash !== `#${id}`) {
      try {
        window.history.pushState(null, '', `#${id}`);
      } catch {
        // Some browsers restrict History API updates for pages opened from disk.
      }
    }
    setActiveSection(id);
    navLockUntil = Date.now() + 1400;
    window.setTimeout(updateNavigation, 1450);

    if (!header || reducedMotion) return;
    header.classList.remove('is-navigating');
    void header.offsetWidth;
    header.classList.add('is-navigating');
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => header.classList.remove('is-navigating'), 760);
  });
});

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealItems = document.querySelectorAll('.section-intro, .feature-item, .preview-area, .about-copy, .device-display, .team-member, .contact-layout > div');
  revealItems.forEach((item) => item.setAttribute('data-reveal', ''));
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
  revealItems.forEach((item) => observer.observe(item));
}

updateNavigation();
const year = document.getElementById('copyright-year');
if (year) year.textContent = String(new Date().getFullYear());
