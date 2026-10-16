// D’où viennent les données : l’appli elle-même (ses trois listes publiques, celles que lit aussi le site), une copie
// enregistrée de ces listes (un dossier avec matches.json, bars.json et match-nights.json), ou un scénario de test
// (un seul fichier, { "matches": […], "bars": […], "matchNights": […] }). Les trois donnent la même chose : trois
// listes brutes, que donnees.mjs trie. Une liste illisible, une réponse en erreur ou une liste de matchs vide arrête
// tout : le générateur n’écrit rien, et les pages en ligne restent comme elles sont.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ADRESSE_PUBLIQUE = 'https://api-production-8ce4.up.railway.app/api';
const CHEMINS = { matches: '/matches', bars: '/bars', matchNights: '/bars/match-nights' };
const FICHIERS = { matches: 'matches.json', bars: 'bars.json', matchNights: 'match-nights.json' };
const ATTENTE_MS = 30_000;
const ESSAIS = 2;

const exigerUneListe = (valeur, nom) => {
  if (!Array.isArray(valeur)) throw new Error(`${nom} : une liste était attendue, autre chose est arrivé`);
  return valeur;
};

const lireUneAdresse = async (adresse) => {
  let derniere;
  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    try {
      const reponse = await fetch(adresse, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(ATTENTE_MS) });
      if (!reponse.ok) throw new Error(`${adresse} répond ${reponse.status}`);
      return await reponse.json();
    } catch (erreur) {
      derniere = erreur;
    }
  }
  throw new Error(`Données illisibles, rien n’est écrit : ${derniere.message}`);
};

const lireUnFichier = (fichier) => JSON.parse(readFileSync(fichier, 'utf8'));

// « api », « capture:<dossier> » ou « scenario:<fichier> » → { matches, bars, matchNights }.
export const lireLaSource = async (source, { adresse = ADRESSE_PUBLIQUE } = {}) => {
  const [genre, ...reste] = source.split(':');
  const cible = reste.join(':');
  let brut;
  if (genre === 'api') {
    const [matches, bars, matchNights] = await Promise.all(Object.values(CHEMINS).map((chemin) => lireUneAdresse(`${adresse}${chemin}`)));
    brut = { matches, bars, matchNights };
  } else if (genre === 'capture' && cible) {
    brut = Object.fromEntries(Object.entries(FICHIERS).map(([cle, nom]) => [cle, lireUnFichier(path.join(cible, nom))]));
  } else if (genre === 'scenario' && cible) {
    brut = lireUnFichier(cible);
  } else {
    throw new Error(`Source inconnue « ${source} » : api, capture:<dossier> ou scenario:<fichier>`);
  }
  const donnees = Object.fromEntries(Object.keys(FICHIERS).map((cle) => [cle, exigerUneListe(brut[cle], cle)]));
  if (donnees.matches.length === 0) throw new Error('Aucun match dans les données : rien n’est écrit, les pages en ligne restent comme elles sont');
  return donnees;
};
