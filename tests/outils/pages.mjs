// Les pages du site que les vérifications parcourent (chemin servi, nom court pour les rapports).
// Le lien de tablée est servi avec le statut 404 (comme sur GitHub Pages) : Lighthouse refuse de mesurer
// une page en 404, il mesure donc son HTML à /404.html ; axe, les liens et les captures le voient tel quel.
// indexable: false : la page dit noindex (404.html, et le lien de tablée qu’elle sert).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { racine } from './environnement.mjs';

export const PAGES = [
  { chemin: '/', nom: 'accueil' },
  { chemin: '/pour-les-bars.html', nom: 'pour-les-bars' },
  { chemin: '/boutique.html', nom: 'boutique' },
  { chemin: '/cgu.html', nom: 'cgu' },
  { chemin: '/confidentialite.html', nom: 'confidentialite' },
  { chemin: '/mentions-legales.html', nom: 'mentions-legales' },
  { chemin: '/supprimer-mon-compte.html', nom: 'supprimer-mon-compte' },
  { chemin: '/presse.html', nom: 'presse' },
  { chemin: '/404.html', nom: '404', indexable: false },
  { chemin: '/t/abcdefghjkmn', nom: 'tablee', lighthouse: false, indexable: false },
];

// Le fichier du dépôt que le site sert à ce chemin (« / » et « …/ » : leur index.html), en chemin absolu.
export const fichierDe = (chemin) => {
  const sansRacine = decodeURIComponent(chemin).replace(/^\//, '');
  return path.join(racine, sansRacine === '' || sansRacine.endsWith('/') ? `${sansRacine}index.html` : sansRacine);
};

// Les pages que Lighthouse mesure (toutes sauf lighthouse: false), chacune avec son fichier : une page dont le fichier
// manque arrête la commande avant toute mesure, en la nommant. `pages` et `existe` se remplacent pour l’éprouver.
export const pagesLighthouse = (pages = PAGES, existe = existsSync) => {
  const mesurees = pages.filter((page) => page.lighthouse !== false);
  if (mesurees.length === 0) throw new Error('Aucune page à mesurer : la liste des pages est vide');
  const manquantes = mesurees.filter((page) => !existe(fichierDe(page.chemin)));
  if (manquantes.length) {
    throw new Error(`Pages sans fichier, rien n’est mesuré : ${manquantes.map((page) => `${page.chemin} (${fichierDe(page.chemin)})`).join(', ')}`);
  }
  return mesurees;
};
