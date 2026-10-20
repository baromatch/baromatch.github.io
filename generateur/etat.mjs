// Ce que le générateur garde d’un passage à l’autre, et ce qu’il a le droit d’écrire.
// L’état (regarder-le-match/etat.json) : pour chaque fichier écrit, son adresse, sa sorte, son match ou son bar, sa
// date, l’empreinte de son contenu, la date de son dernier vrai changement, et s’il est indexable ; pour un match ou
// un bar, ce qu’il faut pour refaire sa page quand il n’est plus dans les données (30 jours encore).
// Le plan du site (sitemap.xml) : chaque entrée qui n’est pas une page générée est gardée telle quelle ; les pages
// générées indexables y sont, avec la date de leur dernier vrai changement.
// La liste blanche : le générateur n’écrit et n’efface que dans matchs/, regarder-le-match/ et bar/ (des pages, des
// badges, des images de partage), et ne touche en dehors qu’à ce-soir/ (sa page et son image), à en/ (les pages en
// anglais, rien d’autre) et à sitemap.xml. Tout autre chemin est refusé, avant toute écriture. Les agendas
// (agenda.mjs) : agenda/ (sa page et l’agenda de chaque club) et le fichier d’agenda de chaque match, à côté de sa page
// (matchs/<match>/match.ics).
// L’état garde aussi la mémoire des évènements des agendas (evenements) : leur version et l’instant de leur dernier
// changement.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ORIGINE } from './jsonld.mjs';

export const FICHIER_ETAT = 'regarder-le-match/etat.json';
export const PLAN = 'sitemap.xml';
const DOSSIERS = ['matchs', 'regarder-le-match', 'bar', 'en'];
const PERMIS = /^(?:(?:matchs|regarder-le-match|bar)\/(?:[a-z0-9-]+\/)*(?:index\.html|badge\.svg|partage\.png)|ce-soir\/(?:index\.html|partage\.png)|matchs\/[a-z0-9-]+\/match\.ics|agenda\/(?:index\.html|[a-z0-9-]+\.ics)|en\/(?:[a-z0-9-]+\/)*index\.html)$/;

export const estPermis = (relatif) => relatif === PLAN || relatif === FICHIER_ETAT || (PERMIS.test(relatif) && !relatif.split('/').includes('..'));

const exigerPermis = (relatif) => {
  if (!estPermis(relatif)) throw new Error(`Chemin refusé (hors de la liste blanche du générateur) : ${relatif}`);
};

// « /matchs/psg-ol-2026-10-25/ » → « matchs/psg-ol-2026-10-25/index.html ».
export const fichierDuChemin = (chemin) => `${chemin.replace(/^\//, '')}${chemin.endsWith('/') ? 'index.html' : ''}`;

export const empreinte = (texte) => createHash('sha256').update(texte).digest().subarray(0, 16).toString('base64url');

// ---------- Lire et écrire, dans la liste blanche seulement ----------

const lireSiPresent = (fichier) => (existsSync(fichier) ? readFileSync(fichier, 'utf8') : null);
// Une copie de travail sous Windows peut avoir des fins de ligne CRLF : le même contenu n’est pas réécrit. Un agenda
// (.ics) s’écrit en CRLF : le même, octet pour octet, n’est pas réécrit non plus.
const memeContenu = (a, b) => a !== null && (a === b || a.replace(/\r\n/g, '\n') === b);
// Une image (des octets) : la même, octet pour octet.
const memesOctets = (fichier, octets) => existsSync(fichier) && readFileSync(fichier).equals(octets);

export const ecrireUnFichier = (sortie, relatif, contenu) => {
  exigerPermis(relatif);
  const fichier = path.join(sortie, relatif);
  if (Buffer.isBuffer(contenu) ? memesOctets(fichier, contenu) : memeContenu(lireSiPresent(fichier), contenu)) return false;
  mkdirSync(path.dirname(fichier), { recursive: true });
  writeFileSync(fichier, contenu);
  return true;
};

export const effacerUnFichier = (sortie, relatif) => {
  exigerPermis(relatif);
  const fichier = path.join(sortie, relatif);
  if (!existsSync(fichier)) return;
  rmSync(fichier);
  // Les dossiers vidés (celui de la page, pas ceux de la liste blanche) disparaissent avec elle.
  let dossier = path.dirname(fichier);
  while (!DOSSIERS.some((d) => path.join(sortie, d) === dossier) && dossier.startsWith(sortie) && readdirSync(dossier).length === 0) {
    rmdirSync(dossier);
    dossier = path.dirname(dossier);
  }
};

// ---------- L’état ----------

// Pas d’état : le tout premier passage. Un état illisible (vide, abîmé, retouché à la main) arrête tout : jamais une
// remise à zéro silencieuse, qui oublierait les pages publiées et les adresses données aux bars.
export const lireLEtat = (sortie) => {
  const texte = lireSiPresent(path.join(sortie, FICHIER_ETAT));
  if (texte === null) return { pages: {} };
  let etat = null;
  try {
    etat = JSON.parse(texte);
  } catch {
    etat = null;
  }
  if (!etat || typeof etat !== 'object' || !etat.pages || typeof etat.pages !== 'object') {
    throw new Error(`${FICHIER_ETAT} est illisible (vide, abîmé ou retouché à la main) : rien n’est écrit, les pages en ligne restent comme elles sont. Remets la version précédente de ce fichier (l’historique du dépôt la garde), puis relance.`);
  }
  return etat;
};

// Ce que l’état garde des pages de matchs et de bars, pour les refaire quand ils ne sont plus dans les données, et des
// guides en anglais.
export const anciensDe = (etat) => {
  const entrees = Object.values(etat.pages ?? {});
  return {
    matchs: entrees.filter((p) => p.type === 'match' && p.memoire).map((p) => ({ ...p.memoire, debut: Date.parse(p.memoire.debut) })),
    bars: entrees.filter((p) => p.type === 'bar' && p.memoire).map((p) => ({ ...p.memoire, slug: p.cle })),
    // Ce que les guides en anglais gardent (anglais.mjs : le dernier match d’une compétition montré à Paris).
    guides: Object.fromEntries(entrees.filter((p) => p.type === 'guide-en' && p.memoire).map((p) => [p.cle, p.memoire])),
    // Les adresses de page déjà données à un bar (les anciens états ne les avaient que par leurs pages).
    adresses: {
      ...Object.fromEntries(entrees.filter((p) => p.type === 'bar' && p.memoire?.id).map((p) => [p.cle, p.memoire.id])),
      ...(etat.adresses ?? {}),
    },
  };
};

// gardees : les chemins dont la version précédente reste (une page refusée par le contrôle, refus.mjs), repris tels
// quels, ou { chemin, entree } avec l’entrée à écrire (la date depuis laquelle elle est gardée).
// adresses : les adresses de page données aux bars ({ adresse: identifiant }), gardées d’un passage à l’autre.
// Chaque page dit quels bars elle nomme (bars : leurs identifiants), et si elle est la page neutre (repli).
// evenements : la mémoire des évènements des agendas (agenda.mjs), gardée telle quelle.
export const nouvelEtat = (precedent, fichiers, aujourdhui, gardees = [], adresses = {}, evenements = null) => {
  const pages = {};
  const tous = [...fichiers, ...gardees.map((g) => (typeof g === 'string' ? { chemin: g, garde: true } : { ...g, garde: true }))];
  for (const f of tous.sort((a, b) => a.chemin.localeCompare(b.chemin))) {
    const avant = precedent.pages?.[f.chemin];
    if (f.garde) {
      pages[f.chemin] = f.entree ?? avant;
      continue;
    }
    // Une image de partage porte l’empreinte de ce qui la dessine (son SVG et le rendu) : elle n’est refaite que si
    // son dessin change.
    const marque = f.empreinte ?? empreinte(f.contenu);
    pages[f.chemin] = {
      type: f.type,
      cle: f.cle,
      ...(f.date ? { date: f.date } : {}),
      empreinte: marque,
      change: avant?.empreinte === marque ? avant.change : aujourdhui,
      indexable: f.indexable,
      ...(f.chemin.endsWith('/') ? { bars: f.barsNommes ?? [] } : {}),
      ...(f.repli ? { repli: true } : {}),
      ...(f.horsPlan ? { horsPlan: true } : {}),
      ...(f.memoire ? { memoire: f.memoire } : {}),
    };
  }
  return {
    _lisezMoi: 'L’état du générateur des pages des matchs : il l’écrit à chaque passage, ne le modifie pas à la main. Pour chaque fichier, sa sorte, son match ou son bar, les bars qu’il nomme (leurs identifiants), l’empreinte de son contenu, la date de son dernier vrai changement (celle du plan du site) et s’il est indexable ; et l’adresse de page de chaque bar publié, qu’aucun autre ne reprend. Un bar qui n’est plus publié sort de ces adresses au passage suivant ; l’adresse de sa page reste seulement le temps de sa page « n’est plus sur Baromatch » (30 jours).',
    pages,
    adresses,
    ...(evenements ? { evenements } : {}),
  };
};

export const texteDeLEtat = (etat) => `${JSON.stringify(etat, null, 1)}\n`;

// ---------- Le plan du site ----------

const GENEREE = new RegExp(`<loc>${ORIGINE.replace(/\./g, '\\.')}/(?:matchs|regarder-le-match|bar|ce-soir|agenda|en)/`);

export const nouveauPlan = (ancien, etat) => {
  const lignes = ancien.replace(/\r\n/g, '\n').split('\n');
  const fin = lignes.findIndex((l) => l.trim() === '</urlset>');
  if (fin === -1) throw new Error('sitemap.xml illisible : </urlset> introuvable, rien n’est écrit');
  const gardees = lignes.slice(0, fin).filter((l) => !GENEREE.test(l));
  const generees = Object.entries(etat.pages)
    .filter(([chemin, p]) => p.indexable && !p.horsPlan && chemin.endsWith('/'))
    .map(([chemin, p]) => `  <url><loc>${ORIGINE}${chemin}</loc><lastmod>${p.change}</lastmod></url>`);
  return `${[...gardees, ...generees, ...lignes.slice(fin)].join('\n').replace(/\n*$/, '')}\n`;
};
