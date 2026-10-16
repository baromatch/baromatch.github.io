// Des trois listes brutes (sources.mjs) aux données des pages : les vrais bars seulement, un match par match (les
// doublons réunis), les noms courts des clubs, l’heure de Paris, la ville et l’arrondissement de chaque bar. Rien
// n’est inventé : un renseignement absent des données reste absent des pages.
import { pourComparer, slug } from './texte.mjs';
import { jourDeParis } from './heure.mjs';

export const HEURE_MS = 3_600_000;
export const JOUR_MS = 24 * HEURE_MS;
// Un match se joue en deux heures environ (mi-temps comprise) : jusque-là, il est en cours, pas passé.
export const DUREE_MATCH_MS = 2 * HEURE_MS;
// Deux matchs des deux mêmes clubs à moins de trois heures l’un de l’autre sont le même match, écrit deux fois.
export const ECART_DOUBLON_MS = 3 * HEURE_MS;

// Ce qu’un bar dit de lui (et rien d’autre) : seulement ces renseignements, s’ils sont donnés.
const ATOUTS = ['screens', 'sound', 'standing', 'bothCamps', 'outdoor', 'food'];
// Les soirées qu’un bar a vraiment annoncées (un brouillon ou une soirée annulée ne se montre pas).
const SOIREES_ANNONCEES = new Set(['OPEN', 'CLOSED']);
// Un bar de démonstration ou d’essai se reconnaît à un de ces mots dans son nom, son adresse ou son identifiant, sans
// accents ni capitales, même collé à un autre mot (« TestBar », « Demo2 », « bar_test ») ; « qa » seulement seul ou
// collé à un chiffre ou à « _ » (« QA2 Bar »), pour garder « Aquarium ». Un vrai bar écarté à tort (« Le Testament »)
// se réintègre par son identifiant dans la liste « forcer » de bars-exclus.json.
const MOTS_D_ESSAI = /demo|test|essai|recette|staging|sandbox|fictif|factice|(?:^|[^a-z])qa(?:[^a-z]|$)/;
export const RAISON_D_ESSAI = 'démo, test ou essai dans le nom, l’adresse ou l’identifiant';
// Ce qu’aucune page ne dit, même si une offre de bar l’écrit (loi Evin, et aucun score).
export const MOTS_INTERDITS = /happy[\s-]*hours?|tournées?|verres? offerts?|\bscores?\b/i;

// ---------- Les clubs ----------

// Les sigles qu’un nom de club porte en plus de son nom (« FC », « AC », « A.Ş. »…) : le repli d’un club inconnu.
const SIGLE = /^(?:[A-ZÀ-ÝŞ]\.?){1,5}$|^Vf[BL]$/u;
const sansSigles = (nom) => {
  const mots = String(nom).split(/\s+/).filter((mot) => mot && !SIGLE.test(mot));
  return mots.length ? mots.join(' ') : String(nom);
};

export const indexerLesClubs = (clubs) => {
  const index = new Map();
  for (const [cle, club] of Object.entries(clubs)) {
    if (cle.startsWith('_')) continue;
    for (const nomDansLAppli of club.slugs) index.set(nomDansLAppli, { cle, court: club.court, nom: club.nom });
  }
  return index;
};

// Un club des données → { cle, court, nom } : la clé sert à l’adresse et aux doublons, « court » s’affiche partout,
// « nom » est le nom complet.
export const clubDe = (index, clubBrut, nomEquipe) => {
  const nomDansLAppli = clubBrut?.slug || slug(nomEquipe);
  const connu = index.get(nomDansLAppli);
  const nom = connu?.nom ?? clubBrut?.canonicalName ?? nomEquipe ?? '';
  if (connu) return { cle: connu.cle, court: connu.court, nom };
  const court = sansSigles(nom);
  return { cle: slug(court), court, nom };
};

// ---------- Les matchs ----------

const competitionDe = (competitions, nom) => competitions[nom] ?? nom;

const lireUnMatch = (brut, index, competitions) => {
  const debut = Date.parse(brut.startAt);
  if (!brut.id || Number.isNaN(debut)) return null;
  return {
    ids: [String(brut.id)],
    id: String(brut.id),
    debut,
    // Une heure provisoire n’est pas une heure : elle ne s’affiche pas (la copie réduite le dit par heureProvisoire).
    heureConfirmee: brut.heureProvisoire !== true && (brut.kickoffStatus ?? 'CONFIRMED') === 'CONFIRMED',
    competition: competitionDe(competitions, brut.league ?? ''),
    competitionFrancaise: !(brut.league in competitions) || competitions[brut.league] === brut.league,
    domicile: clubDe(index, brut.homeClub, brut.homeTeam),
    exterieur: clubDe(index, brut.awayClub, brut.awayTeam),
  };
};

// Deux matchs des deux mêmes clubs (dans un sens ou dans l’autre) à moins de trois heures : un seul match, qui garde le
// nom français de la compétition, l’heure confirmée plutôt que provisoire, et toutes ses soirées (par ses deux
// identifiants).
export const reunirLesDoublons = (matchs) => {
  const reunis = [];
  const paire = (m) => [m.domicile.cle, m.exterieur.cle].sort().join('|');
  for (const match of [...matchs].sort((a, b) => a.debut - b.debut || a.id.localeCompare(b.id))) {
    const double = reunis.find((m) => paire(m) === paire(match) && Math.abs(m.debut - match.debut) < ECART_DOUBLON_MS);
    if (!double) {
      reunis.push({ ...match });
      continue;
    }
    double.ids = [...new Set([...double.ids, ...match.ids])].sort();
    if (!double.competitionFrancaise && match.competitionFrancaise) {
      double.competition = match.competition;
      double.competitionFrancaise = true;
    }
    if (!double.heureConfirmee && match.heureConfirmee) {
      double.debut = match.debut;
      double.heureConfirmee = true;
    }
  }
  return reunis;
};

// L’adresse d’un match : noms courts et jour à Paris (« psg-ol-2026-10-25 ») ; deux matchs qui la partageraient
// prennent « -2 », « -3 » dans l’ordre de leur coup d’envoi.
const nommerLesMatchs = (matchs) => {
  const pris = new Map();
  for (const match of matchs) {
    const base = `${match.domicile.cle}-${match.exterieur.cle}-${jourDeParis(match.debut)}`;
    const rang = (pris.get(base) ?? 0) + 1;
    pris.set(base, rang);
    match.slug = rang === 1 ? base : `${base}-${rang}`;
  }
};

// ---------- Les bars ----------

// « 12 Rue Oberkampf, 75011 Paris » → rue, code postal et ville ; null si l’adresse ne finit pas par un code postal
// et une ville.
export const lireLAdresse = (adresse) => {
  const propre = String(adresse ?? '').trim().replace(/,?\s*France$/i, '');
  const trouve = propre.match(/^(.*?)[,\s]+(\d{5})\s+([^\d,][^,]*?)\s*$/);
  if (!trouve) return null;
  return { rue: trouve[1].trim().replace(/[,\s-]+$/, ''), codePostal: trouve[2], ville: trouve[3].trim() };
};

// Paris, Lyon et Marseille ont des arrondissements, lus dans le code postal (75011 → Paris 11e, 75116 → Paris 16e).
const ARRONDISSEMENTS = {
  paris: { prefixe: '75', max: 20, lire: (cp) => (cp === '75116' ? 16 : Number(cp.slice(3))) },
  lyon: { prefixe: '6900', max: 9, lire: (cp) => Number(cp.slice(3)) },
  marseille: { prefixe: '130', max: 16, lire: (cp) => Number(cp.slice(3)) },
};

export const arrondissementDe = (villeCle, nomVille, codePostal) => {
  const regle = ARRONDISSEMENTS[villeCle];
  if (!regle || !codePostal.startsWith(regle.prefixe)) return null;
  const numero = regle.lire(codePostal);
  if (!(numero >= 1 && numero <= regle.max)) return null;
  return { numero, libelle: `${nomVille} ${numero === 1 ? '1er' : `${numero}e`}`, ancre: `${villeCle}-${numero}` };
};

// La ville d’un code postal : celle de villes.json dont un préfixe lui va, sinon le nom écrit dans l’adresse.
export const villeDe = (villes, codePostal, nomEcrit) => {
  for (const [cle, ville] of Object.entries(villes)) {
    if (cle.startsWith('_')) continue;
    if ((ville.codesPostaux ?? []).some((prefixe) => codePostal.startsWith(prefixe))) return { cle, nom: ville.nom };
  }
  return { cle: slug(nomEcrit), nom: nomEcrit };
};

// Pourquoi un bar n’est pas un vrai bar (null s’il en est un).
// forces : les identifiants des bars réintégrés à la main (liste « forcer » de bars-exclus.json), dont le nom ou
// l’adresse ressemble à un bar d’essai sans en être un.
export const raisonDEcarter = (bar, exclus, forces = new Set()) => {
  if (bar.isDemo === true) return 'bar de démonstration';
  if (bar.isActive === false) return 'bar inactif';
  if (!forces.has(String(bar.id)) && [bar.name, bar.address, bar.id].some((texte) => MOTS_D_ESSAI.test(pourComparer(texte)))) return RAISON_D_ESSAI;
  if (exclus.has(String(bar.id))) return 'liste d’exclusion';
  return null;
};

const atoutsDe = (features) => {
  if (!features || typeof features !== 'object') return {};
  return Object.fromEntries(ATOUTS.filter((cle) => features[cle] !== undefined && features[cle] !== null).map((cle) => [cle, features[cle]]));
};

// ---------- Tout ensemble ----------

// { matches, bars, matchNights } → les données des pages. contenu : clubs, competitions, villes, exclus (la liste
// d’exclusion, adresses de page ou identifiants), forcer (les identifiants des bars réintégrés à la main).
export const preparer = (brut, { maintenant, clubs, competitions, villes, exclus = [], forcer = [] }) => {
  const avertissements = [];
  const index = indexerLesClubs(clubs);
  const listeExclus = new Set(exclus.map(String));
  const forces = new Set(forcer.map(String));

  // Les matchs : ceux de la liste, et ceux qu’une soirée cite sans qu’ils y soient.
  const parId = new Map();
  for (const brutMatch of [...brut.matches, ...brut.matchNights.map((n) => n.match).filter(Boolean)]) {
    if (parId.has(String(brutMatch.id))) continue;
    const match = lireUnMatch(brutMatch, index, competitions);
    if (match) parId.set(match.id, match);
  }
  const matchs = reunirLesDoublons([...parId.values()]);
  nommerLesMatchs(matchs);
  const matchDeLId = new Map(matchs.flatMap((match) => match.ids.map((id) => [id, match])));

  // Les vrais bars, chacun avec sa ville, son arrondissement et son adresse de page.
  const bars = [];
  const ecartes = [];
  for (const brutBar of [...brut.bars].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const adresse = lireLAdresse(brutBar.address);
    const ville = adresse && villeDe(villes, adresse.codePostal, adresse.ville);
    const arrondissement = adresse && arrondissementDe(ville.cle, ville.nom, adresse.codePostal);
    const slugPage = adresse && `${slug(brutBar.name)}-${arrondissement ? arrondissement.ancre : ville.cle}`;
    const raison = raisonDEcarter(brutBar, listeExclus, forces) ?? (slugPage && listeExclus.has(slugPage) ? 'liste d’exclusion' : null)
      ?? (adresse ? null : 'adresse sans code postal ni ville');
    if (raison) {
      ecartes.push({ id: String(brutBar.id), nom: brutBar.name, raison, slug: slugPage ?? null });
      if (raison.startsWith('adresse')) avertissements.push(`Bar « ${brutBar.name} » écarté : ${raison}`);
      continue;
    }
    bars.push({
      id: String(brutBar.id),
      nom: String(brutBar.name).trim(),
      adresse: `${adresse.rue}, ${adresse.codePostal} ${adresse.ville}`,
      rue: adresse.rue,
      codePostal: adresse.codePostal,
      villeEcrite: adresse.ville,
      ville,
      arrondissement,
      quartier: arrondissement?.libelle ?? ville.nom,
      lat: typeof brutBar.lat === 'number' ? brutBar.lat : null,
      lng: typeof brutBar.lng === 'number' ? brutBar.lng : null,
      atouts: atoutsDe(brutBar.features),
      slug: slugPage,
      soirees: [],
    });
  }
  // Deux bars à la même adresse de page : le second prend « -2 », dans l’ordre de leurs identifiants.
  const slugsPris = new Map();
  for (const bar of bars) {
    const rang = (slugsPris.get(bar.slug) ?? 0) + 1;
    slugsPris.set(bar.slug, rang);
    if (rang > 1) bar.slug = `${bar.slug}-${rang}`;
  }
  const barDeLId = new Map(bars.map((bar) => [bar.id, bar]));

  // Les soirées annoncées par un vrai bar, chacune avec son match (réuni) et son offre telle que le bar l’a écrite.
  const soirees = [];
  for (const brutSoiree of brut.matchNights) {
    if (!SOIREES_ANNONCEES.has(brutSoiree.status)) continue;
    const bar = barDeLId.get(String(brutSoiree.bar?.id ?? brutSoiree.barId ?? ''));
    const match = matchDeLId.get(String(brutSoiree.match?.id ?? brutSoiree.matchId ?? ''));
    if (!bar || !match) continue;
    if (bar.soirees.some((s) => s.match === match)) continue; // la même soirée sous les deux identifiants d’un doublon
    const soiree = { id: String(brutSoiree.id), match, bar, offre: offreDe(brutSoiree.offer, maintenant, bar, avertissements) };
    soirees.push(soiree);
    bar.soirees.push(soiree);
  }
  for (const match of matchs) match.soirees = soirees.filter((s) => s.match === match);
  const parDebut = (a, b) => a.match.debut - b.match.debut || a.bar.nom.localeCompare(b.bar.nom, 'fr');
  for (const bar of bars) bar.soirees.sort(parDebut);
  for (const match of matchs) match.soirees.sort((a, b) => a.bar.nom.localeCompare(b.bar.nom, 'fr'));

  return { maintenant, matchs, bars, soirees, ecartes, avertissements };
};

// L’offre d’une soirée, telle que le bar l’a écrite : son titre, son prix s’il est donné, et la mention santé sauf si
// le bar a dit qu’elle ne contient pas d’alcool. Une offre finie, ou qui dit un mot interdit, ne s’affiche pas.
const offreDe = (offre, maintenant, bar, avertissements) => {
  if (!offre || typeof offre.title !== 'string' || !offre.title.trim()) return null;
  if (offre.until && Date.parse(offre.until) <= maintenant) return null;
  if (MOTS_INTERDITS.test(offre.title)) {
    avertissements.push(`Offre de « ${bar.nom} » non affichée : elle contient un mot que le site ne publie pas`);
    return null;
  }
  return {
    titre: offre.title.trim(),
    prixCentimes: Number.isInteger(offre.priceCents) ? offre.priceCents : null,
    alcool: offre.hasAlcohol !== false,
  };
};
