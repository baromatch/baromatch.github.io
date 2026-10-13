// L’invitation d’une tablée, dans la forme où GET /api/tablee/‹code› la renvoie, pour simuler l’API dans les tests de
// la page /t/‹code› : tablée ouverte de Nico_B, 3 places libres sur 4, mardi 13 octobre 2026 à 21:00 (heure de Paris).
// La page n’en lit qu’une partie (bar, match, kickoffAt, arrivalTime, host, open, full) : le reste (places, membres,
// détails du match) est là pour qu’elle l’ignore.
// L’API de production : aucun test ne l’appelle. couperLAPI la coupe pour une page qui n’a pas besoin de sa réponse.
export const API_PRODUCTION = /api-production-8ce4\.up\.railway\.app/;
export const API_TABLEE = /api-production-8ce4\.up\.railway\.app\/api\/tablee\//;

// Un club : la page n’en lit que le nom, quand le match n’a ni titre ni équipes.
const club = (slug, canonicalName) => ({ id: `club_${slug}`, slug, canonicalName });

export const INVITATION = {
  host: { pseudo: 'Nico_B' },
  bar: { id: 'bar_le_comptoir', name: 'Le Comptoir', address: '12 rue Oberkampf, 75011 Paris' },
  match: {
    id: 'match_psg_om',
    title: 'Paris – Marseille',
    startAt: '2026-10-13T19:00:00.000Z',
    league: 'Ligue 1',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Olympique de Marseille',
    homeClub: club('paris-saint-germain', 'Paris Saint-Germain'),
    awayClub: club('olympique-de-marseille', 'Olympique de Marseille'),
  },
  kickoffAt: '2026-10-13T19:00:00.000Z',
  arrivalTime: '2026-10-13T18:30:00.000Z',
  seats: 4,
  taken: 1,
  open: 3,
  full: false,
  members: [{ pseudo: 'Nico_B', host: true }],
};

// Le serveur ne répond qu’à l’origine exacte https://baromatch.fr ; les tests servent la page depuis 127.0.0.1, que la
// simulation admet aussi. Toute autre origine (www, http) n’a pas d’en-tête CORS : le navigateur bloque la réponse,
// comme en vrai.
export const ORIGINES_ADMISES = [/^https:\/\/baromatch\.fr$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
export const enTetesCors = async (requete) => {
  const origine = (await requete.allHeaders()).origin ?? '';
  return ORIGINES_ADMISES.some((motif) => motif.test(origine)) ? { 'access-control-allow-origin': origine, vary: 'Origin' } : {};
};

export const simulerLInvitation = (onglet, corps = INVITATION, statut = 200) => onglet.route(API_TABLEE, async (route) => route.fulfill({
  status: statut,
  contentType: 'application/json',
  body: JSON.stringify(corps),
  headers: await enTetesCors(route.request()),
}));

export const couperLAPI = (onglet) => onglet.route(API_PRODUCTION, (route) => route.abort());
