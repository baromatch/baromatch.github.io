// Le générateur des pages « Où regarder le match » : un passage complet.
// Usage :
//   node generateur/construire.mjs [--source=api | --source=capture:<dossier> | --source=scenario:<fichier>]
//                                  [--sortie=<dossier>] [--maintenant=<date ISO>] [--changees=<fichier>]
//                                  [--accepter-les-suppressions]
// Par défaut : les listes publiques de l’appli, la racine du dépôt, l’heure de la machine.
// Le passage lit les données, fabrique et contrôle toutes les pages en mémoire (site.mjs), refuse de supprimer d’un
// coup plus de la moitié des pages déjà publiées, puis écrit seulement ce qui a changé, dans la liste blanche
// (etat.mjs) : matchs/, regarder-le-match/, bar/ et sitemap.xml. --changees écrit, une par ligne, les adresses
// indexables dont le contenu a changé (pour IndexNow).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badgeDuBar } from './badge.mjs';
import { RACINE } from './contenu.mjs';
import { jourDeParis } from './heure.mjs';
import { adresseDe } from './jsonld.mjs';
import {
  anciensDe, effacerUnFichier, ecrireUnFichier, FICHIER_ETAT, fichierDuChemin, lireLEtat, nouveauPlan, nouvelEtat, PLAN, texteDeLEtat,
} from './etat.mjs';
import { construireEnMemoire } from './site.mjs';

// Au-delà de ce nombre de pages publiées, un passage qui en supprimerait plus de la moitié s’arrête : des données
// vides ou tronquées ne vident pas le site.
const SEUIL_DE_PRUDENCE = 10;

export const construire = async ({
  source = 'api', sortie = RACINE, maintenant = Date.now(), racine = RACINE, contenu, accepterLesSuppressions = false, adresse, journal = () => {},
} = {}) => {
  const precedent = lireLEtat(sortie);
  const site = await construireEnMemoire({ source, maintenant, racine, contenu, adresse, anciens: anciensDe(precedent) });

  // Les badges des bars, à côté de leur page.
  const fichiers = [...site.pages];
  for (const p of site.pages.filter((x) => x.type === 'bar')) {
    fichiers.push({
      chemin: `${p.chemin}badge.svg`, type: 'badge', cle: p.cle, indexable: false,
      contenu: badgeDuBar({ bar: p.bar, soiree: p.soirees?.[0] ?? null, parti: Boolean(p.parti), maintenant, marque: site.contenu.marque, textes: site.contenu.textes, verre: site.cadre.verre }),
    });
  }

  // Une page refusée par le contrôle garde sa version précédente (et son badge) : ni réécrite, ni effacée, son entrée
  // de l’état est reprise telle quelle. Une page nouvelle refusée n’est simplement pas publiée.
  const gardees = new Set(site.refusees.flatMap(({ chemin }) => [chemin, `${chemin}badge.svg`]).filter((chemin) => precedent.pages?.[chemin]));

  // La prudence : jamais plus de la moitié des pages publiées supprimées d’un coup.
  const nouveaux = new Set([...fichiers.map((f) => f.chemin), ...gardees]);
  const anciennesPages = Object.keys(precedent.pages ?? {}).filter((chemin) => chemin.endsWith('/'));
  const supprimees = Object.keys(precedent.pages ?? {}).filter((chemin) => !nouveaux.has(chemin));
  const pagesSupprimees = supprimees.filter((chemin) => chemin.endsWith('/'));
  if (!accepterLesSuppressions && anciennesPages.length >= SEUIL_DE_PRUDENCE && pagesSupprimees.length > anciennesPages.length / 2) {
    throw new Error(`Ce passage supprimerait ${pagesSupprimees.length} des ${anciennesPages.length} pages publiées : rien n’est écrit. Si c’est voulu, relance avec --accepter-les-suppressions.`);
  }

  const aujourdhui = jourDeParis(maintenant);
  const etat = nouvelEtat(precedent, fichiers, aujourdhui, [...gardees]);
  const planActuel = existsSync(path.join(sortie, PLAN)) ? readFileSync(path.join(sortie, PLAN), 'utf8') : readFileSync(path.join(racine, PLAN), 'utf8');
  const plan = nouveauPlan(planActuel, etat);

  // Tout est prêt et contrôlé : seulement maintenant, l’écriture.
  const ecrits = fichiers.filter((f) => ecrireUnFichier(sortie, fichierDuChemin(f.chemin), f.contenu)).map((f) => f.chemin);
  for (const chemin of supprimees) effacerUnFichier(sortie, fichierDuChemin(chemin));
  ecrireUnFichier(sortie, FICHIER_ETAT, texteDeLEtat(etat));
  ecrireUnFichier(sortie, PLAN, plan);

  const changees = Object.entries(etat.pages)
    .filter(([chemin, p]) => p.indexable && chemin.endsWith('/') && p.empreinte !== precedent.pages?.[chemin]?.empreinte)
    .map(([chemin]) => adresseDe(chemin));
  const compte = {};
  for (const p of site.pages) {
    compte[p.type] ??= { pages: 0, indexables: 0 };
    compte[p.type].pages += 1;
    if (p.indexable) compte[p.type].indexables += 1;
  }
  for (const avertissement of site.avertissements) journal(`avertissement : ${avertissement}`);
  return { etat, plan, fichiers, ecrits, supprimees, changees, compte, avertissements: site.avertissements, donnees: site.donnees };
};

// ---------- La ligne de commande ----------

const lireLesOptions = (argv) => {
  const options = {};
  for (const argument of argv) {
    const [cle, ...reste] = argument.replace(/^--/, '').split('=');
    options[cle] = reste.length ? reste.join('=') : true;
  }
  return options;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = lireLesOptions(process.argv.slice(2));
  const maintenant = options.maintenant ? Date.parse(options.maintenant) : Date.now();
  if (Number.isNaN(maintenant)) throw new Error(`--maintenant illisible : ${options.maintenant}`);
  // Sur GitHub, un avertissement s’affiche dans le résumé du passage.
  const surGitHub = process.env.GITHUB_ACTIONS === 'true';
  const journal = (ligne) => console.log(surGitHub && ligne.startsWith('avertissement') ? `::warning::${ligne.replace(/^avertissement : /, '')}` : ligne);
  try {
    const resultat = await construire({
      source: typeof options.source === 'string' ? options.source : 'api',
      sortie: path.resolve(typeof options.sortie === 'string' ? options.sortie : RACINE),
      maintenant,
      accepterLesSuppressions: options['accepter-les-suppressions'] === true,
      journal,
    });
    const resume = Object.entries(resultat.compte).map(([type, { pages, indexables }]) => `${type} : ${pages} (${indexables} indexables)`).join(' · ');
    console.log(`Pages : ${resume}`);
    console.log(`${resultat.ecrits.length} fichiers écrits ou changés, ${resultat.supprimees.length} supprimés, ${resultat.changees.length} adresses indexables changées.`);
    if (typeof options.changees === 'string') writeFileSync(options.changees, resultat.changees.map((a) => `${a}\n`).join(''));
  } catch (erreur) {
    console.error(erreur.message);
    process.exitCode = 1;
  }
}
