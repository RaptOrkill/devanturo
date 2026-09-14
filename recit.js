/* Devanturo — le récit au défilement (tout le site y vit : démo, comment ça se passe, offre, qui vous parle, questions, final),
   le nom du restaurant, le message WhatsApp, la barre du bas. Sans GSAP ou avec « mouvement réduit », la page reste lisible en version statique. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const WHATSAPP = '33614979604';
  const html = document.documentElement;

  /* ---------- Suivi : whatsapp_tap, raccourci, demo_ouverte, passage_auto, poussés dans dataLayer (Plausible ou GA plus tard) ---------- */
  const dataLayer = (window.dataLayer = window.dataLayer || []);
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Vérification locale seulement : ?premierplan=1 simule un onglet visible avec le focus (volet navigateur caché, voir outils/premier-plan.js).
  if (local && /[?&]premierplan/.test(location.search)) { const s = document.createElement('script'); s.src = 'outils/premier-plan.js'; document.head.appendChild(s); }
  const track = (event, data = {}) => {
    dataLayer.push(Object.assign({ event }, data));
    if (local) console.debug('[suivi]', event, data);
  };

  /* ---------- Le nom du restaurant : seulement celui du lien personnalisé /?nom=Chez+Momo (plus de champ depuis le 13/09) ---------- */
  // trim après la coupe à 32 : sinon un nom coupé sur une espace donnait « le site de La Table de Momo et ses amis du . » (mesuré).
  const nettoyer = v => v.replace(/\s+/g, ' ').trim().slice(0, 32).trim();
  const param = new URLSearchParams(location.search).get('nom');
  const nom = nettoyer(param || '');
  // Un seul message, partout (final, démo, offre, barre, menu, en-tête, modale) ; le nom s'y ajoute s'il vient du lien.
  const DEMANDE = 'je voudrais prendre rendez-vous pour le site de mon restaurant.';
  const messageWhatsApp = () => (nom ? `Bonjour Baptiste, c'est pour « ${nom} » : ${DEMANDE}` : `Bonjour Baptiste, ${DEMANDE}`);
  const lienWhatsApp = () => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(messageWhatsApp())}`;
  $$('a[data-track="whatsapp_tap"]').forEach(a => { a.href = lienWhatsApp(); });
  if (nom) {
    document.title = `${nom} — son site en ligne 7 jours après ma visite`;
    // Le titre du final, écrit AVANT la découpe en mots (textContent seulement, jamais de HTML).
    const titreFinal = $('.final-titre');
    if (titreFinal) { titreFinal.textContent = `le site de ${nom}.`; titreFinal.classList.add('avec-nom'); }
  }

  $$('a[data-track]').forEach(a => a.addEventListener('click', () => track(a.dataset.track, { source: a.dataset.source })));

  /* ---------- Prendre rendez-vous : chaque bouton ouvre le choix WhatsApp / appel / e-mail (#choix-rdv, <dialog> natif) ---------- */
  // Sans <dialog> (très vieux navigateur) ou clic modifié (Ctrl, Maj, molette) : le lien WhatsApp direct, comme avant.
  const choix = $('#choix-rdv');
  // Lien de prise de rendez-vous en ligne (Cal.com ou Calendly). Vide = option cachée.
  const AGENDA = '';
  if (choix && typeof choix.showModal === 'function') {
    const SUJET = 'Rendez-vous pour le site de mon restaurant';
    const lienMail = () => `mailto:contact@devanturo.fr?subject=${encodeURIComponent(nom ? `${SUJET} (${nom})` : SUJET)}`
      + `&body=${encodeURIComponent(`Bonjour Baptiste,\n\nJe voudrais prendre rendez-vous pour le site de mon restaurant.\n\nNom du restaurant : ${nom}\nVille : \nMon numéro : \n\nMerci`)}`;
    let sourceChoix = '';
    $$('a[data-track="whatsapp_tap"]').forEach(a => a.addEventListener('click', e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const menuBouton = $('.menu-bouton');
      if (html.classList.contains('menu-ouvert') && menuBouton) menuBouton.click();
      sourceChoix = a.dataset.source || '';
      $('[data-canal="whatsapp"]', choix).href = lienWhatsApp();
      const agenda = $('[data-canal="agenda"]', choix);
      if (AGENDA && agenda) { agenda.href = AGENDA; agenda.parentElement.hidden = false; }
      $('[data-canal="email"]', choix).href = lienMail();
      html.classList.add('choix-ouvert');
      choix.showModal();
    }));
    // La classe est retirée à chaque fermeture sans attendre l'événement « close » (asynchrone) : le verrou de défilement ne reste jamais posé.
    const fermerChoix = () => { if (choix.open) choix.close(); html.classList.remove('choix-ouvert'); };
    choix.addEventListener('close', () => html.classList.remove('choix-ouvert'));
    // Escape ferme le choix seulement (stopPropagation : la démo ouverte dessous reste ouverte, demos.js écoute sur document).
    choix.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); fermerChoix(); } });
    $('.choix-fermer', choix).addEventListener('click', fermerChoix);
    // Clic sur le fond (le <dialog> lui-même, hors du panneau) : fermer.
    choix.addEventListener('click', e => { if (e.target === choix) fermerChoix(); });
    $$('[data-canal]', choix).forEach(o => o.addEventListener('click', () => {
      track('rdv_choix', { canal: o.dataset.canal, source: sourceChoix });
      setTimeout(fermerChoix, 400);
    }));
    // Copier : presse-papiers moderne, sinon l'ancienne commande copy ; si les deux échouent, le texte est sélectionné (Ctrl+C reste possible).
    const copierAncien = texte => {
      const t = document.createElement('textarea');
      t.value = texte; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      choix.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      t.remove();
      return ok;
    };
    $$('[data-copier]', choix).forEach(b => b.addEventListener('click', () => {
      const texte = b.dataset.copier;
      const reussi = () => {
        b.textContent = 'Copié';
        track('rdv_copie', { valeur: texte.includes('@') ? 'email' : 'telephone', source: sourceChoix });
        setTimeout(() => { b.textContent = 'Copier'; }, 2000);
      };
      const echec = () => {
        if (copierAncien(texte)) { reussi(); return; }
        const detail = $('.choix-detail', b.previousElementSibling);
        if (detail) { const s = getSelection(), plage = document.createRange(); plage.selectNodeContents(detail); s.removeAllRanges(); s.addRange(plage); }
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texte).then(reussi, echec);
      else echec();
    }));
  }

  /* ---------- LE BRAISÉ (la démo, 82 → 112) : le bouton, l'écran du portable et l'écran du téléphone ouvrent la démo ---------- */
  // Une seule démo, réelle. La modale (demos.js) écoute « demos:ouvrir » sur document et appelle preventDefault() ;
  // si elle n'est pas là (script en échec), la démo s'ouvre dans un nouvel onglet (noopener).
  // detail.ecran : l'élément dont la modale mesure le rectangle pour s'ouvrir depuis lui ; detail.declencheur : où rendre le focus.
  const DEMO_URL = 'https://raptorkill.github.io/vitrine48h/demo-burger/';
  function ouvrirDemo(source, declencheur, ecranDemo) {
    const libre = document.dispatchEvent(new CustomEvent('demos:ouvrir', { cancelable: true, detail: { demo: 'braise', url: DEMO_URL, nom: 'LE BRAISÉ', source, declencheur, ecran: ecranDemo || declencheur } }));
    track('demo_ouverte', { demo: 'braise', source, mode: libre ? 'onglet' : 'modale' });
    return libre;
  }
  const explorer = $('.explorer'), portableClic = $('.portable-clic');
  // Clic modifié (Ctrl, Maj, molette) sur « Explorer » : comportement natif du lien, pas de modale.
  if (explorer) explorer.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!ouvrirDemo('bouton', explorer, portableClic)) e.preventDefault();
  });
  if (portableClic) portableClic.addEventListener('click', () => { if (ouvrirDemo('portable', portableClic)) window.open(DEMO_URL, '_blank', 'noopener'); });

  /* ---------- La première page : « Voir la démo » ouvre la même modale ; la promesse de l'en-tête s'efface tant qu'elle est à l'écran ---------- */
  const accueil = $('#accueil');
  $$('.accueil-demo, .accueil-ecrans').forEach(el => el.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!ouvrirDemo('accueil', el, $('.accueil-ordi') || el)) e.preventDefault();
  }));
  if (accueil && 'IntersectionObserver' in window) {
    // Classe inversée (accueil-quitte) : sans signal de l'observateur, la première page est considérée à l'écran (animations actives, pas de doublon).
    new IntersectionObserver(([entree]) => {
      html.classList.toggle('accueil-quitte', !entree.isIntersecting);
      $$('.accueil-video', accueil).forEach(v => { if (!v.src) return; if (entree.isIntersecting) v.play().catch(() => {}); else v.pause(); });
    }, { rootMargin: '-40% 0px 0px 0px' }).observe(accueil);
  }
  // Les vidéos de la démo (≈ 1,6 Mo à deux) arrivent après la page : l'image d'attente s'affiche tout de suite, rien ne ralentit le premier écran.
  const lancerVideos = () => $$('.accueil-video').forEach(v => {
    v.src = v.dataset.src; v.muted = true; v.autoplay = true;
    v.play().catch(() => {}); // lecture refusée (mode économie d'énergie) : l'image reste, le clic ouvre la démo
  });
  // Onglet revenu au premier plan : les navigateurs suspendent les vidéos cachées, on relance si la première page est à l'écran.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || html.classList.contains('accueil-quitte')) return;
    $$('.accueil-video').forEach(v => { if (v.src && v.paused) v.play().catch(() => {}); });
  });
  if (document.readyState === 'complete') setTimeout(lancerVideos, 300);
  else window.addEventListener('load', () => setTimeout(lancerVideos, 300), { once: true });

  /* ---------- Les questions : une seule réponse ouverte à la fois ---------- */
  // name="questions" le fait déjà dans les navigateurs récents ; ce filet couvre les autres. L'ouverture ne touche jamais au défilement.
  const questions = $$('.questions details');
  questions.forEach(d => d.addEventListener('toggle', () => {
    if (d.open) questions.forEach(autre => { if (autre !== d && autre.open) autre.open = false; });
  }));
  // Entrée sur une question : ouverture explicite (certains navigateurs pilotés et claviers virtuels n'envoient pas le keypress
  // qui déclenche le <summary> natif). preventDefault : jamais de double bascule. Espace garde le comportement natif.
  questions.forEach(d => { const s = d.querySelector('summary'); if (s) s.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    d.open = !d.open;
  }); });

  /* ---------- La barre du bas ---------- */
  // Mise en scène : recit.js la montre d'après l'unité de la frise (majDemo). Version statique : tant que « comment ça se passe » ou l'écran
  // qui vous parle + questions est à l'écran.
  const barre = $('#barre');
  const barreStatique = () => {
    if (!barre || !('IntersectionObserver' in window)) return;
    // … et jamais quand un bloc qui a son propre « Prendre rendez-vous » est à l'écran (démo, offre, final) : jamais deux boutons identiques.
    const avecBouton = new Set(['#rdv', '#offre', '#final'].map(s => $(s)).filter(Boolean));
    const vus = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) vus.add(e.target); else vus.delete(e.target); });
      barre.classList.toggle('visible', vus.size > 0 && ![...vus].some(el => avecBouton.has(el)));
      html.classList.toggle('cta-ecran', vus.size > 0); // barre ou bouton d'un bloc à l'écran : le CTA de l'en-tête se cache (style.css)
    }, { rootMargin: '0px 0px -25% 0px' }); // un bloc compte quand il dépasse le quart bas de l'écran : le bloc suivant qui pointe à peine ne cache pas la barre
    ['#comment', '#questions', '#rdv', '#offre', '#final'].forEach(s => { const el = $(s); if (el) io.observe(el); });
  };

  /* ---------- Le récit animé ---------- */
  // Choix explicite du visiteur (lien « Voir la version animée », ?anim=1, mémorisé) : prime sur le réglage « réduire les animations ».
  const animForcee = html.getAttribute('data-anim-forcee') === '1';
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches && !animForcee;
  const tropBas = window.innerHeight < 520; // téléphone à l'horizontale : la mise en scène ne tient pas, on reste statique
  if (reduit || tropBas || !window.gsap || !window.ScrollTrigger) {
    html.classList.remove('anim'); barreStatique();
    const voirAnime = $('.voir-anime');
    if (voirAnime && reduit && !tropBas && window.gsap && window.ScrollTrigger) voirAnime.hidden = false;
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // La première page change de hauteur quand les polices arrivent : la frise se recale sur la vraie position du récit.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  html.classList.add('anim');

  // Chaque mot devient un <span class="mot"> pour arriver l'un après l'autre.
  $$('.mots').forEach(p => {
    const mots = p.textContent.trim().split(/ +/);
    p.textContent = '';
    mots.forEach((m, i) => {
      const s = document.createElement('span');
      s.className = 'mot';
      s.textContent = m;
      p.appendChild(s);
      if (i < mots.length - 1) p.appendChild(document.createTextNode(' '));
    });
  });

  const tel = $('.tel'), lumiere = $('.lumiere'), rdv = $('#rdv');
  const ch = n => $(`.chapitre[data-chapitre="${n}"]`);
  const cartes = [$('.carte-1'), $('.carte-2'), $('.carte-3')];
  const carteVide = $('.carte-vide');
  const ecran = { noir: $('.ecran-noir'), recherche: $('.ecran-recherche'), braise: $('.ecran-braise'), etapes: $('.ecran-etapes') };
  const geantPrix = $('.geant-prix');
  const scene = $('.scene'), portable = $('.portable'), portableVitre = $('.portable-vitre'), clic = $('.portable-clic');
  let demoPrete = false, clicActif = false, tenue = false, dernierClic = ''; // état de la démo (majDemo, plus bas)
  // Écrans vivants (CAP §4.4) : la recherche se tape lettre par lettre, les résultats arrivent en cascade.
  const rechercheTexte = $('.recherche-texte'), rechercheLignes = $$('.recherche-liste li');
  const TEXTE_RECHERCHE = rechercheTexte ? rechercheTexte.textContent : 'restaurant ce soir';

  /* Repères de la frise, en unités (0 → 218). Toute position écrite ailleurs (page.js, scene3d.js, README) vient d'ici.
     .anim .recit (style.css) fait 100vh + 218 × 5,2vh = 1233,6vh : allonger la frise = allonger cette hauteur dans la même proportion. */
  const U = {
    PLANCHER: 42,        // arrivée de l'introduction : l'écran complet du chapitre 2 (texte, recherche remplie, trois cartes, carte « ? »)
    DEMO: 102,           // nav « Démos » (tenue 94 → 112)
    TENUE_POURTANT: 58,  // arrivée du 1er passage automatique : « Pourtant, votre salle est pleine… » entier (entré 45 → 54, sortie 67)
    TENUE_SEPT_JOURS: 81,// arrivée du 2e : « Il manque juste la vitrine. / En sept jours. » entier, téléphone de face sur LE BRAISÉ (sortie 82)
    DEMO_TENUE: 97,      // arrivée du 3e, dans la démo (tout est entré : texte, portable, actions)
    COMMENT: 112,        // comment ça se passe : entrée 116 → 124, tenue 124 → 134
    OFFRE: 137,          // l'offre : entrée 137 → 145, tenue 145 → 160
    OFFRE_CIBLE: 152,    // nav « L'offre » et raccourci du chapitre 1
    DUO: 163,            // qui vous parle + questions (un seul écran) : qui vous parle 163 → 170, puis questions 170 → 177, tenue 177 → 198
    QUESTIONS_CIBLE: 185,// nav « Questions »
    FINAL: 202,          // le final : entrée 202 → 210, tenue jusqu'au bout
    VITRINE: 213,        // ?nom= arrive ici (tout le final est entré) ; le raccourci du chapitre 1 arrive sur l'offre (OFFRE_CIBLE)
    FIN: 218
  };
  // Les cibles de la nav lisent data-frise (page.js) : on l'écrit depuis U, une seule source.
  [['#demos', U.DEMO], ['#offre', U.OFFRE_CIBLE], ['#questions', U.QUESTIONS_CIBLE]].forEach(([s, u]) => { const el = $(s); if (el) el.dataset.frise = u; });
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  /* Pose du téléphone, chapitre par chapitre (CAP §4.5) : x en fraction de la largeur, y en fraction de la hauteur,
     comptés depuis le centre / depuis top: 41 % (qui, lui, ne bouge jamais).
     Une seule table pour le téléphone CSS et pour l'état 3D : les deux ne peuvent plus diverger.
     Paliers : téléphone (< 1024, valeurs d'origine, inchangées), intermédiaire (1024–1279 : le téléphone s'écarte
     juste assez pour libérer la colonne de texte, qui commence déjà à 6vw), grand écran (≥ 1280 : texte à gauche,
     objet à droite). Le CAP n'en prévoit que deux : le palier intermédiaire a été ajouté parce qu'à 1024 le
     téléphone centré coupait les mots du chapitre courant (mesuré : 46 px de recouvrement). */
  const MQ = {};
  const mq = q => (MQ[q] || (MQ[q] = matchMedia(q))).matches;
  const tresGrand = () => mq('(min-width: 1920px)');
  const grand = () => mq('(min-width: 1280px)');
  const moyen = () => mq('(min-width: 1024px)');
  const basse = () => mq('(max-height: 699.98px)');
  // Écart assumé avec le tableau du CAP : aux chapitres 1 et 3, ses 0,19 et 0,26 laissaient (mesuré) 22 % et 17 %
  // de vide à droite à 1920, alors que le contrôle du même §4.5 demande moins de 12 % : d'où 0,31 (0,33 au-delà
  // de 1920, le téléphone plafonnant à 820 px) et 0,32. Toute autre valeur se revérifie de la même façon.
  const FX = {
    1: () => grand() ? (tresGrand() ? 0.33 : 0.31) : moyen() ? 0.14 : 0.12,
    2: () => grand() ? 0.17 : moyen() ? 0.08 : 0,
    3: () => grand() ? 0.32 : 0.26,
    4: () => grand() ? 0.17 : moyen() ? 0.08 : 0
  };
  const FY = {
    1: () => grand() ? 0.09 : 0.24,
    2: () => grand() ? 0.08 : basse() ? 0.27 : 0.22,
    3: () => grand() ? 0.09 : 0.14,
    // Chapitre 4 : ≥ 1024, à droite de la colonne de texte (1024–1279 : à 0,07 il recouvrait le champ de 42 px à 1024×768, d'où 0) ;
    // sous 1024, calculé sous le texte (pose4) : le téléphone ne passe plus sous « Il manque juste la vitrine. ».
    4: () => grand() ? 0.06 : moyen() ? 0 : pose4().y
  };
  // Échelle du téléphone au chapitre 4 — partagée avec l'état 3D : 0,92 sur ordinateur ; sous 1024, ce qui tient sous le texte, jamais plus de la moitié de l'écran.
  const ECHELLE4 = () => moyen() ? 0.92 : pose4().scale;
  /* Pose mobile (< 1024) d'un téléphone de face sous un texte, ramenée aux fractions de FX/FY.
     Calculée depuis la mise en page (offsetTop/offsetHeight ignorent les transforms), mise en cache jusqu'au prochain refresh. */
  let p4 = null, p6 = null;
  const pose4 = () => p4 || (p4 = calculerPoseMobile(ch(4), 0.92, 0.5));
  // Comment ça se passe : ≥ 1024, au centre de la zone à droite de la colonne, un peu plus petit et incliné (jamais la pose du chapitre 4) ;
  // sous 1024, sous les trois étapes. Un peu tourné dans les deux cas : l'écran « frise » ne ressemble à aucun autre plan.
  // Sous 1024, la barre du bas est affichée sur cet écran (il n'a pas son propre bouton) : le téléphone se pose au-dessus d'elle.
  // S'il reste moins de PLACE_MIN_COMMENT px sous les étapes (375×667), il ne se pose pas en miniature : il sort directement par le bas.
  const PLACE_MIN_COMMENT = 200;
  const pose6 = () => p6 || (p6 = calculerPoseMobile(ch(6), 0.8, 0.46, (barre ? barre.offsetHeight : 0) + 16, PLACE_MIN_COMMENT));
  const COMMENT = {
    x: () => W() * (grand() ? 0.2 : moyen() ? 0.16 : 0),
    y: () => (moyen() ? H() * 0.05 : pose6().dehors ? DEHORS() : H() * pose6().y),
    scale: () => (moyen() ? 0.8 : pose6().dehors ? 0.6 : pose6().scale)
  };
  // Hors cadre, par le bas : le téléphone quitte la scène après « comment ça se passe » et n'y revient plus (offre, qui vous parle + questions, final sans objet).
  const DEHORS = () => H() * 0.5 + (tel.offsetHeight || 500);
  function calculerPoseMobile(texte, echelleMax, partMax, margeBas = 24, placeMin = 0) {
    const Hs = scene.clientHeight, Hp = tel.offsetHeight || 1;
    const hautZone = texte.offsetTop + texte.offsetHeight + 24;
    const basZone = Hs - margeBas;
    if (placeMin && basZone - hautZone < placeMin) return { y: 0, scale: 1, dehors: true };
    const th = Math.max(0.3 * Hp, Math.min(echelleMax * Hp, partMax * Hs, basZone - hautZone));
    // Le téléphone remonte vers le texte (35 % de l'espace libre au-dessus) : centré, il semblait détaché.
    const centre = hautZone + th / 2 + Math.max(0, basZone - hautZone - th) * 0.35;
    return { y: (centre - 0.41 * Hs) / H(), scale: th / Hp };
  }

  /* Composition du chapitre 5, calculée en pixels de la scène puis ramenée aux mêmes fractions que FX/FY
     (x de W depuis le centre, y de H depuis top: 41 %) : portable derrière à droite, téléphone devant en bas à gauche,
     qui déborde un peu du bord gauche du portable. Une seule source pour le .tel, le portable CSS et le portable 3D.
     Recalculée à chaque refresh de ScrollTrigger (redimensionnement, polices) ; mise en cache entre deux. */
  const RP = 0.7; // hauteur / largeur du portable (écran 16:10,6 + base ; le portable 3D, vu un peu de dessus, est à peine plus haut)
  let pose = null;
  const pose5 = () => pose || (pose = calculerPose5());
  function calculerPose5() {
    const Ws = scene.clientWidth, Hs = scene.clientHeight, w = W(), h = H();
    const Hp = tel.offsetHeight || 1, rt = (tel.offsetWidth || 1) / Hp;
    const c5 = ch(5);
    let L, Th, K, D, gauche, droite, hautZone, basZone;
    if (moyen()) {
      // ≥ 1024 : la composition occupe la zone à droite de la colonne de texte, centrée dans cette zone.
      const entete = parseFloat(getComputedStyle(html).getPropertyValue('--entete-h')) || 64;
      K = 0.38; D = 0.14;
      gauche = c5.offsetLeft + c5.offsetWidth + 0.03 * Ws; droite = Ws - Math.max(32, 0.035 * Ws);
      hautZone = entete + 32; basZone = Hs - 40;
      Th = Hp * 0.7;
      // Plafond de largeur : le portable 3D se projette un peu plus large que sa boîte (perspective), d'où 42/38/34 % pour tenir 44/40/36 %.
      const plafond = mq('(min-width: 2560px)') ? 0.34 : tresGrand() ? 0.38 : 0.42;
      L = Math.min(1.45 * Th, plafond * Ws);
    } else {
      // < 1024 : entre le texte et les deux actions (en bas de l'écran), centrée ; portable ≈ 86 % de la largeur (540 px au plus sur tablette).
      // Borne basse = haut de #rdv : la composition ne sort plus par le bas de l'écran ni ne passe sous les boutons (mesuré à 390×844 avant : elle débordait).
      K = 0.22; D = 0.22;
      gauche = 16; droite = Ws - 16;
      hautZone = c5.offsetTop + c5.offsetHeight + 20; basZone = (rdv ? rdv.offsetTop : Hs) - 18;
      L = Math.min(0.86 * Ws, 540);
      Th = 1.2 * RP * L;
    }
    const hauteurGroupe = (l, t) => Math.max(RP * l, (1 - D) * t) + D * t;
    // La base du portable déborde de 6 % de sa largeur à droite (112 %, marge −6 %) : comptée dans la place, sinon elle sortait
    // de l'écran de 7 à 10 px en ?sans3d=1 (mesuré T12 à 390×844 et 430×932, 1 px à 1024×768).
    const DEBORD_BASE = 0.06;
    const k = Math.min(1, (droite - gauche) / ((1 + DEBORD_BASE) * L + K * Th * rt), Math.max(0.2, basZone - hautZone) / hauteurGroupe(L, Th));
    L *= k; Th *= k;
    const tw = Th * rt, gw = L + K * tw, gh = hauteurGroupe(L, Th);
    // Sous 1024, la composition remonte vers le texte (35 % de l'espace libre au-dessus, 65 % dessous) : centrée, elle semblait détachée (mesuré à 390×844).
    const gx = gauche + Math.max(0, droite - gauche - gw - DEBORD_BASE * L) / 2, gy = hautZone + Math.max(0, basZone - hautZone - gh) * (moyen() ? 0.5 : 0.35);
    const bord = gx + K * tw;                          // bord gauche du portable
    const bas = gy + Math.max(RP * L, (1 - D) * Th);   // bas du portable
    const fx = v => (v - Ws / 2) / w, fy = v => (v - 0.41 * Hs) / h;
    if (portable) portable.style.setProperty('--portable-l', L.toFixed(1) + 'px');
    return {
      tel: { x: fx(gx + tw / 2), y: fy(bas + D * Th - Th / 2), scale: Th / Hp },
      portable: { x: fx(bord + L / 2), xDepart: fx(Ws + 0.9 * L), y: fy(bas - RP * L / 2), largeur: L, hauteur: RP * L }
    };
  }

  // États de départ
  gsap.set(tel, { xPercent: -50, yPercent: -50, transformPerspective: 1200, x: () => W() * FX[1](), y: () => H() * FY[1](), rotation: -12, rotationY: 18, scale: 0.9, opacity: 1 });
  gsap.set(cartes, { opacity: 0, y: 120 });
  gsap.set(carteVide, { opacity: 0, y: 60, scale: 0.7 });
  gsap.set(rdv, { opacity: 0, y: 16 });
  // Chapitres 6 à 9 : invisibles (visibility: hidden) tant que la frise ne les a pas fait entrer ; la grande typographie du prix aussi.
  gsap.set([ch(6), ch(7), ch(8), ch(9)], { autoAlpha: 0 });
  gsap.set(geantPrix, { autoAlpha: 0, scale: 0.96 });
  // Hauteur réservée à une réponse ouverte dans l'écran qui vous parle + questions : deux lignes (le maximum voulu) et leur marge basse.
  // Calculée depuis le style, sans ouvrir de <details> (name="questions" refermerait celui que le visiteur a ouvert).
  const reponse = $('.questions details p');
  const placeReponse = () => {
    if (!reponse) return 0;
    const s = getComputedStyle(reponse), lh = parseFloat(s.lineHeight) || 1.4 * parseFloat(s.fontSize);
    return Math.ceil(2 * lh + (parseFloat(s.paddingBottom) || 0));
  };
  // ≥ 1024 : les actions de la démo vivent dans la colonne gauche, sous le texte de leur chapitre (le texte y reste affiché).
  // Top en pixels, recalculé à chaque refresh (redimensionnement, polices) ; en dessous, le CSS les pose en bas.
  function poserColonne() {
    if (rdv && ch(5)) {
      if (!moyen()) rdv.style.removeProperty('top');
      else {
        const c = ch(5), sous = c.offsetTop + c.offsetHeight + Math.max(28, 0.035 * H());
        rdv.style.top = Math.round(Math.min(sous, scene.clientHeight - rdv.offsetHeight - 32)) + 'px';
      }
    }
    // Les chapitres de la suite sont centrés dans la hauteur libre entre l'en-tête et la barre du bas, jamais plus haut que le repli CSS
    // (juste sous l'en-tête) ; l'écran des questions garde la place d'une réponse ouverte. Sous 1024, « comment ça se passe » reste en haut :
    // le téléphone se pose sous ses trois étapes (pose6). Le final se centre seul (CSS) : la barre y est cachée.
    const entete = parseFloat(getComputedStyle(html).getPropertyValue('--entete-h')) || 64;
    const hBarre = barre ? barre.offsetHeight : 0;
    [6, 7, 8].forEach(n => {
      const c = ch(n);
      if (!c) return;
      c.style.removeProperty('top');
      if (n === 6 && !moyen()) return;
      const h = c.offsetHeight + (n === 8 ? placeReponse() : 0);
      c.style.top = Math.round(Math.max(c.offsetTop, entete + (scene.clientHeight - entete - hBarre - h) / 2)) + 'px';
    });
  }
  poserColonne();
  ScrollTrigger.addEventListener('refreshInit', poserColonne);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(poserColonne);

  // Une seule frise de 0 à 250 unités (U), pilotée par le défilement de la section .recit (1400vh : 5,2vh par unité).
  // Toute position écrite ailleurs se donne en unités (jamais en fraction : la frise peut encore s'allonger).
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => majDemo(),
    scrollTrigger: { trigger: '#recit', start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true }
  });
  // Les mots, puis (dans l'ordre du texte) les éléments .ent : numéros, listes, boutons, questions. Rien n'apparaît d'un coup.
  const entree = (el, t, duree) => tl.fromTo($$('.mot, .ent', el), { opacity: 0, y: '0.4em' }, { opacity: 1, y: 0, duration: duree * 0.45, stagger: { amount: duree * 0.55 } }, t);
  // Un chapitre de la suite (6 → 9) : il devient visible juste avant ses mots, et repart comme les autres (autoAlpha : plus tabulable une fois parti).
  const montrer = (el, t) => tl.to(el, { autoAlpha: 1, duration: 0.5 }, t);
  // autoAlpha : à opacité 0, GSAP pose visibility: hidden, donc le raccourci du chapitre 1 n'est plus tabulable une fois parti (M2).
  // dy : les chapitres de la suite, collés sous l'en-tête, partent sans monter (sinon leur première ligne passait sous lui, mesuré à 390×844).
  const sortie = (el, t, dy = -24) => tl.to(el, { autoAlpha: 0, y: dy, duration: 3 }, t);

  // Chapitre 1 — 19 h 12. (0 → 22) : visible dès l'arrivée, sans défiler ; le défilement ne fait que le faire partir.
  const motsIntro = $$('.mot', ch(1));
  gsap.set(motsIntro, { opacity: 1, y: 0 });
  if (!param) gsap.from(motsIntro, { opacity: 0, y: '0.4em', duration: 0.9, stagger: 0.07, ease: 'power2.out', delay: 0.15 });
  sortie(ch(1), 18);

  // Chapitre 2 — Il ne vous voit pas. (22 → 47)
  entree(ch(2), 22, 9);
  tl.to(tel, { x: () => W() * FX[2](), y: () => H() * FY[2](), rotation: -4, rotationY: -8, scale: 0.85, duration: 8 }, 20);
  tl.to(ecran.noir, { opacity: 0, duration: 3 }, 23);
  tl.to(ecran.recherche, { opacity: 1, duration: 3 }, 23);
  tl.to(cartes, { opacity: 1, y: 0, rotation: i => [-6, 5, -3][i], duration: 6, stagger: 2 }, 26);
  // Les trois résultats du téléphone HTML n'apparaissent qu'une fois la recherche tapée (30 → 38), en cascade ; état pur du défilement.
  // (gsap.set et non fromTo : avec un stagger, les cibles retardées ne seraient pas rendues à leur état de départ — même piège que les cartes.)
  gsap.set(rechercheLignes, { opacity: 0, y: 8 });
  tl.to(rechercheLignes, { opacity: 1, y: 0, duration: 4, stagger: 2 }, 30);
  // La carte « ? » pleine à 41 : à 42 (U.PLANCHER, arrivée de l'introduction), tout l'écran du chapitre 2 est en place.
  tl.to(carteVide, { opacity: 1, y: 0, scale: 1, duration: 3 }, 38);
  tl.to(cartes.concat(carteVide), { opacity: 0, y: -90, duration: 4, stagger: 0.5 }, 43);
  sortie(ch(2), 43);

  // Chapitre 3 — Pourtant, (45 → 70)
  entree(ch(3), 45, 9); // dès 45 : croise la sortie du chapitre 2 (43 → 46) ; entré à 47, l'écran restait sans texte de 46 à 47 (mesuré)
  tl.to(lumiere, { opacity: 1, duration: 8 }, 46);
  // Le téléphone flou se pose à la même hauteur que la pose 3D (y positif = plus bas) : plus de téléphone
  // sous l'en-tête ni derrière le texte en ?sans3d=1, et les deux versions racontent la même chose.
  tl.to(tel, { scale: 0.55, x: () => W() * FX[3](), y: () => H() * FY[3](), rotation: 6, rotationY: -18, opacity: 0.55, filter: 'blur(2px)', duration: 9 }, 46);
  tl.to(ecran.recherche, { opacity: 0, duration: 4 }, 50);
  // Sortie 67 → 70 et entrée du chapitre 4 dès 68 : les deux textes se croisent deux unités, l'écran n'est jamais vide de texte
  // (mesuré : avec l'entrée à 69, le texte le plus visible tombait à 0,17 d'opacité à 69,5 ; à 68, jamais sous 0,5).
  sortie(ch(3), 67);
  tl.to(lumiere, { opacity: 0, duration: 6 }, 66);

  // Chapitre 4 — Il manque juste la vitrine. (69 → 82) : le téléphone finit sa pirouette de face, son écran s'allume sur LE BRAISÉ.
  entree(ch(4), 68, 7);
  tl.to(tel, { scale: ECHELLE4, x: () => W() * FX[4](), y: () => H() * FY[4](), rotation: 0, rotationY: 0, opacity: 1, filter: 'blur(0px)', duration: 10 }, 70);
  tl.to(ecran.braise, { opacity: 1, duration: 4 }, 74); // pleine à 78 : à la tenue (81) l'écran montre LE BRAISÉ, jamais le verre noir
  sortie(ch(4), 82);

  // La démo — LE BRAISÉ. (82 → 112), dans la suite du chapitre 4 : un seul mouvement continu, en carrousel, sans quitter la scène.
  // 82 → 94 : le téléphone glisse à gauche, recule et pivote vers le centre ; le portable entre par la droite ; le texte de la démo remplace celui du chapitre 4.
  tl.to(tel, { x: () => W() * pose5().tel.x, y: () => H() * pose5().tel.y, scale: () => pose5().tel.scale, rotationY: 10, duration: 12, ease: 'power1.inOut' }, 82);
  // Le portable CSS (repli) entre depuis la droite, pivoté vers le centre ; le portable 3D suit les mêmes chiffres (etat3d.portable).
  gsap.set(portable, { xPercent: -50, yPercent: -50, transformPerspective: 1200, rotationY: -14, opacity: 0 });
  tl.fromTo(portable, { x: () => W() * pose5().portable.xDepart, y: () => H() * pose5().portable.y, rotationY: -14 },
    { x: () => W() * pose5().portable.x, y: () => H() * pose5().portable.y, rotationY: -8, duration: 12, ease: 'power2.out' }, 82);
  tl.to(portable, { opacity: 1, duration: 2 }, 82);
  entree(ch(5), 83, 9); // dès 83 : croise la sortie du chapitre 4 (82 → 85), aucun instant sans texte (à 84, 0,17 d'opacité au creux, mesuré)
  // 91 → 95 : les deux actions arrivent (actives de 92 à 112, visibles jusqu'à 115 pour que leur fondu de sortie se voie : majDemo).
  tl.to(rdv, { opacity: 1, y: 0, duration: 4 }, 91);
  // 94 → 112 : tenue, écrans cliquables (flottement léger si 3D active et pointeur fin : html.demo-tenue).

  // Comment ça se passe (112 → 134)
  // 112 → 120 : le texte et les actions de la démo partent ; le portable ressort par la droite (l'inverse de son entrée) ;
  // le téléphone se pose à droite (dessous sur mobile), un peu incliné, et son écran passe de LE BRAISÉ à la frise des trois étapes.
  sortie(ch(5), 112);
  tl.to(rdv, { opacity: 0, y: 0, duration: 3 }, 112);
  // Le portable sort en 6 unités (fini à 118) et le texte de « comment ça se passe » n'entre qu'à 118 : jamais deux objets et deux idées à la fois (constat C08).
  tl.to(portable, { x: () => W() * pose5().portable.xDepart, rotationY: -14, duration: 6, ease: 'power2.in' }, 112);
  tl.to(portable, { opacity: 0, duration: 1 }, 117);
  tl.to(tel, { x: COMMENT.x, y: COMMENT.y, scale: COMMENT.scale, rotation: 4, rotationY: -14, duration: 9, ease: 'power1.inOut' }, U.COMMENT);
  tl.to(ecran.braise, { opacity: 0, duration: 5 }, U.COMMENT + 1);
  tl.to(ecran.etapes, { opacity: 1, duration: 5 }, U.COMMENT + 1);
  montrer(ch(6), U.COMMENT + 5.5);
  entree(ch(6), U.COMMENT + 6, 7);
  sortie(ch(6), 134, 0);
  // 133 → 140 : le téléphone sort par le bas, en tournant à peine ; il ne revient plus (la suite du récit est sans objet).
  // Il est sorti avant l'entrée du « 549 € » géant (140) : il ne passe plus devant lui (constat C08, mesuré avant à 1440 : recouvrement à 140).
  tl.to(tel, { y: DEHORS, rotation: 10, duration: 7, ease: 'power2.in' }, 133);

  // L'offre (137 → 160) : le texte à gauche, la grande typographie du prix à droite (≥ 1024 ; sous 1024, le prix est dans le texte).
  montrer(ch(7), U.OFFRE - 0.5);
  entree(ch(7), U.OFFRE, 8);
  tl.to(geantPrix, { autoAlpha: 1, scale: 1, duration: 5 }, U.OFFRE + 3);
  sortie(ch(7), 160, 0);
  tl.to(geantPrix, { autoAlpha: 0, scale: 1.02, duration: 3 }, 160);

  // Qui vous parle + les questions, un seul écran (163 → 201) : les deux blocs arrivent l'un après l'autre, sans objet (le texte est l'image).
  // 163 → 170 : qui vous parle ; 170 → 177 : les questions ; 177 → 198 : tenue (lire, ouvrir plusieurs réponses sans que la frise avance).
  montrer(ch(8), U.DUO - 0.5);
  entree($('.qui', ch(8)), U.DUO, 7);
  entree($('.faq', ch(8)), U.DUO + 7, 7);
  sortie(ch(8), 198, 0);

  // Le final — prendre rendez-vous (202 → 218) : aucun objet ; le titre mot à mot, puis la phrase, les trois points, le bouton.
  montrer(ch(9), U.FINAL - 0.5);
  entree(ch(9), U.FINAL, 8);
  tl.to({}, { duration: 1 }, U.FIN - 1);

  /* Chapitre 4, démo et suite : images différées (≥ 47), actions de la démo (92 → 112), écrans cliquables (94 → 112), tenue (96 → 112),
     barre du bas (offre → questions, cachée dès que l'écran des questions repart, avant le final).
     Les classes se déduisent de l'unité courante (jamais de onStart) : un refresh, qui repose la frise sans callbacks, ne peut plus les désynchroniser.
     Appelée par la frise et après chaque refresh. */
  function chargerDemo() { if (demoPrete) return; demoPrete = true; html.classList.add('demo-prete'); }
  function placerClic(r) {
    if (!clic) return;
    const t = `translate3d(${Math.round(r.left)}px, ${Math.round(r.top)}px, 0)|${Math.round(r.width)}|${Math.round(r.height)}`;
    if (t === dernierClic) return;
    dernierClic = t;
    const [tr, lw, lh] = t.split('|');
    clic.style.transform = tr; clic.style.width = lw + 'px'; clic.style.height = lh + 'px';
  }
  function majDemo() {
    const u = tl.time();
    // Les images de LE BRAISÉ partent à l'entrée du chapitre 3 (47, là où commence le passage automatique vers la démo) :
    // l'écran du téléphone s'allume dessus dès 76. Jamais pendant qu'on lit le chapitre 2 (budget « avant les démos », CAP §14).
    if (u >= 47) chargerDemo();
    // Comparées à la classe réelle : sauterOffre() et ?nom= la posent aussi à l'arrivée, sans état à tenir en double.
    // Actions cliquables de 92 à 112, mais visibles de 91 à 115 : les fondus d'entrée et de sortie se voient, sans clic fantôme.
    const r = u > 92 && u < 112, rv = u > 91 && u < 115;
    if (rdv && r !== rdv.classList.contains('actif')) rdv.classList.toggle('actif', r);
    if (rdv && rv !== rdv.classList.contains('visible')) rdv.classList.toggle('visible', rv);
    // La barre du bas : seulement sur les écrans SANS leur propre « Prendre rendez-vous » (jamais deux boutons identiques à l'écran) :
    // comment ça se passe (après le départ des actions de la démo, visibles jusqu'à 115, jusqu'à l'entrée de l'offre)
    // et qui vous parle + questions (après la sortie de l'offre, 160 → 163, jusqu'au final). Cachée pendant la démo, l'offre et le final.
    const b = (u >= 115 && u < U.OFFRE) || (u >= U.DUO && u < U.FINAL - 2);
    if (barre && b !== barre.classList.contains('visible')) barre.classList.toggle('visible', b);
    // Le CTA de l'en-tête se cache dès qu'un autre « Prendre rendez-vous » est à l'écran : actions de la démo (91 → 115), barre du bas,
    // offre (136 → 163), final (200 →). En pratique : visible de l'arrivée jusqu'à la démo, là où il n'y a aucun autre bouton (constat C04).
    const cta = rv || b || (u >= U.OFFRE - 1 && u < U.DUO) || u >= U.FINAL - 2;
    if (cta !== html.classList.contains('cta-ecran')) html.classList.toggle('cta-ecran', cta);
    const actif = u >= 94 && u < 112;
    if (actif !== clicActif) { clicActif = actif; if (clic) clic.classList.toggle('actif', actif); html.classList.toggle('demo-clic', actif); }
    const t = u >= 96 && u < 112;
    if (t !== tenue) { tenue = t; html.classList.toggle('demo-tenue', t); }
    // Repli CSS : le bouton suit l'écran du portable CSS. En 3D, scene3d.js le pose sur le rectangle projeté de la dalle.
    if (actif && portableVitre && !html.classList.contains('portable-3d')) {
      const s = scene.getBoundingClientRect(), b = portableVitre.getBoundingClientRect();
      placerClic({ left: b.left - s.left, top: b.top - s.top, width: b.width, height: b.height });
    }
  }
  ScrollTrigger.addEventListener('refreshInit', () => { pose = null; p4 = null; p6 = null; });
  ScrollTrigger.addEventListener('refresh', majDemo);
  // L'écran du téléphone ouvre aussi la démo, seulement pendant 94 → 112 (aucun clic fantôme sur le reste du récit).
  // Le focus revient sur le bouton de l'écran du portable (le téléphone est aria-hidden) ; la modale s'ouvre depuis l'écran du téléphone.
  tel.addEventListener('click', () => { if (clicActif && ouvrirDemo('telephone', clic, $('.ecran', tel))) window.open(DEMO_URL, '_blank', 'noopener'); });
  // Les deux images (≈ 85 Ko) ne partent qu'au passage de l'unité 47 (majDemo) : plus de minuteur, qui les chargeait pendant la lecture du chapitre 2.

  /* ---------- La 3D (scene3d.js) : un état tweené par la même frise, lu par le module ---------- */
  // Mêmes chiffres que les tweens de .tel ci-dessus : le téléphone WebGL et le téléphone CSS partagent la pose.
  const etat3d = { x: FX[1](), y: FY[1](), rot: -12, rotY: 18, scale: 0.9, ecran: 0, lumiere: 0, telCss: 0, fourchette: 0, assiette: 0, tape: 0, resultats: 0,
    // Le portable de la démo : x/y en fractions (comme le téléphone), rotY en degrés, scale × recit.portable().largeur, opacite 0 → 1 hors cadre.
    portable: { x: 1, y: 0, rotY: -14, scale: 1, opacite: 0 } };
  // Mêmes chiffres que le portable CSS ci-dessus : scene3d.js ne fait que lire cet état.
  tl.fromTo(etat3d.portable, { x: () => pose5().portable.xDepart, y: () => pose5().portable.y, rotY: -14 },
    { x: () => pose5().portable.x, y: () => pose5().portable.y, rotY: -8, duration: 12, ease: 'power2.out' }, 82);
  tl.to(etat3d.portable, { opacite: 1, duration: 2 }, 82);
  // 112 → 120 : il ressort par la droite, comme le portable CSS ; à opacite 0, scene3d.js masque le canvas (plus rien à dessiner).
  tl.to(etat3d.portable, { x: () => pose5().portable.xDepart, rotY: -14, duration: 6, ease: 'power2.in' }, 112);
  tl.to(etat3d.portable, { opacite: 0, duration: 1 }, 117);
  tl.to(etat3d, { fourchette: 1, duration: 24 }, 0);
  tl.to(etat3d, { x: FX[2], y: FY[2], rot: -4, rotY: -8, scale: 0.85, duration: 8 }, 20);
  tl.to(etat3d, { ecran: 1, duration: 3 }, 23);
  // La frappe (23 → 30) : le téléphone HTML n'écrit que quand le nombre de lettres change ; le curseur clignote pendant la frappe.
  // Le téléphone 3D lit tape/resultats à chaque rendu et redessine sa texture aux mêmes paliers (scene3d.js).
  let lettres = -1, frappe = false;
  const majFrappe = () => {
    if (!rechercheTexte) return;
    const n = Math.round(etat3d.tape * TEXTE_RECHERCHE.length);
    if (n !== lettres) { lettres = n; rechercheTexte.textContent = TEXTE_RECHERCHE.slice(0, n); }
    const enCours = etat3d.tape > 0 && etat3d.tape < 1;
    if (enCours !== frappe) { frappe = enCours; ecran.recherche.classList.toggle('frappe', enCours); }
  };
  tl.to(etat3d, { tape: 1, duration: 7, onUpdate: majFrappe }, 23);
  tl.to(etat3d, { resultats: 1, duration: 8 }, 30);
  majFrappe();
  // ScrollTrigger.refresh (redimensionnement, polices) repose la frise avec les callbacks muets : etat3d.tape revient à sa valeur
  // mais onUpdate ne part pas, et la barre restait vide à f = 0,40 (mesuré). On relit donc l'état après chaque refresh.
  ScrollTrigger.addEventListener('refresh', majFrappe);
  tl.to(etat3d, { assiette: 1, duration: 26 }, 48); // entrée 48 → 55, plateau, sortie avant 74 : après le départ des cartes (43–47), pas de surcharge
  tl.to(etat3d, { x: FX[3], y: FY[3], rot: 6, rotY: 165, scale: 0.55, duration: 9 }, 46); // en 3D le téléphone montre son dos au lieu de flouter ; même pose que le .tel CSS
  tl.to(etat3d, { lumiere: 1, duration: 8 }, 46);
  tl.to(etat3d, { ecran: 0, duration: 4 }, 50);
  tl.to(etat3d, { lumiere: 0, duration: 6 }, 66);
  tl.to(etat3d, { x: FX[4], y: FY[4], rot: 0, scale: ECHELLE4, duration: 10 }, 70);
  tl.to(etat3d, { rotY: 360, duration: 8 }, 70); // finit sa pirouette face au visiteur à 78
  tl.to(etat3d, { telCss: 1, duration: 2 }, 78);  // fondu croisé vers le téléphone HTML, net et de face ; fini à 80, avant la tenue « En sept jours » (81)
  // Passage d'un palier à l'autre (redimensionnement) : on repose la pose de départ avant que ScrollTrigger
  // ne recalcule, sinon le chapitre 1 et les débuts de tween resteraient sur l'ancienne fraction.
  let palier = FX[1]();
  ScrollTrigger.addEventListener('refreshInit', () => {
    if (FX[1]() === palier) return;
    palier = FX[1]();
    gsap.set(tel, { x: W() * FX[1](), y: H() * FY[1]() });
    etat3d.x = FX[1](); etat3d.y = FY[1]();
  });

  // plancher() et finirIntro() servent à page.js (ancres de la nav) : une ancre ne descend jamais sous le plancher
  // et, cliquée pendant l'introduction, l'interrompt comme le fait le raccourci. Les deux fonctions sont déclarées plus bas.
  // portable() : largeur du portable (px) et pose de la démo ; placerClic(rect) : scene3d.js y pose le bouton de l'écran (coordonnées de la scène) ;
  // clicActif() : vrai de 94 à 112 (avant 112 exclu) ; position(u) : la position de défilement de l'unité u de la frise (ancres de page.js, data-frise) ;
  // unites : les repères U (lecture seule) ; passage() : le nom du passage automatique en cours ('' sinon).
  window.recit = Object.freeze({ frise: tl, etat: etat3d, scene, tel, telCorps: $('.tel-corps'), recherche: ecran.recherche, texteRecherche: TEXTE_RECHERCHE, W, H, local, depart: () => ({ x: FX[1](), y: FY[1]() }),
    unites: Object.freeze(Object.assign({}, U)), passage: () => (passageEnCours ? passageEnCours.nom : ''),
    portable: () => pose5().portable, placerClic, clicActif: () => clicActif, position: u => marche(u),
    plancher: () => 0, finirIntro: () => { arreterIntro(); poserPlancher(); } });
  const peutFaireLa3d = () => {
    if (/[?&]sans3d/.test(location.search)) return false;
    if (!(HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'))) return false;
    if (navigator.connection && navigator.connection.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  };
  // La 3D tentée retient l'introduction automatique (plus bas) jusqu'à son signal « scene3d » : 'pret' (html.trois posée, fourchette chargée)
  // ou 'arret' (repli CSS). Jamais plus de INTRO_MAX : une 3D lente ne bloque pas le récit.
  let attente3d = false, pret3d = 0, relancerIntro = null;
  document.addEventListener('scene3d', e => {
    attente3d = false;
    if (e.detail && e.detail.etat === 'pret') pret3d = performance.now();
    if (relancerIntro) relancerIntro();
  });
  if (peutFaireLa3d()) {
    attente3d = true;
    const lancer = () => {
      ['three.module.min.js', 'three.core.min.js'].forEach(f => {
        const l = document.createElement('link'); l.rel = 'modulepreload';
        l.href = 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/' + f; document.head.appendChild(l);
      });
      import('./scene3d.js').then(m => m.demarrer(window.recit)).catch(e => {
        if (local) console.debug('[3d] absent', e);
        attente3d = false; if (relancerIntro) relancerIntro();
      });
    };
    const apresLoad = () => ('requestIdleCallback' in window ? requestIdleCallback(lancer, { timeout: 2500 }) : setTimeout(lancer, 400));
    if (document.readyState === 'complete') apresLoad(); else window.addEventListener('load', apresLoad, { once: true });
  }

  /* ---------- L'introduction automatique et le plancher de défilement ----------
     Le chapitre 1 s'affiche seul, la page glisse d'elle-même (4 s, comme une vidéo : mots, recherche et cartes arrivent pendant le glissement)
     jusqu'à l'écran complet du chapitre 2, puis on ne peut plus jamais remonter au-dessus. */
  // En unités de frise (U), converties par la durée réelle de la frise : changer sa longueur ne déplace ni le plancher ni la vitrine.
  // ?nom= arrive au final : « Et maintenant, le site de votre restaurant. » (ou « le site de <nom>. »), le bouton « Prendre rendez-vous ».
  // Le raccourci du chapitre 1 arrive sur l'offre (U.OFFRE_CIBLE) : « Passer l'histoire, voir l'offre → ».
  const CH2 = U.PLANCHER, VITRINE = U.VITRINE, GLISSE_INTRO = 3000;
  const marche = u => { const st = tl.scrollTrigger; return Math.round(st.start + (st.end - st.start) * u / tl.duration()); };

  // Le plancher : un écouteur passif qui ramène instantanément toute remontée, sans à-coup.
  let plancher = 0, plancherPose = false;
  const tenirPlancher = () => { if (window.scrollY < plancher) window.scrollTo(0, plancher); };
  // Depuis le 14/09 (première page #accueil) : on doit pouvoir remonter jusqu'à elle. Le « plancher » ne bloque plus rien,
  // il marque seulement la fin de l'introduction (html.intro-finie : passages automatiques, bouton de l'en-tête sur mobile).
  function poserPlancher() {
    plancherPose = true;
    html.classList.add('intro-finie');
  }
  void tenirPlancher;

  // Le glissement, écrit image par image (easeInOutCubic) : aucune dépendance nouvelle.
  // ecritGlisse : la dernière position écrite, pour reconnaître un mouvement qui n'est pas le nôtre (passages automatiques).
  let stopGlisse = null, ecritGlisse = 0;
  function glisser(vers, duree, fini) {
    const depart = window.scrollY, ecart = vers - depart, t0 = performance.now();
    ecritGlisse = depart;
    let id = 0, garde = 0;
    const terminer = () => {
      if (id) cancelAnimationFrame(id);
      if (garde) clearTimeout(garde);
      id = 0; garde = 0; stopGlisse = null;
      ecritGlisse = vers;
      window.scrollTo(0, vers);
      fini();
    };
    const pas = t => {
      const k = Math.min(1, (t - t0) / duree);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      ecritGlisse = depart + ecart * e;
      window.scrollTo(0, ecritGlisse);
      if (k < 1) { id = requestAnimationFrame(pas); return; }
      terminer();
    };
    id = requestAnimationFrame(pas);
    // Filet : si les images sont gelées (onglet en arrière-plan), on arrive quand même et on déverrouille.
    garde = setTimeout(terminer, duree + 700);
    stopGlisse = () => { if (id) cancelAnimationFrame(id); if (garde) clearTimeout(garde); id = 0; garde = 0; stopGlisse = null; };
  }

  // Pendant le glissement : molette, doigt et touches de défilement neutralisés. Tab et la saisie restent libres.
  const TOUCHES = new Set([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
  const bloquer = e => { e.preventDefault(); };
  const bloquerTouche = e => {
    const c = e.target;
    if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA' || c.isContentEditable)) return;
    if (TOUCHES.has(e.key)) e.preventDefault();
  };
  let verrouille = false;
  function verrouiller() {
    if (verrouille) return;
    verrouille = true;
    window.addEventListener('wheel', bloquer, { passive: false });
    window.addEventListener('touchmove', bloquer, { passive: false });
    window.addEventListener('keydown', bloquerTouche, { passive: false });
  }
  function deverrouiller() {
    if (!verrouille) return;
    verrouille = false;
    window.removeEventListener('wheel', bloquer);
    window.removeEventListener('touchmove', bloquer);
    window.removeEventListener('keydown', bloquerTouche);
  }

  let introEnCours = false, minuteur = 0, minuteur3d = 0;
  function arreterIntro() {
    introEnCours = false;
    if (minuteur) { clearTimeout(minuteur); minuteur = 0; }
    if (minuteur3d) { clearTimeout(minuteur3d); minuteur3d = 0; }
    if (stopGlisse) stopGlisse();
    deverrouiller();
  }
  function lancerIntro() {
    if (!introEnCours) return;
    // Onglet en arrière-plan : on garde l'introduction pour son retour, sans verrouiller dans le vide.
    if (document.hidden) { document.addEventListener('visibilitychange', lancerIntro, { once: true }); return; }
    introEnCours = false;
    const arrivee = marche(CH2);
    if (window.scrollY >= arrivee - 2) { poserPlancher(); return; } // déjà plus bas (position restaurée) : on pose seulement le plancher
    verrouiller();
    glisser(arrivee, GLISSE_INTRO, () => { deverrouiller(); poserPlancher(); });
  }
  // Le raccourci du chapitre 1 : on interrompt l'introduction et on arrive sur l'offre (prix, liste, bouton), le focus sur son bouton.
  // Le scrub (0,5 s) est amené au bout tout de suite : sinon le chapitre de l'offre serait encore en visibility: hidden et refuserait le focus.
  function sauterOffre() {
    arreterIntro();
    verrouiller();
    glisser(marche(U.OFFRE_CIBLE), 900, () => {
      deverrouiller(); poserPlancher();
      const st = tl.scrollTrigger, tw = st && st.getTween ? st.getTween() : null;
      if (tw) tw.progress(1);
      const b = $('.offre-actions .bouton-rdv');
      if (b) b.focus({ preventScroll: true });
    });
  }
  const raccourci = $('.raccourci');
  if (raccourci) raccourci.addEventListener('click', e => { e.preventDefault(); sauterOffre(); });

  /* ---------- Les passages automatiques ----------
     Écrans de TENUE (on s'y arrête : lire, agir) : le chapitre 2 complet (42), « Pourtant, votre salle est pleine… » (58),
     « Il manque juste la vitrine. / En sept jours. » (81), la démo (94 → 112), comment ça se passe et l'offre (112 → 160),
     qui vous parle + questions (163 → 198), le final (202 →). Aucun passage n'en part.
     Entre deux tenues du début, des TRANSITIONS courtes (44 → 56, 59 → 78, 83 → 92) : entré en descendant puis arrêté (aucun geste pendant
     ATTENTE_PASSAGE), le visiteur est porté jusqu'à la tenue suivante (easeInOutCubic). Un écran = une idée : la tenue sur « Pourtant » et sur
     « En sept jours. » dure le temps que le visiteur choisit (il repart d'un geste), jamais un minuteur (mesuré avant : moins de 0,5 s chacune).
     Garde-fous : jamais vers le haut ; annulé au moindre geste (molette, doigt, touche, clic, barre de défilement) et la page reste où elle est ;
     pas pendant l'introduction, la modale ou le menu ; un écran annulé ne relance rien tant que le visiteur n'en est pas sorti.
     Ajouter une transition = ajouter une ligne (unités de/a, tenue d'arrivée, durée). Mise en scène seulement : rien en statique ni en mouvement réduit. */
  const PASSAGES = [
    // Les tenues d'arrivée (58, 81, 97) sont hors de toute plage : arrivé, on y reste jusqu'au geste suivant.
    { de: 44, a: 56, vers: U.TENUE_POURTANT, duree: 900, nom: 'pourtant', cible: 'pourtant' },
    { de: 59, a: 78, vers: U.TENUE_SEPT_JOURS, duree: 1200, nom: 'vitrine', cible: 'sept-jours' },
    { de: 83, a: 92, vers: U.DEMO_TENUE, duree: 900, nom: 'demo', cible: 'demo' }
  ];
  const ATTENTE_PASSAGE = 700;
  const uniteDe = y => { const st = tl.scrollTrigger; return (y - st.start) / Math.max(1, st.end - st.start) * tl.duration(); };
  let dernierY = window.scrollY, descend = false, minuteurPassage = 0, passageEnCours = null, appuye = false;
  const annules = new Set();
  function annulerPassage() {
    if (!passageEnCours) return;
    const p = passageEnCours;
    passageEnCours = null;
    if (stopGlisse) stopGlisse();
    annules.add(p);
    track('passage_auto', { de: p.nom, vers: p.cible, annule: 'oui' });
  }
  function tenterPassage() {
    minuteurPassage = 0;
    if (!descend || appuye || passageEnCours || verrouille || stopGlisse || document.hidden || !html.classList.contains('intro-finie')) return;
    if (html.classList.contains('modale-ouverte') || html.classList.contains('menu-ouvert') || html.classList.contains('choix-ouvert')) return;
    const y = window.scrollY, u = uniteDe(y);
    const p = PASSAGES.find(q => u >= q.de && u < q.a);
    if (!p || annules.has(p)) return;
    const vers = marche(p.vers);
    if (vers <= y + 2) return;
    passageEnCours = p;
    glisser(vers, p.duree, () => { passageEnCours = null; track('passage_auto', { de: p.nom, vers: p.cible, annule: 'non' }); });
  }
  // Le moindre geste reprend la main (en capture : avant tout autre écouteur). Doigt ou bouton appuyé : jamais de départ.
  const geste = () => { if (passageEnCours) annulerPassage(); };
  ['wheel', 'keydown'].forEach(t => window.addEventListener(t, geste, { passive: true, capture: true }));
  ['touchstart', 'mousedown'].forEach(t => window.addEventListener(t, () => { appuye = true; geste(); }, { passive: true, capture: true }));
  ['touchend', 'touchcancel', 'mouseup'].forEach(t => window.addEventListener(t, () => { appuye = false; }, { passive: true, capture: true }));
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    // Pendant un passage : une position qui n'est pas celle qu'on vient d'écrire (barre de défilement, clavier…) rend la main.
    if (passageEnCours) { if (Math.abs(y - ecritGlisse) > 4) annulerPassage(); dernierY = y; return; }
    if (y !== dernierY) descend = y > dernierY;
    dernierY = y;
    const u = uniteDe(y);
    if (!plancherPose && !verrouille && u >= CH2) poserPlancher(); // arrivé au chapitre 2 par soi-même : fin de l'introduction (on peut toujours remonter)
    // « 19 h 12 » ne fait pas perdre de temps (demande du 14/09) : dès qu'on descend de la première page vers le chapitre 1,
    // la page glisse d'elle-même jusqu'au chapitre 2 complet. En remontant, rien ne se déclenche.
    if (descend && !verrouille && !stopGlisse && y > tl.scrollTrigger.start - window.innerHeight * 0.55 && u < CH2 - 1
        && !html.classList.contains('modale-ouverte') && !html.classList.contains('menu-ouvert') && !html.classList.contains('choix-ouvert')) {
      introEnCours = true; lancerIntro(); return;
    }
    annules.forEach(p => { if (u < p.de || u >= p.a) annules.delete(p); });
    if (minuteurPassage) clearTimeout(minuteurPassage);
    minuteurPassage = setTimeout(tenterPassage, ATTENTE_PASSAGE);
  }, { passive: true });

  if (param) {
    // Lien personnalisé : on arrive directement sur le final, avec son nom dans le titre et le message, même plancher.
    const allerAuBout = () => {
      ScrollTrigger.refresh();
      window.scrollTo(0, marche(VITRINE));
      ScrollTrigger.update();
      poserPlancher();
    };
    if (document.readyState === 'complete') allerAuBout();
    else window.addEventListener('load', allerAuBout, { once: true });
  } else {
    introEnCours = true;
    let attendu = false, chargee = document.readyState === 'complete';
    // 2,5 s au moins ; si la 3D est en route, on attend son signal puis on laisse la fourchette tourner TENUE_3D,
    // le tout borné à INTRO_MAX depuis l'arrivée. Sans 3D (repli, ?sans3d=1) : 2,5 s, comme avant.
    const INTRO_MAX = 5500, TENUE_3D = 1600, debut = performance.now();
    const tenter = () => {
      if (!(attendu && chargee) || !introEnCours) return;
      const maintenant = performance.now(), plafond = INTRO_MAX - (maintenant - debut);
      const reste = attente3d ? plafond : pret3d ? Math.min(TENUE_3D - (maintenant - pret3d), plafond) : 0;
      if (reste > 0) { if (minuteur3d) clearTimeout(minuteur3d); minuteur3d = setTimeout(() => { minuteur3d = 0; tenter(); }, reste); return; }
      lancerIntro();
    };
    // Depuis le 14/09, la première page (#accueil) reste à l'écran : l'introduction ne part plus seule.
    // « Découvrir l'histoire » la lance (même glissement de 4 s jusqu'au chapitre 2) ; en défilant soi-même, le plancher se pose au chapitre 2.
    introEnCours = false;
    void attendu; void chargee; void tenter;
    const suite = $('.accueil-suite');
    if (suite) suite.addEventListener('click', e => { e.preventDefault(); introEnCours = true; lancerIntro(); track('decouvrir', {}); });
  }
})();
