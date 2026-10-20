// « Ton club dans ton agenda » : un agenda par club de Ligue 1 (agenda/<club>.ics), auquel on s’abonne, et un fichier
// par match à venir (matchs/<match>/match.ics), à ajouter seul, derrière « Ajouter à mon agenda » sur sa page ; la page
// agenda/ explique comment faire, téléphone par téléphone.
// Un club de Ligue 1 : un club d’un match de Ligue 1 des listes publiques (passé ou à venir). Son agenda a tous ses
// matchs pas encore finis, toutes compétitions des listes comprises (la Ligue 1, ses coupes d’Europe). Un club sans
// match à venir garde un agenda valide et vide : un abonné ne tombe jamais sur une adresse morte. Un club qui sort des
// listes garde le sien 30 jours, vide et qui le dit, puis il disparaît.
// Un évènement par match, le même partout (agenda de chaque club, fichier du match) : son identifiant (UID) vient de
// l’identifiant du match dans les listes, jamais de l’adresse datée de sa page, et l’état le garde (un match déplacé
// garde son évènement). Ses heures sont des instants en UTC (ical.mjs) ; une heure provisoire donne un évènement sur la
// journée, « heure à confirmer ». Le match dure deux heures dans l’agenda. Un match passé s’efface. Un match reporté ou
// annulé (dans les listes), ou qui en disparaît avant d’être joué, reste sept jours, annulé (STATUS:CANCELLED) et dit
// pourquoi, puis s’efface, une fois pour toutes (l’état s’en souvient tant qu’il reste listé avec son statut). Aucun lieu (le match se joue au stade, pas au bar), aucune offre ; le texte ne parle de bars
// que quand de vrais bars publiés diffusent le match, avec leur vrai nombre.
// Les fichiers sont les mêmes octet pour octet tant que rien ne change : chaque évènement garde dans l’état l’empreinte
// de son contenu, son numéro de version (SEQUENCE, qui monte à chaque vrai changement) et l’instant de ce changement
// (DTSTAMP). La page agenda/ reste en noindex tant qu’aucun match de ces agendas n’a de vrai bar.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOSSIER_GENERATEUR } from './contenu.mjs';
import { DUREE_MATCH_MS, HEURE_MS, JOUR_MS } from './donnees.mjs';
import { empreinte } from './etat.mjs';
import { appel, fil, insecables, page } from './gabarits.mjs';
import { heureDeParis, jourDeParis, jourEnLettres } from './heure.mjs';
import { echapperTexte, ecrireLeFichier, instantUtc, jourIcal, lendemain } from './ical.mjs';
import { adresseDe, cheminDuMatch, filDAriane, pageWeb } from './jsonld.mjs';
import { accorder, echapper as e, enumerer, nettoyer } from './texte.mjs';

export const TEXTES = JSON.parse(readFileSync(path.join(DOSSIER_GENERATEUR, 'contenu', 'agenda.json'), 'utf8'));
export const CHEMIN_AGENDA = '/agenda/';
export const LIGUE_1 = 'Ligue 1';
// Un match dure deux heures dans l’agenda : 90 minutes, la mi-temps et le temps additionnel.
export const DUREE_DANS_L_AGENDA_MS = 2 * HEURE_MS;
// Un match reporté ou annulé reste sept jours dans l’agenda, annulé, puis s’efface.
export const GARDE_ANNULE_MS = 7 * JOUR_MS;
// L’agenda d’un club qui sort des listes reste 30 jours, vide, puis disparaît.
export const GARDE_CLUB_MS = 30 * JOUR_MS;
const PRODID = '-//Baromatch//Ton club dans ton agenda//FR';
const DOMAINE = 'baromatch.fr';
// Les coupes d’Europe, dites ensemble sur la page ; l’ordre des compétitions, Ligue 1 d’abord.
const COUPES_D_EUROPE = new Set(['Ligue des champions', 'Ligue Europa', 'Ligue Conférence']);
const ORDRE = ['Ligue 1', 'Coupe de France', 'Trophée des champions', 'Ligue des champions', 'Ligue Europa', 'Ligue Conférence'];
const AMICAL = /amica|friendl/i;

const remplir = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
const nomDuMatch = (m) => `${m.domicile.court} – ${m.exterieur.court}`;
const rangDe = (competition) => (ORDRE.includes(competition) ? ORDRE.indexOf(competition) : ORDRE.length);
const trierLesCompetitions = (competitions) => [...new Set(competitions)].sort((a, b) => rangDe(a) - rangDe(b) || a.localeCompare(b, 'fr'));

export const cheminDuCalendrier = (cle) => `${CHEMIN_AGENDA}${cle}.ics`;
export const cheminDuFichierDuMatch = (match) => `${cheminDuMatch(match)}match.ics`;
export const ancreDuClub = (cle) => `club-${cle}`;
// « webcal://baromatch.fr/agenda/psg.ics » : le lien qui ouvre l’abonnement dans Calendrier (iPhone, Mac).
export const webcalDe = (cle) => `${adresseDe(cheminDuCalendrier(cle)).replace(/^https:/, 'webcal:')}`;

// Les clubs de Ligue 1 des listes (les matchs passés comptent : un club sans match à venir garde son agenda), triés par
// leur nom court.
export const clubsDeLigue1 = (matchs) => {
  const clubs = new Map();
  for (const m of matchs) {
    if (m.competition !== LIGUE_1) continue;
    for (const club of [m.domicile, m.exterieur]) {
      if (!club.sansAdresse && !clubs.has(club.cle)) clubs.set(club.cle, { cle: club.cle, court: club.court, nom: club.nom });
    }
  }
  return [...clubs.values()].sort((a, b) => a.court.localeCompare(b.court, 'fr') || a.cle.localeCompare(b.cle));
};

const joue = (m, cle) => m.domicile.cle === cle || m.exterieur.cle === cle;
const pasFini = (m, maintenant) => m.debut + DUREE_MATCH_MS > maintenant;
// Un match à ajouter seul à son agenda : ni reporté, ni annulé, pas encore commencé. Sa page a alors le bouton
// « Ajouter à mon agenda », et son fichier est écrit à côté d’elle.
export const aSonFichier = (match, maintenant) => !match.statut && match.debut > maintenant;

// Ce que disent les agendas : les clubs, leurs matchs à venir (ni reportés ni annulés), les compétitions, le dernier jour
// au programme, ce qui manque aux listes (la Coupe de France, les matchs amicaux), et si un de ces matchs a un vrai bar.
export const resumerLesAgendas = (donnees) => {
  const { maintenant } = donnees;
  const clubs = clubsDeLigue1(donnees.matchs);
  const aVenir = donnees.matchs.filter((m) => !m.statut && pasFini(m, maintenant));
  const parClub = new Map(clubs.map((c) => [c.cle, aVenir.filter((m) => joue(m, c.cle))]));
  const suivis = aVenir.filter((m) => clubs.some((c) => joue(m, c.cle)));
  const toutes = donnees.matchs.map((m) => m.competition);
  const coupe = toutes.includes('Coupe de France');
  const amical = toutes.some((c) => AMICAL.test(c));
  return {
    clubs,
    parClub,
    competitions: trierLesCompetitions(suivis.map((m) => m.competition)),
    horizon: suivis.length ? Math.max(...suivis.map((m) => m.debut)) : null,
    manque: coupe && amical ? null : coupe ? 'amical' : amical ? 'coupe' : 'tout',
    avecBars: suivis.some((m) => m.soirees.length > 0),
  };
};

// ---------- Sur la page d’un match ----------

// Sous le jour et l’heure du match : « Ajouter à mon agenda » (son fichier, quand il en a un), et l’agenda de chacun de
// ses clubs de Ligue 1 (sinon, la page agenda/). Des liens, rien qui dépende de JavaScript.
export const blocDuMatch = (match, { clubsSuivis, fichier }) => {
  const t = TEXTES.match;
  const clubs = [match.domicile, match.exterieur].filter((c) => clubsSuivis.has(c.cle));
  const suite = clubs.length
    ? `<p class="regarder-agenda__clubs">${e(t.suis)} ${clubs.map((c) => `<a href="${CHEMIN_AGENDA}#${ancreDuClub(c.cle)}">${e(c.court)}</a>`).join(', ')}</p>`
    : `<p class="regarder-agenda__clubs"><a href="${CHEMIN_AGENDA}">${e(TEXTES.lien)}</a></p>`;
  return `<div class="regarder-agenda">
    ${fichier ? `<a class="regarder-agenda__bouton" href="${cheminDuFichierDuMatch(match)}" type="text/calendar">${e(t.ajouter)}</a>\n    ` : ''}${suite}
  </div>`;
};

// Le lien vers la page agenda/, seul sous un bloc (la page d’une ville).
export const lienVersLAgenda = () => `<p class="regarder-suite"><a href="${CHEMIN_AGENDA}">${e(TEXTES.lien)}</a></p>`;

// ---------- La page agenda/ ----------

const ligneDesCompetitions = (competitions) => (competitions.length > 1 && competitions[0] === LIGUE_1 && competitions.slice(1).every((c) => COUPES_D_EUROPE.has(c))
  ? TEXTES.page.coupesDEurope
  : enumerer(competitions));

export const fabriquerLaPageAgenda = ({ donnees, contenu, cadre, avecPresse = false }) => {
  const { marque, textes } = contenu;
  const t = TEXTES.page;
  const resume = resumerLesAgendas(donnees);
  const chemin = CHEMIN_AGENDA;
  const jour = resume.horizon ? jourEnLettres(resume.horizon) : null;
  const contenuDesAgendas = jour ? remplir(t.jusqua, { competitions: ligneDesCompetitions(resume.competitions), jour }) : t.sansMatch;
  const carte = (club) => {
    const n = resume.parClub.get(club.cle).length;
    const aVenir = n ? remplir(n > 1 ? t.aVenirPluriel : t.aVenir, { n }) : t.aucunAVenir;
    const adresse = adresseDe(cheminDuCalendrier(club.cle));
    return `    <li class="regarder-carte" id="${ancreDuClub(club.cle)}">
      <h3 class="regarder-carte__nom">${e(club.court)}</h3>
      <p class="regarder-carte__lieu">${club.nom && club.nom !== club.court ? `${e(club.nom)} · ` : ''}${e(aVenir)}</p>
      <p class="regarder-agenda"><a class="regarder-agenda__bouton" href="${webcalDe(club.cle)}">${e(t.sAbonner)}<span class="visuellement-cache"> : ${e(club.court)}</span></a></p>
      <p class="regarder-agenda__adresse"><a href="${adresse}">${e(adresse)}</a></p>
    </li>`;
  };
  const dedans = [
    ...(resume.competitions.length ? [remplir(t.dedans, { competitions: enumerer(resume.competitions) })] : []),
    jour ? remplir(t.horizon, { jour }) : t.sansMatch,
    ...(resume.manque ? [t.manque[resume.manque]] : []),
    t.efface,
    t.heures,
  ];
  const etapes = [{ nom: textes.fil.accueil, chemin: '/' }, { nom: t.fil, chemin }];
  const p = {
    // Elle ne nomme aucun bar (barsNommes vide, gardé dans l’état comme pour toute page).
    type: 'agenda', cle: 'agenda', date: null, chemin, indexable: resume.avecBars, titre: t.titre, description: t.description, barsNommes: [],
    jsonld: [pageWeb({ chemin, titre: t.titre, description: t.description }), filDAriane(etapes)],
    corps: `${fil(etapes)}
<header class="regarder-tete">
  <h1 class="regarder-titre">${e(t.titrePage)}</h1>
  <p class="regarder-chapeau">${e(t.chapeau)}</p>
  <p class="regarder-chapeau">${e(t.suit)}</p>
  <p class="regarder-chapeau">${e(contenuDesAgendas)}</p>
</header>
<section class="regarder-section" aria-labelledby="titre-clubs">
  <h2 id="titre-clubs">${e(t.titreClubs)}</h2>
${resume.clubs.length ? `  <p>${e(t.mode)}</p>
  <ul class="regarder-cartes">
${resume.clubs.map(carte).join('\n')}
  </ul>` : `  <p>${e(t.sansClub)}</p>`}
</section>
<section class="regarder-section" aria-labelledby="titre-telephone">
  <h2 id="titre-telephone">${e(t.titreTelephone)}</h2>
  <ul class="regarder-etapes">
${t.telephones.map((tel) => `    <li><strong>${e(tel.titre)}</strong> ${e(tel.texte)}</li>`).join('\n')}
  </ul>
</section>
<section class="regarder-section" aria-labelledby="titre-dedans">
  <h2 id="titre-dedans">${e(t.titreDedans)}</h2>
${dedans.map((ligne) => `  <p>${e(ligne)}</p>`).join('\n')}
</section>
<p class="regarder-retour"><a href="/matchs/">${e(t.retour)}</a></p>
${appel(marque, textes)}`,
  };
  return { ...p, contenu: page({ cadre, marque, avecPresse, ...p }) };
};

// ---------- Les évènements ----------

// L’identifiant d’un match, tel quel s’il est simple, sinon son empreinte : la partie gauche de l’UID.
const partieDeLUid = (id) => (/^[A-Za-z0-9._-]{1,100}$/.test(id) ? id : `m-${empreinte(id)}`);

// « 2 bars le diffusent à Paris sur Baromatch », « 3 bars le diffusent sur Baromatch : 2 à Paris, 1 à Lyon ».
const phraseDesBars = (soirees) => {
  const t = TEXTES.fichier;
  const villes = new Map();
  for (const s of soirees) villes.set(s.bar.ville.nom, (villes.get(s.bar.ville.nom) ?? 0) + 1);
  const liste = [...villes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  const bars = accorder(soirees.length, 'bar');
  if (liste.length === 1) return remplir(t.barsUneVille, { bars, diffuse: soirees.length > 1 ? 'diffusent' : 'diffuse', ville: liste[0][0] });
  return remplir(t.barsPlusieursVilles, { bars, villes: liste.map(([ville, n]) => `${n} à ${ville}`).join(', ') });
};

// Les lignes d’un évènement, sans DTSTAMP ni SEQUENCE (avecSaVersion les ajoute) : statut null, « reporte », « annule »
// ou « retire » (le match n’est plus dans les listes) ; chemin : sa page, si elle existe ; soirees : ses vrais bars.
const lignesDeLEvenement = ({ uid, match, statut, chemin, soirees }) => {
  const t = TEXTES.fichier;
  const texte = (valeur) => echapperTexte(insecables(nettoyer(valeur)));
  const nom = nomDuMatch(match);
  const resume = statut ? remplir(t.statuts[statut], { match: nom }) : match.heureConfirmee ? nom : remplir(t.heureAConfirmer, { match: nom });
  const jour = jourDeParis(match.debut);
  const quand = match.heureConfirmee
    ? [`DTSTART:${instantUtc(match.debut)}`, `DTEND:${instantUtc(match.debut + DUREE_DANS_L_AGENDA_MS)}`]
    : [`DTSTART;VALUE=DATE:${jourIcal(jour)}`, `DTEND;VALUE=DATE:${jourIcal(lendemain(jour))}`];
  const adresse = chemin ? adresseDe(chemin) : null;
  const bars = !statut && soirees.length ? phraseDesBars(soirees) : null;
  const lien = adresse ? (bars ? `${bars} : ${adresse}` : remplir(t.pageDuMatch, { adresse })) : bars && `${bars}.`;
  const description = [
    `${match.competition} · ${match.domicile.nom} – ${match.exterieur.nom}`,
    match.heureConfirmee
      ? remplir(t.coupDEnvoi, { jour: jourEnLettres(match.debut), heure: heureDeParis(match.debut) })
      : remplir(t.jourSansHeure, { jour: jourEnLettres(match.debut) }),
    statut ? t.statutsSuite[statut] : null,
    lien,
  ].filter(Boolean).map((ligne) => insecables(nettoyer(ligne)));
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    ...quand,
    `SUMMARY:${texte(resume)}`,
    `DESCRIPTION:${echapperTexte(description.join('\n'))}`,
    ...(adresse ? [`URL:${adresse}`] : []),
    `STATUS:${statut ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
};

// L’instant d’un passage, à la seconde, comme l’état le garde : « 2026-10-15T19:44:29Z ».
const aLaSeconde = (instant) => new Date(Math.floor(instant / 1000) * 1000).toISOString().replace(/\.000Z$/, 'Z');

// Un évènement et sa version : inchangé (la même empreinte), il garde son numéro (SEQUENCE) et l’instant de son dernier
// changement (DTSTAMP) ; changé, son numéro monte et l’instant est celui du passage.
const avecSaVersion = (lignes, avant, maintenant) => {
  const marque = empreinte(lignes.join('\n'));
  const meme = avant?.empreinte === marque && Number.isInteger(avant.sequence) && typeof avant.modifie === 'string';
  const sequence = meme ? avant.sequence : Number.isInteger(avant?.sequence) ? avant.sequence + 1 : 0;
  const modifie = meme ? avant.modifie : aLaSeconde(maintenant);
  return {
    lignes: [...lignes.slice(0, 2), `DTSTAMP:${instantUtc(Date.parse(modifie))}`, `SEQUENCE:${sequence}`, ...lignes.slice(2)],
    version: { empreinte: marque, sequence, modifie },
  };
};

const enTete = ({ nom, description } = {}) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:${PRODID}`,
  'CALSCALE:GREGORIAN',
  ...(nom ? [
    `X-WR-CALNAME:${echapperTexte(insecables(nom))}`,
    `X-WR-CALDESC:${echapperTexte(insecables(description))}`,
    'X-PUBLISHED-TTL:PT6H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ] : []),
];

// Les fichiers d’agenda d’un passage, et la mémoire de leurs évènements (pour l’état).
// pages : les pages du passage (celles qui existent, et la page de chaque match qui a son fichier : evenement) ;
// precedent : l’état du passage précédent (la mémoire des évènements, les agendas des clubs).
export const fabriquerLesAgendas = ({ donnees, pages, precedent = { pages: {} }, maintenant = donnees.maintenant }) => {
  const t = TEXTES.fichier;
  const resume = resumerLesAgendas(donnees);
  const avecPage = new Set(pages.map((p) => p.chemin));
  const cheminSiPage = (slug) => (avecPage.has(`/matchs/${slug}/`) ? `/matchs/${slug}/` : null);
  const memoire = precedent.evenements ?? {};

  // Les agendas : ceux des clubs de Ligue 1, et ceux des clubs sortis des listes depuis moins de 30 jours.
  const clubs = resume.clubs.map((c) => ({ ...c, parti: null }));
  const actuels = new Set(clubs.map((c) => c.cle));
  for (const [chemin, entree] of Object.entries(precedent.pages ?? {})) {
    if (entree?.type !== 'calendrier' || !entree.memoire?.court || actuels.has(entree.cle) || chemin !== cheminDuCalendrier(entree.cle)) continue;
    const parti = entree.memoire.parti ?? aLaSeconde(maintenant);
    if (Date.parse(parti) + GARDE_CLUB_MS > maintenant) clubs.push({ cle: entree.cle, court: entree.memoire.court, nom: entree.memoire.nom ?? entree.memoire.court, parti });
  }
  const cles = new Set(clubs.map((c) => c.cle));

  // Les évènements à écrire : chaque match pas fini d’un de ces clubs, et chaque match qui a son fichier ; un match
  // reporté ou annulé, sept jours ; un match sorti des listes avant d’être joué, sept jours aussi.
  const uidParId = new Map();
  for (const [uid, ev] of Object.entries(memoire)) for (const id of ev?.ids ?? []) if (!uidParId.has(String(id))) uidParId.set(String(id), uid);
  const pris = new Set();
  const choisirLUid = (ids) => {
    const connu = ids.map((id) => uidParId.get(id)).find((uid) => uid && !pris.has(uid));
    let uid = connu ?? `${partieDeLUid([...ids].sort()[0])}@${DOMAINE}`;
    for (let rang = 2; pris.has(uid); rang += 1) uid = `${partieDeLUid([...ids].sort()[0])}-${rang}@${DOMAINE}`;
    pris.add(uid);
    return uid;
  };
  const avecFichier = new Map(pages.filter((p) => p.evenement).map((p) => [p.evenement.slug, p.evenement]));
  const evenements = [];
  // Les évènements effacés des agendas, mais pas oubliés : un match reporté ou annulé encore dans les listes, avec son
  // statut, après ses sept jours. L’état garde son UID, ses identifiants, l’instant où il a été annoncé reporté ou
  // annulé et sa version (efface : rien n’est écrit pour lui) ; sans cela, il reviendrait sept jours de plus au passage
  // suivant, comme s’il venait d’être annoncé. Il s’oublie quand il sort des listes.
  const effaces = {};
  const idsVus = new Set(donnees.matchs.flatMap((m) => m.ids));
  for (const match of [...donnees.matchs].sort((a, b) => a.debut - b.debut || a.slug.localeCompare(b.slug))) {
    const dansUnAgenda = cles.has(match.domicile.cle) || cles.has(match.exterieur.cle);
    if (!dansUnAgenda && !avecFichier.has(match.slug)) continue;
    const uidAvant = match.ids.map((id) => uidParId.get(id)).find((uid) => uid && memoire[uid]);
    const avant = uidAvant ? memoire[uidAvant] : undefined;
    let annuleLe = null;
    if (match.statut) {
      annuleLe = avant?.annuleLe ?? aLaSeconde(maintenant);
      if (Date.parse(annuleLe) + GARDE_ANNULE_MS <= maintenant || !pasFini(match, Date.parse(annuleLe))) {
        if (uidAvant) effaces[uidAvant] = { ids: match.ids, annuleLe, efface: true, ...(Number.isInteger(avant.sequence) ? { sequence: avant.sequence } : {}) };
        continue;
      }
    } else if (!pasFini(match, maintenant)) continue;
    evenements.push({ ids: match.ids, match, statut: match.statut, annuleLe, chemin: cheminSiPage(match.slug), soirees: match.soirees, clubs: [match.domicile.cle, match.exterieur.cle], fichier: avecFichier.has(match.slug) });
  }
  for (const [uid, ev] of Object.entries(memoire).sort(([a], [b]) => a.localeCompare(b))) {
    if (!ev?.ids?.length || ev.ids.some((id) => idsVus.has(String(id))) || !ev.domicile || !ev.exterieur) continue;
    const annuleLe = ev.annuleLe ?? aLaSeconde(maintenant);
    const debut = Date.parse(ev.debut);
    if (Number.isNaN(debut) || Date.parse(annuleLe) + GARDE_ANNULE_MS <= maintenant || debut + DUREE_MATCH_MS <= Date.parse(annuleLe)) continue;
    const match = { ids: ev.ids, slug: ev.slug, debut, heureConfirmee: ev.heureConfirmee !== false, competition: ev.competition, domicile: ev.domicile, exterieur: ev.exterieur };
    evenements.push({ uid, ids: ev.ids, match, statut: 'retire', annuleLe, chemin: ev.slug ? cheminSiPage(ev.slug) : null, soirees: [], clubs: [ev.domicile.cle, ev.exterieur.cle], fichier: false });
  }

  // Chaque évènement écrit une fois, avec sa version : le même dans chaque fichier qui le porte.
  const nouvelleMemoire = { ...effaces };
  for (const uid of Object.keys(effaces)) pris.add(uid);
  for (const ev of evenements) if (ev.uid) pris.add(ev.uid);
  for (const ev of evenements) {
    ev.uid ??= choisirLUid(ev.ids);
    const { lignes, version } = avecSaVersion(lignesDeLEvenement(ev), memoire[ev.uid], maintenant);
    ev.lignes = lignes;
    const { match } = ev;
    nouvelleMemoire[ev.uid] = {
      ids: ev.ids, ...(match.slug ? { slug: match.slug } : {}), debut: new Date(match.debut).toISOString(), heureConfirmee: match.heureConfirmee, competition: match.competition,
      domicile: { cle: match.domicile.cle, court: match.domicile.court, nom: match.domicile.nom },
      exterieur: { cle: match.exterieur.cle, court: match.exterieur.court, nom: match.exterieur.nom },
      ...version, ...(ev.annuleLe ? { annuleLe: ev.annuleLe } : {}),
    };
  }
  const parDebut = (a, b) => a.match.debut - b.match.debut || a.uid.localeCompare(b.uid);
  evenements.sort(parDebut);

  const fichiers = [];
  const jour = resume.horizon ? jourEnLettres(resume.horizon) : null;
  const adresseDeLaPage = adresseDe(CHEMIN_AGENDA);
  for (const club of clubs) {
    const siens = evenements.filter((ev) => ev.clubs.includes(club.cle));
    const competitions = trierLesCompetitions(siens.filter((ev) => !ev.statut).map((ev) => ev.match.competition));
    const phrases = club.parti
      ? [remplir(t.descriptionParti, { club: club.court })]
      : competitions.length
        ? [remplir(t.description, { club: club.court, competitions: enumerer(competitions), jour }), ...(resume.manque ? [TEXTES.page.manque[resume.manque]] : []), t.reporteOuAnnule]
        : [remplir(t.descriptionSansMatch, { club: club.court })];
    const contenu = ecrireLeFichier([
      ...enTete({ nom: remplir(t.nom, { club: club.court }), description: [...phrases, adresseDeLaPage].join(' ') }),
      ...siens.flatMap((ev) => ev.lignes),
      'END:VCALENDAR',
    ]);
    fichiers.push({
      chemin: cheminDuCalendrier(club.cle), type: 'calendrier', cle: club.cle, indexable: false, contenu,
      memoire: { court: club.court, nom: club.nom, ...(club.parti ? { parti: club.parti } : {}) },
    });
  }
  for (const ev of evenements.filter((x) => x.fichier)) {
    fichiers.push({
      chemin: cheminDuFichierDuMatch(ev.match), type: 'evenement', cle: ev.match.slug, indexable: false,
      contenu: ecrireLeFichier([...enTete(), ...ev.lignes, 'END:VCALENDAR']),
    });
  }
  const evenementsTries = Object.fromEntries(Object.entries(nouvelleMemoire).sort(([a], [b]) => a.localeCompare(b)));
  return { fichiers, evenements: evenementsTries };
};

