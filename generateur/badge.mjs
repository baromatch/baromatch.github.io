// Le badge vivant d’un bar (/bar/<slug>/badge.svg), réécrit à chaque passage : le bar le colle sur son site, et il
// montre sa prochaine soirée annoncée (« Ce soir ici · 21:00 », puis « PSG – OL · sur Baromatch »), ou, sans soirée,
// « On diffuse le match · sur Baromatch ». Tant que l’appli n’est pas ouverte, aucun badge ne dit « Réserve ta place » ;
// quand elle l’est, la dernière ligne devient « Réserve ta place sur Baromatch ».
// Le dessin, le même que le badge fixe du site : 360 × 72, fond nuit #0A0B10, bord fin blanc à 14 %, coins en pilule,
// le verre de la marque à gauche (les tracés du pied de page de l’accueil), le texte blanc #F7F7F9, « sur Baromatch »
// en ambre #FFB13D. Une image chez un autre site ne charge pas nos polices : la police se replie sur celles du système.
import { capitale, echapper as e } from './texte.mjs';
import { heureDeParis, heureDuJour, jourEnLettres, joursEntre } from './heure.mjs';

export const LARGEUR = 360;
export const HAUTEUR = 72;
const POLICE = "'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const BLANC = '#F7F7F9';
const AMBRE = '#FFB13D';
const X_TEXTE = 76;
const PLACE = LARGEUR - X_TEXTE - 26;

// La taille qui fait tenir une ligne dans la place (une estimation large de la largeur des lettres) ; au plus petit,
// la ligne est resserrée à la place exacte.
const ajuster = (texte, taille, gras) => {
  const parLettre = gras ? 0.6 : 0.56;
  const tient = (t) => texte.length * t * parLettre <= PLACE;
  let t = taille;
  while (t > 11 && !tient(t)) t -= 0.5;
  return { taille: t, serre: !tient(t) };
};

const ligne = (morceaux, y, taille, gras) => {
  const texte = morceaux.map((m) => m.texte).join('');
  const { taille: t, serre } = ajuster(texte, taille, gras);
  const contenu = morceaux.map((m) => (m.couleur ? `<tspan fill="${m.couleur}">${e(m.texte)}</tspan>` : e(m.texte))).join('');
  return `<text x="${X_TEXTE}" y="${y}" font-size="${t}"${gras ? ' font-weight="700"' : ''}${serre ? ` textLength="${PLACE}" lengthAdjust="spacingAndGlyphs"` : ''}>${contenu}</text>`;
};

// Le verre de la marque, ses dégradés renommés pour ce fichier.
const verreDuBadge = (verre) => verre
  .replace(/\bpd-/g, 'bdg-')
  .replace('<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">', '<svg x="12" y="10" width="52" height="52" viewBox="0 0 200 200" aria-hidden="true">');

// Les deux lignes du badge, et sa phrase pour les lecteurs d’écran.
export const lignesDuBadge = ({ bar, soiree, maintenant, marque, textes, parti = false }) => {
  const t = textes.badge;
  const ouverte = marque.appli.ouverte;
  const surBaromatch = { texte: t.marque, couleur: AMBRE };
  if (parti) {
    return { haut: [{ texte: marque.slogan }], bas: [{ texte: 'baromatch.fr', couleur: AMBRE }], titre: `${marque.nom} : ${marque.slogan}` };
  }
  if (!soiree) {
    return {
      haut: [{ texte: t.sansSoiree }],
      bas: ouverte ? [{ texte: `${t.reserve} ` }, surBaromatch] : [surBaromatch],
      titre: `${bar.nom} sur Baromatch : ${t.sansSoiree.toLowerCase()}`,
    };
  }
  const { match } = soiree;
  const ecart = joursEntre(maintenant, match.debut);
  const heure = heureDeParis(match.debut);
  let quand;
  if (!match.heureConfirmee) quand = t.sansHeure.replace('{jour}', capitale(jourEnLettres(match.debut)));
  else if (ecart === 0) quand = (heureDuJour(match.debut) >= 17 ? t.ceSoir : t.aujourdhui).replace('{heure}', heure);
  else quand = t.jour.replace('{jour}', capitale(jourEnLettres(match.debut))).replace('{heure}', heure);
  const nom = `${match.domicile.court} – ${match.exterieur.court}`;
  return ouverte
    ? { haut: [{ texte: `${quand} · ${nom}` }], bas: [{ texte: `${t.reserve} ` }, surBaromatch], titre: `${bar.nom} sur Baromatch : ${quand.replace(/^./, (l) => l.toLocaleLowerCase('fr-FR'))}, ${nom}` }
    : { haut: [{ texte: quand }], bas: [{ texte: `${nom} · ` }, surBaromatch], titre: `${bar.nom} sur Baromatch : ${quand.replace(/^./, (l) => l.toLocaleLowerCase('fr-FR'))}, ${nom}` };
};

export const badgeDuBar = (options) => {
  const { haut, bas, titre } = lignesDuBadge(options);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" role="img" aria-labelledby="titre-badge">
<title id="titre-badge">${e(titre)}</title>
<rect x="0.5" y="0.5" width="${LARGEUR - 1}" height="${HAUTEUR - 1}" rx="${(HAUTEUR - 1) / 2}" fill="#0A0B10" stroke="#FFFFFF" stroke-opacity="0.14"/>
${verreDuBadge(options.verre)}
<g font-family="${POLICE}" fill="${BLANC}">
${ligne(haut, 32, 17, true)}
${ligne(bas, 54, 14.5, false)}
</g>
</svg>
`;
};
