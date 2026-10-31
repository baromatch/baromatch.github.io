// Le générateur des pages « Où regarder le match » : un passage complet.
// Usage :
//   node generateur/construire.mjs [--source=api | --source=capture:<dossier> | --source=scenario:<fichier>]
//                                  [--sortie=<dossier>] [--maintenant=<date ISO>] [--changees=<fichier>]
//                                  [--accepter-les-suppressions] [--images=exiger]
// Par défaut : les listes publiques de l’appli, la racine du dépôt, l’heure de la machine.
// Le passage lit les données, fabrique et contrôle toutes les pages en mémoire (site.mjs), refuse de supprimer d’un
// coup plus de la moitié des pages déjà publiées, puis écrit seulement ce qui a changé, dans la liste blanche
// (etat.mjs) : matchs/, regarder-le-match/, bar/, ce-soir/, en/, agenda/ et sitemap.xml. Hors d’elle, une seule chose :
// le bloc « Les matchs de la semaine » de l’accueil, entre ses deux repères, et rien d’autre de index.html (accueil.mjs).
// --changees écrit, une par ligne, les adresses indexables dont le contenu a changé, et celles qui ne sont plus
// indexables (pour IndexNow).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocDeLaSemaine, controlerLaSemaine, ecrireLAccueil, preparerLAccueil } from './accueil.mjs';
import { fabriquerLesAgendas } from './agenda.mjs';
import { badgeDuBar } from './badge.mjs';
import { chargerLeRendu } from './images/rendu.mjs';
import { chargerLeQr } from './qr.mjs';
import { cheminDeLImage, empreinteDuDessin, lesPolices, POIDS_MAX, svgDeLaCarte } from './partage.mjs';
import { RACINE } from './contenu.mjs';
import { jourDeParis } from './heure.mjs';
import { adresseDe } from './jsonld.mjs';
import {
  anciensDe, effacerUnFichier, ecrireUnFichier, estPermis, FICHIER_ETAT, fichierDuChemin, lireLEtat, nouveauPlan, nouvelEtat, PLAN, texteDeLEtat,
} from './etat.mjs';
import { traiterLesRefus } from './refus.mjs';
import { construireEnMemoire } from './site.mjs';

// Au-delà de ce nombre de pages publiées, un passage qui en supprimerait plus de la moitié s’arrête : des données
// vides ou tronquées ne vident pas le site.
const SEUIL_DE_PRUDENCE = 10;
// Au-delà de ce nombre de bars publiés (ou de matchs à venir déjà publiés), en perdre plus de la moitié d’un coup
// arrête le passage : une liste tronquée ne fait pas basculer le site. En dessous (deux bars), rien ne bloque.
const SEUIL_DES_LISTES = 4;

// Ce que l’état connaissait (les bars publiés, les matchs à venir, s’il y avait des soirées) face aux listes reçues :
// les raisons de refuser le passage, vides si tout va bien.
export const verifierLesListes = ({ precedent, donnees, maintenant }) => {
  const entrees = Object.values(precedent.pages ?? {}).filter((p) => p.memoire);
  const barsConnus = entrees.filter((p) => p.type === 'bar' && p.memoire.id && !p.memoire.disparu).map((p) => p.memoire.id);
  const matchsConnus = entrees.filter((p) => p.type === 'match' && Date.parse(p.memoire.debut) > maintenant);
  const avecSoirees = matchsConnus.some((p) => p.indexable);
  const barsRecus = new Set([...donnees.bars.map((b) => b.id), ...donnees.ecartes.map((b) => b.id)]);
  const idsDesMatchs = new Set(donnees.matchs.flatMap((m) => m.ids));
  const barsPerdus = barsConnus.filter((id) => !barsRecus.has(id));
  const matchsPerdus = matchsConnus.filter((p) => !(p.memoire.ids ?? []).some((id) => idsDesMatchs.has(id)));
  const raisons = [];
  if (barsConnus.length && donnees.recus.bars === 0) raisons.push(`la liste des bars est vide, alors que ${barsConnus.length} bars sont publiés`);
  if (avecSoirees && donnees.recus.soirees === 0) raisons.push('la liste des soirées est vide, alors que des soirées à venir sont publiées');
  if (barsConnus.length >= SEUIL_DES_LISTES && barsPerdus.length > barsConnus.length / 2) {
    raisons.push(`${barsPerdus.length} des ${barsConnus.length} bars publiés ne sont plus dans la liste des bars`);
  }
  if (matchsConnus.length >= SEUIL_DES_LISTES && matchsPerdus.length > matchsConnus.length / 2) {
    raisons.push(`${matchsPerdus.length} des ${matchsConnus.length} matchs à venir publiés ne sont plus dans la liste des matchs`);
  }
  return raisons;
};

// images : « exiger » (l’Action) arrête tout si le rendu des images de partage manque, ou l’encodeur des QR codes des
// affiches (installés ensemble, dans generateur/images) ; sinon, sans le rendu, chaque page garde l’image générale du
// site, sans l’encodeur, les affiches ne sont pas écrites, et le journal le dit. rendu : un rendu donné (les tests), ou
// null pour s’en passer ; qr : de même pour l’encodeur.
export const construire = async ({
  source = 'api', sortie = RACINE, maintenant = Date.now(), racine = RACINE, contenu, accepterLesSuppressions = false, adresse, journal = () => {},
  images, rendu, qr,
} = {}) => {
  const precedent = lireLEtat(sortie);
  const charge = rendu !== undefined ? { rendu, raison: 'le rendu des images est écarté' } : await chargerLeRendu({ polices: Object.values(lesPolices()) });
  if (!charge.rendu && images === 'exiger') throw new Error(`Images de partage exigées, rien n’est écrit : ${charge.raison}.`);
  if (!charge.rendu) journal(`avertissement : images de partage : ${charge.raison} ; chaque page garde l’image générale du site.`);
  const encodeur = qr !== undefined ? { qr, raison: 'l’encodeur des QR codes est écarté' } : chargerLeQr();
  if (!encodeur.qr && images === 'exiger') throw new Error(`Affiches exigées, rien n’est écrit : ${encodeur.raison}.`);
  if (!encodeur.qr) journal(`avertissement : affiches : ${encodeur.raison} ; les affiches à imprimer ne sont pas écrites.`);
  const site = await construireEnMemoire({ source, maintenant, racine, contenu, adresse, anciens: anciensDe(precedent), images: charge.rendu ? { signature: charge.rendu.signature } : false, qr: encodeur.qr });

  // Une liste vide ou tronquée (bars, soirées, matchs) ne fait pas basculer le site : rien n’est écrit.
  const raisons = accepterLesSuppressions ? [] : verifierLesListes({ precedent, donnees: site.donnees, maintenant });
  if (raisons.length) {
    throw new Error(`Données douteuses, rien n’est écrit : ${raisons.join(' ; ')}. Si c’est voulu, relance avec --accepter-les-suppressions (ou coche la case en lançant l’Action à la main).`);
  }

  // Une page refusée par le contrôle garde sa version précédente (et son badge, et son image de partage) seulement si elle
  // est sûre, 24 heures au plus ; sinon, une page neutre la remplace à la même adresse (refus.mjs) : jamais un bar
  // retiré, jamais un lien mort.
  const refus = traiterLesRefus({ site, precedent, sortie, maintenant, controler: site.controler });
  const avertissements = [...site.avertissements, ...refus.messages];
  const gardees = refus.gardees;

  // Les badges des bars, à côté de leur page ; le badge générique sous une page neutre.
  const fichiers = [...site.pages, ...refus.replis];
  for (const p of fichiers.filter((x) => x.type === 'bar')) {
    fichiers.push({
      chemin: `${p.chemin}badge.svg`, type: 'badge', cle: p.cle, indexable: false,
      contenu: badgeDuBar({ bar: p.bar, soiree: p.soirees?.[0] ?? null, parti: Boolean(p.parti || p.repli), maintenant, marque: site.contenu.marque, textes: site.contenu.textes, verre: site.cadre.verre }),
    });
  }

  // L’image de partage de chaque page de match, de ville, de bar, de « Ce soir » et de l’affiche de la semaine, à côté
  // d’elle. Son empreinte est celle de son dessin (le SVG et le rendu) : un dessin inchangé dont le fichier est là n’est
  // ni refait ni réécrit (contenu null). La tête de la page l’annonce avec sa version, le début de cette même empreinte
  // (partage.mjs, imageDeLaCarte) : « partage.png?v=… » ne change que si l’image change. Une page neutre n’en a pas
  // (l’image générale du site) : l’image de la page refusée part avec elle.
  if (charge.rendu) {
    for (const p of site.pages.filter((x) => x.carte)) {
      const chemin = cheminDeLImage(p.chemin);
      const svg = svgDeLaCarte(p.carte, { verre: site.cadre.verre });
      const marque = empreinteDuDessin(svg, charge.rendu.signature);
      const deja = precedent.pages?.[chemin]?.empreinte === marque && existsSync(path.join(sortie, fichierDuChemin(chemin)));
      const png = deja ? null : charge.rendu.rendre(svg);
      if (png && png.length > POIDS_MAX) journal(`avertissement : ${chemin} pèse ${Math.round(png.length / 1024)} Ko (plus de ${POIDS_MAX / 1024} Ko)`);
      fichiers.push({ chemin, type: 'partage', cle: p.cle, indexable: false, empreinte: marque, contenu: png });
    }
  }

  // Les agendas (agenda.mjs) : celui de chaque club de Ligue 1 (agenda/<club>.ics), et le fichier de chaque match à
  // venir, à côté de sa page, même refusée (il ne dépend pas d’elle). L’état garde la version de leurs évènements.
  const agendas = fabriquerLesAgendas({ donnees: site.donnees, pages: [...site.pages, ...site.refusees], precedent, maintenant });
  fichiers.push(...agendas.fichiers);

  // La prudence : jamais plus de la moitié des pages publiées supprimées d’un coup.
  const nouveaux = new Set([...fichiers.map((f) => f.chemin), ...gardees.map((g) => g.chemin)]);
  const anciennesPages = Object.keys(precedent.pages ?? {}).filter((chemin) => chemin.endsWith('/'));
  const supprimees = Object.keys(precedent.pages ?? {}).filter((chemin) => !nouveaux.has(chemin));
  const pagesSupprimees = supprimees.filter((chemin) => chemin.endsWith('/'));
  if (!accepterLesSuppressions && anciennesPages.length >= SEUIL_DE_PRUDENCE && pagesSupprimees.length > anciennesPages.length / 2) {
    throw new Error(`Ce passage supprimerait ${pagesSupprimees.length} des ${anciennesPages.length} pages publiées : rien n’est écrit. Si c’est voulu, relance avec --accepter-les-suppressions.`);
  }

  const aujourdhui = jourDeParis(maintenant);
  const etat = nouvelEtat(precedent, fichiers, aujourdhui, gardees, site.donnees.adresses, agendas.evenements);
  const planActuel = existsSync(path.join(sortie, PLAN)) ? readFileSync(path.join(sortie, PLAN), 'utf8') : readFileSync(path.join(racine, PLAN), 'utf8');
  const plan = nouveauPlan(planActuel, etat);

  // Chaque chemin vérifié avant d’écrire le moindre fichier : un seul hors de la liste blanche (une adresse vide, des
  // capitales, « .. »), et rien n’est écrit.
  const refuses = [...fichiers.map((f) => f.chemin), ...supprimees].filter((chemin) => !estPermis(fichierDuChemin(chemin)));
  if (refuses.length) throw new Error(`Chemins refusés (hors de la liste blanche du générateur), rien n’est écrit : ${refuses.join(', ')}`);

  // L’accueil : son bloc des matchs de la semaine, des mêmes données. Un bloc qui ne se fait pas (des textes sans le
  // sien), un bloc refusé par son contrôle, ou un accueil sans ses repères, laisse l’accueil comme il est (le journal le
  // dit) : les pages des matchs s’écrivent quand même.
  let bloc = null;
  let accueil = null;
  try {
    bloc = blocDeLaSemaine({ donnees: site.donnees, textes: site.contenu.textes, maintenant });
    const erreursDuBloc = controlerLaSemaine(bloc);
    if (erreursDuBloc.length) {
      avertissements.push(`accueil : le bloc des matchs de la semaine est refusé (${erreursDuBloc.join(' ; ')}) : l’accueil reste comme il est`);
    } else {
      accueil = preparerLAccueil({ racine, sortie, bloc });
    }
  } catch (erreur) {
    avertissements.push(`accueil : ${erreur.message} : l’accueil reste comme il est`);
  }

  // Tout est prêt et contrôlé : seulement maintenant, l’écriture.
  const ecrits = fichiers.filter((f) => f.contenu !== null && ecrireUnFichier(sortie, fichierDuChemin(f.chemin), f.contenu)).map((f) => f.chemin);
  for (const chemin of supprimees) effacerUnFichier(sortie, fichierDuChemin(chemin));
  ecrireUnFichier(sortie, FICHIER_ETAT, texteDeLEtat(etat));
  ecrireUnFichier(sortie, PLAN, plan);
  if (accueil) ecrireLAccueil(sortie, accueil);

  // Pour IndexNow : les adresses indexables dont le contenu a changé, et celles qui l’étaient au passage précédent et
  // ne le sont plus (passées en noindex, ou disparues), pour que les moteurs les relisent.
  const changees = [
    ...Object.entries(etat.pages).filter(([chemin, p]) => p.indexable && chemin.endsWith('/') && p.empreinte !== precedent.pages?.[chemin]?.empreinte),
    ...Object.entries(precedent.pages ?? {}).filter(([chemin, p]) => p?.indexable && chemin.endsWith('/') && !etat.pages[chemin]?.indexable),
  ].map(([chemin]) => adresseDe(chemin));
  const compte = {};
  for (const p of site.pages) {
    compte[p.type] ??= { pages: 0, indexables: 0 };
    compte[p.type].pages += 1;
    if (p.indexable) compte[p.type].indexables += 1;
  }
  for (const avertissement of avertissements) journal(`avertissement : ${avertissement}`);
  return { etat, plan, fichiers, ecrits, supprimees, changees, compte, avertissements, donnees: site.donnees, accueil: { bloc, ecrit: Boolean(accueil) } };
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
      images: options.images,
      journal,
    });
    const resume = Object.entries(resultat.compte).map(([type, { pages, indexables }]) => `${type} : ${pages} (${indexables} indexables)`).join(' · ');
    console.log(`Pages : ${resume}`);
    console.log(`${resultat.ecrits.length} fichiers écrits ou changés, ${resultat.supprimees.length} supprimés, ${resultat.changees.length} adresses indexables changées${resultat.accueil.ecrit ? ', le bloc de l’accueil réécrit' : ''}.`);
    if (typeof options.changees === 'string') writeFileSync(options.changees, resultat.changees.map((a) => `${a}\n`).join(''));
  } catch (erreur) {
    console.error(erreur.message);
    process.exitCode = 1;
  }
}
