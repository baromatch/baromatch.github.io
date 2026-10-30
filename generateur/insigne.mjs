// Les clubs, dessinés comme l’appli les dessine : chaque club est son insigne Baromatch (ses couleurs, le motif de son
// maillot, trois lettres de sa ville), jamais un écusson ni un logo. Le dessin vient du générateur de l’appli, copié dans
// generateur/insignes/ (generateur/outils/insignes/exporter.mjs) ; ce fichier le pose dans les pages comme l’appli le
// pose dans ses écrans :
// - un insigne seul (l’en-tête d’une page de match, l’image de partage) : le dessin de l’appli à cette taille, dans un
//   <svg> carré de 200 unités ;
// - deux insignes côte à côte, domicile puis extérieur (une ligne de match) : comme sa paire de la liste « Les matchs »,
//   les deux dans un seul <svg>, à 4 px l’un de l’autre, sans se chevaucher ;
// - une sélection nationale (un nom « nt-<pays> » dans les données) garde son drapeau : des bandes égales découpées dans
//   un disque, sous un anneau blanc à 18 % ; une paire qui en contient une devient deux dessins, à 4 px ;
// - un club que l’appli ne connaît pas : son insigne neutre, un carton d’encre et les trois premières lettres de son
//   nom ; jamais une couleur devinée.
// Toujours décoratif (aria-hidden) : le nom du club, écrit à côté, dit le sens. Des attributs SVG seulement, ni style en
// ligne, ni image, ni lien, ni texte (les lettres sont des tracés) : la politique de sécurité des pages n’a rien à
// permettre de plus. Les identifiants (découpes, dégradés) sont ceux que l’appli donne ; sur une même page, un insigne
// dessiné une seconde fois prend « -2 », « -3 »… (un identifiant est unique dans une page : identifiantsUniques, sur
// la page entière).
import { readFileSync } from 'node:fs';
import { badgeSpecFor, badgeTier, badgeTree, fallbackBadgeSpec, seasonMark, svgString } from './insignes/index.mjs';

// Les tailles, en pixels, calquées sur l’appli : la paire d’une ligne de match (sa liste « Les matchs ») ; l’en-tête d’un
// match (son écran « Ce soir ») ; l’image de partage (la taille de référence de ses insignes, où la saison s’écrit).
export const TAILLES = { liste: 30, entete: 58, partage: 160 };
// L’écart entre les deux insignes d’une paire.
export const ECART_DE_LA_PAIRE = 4;
// La boîte d’un insigne, en unités du dessin.
const BOITE = 200;

// Les bandes des drapeaux, par code de pays (les données de l’appli, copiées avec le dessin).
const DRAPEAUX = JSON.parse(readFileSync(new URL('./insignes/drapeaux.json', import.meta.url), 'utf8'));
// Le drapeau : chaque bande déborde de 0,5 sous la suivante (aucun fil de fond entre deux bandes) ; l’anneau intérieur,
// blanc à 18 %, à 0,5 du bord, d’un trait de 1 (une bande blanche se lit sur un fond sombre).
const RECOUVREMENT = 0.5;
const ANNEAU_DU_DRAPEAU = 'rgba(255,255,255,0.18)';

const arrondi = (valeur) => Number(valeur.toFixed(3));

// Le code de pays d’une sélection, lu dans son nom (« nt-fr », « nt-gb-eng ») ; rien pour un club.
export const codeDuPays = (slug) => {
  if (typeof slug !== 'string') return undefined;
  const trouve = /^nt-([a-z]{2}(?:-[a-z]{3})?)$/.exec(slug.trim().toLowerCase());
  return trouve ? trouve[1] : undefined;
};

// Les bandes d’une sélection que la table connaît ; rien pour un club, ou pour une sélection inconnue (son insigne
// neutre, comme dans l’appli).
export const bandesDe = (slug) => {
  const code = codeDuPays(slug);
  return code && Object.hasOwn(DRAPEAUX, code) ? DRAPEAUX[code] : undefined;
};

// Ce qu’on dessine pour un club : { slug, nom } (le nom de l’appli, celui que l’insigne neutre abrège) → son drapeau,
// sa fiche, ou l’insigne neutre de son nom.
export const dessinDe = (club) => {
  const bandes = bandesDe(club?.slug);
  if (bandes) return { bandes };
  return { fiche: badgeSpecFor(club?.slug) ?? fallbackBadgeSpec(club?.nom) };
};

// Le préfixe que l’appli donne aux identifiants d’un insigne de club (variante standard, sans tampon).
export const prefixeDeLInsigne = (fiche, taille, fond) => `ib-f-${fiche.slug}-${badgeTier(taille)}-s${fond[0]}0`.replace(/[^a-zA-Z0-9_-]/g, '');

// Ce que l’appli dessine d’un arbre : tout, sauf la racine et les titres (son nom est dit à côté).
const dessine = (noeud) => noeud.tag !== 'svg' && noeud.tag !== 'title';
const sansTitres = (noeud) => ({ ...noeud, children: noeud.children?.filter(dessine).map(sansTitres) });

// Le dessin d’une fiche, sans sa racine : ses éléments, en texte.
const elements = (fiche, { taille, fond, saison }) => {
  const arbre = badgeTree(fiche, { size: taille, variant: 'standard', surface: fond, season: saison, stamps: 0, idPrefix: prefixeDeLInsigne(fiche, taille, fond) });
  return (arbre.children ?? []).filter(dessine).map(sansTitres).map(svgString).join('');
};

// Les bandes d’un drapeau, égales, sur un disque de « taille » centré en « centre ».
const rectanglesDe = (centre, taille, { direction, bands }) => {
  const origine = centre - taille / 2;
  const pas = taille / bands.length;
  return bands.map((couleur, i) => {
    const debut = arrondi(origine + pas * i);
    const largeur = arrondi(pas + (i === bands.length - 1 ? 0 : RECOUVREMENT));
    return direction === 'vertical'
      ? `<rect x="${debut}" y="${arrondi(origine)}" width="${largeur}" height="${taille}" fill="${couleur}"/>`
      : `<rect x="${arrondi(origine)}" y="${debut}" width="${taille}" height="${largeur}" fill="${couleur}"/>`;
  }).join('');
};

const ouvrir = (classe, largeur, hauteur, boite) => `<svg class="${classe}" width="${largeur}" height="${hauteur}" viewBox="${boite}" aria-hidden="true" focusable="false">`;

// Le disque d’une sélection : ses bandes découpées dans un cercle, puis l’anneau.
const drapeau = (bandes, { taille, slug }) => {
  const centre = taille / 2;
  const rayon = taille / 2;
  const decoupe = `drapeau-${codeDuPays(slug)}-${taille}`.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${ouvrir('insigne', taille, taille, `0 0 ${taille} ${taille}`)}<defs><clipPath id="${decoupe}"><circle cx="${centre}" cy="${centre}" r="${rayon}"/></clipPath></defs><g clip-path="url(#${decoupe})">${rectanglesDe(centre, rayon * 2, bandes)}</g><circle cx="${centre}" cy="${centre}" r="${rayon - 0.5}" stroke="${ANNEAU_DU_DRAPEAU}" stroke-width="1" fill="none"/></svg>`;
};

// La saison écrite sur le bord (à partir de 128 px) : celle de l’instant du passage.
export const saisonDe = (maintenant) => seasonMark(new Date(maintenant));

// Un insigne seul. club : { slug, nom } ; taille en px ; fond : 'night' (un fond sombre) ou 'light' (un fond clair) ;
// maintenant : l’instant du passage (la saison).
export const insigne = (club, { taille, fond, maintenant }) => {
  const dessin = dessinDe(club);
  if (dessin.bandes) return drapeau(dessin.bandes, { taille, slug: club.slug });
  return `${ouvrir('insigne', taille, taille, `0 0 ${BOITE} ${BOITE}`)}${elements(dessin.fiche, { taille, fond, saison: saisonDe(maintenant) })}</svg>`;
};

// Les deux clubs d’un match, domicile puis extérieur, comme la paire de l’appli.
export const paireDInsignes = (domicile, exterieur, { taille = TAILLES.liste, fond, maintenant }) => {
  const a = dessinDe(domicile);
  const b = dessinDe(exterieur);
  if (a.bandes || b.bandes) {
    return `<span class="insignes insignes--drapeau" aria-hidden="true">${insigne(domicile, { taille, fond, maintenant })}${insigne(exterieur, { taille, fond, maintenant })}</span>`;
  }
  const saison = saisonDe(maintenant);
  const ecart = (ECART_DE_LA_PAIRE / taille) * BOITE;
  return `${ouvrir('insignes', taille * 2 + ECART_DE_LA_PAIRE, taille, `0 0 ${BOITE * 2 + ecart} ${BOITE}`)}<g>${elements(a.fiche, { taille, fond, saison })}</g><g transform="translate(${BOITE + ecart} 0)">${elements(b.fiche, { taille, fond, saison })}</g></svg>`;
};

// Les identifiants des insignes d’une page (ou d’un bloc), uniques : dans l’ordre de la page, un identifiant déjà donné
// par un insigne précédent prend « -2 », « -3 »… dans le dessin suivant, avec ses renvois (url(#…)). Le premier garde
// celui de l’appli. Rien d’autre de la page ne change.
export const identifiantsUniques = (html) => {
  const vus = new Map();
  return html.replace(/<svg class="insignes?"[\s\S]*?<\/svg>/g, (dessin) => {
    let sortie = dessin;
    for (const id of new Set([...dessin.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id))) {
      const fois = (vus.get(id) ?? 0) + 1;
      vus.set(id, fois);
      if (fois > 1) sortie = sortie.replaceAll(`id="${id}"`, `id="${id}-${fois}"`).replaceAll(`url(#${id})`, `url(#${id}-${fois})`);
    }
    return sortie;
  });
};
