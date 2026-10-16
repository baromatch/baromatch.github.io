// L’heure de Paris, la seule que le site affiche. Les données donnent des instants en UTC (« 2026-10-25T19:45:00Z ») :
// Intl les lit dans le fuseau Europe/Paris, changement d’heure compris (le dimanche 25 octobre 2026, Paris passe de
// +02:00 à +01:00). Aucune bibliothèque : Node suffit.

const FUSEAU = 'Europe/Paris';

const morceaux = (instant, options) => Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, ...options })
  .formatToParts(new Date(instant)).filter((m) => m.type !== 'literal').map((m) => [m.type, m.value]));

// « 2026-10-25 » : le jour à Paris (l’adresse d’un match, la date du plan du site).
// Lu morceau par morceau (formatToParts) : le format d’une langue entière peut changer d’une version d’Intl à l’autre.
export const jourDeParis = (instant) => {
  const { year, month, day } = morceaux(instant, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${year}-${month}-${day}`;
};

// « 20:45 ».
export const heureDeParis = (instant) => {
  const { hour, minute } = morceaux(instant, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${hour}:${minute}`;
};

// « +01:00 » ou « +02:00 » : le décalage de Paris à cet instant.
export const decalageDeParis = (instant) => {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instant)).find((m) => m.type === 'timeZoneName').value;
  const trouve = nom.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return trouve ? `${trouve[1]}:${trouve[2] ?? '00'}` : '+00:00';
};

// « 2026-10-25T20:45:00+01:00 » : l’instant écrit à l’heure de Paris, pour les données structurées.
export const isoDeParis = (instant) => {
  const m = morceaux(instant, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}${decalageDeParis(instant)}`;
};

// « dimanche 25 octobre », « dimanche 1er novembre ».
export const jourEnLettres = (instant) => {
  const { weekday, day, month } = morceaux(instant, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${weekday} ${day === '1' ? '1er' : day} ${month}`;
};

// « 25 octobre », « 1er novembre ».
export const dateCourte = (instant) => {
  const { day, month } = morceaux(instant, { day: 'numeric', month: 'long' });
  return `${day === '1' ? '1er' : day} ${month}`;
};

// « dimanche 25 octobre · 20:45 » ; sans heure annoncée : « dimanche 25 octobre · heure à confirmer ».
export const quandEnLettres = (instant, heureConfirmee = true) => `${jourEnLettres(instant)} · ${heureConfirmee ? heureDeParis(instant) : 'heure à confirmer'}`;

// Le nombre de jours de Paris entre deux instants (0 : le même jour à Paris, 1 : le lendemain…).
export const joursEntre = (avant, apres) => Math.round((Date.parse(`${jourDeParis(apres)}T00:00:00Z`) - Date.parse(`${jourDeParis(avant)}T00:00:00Z`)) / 86_400_000);

// L’heure à Paris, de 0 à 23 (pour dire « ce soir » plutôt qu’« aujourd’hui »).
export const heureDuJour = (instant) => Number(morceaux(instant, { hour: '2-digit', hourCycle: 'h23' }).hour);
