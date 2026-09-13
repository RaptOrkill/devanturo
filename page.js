/* Devanturo — la page autour du récit : en-tête opaque quand le pied de page arrive, menu mobile,
   ancres qui respectent le plancher du récit (et visent les chapitres par leur unité de frise).
   Indépendant de GSAP : tout passe par IntersectionObserver et window.scrollTo. Sans JS, tout reste lisible. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observable = 'IntersectionObserver' in window;

  /* ---------- L'en-tête : opaque et compact dès que le pied de page entre à l'écran (html.apres) ---------- */
  // Tout le site vit dans le récit : la seule chose dessous est le pied. Dès qu'il entre par le bas, la scène collante commence à remonter :
  // l'en-tête devient opaque tout de suite, sinon le final passait sous la marque et la promesse (mesuré à 390×844, en-tête transparent).
  const pied = $('.pied');
  if (observable && pied) {
    new IntersectionObserver(entries => entries.forEach(e => {
      html.classList.toggle('apres', e.isIntersecting || e.boundingClientRect.top < 0);
    })).observe(pied);
  }

  /* ---------- Le menu mobile : aria-expanded, Escape, focus piégé, focus rendu au bouton ---------- */
  const bouton = $('.menu-bouton'), menu = $('#menu');
  let ouvert = false;
  const focusables = () => [bouton].concat($$('a[href], button', menu)).filter(el => !el.closest('[hidden]'));
  // Le reste de la page est rendu inerte pendant l'ouverture (lecteurs d'écran compris) quand le navigateur le permet.
  const inertes = () => ['main', '.pied', '#barre'].map(s => $(s)).filter(Boolean);
  const toucheMenu = e => {
    if (e.key === 'Escape') { e.preventDefault(); fermerMenu(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  };
  function ouvrirMenu() {
    if (ouvert || !menu || !bouton) return;
    ouvert = true;
    menu.classList.add('ouvert');
    html.classList.add('menu-ouvert');
    bouton.setAttribute('aria-expanded', 'true');
    bouton.textContent = 'Fermer';
    if ('inert' in HTMLElement.prototype) inertes().forEach(el => { el.inert = true; });
    document.addEventListener('keydown', toucheMenu);
    const premier = focusables()[1];
    if (premier) premier.focus();
  }
  function fermerMenu(rendreFocus = true) {
    if (!ouvert) return;
    ouvert = false;
    menu.classList.remove('ouvert');
    html.classList.remove('menu-ouvert');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.textContent = 'Menu';
    if ('inert' in HTMLElement.prototype) inertes().forEach(el => { el.inert = false; });
    document.removeEventListener('keydown', toucheMenu);
    if (rendreFocus) bouton.focus({ preventScroll: true });
  }
  if (bouton && menu) {
    bouton.addEventListener('click', () => (ouvert ? fermerMenu() : ouvrirMenu()));
    // Passage en largeur ordinateur : le panneau n'existe plus, on le referme proprement.
    const ordi = matchMedia('(min-width: 1024px)');
    ordi.addEventListener('change', e => { if (e.matches) fermerMenu(false); });
  }

  /* ---------- Les ancres : défilement doux qui respecte le plancher du récit ---------- */
  const cibleDe = a => {
    const h = a.getAttribute('href');
    if (!h || h.length < 2 || h[0] !== '#') return null;
    try { return document.getElementById(decodeURIComponent(h.slice(1))); } catch (_) { return null; }
  };
  function allerA(cible) {
    const recit = window.recit;
    // Pendant l'introduction, une ancre l'interrompt et pose le plancher, comme le raccourci du chapitre 1.
    if (recit && recit.finirIntro && html.classList.contains('anim') && !html.classList.contains('intro-finie')) recit.finirIntro();
    const marge = parseFloat(getComputedStyle(cible).scrollMarginTop) || 0;
    const plancher = recit && recit.plancher ? recit.plancher() : 0;
    let y = Math.round(window.scrollY + cible.getBoundingClientRect().top - marge);
    // Une cible qui vit dans la scène collante du récit (démo, offre, questions : data-frise, écrit par recit.js depuis ses repères U) se vise par sa position dans la frise.
    const unite = parseFloat(cible.dataset.frise);
    if (!isNaN(unite) && recit && recit.position && html.classList.contains('anim')) y = recit.position(unite);
    y = Math.max(plancher, Math.min(y, html.scrollHeight - window.innerHeight));
    // Doux ici seulement (jamais de scroll-behavior: smooth global : il casserait le plancher).
    window.scrollTo({ top: y, behavior: reduit ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', e => {
    // Le raccourci est déjà traité par recit.js (defaultPrevented) ; clic modifié = comportement natif.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    // Lien d'attente (href="#", CGV à venir) : jamais de saut en haut de page, que le plancher ramènerait d'un coup.
    if (a.getAttribute('href') === '#') { e.preventDefault(); return; }
    const cible = cibleDe(a);
    if (!cible) return;
    e.preventDefault();
    fermerMenu();
    allerA(cible);
  });
  // Nav et menu : un lien dont la section n'existe pas encore est masqué (il réapparaît de lui-même quand la section arrive).
  $$('.nav a, .menu-liens a').forEach(a => { if (!cibleDe(a)) (a.closest('li') || a).hidden = true; });

  window.page = Object.freeze({ ouvrirMenu, fermerMenu, allerA });
})();
