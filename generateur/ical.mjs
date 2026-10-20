// L’écriture iCalendar (RFC 5545) des agendas du site (agenda.mjs) : des lignes « NOM:valeur » finies par CRLF, pliées
// à 75 octets (la suite sur la ligne d’après, après une espace, sans jamais couper un caractère en deux), en UTF-8. Un
// texte (TEXT) a sa barre oblique inverse, son point-virgule, sa virgule et ses retours à la ligne échappés. Les heures
// sont des instants en UTC (« 20261025T194500Z ») : aucun fuseau à décrire (pas de VTIMEZONE), lus pareil par Google,
// Apple et Outlook, et montrés par chaque téléphone à son heure. Un jour sans heure est une date (« 20261031 »).
import { Buffer } from 'node:buffer';

export const FIN_DE_LIGNE = '\r\n';
// Une ligne fait au plus 75 octets, sans sa fin de ligne ; une ligne de suite commence par une espace, qui compte.
export const OCTETS_PAR_LIGNE = 75;

// Les caractères de contrôle n’ont rien à faire dans un texte d’agenda (seul le retour à la ligne s’écrit, échappé) :
// ils sont retirés, une tabulation devient une espace.
export const echapperTexte = (texte) => String(texte ?? '')
  .replace(/\r\n|\r/g, '\n')
  .replace(/\t/g, ' ')
  .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\n/g, '\\n');

// Une ligne logique, pliée : jamais plus de 75 octets par ligne, un caractère (même sur plusieurs octets) jamais coupé.
export const plier = (ligne) => {
  const morceaux = [];
  let courant = '';
  let octets = 0;
  let place = OCTETS_PAR_LIGNE;
  for (const caractere of ligne) {
    const taille = Buffer.byteLength(caractere, 'utf8');
    if (octets + taille > place) {
      morceaux.push(courant);
      courant = '';
      octets = 0;
      place = OCTETS_PAR_LIGNE - 1;
    }
    courant += caractere;
    octets += taille;
  }
  morceaux.push(courant);
  return morceaux.join(`${FIN_DE_LIGNE} `);
};

// « 2026-10-25T19:45:00.000Z » → « 20261025T194500Z » : un instant, en UTC, à la seconde.
export const instantUtc = (instant) => new Date(instant).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');

// « 2026-10-25 » → « 20261025 » : un jour, sans heure.
export const jourIcal = (jour) => jour.replace(/-/g, '');

// « 2026-10-25 » → « 2026-10-26 » : le lendemain d’un jour (la fin, exclue, d’un évènement sur la journée).
export const lendemain = (jour) => new Date(Date.parse(`${jour}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// Les lignes logiques d’un fichier (BEGIN, propriétés, END…) → le fichier : chaque ligne pliée, finie par CRLF.
export const ecrireLeFichier = (lignes) => lignes.map((ligne) => `${plier(ligne)}${FIN_DE_LIGNE}`).join('');
