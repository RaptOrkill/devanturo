/* Devanturo — la démo en grand : la modale LE BRAISÉ.
   recit.js émet « demos:ouvrir » (annulable) sur document depuis « Explorer le site → », l'écran du portable ou l'écran du téléphone ;
   on l'annule (plus de nouvel onglet) et on ouvre la modale depuis le rectangle réel de l'écran cliqué.
   Si ce script ne se charge pas, recit.js garde le repli : nouvel onglet. Le suivi (demo_ouverte, avec sa source) reste dans recit.js.
   Indépendant de GSAP : Web Animations (transform + opacity), jamais de défilement touché. */
(() => {
  'use strict';
  const modale = document.getElementById('modale-demo');
  if (!modale) return;
  const $ = s => modale.querySelector(s);
  const html = document.documentElement;
  const panneau = $('.modale-panneau'), fond = $('.modale-fond'), cadre = $('.modale-cadre'), chargement = $('.modale-chargement');
  const onglet = $('.modale-onglet'), fermerBouton = $('.modale-fermer');
  const gardes = modale.querySelectorAll('.modale-garde');
  // Ce qui apparaît une fois le panneau presque en place (pas de texte écrasé pendant le trajet) ; la barre elle-même est en display: contents.
  const contenu = [$('.modale-titre'), onglet, $('.modale-cta'), fermerBouton, cadre];
  const TEXTE_CHARGEMENT = chargement.textContent;
  const COURBE = 'cubic-bezier(.2, .7, .2, 1)';
  const reduit = matchMedia('(prefers-reduced-motion: reduce)');
  const inertePossible = 'inert' in HTMLElement.prototype;
  // Tout le reste de la page devient inerte pendant l'ouverture (clic, clavier, lecteurs d'écran).
  const inertes = () => ['.entete', '#menu', 'main', '.pied', '#barre'].map(s => document.querySelector(s)).filter(Boolean);

  let iframe = $('.modale-iframe');
  let etat = 'ferme'; // ferme → ouverture → ouvert → fermeture → ferme
  let ctx = null;     // { declencheur, ecran, y, url }
  let animations = [], minuteurLent = 0, minuteurAnim = 0;

  // Le rectangle d'où part (et où revient) la modale : seulement s'il est réellement à l'écran.
  const rectDe = el => {
    if (!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth ? r : null;
  };

  function jouer(r, ouvre, finiDemande) {
    animations.forEach(a => a.cancel());
    animations = [];
    clearTimeout(minuteurAnim);
    if (!panneau.animate) { finiDemande(); return; }
    // Filet : si les images sont gelées (onglet en arrière-plan), la fin arrive quand même, une seule fois.
    let fait = false;
    const fini = () => { if (fait) return; fait = true; clearTimeout(minuteurAnim); finiDemande(); };
    const sens = ouvre ? 'normal' : 'reverse';
    let principale;
    if (reduit.matches || !r) {
      // Mouvement réduit (ou aucun écran mesurable) : simple fondu.
      principale = modale.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduit.matches ? 150 : (ouvre ? 240 : 180), easing: 'ease', direction: sens, fill: 'both' });
      animations = [principale];
    } else {
      const p = panneau.getBoundingClientRect();
      const duree = ouvre ? 420 : 320;
      const depart = `translate(${(r.left - p.left).toFixed(1)}px, ${(r.top - p.top).toFixed(1)}px) scale(${(r.width / p.width).toFixed(4)}, ${(r.height / p.height).toFixed(4)})`;
      const options = { duration: duree, easing: COURBE, direction: sens, fill: 'both' };
      principale = panneau.animate([{ transform: depart }, { transform: 'none' }], options);
      animations = [principale, fond.animate([{ opacity: 0 }, { opacity: 1 }], options)]
        .concat(contenu.map(el => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], options)));
    }
    principale.onfinish = fini;
    minuteurAnim = setTimeout(fini, 700);
  }

  function charge() {
    clearTimeout(minuteurLent);
    cadre.classList.add('charge');
  }
  // Au bout de 8 s sans réponse : on le dit, et on propose le nouvel onglet.
  function tropLent() {
    chargement.textContent = 'La démo met du temps à répondre. ';
    const a = document.createElement('a');
    a.href = onglet.href; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Ouvrir dans un nouvel onglet →';
    chargement.appendChild(document.createElement('br'));
    chargement.appendChild(a);
  }
  // À la fermeture, l'iframe est remplacée par une vierge (sans src) : la page de démo est vraiment libérée.
  function viderIframe() {
    clearTimeout(minuteurLent);
    const vierge = iframe.cloneNode(false);
    vierge.removeAttribute('src');
    iframe.replaceWith(vierge);
    iframe = vierge;
    cadre.classList.remove('charge');
    chargement.textContent = TEXTE_CHARGEMENT;
  }

  const touche = e => { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); fermer(); } };

  function ouvrir(d) {
    if (etat !== 'ferme') return;
    etat = 'ouverture';
    ctx = { declencheur: d.declencheur, ecran: d.ecran, y: window.scrollY, url: d.url };
    const source = rectDe(d.ecran) || rectDe(d.declencheur);
    modale.hidden = false;
    html.classList.add('modale-ouverte');
    iframe.addEventListener('load', charge, { once: true });
    iframe.src = d.url;
    minuteurLent = setTimeout(tropLent, 8000);
    // Focus d'abord (le déclencheur devient inerte juste après), sans jamais faire défiler.
    fermerBouton.focus({ preventScroll: true });
    if (inertePossible) inertes().forEach(el => { el.inert = true; });
    document.addEventListener('keydown', touche);
    if (window.scrollY !== ctx.y) window.scrollTo(0, ctx.y);
    jouer(source, true, () => {
      if (etat !== 'ouverture') return;
      animations.forEach(a => a.cancel());
      animations = [];
      etat = 'ouvert';
    });
  }

  function fermer() {
    if (etat !== 'ouvert' && etat !== 'ouverture') return;
    etat = 'fermeture';
    document.removeEventListener('keydown', touche);
    jouer(rectDe(ctx.ecran) || rectDe(ctx.declencheur), false, () => {
      modale.hidden = true;
      animations.forEach(a => a.cancel());
      animations = [];
      viderIframe();
      if (inertePossible) inertes().forEach(el => { el.inert = false; });
      html.classList.remove('modale-ouverte');
      // Position de défilement : identique à l'ouverture, jamais sous le plancher du récit (sinon le plancher ferait un saut).
      const recit = window.recit;
      const y = Math.max(ctx.y, recit && recit.plancher ? recit.plancher() : 0);
      if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
      const retour = ctx.declencheur;
      ctx = null;
      etat = 'ferme';
      if (retour && retour.isConnected) retour.focus({ preventScroll: true });
    });
  }

  document.addEventListener('demos:ouvrir', e => {
    const d = e.detail || {};
    if (d.demo !== 'braise' || !d.url) return;
    e.preventDefault();
    ouvrir(d);
  });
  fermerBouton.addEventListener('click', fermer);
  fond.addEventListener('click', fermer);
  // Focus piégé : la barre, puis l'iframe ; en sortant de l'iframe (Tab) on revient au début, en remontant avant la barre on va à l'iframe.
  gardes[0].addEventListener('focus', () => (iframe.getAttribute('src') ? iframe : fermerBouton).focus());
  gardes[1].addEventListener('focus', () => onglet.focus());
  // Aucun défilement de la page derrière au doigt (Safari iOS ignore parfois overflow: hidden) ; l'iframe garde ses propres gestes.
  [fond, panneau].forEach(el => el.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));

  // Débogage local : window.__demos.etat()
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__demos = { etat: () => etat, ouvrir, fermer, iframe: () => iframe };
})();
