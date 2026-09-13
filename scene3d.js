/* Devanturo — le téléphone en vraie 3D, ses deux figurants et le portable de la démo (Three.js), posés par-dessus la mise en scène CSS.
   Jamais requis : sans lui la page est celle d'aujourd'hui. recit.js le charge après load + idle, seulement si
   html.anim, WebGL2 et import map. Le module LIT window.recit.etat (tweené par la frise GSAP) à chaque rendu :
   rien n'est accumulé, le même défilement donne toujours la même image. Retirer html.trois rend la page CSS.
   Les seuils de frise sont en UNITÉS (0 → 218, recit.frise.time(), repères dans recit.unites), jamais en fraction.
   Après la démo (≥ 120) il n'y a plus rien à dessiner : la suite du récit (comment ça se passe, offre, qui vous parle + questions, final) est en HTML. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DISTANCE = 1200;                 // = perspective: 1200px du CSS : au plan z = 0, 1 unité = 1 px
// Démo (82 → 120) : le téléphone WebGL est caché, seul le portable est rendu. La caméra recule (toujours 1 unité = 1 px au plan z = 0)
// pour une perspective douce : à 1200, l'avant du clavier (≈ 250 px devant l'écran) grossissait de 26 %.
const DISTANCE_PORTABLE = 3600;
const INCLINAISON_PORTABLE = 11;       // degrés : le portable est vu un peu de dessus (clavier visible, écran droit)
const ECHELLE_PORTABLE = 0.95;         // largeur du modèle = recit.portable().largeur × ce facteur (mesuré : à 1, la projection dépassait la boîte de 5,6 %)
const UNITE_PORTABLE = 50;             // frise : le GLB part au premier passage au-delà (chapitre 3, début du passage automatique vers la démo) — il entre à 82.
                                       // Plus de minuteur : il chargeait 105 Ko pendant la lecture du chapitre 2 (budget « avant les démos », CAP §14).
const UNITE_TENUE = 96;                // frise : flottement léger du portable de 96…
const UNITE_FIN_TENUE = 112;           // … à 112 (3D + pointeur fin) ; ensuite il ressort par la droite (112 → 120) et le canvas se masque
const BASE = { largeur: 220, hauteur: 470, epaisseur: 18, rayon: 34, biseau: 3 };
const ECRAN = { largeur: 208, hauteur: 458, rayon: 29 };
const SEUIL_LENT_MS = 45;              // p75 des intervalles d'échauffement au-delà duquel l'essai échoue (28 abandonnait sur un PC simplement occupé)
const REPRISES_MS = [3000, 6000];      // un essai raté se refait 3 s puis 6 s plus tard ; on ne renonce qu'après le troisième
const ATTENTE_FOCUS_MS = 8000;         // onglet visible mais sans focus (fenêtre voisine active) : on mesure quand même au bout de 8 s
const SEUIL_TRANSMISSION_MS = 20;      // p75 sous lequel le verre de vin aurait droit à la transmission (pointeur fin seulement)…
// … mais elle est coupée : mesuré à 1440×900 (GPU dédié), la passe de transmission redessine toute la scène (60 k → 117 k triangles)
// et fait passer une image de 1,3 ms à 7,0 ms, pour un effet invisible sur un verre de 150 px. Le verre transparent simple coûte 0,07 ms.
const TRANSMISSION_VERRE = false;
const SEUIL_ROUTE_MS = 33;             // moyenne glissante en route (90 images) au-delà de laquelle on rétrograde
const IMAGE_GELEE_MS = 200;            // une image plus longue n'est pas « lente » mais gelée (onglet caché, chargement) : écartée des mesures (CAP §14, I7)
// Figurants : mouvement au temps, lisible sur mobile comme sur ordinateur (fonction pure du temps, jamais accumulé).
const ROTATION_FOURCHETTE = 0.25;      // rad/s autour de son axe long
const ROTATION_ASSIETTE = 0.15;        // rad/s autour de son axe vertical
const AMPLITUDE_TACTILE = 0.6;         // flottement réduit sur écran tactile (et une image sur deux)
const FICHIER_FOURCHETTE = 'assets/3d/fourchette-b.opt.glb';   // vrai modèle (476 faces, 4 Ko) : plus crédible que la fourchette SAM (trois dents molles)
const FICHIER_COUTEAU = 'assets/3d/couteau.opt.glb';
const FICHIER_PLAT = 'assets/3d/assiette-plat.opt.glb';        // assiette garnie ; repli sur assiette.opt.glb si elle manque
const FICHIER_VERRE = 'assets/3d/verre.opt.glb';               // deux maillages : « Glass… » (verre) et « Wine » (vin)
const SEUIL_CLAVIER_PX = 120;          // variation de hauteur ignorée (clavier virtuel, barre d'URL)
const HAUTEUR_MINI = 520;
const rad = THREE.MathUtils.degToRad;
const gsap = window.gsap;

let recit, scene, camera, rendu, canvas;
let groupeTel, corps, verre, planRecherche, ombre, soleil, texEnv = null;
let gFourchette, gAssiette, axesFourchette, axesAssiette, sceneAssiette = null, materiauAssiette = null;
let gCouteau, axesCouteau, gVerreVin, axesVerreVin, ombreAssiette, materiauVerreVin = null, platGarni = false;
let fourchetteChargee = false, couteauCharge = false, verreCharge = false, assietteChargee = false, assietteDemandee = false, chargeur = null, chargeurPret = null;
let pointeurFin = false, demiCadence = false, p75Echauffement = Infinity, texOmbre = null;
let gPortable, axesPortable, ombrePortable, dalle = null, boiteDalle = null, portableCharge = false, portableDemande = false;
const coin = new THREE.Vector3();
let besoinRendu = true, enVue = true, termine = false, flotte = false, dpr = 1;
let dernierWs = 0, dernierHs = 0, dernierFondu = -1, derniereMaj = 0;
let sommeLent = 0, nbLent = 0, marcheLente = 0;
const pointeur = { x: 0, y: 0, cx: 0, cy: 0 };
const stats = { rendus: 0, redessins: 0 };  // redessins : passes de dessin de l'écran « recherche » (CAP §4.4 : ~21 par chapitre 2)
// Écran « recherche » : un seul canvas et une seule texture, redessinés seulement quand la frappe ou les résultats changent de palier.
const PALIERS_RESULTATS = 4;            // 4 paliers (demi-alpha puis plein, ligne après ligne) : 18 lettres + 4 paliers = 22 redessins au plus
let canvasRecherche = null, ctxRecherche = null, textureRecherche = null, lignesRecherche = [], imgsRecherche = [];
let lettresDessinees = -1, palierDessine = -1;
const nettoyages = [];                 // écouteurs et observateurs à défaire dans arreter()
const BLANC = new THREE.Color(0xffffff), AMBRE = new THREE.Color(0xFFBE6E);
const CREME = new THREE.Color(0xfff1de), CREME_CHAUD = new THREE.Color(0xffe2b8);
// Assiette garnie : teinte plus légère, la nourriture garde les couleurs du modèle ; la céramique reste blanc cassé.
// La lumière ambrée du chapitre 3 réchauffe déjà tout : sans compensation la céramique virait pêche. Teinte à peine froide
// quand la lumière monte, pour que l'assiette reste blanc cassé à l'écran (la nourriture garde ses couleurs).
const CREME_PLAT = new THREE.Color(0xffffff), CREME_PLAT_CHAUD = new THREE.Color(0xeaf0f6);
const couleurTampon = new THREE.Color();

/* ---------- Mesures : tout dérive de .scene (100svh, stable quand la barre d'URL bouge) ---------- */
const MQ = {};
const mq = q => (MQ[q] || (MQ[q] = matchMedia(q))).matches;   // les MediaQueryList sont gardés : mesures() tourne à chaque image
function mesures() {
  const Ws = recit.scene.clientWidth, Hs = recit.scene.clientHeight;
  const large = mq('(min-width: 760px)');
  // Copie EXACTE du tableau de hauteurs de .anim .tel (style.css, CAP §4.5) : modifier les deux ensemble,
  // sinon le téléphone WebGL et le téléphone HTML ne coïncident plus au fondu croisé (78–82 %).
  const Hp = mq('(min-width: 1920px)') ? Math.min(0.66 * Hs, 820)
    : mq('(min-width: 1440px)') ? Math.min(0.66 * Hs, 720)
      : mq('(min-width: 1024px)') ? Math.min(0.62 * Hs, 640)
        : large ? Math.min(0.56 * Hs, 520)
          : mq('(max-height: 699.98px)') ? Math.min(0.48 * Hs, 400)
            : mq('(min-height: 800px)') ? Math.min(0.56 * Hs, 520)   // mobile haut (M8), même palier que recit.js haut()
              : Math.min(0.52 * Hs, 470);
  return { Ws, Hs, W: recit.W(), H: recit.H(), Hp, large };
}
const fovPour = (Hs, d = DISTANCE) => 2 * Math.atan((Hs / 2) / d) * 180 / Math.PI;

/* ---------- Géométries ---------- */
// Rectangle arrondi (sens trigonométrique), pour le verre et l'écran.
function rectArrondi(w, h, r) {
  const s = new THREE.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}

// Galet : boîte arrondie à faces PLATES (coins de rayon r dans le plan, petit biseau b sur la tranche).
// RoundedBoxGeometry bornerait le rayon à l'épaisseur/2 : il faut la construire soi-même. Normales analytiques, lisses.
function construireGalet(w, h, r, ep, b, segArc = 10, segBiseau = 4) {
  const contour = [], normales = [];
  const cx = w / 2 - r, cy = h / 2 - r;
  [[cx, -cy, -Math.PI / 2], [cx, cy, 0], [-cx, cy, Math.PI / 2], [-cx, -cy, Math.PI]].forEach(([x, y, a0]) => {
    for (let i = 0; i <= segArc; i++) {
      const a = a0 + (i / segArc) * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      contour.push(x + r * c, y + r * s); normales.push(c, s);
    }
  });
  const N = contour.length / 2, z0 = ep / 2;
  const stations = [{ d: b, z: z0, no: 0, nz: 1 }];                       // bord de la face avant
  for (let k = 1; k <= segBiseau; k++) {                                  // biseau avant
    const t = (k / segBiseau) * Math.PI / 2;
    stations.push({ d: b - b * Math.sin(t), z: (z0 - b) + b * Math.cos(t), no: Math.sin(t), nz: Math.cos(t) });
  }
  stations.push({ d: 0, z: -(z0 - b), no: 1, nz: 0 });                    // tranche
  for (let k = 1; k <= segBiseau; k++) {                                  // biseau arrière
    const t = (k / segBiseau) * Math.PI / 2;
    stations.push({ d: b - b * Math.cos(t), z: -(z0 - b) - b * Math.sin(t), no: Math.cos(t), nz: -Math.sin(t) });
  }
  const S = stations.length;
  const pos = new Float32Array((S * N + 2) * 3), nor = new Float32Array((S * N + 2) * 3);
  stations.forEach((st, s) => {
    for (let i = 0; i < N; i++) {
      const o = (s * N + i) * 3, nx = normales[i * 2], ny = normales[i * 2 + 1];
      pos[o] = contour[i * 2] - st.d * nx; pos[o + 1] = contour[i * 2 + 1] - st.d * ny; pos[o + 2] = st.z;
      nor[o] = st.no * nx; nor[o + 1] = st.no * ny; nor[o + 2] = st.nz;
    }
  });
  const centreAvant = S * N, centreArriere = S * N + 1;
  pos.set([0, 0, z0], centreAvant * 3); nor.set([0, 0, 1], centreAvant * 3);
  pos.set([0, 0, -z0], centreArriere * 3); nor.set([0, 0, -1], centreArriere * 3);
  const idx = [];
  for (let s = 0; s < S - 1; s++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = s * N + i, bb = s * N + j, c = (s + 1) * N + j, d = (s + 1) * N + i;
    idx.push(a, c, bb, a, d, c);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(centreAvant, i, j);                                          // face avant (éventail, contour convexe)
    idx.push(centreArriere, (S - 1) * N + j, (S - 1) * N + i);            // face arrière
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

/* ---------- Le téléphone procédural : corps, verre, écran « recherche », dos, ombre ---------- */
function construireTelephone() {
  const g = new THREE.Group(); g.name = 'telephone'; g.rotation.order = 'ZYX';
  // Noir mat, sans clearcoat : le corps ne doit pas renvoyer la pièce comme un miroir (revue DA).
  const materiauCorps = new THREE.MeshStandardMaterial({ color: 0x131211, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.45 });
  // Verre de l'écran aux reflets adoucis ; les lentilles du dos gardent un verre plus brillant (clone).
  const materiauVerre = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.32, metalness: 0, envMapIntensity: 0.35 });
  const materiauLentille = materiauVerre.clone(); materiauLentille.roughness = 0.15; materiauLentille.envMapIntensity = 0.6;
  corps = new THREE.Mesh(construireGalet(BASE.largeur, BASE.hauteur, BASE.rayon, BASE.epaisseur, BASE.biseau), materiauCorps);
  corps.name = 'corps'; g.add(corps);
  const z = BASE.epaisseur / 2;
  verre = new THREE.Mesh(new THREE.ShapeGeometry(rectArrondi(ECRAN.largeur, ECRAN.hauteur, ECRAN.rayon), 6), materiauVerre);
  verre.name = 'verre'; verre.position.z = z + 0.2; g.add(verre);
  // Écran « recherche » : même forme, UV ramenés dans [0,1], texture dessinée plus tard (verre noir en attendant).
  const geoRecherche = new THREE.ShapeGeometry(rectArrondi(ECRAN.largeur, ECRAN.hauteur, ECRAN.rayon), 6);
  const uv = geoRecherche.attributes.uv, p = geoRecherche.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + ECRAN.largeur / 2) / ECRAN.largeur, (p.getY(i) + ECRAN.hauteur / 2) / ECRAN.hauteur);
  planRecherche = new THREE.Mesh(geoRecherche, new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  planRecherche.name = 'recherche'; planRecherche.position.z = z + 0.5; planRecherche.visible = false; g.add(planRecherche);
  // Dos : îlot photo et trois lentilles, visibles pendant la pirouette du chapitre 3. Aucun bouton, aucun logo.
  // x positif : vu de dos (pirouette à 165°), l'îlot apparaît à gauche du téléphone, comme sur un vrai appareil.
  const ilot = new THREE.Mesh(construireGalet(62, 62, 14, 6, 2, 6, 3), materiauCorps);
  ilot.name = 'ilot'; ilot.position.set(65, 190, -(z + 3) + 0.5); g.add(ilot);
  const geoLentille = new THREE.CylinderGeometry(9, 9, 2, 24);
  [[80, 205], [50, 205], [65, 175]].forEach(([x, y]) => {
    const l = new THREE.Mesh(geoLentille, materiauLentille);
    l.rotation.x = Math.PI / 2; l.position.set(x, y, -(z + 6) + 0.5 - 1); g.add(l);
  });
  return g;
}

function creerOmbre() {
  // Un seul canvas et une seule texture pour toutes les ombres (téléphone, portable, assiette).
  if (!texOmbre) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    // Ombre de contact : cœur dense, halo doux qui s'éteint au bord, jamais un disque net (revue DA).
    grd.addColorStop(0, 'rgba(20,19,17,.55)'); grd.addColorStop(0.55, 'rgba(20,19,17,.12)'); grd.addColorStop(1, 'rgba(20,19,17,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
    texOmbre = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.16 }));
  m.name = 'ombre'; m.renderOrder = -1; m.position.z = -40;
  return m;
}

/* ---------- La texture de l'écran « recherche », dessinée depuis le HTML de .ecran-recherche et redessinée au fil de la frise ---------- */
function arrondi(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
const texteRecherche = () => recit.texteRecherche || 'restaurant roubaix';
// Palier de la cascade des résultats : 0 (rien) → PALIERS_RESULTATS (les trois lignes pleines).
const palierResultats = resultats => Math.round(Math.min(1, Math.max(0, resultats)) * PALIERS_RESULTATS);
// Préparation, une seule fois : polices, images, canvas et texture ; puis un premier dessin à l'état courant de la frise (?nom= compris).
async function preparerEcranRecherche() {
  const source = recit.recherche;
  lignesRecherche = Array.from(source.querySelectorAll('.recherche-liste li'));
  // Les vignettes HTML sont des background-image : on dessine avec les <img> des cartes (mêmes fichiers, même ordre), un seul téléchargement.
  const imgsCartes = Array.from(document.querySelectorAll('.cartes .carte img'));
  imgsRecherche = lignesRecherche.map((li, i) => li.querySelector('img') || imgsCartes[i] || null);
  await Promise.all([
    document.fonts.load('500 26px "DM Sans"'), document.fonts.load('400 22px "DM Sans"'),
    ...imgsRecherche.map(i => (i && i.decode) ? i.decode().catch(() => null) : null)
  ]);
  if (termine) return;
  canvasRecherche = document.createElement('canvas'); canvasRecherche.width = 416; canvasRecherche.height = 916; // 208×458 à l'échelle 2
  ctxRecherche = canvasRecherche.getContext('2d');
  textureRecherche = new THREE.CanvasTexture(canvasRecherche);
  textureRecherche.colorSpace = THREE.SRGBColorSpace; textureRecherche.anisotropy = 1;
  const etat = recit.etat;
  dessinerEcranRecherche((etat.tape === undefined ? 1 : etat.tape) * texteRecherche().length, etat.resultats === undefined ? 1 : etat.resultats);
  planRecherche.material.map = textureRecherche; planRecherche.material.needsUpdate = true;
  besoinRendu = true;
}
// Dessin complet (moins de 3 ms) : n lettres de la recherche tapées (arrondi), résultats à l'alpha de leur palier.
function dessinerEcranRecherche(n, resultats) {
  const ctx = ctxRecherche; if (!ctx) return;
  const lettres = Math.round(n), palier = palierResultats(resultats), q = palier / PALIERS_RESULTATS;
  const texte = texteRecherche();
  lettresDessinees = lettres; palierDessine = palier;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f5f5f3'; ctx.fillRect(0, 0, 416, 916);
  ctx.fillStyle = '#000'; arrondi(ctx, 154, 24, 108, 28, 14); ctx.fill();                       // encoche
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.06)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;    // barre de recherche
  ctx.fillStyle = '#fff'; arrondi(ctx, 20, 80, 376, 76, 38); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.lineCap = 'round';                             // loupe dessinée
  ctx.beginPath(); ctx.arc(56, 118, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(66, 128); ctx.lineTo(80, 142); ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#222'; ctx.font = '400 26px "DM Sans", system-ui, sans-serif';
  const tape = texte.slice(0, Math.max(0, Math.min(texte.length, lettres)));
  ctx.fillText(tape, 100, 118);
  if (lettres < texte.length) {                                                                  // curseur, fixe : aucune animation hors frise
    ctx.fillStyle = '#333'; ctx.fillRect(102 + ctx.measureText(tape).width, 104, 2, 28);
  }
  lignesRecherche.forEach((li, i) => {
    const alpha = Math.min(1, Math.max(0, (q - i * 0.25) / 0.5));                                 // cascade : chaque ligne sur la moitié de la course
    if (alpha <= 0) return;
    const y = 200 + i * 132 + 8 * (1 - alpha), img = imgsRecherche[i];
    ctx.globalAlpha = alpha;
    ctx.save(); arrondi(ctx, 30, y, 80, 80, 12); ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const k = Math.max(80 / img.naturalWidth, 80 / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.drawImage(img, 30 + (80 - w) / 2, y + (80 - h) / 2, w, h);
    } else { ctx.fillStyle = '#e6e3dc'; ctx.fillRect(30, y, 80, 80); }
    ctx.restore();
    const b = li.querySelector('b'), small = li.querySelector('small');
    ctx.fillStyle = '#141311'; ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
    ctx.fillText(b ? b.textContent : '', 130, y + 24);
    ctx.fillStyle = '#666'; ctx.font = '400 22px "DM Sans", system-ui, sans-serif';
    ctx.fillText(small ? small.textContent : '', 130, y + 58);
    ctx.fillStyle = '#e9e9e6'; ctx.fillRect(30, y + 110, 356, 2);
  });
  ctx.globalAlpha = 1;
  textureRecherche.needsUpdate = true;
  besoinRendu = true;
  stats.redessins++;
}
// À chaque image : redessin seulement si le nombre de lettres ou le palier a changé, si l'écran est visible et l'onglet au premier plan.
function majEcranRecherche(etat) {
  if (!ctxRecherche || etat.tape === undefined || etat.ecran <= 0.01 || document.visibilityState !== 'visible') return;
  const n = etat.tape * texteRecherche().length;
  if (Math.round(n) === lettresDessinees && palierResultats(etat.resultats) === palierDessine) return;
  dessinerEcranRecherche(n, etat.resultats);
}

/* ---------- Éclairage : une pièce PMREM (RoomEnvironment 128) et un seul soleil, présents dès le départ ---------- */
function creerEclairage() {
  soleil = new THREE.DirectionalLight(0xffffff, 1.2); soleil.name = 'soleil';
  soleil.position.set(-450, 1000, 900); soleil.castShadow = false;
  scene.add(soleil); scene.add(soleil.target);
  try {
    const pmrem = new THREE.PMREMGenerator(rendu);
    const piece = new RoomEnvironment();
    texEnv = pmrem.fromScene(piece, 0.04, 0.1, 100, { size: 128 }).texture;
    scene.environment = texEnv; scene.environmentRotation.y = Math.PI / 4;
    piece.dispose(); pmrem.dispose();
  } catch (e) {
    texEnv = null; // cible flottante absente : lumière d'hémisphère à la place des reflets
    scene.add(new THREE.HemisphereLight(0xF6F4EF, 0x9a948a, 2.4));
    if (recit.local) console.debug('[3d] pas de PMREM', e);
  }
  // envMap assigné explicitement (sinon WebGLRenderer écrase envMapIntensity par scene.environmentIntensity) :
  // l'intensité se règle matériau par matériau, scene.environmentIntensity n'aurait aucun effet ici.
  groupeTel.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) brancherEnv(o.material, o.material.envMapIntensity); });
  rendu.toneMapping = THREE.NeutralToneMapping; rendu.toneMappingExposure = 1;
}
function brancherEnv(materiau, intensite) {
  if (!texEnv) return;
  materiau.envMap = texEnv; materiau.envMapIntensity = intensite;
  if (materiau.envMapRotation) materiau.envMapRotation.y = Math.PI / 4;
  materiau.needsUpdate = true;
}
// Chaleur du chapitre 3 : uniforms seulement, aucune lumière ajoutée ni retirée.
function appliquerLumiere(l) {
  soleil.color.copy(BLANC).lerp(AMBRE, l);
  soleil.intensity = 1.2 + 0.7 * l;
  soleil.position.x = -450 + 1050 * l;
  corps.material.envMapIntensity = 0.45 - 0.1 * l;
  if (materiauAssiette) materiauAssiette.color.copy(platGarni ? CREME_PLAT : CREME).lerp(platGarni ? CREME_PLAT_CHAUD : CREME_CHAUD, l);
}

/* ---------- Appliquer l'état de la frise : pose du téléphone, fondu croisé, figurants ---------- */
function appliquerPose(etat, m) {
  const s = (m.Hp / BASE.hauteur) * etat.scale;
  // .tel CSS : left 50 % / top 41 % de la scène, décalé de (x·W, y·H) ; ici l'origine est le centre, y vers le haut.
  groupeTel.position.set(etat.x * m.W, 0.09 * m.Hs - etat.y * m.H, 0);
  groupeTel.rotation.set(0, rad(etat.rotY) + pointeur.cx * rad(1.2) * (1 - etat.telCss), -rad(etat.rot));
  groupeTel.scale.setScalar(s);
  groupeTel.visible = etat.telCss < 1;                   // chapitres 4 et 5 : le téléphone HTML a la main, le WebGL ne dessine plus que le portable
  planRecherche.material.opacity = etat.ecran;
  planRecherche.visible = !!planRecherche.material.map && etat.ecran > 0.01;
  ombre.position.set(groupeTel.position.x, groupeTel.position.y - 0.62 * m.Hp * etat.scale, -40);
  ombre.scale.set(330 * s, 120 * s, 1);                 // large et plate : une ombre posée au sol, pas un halo
  ombre.material.opacity = 0.16 * (1 - etat.lumiere);
  ombre.visible = ombre.material.opacity > 0.01 && etat.telCss < 1;
}
// Fondu croisé WebGL → HTML (78 → 82) : deux propriétés personnalisées, écrites seulement quand la valeur change.
// Chapitre 5 : le canvas reste pleinement opaque pour le portable (le téléphone WebGL, lui, est déjà caché).
function appliquerFondu(telCss, portableVu = false) {
  const cle = telCss + (portableVu ? 10 : 0);
  if (Math.abs(cle - dernierFondu) < 0.004 && telCss !== 0 && telCss !== 1) return;
  if (cle === dernierFondu) return;
  dernierFondu = cle;
  recit.scene.style.setProperty('--tel-3d', portableVu ? '1' : (1 - telCss).toFixed(3));
  recit.telCorps.style.setProperty('--tel-css', telCss.toFixed(3));
}
// Fonction pure de l'état, du temps et du pointeur : jamais d'accumulation.
function placerFigurants(etat, t, m) {
  const mapRange = gsap.utils.mapRange;
  // Flottement au temps partout (tactile compris, amplitude réduite) ; parallaxe au pointeur seulement sur pointeur fin (pointeur.cx reste à 0 sinon).
  const amp = flotte ? (pointeurFin ? 1 : AMPLITUDE_TACTILE) : 0, tt = flotte ? t : 0;
  // Fourchette (chapitre 1) : collée au bord gauche du téléphone et un peu devant lui (z 120 : l'occlusion dit la 3D),
  // elle tourne lentement sur son axe long, flotte de ± 6 px, puis dérive vers la gauche en montant et sort avant les cartes.
  const f = etat.fourchette, L = Math.min(0.34 * m.Hp, 0.30 * m.W), pf = gFourchette;   // un peu plus grande qu'avant (0,30) : le vrai modèle est fin
  const demiLargeur = 0.9 * m.Hp * (BASE.largeur / BASE.hauteur) / 2;
  const d = recit.depart ? recit.depart() : { x: 0.12, y: 0.24 };   // pose du chapitre 1 : la fourchette reste collée au téléphone
  const x0 = d.x * m.W - demiLargeur - 0.12 * L;   // z 120 grossit de 11 % vers l'extérieur : le bord droit de la fourchette mord à peine sur le téléphone
  const y0 = (0.09 * m.Hs - d.y * m.H) - 0.10 * m.Hp;
  pf.scale.setScalar(L);
  pf.position.set(
    x0 - 0.35 * m.W * f + pointeur.cx * 8,
    y0 + 0.30 * m.H * f + Math.sin(tt * 0.9) * 6 * amp - pointeur.cy * 6,
    120);
  // Ordre XZY : la rotation y (défilement + temps) tourne la fourchette sur son axe long, avant l'inclinaison z dans le plan.
  pf.rotation.set(rad(8), rad(-18) + rad(36) * f + tt * ROTATION_FOURCHETTE, rad(16) + rad(12) * f + Math.sin(tt * 0.6) * 0.02 * amp);
  pf.visible = fourchetteChargee && f < 1 && pf.position.x > -0.5 * m.W - L;
  // Couteau : parallèle, un peu à gauche et plus bas, plus loin en profondeur (z 40, derrière la fourchette), même dérive et même rotation lente (déphasée).
  const pc = gCouteau;
  pc.scale.setScalar(L);
  pc.position.set(pf.position.x - 0.20 * L, pf.position.y - 0.07 * L + Math.sin(tt * 0.9 + 0.8) * 1.5 * amp, 40);
  pc.rotation.set(rad(8), pf.rotation.y + 0.6, pf.rotation.z);
  pc.visible = couteauCharge && pf.visible;
  // Assiette (chapitre 3) : en bas à gauche, rebord coupé par le bord du cadre, creux visible, dessous jamais montré.
  // Elle tourne lentement sur son axe vertical, se balance de ± 2° et flotte de ± 4 px.
  // Diamètre : 190 px au plus sur mobile ; sur grand écran il suit la hauteur (22 % : 198 px à 900, 238 px à 1080), sinon le plat garni paraissait perdu.
  const a = etat.assiette, D = Math.min(0.34 * m.W, m.large ? Math.max(190, 0.22 * m.Hs) : 190), pa = gAssiette;
  let y, echelle = 1;
  if (a < 0.27) y = mapRange(0, 0.27, -0.62 * m.H, -0.30 * m.H, a);
  else if (a < 0.73) y = mapRange(0.27, 0.73, -0.30 * m.H, -0.27 * m.H, a);
  else { y = mapRange(0.73, 1, -0.27 * m.H, -0.65 * m.H, a); echelle = 1 - 0.1 * (a - 0.73) / 0.27; }
  const De = D * echelle;
  pa.scale.setScalar(De);
  // Sur grand écran, l'assiette reste près de la colonne de texte au lieu de partir au bord (orpheline à 1440 et plus).
  // Partout, elle reste entière dans le cadre (le plat garni coupé au bord perdait sa lecture ; à 768 il l'était de moitié) : bord gauche ≥ 12 px.
  const xA = Math.max(m.large ? -(280 + 0.30 * D) : -0.40 * m.W, -0.5 * m.W + 0.72 * D);
  pa.position.set(xA + pointeur.cx * 6, y + Math.sin(tt * 0.7) * 4 * amp, -60);
  pa.rotation.set(0, 0, rad(-4) + Math.sin(tt * 0.5 + 1) * rad(2) * (flotte ? 1 : 0));
  if (sceneAssiette) sceneAssiette.rotation.y = rad(-10 + 30 * a) + tt * ROTATION_ASSIETTE;
  pa.visible = assietteChargee && a > 0 && a < 1 && pa.position.y > -0.5 * m.H - D / 2;
  // Ombre de contact : ellipse douce sous le bord bas de l'assiette (même texture que l'ombre du téléphone).
  ombreAssiette.position.set(pa.position.x, pa.position.y - 0.40 * De, -60 - 0.45 * De);
  ombreAssiette.scale.set(1.2 * De, 0.34 * De, 1);
  ombreAssiette.material.opacity = 0.2;
  ombreAssiette.visible = pa.visible;
  // Verre de vin : à droite de l'assiette et un peu plus haut, derrière elle en profondeur, même dérive, très légère rotation.
  const pv = gVerreVin;
  pv.scale.setScalar(De);
  pv.position.set(pa.position.x + 0.58 * De, pa.position.y + 0.22 * De + Math.sin(tt * 0.7 + 0.6) * 3 * amp, -110);
  pv.rotation.set(0, tt * 0.1, rad(2) + Math.sin(tt * 0.55) * rad(1.2) * (flotte ? 1 : 0));
  pv.visible = verreCharge && pa.visible;
}

/* ---------- Le portable du chapitre 5 : pose lue dans etat.portable, largeur donnée par recit.portable() ---------- */
function placerPortable(etat, t, m, tenue, u) {
  const P = etat.portable;
  if (!P) return;
  const info = recit.portable ? recit.portable() : null;
  const L = (info ? info.largeur : 0.4 * m.W) * P.scale * ECHELLE_PORTABLE;
  // Tenue (96 → 112) : ± 4 px et ± 0,6°, seulement pointeur fin ; fonction pure du temps, jamais accumulée.
  // L'amplitude monte et descend sur 2 unités à chaque bout : aucun saut quand la tenue commence ou que le portable repart.
  const k = tenue ? Math.min(1, Math.max(0, Math.min(u - UNITE_TENUE, UNITE_FIN_TENUE - u) / 2)) : 0;
  const fy = k * Math.sin(t * 0.8) * 4, fr = k * Math.sin(t * 0.55 + 1) * rad(0.6);
  gPortable.position.set(P.x * m.W, 0.09 * m.Hs - P.y * m.H + fy, 0);
  gPortable.rotation.set(rad(INCLINAISON_PORTABLE), rad(P.rotY) + fr, 0);
  gPortable.scale.setScalar(L);
  gPortable.visible = portableCharge && P.opacite > 0.01;
  // Ombre de contact : large, plate, sous la base (même dessin que celle du téléphone).
  ombrePortable.position.set(gPortable.position.x, gPortable.position.y - 0.36 * L, -0.5 * L);
  ombrePortable.scale.set(1.3 * L, 0.2 * L, 1);
  ombrePortable.material.opacity = 0.2 * Math.min(1, P.opacite);
  ombrePortable.visible = gPortable.visible;
}
// Le bouton transparent de recit.js suit le rectangle projeté de la dalle (coordonnées de la scène), seulement de 94 à 112.
function poserClicPortable(m) {
  if (!dalle || !gPortable.visible || !recit.placerClic || !recit.clicActif || !recit.clicActif()) return;
  dalle.updateWorldMatrix(true, false);
  let l = Infinity, h = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i < 8; i++) {
    coin.set(i & 1 ? boiteDalle.max.x : boiteDalle.min.x, i & 2 ? boiteDalle.max.y : boiteDalle.min.y, i & 4 ? boiteDalle.max.z : boiteDalle.min.z)
      .applyMatrix4(dalle.matrixWorld).project(camera);
    const x = (coin.x + 1) / 2 * m.Ws, y = (1 - coin.y) / 2 * m.Hs;
    l = Math.min(l, x); r = Math.max(r, x); h = Math.min(h, y); b = Math.max(b, y);
  }
  recit.placerClic({ left: l, top: h, width: r - l, height: b - h });
}
// Caméra : 1200 tant que le téléphone WebGL joue (fondu compris), 3600 quand il ne reste que le portable.
function reglerCamera(portableSeul, m) {
  const d = portableSeul ? DISTANCE_PORTABLE : DISTANCE;
  if (camera.position.z === d) return;
  camera.position.z = d; camera.fov = fovPour(m.Hs, d); camera.far = d + 4000; camera.updateProjectionMatrix();
}

/* ---------- Rendu à la demande, sur le ticker de GSAP (après la mise à jour des tweens) ---------- */
function rendre(temps, delta, frame) {
  if (termine) return;
  const etat = recit.etat;
  const u = recit.frise.time();
  if (!assietteDemandee && u > 30) demanderAssiette();
  if (!portableDemande && u > UNITE_PORTABLE) demanderPortable();
  const portableVu = portableCharge && !!etat.portable && etat.portable.opacite > 0.01;
  appliquerFondu(etat.telCss, portableVu);
  // Chapitre 4 et final : le téléphone HTML a la main, les figurants sont partis ; pendant la démo (82 → 120), le portable rallume le canvas.
  const rienAMontrer = etat.telCss >= 1 && !portableVu;
  canvas.classList.toggle('masque', rienAMontrer);
  if (rienAMontrer) { besoinRendu = false; return; }
  majEcranRecherche(etat);
  if (pointeurFin) {
    const dx = (pointeur.x - pointeur.cx) * 0.08, dy = (pointeur.y - pointeur.cy) * 0.08;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) { pointeur.cx += dx; pointeur.cy += dy; besoinRendu = true; }
  }
  const tenue = pointeurFin && flotte && portableVu && u >= UNITE_TENUE && u < UNITE_FIN_TENUE;
  // Tant qu'un figurant visible bouge (ou que le portable flotte), on rend : chaque image sur pointeur fin, une sur deux
  // sur tactile ou après rétrogradation. Plus rien de visible qui bouge : retour au rendu à la demande.
  const anime = (flotte && (gFourchette.visible || gAssiette.visible)) || tenue;
  if (anime && ((pointeurFin && !demiCadence) || frame % 2 === 0)) besoinRendu = true;
  if (!besoinRendu || !enVue || document.visibilityState !== 'visible') return;
  besoinRendu = false;
  const m = mesures();
  reglerCamera(etat.telCss >= 1, m);
  appliquerPose(etat, m);
  appliquerLumiere(etat.lumiere);
  placerFigurants(etat, temps, m);
  placerPortable(etat, temps, m, tenue, u);
  poserClicPortable(m);
  rendu.render(scene, camera);
  stats.rendus++;
  surveiller(delta);
}
// Surveillance en route : deux marches, jamais de retour en arrière (pas de clignotement).
function surveiller(delta) {
  // La frise ne bouge pas, onglet caché, ou image gelée > 200 ms (onglet revenu, ramasse-miettes) : mesure sans valeur, jamais comptée comme lente (I7).
  if (performance.now() - derniereMaj > 200 || delta > IMAGE_GELEE_MS || document.hidden) return;
  sommeLent += delta; nbLent++;
  if (nbLent < 90) return;
  const moyenne = sommeLent / nbLent; sommeLent = 0; nbLent = 0;
  if (moyenne <= SEUIL_ROUTE_MS) return;
  // Première marche : dpr 1, plus de parallaxe, figurants à une image sur deux (ils bougent toujours). L'arrêt « lent » ne vient qu'après.
  if (marcheLente === 0) { marcheLente = 1; rendu.setPixelRatio(1); pointeurFin = false; demiCadence = true; pointeur.cx = pointeur.cy = 0; besoinRendu = true; journal('rétrogradé dpr 1, moyenne', moyenne.toFixed(1), 'ms'); }
  else { journal('arrêt en route, moyenne', moyenne.toFixed(1), 'ms après la marche dpr 1'); arreter('lent'); }
}
// Les décisions de la 3D (échauffement, reprises, rétrogradation, arrêt) partent toujours dans console.debug : diagnostic sur n'importe quel PC.
const journal = (...args) => console.debug('[3d]', ...args);
// L'échauffement ne mesure que dans un onglet visible ET qui a le focus : un onglet en arrière-plan ou une autre fenêtre
// active donneraient des intervalles sans valeur. Visible sans focus pendant ATTENTE_FOCUS_MS : on mesure quand même.
function attendrePremierPlan() {
  return new Promise(resolve => {
    let visibleDepuis = 0;
    const verifier = () => {
      if (termine) { clearInterval(id); return resolve(false); }
      if (document.visibilityState !== 'visible') { visibleDepuis = 0; return; }
      if (!visibleDepuis) visibleDepuis = performance.now();
      if (document.hasFocus() || performance.now() - visibleDepuis > ATTENTE_FOCUS_MS) { clearInterval(id); resolve(true); }
    };
    const id = setInterval(verifier, 250);
    verifier();
  });
}
// Échauffement : 30 images rendues sous .masque, avant que quoi que ce soit soit visible.
// Rend le p75 des intervalles, null si la mesure ne vaut rien (onglet caché en route, image gelée > 250 ms), false si arrêté.
function echauffer() {
  return new Promise(resolve => {
    const intervalles = []; let precedent = performance.now(), n = 0, fini = false, garde = 0;
    const m = mesures();
    // Filet : aucune image pendant 1 s (onglet passé en arrière-plan, requestAnimationFrame gelé) → mesure sans valeur, on attendra le premier plan.
    const surveillerGel = () => { clearTimeout(garde); garde = setTimeout(() => { if (!fini) { fini = true; resolve(termine ? false : null); } }, 1000); };
    const pas = () => {
      if (fini) return;
      if (termine) { fini = true; clearTimeout(garde); return resolve(false); }
      const t = performance.now(); if (n > 0) intervalles.push(t - precedent); precedent = t;
      if (document.visibilityState !== 'visible') { fini = true; clearTimeout(garde); return resolve(null); }
      appliquerPose(recit.etat, m); appliquerLumiere(recit.etat.lumiere); rendu.render(scene, camera);
      surveillerGel();
      if (++n < 30) requestAnimationFrame(pas);
      else {
        fini = true; clearTimeout(garde);
        // Les images gelées (> 200 ms : onglet passé en arrière-plan, chargement d'une image, ramasse-miettes) ne sont pas « lentes » :
        // elles sont écartées (I7). S'il en reste moins de 20 valables sur 29, la mesure ne vaut rien (null : on recommence, sans compter d'essai).
        // Une série lente d'un bout à l'autre (entre 45 et 200 ms), elle, compte comme un essai raté.
        const valables = intervalles.filter(v => v <= IMAGE_GELEE_MS).sort((a, b) => a - b);
        if (valables.length < 20) return resolve(null);
        resolve(valables[Math.floor(valables.length * 0.75)]);
      }
    };
    surveillerGel();
    requestAnimationFrame(pas);
  });
}

/* ---------- Les deux figurants, chargés après html.trois (GLTFLoader + meshopt en import dynamique) ---------- */
// Un seul GLTFLoader + meshopt, importé une fois : figurants et portable l'attendent (l'assiette ou le portable peuvent être demandés avant la fourchette).
function obtenirChargeur() {
  return chargeurPret || (chargeurPret = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js')
  ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => {
    chargeur = new GLTFLoader(); chargeur.setMeshoptDecoder(MeshoptDecoder);
    return chargeur;
  }));
}
async function chargerFigurant(url, groupePose, preparer) {
  try {
    await obtenirChargeur();
    if (termine) return false;
    const gltf = await chargeur.loadAsync(new URL(url, document.baseURI).href);
    preparer(gltf.scene);
    const axes = groupePose.children[0];
    axes.add(gltf.scene);
    await rendu.compileAsync(scene, camera);
    gsap.fromTo(axes.scale, { x: 0.92, y: 0.92, z: 0.92 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'power2.out', onUpdate: () => { besoinRendu = true; } });
    besoinRendu = true;
    return true;
  } catch (e) {
    if (recit.local) console.debug('[3d] figurant absent', url, e);
    return false;
  }
}
// Normales : celles du fichier sont gardées (Int8 quantifiées, ne jamais les recalculer) ; seulement si elles manquent, on les calcule.
const normalesSiBesoin = o => { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); };
// Centre le modèle sur sa boîte et ramène la dimension choisie (axe 'x' | 'y' | 'z') à 1 : le groupe de pose porte ensuite la taille en px.
function normaliser(sc, axe, unite) {
  sc.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(sc), taille = b.getSize(new THREE.Vector3()), centre = b.getCenter(new THREE.Vector3());
  const k = 1 / (unite || taille[axe]);
  sc.scale.setScalar(k); sc.position.copy(centre).multiplyScalar(-k);
  return taille[axe];
}
// Inox satiné, partagé par la fourchette et le couteau : gris clair, aucun reflet clinquant, l'environnement de la pièce seulement.
let materiauInox = null;
const inox = () => {
  if (!materiauInox) { materiauInox = new THREE.MeshStandardMaterial({ color: 0xd4d3cf, metalness: texEnv ? 1 : 0.5, roughness: 0.45, side: THREE.DoubleSide }); brancherEnv(materiauInox, 0.9); }
  return materiauInox;
};
let longueurFourchette = 0;   // le couteau garde la proportion réelle (22 cm pour 20 cm de fourchette)
function preparerCouverts(sc, estCouteau) {
  sc.traverse(o => {
    if (!o.isMesh) return;
    normalesSiBesoin(o);
    const ancien = o.material; o.material = inox();
    if (ancien && ancien !== o.material) { if (ancien.map) ancien.map.dispose(); ancien.dispose(); }
  });
  // Axe long du modèle en Z : ramené à 1 (longueur = L px), puis Z → Y par le groupe d'axes.
  if (estCouteau) normaliser(sc, 'z', longueurFourchette || undefined);
  else longueurFourchette = normaliser(sc, 'z');
  (estCouteau ? axesCouteau : axesFourchette).rotation.x = -Math.PI / 2;
}
function preparerAssiette(sc) {
  sc.traverse(o => {
    if (!o.isMesh) return;
    normalesSiBesoin(o);
    materiauAssiette = o.material;                       // textures conservées (nourriture du plat garni), céramique teintée blanc cassé
    if (materiauAssiette.metalnessMap) materiauAssiette.metalness = 0;   // ORM du plat : aucune part métallique
    materiauAssiette.color.set(platGarni ? 0xffffff : 0xfff1de);
    brancherEnv(materiauAssiette, 0.7); materiauAssiette.needsUpdate = true;
  });
  sceneAssiette = sc;
  // Plus inclinée vers la caméra (42°, 30° avant) : le creux, le rebord et la nourriture se lisent, le dessous n'est jamais montré.
  axesAssiette.rotation.x = rad(42);
}
function preparerVerre(sc) {
  const verreFin = TRANSMISSION_VERRE && pointeurFin && p75Echauffement < SEUIL_TRANSMISSION_MS;
  sc.traverse(o => {
    if (!o.isMesh) return;
    normalesSiBesoin(o);
    const ancien = o.material;
    if (/wine|vin/i.test(o.name)) {
      o.material = new THREE.MeshStandardMaterial({ color: 0x5a1220, roughness: 0.25, metalness: 0 });
      brancherEnv(o.material, 0.6);
    } else {
      // Verre léger : transparent, sans écriture de profondeur, dessiné après l'assiette ; transmission seulement sur une machine rapide à pointeur fin.
      materiauVerreVin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0, depthWrite: false,
        transmission: verreFin ? 0.6 : 0, thickness: verreFin ? 0.5 : 0 });
      brancherEnv(materiauVerreVin, 0.8);
      o.material = materiauVerreVin; o.renderOrder = 2;
    }
    if (ancien) ancien.dispose();
  });
  // Hauteur du verre = 0,8 × le diamètre de l'assiette (22 cm pour 27 cm) : normalisé en hauteur, puis × 0,8.
  normaliser(sc, 'y');
  sc.scale.multiplyScalar(0.8); sc.position.multiplyScalar(0.8);
}
async function demanderAssiette() {
  if (assietteDemandee || termine) return;
  assietteDemandee = true;
  // Le verre part en même temps que l'assiette ; il n'apparaît qu'avec elle.
  chargerFigurant(FICHIER_VERRE, gVerreVin, preparerVerre).then(ok => { verreCharge = ok; besoinRendu = true; });
  platGarni = true;
  let ok = await chargerFigurant(FICHIER_PLAT, gAssiette, preparerAssiette);
  if (!ok && !termine) { platGarni = false; ok = await chargerFigurant('assets/3d/assiette.opt.glb', gAssiette, preparerAssiette); }
  assietteChargee = ok;
  if (ok) journal(platGarni ? 'assiette garnie' : 'assiette seule (plat garni absent)');
}
/* ---------- Le portable (chapitre 5) : portable.opt.glb (un maillage « Laptop-Mesh », 3 primitives) + braise-ordi.webp sur la dalle ---------- */
// Matériaux d'origine : « Image » = dalle (fond d'écran d'origine, jamais montré), « Keys » = clavier (inchangé), « PaletteMaterial001 » = le reste.
function preparerPortable(sc, texture) {
  // Normalisation depuis la Box3 : centre à l'origine, largeur = 1 (gPortable.scale porte ensuite la largeur en px).
  sc.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(sc), taille = b.getSize(new THREE.Vector3()), centre = b.getCenter(new THREE.Vector3());
  const k = 1 / taille.x;
  sc.scale.setScalar(k); sc.position.copy(centre).multiplyScalar(-k);
  sc.traverse(o => {
    if (!o.isMesh) return;
    const mt = o.material;
    if (mt.name === 'Image') {
      [mt.map, mt.emissiveMap].forEach(t => t && t.dispose()); mt.dispose();
      o.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      dalle = o;
      o.geometry.computeBoundingBox(); boiteDalle = o.geometry.boundingBox.clone();
    } else if (mt.name === 'Keys') {
      brancherEnv(mt, 0.5);
    } else {
      // Carrosserie : aluminium gris clair, sobre, aucun logo.
      if (mt.metalnessMap) { mt.metalnessMap.dispose(); mt.metalnessMap = null; mt.roughnessMap = null; }
      mt.metalness = 0.6; mt.roughness = 0.42;
      brancherEnv(mt, 0.9); mt.needsUpdate = true;
    }
  });
}
// La dalle réutilise l'<img> du portable CSS (déjà chargée avec html.demo-prete) : TextureLoader (requête CORS) téléchargeait
// braise-ordi.webp une seconde fois. Image absente ou pas chargée en 4 s : TextureLoader, comme avant.
function textureEcranPortable() {
  const img = document.querySelector('.portable-vitre img');
  const parFichier = () => new THREE.TextureLoader().loadAsync(new URL('assets/img/braise-ordi.webp', document.baseURI).href);
  if (!img || !img.decode || !document.documentElement.classList.contains('demo-prete')) return parFichier();
  return Promise.race([img.decode().then(() => true), new Promise(res => setTimeout(res, 4000, false))])
    .then(ok => { if (!ok || !img.naturalWidth) return parFichier(); const t = new THREE.Texture(img); t.needsUpdate = true; return t; })
    .catch(parFichier);
}
async function demanderPortable() {
  if (portableDemande || termine) return;
  portableDemande = true;
  try {
    await obtenirChargeur();
    if (termine) return;
    const [gltf, texture] = await Promise.all([
      chargeur.loadAsync(new URL('assets/3d/portable.opt.glb', document.baseURI).href),
      textureEcranPortable()
    ]);
    if (termine) { texture.dispose(); return; }
    // UV glTF : origine en haut à gauche, donc flipY false (comme les textures chargées par GLTFLoader).
    texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
    texture.anisotropy = Math.min(8, rendu.capabilities.getMaxAnisotropy());
    preparerPortable(gltf.scene, texture);
    axesPortable.add(gltf.scene);
    await rendu.compileAsync(scene, camera);
    if (termine) return;
    portableCharge = true;
    document.documentElement.classList.add('portable-3d');   // le portable CSS s'efface (style.css)
    besoinRendu = true;
    if (recit.local) console.debug('[3d] portable prêt');
  } catch (e) {
    if (recit.local) console.debug('[3d] portable absent', e);
  }
}

// Lancé dès que l'éclairage existe, pendant l'échauffement : la fourchette est prête quand html.trois arrive,
// au lieu d'apparaître quand l'introduction a déjà quitté le chapitre 1.
async function chargerFigurants() {
  await obtenirChargeur();
  if (termine) return;
  const comparer = recit.local && new URLSearchParams(location.search).get('fourchette') === 'sam'; // comparaison locale : ?fourchette=sam
  fourchetteChargee = await chargerFigurant(comparer ? 'assets/3d/fourchette.opt.glb' : FICHIER_FOURCHETTE, gFourchette, sc => preparerCouverts(sc, false));
  if (fourchetteChargee && !termine && !comparer) couteauCharge = await chargerFigurant(FICHIER_COUTEAU, gCouteau, sc => preparerCouverts(sc, true));
}

/* ---------- Canvas, renderer, caméra, surveillance ---------- */
function creerCanvas() {
  canvas = document.createElement('canvas');
  canvas.className = 'scene3d masque'; canvas.setAttribute('aria-hidden', 'true');
  recit.scene.insertBefore(canvas, recit.tel);
}
function creerRendu() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // plafond unique : au-delà, les pixels coûtent plus que le MSAA n'apporte
  rendu = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default', stencil: false });
  rendu.setPixelRatio(dpr);
  rendu.setClearColor(0x000000, 0);
  rendu.shadowMap.enabled = false;
  rendu.debug.checkShaderErrors = !!recit.local && /[?&]debug3d/.test(location.search); // sinon le pilote D3D bavarde dans la console
}
function creerCamera(m) {
  camera = new THREE.PerspectiveCamera(fovPour(m.Hs), m.Ws / m.Hs, 50, 5000);
  camera.position.set(0, 0, DISTANCE); camera.lookAt(0, 0, 0);
}
function redimensionner() {
  if (termine) return;
  const m = mesures();
  if (m.Hs < HAUTEUR_MINI) return arreter('basse');
  if (m.Ws === dernierWs && Math.abs(m.Hs - dernierHs) < SEUIL_CLAVIER_PX) return; // clavier virtuel, barre d'URL
  dernierWs = m.Ws; dernierHs = m.Hs;
  rendu.setSize(m.Ws, m.Hs, false);
  camera.aspect = m.Ws / m.Hs; camera.fov = fovPour(m.Hs, camera.position.z); camera.updateProjectionMatrix();
  besoinRendu = true;
}
function surveillerPage() {
  const tl = recit.frise;
  const avant = tl.eventCallback('onUpdate');
  tl.eventCallback('onUpdate', () => { avant && avant(); besoinRendu = true; derniereMaj = performance.now(); });
  nettoyages.push(() => tl.eventCallback('onUpdate', avant || null));

  const ro = new ResizeObserver(redimensionner); ro.observe(recit.scene);
  nettoyages.push(() => ro.disconnect());

  const io = new IntersectionObserver(entrees => { entrees.forEach(e => { enVue = e.isIntersecting; }); if (enVue) besoinRendu = true; });
  io.observe(document.getElementById('recit'));
  nettoyages.push(() => io.disconnect());

  const surVisibilite = () => { if (document.visibilityState === 'visible') besoinRendu = true; };
  document.addEventListener('visibilitychange', surVisibilite);
  nettoyages.push(() => document.removeEventListener('visibilitychange', surVisibilite));

  const surRefresh = () => { besoinRendu = true; };
  window.ScrollTrigger.addEventListener('refresh', surRefresh);
  nettoyages.push(() => window.ScrollTrigger.removeEventListener('refresh', surRefresh));

  const surPerte = e => { e.preventDefault(); arreter('contexte'); };
  canvas.addEventListener('webglcontextlost', surPerte);
  nettoyages.push(() => canvas && canvas.removeEventListener('webglcontextlost', surPerte));

  // Flottement et rotation des figurants au temps : partout (html.anim exclut déjà le mouvement réduit).
  // Parallaxe au pointeur et tenue du portable : pointeur fin seulement, jamais de gyroscope.
  flotte = true;
  if (pointeurFin) {
    const surPointeur = e => { pointeur.x = (e.clientX / window.innerWidth) * 2 - 1; pointeur.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener('pointermove', surPointeur, { passive: true });
    nettoyages.push(() => window.removeEventListener('pointermove', surPointeur));
  }
}

/* ---------- Démarrage et arrêt ---------- */
export async function demarrer(r) {
  if (recit || termine) return;
  recit = r;
  try {
    pointeurFin = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const m0 = mesures();
    if (m0.Hs < HAUTEUR_MINI || !document.documentElement.classList.contains('anim')) { termine = true; return; }
    creerCanvas();
    creerRendu();
    creerCamera(m0);
    dernierWs = m0.Ws; dernierHs = m0.Hs;
    rendu.setSize(m0.Ws, m0.Hs, false);
    scene = new THREE.Scene();
    groupeTel = construireTelephone(); scene.add(groupeTel);
    ombre = creerOmbre(); scene.add(ombre);
    gFourchette = new THREE.Group(); gFourchette.name = 'fourchette'; axesFourchette = new THREE.Group(); gFourchette.add(axesFourchette); gFourchette.visible = false; scene.add(gFourchette);
    gCouteau = new THREE.Group(); gCouteau.name = 'couteau'; axesCouteau = new THREE.Group(); gCouteau.add(axesCouteau); gCouteau.visible = false; scene.add(gCouteau);
    gFourchette.rotation.order = gCouteau.rotation.order = 'XZY';   // rotation y (axe long) appliquée avant l'inclinaison
    gAssiette = new THREE.Group(); gAssiette.name = 'assiette'; axesAssiette = new THREE.Group(); gAssiette.add(axesAssiette); gAssiette.visible = false; scene.add(gAssiette);
    ombreAssiette = creerOmbre(); ombreAssiette.name = 'ombre-assiette'; ombreAssiette.visible = false; scene.add(ombreAssiette);
    gVerreVin = new THREE.Group(); gVerreVin.name = 'verre-vin'; axesVerreVin = new THREE.Group(); gVerreVin.add(axesVerreVin); gVerreVin.visible = false; scene.add(gVerreVin);
    gPortable = new THREE.Group(); gPortable.name = 'portable'; axesPortable = new THREE.Group(); gPortable.add(axesPortable); gPortable.visible = false; scene.add(gPortable);
    ombrePortable = creerOmbre(); ombrePortable.name = 'ombre-portable'; ombrePortable.visible = false; scene.add(ombrePortable);
    appliquerPose(recit.etat, m0);      // l'état est déjà positionné par le scrub (?nom= compris)
    appliquerFondu(recit.etat.telCss);
    if (recit.local) exposerDebug();

    await new Promise(res => ('requestIdleCallback' in window ? requestIdleCallback(res, { timeout: 1500 }) : setTimeout(res, 200)));
    if (termine) return;
    creerEclairage();
    const figurantsPrets = chargerFigurants().catch(e => { journal('figurants', e); });   // en parallèle de l'échauffement
    await Promise.race([preparerEcranRecherche().catch(e => { if (recit.local) console.debug('[3d] écran recherche', e); }), new Promise(res => setTimeout(res, 1500))]);
    if (termine) return;
    await rendu.compileAsync(scene, camera);
    if (termine) return;

    // Échauffement robuste : onglet visible et au premier plan, seuil 45 ms, deux reprises (3 s puis 6 s) avant de renoncer.
    const forcerLent = (window.__scene3d && window.__scene3d.forcerLent) || (recit.local && /[?&]lent3d/.test(location.search));
    // Vérification locale des reprises : ?essaislents=N fait échouer les N premiers échauffements (N = 3 : repli CSS).
    const essaisLents = recit.local ? parseInt((location.search.match(/[?&]essaislents=(\d)/) || [])[1] || '0', 10) : 0;
    let p75 = null, essai = 0, invalides = 0;
    for (;;) {
      if (!(await attendrePremierPlan())) return;
      p75 = await echauffer();
      if (termine || p75 === false) return;
      if (p75 !== null && essai < essaisLents) p75 = SEUIL_LENT_MS + 10;
      if (forcerLent) { journal('lent forcé (?lent3d), p75', p75); return arreter('lent'); }
      if (p75 === null) { if (++invalides < 6) { journal('mesure sans valeur (onglet caché ou image gelée), on recommence'); continue; } p75 = SEUIL_LENT_MS + 1; }
      if (p75 <= SEUIL_LENT_MS) break;
      if (essai >= REPRISES_MS.length) { journal('échauffement lent, p75', p75.toFixed(1), 'ms au troisième essai : repli CSS'); return arreter('lent'); }
      journal('échauffement lent, p75', p75.toFixed(1), 'ms : nouvel essai dans', REPRISES_MS[essai] / 1000, 's');
      await new Promise(res => setTimeout(res, REPRISES_MS[essai++]));
      if (termine) return;
    }
    p75Echauffement = p75;

    // Même image : le canvas apparaît à la pose exacte où le téléphone CSS s'efface.
    surveillerPage();
    gsap.ticker.add(rendre);
    nettoyages.push(() => gsap.ticker.remove(rendre));
    canvas.classList.remove('masque');
    document.documentElement.classList.add('trois');
    besoinRendu = true;
    journal('actif, p75', p75.toFixed(1), 'ms, dpr', dpr, essai ? `(essai ${essai + 1})` : '');
    // recit.js retient l'introduction automatique jusqu'à ce signal (borné) : la fourchette doit se voir tourner au chapitre 1.
    figurantsPrets.then(() => { if (!termine) document.dispatchEvent(new CustomEvent('scene3d', { detail: { etat: 'pret' } })); });
    // L'assiette et le verre (≈ 520 Ko) : au premier passage de l'unité 30 (rendre()) ou 6 s après html.trois, jamais si la 3D a renoncé.
    const minuteurAssiette = setTimeout(demanderAssiette, 6000);
    nettoyages.push(() => clearTimeout(minuteurAssiette));
    // Le portable : au premier passage de l'unité UNITE_PORTABLE (rendre()), jamais au minuteur.
  } catch (e) {
    if (recit && recit.local) console.debug('[3d] erreur', e);
    arreter('erreur');
  }
}

export function arreter(raison) {
  if (termine) return;
  termine = true;
  document.documentElement.classList.remove('trois', 'portable-3d');   // en premier : le .tel-corps et le portable CSS réapparaissent à la pose que GSAP leur applique déjà
  if (recit) { recit.scene.style.removeProperty('--tel-3d'); recit.telCorps.style.removeProperty('--tel-css'); }
  nettoyages.splice(0).forEach(f => { try { f(); } catch (e) { /* rien */ } });
  if (scene) scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) [].concat(o.material).forEach(mt => { for (const k in mt) { const v = mt[k]; if (v && v.isTexture) v.dispose(); } mt.dispose(); });
  });
  if (texEnv) texEnv.dispose();
  if (rendu) { rendu.dispose(); if (raison !== 'contexte') rendu.forceContextLoss(); }
  if (canvas) canvas.remove();
  journal('arrêt', raison);
  document.dispatchEvent(new CustomEvent('scene3d', { detail: { etat: 'arret', raison } }));
}

/* ---------- Débogage (localhost seulement) ---------- */
function exposerDebug() {
  const versEcran = v => {
    const rect = recit.scene.getBoundingClientRect(), p = v.clone().project(camera);
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
  };
  const boite = nom => {
    const g = scene.getObjectByName(nom); if (!g || !g.visible) return null;
    g.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(g); if (b.isEmpty()) return null;
    const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let i = 0; i < 8; i++) {
      const c = versEcran(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      r.left = Math.min(r.left, c.x); r.right = Math.max(r.right, c.x); r.top = Math.min(r.top, c.y); r.bottom = Math.max(r.bottom, c.y);
    }
    r.width = r.right - r.left; r.height = r.bottom - r.top; return r;
  };
  window.__scene3d = {
    get rendu() { return rendu; }, get scene() { return scene; }, get camera() { return camera; }, get canvas() { return canvas; },
    etat: recit.etat, stats, forcerLent: false, arreter,
    get fourchette() { return gFourchette; }, get couteau() { return gCouteau; }, get sceneAssiette() { return sceneAssiette; }, get verreVin() { return gVerreVin; },
    figurants: () => ({ fourchette: fourchetteChargee, couteau: couteauCharge, assiette: assietteChargee, platGarni, verre: verreCharge, transmission: !!(materiauVerreVin && materiauVerreVin.transmission), p75: p75Echauffement, pointeurFin, demiCadence }),
    info: () => rendu.info.render,
    centreTel: () => versEcran(groupeTel.position),
    ecartTel: () => { const c = versEcran(groupeTel.position), b = recit.tel.getBoundingClientRect(); return Math.hypot(c.x - (b.left + b.width / 2), c.y - (b.top + b.height / 2)); },
    hauteurTel: () => { const m = mesures(), s = (m.Hp / BASE.hauteur) * recit.etat.scale; const h = versEcran(new THREE.Vector3(0, BASE.hauteur / 2 * s, 0).add(groupeTel.position)), b = versEcran(new THREE.Vector3(0, -BASE.hauteur / 2 * s, 0).add(groupeTel.position)); return b.y - h.y; },
    boite, mesures,
    portable: () => ({ charge: portableCharge, demande: portableDemande, dalle: !!dalle, visible: !!(gPortable && gPortable.visible), distance: camera.position.z }),
    demanderPortable
  };
}
