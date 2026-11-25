// Les données des aperçus : les vrais matchs de la semaine, lus dans l’état que le générateur écrit à chaque passage
// (regarder-le-match/etat.json), à un instant figé. Rien d’inventé : un aperçu montre la semaine telle que le site la
// publiait à cet instant. Les clubs sont dessinés par le générateur du site (generateur/insigne.mjs), comme partout.
import { readFileSync } from 'node:fs';
import { dessinDe, insigne, insigneDeFiche, CLUBS_DE_DEMO, identifiantsUniques } from '../../generateur/insigne.mjs';
import { heureDeParis, jourDeParis, jourEnLettres, isoDeParis } from '../../generateur/heure.mjs';
import { echapper } from '../../generateur/texte.mjs';

export { echapper, heureDeParis, jourDeParis, jourEnLettres, isoDeParis, insigne, insigneDeFiche, CLUBS_DE_DEMO, identifiantsUniques };

// L’instant de l’aperçu : mercredi 25 novembre 2026, 16:05 à Paris (le moment des captures).
export const MAINTENANT = Date.parse('2026-11-25T15:05:00Z');

const ETAT = JSON.parse(readFileSync(new URL('../../regarder-le-match/etat.json', import.meta.url), 'utf8'));

// Les sept jours de Paris à partir d’aujourd’hui.
export const SEPT_JOURS = Array.from({ length: 7 }, (_, i) => jourDeParis(MAINTENANT + i * 86_400_000));

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const jourCourt = (jour) => {
  const d = new Date(`${jour}T12:00:00Z`);
  return { nom: JOURS_COURTS[d.getUTCDay()], numero: d.getUTCDate() };
};

// Les matchs de la semaine, dans l’ordre du coup d’envoi : ceux qui n’ont pas encore commencé.
export const MATCHS = Object.values(ETAT.pages)
  .filter((p) => p.type === 'match' && p.memoire)
  .map((p) => p.memoire)
  .filter((m) => SEPT_JOURS.includes(jourDeParis(m.debut)) && Date.parse(m.debut) > MAINTENANT - 2 * 3_600_000)
  .sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut) || a.slug.localeCompare(b.slug))
  .map((m) => ({
    slug: m.slug,
    adresse: `/matchs/${m.slug}/`,
    debut: m.debut,
    jour: jourDeParis(m.debut),
    heure: heureDeParis(m.debut),
    iso: isoDeParis(m.debut),
    heureConfirmee: m.heureConfirmee !== false,
    competition: m.competition,
    domicile: m.domicile,
    exterieur: m.exterieur,
    titre: `${m.domicile.court} – ${m.exterieur.court}`,
  }));

export const PAR_JOUR = SEPT_JOURS.map((jour) => ({ jour, ...jourCourt(jour), matchs: MATCHS.filter((m) => m.jour === jour) }));
export const CE_SOIR = PAR_JOUR[0].matchs;
export const PROCHAIN = CE_SOIR.find((m) => Date.parse(m.debut) > MAINTENANT) ?? MATCHS[0];

// Les couleurs d’un club, telles que son insigne les porte (jamais devinées : l’insigne neutre sinon).
export const couleursDe = (club) => {
  const d = dessinDe(club);
  if (d.bandes) return { a: d.bandes.bands[0], b: d.bandes.bands[d.bandes.bands.length - 1] };
  return { a: d.fiche.colours.primary, b: d.fiche.colours.secondary };
};

// « dans 2 h 40 » à l’instant de l’aperçu.
export const dans = (instant) => {
  const minutes = Math.max(0, Math.round((Date.parse(instant) - MAINTENANT) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `dans ${h} h ${String(m).padStart(2, '0')}` : `dans ${m} min`;
};

// Un insigne en symbole (dessiné une fois, posé plusieurs fois avec <use>), sous un identifiant donné.
export const symbole = (id, club, taille, fond) => insigne(club, { taille, fond })
  .replace(/^<svg class="insigne" width="\d+" height="\d+" viewBox="([^"]+)" aria-hidden="true" focusable="false">/, `<symbol id="${id}" viewBox="$1">`)
  .replace(/<\/svg>$/, '</symbol>');

export const pose = (id, classe, taille) => `<svg class="${classe}" width="${taille}" height="${taille}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

// La ligne qui nomme un match pour une voix : « PSG – Rome, mercredi 25 novembre à 21:00, Ligue des champions ».
export const enMots = (m) => `${m.titre}, ${m.heure}, ${jourEnLettres(m.debut)}, ${m.competition}`;

// Le pied de page léger : les adresses qui ne bougent jamais (celles que les stores et l’appli citent comprises).
export const PIED = [
  ['/matchs/', 'Les matchs'],
  ['/pour-les-bars.html', 'Pour les bars'],
  ['/a-propos.html', 'À propos'],
  ['/presse.html', 'Presse'],
  ['/confidentialite.html', 'Confidentialité'],
  ['/cgu.html', 'Règles de l’appli'],
  ['/mentions-legales.html', 'Mentions légales'],
  ['/supprimer-mon-compte.html', 'Supprimer mon compte'],
];
