(function () {
  'use strict';

  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle');
  const root = document.documentElement;

  function getSavedTheme() {
    try {
      return localStorage.getItem('pmx-theme');
    } catch {
      return null;
    }
  }

  function setTheme(theme) {
    if (!theme) return;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pmx-theme', theme);
    } catch {}
  }

  const saved = getSavedTheme();
  if (saved) {
    setTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Mobile menu
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      mainNav.classList.toggle('open', !open);
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menuToggle.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('open');
      });
    });
  }

  // Screenshot gallery tabs
  const tabs = document.querySelectorAll('.gallery-tabs .tab');
  const panels = document.querySelectorAll('.gallery-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (!target) return;

      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach((panel) => {
        const isTarget = panel.id === 'panel-' + target;
        panel.classList.toggle('active', isTarget);
        panel.hidden = !isTarget;
      });
    });
  });

  // Smooth scroll offset for sticky header
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    });
  });
})();
