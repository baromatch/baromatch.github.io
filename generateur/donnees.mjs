// Des trois listes brutes (sources.mjs) aux données des pages : les vrais bars seulement, un match par match (les
// doublons réunis), les noms courts des clubs, l’heure de Paris, la ville et l’arrondissement de chaque bar. Rien
// n’est inventé : un renseignement absent des données reste absent des pages.
import { nettoyer, pourComparer, slug } from './texte.mjs';
import { jourDeParis } from './heure.mjs';
import { motDAlcool } from './alcool.mjs';

export const HEURE_MS = 3_600_000;
export const JOUR_MS = 24 * HEURE_MS;
// Un match se joue en deux heures environ (mi-temps comprise), trois avec les prolongations et les tirs au but :
// jusque-là, il est en cours, pas passé.
export const DUREE_MATCH_MS = 3 * HEURE_MS;
// Un match reporté ou annulé le dit (« POSTPONED », « CANCELLED » dans les données).
const STATUTS = { POSTPONED: 'reporte', CANCELLED: 'annule' };
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
// Une offre de bar qui pousse à boire (loi Evin) ne s’affiche pas : la gratuité ou la remise près d’une boisson, une
// quantité ou une récompense. Comparée sans accents ni capitales.
const BOISSON = /\b(?:bieres?|pintes?|demis?|verres?|shots?|shooters?|cocktails?|vins?|champagnes?|alcools?|boissons?|consos?|consommations?|aperos?|aperitifs?|spritz|mojitos?|pastis|ricard|whisky|vodka|rhum|tequila|gin|cidres?|pressions?|bouteilles?|seaux?|pichets?|mousses?|binouzes?|kirs?|punch)\b/;
const GRATUIT = /\b(?:offert|gratuit|cadeau)|\boffr(?:ons|ez)\b|\b(?:t|vous)['’\s]+offr/;
// Une remise : un pourcentage, des euros en moins, moitié prix, un tarif réduit, une réduction, une promo…
const REMISE = /-?\s*\d+(?:[.,]\d+)?\s*(?:%|pour\s*cent\b)|(?:^|[\s(])-\s*\d+(?:[.,]\d+)?\s*(?:€|euros?\b)|\bmoitie prix\b|\ba moitie\b|\bdemi[\s-]*tarif\b|\breduite?s?\b|\breductions?\b|\bremises?\b|\brabais\b|\bpromos?\b|\bpromotions?\b|\bau lieu de\b|\bhalf[\s-]*price\b/;
const POUSSE_A_BOIRE = [
  /\ba volonte\b/, /\ba gogo\b/, /\billimitee?s?\b/, /\bopen[\s-]*bars?\b/, /\b(?:\d+|deux|trois|quatre)\s*(?:pour|=)\s*(?:\d+|une?|deux|trois)\b/,
  /\bpour le prix d['’\s]*une?\b/, /\bachete\w*\s*,?\s*(?:\d+|une?|deux)\s+offert/, /\bhappy[\s-]*hours?\b/, /\btournees?\b/,
  /\b(?:a|pour) chaque but/, /\bpar but\b/,
];
// Ce qui pousse à boire (loi Evin), sans accents ni capitales, ou null.
const pousseABoire = (texte) => {
  const motif = POUSSE_A_BOIRE.find((m) => m.test(texte));
  if (motif) return texte.match(motif)[0];
  const offre = texte.match(GRATUIT) ?? texte.match(REMISE);
  if (offre && BOISSON.test(texte)) return `${offre[0].trim()} … ${texte.match(BOISSON)[0]}`;
  return null;
};
// Ce qu’une offre dit et que le site n’écrit pas, avec la raison : ce qui pousse à boire ; une remise ou une gratuité,
// même sans boisson nommée (le site ne sait pas sur quoi elle porte) ; le score. Ou null.
const ceQueLOffreDit = (titre) => {
  const texte = pourComparer(nettoyer(titre));
  const pousse = pousseABoire(texte);
  if (pousse) return { extrait: pousse, raison: 'elle pousse à boire' };
  const offre = texte.match(GRATUIT) ?? texte.match(REMISE);
  if (offre) return { extrait: offre[0].trim(), raison: 'elle parle d’une remise ou d’une gratuité' };
  const score = texte.match(/\bscores?\b/);
  return score ? { extrait: score[0], raison: 'elle parle du score' } : null;
};
// Pourquoi une offre ne s’affiche pas (ce qu’elle dit), ou null si elle peut s’afficher.
export const offreInterdite = (titre) => ceQueLOffreDit(titre)?.extrait ?? null;
// Pourquoi le nom d’un bar l’écarte du site (« Happy Hour Café », « L’Open Bar »), ou null.
export const nomInterdit = (nom) => pousseABoire(pourComparer(nettoyer(nom)));

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
    statut: STATUTS[brut.status] ?? null,
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
// Lu aussi : « 75011, Paris », « Paris 75011 » (après une virgule), « , FR » ou « , France » à la fin, « PARIS » en
// capitales (« Paris »), et « Paris 11e » (la ville, sans l’arrondissement, lu dans le code postal).
const enCapitales = (ville) => (ville.length > 2 && ville === ville.toUpperCase()
  ? ville.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, avant, lettre) => `${avant}${lettre.toUpperCase()}`)
  : ville);
export const lireLAdresse = (adresse) => {
  const propre = nettoyer(adresse).replace(/[,\s]+(?:France|FRA?)\.?$/i, '').trim();
  const codeEtVille = propre.match(/^(.*?)[,\s]+(\d{5})[,\s]+([^\d,][^,]*?)\s*$/);
  const villeEtCode = codeEtVille ? null : propre.match(/^(.*?)\s*,\s*([^\d,][^,]*?)\s+(\d{5})\s*$/);
  if (!codeEtVille && !villeEtCode) return null;
  const [rue, codePostal, ville] = codeEtVille ? codeEtVille.slice(1) : [villeEtCode[1], villeEtCode[3], villeEtCode[2]];
  const villePropre = enCapitales(ville.trim().replace(/\s+\d{1,2}\s*(?:er|e|ème|eme)$/i, ''));
  if (!rue.trim() || !villePropre) return null;
  return { rue: rue.trim().replace(/[,\s-]+$/, ''), codePostal, ville: villePropre };
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
// Un nom qui pousse à boire écarte le bar, même réintégré à la main.
export const raisonDEcarter = (bar, exclus, forces = new Set()) => {
  if (bar.isDemo === true) return 'bar de démonstration';
  if (bar.isActive === false) return 'bar inactif';
  if (!forces.has(String(bar.id)) && [bar.name, bar.address, bar.id].some((texte) => MOTS_D_ESSAI.test(pourComparer(nettoyer(texte))))) return RAISON_D_ESSAI;
  if (exclus.has(String(bar.id))) return 'liste d’exclusion';
  const interdit = nomInterdit(bar.name);
  if (interdit) return `un mot que le site ne publie pas dans le nom (« ${interdit} »)`;
  return null;
};
// Les raisons d’écarter un bar que le journal dit (un vrai bar, peut-être, que quelqu’un doit regarder) ; il ne dit
// que son identifiant, jamais son nom.
const RAISONS_DITES = /^(?:adresse|ville|nom|un mot|pas dans la liste)/;
export const RAISON_SANS_ACCORD = 'pas dans la liste des bars publiés (generateur/bars-publies.json) : il attend son accord écrit';

const atoutsDe = (features) => {
  if (!features || typeof features !== 'object') return {};
  return Object.fromEntries(ATOUTS.filter((cle) => features[cle] !== undefined && features[cle] !== null).map((cle) => [cle, features[cle]]));
};

// ---------- Tout ensemble ----------

// { matches, bars, matchNights } → les données des pages. contenu : clubs, competitions, villes, publies (les
// identifiants des bars qui ont accepté par écrit d’être publiés, bars-publies.json : un vrai bar absent de cette
// liste n’apparaît nulle part), exclus (la liste d’exclusion, par identifiant), forcer (les identifiants des bars
// réintégrés à la main), adresses (les adresses de page déjà données, { adresse: identifiant du bar }, gardées dans
// l’état).
export const preparer = (brut, { maintenant, clubs, competitions, villes, publies = [], exclus = [], forcer = [], adresses = {} }) => {
  const avertissements = [];
  const index = indexerLesClubs(clubs);
  const listeExclus = new Set(exclus.map(String));
  const listePublies = new Set(publies.map(String));
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

  // Les vrais bars, chacun avec sa ville, son arrondissement et son adresse de page. Une adresse de page est stable :
  // un bar connu (par son identifiant) garde celle de l’état, même s’il change de nom ; une adresse donnée n’est jamais
  // redonnée à un autre bar tant que sa page existe (le second prend « -2 », « -3 »… dans l’ordre des identifiants).
  // Le nom, l’adresse et l’offre sont nettoyés de leurs caractères invisibles avant tout usage.
  const prises = new Map(Object.entries(adresses).map(([adressePage, id]) => [adressePage, String(id)]));
  const slugDeLId = new Map();
  for (const [adressePage, id] of prises) if (!slugDeLId.has(id)) slugDeLId.set(id, adressePage);
  const libre = (base, id) => {
    for (let rang = 1; ; rang += 1) {
      const candidat = rang === 1 ? base : `${base}-${rang}`;
      if (!prises.has(candidat) || prises.get(candidat) === id) return candidat;
    }
  };
  const bars = [];
  const ecartes = [];
  for (const brutBar of [...brut.bars].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const id = String(brutBar.id);
    const nom = nettoyer(brutBar.name);
    const propre = { ...brutBar, name: nom, address: nettoyer(brutBar.address) };
    const adresse = lireLAdresse(propre.address);
    const ville = adresse && villeDe(villes, adresse.codePostal, adresse.ville);
    // Une ville dont le nom ne donne aucune adresse (« 97411 *** ») : aucune page ne peut la porter.
    const villeLisible = Boolean(ville?.cle);
    const arrondissement = villeLisible && arrondissementDe(ville.cle, ville.nom, adresse.codePostal);
    const slugPage = villeLisible && slug(nom) ? (slugDeLId.get(id) ?? libre(`${slug(nom)}-${arrondissement ? arrondissement.ancre : ville.cle}`, id)) : null;
    const raison = raisonDEcarter(propre, listeExclus, forces)
      ?? (adresse ? null : 'adresse sans code postal ni ville')
      ?? (villeLisible ? null : 'ville illisible dans l’adresse')
      ?? (slugPage ? null : 'nom illisible')
      ?? (listePublies.has(id) ? null : RAISON_SANS_ACCORD);
    // Un bar exclu garde son adresse le temps du passage : le suivant du même nom prend « -2 ».
    if (slugPage && (!raison || raison === 'liste d’exclusion')) prises.set(slugPage, id);
    if (raison) {
      ecartes.push({ id, nom, raison, slug: slugPage });
      if (RAISONS_DITES.test(raison)) avertissements.push(`Bar ${id} écarté : ${raison}`);
      continue;
    }
    bars.push({
      id,
      nom,
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
  // Les adresses données, à garder dans l’état public : celles des bars publiés à ce passage, et seulement elles. Celle
  // d’un bar qui n’est plus publié (retiré de la liste, exclu, écarté, disparu des données) porte son nom : elle en
  // sort tout de suite. Sa page « n’est plus sur Baromatch » la garde 30 jours (son entrée dans l’état, que lit
  // anciensDe), puis plus rien ne la nomme.
  const publiesIci = new Set(bars.map((bar) => bar.id));
  const adressesDonnees = Object.fromEntries([...prises].filter(([, id]) => publiesIci.has(id))
    .sort(([a], [b]) => a.localeCompare(b)));
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

  // recus : la taille des listes reçues, pour reconnaître une liste vide ou tronquée (construire.mjs).
  return { maintenant, matchs, bars, soirees, ecartes, avertissements, adresses: adressesDonnees, recus: { bars: brut.bars.length, soirees: brut.matchNights.length } };
};

// L’offre d’une soirée (loi Evin) : publiée telle que le bar l’a écrite (titre, prix, heure limite) seulement si le bar
// a dit qu’elle ne contient pas d’alcool (hasAlcohol vaut exactement false), que son texte ne nomme aucun alcool (la
// liste de l’appli, alcool.mjs : seul « sans alcool » y échappe, quoi que le bar ait coché) et qu’elle ne parle ni de ce
// qui pousse à boire, ni d’une remise ou d’une gratuité, ni du score. Sinon, à sa place, « Une offre du bar dans
// l’appli », sans titre ni prix ({ dansLAppli: true }) : rien d’alcoolisé n’est écrit, donc aucune mention santé n’est
// à mettre dessous. Une offre finie ne se montre pas. Une offre écartée pour ce qu’elle dit laisse un avertissement.
const offreDe = (offre, maintenant, bar, avertissements) => {
  if (!offre || typeof offre.title !== 'string') return null;
  const titre = nettoyer(offre.title);
  if (!titre) return null;
  const fin = offre.until ? Date.parse(offre.until) : Number.NaN;
  if (fin <= maintenant) return null;
  const dit = ceQueLOffreDit(titre);
  if (dit) avertissements.push(`Offre de « ${bar.nom} » non affichée : ${dit.raison} (« ${dit.extrait} »), ce que le site ne publie pas`);
  // Le texte tel qu’écrit (un retour à la ligne finit une boisson) et nettoyé (un caractère invisible ne coupe pas un mot).
  const alcool = motDAlcool(offre.title) ?? motDAlcool(titre);
  if (dit || alcool || offre.hasAlcohol !== false) return { dansLAppli: true };
  return {
    titre,
    prixCentimes: Number.isInteger(offre.priceCents) ? offre.priceCents : null,
    jusqua: Number.isNaN(fin) ? null : fin,
  };
};
