/* Code : RaptOrkill (Baptiste Ruin) · © 2026 */
/* Devanturo — réglages du site, pour le poste de travail et les aperçus.
   EN PRODUCTION, CE FICHIER N'EST PAS UTILISÉ : le serveur du VPS (serveur/index.js) sert son propre config.js, en mode « vps ».
   Ici, tant que rien n'est rempli, le site tourne en mode démonstration : les réservations restent dans le navigateur (localStorage),
   et admin.html s'ouvre avec le mot de passe de démonstration ci-dessous. */
window.DEVANTURO = {
  stockage: '',           // 'vps' pour parler au serveur (même origine, ou apiUrl), sinon Supabase si rempli, sinon démonstration
  apiUrl: '',             // ex. https://agence.devanturo.fr, si le site et l'API ne sont pas servis par le même serveur
  supabaseUrl: '',        // solution de secours sans VPS : voir README
  supabaseKey: '',
  formulaire: 'contact@devanturo.fr',   // sans serveur : réservations et demandes d'audit envoyées par e-mail (FormSubmit, à activer une fois par le lien reçu)
  goatcounter: '',        // mesure d'audience sans cookie : le code GoatCounter (ex. 'devanturo' pour devanturo.goatcounter.com), vide = aucune mesure
  motDePasseDemo: 'devanturo',   // mode démonstration seulement : ce n'est pas une vraie protection
  telephone: '33614979604'
};
