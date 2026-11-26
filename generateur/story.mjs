// La story de l’affiche de la semaine : la même programmation que l’affiche à imprimer (affiche.mjs), des mêmes données,
// en image verticale de 1080 × 1920 pour Instagram. Gratuite pour tout bar, même sans Baromatch : un bar la télécharge
// sur la page de l’affiche (/matchs/affiche/#story) et la publie en story.
// Dessinée en SVG, comme les images de partage (partage.mjs), avec la police du site (deux réglages de Bricolage
// Grotesque, generateur/images/polices), puis rendue en PNG par generateur/images/rendu.mjs, que seule l’Action installe :
// sans lui, ni story ni section sur la page. Deux fichiers à côté de l’affiche : story.png (l’image entière, celle qu’on
// télécharge) et story-apercu.png (270 × 480, le même dessin, celle que la page montre : elle se charge vite).
// La nuit, un verre de la marque, la police du site ; l’ambre pour une seule chose, les dates. Ni écusson, ni logo, ni
// score : les insignes Baromatch des clubs (insigne.mjs), des mots. Rien sur l’alcool, aucun « ! », aucune promesse
// (« sur Baromatch » ne s’y lit pas : elle va aussi dans des bars qui n’y sont pas).
// Les 270 px du haut et les 340 px du bas restent vides : Instagram y pose le nom du compte, ses boutons et la réponse.
// Au milieu, un panneau de verre avec les matchs, dans l’ordre des coups d’envoi, autant que la place en laisse (au moins
// un) ; s’il en reste, l’image le dit (« Et 6 autres matchs sur baromatch.fr/matchs ») et s’appelle « Les prochains
// matchs », avec les dates de ce qu’elle montre ; sinon, « Les matchs de la semaine » et les dates de la semaine de
// l’affiche. Une heure provisoire n’est pas écrite : « À confirmer ».
import { identifiantsUniques, insigne } from './insigne.mjs';
import { ajuster, AMBRE, BLANC, empreinteDuDessin, lesPolices, NUIT, raccourcir, verreDeLaCarte } from './partage.mjs';
import { echapper as e } from './texte.mjs';

export const LARGEUR_STORY = 1080;
export const HAUTEUR_STORY = 1920;
// Ce qu’Instagram recouvre : le haut (le compte) et le bas (la réponse et les boutons).
export const ZONE_LIBRE = { haut: 270, bas: 340 };
export const CHEMIN_DE_LA_STORY = '/matchs/affiche/story.png';
export const CHEMIN_DE_L_APERCU = '/matchs/affiche/story-apercu.png';
export const LARGEUR_DE_L_APERCU = 270;
export const HAUTEUR_DE_L_APERCU = 480;

// ---------- La mise en page (en unités de l’image, 1080 × 1920) ----------

const GAUCHE = 98; // le texte, aligné sur l’intérieur du panneau
const DROITE = 982;
const PANNEAU = { x: 70, largeur: 940, marge: 28, rayon: 36 };
const HAUT = ZONE_LIBRE.haut;
const BAS = HAUTEUR_STORY - ZONE_LIBRE.bas;
const TITRE = { max: 116, min: 80, base: HAUT + 86 }; // la ligne de base du titre, la même quelle que soit sa taille
const DATES = { taille: 46, base: TITRE.base + 66 };
const HAUT_DU_PANNEAU = DATES.base + 40;
const JOUR = { hauteur: 64, taille: 28 };
const LIGNE = { hauteur: 86, insigne: 56, ecart: 6 };
const RESTE = { taille: 36, ecart: 62 }; // sous le panneau : l’écart de sa ligne de base au bas du panneau
const PIED = { taille: 30, verre: 44, base: BAS - 8 };
// Le panneau finit au plus tard ici, avec ou sans la ligne « Et N autres matchs » dessous.
const LIMITE = { avecReste: PIED.base - PIED.verre - 44 - RESTE.ecart, sansReste: PIED.base - PIED.verre - 44 };

// La hauteur du panneau pour ces jours, chacun avec son nombre de matchs.
const hauteurDuPanneau = (matchsParJour) => 2 * PANNEAU.marge + matchsParJour.reduce((somme, n) => somme + JOUR.hauteur + n * LIGNE.hauteur, 0);

// Combien de matchs tiennent (au moins un, au plus tous) : les premiers, dans l’ordre, jour après jour.
export const combienTiennent = (jours) => {
  const total = jours.reduce((s, j) => s + j.length, 0);
  for (let k = total; k > 1; k -= 1) {
    const parJour = [];
    let reste = k;
    for (const j of jours) {
      if (reste <= 0) break;
      parJour.push(Math.min(reste, j.length));
      reste -= j.length;
    }
    if (HAUT_DU_PANNEAU + hauteurDuPanneau(parJour) <= (k < total ? LIMITE.avecReste : LIMITE.sansReste)) return k;
  }
  return Math.min(1, total);
};

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// ---------- Ce que dit la story (les données de l’affiche) ----------

// matchs : ceux de l’affiche (matchsDeLAffiche), dans l’ordre ; jourDe : le jour de Paris d’un coup d’envoi ; nomDuJour :
// « Vendredi 23 » ; heure : « 20:45 » ; datesDeLaSemaine : « Du vendredi 23 au jeudi 29 octobre » ; dates(premier,
// dernier) : celles de ce que la story montre ; textes : affiche.json, « story ». Rend null sans match.
export const donneesDeLaStory = ({ matchs, jourDe, nomDuJour, heure, datesDeLaSemaine, dates, textes }) => {
  if (!matchs.length) return null;
  const parJour = [];
  for (const m of matchs) {
    const jour = jourDe(m.debut);
    if (parJour.at(-1)?.jour !== jour) parJour.push({ jour, matchs: [] });
    parJour.at(-1).matchs.push(m);
  }
  const k = combienTiennent(parJour.map((j) => j.matchs));
  const gardes = [];
  let compte = 0;
  for (const j of parJour) {
    if (compte >= k) break;
    const pris = j.matchs.slice(0, k - compte);
    compte += pris.length;
    gardes.push({
      jour: j.jour,
      nom: nomDuJour(j.jour),
      matchs: pris.map((m) => ({
        debut: m.debut,
        heure: m.heureConfirmee ? heure(m.debut) : null,
        nom: `${m.domicile.court} – ${m.exterieur.court}`,
        competition: m.competition,
        domicile: m.domicile,
        exterieur: m.exterieur,
      })),
    });
  }
  const reste = matchs.length - k;
  const titre = reste ? textes.titreCourt : textes.titre;
  const lesDates = reste ? dates(gardes[0].jour, gardes.at(-1).jour) : datesDeLaSemaine;
  return {
    titre, dates: lesDates, jours: gardes, total: matchs.length, reste,
    resteTexte: reste ? remplir(reste === 1 ? textes.resteUn : textes.reste, { n: reste }) : '',
    aConfirmer: textes.aConfirmer, prepare: textes.prepare,
    alt: remplir(textes.alt, { titre, dates: lesDates.toLocaleLowerCase('fr-FR') }),
  };
};

// ---------- Le dessin ----------

const texte = (contenu, { x, y, police, taille, couleur, opacite = 1, espacement = 0 }) => `<text x="${x}" y="${y.toFixed(1)}" font-family="${police.famille}" font-size="${taille}" fill="${couleur}"${opacite < 1 ? ` fill-opacity="${opacite}"` : ''}${espacement ? ` letter-spacing="${(espacement * taille).toFixed(2)}"` : ''}>${e(contenu)}</text>`;

// largeur : celle de l’image dessinée (1080 pour l’image entière, 270 pour l’aperçu) ; le dessin garde ses unités.
export const svgDeLaStory = (story, { verre, largeur = LARGEUR_STORY }) => {
  const { titre: policeTitre, texte: policeTexte } = lesPolices();
  const propre = (t, police) => police.couvrir(String(t ?? ''));
  const hauteur = Math.round((largeur * HAUTEUR_STORY) / LARGEUR_STORY);
  const place = DROITE - GAUCHE;
  const dessins = [];

  // Le titre, sur une ligne, à la plus grande taille qui tient ; puis les dates, en ambre.
  const titre = ajuster(policeTitre, propre(story.titre, policeTitre), { max: TITRE.max, min: TITRE.min, espacement: -0.01, place });
  dessins.push(texte(titre.lignes[0], { x: GAUCHE, y: TITRE.base, police: policeTitre, taille: titre.taille, couleur: BLANC, espacement: -0.01 }));
  const dates = ajuster(policeTexte, propre(story.dates, policeTexte), { max: DATES.taille, min: 32, place });
  dessins.push(texte(dates.lignes[0], { x: GAUCHE, y: DATES.base, police: policeTexte, taille: dates.taille, couleur: AMBRE }));

  // Le panneau de verre, ses jours et ses lignes.
  const parJour = story.jours.map((j) => j.matchs.length);
  const hauteurPanneau = hauteurDuPanneau(parJour);
  const lignes = [];
  const insignes = [];
  let y = HAUT_DU_PANNEAU + PANNEAU.marge;
  const colonnes = { heure: GAUCHE, insignes: GAUCHE + 170 };
  const xNom = colonnes.insignes + 2 * LIGNE.insigne + LIGNE.ecart + 24;
  for (const jour of story.jours) {
    lignes.push(texte(propre(jour.nom, policeTexte).toLocaleUpperCase('fr-FR'), { x: GAUCHE, y: y + 38, police: policeTexte, taille: JOUR.taille, couleur: BLANC, opacite: 0.66, espacement: 0.08 }));
    lignes.push(`<rect x="${GAUCHE}" y="${y + 52}" width="${place}" height="1.5" fill="#FFFFFF" fill-opacity="0.14"/>`);
    y += JOUR.hauteur;
    for (const m of jour.matchs) {
      if (m.heure) lignes.push(texte(m.heure, { x: colonnes.heure, y: y + 54, police: policeTexte, taille: 46, couleur: BLANC }));
      else lignes.push(texte(propre(story.aConfirmer, policeTexte), { x: colonnes.heure, y: y + 52, police: policeTexte, taille: 30, couleur: BLANC, opacite: 0.8 }));
      const haut = y + (LIGNE.hauteur - LIGNE.insigne) / 2;
      const club = (c, x) => `<g transform="translate(${x} 0)">${insigne(c, { taille: LIGNE.insigne, fond: 'night' })}</g>`;
      insignes.push(`<g class="story-insignes" transform="translate(${colonnes.insignes} ${haut})">${club(m.domicile, 0)}${club(m.exterieur, LIGNE.insigne + LIGNE.ecart)}</g>`);
      const nom = ajuster(policeTexte, propre(m.nom, policeTexte), { max: 40, min: 30, place: DROITE - xNom });
      lignes.push(texte(nom.lignes[0], { x: xNom, y: y + 38, police: policeTexte, taille: nom.taille, couleur: BLANC }));
      const competition = raccourcir(policeTexte, propre(m.competition, policeTexte), 26, 0, DROITE - xNom);
      lignes.push(texte(competition, { x: xNom, y: y + 70, police: policeTexte, taille: 26, couleur: BLANC, opacite: 0.66 }));
      y += LIGNE.hauteur;
    }
  }
  const basDuPanneau = HAUT_DU_PANNEAU + hauteurPanneau;
  if (story.reste) {
    lignes.push(texte(propre(story.resteTexte, policeTexte), { x: GAUCHE, y: basDuPanneau + RESTE.ecart, police: policeTexte, taille: RESTE.taille, couleur: BLANC, opacite: 0.8 }));
  }

  // Le pied : le verre de la marque et la phrase de l’affiche, au bas de la zone libre.
  const pied = [
    verreDeLaCarte(verre, GAUCHE - 4, PIED.base - PIED.verre + 6, PIED.verre),
    texte(propre(story.prepare, policeTexte), { x: GAUCHE + PIED.verre + 10, y: PIED.base - 4, police: policeTexte, taille: PIED.taille, couleur: BLANC, opacite: 0.74 }),
  ];

  const corps = identifiantsUniques(insignes.join('\n'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${LARGEUR_STORY} ${HAUTEUR_STORY}">
<defs>
<radialGradient id="story-halo-bas" cx="540" cy="1500" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${AMBRE}" stop-opacity="0.26"/><stop offset="0.5" stop-color="${AMBRE}" stop-opacity="0.07"/><stop offset="1" stop-color="${AMBRE}" stop-opacity="0"/></radialGradient>
<radialGradient id="story-halo-haut" cx="140" cy="0" r="760" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.09"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="story-verre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.05"/></linearGradient>
<linearGradient id="story-reflet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.34"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${LARGEUR_STORY}" height="${HAUTEUR_STORY}" fill="${NUIT}"/>
<rect width="${LARGEUR_STORY}" height="${HAUTEUR_STORY}" fill="url(#story-halo-haut)"/>
<rect width="${LARGEUR_STORY}" height="${HAUTEUR_STORY}" fill="url(#story-halo-bas)"/>
<rect x="${PANNEAU.x}" y="${HAUT_DU_PANNEAU}" width="${PANNEAU.largeur}" height="${hauteurPanneau}" rx="${PANNEAU.rayon}" fill="url(#story-verre)" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1.5"/>
<rect x="${PANNEAU.x + PANNEAU.rayon}" y="${HAUT_DU_PANNEAU}" width="${PANNEAU.largeur - 2 * PANNEAU.rayon}" height="1.5" fill="url(#story-reflet)"/>
${dessins.join('\n')}
${lignes.join('\n')}
${corps}
${pied.join('\n')}
</svg>
`;
};

// Son image : l’empreinte de son dessin et du rendu (partage.mjs), pour la version dans l’adresse (« ?v=… ») et pour ne
// refaire le PNG que si le dessin change.
export const empreinteDeLaStory = (story, { verre, signature = '', largeur = LARGEUR_STORY }) => empreinteDuDessin(svgDeLaStory(story, { verre, largeur }), signature);
