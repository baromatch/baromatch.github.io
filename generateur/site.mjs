// Un passage du générateur, en mémoire : lire les données, les trier, fabriquer toutes les pages, puis contrôler chacune
// (contrôle.mjs) et valider ses données structurées (validateur.mjs). Une seule erreur arrête tout avant la moindre
// écriture : les pages en ligne restent comme elles sont.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chargerLeContenu, RACINE } from './contenu.mjs';
import { preparer } from './donnees.mjs';
import { lireLeCadre } from './gabarits.mjs';
import { controlerLaPage, controlerLesOffres } from './controle.mjs';
import { fabriquerLesPages } from './pages.mjs';
import { lireLaSource } from './sources.mjs';
import { chargerLeVocabulaire, validerLaPage } from './validateur.mjs';

export const construireEnMemoire = async ({
  source, maintenant = Date.now(), racine = RACINE, contenu = chargerLeContenu(racine), anciens, adresse, brut,
} = {}) => {
  const donnees = preparer(brut ?? await lireLaSource(source, adresse ? { adresse } : {}), { maintenant, ...contenu });
  const cadre = lireLeCadre(racine);
  const avecPresse = existsSync(path.join(racine, 'presse.html'));
  const { pages, avertissements } = fabriquerLesPages({ donnees, contenu, cadre, avecPresse, anciens });

  const vocabulaire = chargerLeVocabulaire();
  const offres = donnees.soirees.map((s) => s.offre?.titre).filter(Boolean);
  const motsDesBars = [...donnees.bars.flatMap((b) => [b.nom, b.adresse, b.rue]), ...(anciens?.bars ?? []).flatMap((b) => [b.nom, b.adresse]), ...offres];
  const erreurs = pages.flatMap((p) => [
    ...controlerLaPage(p, { motsDesBars }),
    ...controlerLesOffres(p, offres),
    ...validerLaPage(vocabulaire, p.contenu).map((erreur) => `${p.chemin} : ${erreur}`),
  ]);
  const chemins = pages.map((p) => p.chemin);
  for (const chemin of new Set(chemins)) if (chemins.filter((c) => c === chemin).length > 1) erreurs.push(`${chemin} : deux pages à la même adresse`);
  if (erreurs.length) throw new Error(`Pages refusées, rien n’est écrit :\n${erreurs.join('\n')}`);
  return { donnees, pages, cadre, contenu, avertissements: [...donnees.avertissements, ...avertissements] };
};
