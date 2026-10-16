// Réduit une copie enregistrée des trois listes publiques (matches.json, bars.json, match-nights.json) aux seuls
// renseignements que le générateur lit : la copie des tests, dans ce dépôt public, ne garde rien d’autre (ni les places,
// ni la fréquentation, ni les images des clubs, ni un identifiant de l’appli : anonymiser). Le générateur lit la copie réduite comme la copie complète.
// Usage : node generateur/outils/reduire-capture.mjs <dossier de la copie complète> <dossier de la copie réduite>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAISON_D_ESSAI, raisonDEcarter } from '../donnees.mjs';

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

// La copie publique ne garde aucun identifiant de l’appli : chaque match, soirée et bar reçoit un identifiant factice
// stable (« match-001 », dans l’ordre des coups d’envoi ; « soiree-001 », « bar-001 »), et le seul bar, celui de démo,
// devient « Bar de démo » au « Site de démo - 1 rue de l’Exemple, 75001 Paris », sans position (toujours écarté comme
// bar de démo). Les clubs ne gardent que leur nom et le nom court que lit clubs.json (« le-mans-fc »), sans identifiant.
// Un vrai bar arrête tout : il n’a rien à faire dans un dépôt public. Une copie déjà réduite et rendue factice le reste, à l’identique.
export const BAR_DE_DEMO = { name: 'Bar de démo', address: 'Site de démo - 1 rue de l’Exemple, 75001 Paris' };
export const anonymiser = ({ matches, bars, matchNights }) => {
  const numero = (prefixe, i) => `${prefixe}-${String(i + 1).padStart(3, '0')}`;
  const ordre = (a, b) => String(a.startAt).localeCompare(String(b.startAt)) || String(a.id).localeCompare(String(b.id));
  const tousLesMatchs = [...matches, ...matchNights.map((n) => n.match).filter((m) => m?.startAt)];
  const idsDesMatchs = new Map();
  for (const match of [...tousLesMatchs].sort(ordre)) if (!idsDesMatchs.has(match.id)) idsDesMatchs.set(match.id, numero('match', idsDesMatchs.size));
  const idsDesBars = new Map([...bars].sort((a, b) => String(a.id).localeCompare(String(b.id))).map((bar, i) => [bar.id, numero('bar', i)]));
  const idDuMatch = (id) => idsDesMatchs.get(id) ?? id;
  const enMatch = (match) => ({ ...match, id: idDuMatch(match.id) });
  const parId = (a, b) => a.id.localeCompare(b.id);
  return {
    matches: matches.map(enMatch).sort(parId),
    bars: bars.map((bar) => {
      // Un vrai bar n’entre jamais dans la copie publique : seulement un bar de démo ou d’essai.
      const raison = raisonDEcarter(bar, new Set());
      if (raison !== 'bar de démonstration' && raison !== RAISON_D_ESSAI) throw new Error('La copie publique ne garde qu’un bar de démo : retire les vrais bars de la copie avant de la réduire.');
      const { lat, lng, ...reste } = bar;
      return { ...reste, id: idsDesBars.get(bar.id), ...BAR_DE_DEMO };
    }).sort(parId),
    matchNights: [...matchNights]
      .sort((a, b) => idDuMatch(a.match?.id).localeCompare(idDuMatch(b.match?.id)) || String(a.id).localeCompare(String(b.id)))
      .map((soiree, i) => ({ ...soiree, id: numero('soiree', i), bar: { id: idsDesBars.get(soiree.bar?.id) ?? null }, match: enMatch(soiree.match ?? {}) })),
  };
};

const FICHIERS = { matches: 'matches.json', bars: 'bars.json', matchNights: 'match-nights.json' };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree || !sortie) throw new Error('Usage : node generateur/outils/reduire-capture.mjs <copie complète> <copie réduite>');
  const brut = Object.fromEntries(Object.entries(FICHIERS).map(([cle, nom]) => [cle, JSON.parse(readFileSync(path.join(entree, nom), 'utf8'))]));
  const reduit = anonymiser(reduire(brut));
  mkdirSync(sortie, { recursive: true });
  for (const [cle, nom] of Object.entries(FICHIERS)) writeFileSync(path.join(sortie, nom), `${JSON.stringify(reduit[cle], null, 1)}\n`);
  console.log(`Copie réduite écrite dans ${sortie} : ${reduit.matches.length} matchs, ${reduit.bars.length} bars, ${reduit.matchNights.length} soirées`);
}
