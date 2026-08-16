/**
 * main.js — лёгкая vanilla-реализация scroll-driven движка исходного демо.
 *
 * Модули:
 *  1. viewport-fix      — надёжные --vh/--vw (без "прыжков" на мобильных)
 *  2. splitText         — раскладка текста на слова/буквы под CSS-анимации
 *  3. progressEngine    — --progress для обычных секций (вход/выход из вьюпорта),
 *                         включая именованные переменные (--showcase-progress),
 *                         которые публикуются на <html>, чтобы их видели
 *                         СОСЕДНИЕ секции (как в оригинале copy-from)
 *  4. pinProgressEngine — прогресс для «пришпиленной» 400vh-секции (details)
 *  5. revealObserver     — разовые reveal: картинки (clip-path) и float-марки
 *  6. lazyImages         — fade-in картинок после загрузки
 *  7. customScrollbar    — декоративный скроллбар на десктопе
 */

(() => {
  'use strict';

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  /* ---------- 1. viewport fix ---------- */
  function updateViewportUnits() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    document.documentElement.style.setProperty('--vw', `${window.innerWidth * 0.01}px`);
  }

  /* ---------- 2. split text ---------- */
  function splitWord(el) {
    const text = el.textContent.trim();
    el.textContent = '';
    const words = text.split(/\s+/);
    words.forEach((w, i) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.style.setProperty('--i', i);
      wordEl.style.setProperty('--total', words.length);
      wordEl.textContent = w;
      el.appendChild(wordEl);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  function splitCharRandom(el) {
    const text = el.textContent.trim();
    el.textContent = '';
    [...text].forEach(ch => {
      const charEl = document.createElement('span');
      charEl.className = 'char';
      // случайное направление разлёта в диапазоне [-1, 1], аналог random(-10,10)
      charEl.style.setProperty('--char-r', (Math.random() * 2 - 1).toFixed(3));
      charEl.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(charEl);
    });
  }

  function initSplitText() {
    document.querySelectorAll('[data-split="word"]').forEach(splitWord);
    document.querySelectorAll('[data-split="char-random"]').forEach(splitCharRandom);
  }

  /* ---------- 3. прогресс обычных секций ---------- */
  // formula: 0 когда элемент только показался снизу вьюпорта,
  //          1 когда полностью прошёл верх вьюпорта (с учётом data-offset-top)
  function computeSectionProgress(el, offsetTopPct = 0) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const offset = (offsetTopPct / 100) * vh;
    const start = vh;                 // верх элемента у низа вьюпорта -> 0
    const end = -rect.height + offset; // низ элемента у верха вьюпорта -> 1
    const p = (start - rect.top) / (start - end);
    return clamp(p);
  }

  // formula "long": растягиваем прогресс на большую дистанцию (для видео,
  // которое продолжает анимироваться уже после того как секция ушла)
  function computeLongProgress(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh;
    const end = -vh * 2; // догоняет медленнее — эффект "ещё едет" после исчезновения
    const p = (start - rect.top) / (start - end);
    return clamp(p);
  }

  function initProgressEngine() {
    const nodes = Array.from(document.querySelectorAll('[data-progress]'));
    if (!nodes.length) return;
    let ticking = false;

    function update() {
      nodes.forEach(el => {
        const varName = el.dataset.progressVar || '--progress';
        const offsetTop = parseFloat(el.dataset.offsetTop) || 0;
        const mode = el.dataset.mode;
        const p = mode === 'long' ? computeLongProgress(el) : computeSectionProgress(el, offsetTop);
        el.style.setProperty(varName, p.toFixed(4));
        // именованные переменные (не стандартный --progress) публикуем и на <html>,
        // чтобы их могли читать соседние секции (аналог string-copy-from в оригинале)
        if (varName !== '--progress') {
          document.documentElement.style.setProperty(varName, p.toFixed(4));
        }
      });
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 4. pin-scrollytelling прогресс (details, 400vh) ---------- */
  function initPinProgress() {
    const pins = document.querySelectorAll('[data-pin-progress]');
    if (!pins.length) return;
    let ticking = false;

    function update() {
      pins.forEach(el => {
        const varName = el.dataset.progressVar || '--progress';
        const rect = el.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const p = scrollable > 0 ? clamp(-rect.top / scrollable) : 0;
        el.style.setProperty(varName, p.toFixed(4));

        const panel = el.querySelector('.details__panel');
        if (panel) panel.classList.toggle('is-active', p > 0.06);
      });
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 5. разовые reveal (картинки, плавающие марки) ---------- */
  function initRevealObserver() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    document.querySelectorAll('.reveal-clip, .split-reveal').forEach(el => io.observe(el));

    // плавающие марки "гаснут" (is-active), когда герой полностью прокручен
    const hero = document.getElementById('hero');
    if (hero) {
      const heroIO = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const active = !entry.isIntersecting; // герой ушёл из вьюпорта
          document.querySelectorAll('[data-follow="hero"]').forEach(el => {
            el.classList.toggle('is-active', active);
          });
        });
      }, { threshold: 0 });
      heroIO.observe(hero);
    }
  }

  /* ---------- 6. lazy images ---------- */
  function initLazyImages() {
    document.querySelectorAll('img.lazy-img').forEach(img => {
      if (img.complete) {
        img.classList.add('is-loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
      }
    });
  }

  /* ---------- 7. кастомный скроллбар ---------- */
  function initCustomScrollbar() {
    const bar = document.querySelector('.scrollbar');
    const thumb = bar && bar.querySelector('.thumb');
    if (!bar || !thumb) return;

    let hideTimer = null;
    let ticking = false;

    function update() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? scrollTop / scrollable : 0;
      const sizePct = clamp(window.innerHeight / doc.scrollHeight, 0.04, 1) * 100;
      const posPct = ratio * (100 - sizePct);
      thumb.style.setProperty('--size', `${sizePct}%`);
      thumb.style.setProperty('--position', `${posPct}%`);

      bar.classList.add('is-scrolling');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bar.classList.remove('is-scrolling'), 600);
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- init ---------- */
  function init() {
    updateViewportUnits();
    window.addEventListener('resize', updateViewportUnits);

    initSplitText();
    initProgressEngine();
    initPinProgress();
    initRevealObserver();
    initLazyImages();
    initCustomScrollbar();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
