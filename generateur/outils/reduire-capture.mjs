// Réduit une copie enregistrée des trois listes publiques (matches.json, bars.json, match-nights.json) aux seuls
// renseignements que le générateur lit : la copie des tests, dans ce dépôt public, ne garde rien d’autre (ni les places,
// ni la fréquentation, ni les images des clubs). Le générateur lit la copie réduite comme la copie complète.
// Usage : node generateur/outils/reduire-capture.mjs <dossier de la copie complète> <dossier de la copie réduite>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const garder = (objet, cles) => (objet && typeof objet === 'object'
  ? Object.fromEntries(cles.filter((cle) => objet[cle] !== undefined).map((cle) => [cle, objet[cle]]))
  : objet ?? null);

const CLUB = ['slug', 'canonicalName'];
// L’heure annoncée comme provisoire : dite par un seul renseignement, heureProvisoire, que le générateur lit aussi.
const provisoire = (etat) => (etat && etat !== 'CONFIRMED' ? { heureProvisoire: true } : {});
const reduireUnMatch = (match) => ({
  ...garder(match, ['id', 'startAt', 'league', 'homeTeam', 'awayTeam']),
  ...provisoire(match.kickoffStatus),
  homeClub: garder(match.homeClub, CLUB),
  awayClub: garder(match.awayClub, CLUB),
});
const reduireUnBar = (bar) => garder(bar, ['id', 'name', 'address', 'lat', 'lng', 'isActive', 'isDemo', 'features']);

export const reduire = ({ matches, bars, matchNights }) => {
  const connus = new Set(matches.map((m) => m.id));
  return {
    matches: matches.map(reduireUnMatch),
    bars: bars.map(reduireUnBar),
    // Le match d’une soirée : son identifiant s’il est dans la liste des matchs, sinon tout ce qu’en lit le générateur.
    matchNights: matchNights.map((soiree) => ({
      ...garder(soiree, ['id', 'status']),
      bar: garder(soiree.bar, ['id']),
      match: connus.has(soiree.match?.id) ? garder(soiree.match, ['id']) : reduireUnMatch(soiree.match ?? {}),
      offer: garder(soiree.offer, ['title', 'priceCents', 'until', 'hasAlcohol']),
    })),
  };
};

const FICHIERS = { matches: 'matches.json', bars: 'bars.json', matchNights: 'match-nights.json' };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree || !sortie) throw new Error('Usage : node generateur/outils/reduire-capture.mjs <copie complète> <copie réduite>');
  const brut = Object.fromEntries(Object.entries(FICHIERS).map(([cle, nom]) => [cle, JSON.parse(readFileSync(path.join(entree, nom), 'utf8'))]));
  const reduit = reduire(brut);
  mkdirSync(sortie, { recursive: true });
  for (const [cle, nom] of Object.entries(FICHIERS)) writeFileSync(path.join(sortie, nom), `${JSON.stringify(reduit[cle], null, 1)}\n`);
  console.log(`Copie réduite écrite dans ${sortie} : ${reduit.matches.length} matchs, ${reduit.bars.length} bars, ${reduit.matchNights.length} soirées`);
}
