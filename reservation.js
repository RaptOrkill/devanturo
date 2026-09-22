/* Devanturo — les réservations : où elles sont rangées et comment on les lit. Trois modes, choisis par config.js :
   - « vps »      : le serveur du VPS (serveur/index.js), même origine ou apiUrl ; c'est lui qui sert le site en production.
   - « supabase » : une table Supabase (voir README).
   - rien         : mode démonstration, tout reste dans le navigateur (localStorage). */
window.Reservations = (function () {
  'use strict';
  const cfg = window.DEVANTURO || {};
  const mode = cfg.stockage === 'vps' ? 'vps' : (cfg.supabaseUrl && cfg.supabaseKey) ? 'supabase' : 'demo';
  const actif = mode !== 'demo';
  const CLE = 'devanturo-reservations';
  const api = chemin => (cfg.apiUrl || '').replace(/\/$/, '') + chemin;
  const sb = chemin => cfg.supabaseUrl.replace(/\/$/, '') + chemin;
  const lireLocal = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]'); } catch (e) { return []; } };
  const ecrireLocal = l => { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch (e) {} };
  const entetesSb = jeton => ({ 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + (jeton || cfg.supabaseKey) });
  const entetesVps = jeton => ({ 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) });
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
  async function lireErreur(rep, defaut) { try { const j = await rep.json(); return j.erreur || j.message || defaut; } catch (e) { return defaut; } }
  const erreur = (message, code) => { const e = new Error(message); e.code = code; return e; };

  // Une réservation : { quand (ISO UTC), libelle, etab, prenom, tel, metier }
  async function enregistrer(r) {
    if (mode === 'demo') { const l = lireLocal(); if (l.some(x => x.statut !== 'annule' && x.quand === r.quand)) throw erreur('Ce créneau vient d\'être pris.', 409); const ligne = { id: uuid(), cree_le: new Date().toISOString(), statut: 'a_confirmer', ...r }; l.push(ligne); ecrireLocal(l); return ligne; }
    if (mode === 'vps') {
      const rep = await fetch(api('/api/reservations'), { method: 'POST', headers: entetesVps(), body: JSON.stringify(r) });
      if (!rep.ok) throw erreur(await lireErreur(rep, 'La réservation n\'a pas pu être enregistrée (' + rep.status + ').'), rep.status);
      return { ...r, ...(await rep.json()) };
    }
    const ligne = { id: uuid(), statut: 'a_confirmer', ...r };
    const rep = await fetch(sb('/rest/v1/reservations'), { method: 'POST', headers: { ...entetesSb(), Prefer: 'return=minimal' }, body: JSON.stringify(ligne) });
    if (!rep.ok) throw new Error('La réservation n\'a pas pu être enregistrée (' + rep.status + ').');
    return ligne;
  }
  async function modifier(id, patch, jeton) {
    if (mode === 'demo') { const l = lireLocal(); if (patch.quand && l.some(x => x.id !== id && x.statut !== 'annule' && x.quand === patch.quand)) throw erreur('Ce créneau vient d\'être pris.', 409); ecrireLocal(l.map(r => r.id === id ? { ...r, ...patch } : r)); return; }
    if (mode === 'vps') {
      const rep = await fetch(api('/api/reservations/' + encodeURIComponent(id)), { method: 'PATCH', headers: entetesVps(jeton), body: JSON.stringify(patch) });
      if (!rep.ok) throw erreur(await lireErreur(rep, 'La modification a été refusée (' + rep.status + ').'), rep.status);
      return;
    }
    const rep = await fetch(sb('/rest/v1/reservations?id=eq.' + encodeURIComponent(id)), { method: 'PATCH', headers: { ...entetesSb(jeton), Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    if (!rep.ok) throw new Error('La modification a été refusée (' + rep.status + ').');
  }
  // Les créneaux déjà pris entre deux dates : des heures, rien d'autre (le calendrier les grise)
  async function creneauxPris(de, a) {
    if (mode === 'demo') return lireLocal().filter(x => x.statut !== 'annule' && x.quand >= de.toISOString() && x.quand <= a.toISOString()).map(x => x.quand);
    if (mode === 'vps') { const rep = await fetch(api('/api/creneaux?de=' + encodeURIComponent(de.toISOString()) + '&a=' + encodeURIComponent(a.toISOString()))); return rep.ok ? rep.json() : []; }
    try { const rep = await fetch(sb('/rest/v1/reservations?select=quand&statut=neq.annule&quand=gte.' + de.toISOString() + '&quand=lte.' + a.toISOString()), { headers: entetesSb() }); return rep.ok ? (await rep.json()).map(x => x.quand) : []; } catch (e) { return []; }
  }
  // L'équipe supprime un rendez-vous (demande d'effacement, doublon, erreur)
  async function supprimer(id, jeton) {
    if (mode === 'demo') { ecrireLocal(lireLocal().filter(r => r.id !== id)); return; }
    if (mode === 'vps') {
      const rep = await fetch(api('/api/reservations/' + encodeURIComponent(id)), { method: 'DELETE', headers: entetesVps(jeton) });
      if (!rep.ok) throw new Error(await lireErreur(rep, 'La suppression a été refusée (' + rep.status + ').'));
      return;
    }
    const rep = await fetch(sb('/rest/v1/reservations?id=eq.' + encodeURIComponent(id)), { method: 'DELETE', headers: { ...entetesSb(jeton), Prefer: 'return=minimal' } });
    if (!rep.ok) throw new Error('La suppression a été refusée (' + rep.status + ').');
  }
  async function lister(jeton) {
    if (mode === 'demo') return lireLocal().sort((a, b) => a.quand.localeCompare(b.quand));
    if (mode === 'vps') {
      const rep = await fetch(api('/api/reservations'), { headers: entetesVps(jeton) });
      if (!rep.ok) throw new Error(await lireErreur(rep, 'Lecture refusée (' + rep.status + ').'));
      return rep.json();
    }
    const rep = await fetch(sb('/rest/v1/reservations?select=*&order=quand.asc'), { headers: entetesSb(jeton) });
    if (!rep.ok) throw new Error('Lecture refusée (' + rep.status + ') : êtes-vous connecté ?');
    return rep.json();
  }
  // L'équipe se connecte : e-mail + mot de passe (VPS : ceux du .env ; Supabase : les comptes du projet ; démonstration : le mot de passe de config.js)
  async function connecter(email, mdp) {
    if (mode === 'demo') { if (mdp === (cfg.motDePasseDemo || 'devanturo')) return 'demo'; throw new Error('Mot de passe de démonstration incorrect.'); }
    if (mode === 'vps') {
      const rep = await fetch(api('/api/connexion'), { method: 'POST', headers: entetesVps(), body: JSON.stringify({ email, mdp }) });
      if (!rep.ok) throw new Error(await lireErreur(rep, 'E-mail ou mot de passe incorrect.'));
      return (await rep.json()).jeton;
    }
    const rep = await fetch(sb('/auth/v1/token?grant_type=password'), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseKey }, body: JSON.stringify({ email, password: mdp }) });
    if (!rep.ok) throw new Error('E-mail ou mot de passe incorrect.');
    return (await rep.json()).access_token;
  }
  // Un fichier d'agenda (.ics) pour un rendez-vous de trente minutes
  function ics(r) {
    const d = new Date(r.quand), f = new Date(d.getTime() + 30 * 60000);
    const t = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const texte = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Devanturo//Rendez-vous//FR', 'BEGIN:VEVENT', 'UID:' + r.id + '@devanturo', 'DTSTAMP:' + t(new Date()),
      'DTSTART:' + t(d), 'DTEND:' + t(f), 'SUMMARY:Devanturo — trente minutes pour ' + (r.etab || 'votre établissement'),
      'DESCRIPTION:Photos, carte, horaires, et le devis. Devanturo, 06 14 97 96 04.', 'LOCATION:' + (r.etab || 'Chez vous'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return URL.createObjectURL(new Blob([texte], { type: 'text/calendar' }));
  }
  return { mode, actif, enregistrer, modifier, supprimer, lister, creneauxPris, connecter, ics };
})();
