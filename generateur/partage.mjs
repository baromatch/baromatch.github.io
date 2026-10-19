// Le partage d’une page de match, de ville, de bar ou de « Ce soir » : son image d’aperçu (1200 × 630, celle que
// montrent WhatsApp, iMessage, X ou un moteur à côté du lien) et le bloc « Partager » de la page.
// L’image est d’abord un SVG, fait ici sans rien installer : la nuit #0A0B10, la lumière ambre du bar derrière une carte
// de verre, le verre de la marque, et le texte en Bricolage Grotesque (deux réglages fixes de la police du site, dans
// generateur/images/polices, sous licence OFL comme elle). Chaque ligne est mesurée sur la police elle-même pour tenir
// dans la carte : plus petite, puis sur deux lignes (le titre), puis coupée à la fin d’un mot (« … »). Le PNG est rendu
// ensuite par generateur/images/rendu.mjs, que seule l’Action installe : sans lui, la page garde l’image générale.
// Les chiffres sont les vrais : le nombre de vrais bars publiés qui diffusent le match, jamais « 0 bar ». Sans vrai bar,
// la carte ne promet rien : le match, son jour et son heure ; la ville, sans « Où regarder le match ». Ni écusson, ni
// logo de club ou de compétition, ni score : des mots.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { heureDeParis, jourEnLettres, quandEnLettres } from './heure.mjs';
import { adresseDe } from './jsonld.mjs';
import { accorder, capitale, echapper as e, enumerer, sansAccents } from './texte.mjs';

export const LARGEUR = 1200;
export const HAUTEUR = 630;
// Le poids que ne dépasse aucune image : un aperçu se charge vite, même sur un téléphone en 4G.
export const POIDS_MAX = 150 * 1024;
export const NOM_DU_FICHIER = 'partage.png';
export const DOSSIER_DES_POLICES = path.join(DOSSIER_GENERATEUR, 'images', 'polices');
export const TEXTES = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'partage.json'), 'utf8'));

const NUIT = '#0A0B10';
const BLANC = '#F7F7F9';
const AMBRE = '#FFB13D';

// ---------- Les deux polices, et la mesure d’un texte ----------

// Lu dans le fichier TrueType lui-même : l’unité de dessin (head), la largeur de chaque glyphe (hhea, hmtx) et le
// glyphe de chaque caractère (cmap, format 4 : tout le plan de base, qui suffit à la police du site).
const lirePolice = (fichier, famille) => {
  const octets = readFileSync(path.join(DOSSIER_DES_POLICES, fichier));
  const tables = {};
  for (let i = 0; i < octets.readUInt16BE(4); i += 1) {
    const entree = 12 + i * 16;
    tables[octets.toString('latin1', entree, entree + 4)] = octets.readUInt32BE(entree + 8);
  }
  const unite = octets.readUInt16BE(tables.head + 18);
  const nombreDeLargeurs = octets.readUInt16BE(tables.hhea + 34);
  const largeurDuGlyphe = (glyphe) => octets.readUInt16BE(tables.hmtx + 4 * Math.min(glyphe, nombreDeLargeurs - 1));
  const glyphes = new Map();
  const cmap = tables.cmap;
  for (let i = 0; i < octets.readUInt16BE(cmap + 2); i += 1) {
    const plateforme = octets.readUInt16BE(cmap + 4 + i * 8);
    const codage = octets.readUInt16BE(cmap + 6 + i * 8);
    const sous = cmap + octets.readUInt32BE(cmap + 8 + i * 8);
    if (plateforme !== 3 || codage !== 1 || octets.readUInt16BE(sous) !== 4) continue;
    const segments = octets.readUInt16BE(sous + 6) / 2;
    const fins = sous + 14;
    const debuts = fins + segments * 2 + 2;
    const deltas = debuts + segments * 2;
    const decalages = deltas + segments * 2;
    for (let s = 0; s < segments; s += 1) {
      const fin = octets.readUInt16BE(fins + s * 2);
      const debut = octets.readUInt16BE(debuts + s * 2);
      const delta = octets.readInt16BE(deltas + s * 2);
      const decalage = octets.readUInt16BE(decalages + s * 2);
      for (let code = debut; code <= fin && code !== 0xFFFF; code += 1) {
        let glyphe = 0;
        if (decalage === 0) glyphe = (code + delta) & 0xFFFF;
        else {
          const ou = decalages + s * 2 + decalage + (code - debut) * 2;
          const brut = octets.readUInt16BE(ou);
          glyphe = brut === 0 ? 0 : (brut + delta) & 0xFFFF;
        }
        if (glyphe) glyphes.set(code, glyphe);
      }
    }
  }
  return {
    famille,
    fichier: path.join(DOSSIER_DES_POLICES, fichier),
    // La largeur d’un texte à cette taille, l’espacement des lettres compris (sans crénage : un peu large, jamais trop
    // juste).
    largeur: (texte, taille, espacement = 0) => [...texte].reduce((somme, lettre) => somme + largeurDuGlyphe(glyphes.get(lettre.codePointAt(0)) ?? 0), 0) * taille / unite
      + Math.max(0, [...texte].length - 1) * espacement,
    // Un caractère que la police n’a pas (« ş », « ő ») : sa lettre sans accent, ou rien.
    couvrir: (texte) => [...texte].map((lettre) => {
      if (glyphes.has(lettre.codePointAt(0))) return lettre;
      const simple = sansAccents(lettre);
      return [...simple].every((l) => glyphes.has(l.codePointAt(0))) ? simple : '';
    }).join('').replace(/ {2,}/g, ' ').trim(),
  };
};

let polices = null;
// Les polices de l’image : le titre (opsz 96, graisse 800, largeur 75 : le titre resserré du site) et le texte (opsz 32,
// graisse 600, largeur 100).
export const lesPolices = () => {
  polices ??= {
    titre: lirePolice('bricolage-grotesque-titre.ttf', 'Bricolage Grotesque Titre'),
    texte: lirePolice('bricolage-grotesque-texte.ttf', 'Bricolage Grotesque Texte'),
  };
  return polices;
};

// ---------- Ce que dit l’image ----------

const nomCourt = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');

// Les vrais bars d’une liste de soirées (un bar compte une fois), et leurs villes, la plus fournie d’abord.
const barsEtVilles = (soirees) => {
  const bars = new Map(soirees.map((s) => [s.bar.id ?? s.bar.slug, s.bar]));
  const villes = new Map();
  for (const bar of bars.values()) villes.set(bar.ville.nom, (villes.get(bar.ville.nom) ?? 0) + 1);
  return { nombre: bars.size, villes: [...villes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([nom]) => nom) };
};

// Les lignes de la carte : un surtitre discret, le titre, une ligne blanche, une ligne ambre (facultative) ; et sa
// description pour qui ne voit pas l’image (alt, l’og:image:alt de la page).
export const lignesDeLaCarte = (partage, textes = TEXTES, textesDuSite = {}) => {
  const phrase = (...morceaux) => `${morceaux.filter(Boolean).join('. ')}.`;
  if (partage.sorte === 'match') {
    const { match, soirees } = partage;
    const { nombre, villes } = barsEtVilles(soirees);
    const verbe = nombre > 1 ? textes.match.diffusent : textes.match.diffuse;
    const statut = match.statut ? textesDuSite.match?.[match.statut] : null;
    const ambre = statut
      ?? (nombre === 0 ? ''
        : villes.length <= 2 ? `${accorder(nombre, 'bar')} ${verbe} à ${enumerer(villes)}`
          : `${accorder(nombre, 'bar')} ${verbe}`);
    const quand = quandEnLettres(match.debut, match.heureConfirmee);
    return {
      surtitre: match.competition, titre: nomCourt(match), ligne: capitale(quand), ambre,
      alt: phrase(`${nomCourt(match)}, ${match.competition}, ${quand}`, ambre),
    };
  }
  if (partage.sorte === 'ce-soir') {
    // « Ce soir » : le jour écrit en entier (jamais « ce soir » ni « demain » : l’image reste juste toute la journée, et
    // n’est refaite que si son texte change), les matchs de ce jour-là (un seul : son heure ; sinon leur nombre ; aucun :
    // « Pas de match annoncé »), et le vrai nombre de vrais bars, rien sans bar.
    const t = textes.ceSoir;
    const { jour, matchs } = partage;
    const joues = matchs.filter((m) => !m.statut);
    const montres = joues.length ? joues : matchs;
    const { nombre, villes } = barsEtVilles(joues.flatMap((m) => m.soirees));
    const seul = montres.length === 1 ? montres[0] : null;
    const heure = (m) => (m.heureConfirmee ? heureDeParis(m.debut) : 'heure à confirmer');
    const ligne = seul ? `${nomCourt(seul)} · ${seul.statut ? textesDuSite.match?.[seul.statut] ?? '' : heure(seul)}`
      : joues.length ? remplir(t.matchs, { matchs: accorder(joues.length, 'match', 'matchs') }) : t.rien;
    const verbe = nombre > 1 ? textes.match.diffusent : textes.match.diffuse;
    const ambre = nombre === 0 ? ''
      : seul && villes.length <= 2 ? `${accorder(nombre, 'bar')} ${verbe} à ${enumerer(villes)}`
        : seul ? `${accorder(nombre, 'bar')} ${verbe}`
          : remplir(t.bars, { bars: accorder(nombre, 'bar') });
    const surtitre = nombre ? t.surtitre : matchs.length ? t.surtitreSansBar : '';
    const titre = capitale(jourEnLettres(jour));
    return { surtitre, titre, ligne, ambre, alt: phrase(surtitre ? `${surtitre}, ${jourEnLettres(jour)}` : titre, ligne, ambre) };
  }
  if (partage.sorte === 'ville') {
    const { ville } = partage;
    const nombre = ville.bars.length;
    const prochaine = ville.soirees[0];
    // Sans vrai bar : « Les soirs de match » au-dessus du nom de la ville, et rien d’autre.
    const surtitre = nombre ? textes.ville.surtitre : textes.ville.sansBar;
    const ligne = nombre ? remplir(textes.ville.bars, { bars: accorder(nombre, 'bar') }) : '';
    const ambre = prochaine ? remplir(textes.ville.prochaine, { match: nomCourt(prochaine.match), quand: jourEnLettres(prochaine.match.debut) }) : '';
    return { surtitre, titre: ville.nom, ligne, ambre, alt: phrase(`${surtitre} à ${ville.nom}`, ligne, ambre) };
  }
  const { bar, prochaine } = partage;
  const ligne = prochaine ? remplir(textes.bar.prochaine, { match: nomCourt(prochaine.match) }) : textes.bar.sansSoiree;
  const ambre = prochaine ? capitale(quandEnLettres(prochaine.match.debut, prochaine.match.heureConfirmee)) : '';
  return { surtitre: bar.quartier, titre: bar.nom, ligne, ambre, alt: phrase(`${bar.nom}, ${bar.quartier}`, prochaine ? `${ligne}, ${ambre.toLocaleLowerCase('fr-FR')}` : ligne) };
};

// ---------- Le dessin ----------

const MARGE = 48;
const CARTE = { x: MARGE, y: MARGE, largeur: LARGEUR - 2 * MARGE, hauteur: HAUTEUR - 2 * MARGE, rayon: 44 };
const PLACE = CARTE.largeur - 2 * 64;

// Un texte trop long pour sa place, coupé à la fin d’un mot et terminé par « … ».
const raccourcir = (police, texte, taille, espacement, place) => {
  if (police.largeur(texte, taille, espacement) <= place) return texte;
  const mots = texte.split(' ');
  while (mots.length > 1) {
    mots.pop();
    const essai = `${mots.join(' ').replace(/[\s,;:.–—-]+$/u, '')}…`;
    if (police.largeur(essai, taille, espacement) <= place) return essai;
  }
  let lettres = [...texte];
  while (lettres.length > 1 && police.largeur(`${lettres.join('')}…`, taille, espacement) > place) lettres = lettres.slice(0, -1);
  return `${lettres.join('')}…`;
};

// Une ligne à la plus grande taille qui tient (de « max » à « min »), puis raccourcie si même « min » ne tient pas.
const ajuster = (police, texte, { max, min, espacement = 0, place = PLACE }) => {
  for (let taille = max; taille >= min; taille -= 2) {
    if (police.largeur(texte, taille, espacement * taille) <= place) return { lignes: [texte], taille };
  }
  return { lignes: [raccourcir(police, texte, min, espacement * min, place)], taille: min };
};

// Le titre : sur une ligne, grand ; sinon sur deux lignes, coupé entre deux mots là où les deux moitiés sont les plus
// égales (pour un match, de préférence après le tiret) ; sinon coupé proprement.
const ajusterLeTitre = (police, texte) => {
  const espacement = -0.01;
  const une = ajuster(police, texte, { max: 156, min: 116, espacement });
  if (police.largeur(une.lignes[0], une.taille, espacement * une.taille) <= PLACE && !une.lignes[0].endsWith('…')) return une;
  const mots = texte.split(' ');
  const coupes = mots.slice(1).map((_, i) => [mots.slice(0, i + 1).join(' '), mots.slice(i + 1).join(' ')])
    .filter(([a, b]) => !/^[–-]$/.test(b.split(' ')[0]) && !/^[–-]$/.test(a));
  // Pour chaque coupe, la plus grande taille où ses deux lignes tiennent (0 : jamais) ; la meilleure est la plus grande,
  // puis la plus égale. La coupe après le tiret d’un match passe devant, si elle ne rapetisse pas trop le titre.
  const tailleDe = (coupe) => {
    for (let taille = 112; taille >= 76; taille -= 2) if (coupe.every((l) => police.largeur(l, taille, espacement * taille) <= PLACE)) return taille;
    return 0;
  };
  const ecart = (coupe) => Math.abs(police.largeur(coupe[0], 100) - police.largeur(coupe[1], 100));
  const classees = coupes.map((c) => ({ c, taille: tailleDe(c) })).filter((x) => x.taille)
    .sort((a, b) => b.taille - a.taille || ecart(a.c) - ecart(b.c));
  if (classees.length) {
    const tiret = classees.find((x) => /\s[–-]$/.test(x.c[0]));
    const choisie = tiret && tiret.taille >= classees[0].taille - 16 ? tiret : classees[0];
    return { lignes: choisie.c, taille: choisie.taille };
  }
  const [premiere, ...reste] = mots;
  if (!reste.length) return { lignes: [raccourcir(police, texte, 76, espacement * 76, PLACE)], taille: 76 };
  const ligne1 = raccourcir(police, premiere, 76, espacement * 76, PLACE);
  return { lignes: [ligne1, raccourcir(police, reste.join(' '), 76, espacement * 76, PLACE)], taille: 76 };
};

// Le verre de la marque, ses dégradés renommés pour ce fichier, à la place et à la taille voulues.
const verreDeLaCarte = (verre, x, y, cote) => verre
  .replace(/\bpd-/g, 'pg-')
  .replace('<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">', `<svg x="${x}" y="${y}" width="${cote}" height="${cote}" viewBox="0 0 200 200">`);

const texte = (contenu, { y, police, taille, couleur, opacite = 1, espacement = 0 }) => `<text x="${LARGEUR / 2}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${police.famille}" font-size="${taille}" fill="${couleur}"${opacite < 1 ? ` fill-opacity="${opacite}"` : ''}${espacement ? ` letter-spacing="${(espacement * taille).toFixed(2)}"` : ''}>${e(contenu)}</text>`;

export const svgDeLaCarte = (lignesBrutes, { verre }) => {
  const { titre: policeTitre, texte: policeTexte } = lesPolices();
  const propre = (t, police) => police.couvrir(String(t ?? ''));
  const lignes = {
    surtitre: propre(lignesBrutes.surtitre, policeTexte),
    titre: propre(lignesBrutes.titre, policeTitre),
    ligne: propre(lignesBrutes.ligne, policeTexte),
    ambre: propre(lignesBrutes.ambre, policeTexte),
  };
  const surtitre = lignes.surtitre ? ajuster(policeTexte, lignes.surtitre, { max: 34, min: 26, espacement: 0.04 }) : null;
  const titre = ajusterLeTitre(policeTitre, lignes.titre);
  const ligne = lignes.ligne ? ajuster(policeTexte, lignes.ligne, { max: 50, min: 34 }) : null;
  const ambre = lignes.ambre ? ajuster(policeTexte, lignes.ambre, { max: 50, min: 34 }) : null;

  // La pile, centrée dans la carte sous la marque : chaque bloc a sa hauteur (les lettres capitales) et son écart.
  const interligneDuTitre = titre.taille * 0.94;
  const blocs = [
    surtitre && { hauteur: surtitre.taille * 0.72, ecart: 30, dessin: (y) => texte(surtitre.lignes[0], { y, police: policeTexte, taille: surtitre.taille, couleur: BLANC, opacite: 0.66, espacement: 0.04 }) },
    {
      hauteur: titre.taille * 0.74 + interligneDuTitre * (titre.lignes.length - 1),
      ecart: 40,
      dessin: (y) => titre.lignes.map((l, i) => texte(l, { y: y - interligneDuTitre * (titre.lignes.length - 1 - i), police: policeTitre, taille: titre.taille, couleur: BLANC })).join('\n'),
    },
    ligne && { hauteur: ligne.taille * 0.72, ecart: 26, dessin: (y) => texte(ligne.lignes[0], { y, police: policeTexte, taille: ligne.taille, couleur: BLANC, opacite: 0.8 }) },
    ambre && { hauteur: ambre.taille * 0.72, ecart: 0, dessin: (y) => texte(ambre.lignes[0], { y, police: policeTexte, taille: ambre.taille, couleur: AMBRE }) },
  ].filter(Boolean);
  blocs.at(-1).ecart = 0;
  const haut = 150;
  const bas = CARTE.y + CARTE.hauteur - 44;
  const total = blocs.reduce((s, b) => s + b.hauteur + b.ecart, 0);
  let y = haut + (bas - haut - total) / 2;
  const dessins = blocs.map((b) => {
    y += b.hauteur;
    const dessin = b.dessin(y);
    y += b.ecart;
    return dessin;
  });

  const marque = 'Baromatch';
  const tailleMarque = 34;
  const coteVerre = 52;
  const largeurMarque = coteVerre + 12 + policeTexte.largeur(marque, tailleMarque);
  const xMarque = (LARGEUR - largeurMarque) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}">
<defs>
<radialGradient id="carte-halo-bas" cx="600" cy="700" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${AMBRE}" stop-opacity="0.42"/><stop offset="0.45" stop-color="${AMBRE}" stop-opacity="0.12"/><stop offset="1" stop-color="${AMBRE}" stop-opacity="0"/></radialGradient>
<radialGradient id="carte-halo-haut" cx="120" cy="-40" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="carte-verre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.05"/></linearGradient>
<linearGradient id="carte-reflet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.34"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${LARGEUR}" height="${HAUTEUR}" fill="${NUIT}"/>
<rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#carte-halo-haut)"/>
<rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#carte-halo-bas)"/>
<rect x="${CARTE.x}" y="${CARTE.y}" width="${CARTE.largeur}" height="${CARTE.hauteur}" rx="${CARTE.rayon}" fill="url(#carte-verre)" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1.5"/>
<rect x="${CARTE.x + CARTE.rayon}" y="${CARTE.y}" width="${CARTE.largeur - 2 * CARTE.rayon}" height="1.5" fill="url(#carte-reflet)"/>
${verreDeLaCarte(verre, xMarque.toFixed(1), 70, coteVerre)}
<text x="${(xMarque + coteVerre + 12).toFixed(1)}" y="${70 + coteVerre / 2 + tailleMarque * 0.36}" font-family="${policeTexte.famille}" font-size="${tailleMarque}" fill="${BLANC}">${marque}</text>
${dessins.join('\n')}
</svg>
`;
};

// ---------- Ce que la page en dit ----------

export const cheminDeLImage = (cheminDeLaPage) => `${cheminDeLaPage}${NOM_DU_FICHIER}`;
// Le seul script d’une page générée (hors données structurées) : un fichier du site, permis par sa politique de sécurité.
export const SCRIPT_DU_PARTAGE = '<script src="/partage.js" defer></script>';
export const adresseDeLImage = (cheminDeLaPage) => `${adresseDe(cheminDeLaPage)}${NOM_DU_FICHIER}`;

// Le bloc « Partager », sous la tête de la page. Sans JavaScript : « Envoyer sur WhatsApp » (le titre et l’adresse de la
// page, rien d’autre) et l’adresse elle-même, en lien. Avec (partage.js) : le bouton « Partager » du téléphone quand il
// existe ; sinon WhatsApp et « Copier le lien », dont la réponse est lue (aria-live). L’adresse partagée est l’adresse
// canonique, telle quelle : aucun paramètre de suivi.
export const blocPartager = ({ titre, chemin }, textes = TEXTES) => {
  const adresse = adresseDe(chemin);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${titre} ${adresse}`)}`;
  const t = textes.bouton;
  return `<div class="partage" role="group" aria-label="${e(t.titre)}" data-titre="${e(titre)}" data-adresse="${e(adresse)}" data-copie="${e(t.copie)}" data-echec="${e(t.echec)}">
  <button class="partage__bouton partage__natif" type="button" hidden>${e(t.partager)}</button>
  <a class="partage__bouton partage__whatsapp" href="${e(whatsapp)}" rel="noopener">${e(t.whatsapp)}</a>
  <button class="partage__bouton partage__copier" type="button" hidden>${e(t.copier)}</button>
  <a class="partage__lien" href="${e(adresse)}">${e(adresse.replace(/^https:\/\//, ''))}</a>
  <p class="partage__statut" role="status" aria-live="polite"></p>
</div>`;
};
