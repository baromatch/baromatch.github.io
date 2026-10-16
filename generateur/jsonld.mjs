// Les données structurées (JSON-LD) des pages générées. Une soirée dans un bar est un Event, la diffusion : son lieu et
// son organisateur sont le bar (BarOrPub), et le match (SportsEvent, avec ses deux équipes) est ce dont elle parle
// (about). Le match lui-même se joue au stade, pas au bar : le bar n’est jamais le lieu du SportsEvent. Une même soirée
// a la même adresse (url et @id) sur la page du match et sur celle du bar : l’ancre de la soirée sur la page du bar.
// Aucune offre de bar ici (loi Evin) ; « offers » (la place gratuite) seulement quand l’appli est ouverte.
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

// « au Zinc des Amis », « à la Cave des Gones », « aux Trois Frères », « à l’Escale » ; un autre nom reste entier.
export const auBar = (nom) => {
  const trouve = nom.match(/^(Le|La|Les|L[’'])\s*(.*)$/);
  if (!trouve) return `, ${nom}`;
  const [, article, reste] = trouve;
  if (article === 'Le') return ` au ${reste}`;
  if (article === 'Les') return ` aux ${reste}`;
  if (article === 'La') return ` à la ${reste}`;
  return ` à l’${reste}`;
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

export const matchDuStade = (match) => ({
  '@type': 'SportsEvent',
  name: `${match.domicile.nom} – ${match.exterieur.nom}`,
  startDate: debutDe(match),
  sport: 'Football',
  homeTeam: { '@type': 'SportsTeam', name: match.domicile.nom },
  awayTeam: { '@type': 'SportsTeam', name: match.exterieur.nom },
});

// Une soirée : la diffusion d’un match dans un vrai bar.
export const evenementDeLaSoiree = (soiree, { marque }) => {
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
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [IMAGE],
    location: barOuPub(bar),
    organizer: { '@type': 'BarOrPub', name: bar.nom, url: adresseDe(cheminDuBar(bar)) },
    about: matchDuStade(match),
    ...(marque.appli.ouverte && magasins.length
      ? { offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: magasins[0] } }
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
