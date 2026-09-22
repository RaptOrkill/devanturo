/* Devanturo (site de l'agence) — l'entrée (le portable qui s'ouvre, on zoome dans l'écran : c'est la page), la demande de devis qui se remplit, l'envoi.
   GSAP + ScrollTrigger pilotent l'entrée ; tout le reste marche sans animation (html sans .anim : page à plat). */
(function () {
  'use strict';
  const html = document.documentElement;
  const anim = html.classList.contains('anim') && window.gsap && window.ScrollTrigger;
  // Recharger la page ramène en haut, sur le portable fermé (le navigateur ne restaure plus l'ancienne position)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash && !/[?&](aller|defile)=/.test(location.search)) window.scrollTo(0, 0);

  /* ---------- Les téléphones de la composition : sept, debout, éteints (les démos viendront plus tard) ---------- */
  // Les téléphones : trois sites de démonstration (bistrot, bar, burger) sur de vrais iPhone, argent et graphite en alternance
  const DEMOS = [   // les deux démos montrées sur le site (Baptiste, 22/09 : Kaori et Giulia ; LE BRAISÉ, Rivière et Solange restent dans demos/ ou en ligne pour plus tard)
    { nom: 'Kaori, izakaya', fichier: 'izakaya', lien: 'demos/izakaya/?de=devanturo', vivant: 'demos/izakaya/index.html?embarque=1&v=62', clair: true },
    { nom: 'Giulia, trattoria', fichier: 'trattoria', lien: 'demos/trattoria/?de=devanturo', vivant: 'demos/trattoria/index.html?embarque=1&v=62',
      // l'assiette de l'affiche, en pixels de l'écran 390 × 844 (mesurée sur la démo) ; la barre du bas (dès 774 px) la recouvre
      calque: '<img class="calque-plat" src="demos/trattoria/assets/tagliatelle.webp" alt="" width="300" height="300" decoding="async" style="left:46.8px;top:510.1px;width:296.4px;height:296px">' },
  ];
  const N_TEL = 7;
  document.querySelectorAll('[data-demos]').forEach(ul => {
    const n = ul.closest('.scene') ? 0 : 1;   // 0 = dans l'écran du portable (images tout de suite, écrans vivants), 1 = le seuil (images en attente, jamais vivant)
    for (let i = 0; i < N_TEL; i++) {
      const d = DEMOS[i % DEMOS.length], teinte = i % 2 ? 'graphite' : 'argent';
      const li = document.createElement('li'); li.className = 'demo'; li.style.setProperty('--i', i);
      // La photo du téléphone, écran allumé, par-dessus le téléphone CSS ; dans l'écran du portable (n = 0) elle part tout de suite, dans le seuil elle attend.
      li.innerHTML = '<a class="demo-tel" data-demo="' + (i % DEMOS.length) + '" data-couche="' + n + '" href="' + d.lien + '" target="_blank" rel="noopener" tabindex="-1" aria-label="Voir la démonstration : ' + d.nom + '"><span class="demo-ecran"></span><img src="assets/telephone-' + d.fichier + '-' + teinte + '.webp" srcset="assets/telephone-' + d.fichier + '-' + teinte + '.webp 600w, assets/telephone-' + d.fichier + '-' + teinte + '-2x.webp 1200w" sizes="(min-width: 760px) 340px, 80px" alt="" width="600" height="1351"' + (n ? ' loading="lazy"' : '') + ' decoding="async" onload="this.closest(\'.demo\').classList.add(\'photo\')" onerror="this.remove()"></a>';
      ul.append(li);
    }
  });

  /* ---------- Les écrans s'allument pour de vrai ----------
     La démo vit dans un cadre 390 × 844 posé sur l'écran de l'iPhone rendu, par la matrice relevée sur le rendu (sandbox/iphone/ecran-quad.json).
     Elle ne s'allume que si l'écran est assez grand à l'image (≥ 120 px) : dans le portable après le zoom sur ordinateur, et dans « Trois sites ».
     Jamais dans le seuil (téléphone tenu droit : 64 px), où la capture gravée dans le rendu suffit. */
  const ECRAN = { l: 600, matrice: 'matrix3d(1.278722, -0.033436, 0.000000, -0.000160, 0.010774, 1.512977, 0.000000, 0.000036, 0.000000, 0.000000, 1.000000, 0.000000, 14.682827, 33.024722, 0.000000, 1.000000)' };
  const vivants = new Map();
  function vivifier(cadre, d) {
    if (vivants.has(cadre)) return;
    const w = document.createElement('div'); w.className = 'demo-vivant';
    // Par-dessus la démo : la barre d'état d'iOS, l'îlot (l'encoche), et un reflet de verre, comme sur le rendu
    w.innerHTML = '<div class="ecran-pose' + (d.decale ? ' decale' : '') + (d.clair ? ' clair' : '') + '"><iframe title="' + d.nom + '" src="' + d.vivant + '" loading="lazy" tabindex="-1" aria-hidden="true"></iframe><span class="statut"><b>9:41</b><i></i></span><span class="ilot"></span><span class="reflet"></span></div>';
    w.querySelector('.ecran-pose').style.transform = ECRAN.matrice;
    cadre.append(w); vivants.set(cadre, w);
  }
  const echelleCadre = cadre => cadre.style.setProperty('--k', (cadre.offsetWidth / ECRAN.l).toFixed(4));
  const cadresHero = [...document.querySelectorAll('.hero .demo-tel')];   // les deux couches (le portable et le seuil)
  function animer(cadre, d) {
    if (vivants.has(cadre) || !d.calque) return;
    const w = document.createElement('div'); w.className = 'demo-vivant calque';
    w.innerHTML = '<div class="ecran-pose calque"><div class="calque-zone">' + d.calque + '</div></div>';
    w.querySelector('.ecran-pose').style.transform = ECRAN.matrice;
    cadre.append(w); vivants.set(cadre, w);
  }
  let attente = 0;
  function veiller() { cadresHero.forEach(c => animer(c, DEMOS[c.dataset.demo])); }
  const poserEchelles = () => { cadresHero.forEach(echelleCadre); document.querySelectorAll('[data-vivant]').forEach(echelleCadre); };
  poserEchelles(); addEventListener('resize', () => { poserEchelles(); veiller(); });
  addEventListener('scroll', () => { if (!attente) attente = setTimeout(() => { attente = 0; veiller(); }, 200); }, { passive: true });
  veiller();
  // « Trois sites » : les trois écrans s'allument quand la section approche
  const cadresExemples = [...document.querySelectorAll('[data-vivant]')];
  if (cadresExemples.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { vivifier(e.target, { nom: e.target.dataset.nom, vivant: e.target.dataset.vivant, decale: e.target.hasAttribute('data-decale'), clair: e.target.hasAttribute('data-clair') }); io.unobserve(e.target); } }), { rootMargin: '300px 0px' });
    cadresExemples.forEach(c => io.observe(c));
  } else cadresExemples.forEach(c => vivifier(c, { nom: c.dataset.nom, vivant: c.dataset.vivant, decale: c.hasAttribute('data-decale'), clair: c.hasAttribute('data-clair') }));

  /* ---------- La réservation : un créneau, trois champs, c'est réservé ---------- */
  const METIERS = { restaurant: 'un restaurant', bar: 'un bar', cafe: 'un café', autre: 'votre établissement' };
  const etat = { metier: null, creneau: null, prenom: '', etab: '', tel: '', reservation: null };
  const CLE = 'devanturo-ma-reservation';
  const R = window.Reservations;

  // Le calendrier : n'importe quel jour à venir, puis une heure de 8 h à 22 h
  const zone = document.querySelector('[data-creneaux]');
  const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const fmtJourLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const MINIMUM = new Date(Date.now() + 48 * 3600 * 1000);   // jamais le jour même : 48 h au plus tôt
  const cleJour = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Les heures déjà prises (chargées mois par mois) ; la sienne, si on revient modifier, reste libre
  const pris = new Set(), moisCharges = new Set();
  const cleHeure = quand => { const d = new Date(quand); return cleJour(d) + 'T' + String(d.getHours()).padStart(2, '0'); };
  const prisIci = (date, h) => { const k = cleJour(date) + 'T' + String(h).padStart(2, '0'); return pris.has(k) && !(etat.reservation && etat.reservation.quand && cleHeure(etat.reservation.quand) === k); };
  const disponible = (date, h) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h) >= MINIMUM && !prisIci(date, h);
  async function chargerPris(m) {
    const k = m.getFullYear() + '-' + m.getMonth(); if (moisCharges.has(k)) return; moisCharges.add(k);
    try { (await R.creneauxPris(new Date(m.getFullYear(), m.getMonth(), 1), new Date(m.getFullYear(), m.getMonth() + 1, 1))).forEach(q => pris.add(cleHeure(q))); } catch (e) {}
    if (cal.mois.getTime() === m.getTime()) dessinerCalendrier();
  }
  const cal = { mois: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1), jour: null, heure: null };
  const HEURES = []; for (let h = 8; h <= 22; h++) HEURES.push(h);
  function dessinerCalendrier() {
    chargerPris(cal.mois);
    const m = cal.mois, debut = (m.getDay() + 6) % 7, nbJours = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const peutReculer = m > new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    let html = '<div class="cal-tete"><button type="button" class="cal-nav" data-cal="-1" aria-label="Mois précédent"' + (peutReculer ? '' : ' disabled') + '>‹</button><b>' + fmtMois.format(m) + '</b><button type="button" class="cal-nav" data-cal="1" aria-label="Mois suivant">›</button></div>';
    html += '<div class="cal-grille">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => '<span class="cal-jour-nom">' + l + '</span>').join('');
    for (let i = 0; i < debut; i++) html += '<span></span>';
    for (let d = 1; d <= nbJours; d++) {
      const date = new Date(m.getFullYear(), m.getMonth(), d);
      const passe = !disponible(date, 22), choisi = cal.jour && date.getTime() === cal.jour.getTime();   // un jour se prend s'il lui reste au moins une heure
      html += '<button type="button" class="cal-jour' + (choisi ? ' choisi' : '') + (date.getTime() === aujourdhui.getTime() ? ' auj' : '') + '" data-jour="' + cleJour(date) + '"'
        + (passe ? ' disabled' : '') + ' aria-pressed="' + (choisi ? 'true' : 'false') + '" aria-label="' + fmtJourLong.format(date) + '">' + d + '</button>';
    }
    html += '</div><div class="cal-heures"' + (cal.jour ? '' : ' hidden') + '><p class="cal-heures-titre">' + (cal.jour ? fmtJourLong.format(cal.jour) + ' — à quelle heure ?' : '') + '</p><div class="cal-heures-grille">'
      + HEURES.map(h => '<button type="button" class="cal-heure' + (cal.heure === h ? ' choisi' : '') + '" data-heure="' + h + '"' + (cal.jour && !disponible(cal.jour, h) ? ' disabled' : '') + ' aria-pressed="' + (cal.heure === h ? 'true' : 'false') + '">' + h + ' h</button>').join('') + '</div></div>';
    zone.innerHTML = html;
  }
  function poserCreneau() {
    if (cal.jour && cal.heure != null) {
      const dt = new Date(cal.jour.getFullYear(), cal.jour.getMonth(), cal.jour.getDate(), cal.heure);
      etat.creneau = { libelle: fmtJourLong.format(cal.jour) + ' à ' + cal.heure + ' h', iso: cleJour(cal.jour) + 'T' + String(cal.heure).padStart(2, '0') + ':00', quand: dt.toISOString() };
    } else etat.creneau = null;
    rendre();
  }
  zone.addEventListener('click', e => {
    const nav = e.target.closest('[data-cal]'), jour = e.target.closest('[data-jour]'), heure = e.target.closest('[data-heure]');
    if (nav) { cal.mois = new Date(cal.mois.getFullYear(), cal.mois.getMonth() + Number(nav.dataset.cal), 1); dessinerCalendrier(); }
    else if (jour && !jour.disabled) { const [a, mo, d] = jour.dataset.jour.split('-').map(Number); cal.jour = new Date(a, mo - 1, d); cal.heure = null; dessinerCalendrier(); poserCreneau(); }
    else if (heure && !heure.disabled) { cal.heure = Number(heure.dataset.heure); dessinerCalendrier(); poserCreneau(); }
  });

  // Les champs
  ['prenom', 'etab', 'tel'].forEach(n => document.querySelector('input[name=' + n + ']').addEventListener('input', e => { etat[n] = e.target.value.trim(); rendre(); }));
  document.querySelectorAll('input[name=metier]').forEach(r => r.addEventListener('change', () => { etat.metier = r.value; rendre(); }));

  const texteWhatsApp = type => {
    const qui = [etat.etab, etat.prenom].filter(Boolean).join(' — ');
    if (type === 'rdv' && !R.actif) return 'Bonjour, je réserve ' + (etat.creneau ? etat.creneau.libelle : 'un créneau') + (qui ? ' pour ' + qui : '') + (etat.tel ? '. Mon numéro : ' + etat.tel : '') + '.';
    if (type === 'rdv') return 'Bonjour, j\'ai réservé ' + (etat.creneau ? etat.creneau.libelle : 'un créneau') + (qui ? ' pour ' + qui : '') + '.';
    return 'Bonjour, j\'ai une question pour le site de mon établissement' + (etat.etab ? ' (' + etat.etab + ')' : '') + '.';
  };
  function rendre() {
    const rappel = document.querySelector('[data-creneau-rappel]');
    if (rappel) rappel.textContent = etat.creneau ? etat.creneau.libelle + '.' : '';
    document.querySelectorAll('[data-envoi]').forEach(a => a.href = 'https://wa.me/' + ((window.DEVANTURO && window.DEVANTURO.telephone) || '33614979604') + '?text=' + encodeURIComponent(texteWhatsApp(a.dataset.envoi)));
    try { localStorage.setItem(CLE, JSON.stringify({ metier: etat.metier, creneau: etat.creneau, prenom: etat.prenom, etab: etat.etab, tel: etat.tel, reservation: etat.reservation })); } catch (e) {}
  }
  // Ce que le navigateur se rappelle (on peut revenir plus tard : le créneau, le nom, la réservation faite)
  try {
    const m = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (m) {
      if (METIERS[m.metier]) { etat.metier = m.metier; const i = document.querySelector('input[name=metier][value=' + m.metier + ']'); if (i) i.checked = true; }
      ['prenom', 'etab', 'tel'].forEach(n => { if (typeof m[n] === 'string' && m[n]) { etat[n] = m[n].slice(0, 80); document.querySelector('input[name=' + n + ']').value = etat[n]; } });
      if (m.creneau && m.creneau.iso) {
        const [a, mo, d] = m.creneau.iso.slice(0, 10).split('-').map(Number), he = Number(m.creneau.iso.slice(11, 13)), date = new Date(a, mo - 1, d);
        if (HEURES.includes(he) && disponible(date, he)) { cal.jour = date; cal.heure = he; cal.mois = new Date(a, mo - 1, 1); etat.creneau = m.creneau; if (m.reservation && m.reservation.id) etat.reservation = m.reservation; }
      }
    }
  } catch (e) {}
  dessinerCalendrier();
  rendre();

  // L'assistant : le créneau, vous, c'est réservé
  const assistant = document.querySelector('[data-assistant]');
  if (assistant) {
    const etapes = [...assistant.querySelectorAll('.etape')], puces = [...assistant.querySelectorAll('.assistant-etapes li')];
    const retour = assistant.querySelector('[data-retour]'), suivant = assistant.querySelector('[data-suivant]'), reserver = assistant.querySelector('[data-reserver]'), erreur = assistant.querySelector('[data-erreur]');
    let i = 0;
    function aller(n, doux) {
      i = Math.max(0, Math.min(etapes.length - 1, n));
      etapes.forEach((e, k) => { e.hidden = k !== i; e.classList.toggle('actif', k === i); });
      puces.forEach((p, k) => { p.classList.toggle('actif', k === i); p.classList.toggle('fait', k < i); if (k === i) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current'); });
      retour.hidden = i !== 1; suivant.hidden = i !== 0; reserver.hidden = i !== 1; erreur.hidden = true;
      assistant.classList.toggle('reserve', i === 2);
      if (doux && anim) gsap.from(etapes[i], { autoAlpha: 0, x: 24, duration: .45, ease: 'power3.out', clearProps: 'all' });
      if (doux) { const r = assistant.getBoundingClientRect(); if (r.top < 60) assistant.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    const montrerErreur = t => { erreur.textContent = t; erreur.hidden = false; };
    suivant.addEventListener('click', () => { if (!etat.creneau) return montrerErreur('Choisissez d\'abord un jour, puis une heure.'); aller(1, true); });
    retour.addEventListener('click', () => aller(0, true));
    puces[0].addEventListener('click', () => aller(0, true));
    puces[1].addEventListener('click', () => { if (etat.creneau) aller(1, true); });
    zone.addEventListener('click', e => { const b = e.target.closest('[data-heure]'); if (b && !b.disabled) setTimeout(() => { if (i === 0) aller(1, true); }, 420); });
    function confirmer() {
      assistant.querySelector('[data-confirmation]').textContent = etat.creneau.libelle.replace(/^./, x => x.toUpperCase()) + ' · ' + etat.etab;
      assistant.querySelector('[data-ics]').href = R.ics({ id: etat.reservation.id, quand: etat.creneau.quand, etab: etat.etab });
    }
    // Sans serveur : rien n'est parti tout seul, la dernière étape est l'envoi du créneau sur WhatsApp (le message est prêt)
    if (!R.actif) {
      const titre = assistant.querySelector('[data-confirmation-titre]'), puceFin = assistant.querySelector('[data-puce-fin]'), suite1 = assistant.querySelector('[data-suite-1]');
      const ics = assistant.querySelector('[data-ics]'), wa = assistant.querySelector('[data-envoi="rdv"]');
      if (titre) titre.textContent = 'Il reste un clic.';
      if (puceFin) puceFin.textContent = 'On vous confirme';
      if (suite1) suite1.textContent = 'Envoyez-nous le créneau sur WhatsApp (le message est prêt), on vous confirme dans l\'heure.';
      if (wa) { wa.classList.add('principal'); wa.textContent = 'Envoyer le créneau sur WhatsApp'; wa.parentElement.prepend(wa); }
      if (ics) ics.classList.remove('principal');
    }
    reserver.addEventListener('click', async () => {
      if (!etat.creneau) return aller(0, true);
      if (!etat.etab || !etat.prenom) return montrerErreur('Il nous faut le nom de votre établissement et votre prénom.');
      if (etat.tel.replace(/\D/g, '').length < 9) return montrerErreur('Un numéro de téléphone, pour vous confirmer le rendez-vous.');
      reserver.disabled = true; reserver.textContent = 'Un instant…';
      const r = { quand: etat.creneau.quand, libelle: etat.creneau.libelle, etab: etat.etab, prenom: etat.prenom, tel: etat.tel, metier: etat.metier ? METIERS[etat.metier] : null };
      try {
        if (etat.reservation && etat.reservation.id) { await R.modifier(etat.reservation.id, r); etat.reservation = { ...etat.reservation, ...r }; }
        else { const l = await R.enregistrer(r); etat.reservation = { id: l.id, ...r }; }
        confirmer(); rendre(); aller(2, true);
      } catch (err) {
        if (err.code === 409) { pris.add(cleHeure(etat.creneau.quand)); etat.creneau = null; cal.heure = null; dessinerCalendrier(); rendre(); montrerErreur('Quelqu\'un vient de prendre ce créneau. Revenez au calendrier pour en choisir un autre.'); }
        else montrerErreur(err.message + ' Écrivez-nous sur WhatsApp, on le note à la main.');
      }
      reserver.disabled = false; reserver.textContent = 'Réserver';
    });
    assistant.querySelector('[data-modifier]').addEventListener('click', () => aller(0, true));
    if (etat.reservation && etat.creneau) { confirmer(); aller(2, false); } else aller(0, false);
    const etapeParam = parseInt(new URLSearchParams(location.search).get('etape'));   // ?etape=2 (débogage, captures)
    if (etapeParam >= 1 && etapeParam <= etapes.length) setTimeout(() => aller(etapeParam - 1, false), 0);
  }

  // ?coche=bar (débogage, captures) : coche un choix au chargement
  const coche = new URLSearchParams(location.search).get('coche');
  if (coche) coche.split(',').forEach(v => { const i = document.querySelector('input[value="' + v + '"]'); if (i && !i.disabled) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } });
  // ?seul=devis-debut (débogage, captures) : ne garde à l'écran que cette section
  const seul = new URLSearchParams(location.search).get('seul');
  if (seul && document.getElementById(seul)) document.querySelectorAll('.hero, .histoire, .bloc, .final, .pied').forEach(e => { if (e.id !== seul) e.style.display = 'none'; });
  // ?defile=2.2 place la page à 2,2 hauteurs de fenêtre après le chargement (captures automatiques), avec ou sans mise en scène
  const defile = parseFloat(new URLSearchParams(location.search).get('defile'));
  if (defile > 0) setTimeout(() => { window.scrollTo(0, innerHeight * defile); if (window.ScrollTrigger) ScrollTrigger.update(); }, 300);

  // Le thème : le bouton de l'en-tête, gardé dans le navigateur (le script en tête de page l'applique avant le premier rendu)
  const boutonTheme = document.querySelector('.theme');
  function appliquerTheme(t) {
    if (t === 'clair') html.setAttribute('data-theme', 'clair'); else html.removeAttribute('data-theme');
    boutonTheme.firstElementChild.textContent = t === 'clair' ? '☾' : '☀';
    boutonTheme.setAttribute('aria-label', t === 'clair' ? 'Passer en mode sombre' : 'Passer en mode clair');
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = t === 'clair' ? '#F6F4EF' : '#000000';
  }
  appliquerTheme(html.getAttribute('data-theme') === 'clair' ? 'clair' : 'sombre');
  boutonTheme.addEventListener('click', () => {
    const t = html.getAttribute('data-theme') === 'clair' ? 'sombre' : 'clair';
    appliquerTheme(t); try { localStorage.setItem('devanturo-theme', t); } catch (e) {}
  });

  // Les ancres glissent (le défilement natif est en « auto » pendant la mise en scène)
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const cible = document.querySelector(a.getAttribute('href'));
    if (!cible) return;
    e.preventDefault(); cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  if (!anim) return;

  /* ---------- L'entrée : fermer le portable, l'ouvrir au défilement, entrer dans l'écran ---------- */
  gsap.registerPlugin(ScrollTrigger);
  const scene = document.querySelector('.hero .scene'), mac = document.querySelector('.hero .macbook');
  const portrait = matchMedia('(orientation: portrait)').matches;   // téléphone tenu droit : voir echelle() et le CSS
  const pose = { lid: -88, rx: portrait ? -16 : -18, ry: portrait ? -10 : -16, s: 1, ty: 0 };
  function poser() {
    mac.style.setProperty('--lid', pose.lid + 'deg');
    mac.style.setProperty('--rx', pose.rx + 'deg');
    mac.style.setProperty('--ry', pose.ry + 'deg');
    scene.style.transform = 'translateY(' + pose.ty + 'px) scale(' + pose.s + ')';
  }
  poser();
  // Échelle qui fait remplir la fenêtre par l'écran (l'écran est au plan z = 0 quand tout est droit : 1 unité = 1 px).
  // Les dimensions réelles de l'écran (mises en page, hors transformations) : lire la variable CSS renvoyait « min(…) », donc 720 par défaut, donc un zoom trop court.
  const dims = () => { const e = document.querySelector('.ecran-int'); return { l: e.offsetWidth, h: e.offsetHeight }; };
  // Téléphone tenu droit : un écran 16/10 ne peut pas devenir une page ; il remplit la largeur, collé en haut, et le seuil
  // (même géométrie, voir le CSS) prend le relais par un fondu. Paysage : l'écran remplit toute la fenêtre.
  const echelle = () => { const { l, h } = dims(); return portrait ? innerWidth / l : Math.max(innerWidth / l, innerHeight / h) * 1.04; };
  // Le centre de l'écran par rapport au centre de la scène, hors transformations : la charnière est posée par le CSS, on la lit.
  const decalage = () => { const c = document.querySelector('.hero .couvercle'), { h } = dims(); return parseFloat(getComputedStyle(mac).top) - (c.offsetHeight - h) / 2 - h / 2 - scene.offsetHeight / 2; };
  const seuilHaut = () => parseFloat(getComputedStyle(html).getPropertyValue('--seuil-haut')) || 0;
  // Translation qui amène l'écran à sa place : au centre de la fenêtre (paysage), ou collé en haut, là où le seuil est posé (portrait).
  const centrer = () => { const s = echelle(), cible = portrait ? seuilHaut() + s * dims().h / 2 : innerHeight / 2; return cible - (scene.offsetTop + scene.offsetHeight / 2) - s * decalage(); };

  // Le titre entre mot par mot
  const titre = document.querySelector('.hero-titre');
  [...titre.childNodes, ...(titre.querySelector('em')?.childNodes || [])].filter(n => n.nodeType === 3).forEach(n => {
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach(m => { if (!m) return; if (/^\s+$/.test(m)) frag.append(m); else { const s = document.createElement('span'); s.className = 'mot'; s.textContent = m; frag.append(s); } });
    n.replaceWith(frag);
  });
  // L'entrée attend la fin du chargement : les trois fondus sont posés tout de suite (invisibles sous l'écran de chargement) et partent ensemble
  const entree = [
    gsap.from('.hero-titre .mot', { y: 24, autoAlpha: 0, duration: .8, stagger: .05, ease: 'power3.out', paused: true }),
    gsap.from('.hero-sous, .hero-indice', { autoAlpha: 0, y: 12, duration: .8, delay: .5, paused: true }),
  ];
  const fonduScene = gsap.from('.hero .scene', { autoAlpha: 0, duration: 1.2, delay: .2, ease: 'power2.out', paused: true });   // jamais de transform ici : poser() écrit le sien
  entree.push(fonduScene);

  /* ---------- L'écran de chargement ----------
     Il attend les polices, les sept téléphones et, en avance, les deux démos qui s'allumeront dans les écrans (mises en cache :
     au zoom, elles s'ouvrent sans à-coup). Jamais moins de 0,7 s (pas de clignotement), jamais plus de 5 s (le site ne reste pas bloqué). */
  const chargement = html.classList.contains('chargement');
  const lancerEntree = () => entree.forEach(t => t.play());
  if (!chargement) lancerEntree();
  else {
    const barre = document.querySelector('[data-chargement-barre]'), pc = document.querySelector('[data-chargement-pc]'), voile = document.querySelector('.ecran-chargement');
    const images = [...document.querySelectorAll('.hero .scene .demo img')];
    const avance = [...new Set(DEMOS.map(d => d.vivant))].concat(['demos/izakaya/assets/ramen.webp', 'demos/trattoria/assets/tagliatelle.webp']);
    const taches = [document.fonts ? document.fonts.ready : Promise.resolve()]
      .concat(images.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })))
      .concat(avance.map(u => fetch(u, { credentials: 'same-origin' }).then(r => r.blob()).catch(() => {})));
    let faites = 0;
    const montrer = v => { barre.style.transform = 'scaleX(' + (v / 100) + ')'; pc.textContent = Math.round(v); };
    taches.forEach(t => t.then(() => { faites++; montrer(faites / taches.length * 100); }));
    const debut = performance.now();
    let fini = false;
    // Sortie sans GSAP (minuteurs + transitions CSS) : même si les animations sont ralenties, l'écran part toujours
    const finir = () => {
      if (fini) return; fini = true; montrer(100);
      setTimeout(() => {
        voile.classList.add('sortie'); html.classList.remove('chargement');
        requestAnimationFrame(() => voile.classList.add('partie'));
        lancerEntree(); ScrollTrigger.refresh();
        setTimeout(() => voile.remove(), 1000);
      }, 280);
    };
    Promise.all(taches).then(() => setTimeout(finir, Math.max(0, 700 - (performance.now() - debut))));
    setTimeout(finir, 5000);
  }

  let introJouee = window.scrollY > innerHeight * .5, introEnCours = false;   // l'introduction automatique (plus bas)
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=260%', pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: self => { html.classList.toggle('dedans', self.progress > .76); if (self.progress > .2 && fonduScene.isActive()) fonduScene.progress(1).kill(); if (self.progress >= 1) introJouee = true; if (self.progress > .5 && !attente) attente = setTimeout(() => { attente = 0; veiller(); }, 200); } }
  });
  // En paysage, l'écran zoomé EST la page : rien ne se fond. En portrait, un écran 16/10 ne peut pas devenir une page de
  // téléphone : on fond alors vers le seuil, la même image posée pour la fenêtre.
  // Le passage de relais : sur le dernier cinquième de l'épinglage (RELAIS), tout ce qui est dans l'écran monte exactement à la
  // vitesse du défilement, et la section suivante (l'histoire, marge négative de la même hauteur) arrive collée dessous.
  // Quand l'épinglage lâche, la page continue à la même vitesse : pas de coup sec.
  const EPINGLE = 2.6, RELAIS = .18;                       // 260 % de fenêtre épinglés ; relais sur les 18 derniers %
  const relais = () => RELAIS * EPINGLE * innerHeight;     // en pixels de défilement = en pixels d'écran
  const histoire = document.querySelector('.histoire');
  const poserHistoire = () => histoire.style.marginTop = -relais() + 'px';
  poserHistoire();
  ScrollTrigger.addEventListener('refreshInit', poserHistoire);
  tl.to(pose, { lid: 8, duration: .38, ease: 'power2.inOut', onUpdate: poser }, 0)
    .to('.hero-texte', { autoAlpha: 0, y: -40, duration: .2 }, .12)
    .from('.hero .scene .demo', { y: '45%', autoAlpha: 0, duration: .22, stagger: .025, ease: 'power2.out' }, .16)
    .to(pose, { lid: 0, rx: 0, ry: 0, duration: .24, ease: 'power2.inOut', onUpdate: poser }, .44)
    .to('.hero .ombre', { autoAlpha: 0, duration: .08 }, .5)
    .to(pose, { s: echelle, ty: centrer, duration: .3, ease: 'power1.inOut', onUpdate: poser }, .52)   // le zoom : .52 → .82
    .to(['.hero .base', '.hero .couvercle-dos'], { autoAlpha: 0, duration: .12 }, .64)
    .to('.hero .ecran', { boxShadow: '0 0 0 0 #000', ...(portrait ? { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' } : {}), duration: .1 }, .64)
    .to('.hero .scene .compo-nav', { autoAlpha: 0, duration: .04 }, .74);   // dedans, l'en-tête réel prend le relais de la nav dessinée
  if (portrait) tl.to('.seuil', { autoAlpha: 1, duration: .05 }, .79).to('.hero .scene', { autoAlpha: 0, duration: .05 }, .82);   // le seuil reste en place, l'histoire vient le recouvrir
  else tl.to(pose, { ty: () => centrer() - relais(), duration: RELAIS, ease: 'none', onUpdate: poser }, 1 - RELAIS);

  if (/[?&]debug=1/.test(location.search)) setInterval(() => {
    const d = document.querySelector('.seuil .demo').getBoundingClientRect(), e = document.querySelector('.ecran-int').getBoundingClientRect();
    let z = document.getElementById('debug'); if (!z) { z = document.createElement('pre'); z.id = 'debug'; z.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99;margin:0;padding:4px;background:#ff0;color:#000;font:11px monospace'; document.body.append(z); }
    z.textContent = 'portrait ' + portrait + ' p ' + tl.scrollTrigger.progress.toFixed(2) + ' y ' + Math.round(scrollY) + ' seuil ' + getComputedStyle(document.querySelector('.seuil')).opacity + ' scene ' + getComputedStyle(scene).opacity + ' tel ' + [d.left, d.top, d.width].map(Math.round) + ' ecran ' + [e.left, e.top, e.width].map(Math.round);
  }, 300);

  /* ---------- L'introduction automatique : au premier geste vers le bas, la page glisse seule jusqu'au bout de l'entrée ---------- */
  // (le portable s'ouvre, on entre dans l'écran, l'écran devient la page), puis le visiteur reprend la main. Pendant qu'elle joue,
  // molette, doigt et touches de défilement sont neutralisés. Elle ne joue qu'une fois, et jamais si on arrive déjà plus bas.
  function jouerIntro() {
    if (introJouee || introEnCours) return;
    introEnCours = true; html.classList.add('intro');
    const o = { y: window.scrollY };
    gsap.to(o, { y: () => tl.scrollTrigger.end, duration: 3.4, ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, o.y),
      onComplete: () => { introEnCours = false; introJouee = true; html.classList.remove('intro'); } });
  }
  const enHaut = () => !introJouee && window.scrollY < innerHeight * .5;
  const charge = () => html.classList.contains('chargement');
  addEventListener('wheel', e => {
    if (introEnCours || charge()) { e.preventDefault(); return; }
    if (enHaut() && e.deltaY > 0) { e.preventDefault(); jouerIntro(); }
  }, { passive: false });
  let doigtY = null;
  addEventListener('touchstart', e => { doigtY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', e => {
    if (introEnCours || charge()) { e.preventDefault(); return; }
    if (enHaut() && doigtY != null && doigtY - e.touches[0].clientY > 6) { e.preventDefault(); jouerIntro(); }
  }, { passive: false });
  addEventListener('keydown', e => {
    const defile = ['ArrowDown', 'PageDown', ' ', 'Spacebar', 'ArrowUp', 'PageUp', 'End', 'Home'].includes(e.key);
    if (introEnCours || charge()) { if (defile) e.preventDefault(); return; }
    const champ = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (enHaut() && !champ && ['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); jouerIntro(); }
  });

  // L'intérieur : chaque bloc entre une fois
  gsap.utils.toArray('.bloc').forEach(b => {
    gsap.to(b, { autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 82%', once: true }, startAt: { y: 40 } });
  });
  // Hors de l'entrée (page rechargée plus bas), l'en-tête doit être là
  ScrollTrigger.create({ trigger: '.atelier', start: 'top 90%', onEnter: () => html.classList.add('dedans') });

  addEventListener('resize', () => ScrollTrigger.refresh());
  // Net à l'arrêt, fluide en mouvement : pendant le défilement, le portable garde sa couche GPU (will-change) ; à l'arrêt on la rend,
  // le navigateur redessine alors à la taille zoomée (sinon il agrandit l'image dessinée en petit : téléphones flous)
  const couches3d = [scene, document.querySelector('.hero .couvercle')].filter(Boolean);
  ScrollTrigger.addEventListener('scrollStart', () => couches3d.forEach(el => el.style.willChange = 'transform'));
  ScrollTrigger.addEventListener('scrollEnd', () => couches3d.forEach(el => el.style.willChange = 'auto'));
  setTimeout(() => couches3d.forEach(el => el.style.willChange = 'auto'), 1500);
  // ?aller=final : va directement à une section (captures de l'intérieur)
  const aller = new URLSearchParams(location.search).get('aller');
  if (aller && document.getElementById(aller)) setTimeout(() => document.getElementById(aller).scrollIntoView({ block: 'start' }), 400);
  // ?frise=0.75 fige l'entrée aux trois quarts (sans défiler) : pour vérifier chaque état en capture.
  const frise = parseFloat(new URLSearchParams(location.search).get('frise'));
  if (frise >= 0) setTimeout(() => { tl.scrollTrigger.disable(false); tl.progress(frise); html.classList.toggle('dedans', frise > .9); }, 300);
})();
