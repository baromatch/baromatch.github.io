// Un passage du générateur, en mémoire : lire les données, les trier, fabriquer toutes les pages, puis contrôler chacune
// (contrôle.mjs) et valider ses données structurées (validateur.mjs). Une page refusée est mise de côté (refus.mjs dit
// ce qu’elle devient : sa version précédente si elle est sûre, sinon une page neutre) ; deux pages à la même adresse, ou
// toutes les pages refusées, arrêtent tout avant la moindre écriture : les pages en ligne restent comme elles sont.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chargerLeContenu, RACINE } from './contenu.mjs';
import { preparer } from './donnees.mjs';
import { lireLeCadre } from './gabarits.mjs';
import { controlerLaPage } from './controle.mjs';
import { fabriquerLesPages } from './pages.mjs';
import { lireLaSource } from './sources.mjs';
import { chargerLeVocabulaire, validerLaPage } from './validateur.mjs';

export const construireEnMemoire = async ({
  source, maintenant = Date.now(), racine = RACINE, contenu = chargerLeContenu(racine), anciens, adresse, brut,
} = {}) => {
  // L’appli dite ouverte sans aucun lien de magasin : chaque page promettrait une place impossible à garder.
  const { appli = {} } = contenu.marque;
  if (appli.ouverte && !appli.android && !appli.iphone) {
    throw new Error('marque.json : « appli.ouverte » est vrai, mais aucun lien de magasin n’est rempli (« android » ou « iphone »). Ajoute le lien de l’appli dans le magasin, ou remets « ouverte » à false : rien n’est écrit, les pages en ligne restent comme elles sont.');
  }
  const donnees = preparer(brut ?? await lireLaSource(source, adresse ? { adresse } : {}), { maintenant, ...contenu, adresses: anciens?.adresses });
  const cadre = lireLeCadre(racine);
  const avecPresse = existsSync(path.join(racine, 'presse.html'));
  const { pages, avertissements } = fabriquerLesPages({ donnees, contenu, cadre, avecPresse, anciens });

  const vocabulaire = chargerLeVocabulaire();
  const offres = donnees.soirees.map((s) => s.offre?.titre).filter(Boolean);
  const motsDesBars = [...donnees.bars.flatMap((b) => [b.nom, b.adresse, b.rue]), ...(anciens?.bars ?? []).flatMap((b) => [b.nom, b.adresse]), ...offres];
  const controler = (p) => [
    ...controlerLaPage(p, { motsDesBars }),
    ...validerLaPage(vocabulaire, p.contenu).map((erreur) => `${p.chemin} : ${erreur}`),
  ];
  const erreursDe = new Map();
  for (const p of pages) {
    const erreurs = controler(p);
    if (erreurs.length) erreursDe.set(p, erreurs);
  }
  const chemins = pages.map((p) => p.chemin);
  const doubles = [...new Set(chemins)].filter((chemin) => chemins.filter((c) => c === chemin).length > 1);
  if (doubles.length) throw new Error(`Pages refusées, rien n’est écrit :\n${doubles.map((c) => `${c} : deux pages à la même adresse`).join('\n')}`);
  // Toutes les pages refusées : le gabarit commun est en cause, le passage s’arrête. Sinon, une page refusée n’arrête
  // pas les autres : refus.mjs dit ce qu’elle devient (construire.mjs), et le journal le dit.
  if (pages.length && erreursDe.size === pages.length) throw new Error(`Pages refusées, rien n’est écrit :\n${[...erreursDe.values()].flat().join('\n')}`);
  const refusees = [...erreursDe].map(([p, erreurs]) => ({ ...p, erreurs }));
  return { donnees, pages: pages.filter((p) => !erreursDe.has(p)), refusees, cadre, contenu, avecPresse, controler, avertissements: [...donnees.avertissements, ...avertissements] };
};
