/* Devanturo — mesure des contacts venus des annonces Google Ads, avec consentement (CNIL).
   Rien n'est chargé ni déposé tant que la personne n'a pas cliqué « Accepter » : pas de balise Google, pas de cookie.
   Une conversion = un vrai contact : WhatsApp, appel ou e-mail choisi dans « Prendre rendez-vous », numéro ou adresse copiés,
   lien tel:, mailto: ou wa.me qui part vraiment (pas les boutons qui ouvrent seulement le choix). Tant que CONVERSION est vide, ce fichier ne fait rien. */
(() => {
  'use strict';
  const BALISE = 'AW-18450376951';
  // Libellé de l'action de conversion « Contact depuis le site » (Google Ads > Objectifs > Conversions > l'action > Configurer la balise).
  const CONVERSION = 'KCd_CI_63fccEPfR6d1E';
  const CLE = 'devanturo-mesure'; // 'oui' | 'non' + date, dans ce navigateur seulement
  const DUREE = 180 * 24 * 3600 * 1000; // la question revient au bout de 6 mois (recommandation CNIL)
  if (!CONVERSION) return;

  const lire = () => {
    try { const v = JSON.parse(localStorage.getItem(CLE) || 'null'); return v && Date.now() - v.date < DUREE ? v.choix : null; } catch (_) { return null; }
  };
  const ecrire = choix => { try { localStorage.setItem(CLE, JSON.stringify({ choix, date: Date.now() })); } catch (_) { /* navigation privée */ } };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  let chargee = false;
  const charger = () => {
    if (chargee) return;
    chargee = true;
    gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${BALISE}`;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', BALISE);
  };

  const convertir = canal => { if (chargee) gtag('event', 'conversion', { send_to: `${BALISE}/${CONVERSION}`, event_label: canal }); };
  // Écoute en bulle sur le document : un bouton dont recit.js a empêché la navigation (il ouvre le choix) ne compte pas.
  document.addEventListener('click', e => {
    const cible = e.target.closest('a[href], button[data-copier]');
    if (!cible) return;
    if (cible.matches('button[data-copier]')) { convertir('copie'); return; }
    if (e.defaultPrevented) return;
    const h = cible.getAttribute('href');
    if (/^tel:/.test(h)) convertir('telephone');
    else if (/^mailto:/.test(h)) convertir('email');
    else if (/wa\.me\//.test(h) && !/text=.*recommander/.test(h)) convertir('whatsapp');
  });

  /* ---------- Le bandeau : sobre, deux boutons de même poids, jamais par-dessus le choix de rendez-vous ---------- */
  const bandeau = document.createElement('div');
  bandeau.className = 'cookies';
  bandeau.setAttribute('role', 'region');
  bandeau.setAttribute('aria-label', 'Cookies');
  bandeau.hidden = true;
  bandeau.innerHTML = '<p>J\'utilise un cookie Google Ads pour savoir si mes annonces amènent des restaurateurs. Rien d\'autre. '
    + '<a href="mentions-legales.html#cookies">En savoir plus</a></p>'
    + '<div class="cookies-actions"><button type="button" data-choix="non">Refuser</button><button type="button" data-choix="oui">Accepter</button></div>';
  document.body.appendChild(bandeau);
  bandeau.addEventListener('click', e => {
    const b = e.target.closest('[data-choix]');
    if (!b) return;
    ecrire(b.dataset.choix);
    bandeau.hidden = true;
    if (b.dataset.choix === 'oui') charger();
    else if (chargee) location.reload(); // retrait du consentement : la balise déjà chargée s'arrête au rechargement
  });
  // Lien « Cookies » du pied de page : rouvrir le bandeau pour changer d'avis.
  document.querySelectorAll('[data-cookies]').forEach(a => {
    a.hidden = false;
    a.addEventListener('click', e => { e.preventDefault(); bandeau.hidden = false; bandeau.querySelector('button').focus(); });
  });

  const choix = lire();
  if (choix === 'oui') charger();
  else if (choix === null) bandeau.hidden = false;
})();
