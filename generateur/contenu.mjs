// Ce que le générateur lit dans le dépôt, à côté des données : la marque (marque.json, à la racine, lue sans jamais
// l’écrire), les textes fixes des pages, les guides des villes, les noms courts des clubs et des compétitions, les
// couleurs des clubs (les disques de l’accueil), et la liste des bars publiés (ceux qui ont accepté par écrit), celle
// des bars exclus.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOSSIER_GENERATEUR = path.dirname(fileURLToPath(import.meta.url));
export const RACINE = path.resolve(DOSSIER_GENERATEUR, '..');

const lire = (...morceaux) => JSON.parse(readFileSync(path.join(...morceaux), 'utf8'));

export const chargerLeContenu = (racine = RACINE) => {
  const contenu = path.join(racine, 'generateur', 'contenu');
  const exclusion = lire(racine, 'generateur', 'bars-exclus.json');
  const publication = lire(racine, 'generateur', 'bars-publies.json');
  return {
    marque: lire(racine, 'marque.json'),
    textes: lire(contenu, 'textes.json'),
    villes: lire(contenu, 'villes.json'),
    clubs: lire(contenu, 'clubs.json'),
    competitions: lire(contenu, 'competitions.json'),
    couleurs: lire(contenu, 'couleurs.json'),
    publies: publication.bars ?? [],
    exclus: exclusion.bars ?? [],
    forcer: exclusion.forcer ?? [],
  };
};
