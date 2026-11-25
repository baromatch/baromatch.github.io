// Les données structurées (JSON-LD) des pages générées. Une soirée dans un bar est un Event, la diffusion : son lieu et
// son organisateur sont le bar (BarOrPub), et le match (SportsEvent, avec ses deux équipes) est ce dont elle parle
// (about). Le match lui-même se joue au stade, pas au bar : le bar n’est jamais le lieu du SportsEvent. Une même soirée
// a la même adresse (url et @id) sur la page du match et sur celle du bar : l’ancre de la soirée sur la page du bar.
// Aucune offre de bar ici (loi Evin) ; « offers » (la place gratuite) seulement quand l’appli est ouverte, et sans
// « availability » : les places changent après le passage, une page en ligne ne dit jamais qu’il en reste. Aucune image
// dans un Event : Google en demande une qui représente l’évènement, et l’image générique du site n’en est pas une.
import { isoDeParis, jourDeParis } from './heure.mjs';

export const ORIGINE = 'https://baromatch.fr';
export const ORGANISATION = `${ORIGINE}/#organisation`;
export const SITE = `${ORIGINE}/#site`;
export const IMAGE = `${ORIGINE}/img/og-image.jpg`;

export const adresseDe = (chemin) => `${ORIGINE}${chemin}`;
export const cheminDuBar = (bar) => `/bar/${bar.slug}/`;
export const cheminDuMatch = (match) => `/matchs/${match.slug}/`;
export const cheminDeLaVille = (ville) => `/regarder-le-match/${ville.cle}/`;
export const ancreDeLaSoiree = (match) => `soiree-${match.slug}`;
export const adresseDeLaSoiree = (soiree) => adresseDe(`${cheminDuBar(soiree.bar)}#${ancreDeLaSoiree(soiree.match)}`);

// L’heure d’un match annoncée comme provisoire n’est pas écrite : seulement le jour.
export const debutDe = (match) => (match.heureConfirmee ? isoDeParis(match.debut) : jourDeParis(match.debut));

// « aux Trois Frères », « au Zinc des Amis » (« Les » lu avant « Le », toujours suivi d’une espace), « à La Cave des
// Gones », « à L’Annexe », « à Legends Pub » : le nom reste entier, avec sa majuscule. Un nom qui commence déjà par
// « Au », « Aux » ou « Chez » suit une virgule (« , Au Bon Coin »).
export const auBar = (nom) => {
  const les = nom.match(/^Les\s+(\S.*)$/);
  if (les) return ` aux ${les[1]}`;
  const le = nom.match(/^Le\s+(\S.*)$/);
  if (le) return ` au ${le[1]}`;
  if (/^(?:Au|Aux|Chez|À)\s/i.test(nom)) return `, ${nom}`;
  return ` à ${nom}`;
};

export const barOuPub = (bar) => ({
  '@type': 'BarOrPub',
  '@id': `${adresseDe(cheminDuBar(bar))}#bar`,
  name: bar.nom,
  url: adresseDe(cheminDuBar(bar)),
  address: {
    '@type': 'PostalAddress',
    streetAddress: bar.rue,
    postalCode: bar.codePostal,
    addressLocality: bar.villeEcrite,
    addressCountry: 'FR',
  },
  ...(bar.lat !== null && bar.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: bar.lat, longitude: bar.lng } } : {}),
});

export const adresseDuMatch = (match) => `${adresseDe(cheminDuMatch(match))}#match`;
export const statutDuMatchSchema = (match) => `https://schema.org/${{ reporte: 'EventPostponed', annule: 'EventCancelled' }[match.statut] ?? 'EventScheduled'}`;

export const matchDuStade = (match) => ({
  '@type': 'SportsEvent',
  '@id': adresseDuMatch(match),
  name: `${match.domicile.nom} – ${match.exterieur.nom}`,
  startDate: debutDe(match),
  sport: 'Football',
  homeTeam: { '@type': 'SportsTeam', name: match.domicile.nom },
  awayTeam: { '@type': 'SportsTeam', name: match.exterieur.nom },
});

// Le match lui-même, sur sa page : un SportsEvent « Équipe A – Équipe B », son jour (et son heure, avec le décalage de
// Paris, quand elle est confirmée), son statut, ses deux équipes. Les données ne donnent pas le stade : aucun « location »
// (jamais un bar, jamais une adresse inventée), aucune image, aucune note. Sans lieu, Google n’en fait pas de résultat
// enrichi ; la donnée reste vraie et lisible pour qui la lit (validateur.mjs ne l’exige que des Event qui ont un lieu).
export const evenementDuMatch = (match) => ({
  ...matchDuStade(match),
  url: adresseDe(cheminDuMatch(match)),
  description: `${match.competition} : ${match.domicile.nom} – ${match.exterieur.nom}.`,
  eventStatus: statutDuMatchSchema(match),
});

// Une soirée : la diffusion d’un match dans un vrai bar. matchDansLaPage : la page porte déjà le match (evenementDuMatch),
// la soirée n’y renvoie que par son @id.
export const evenementDeLaSoiree = (soiree, { marque }, { matchDansLaPage = false } = {}) => {
  const { match, bar } = soiree;
  const adresse = adresseDeLaSoiree(soiree);
  const magasins = [marque.appli.android, marque.appli.iphone].filter(Boolean);
  return {
    '@type': 'Event',
    '@id': adresse,
    name: `${match.domicile.court} – ${match.exterieur.court}${auBar(bar.nom)}`,
    description: `${match.competition} : ${match.domicile.nom} – ${match.exterieur.nom}, diffusé${auBar(bar.nom)} (${bar.quartier}).`,
    url: adresse,
    startDate: debutDe(match),
    eventStatus: statutDuMatchSchema(match),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: barOuPub(bar),
    organizer: { '@type': 'BarOrPub', name: bar.nom, url: adresseDe(cheminDuBar(bar)) },
    about: matchDansLaPage ? { '@id': adresseDuMatch(match) } : matchDuStade(match),
    ...(marque.appli.ouverte && magasins.length
      ? { offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR', url: magasins[0] } }
      : {}),
  };
};

export const filDAriane = (etapes) => ({
  '@type': 'BreadcrumbList',
  itemListElement: etapes.map((etape, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: etape.nom,
    ...(i < etapes.length - 1 || etape.chemin ? { item: adresseDe(etape.chemin) } : {}),
  })),
});

// La page elle-même, rattachée au site et à l’organisation de l’accueil par leur @id.
export const pageWeb = ({ type = 'WebPage', chemin, titre, description, ...reste }) => ({
  '@type': type,
  '@id': adresseDe(chemin),
  url: adresseDe(chemin),
  name: titre,
  description,
  inLanguage: 'fr-FR',
  isPartOf: { '@id': SITE },
  publisher: { '@id': ORGANISATION },
  ...reste,
});

export const listeDesBars = (titre, bars) => ({
  '@type': 'ItemList',
  name: titre,
  numberOfItems: bars.length,
  itemListElement: bars.map((bar, i) => ({ '@type': 'ListItem', position: i + 1, name: bar.nom, url: adresseDe(cheminDuBar(bar)) })),
});

export const questions = (faq) => faq.map(({ question, reponse }) => ({
  '@type': 'Question',
  name: question,
  acceptedAnswer: { '@type': 'Answer', text: reponse },
}));

// Le bloc tel qu’il s’écrit dans la page : « < » échappé, pour qu’aucun texte ne ferme la balise.
export const blocJsonLd = (noeuds) => JSON.stringify({ '@context': 'https://schema.org', '@graph': noeuds }).replace(/</g, '\\u003c');
