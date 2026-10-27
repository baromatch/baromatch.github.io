// « Ton club dans ton agenda », sans navigateur : chaque fichier d’agenda que le générateur écrit (agenda/<club>.ics,
// matchs/<match>/match.ics) passe un validateur iCalendar strict (tests/outils/icalendar.mjs) et se relit avec ical.js ;
// les heures de Paris au changement d’heure, un club sans match, un match passé, reporté ou sorti des listes, un club qui
// sort des listes, des fichiers identiques octet pour octet quand rien ne change, un UID stable quand un match change de
// jour ; aucun texte sur les bars sans vrai bar ; la page agenda/ en noindex tant qu’aucun vrai bar n’est publié, et
// indexable dès le premier, d’une semaine à l’autre (tests/generateur.spec.mjs) ; la liste blanche.
import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { erreursDuCalendrier, lireLeCalendrier } from './outils/icalendar.mjs';
import { CAPTURE, contenuDuScenario, MAINTENANT_DE_LA_CAPTURE, SCENARIO } from './outils/site-genere.mjs';
import { blocDuMatch } from '../generateur/agenda.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { ecrireUnFichier, estPermis } from '../generateur/etat.mjs';
import { TEXTES_SUIVRE, cheminDuClub } from '../generateur/suivre.mjs';
import { insecables } from '../generateur/texte.mjs';
import { echapperTexte, instantUtc, lendemain, plier } from '../generateur/ical.mjs';

const contenu = contenuDuScenario();
const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'agenda-'));
  dossiers.push(dossier);
  return dossier;
};
test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

// Un passage du générateur sur le scénario (ou une variante), sans les images de partage.
const passer = (sortie, maintenant, options = {}) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu, rendu: null, ...options });
const variante = (dossier, changer) => {
  const fichier = path.join(dossier, `scenario-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(fichier, JSON.stringify(changer(JSON.parse(readFileSync(SCENARIO, 'utf8')))));
  return `scenario:${fichier}`;
};
const octets = (dossier, relatif) => readFileSync(path.join(dossier, relatif));
const etatDe = (dossier) => JSON.parse(readFileSync(path.join(dossier, 'regarder-le-match', 'etat.json'), 'utf8'));
// Les fichiers d’agenda écrits : agenda/*.ics et matchs/*/match.ics.
const agendasDe = (dossier) => [
  ...(existsSync(path.join(dossier, 'agenda')) ? readdirSync(path.join(dossier, 'agenda')).filter((f) => f.endsWith('.ics')).map((f) => `agenda/${f}`) : []),
  ...readdirSync(path.join(dossier, 'matchs')).filter((d) => existsSync(path.join(dossier, 'matchs', d, 'match.ics'))).map((d) => `matchs/${d}/match.ics`),
].sort();
// Un fichier lu deux fois : par le validateur strict (aucune erreur), et par ical.js (les mêmes évènements).
const lireEtValider = (contenuDuFichier, nom = '') => {
  const lu = lireLeCalendrier(contenuDuFichier);
  expect(lu.erreurs, nom).toEqual([]);
  const composant = new ICAL.Component(ICAL.parse(contenuDuFichier.toString('utf8')));
  const evenements = composant.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v));
  expect(evenements.map((ev) => ev.uid), nom).toEqual(lu.evenements.map((ev) => ev.UID));
  expect(evenements.map((ev) => ev.summary), nom).toEqual(lu.evenements.map((ev) => ev.SUMMARY));
  return { ...lu, ical: evenements };
};
const evenementDe = (dossier, relatif, uid) => lireEtValider(octets(dossier, relatif), relatif).evenements.find((ev) => ev.UID === uid);
// Le bloc VEVENT d’un fichier, tel quel (CRLF et plis compris).
const blocDe = (texte, uid) => texte.split('BEGIN:VEVENT\r\n').find((bloc) => bloc.startsWith(`UID:${uid}\r\n`))?.split('END:VEVENT\r\n')[0];

// ---------- Le validateur et l’écriture ----------

test('le validateur strict : un iCalendar juste passe, chaque défaut est trouvé', () => {
  const BON = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Essai//FR', 'BEGIN:VEVENT', 'UID:a@essai', 'DTSTAMP:20261019T120000Z',
    'DTSTART:20261025T200000Z', 'DTEND:20261025T220000Z', 'SUMMARY:PSG – OL\\, au Parc', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n').concat('\r\n');
  expect(erreursDuCalendrier(BON)).toEqual([]);
  // Un fuseau décrit (VTIMEZONE) rend un TZID valable.
  const FUSEAU = ['BEGIN:VTIMEZONE', 'TZID:Europe/Paris', 'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'END:VTIMEZONE'].join('\r\n');
  const avecFuseau = BON.replace('BEGIN:VEVENT', `${FUSEAU}\r\nBEGIN:VEVENT`).replace('DTSTART:20261025T200000Z', 'DTSTART;TZID=Europe/Paris:20261025T210000')
    .replace('DTEND:20261025T220000Z', 'DTEND;TZID=Europe/Paris:20261025T230000');
  expect(erreursDuCalendrier(avecFuseau)).toEqual([]);

  // Un « é » coupé en deux par un pli : le fichier n’est plus de l’UTF-8 lisible.
  const long = `SUMMARY:${'é'.repeat(40)}`;
  const brut = Buffer.from(long, 'utf8');
  const coupe = Buffer.concat([Buffer.from(BON.split(`SUMMARY:PSG`)[0], 'utf8'), brut.subarray(0, 75), Buffer.from('\r\n ', 'utf8'), brut.subarray(75), Buffer.from(`\r\n${BON.split('SUMMARY:PSG – OL\\, au Parc\r\n')[1]}`, 'utf8')]);
  const defauts = [
    ['fins de ligne LF', BON.replace(/\r\n/g, '\n'), /LF seul/],
    ['une ligne de 80 octets', BON.replace('SUMMARY:PSG – OL\\, au Parc', `SUMMARY:${'x'.repeat(72)}`), /80 octets \(75 au plus\)/],
    ['un caractère coupé par le pli', coupe, /UTF-8 invalide|caractère coupé/],
    ['une virgule sans échappement', BON.replace('OL\\, au', 'OL, au'), /SUMMARY .* mal échappé/],
    ['un échappement inconnu', BON.replace('OL\\, au', 'OL\\t au'), /mal échappé/],
    ['sans UID', BON.replace('UID:a@essai\r\n', ''), /UID manque/],
    ['sans DTSTAMP', BON.replace('DTSTAMP:20261019T120000Z\r\n', ''), /DTSTAMP manque/],
    ['sans DTSTART', BON.replace('DTSTART:20261025T200000Z\r\n', ''), /DTSTART manque/],
    ['un DTSTAMP sans fuseau', BON.replace('DTSTAMP:20261019T120000Z', 'DTSTAMP:20261019T120000'), /DTSTAMP .* instant UTC/],
    ['un TZID sans VTIMEZONE', BON.replace('DTSTART:20261025T200000Z', 'DTSTART;TZID=Europe/Paris:20261025T210000'), /sans VTIMEZONE/],
    ['une fin avant le début', BON.replace('DTEND:20261025T220000Z', 'DTEND:20261025T190000Z'), /DTEND avant DTSTART/],
    ['un jour et un instant mêlés', BON.replace('DTEND:20261025T220000Z', 'DTEND;VALUE=DATE:20261026'), /sortes différentes/],
    ['une date impossible', BON.replace('DTSTART:20261025T200000Z', 'DTSTART:20260231T200000Z'), /DTSTART .* illisible/],
    ['sans VERSION', BON.replace('VERSION:2.0\r\n', ''), /VERSION 0 fois/],
    ['un BOM', `﻿${BON}`, /BOM/],
    ['deux fois le même UID', BON.replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:a@essai\r\nDTSTAMP:20261019T120000Z\r\nDTSTART:20261026T200000Z\r\nEND:VEVENT\r\nEND:VCALENDAR'), /en double/],
    ['un END sans son BEGIN', BON.replace('END:VEVENT', 'END:VTODO'), /sans son/],
    ['un STATUS inconnu', BON.replace('END:VEVENT', 'STATUS:REPORTE\r\nEND:VEVENT'), /STATUS/],
    ['deux SUMMARY', BON.replace('END:VEVENT', 'SUMMARY:Autre\r\nEND:VEVENT'), /SUMMARY plusieurs fois/],
    ['pas de fin de ligne à la fin', BON.replace(/\r\n$/, ''), /ne finit pas par CRLF/],
  ];
  for (const [nom, fichier, attendu] of defauts) {
    const erreurs = erreursDuCalendrier(fichier);
    expect(erreurs.join('\n'), nom).toMatch(attendu);
  }
});

test('l’écriture iCalendar : 75 octets par ligne sans couper un caractère, les textes échappés, les instants en UTC', () => {
  for (const texte of [`DESCRIPTION:${'é'.repeat(100)}`, `SUMMARY:${'𝄞'.repeat(40)}`, `X:${'a'.repeat(200)}`, `SUMMARY:${'Olympique de Marseille – Paris Saint-Germain · '.repeat(4)}`]) {
    const plie = plier(texte);
    const lignes = plie.split('\r\n');
    for (const ligne of lignes) expect(Buffer.byteLength(ligne, 'utf8'), ligne).toBeLessThanOrEqual(75);
    for (const ligne of lignes.slice(1)) expect(ligne.startsWith(' ')).toBe(true);
    // Chaque ligne se relit seule (aucun caractère coupé), et la ligne dépliée est la ligne d’origine.
    for (const ligne of lignes) expect(Buffer.from(ligne, 'utf8').toString('utf8')).toBe(ligne);
    expect(lignes.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(texte);
    expect(lignes.some((l) => l.includes('�'))).toBe(false);
  }
  expect(plier('SUMMARY:PSG – OL')).toBe('SUMMARY:PSG – OL');
  expect(echapperTexte('a,b;c\\d\ne\r\nf\tg\u0007')).toBe('a\\,b\\;c\\\\d\\ne\\nf g');
  expect(instantUtc(Date.parse('2026-10-25T19:45:00.000Z'))).toBe('20261025T194500Z');
  expect(lendemain('2026-10-25')).toBe('2026-10-26');
  expect(lendemain('2026-12-31')).toBe('2027-01-01');
  expect(lendemain('2028-02-28')).toBe('2028-02-29');
});

// ---------- Les agendas du dépôt ----------

test('chaque agenda du dépôt (agenda/*.ics, matchs/*/match.ics) est un iCalendar valide, en CRLF', () => {
  const fichiers = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.ics'], { cwd: racine, encoding: 'utf8' }).split('\0').filter(Boolean);
  expect(fichiers.filter((f) => f.startsWith('agenda/')).length).toBeGreaterThan(0);
  for (const fichier of fichiers) {
    expect(fichier, fichier).toMatch(/^(?:agenda\/[a-z0-9-]+\.ics|matchs\/[a-z0-9-]+\/match\.ics)$/);
    lireEtValider(readFileSync(path.join(racine, fichier)), fichier);
  }
});

// ---------- Les agendas du scénario ----------

test('chaque agenda du scénario est un iCalendar valide : un par club de Ligue 1, un par match à venir, le même évènement partout', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  const fichiers = agendasDe(sortie);
  // Les clubs de Ligue 1 seulement (pas le Barça), et chaque match à venir de la semaine, à côté de sa page.
  expect(fichiers.filter((f) => f.startsWith('agenda/'))).toEqual(['angers', 'auxerre', 'brest', 'le-havre', 'lens', 'lille', 'nice', 'ol', 'om', 'psg'].map((c) => `agenda/${c}.ics`));
  expect(fichiers.filter((f) => f.startsWith('matchs/'))).toEqual([
    'matchs/brest-nice-2026-10-23/match.ics', 'matchs/le-havre-auxerre-2026-10-25/match.ics', 'matchs/le-havre-psg-2026-10-30/match.ics', 'matchs/lille-lens-2026-10-26/match.ics',
    'matchs/ol-angers-2026-10-31/match.ics', 'matchs/om-nice-2026-10-28/match.ics', 'matchs/psg-barca-2026-10-24/match.ics', 'matchs/psg-ol-2026-10-25/match.ics',
  ]);
  for (const fichier of fichiers) lireEtValider(octets(sortie, fichier), fichier);

  // L’agenda du PSG : ses matchs pas encore finis, toutes compétitions, dans l’ordre ; deux heures chacun, en UTC.
  const psg = lireEtValider(octets(sortie, 'agenda/psg.ics'));
  expect(psg.calendrier['X-WR-CALNAME']).toBe('PSG · Baromatch');
  expect(psg.calendrier['X-WR-CALDESC']).toBe('PSG : les matchs au programme de Baromatch (Ligue 1 et Ligue des champions), à l’heure de Paris, pour l’instant jusqu’au vendredi 20 novembre. Pas de Coupe de France ni de match amical pour l’instant. Un match reporté ou annulé reste sept jours, marqué comme tel. https://baromatch.fr/agenda/');
  expect(psg.calendrier).toMatchObject({ VERSION: '2.0', PRODID: '-//Baromatch//Ton club dans ton agenda//FR', CALSCALE: 'GREGORIAN', 'X-PUBLISHED-TTL': 'PT6H', 'REFRESH-INTERVAL': 'PT6H' });
  expect(psg.evenements.map((ev) => [ev.UID, ev.SUMMARY, ev.DTSTART, ev.DTEND])).toEqual([
    ['m-psg-barca-en@baromatch.fr', 'PSG – Barça', '20261024T190000Z', '20261024T210000Z'],
    ['m-psg-ol@baromatch.fr', 'PSG – OL', '20261025T194500Z', '20261025T214500Z'],
    ['m-lehavre-psg@baromatch.fr', 'Le Havre – PSG', '20261030T180000Z', '20261030T200000Z'],
    ['m-loin@baromatch.fr', 'PSG – OM', '20261120T200000Z', '20261120T220000Z'],
  ]);
  for (const ev of psg.evenements) {
    expect(ev).toMatchObject({ STATUS: 'CONFIRMED', TRANSP: 'TRANSPARENT', SEQUENCE: '0', DTSTAMP: '20261023T080000Z' });
    // Aucun lieu : le match se joue au stade, pas au bar.
    expect(ev.LOCATION).toBeUndefined();
  }
  // Le texte : la compétition, les clubs, l’heure de Paris, les vrais bars et la page du match ; sans page (au-delà de
  // 14 jours), ni adresse ni lien.
  expect(psg.evenements[1].DESCRIPTION).toBe('Ligue 1 · Paris Saint-Germain – Olympique Lyonnais\nCoup d’envoi dimanche 25 octobre à 20:45, heure de Paris.\n2 bars le diffusent sur Baromatch (1 à Lyon, 1 à Paris) : https://baromatch.fr/matchs/psg-ol-2026-10-25/');
  expect(psg.evenements[1].URL).toBe('https://baromatch.fr/matchs/psg-ol-2026-10-25/');
  expect(psg.evenements[2].DESCRIPTION).toContain('1 bar le diffuse à Paris sur Baromatch : https://baromatch.fr/matchs/le-havre-psg-2026-10-30/');
  expect(psg.evenements[3].DESCRIPTION).toBe('Ligue 1 · Paris Saint-Germain – Olympique de Marseille\nCoup d’envoi vendredi 20 novembre à 21:00, heure de Paris.');
  expect(psg.evenements[3].URL).toBeUndefined();
  // ical.js lit les mêmes instants.
  expect(psg.ical.map((ev) => ev.startDate.toJSDate().toISOString())).toEqual(['2026-10-24T19:00:00.000Z', '2026-10-25T19:45:00.000Z', '2026-10-30T18:00:00.000Z', '2026-11-20T20:00:00.000Z']);

  // Le même évènement, octet pour octet, dans l’agenda des deux clubs et dans le fichier du match ; un fichier de match
  // n’a ni nom d’agenda ni description (il s’ajoute à l’agenda de chacun).
  const blocs = ['agenda/psg.ics', 'agenda/ol.ics', 'matchs/psg-ol-2026-10-25/match.ics'].map((f) => blocDe(octets(sortie, f).toString('utf8'), 'm-psg-ol@baromatch.fr'));
  expect(blocs[0]).toBeTruthy();
  expect(new Set(blocs).size).toBe(1);
  const seul = lireEtValider(octets(sortie, 'matchs/psg-ol-2026-10-25/match.ics'));
  expect(seul.evenements).toHaveLength(1);
  expect(seul.calendrier['X-WR-CALNAME']).toBeUndefined();
  expect(seul.calendrier.METHOD).toBeUndefined();

  // L’heure provisoire : un évènement sur la journée, « heure à confirmer ».
  const angers = evenementDe(sortie, 'agenda/angers.ics', 'm-ol-angers@baromatch.fr');
  expect(angers).toMatchObject({ SUMMARY: 'OL – Angers (heure à confirmer)', DTSTART: '20261031', DTEND: '20261101' });
  expect(angers.parametres.DTSTART).toEqual({ VALUE: 'DATE' });
  expect(angers.DESCRIPTION).toContain('Le samedi 31 octobre. Le coup d’envoi n’est pas encore fixé : l’heure peut changer.');
  // L’état garde la version de chaque évènement, pas son texte.
  expect(etatDe(sortie).evenements['m-psg-ol@baromatch.fr']).toMatchObject({ ids: ['m-psg-ol'], sequence: 0, modifie: '2026-10-23T08:00:00Z', slug: 'psg-ol-2026-10-25' });
  expect(etatDe(sortie).pages['/agenda/psg.ics']).toMatchObject({ type: 'calendrier', cle: 'psg', indexable: false, memoire: { court: 'PSG', nom: 'Paris Saint-Germain' } });
});

test('l’heure de Paris au changement d’heure (25 octobre 2026) : 21 h le samedi et le dimanche donnent les bons instants UTC', async () => {
  const sortie = dossierVide();
  const club = (slug, canonicalName) => ({ slug, canonicalName });
  const source = variante(sortie, (brut) => ({
    ...brut,
    matchNights: [],
    matches: [
      // 21 h à Paris le samedi 24 (heure d’été, UTC+2), 21 h le dimanche 25 (heure d’hiver, UTC+1).
      { id: 'm-avant', startAt: '2026-10-24T19:00:00.000Z', league: 'Ligue 1', homeTeam: 'Paris Saint-Germain', awayTeam: 'Olympique de Marseille', homeClub: club('paris-saint-germain', 'Paris Saint-Germain'), awayClub: club('olympique-de-marseille', 'Olympique de Marseille') },
      { id: 'm-apres', startAt: '2026-10-25T20:00:00.000Z', league: 'Ligue 1', homeTeam: 'Olympique Lyonnais', awayTeam: 'Paris Saint-Germain', homeClub: club('olympique-lyonnais', 'Olympique Lyonnais'), awayClub: club('paris-saint-germain', 'Paris Saint-Germain') },
      // Une heure provisoire posée à 0 h 30 le dimanche à Paris (22 h 30 UTC le samedi) : le jour est le dimanche.
      { id: 'm-nuit', startAt: '2026-10-24T22:30:00.000Z', league: 'Ligue 1', heureProvisoire: true, homeTeam: 'Paris Saint-Germain', awayTeam: 'RC Lens', homeClub: club('paris-saint-germain', 'Paris Saint-Germain'), awayClub: club('rc-lens', 'RC Lens') },
    ],
  }));
  await passer(sortie, '2026-10-20T08:00:00Z', { source });
  const psg = lireEtValider(octets(sortie, 'agenda/psg.ics'));
  const parUid = Object.fromEntries(psg.evenements.map((ev) => [ev.UID, ev]));
  expect(parUid['m-avant@baromatch.fr']).toMatchObject({ DTSTART: '20261024T190000Z', DTEND: '20261024T210000Z' });
  expect(parUid['m-avant@baromatch.fr'].DESCRIPTION).toContain('Coup d’envoi samedi 24 octobre à 21:00, heure de Paris.');
  expect(parUid['m-apres@baromatch.fr']).toMatchObject({ DTSTART: '20261025T200000Z', DTEND: '20261025T220000Z' });
  expect(parUid['m-apres@baromatch.fr'].DESCRIPTION).toContain('Coup d’envoi dimanche 25 octobre à 21:00, heure de Paris.');
  expect(parUid['m-nuit@baromatch.fr']).toMatchObject({ DTSTART: '20261025', DTEND: '20261026', SUMMARY: 'PSG – Lens (heure à confirmer)' });
  const ical = Object.fromEntries(psg.ical.map((ev) => [ev.uid, ev]));
  expect(ical['m-avant@baromatch.fr'].startDate.toJSDate().toISOString()).toBe('2026-10-24T19:00:00.000Z');
  expect(ical['m-apres@baromatch.fr'].startDate.toJSDate().toISOString()).toBe('2026-10-25T20:00:00.000Z');
  expect(ical['m-apres@baromatch.fr'].endDate.toJSDate().toISOString()).toBe('2026-10-25T22:00:00.000Z');
  expect(ical['m-nuit@baromatch.fr'].startDate.isDate).toBe(true);
  expect(ical['m-nuit@baromatch.fr'].startDate.toString()).toBe('2026-10-25');
  expect(ical['m-nuit@baromatch.fr'].endDate.toString()).toBe('2026-10-26');
  // Aucun fuseau à décrire : des instants UTC et des jours.
  expect(octets(sortie, 'agenda/psg.ics').toString('utf8')).not.toMatch(/TZID|VTIMEZONE/);
});

test('un match passé s’efface ; un club sans match à venir garde un agenda valide et vide', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  expect(lireEtValider(octets(sortie, 'agenda/brest.ics')).evenements.map((ev) => ev.SUMMARY)).toEqual(['Brest – Nice']);
  expect(existsSync(path.join(sortie, 'matchs/brest-nice-2026-10-23/match.ics'))).toBe(true);
  // Le lendemain : Brest – Nice est passé, Brest n’a plus de match au programme.
  await passer(sortie, '2026-10-24T08:00:00Z');
  const brest = lireEtValider(octets(sortie, 'agenda/brest.ics'));
  expect(brest.evenements).toEqual([]);
  expect(brest.calendrier['X-WR-CALDESC']).toBe('Brest : pas de match au programme de Baromatch pour l’instant. Les prochains arrivent ici dès qu’ils y sont. https://baromatch.fr/agenda/');
  expect(lireEtValider(octets(sortie, 'agenda/nice.ics')).evenements.map((ev) => ev.SUMMARY)).toEqual(['OM – Nice']);
  // Le fichier du match passé disparaît avec le bouton ; la page mène toujours à l’agenda de ses clubs.
  expect(existsSync(path.join(sortie, 'matchs/brest-nice-2026-10-23/match.ics'))).toBe(false);
  const page = octets(sortie, 'matchs/brest-nice-2026-10-23/index.html').toString('utf8');
  expect(page).not.toContain('Ajouter à mon agenda');
  expect(page).toContain('<a href="/agenda/#club-brest">Brest</a> <a href="/agenda/#club-nice">Nice</a>');
  const agenda = octets(sortie, 'agenda/index.html').toString('utf8');
  expect(agenda).toContain('<p class="regarder-carte__lieu">Stade Brestois 29 · Pas de match au programme pour l’instant</p>');
  expect(etatDe(sortie).evenements['m-ce-soir@baromatch.fr']).toBeUndefined();
});

test('un match reporté reste sept jours, annulé (STATUS:CANCELLED), « Reporté » dans son titre, puis s’efface', async () => {
  const sortie = dossierVide();
  const reporte = variante(sortie, (brut) => ({ ...brut, matches: brut.matches.map((m) => (m.id === 'm-lille-lens' ? { ...m, status: 'POSTPONED' } : m)) }));
  await passer(sortie, '2026-10-23T08:00:00Z', { source: reporte });
  for (const club of ['lille', 'lens']) {
    const ev = evenementDe(sortie, `agenda/${club}.ics`, 'm-lille-lens@baromatch.fr');
    expect(ev).toMatchObject({ STATUS: 'CANCELLED', SUMMARY: 'Reporté : Lille – Lens', SEQUENCE: '0' });
    expect(ev.DESCRIPTION).toBe('Ligue 1 · LOSC Lille – RC Lens\nCoup d’envoi lundi 26 octobre à 20:00, heure de Paris.\nMatch reporté.\nLa page du match : https://baromatch.fr/matchs/lille-lens-2026-10-26/');
  }
  // Pas de bouton ni de fichier pour un match reporté.
  expect(existsSync(path.join(sortie, 'matchs/lille-lens-2026-10-26/match.ics'))).toBe(false);
  expect(octets(sortie, 'matchs/lille-lens-2026-10-26/index.html').toString('utf8')).not.toContain('Ajouter à mon agenda');
  expect(etatDe(sortie).evenements['m-lille-lens@baromatch.fr'].annuleLe).toBe('2026-10-23T08:00:00Z');
  // Six jours plus tard (le match aurait dû être joué), il est toujours là ; sept jours après, il s’efface.
  await passer(sortie, '2026-10-29T08:00:00Z', { source: reporte });
  expect(evenementDe(sortie, 'agenda/lille.ics', 'm-lille-lens@baromatch.fr')).toMatchObject({ STATUS: 'CANCELLED', SEQUENCE: '0', DTSTAMP: '20261023T080000Z' });
  await passer(sortie, '2026-10-30T09:00:00Z', { source: reporte });
  expect(evenementDe(sortie, 'agenda/lille.ics', 'm-lille-lens@baromatch.fr')).toBeUndefined();
  // Effacé, pas oublié : tant qu’il reste dans les listes avec son statut, l’état garde quand il a été annoncé reporté.
  expect(etatDe(sortie).evenements['m-lille-lens@baromatch.fr']).toEqual({ ids: ['m-lille-lens'], annuleLe: '2026-10-23T08:00:00Z', efface: true, sequence: 0 });

  // Annulé : « Annulé ». Et un match annulé depuis longtemps (déjà passé quand on le voit) n’apparaît jamais.
  const autre = dossierVide();
  const annule = variante(autre, (brut) => ({ ...brut, matches: brut.matches.map((m) => (m.id === 'm-om-nice' ? { ...m, status: 'CANCELLED' } : m.id === 'm-om-lens' ? { ...m, status: 'CANCELLED' } : m)) }));
  await passer(autre, '2026-10-23T08:00:00Z', { source: annule });
  expect(evenementDe(autre, 'agenda/om.ics', 'm-om-nice@baromatch.fr')).toMatchObject({ STATUS: 'CANCELLED', SUMMARY: 'Annulé : OM – Nice' });
  expect(evenementDe(autre, 'agenda/om.ics', 'm-om-lens@baromatch.fr')).toBeUndefined();
});

test('un match reporté plus de sept jours à l’avance : effacé après sept jours, il ne revient pas tant qu’il reste listé reporté', async () => {
  // PSG – OM, le vendredi 20 novembre, annoncé reporté le vendredi 23 octobre et toujours dans les listes ensuite.
  const sortie = dossierVide();
  const reporte = variante(sortie, (brut) => ({ ...brut, matches: brut.matches.map((m) => (m.id === 'm-loin' ? { ...m, status: 'POSTPONED' } : m)) }));
  await passer(sortie, '2026-10-23T08:00:00Z', { source: reporte });
  expect(evenementDe(sortie, 'agenda/psg.ics', 'm-loin@baromatch.fr')).toMatchObject({ STATUS: 'CANCELLED', SUMMARY: 'Reporté\u00A0: PSG – OM', SEQUENCE: '0' });
  // Sept jours après l’annonce, il s’efface des agendas de ses deux clubs.
  await passer(sortie, '2026-10-30T09:00:00Z', { source: reporte });
  for (const club of ['psg', 'om']) expect(evenementDe(sortie, `agenda/${club}.ics`, 'm-loin@baromatch.fr'), club).toBeUndefined();
  // Les jours suivants, il ne revient pas pour sept jours de plus.
  for (const instant of ['2026-10-30T12:00:00Z', '2026-10-31T09:00:00Z', '2026-11-08T09:00:00Z']) {
    await passer(sortie, instant, { source: reporte });
    for (const club of ['psg', 'om']) expect(evenementDe(sortie, `agenda/${club}.ics`, 'm-loin@baromatch.fr'), `${club} à ${instant}`).toBeUndefined();
    expect(etatDe(sortie).evenements['m-loin@baromatch.fr'], instant).toEqual({ ids: ['m-loin'], annuleLe: '2026-10-23T08:00:00Z', efface: true, sequence: 0 });
  }
  // Remis au programme : le même évènement revient, confirmé, sa version au-dessus de celle qui l’annulait.
  await passer(sortie, '2026-11-09T09:00:00Z');
  expect(evenementDe(sortie, 'agenda/psg.ics', 'm-loin@baromatch.fr')).toMatchObject({ STATUS: 'CONFIRMED', SUMMARY: 'PSG – OM', SEQUENCE: '1', DTSTAMP: '20261109T090000Z' });
  expect(etatDe(sortie).evenements['m-loin@baromatch.fr'].efface).toBeUndefined();
  // Sorti des listes, l’effacé s’oublie.
  const autre = dossierVide();
  const sansLui = variante(autre, (brut) => ({ ...brut, matches: brut.matches.filter((m) => m.id !== 'm-loin') }));
  const reporteAilleurs = variante(autre, (brut) => ({ ...brut, matches: brut.matches.map((m) => (m.id === 'm-loin' ? { ...m, status: 'POSTPONED' } : m)) }));
  await passer(autre, '2026-10-23T08:00:00Z', { source: reporteAilleurs });
  await passer(autre, '2026-10-31T09:00:00Z', { source: reporteAilleurs });
  expect(etatDe(autre).evenements['m-loin@baromatch.fr']).toMatchObject({ efface: true });
  await passer(autre, '2026-11-01T09:00:00Z', { source: sansLui });
  expect(etatDe(autre).evenements['m-loin@baromatch.fr']).toBeUndefined();
  expect(evenementDe(autre, 'agenda/psg.ics', 'm-loin@baromatch.fr')).toBeUndefined();
});

test('un match qui sort des listes avant d’être joué : le même évènement, annulé, « Plus au programme », sept jours', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  expect(evenementDe(sortie, 'agenda/om.ics', 'm-om-nice@baromatch.fr')).toMatchObject({ STATUS: 'CONFIRMED', SEQUENCE: '0', DTSTAMP: '20261023T080000Z' });
  const sansLui = variante(sortie, (brut) => ({ ...brut, matches: brut.matches.filter((m) => m.id !== 'm-om-nice') }));
  await passer(sortie, '2026-10-24T08:00:00Z', { source: sansLui });
  for (const club of ['om', 'nice']) {
    expect(evenementDe(sortie, `agenda/${club}.ics`, 'm-om-nice@baromatch.fr')).toMatchObject({
      STATUS: 'CANCELLED', SUMMARY: 'Plus au programme : OM – Nice', SEQUENCE: '1', DTSTAMP: '20261024T080000Z', DTSTART: '20261028T190000Z',
      // Sa page reste (« Ce match n’est plus au programme »), l’évènement y mène.
      URL: 'https://baromatch.fr/matchs/om-nice-2026-10-28/',
    });
  }
  expect(evenementDe(sortie, 'agenda/om.ics', 'm-om-nice@baromatch.fr').DESCRIPTION).toContain('Ce match n’est plus au programme.');
  expect(existsSync(path.join(sortie, 'matchs/om-nice-2026-10-28/match.ics'))).toBe(false);
  await passer(sortie, '2026-10-31T07:00:00Z', { source: sansLui });
  expect(evenementDe(sortie, 'agenda/om.ics', 'm-om-nice@baromatch.fr')).toMatchObject({ STATUS: 'CANCELLED', SEQUENCE: '1' });
  await passer(sortie, '2026-10-31T09:00:00Z', { source: sansLui });
  expect(evenementDe(sortie, 'agenda/om.ics', 'm-om-nice@baromatch.fr')).toBeUndefined();
  expect(etatDe(sortie).evenements['m-om-nice@baromatch.fr']).toBeUndefined();
});

test('un club qui sort des listes de Ligue 1 garde 30 jours un agenda valide qui le dit, puis il disparaît', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  const sansAngers = variante(sortie, (brut) => ({ ...brut, matches: brut.matches.filter((m) => m.id !== 'm-ol-angers') }));
  await passer(sortie, '2026-10-23T09:00:00Z', { source: sansAngers });
  const angers = lireEtValider(octets(sortie, 'agenda/angers.ics'));
  expect(angers.calendrier['X-WR-CALDESC']).toBe('Angers n’est plus au programme de Baromatch en Ligue 1 : cet agenda ne reçoit plus de match. https://baromatch.fr/agenda/');
  expect(angers.evenements.map((ev) => [ev.SUMMARY, ev.STATUS])).toEqual([['Plus au programme : OL – Angers', 'CANCELLED']]);
  expect(etatDe(sortie).pages['/agenda/angers.ics'].memoire).toEqual({ court: 'Angers', nom: 'Angers SCO', parti: '2026-10-23T09:00:00Z' });
  expect(octets(sortie, 'agenda/index.html').toString('utf8')).not.toContain('club-angers');
  await passer(sortie, '2026-10-31T10:00:00Z', { source: sansAngers });
  expect(lireEtValider(octets(sortie, 'agenda/angers.ics')).evenements).toEqual([]);
  await passer(sortie, '2026-11-22T10:00:00Z', { source: sansAngers, accepterLesSuppressions: true });
  expect(existsSync(path.join(sortie, 'agenda/angers.ics'))).toBe(false);
  expect(etatDe(sortie).pages['/agenda/angers.ics']).toBeUndefined();
  expect(existsSync(path.join(sortie, 'agenda/psg.ics'))).toBe(true);
});

test('rien ne change, rien n’est réécrit : les mêmes octets ; un match qui change de jour garde son UID, sa version monte', async () => {
  // Deux passages à la même heure, dans deux dossiers vides : les mêmes fichiers, octet pour octet.
  const [a, b] = [dossierVide(), dossierVide()];
  await passer(a, '2026-10-23T08:00:00Z');
  await passer(b, '2026-10-23T08:00:00Z');
  expect(agendasDe(a)).toEqual(agendasDe(b));
  for (const fichier of agendasDe(a)) expect(octets(a, fichier).equals(octets(b, fichier)), fichier).toBe(true);
  // Trois heures plus tard, rien n’a changé dans les listes : aucun agenda réécrit, les mêmes octets (DTSTAMP compris).
  const avant = Object.fromEntries(agendasDe(a).map((f) => [f, octets(a, f)]));
  const resultat = await passer(a, '2026-10-23T11:00:00Z');
  expect(resultat.ecrits.filter((chemin) => chemin.endsWith('.ics'))).toEqual([]);
  for (const [fichier, contenuAvant] of Object.entries(avant)) expect(octets(a, fichier).equals(contenuAvant), fichier).toBe(true);

  // PSG – OL passe au lundi : une autre adresse de page, le même évènement (UID), sa version monte, son DTSTAMP aussi ; les
  // autres ne bougent pas.
  const deplace = variante(a, (brut) => ({ ...brut, matches: brut.matches.map((m) => (m.id === 'm-psg-ol' ? { ...m, startAt: '2026-10-26T19:45:00.000Z' } : m)) }));
  await passer(a, '2026-10-23T12:00:00Z', { source: deplace });
  const psg = lireEtValider(octets(a, 'agenda/psg.ics'));
  expect(psg.evenements.filter((ev) => ev.UID === 'm-psg-ol@baromatch.fr')).toHaveLength(1);
  expect(psg.evenements.find((ev) => ev.UID === 'm-psg-ol@baromatch.fr')).toMatchObject({
    DTSTART: '20261026T194500Z', SEQUENCE: '1', DTSTAMP: '20261023T120000Z', URL: 'https://baromatch.fr/matchs/psg-ol-2026-10-26/', STATUS: 'CONFIRMED',
  });
  expect(psg.evenements.find((ev) => ev.UID === 'm-loin@baromatch.fr')).toMatchObject({ SEQUENCE: '0', DTSTAMP: '20261023T080000Z' });
  expect(evenementDe(a, 'matchs/psg-ol-2026-10-26/match.ics', 'm-psg-ol@baromatch.fr')).toMatchObject({ SEQUENCE: '1' });
  // L’ancienne adresse dit « plus au programme », sans bouton : son fichier est parti.
  expect(existsSync(path.join(a, 'matchs/psg-ol-2026-10-25/match.ics'))).toBe(false);
});

test('sans vrai bar, aucun texte d’agenda ne parle de bars ; la page agenda/ est indexable tant qu’un club a un match à venir, sinon noindex, hors du plan du site', async () => {
  const sortie = dossierVide();
  await construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse('2026-10-23T08:00:00Z'), racine, contenu: chargerLeContenu(racine), rendu: null });
  for (const fichier of agendasDe(sortie)) {
    const lu = lireEtValider(octets(sortie, fichier), fichier);
    const textes = [lu.calendrier['X-WR-CALDESC'] ?? '', ...lu.evenements.flatMap((ev) => [ev.SUMMARY, ev.DESCRIPTION])].join('\n');
    expect(textes, fichier).not.toMatch(/(?<!\p{L})bars?(?!\p{L})|diffuse/iu);
  }
  // Un outil fait des vrais matchs, qui ne nomme aucun bar (comme l’affiche de la semaine) : indexable sans bar, tant
  // qu’un club de Ligue 1 a un match à venir.
  const page = octets(sortie, 'agenda/index.html').toString('utf8');
  expect(page).not.toContain('noindex');
  expect(etatDe(sortie).pages['/agenda/']).toMatchObject({ type: 'agenda', indexable: true });
  expect(readFileSync(path.join(sortie, 'sitemap.xml'), 'utf8')).toContain('<loc>https://baromatch.fr/agenda/</loc>');
  // Sans bar ni match à venir (le scénario, deux mois plus tard) : noindex, hors du plan du site.
  const vide = dossierVide();
  await construire({ source: `scenario:${SCENARIO}`, sortie: vide, maintenant: Date.parse('2026-12-23T08:00:00Z'), racine, contenu: chargerLeContenu(racine), rendu: null });
  expect(octets(vide, 'agenda/index.html').toString('utf8')).toContain('<meta name="robots" content="noindex">');
  expect(etatDe(vide).pages['/agenda/']).toMatchObject({ type: 'agenda', indexable: false });
  expect(readFileSync(path.join(vide, 'sitemap.xml'), 'utf8')).not.toContain('/agenda/');
  // Avec de vrais bars (le scénario), la page est indexable et entre au plan du site, même quand aucun match de ces
  // agendas n’a plus de bar (le samedi 31, après la dernière soirée annoncée, Le Havre – PSG).
  const avec = dossierVide();
  await passer(avec, '2026-10-23T08:00:00Z');
  expect(octets(avec, 'agenda/index.html').toString('utf8')).toContain('<meta name="robots" content="max-image-preview:large">');
  expect(readFileSync(path.join(avec, 'sitemap.xml'), 'utf8')).toContain('<url><loc>https://baromatch.fr/agenda/</loc><lastmod>2026-10-23</lastmod></url>');
  await passer(avec, '2026-10-31T08:00:00Z');
  expect(octets(avec, 'agenda/index.html').toString('utf8')).toContain('<meta name="robots" content="max-image-preview:large">');
  expect(readFileSync(path.join(avec, 'sitemap.xml'), 'utf8')).toContain('<loc>https://baromatch.fr/agenda/</loc>');
});

test('la page agenda/ : trois lignes d’explication, les clubs, chaque téléphone, ce qu’il y a dedans et ce qui manque', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  const page = octets(sortie, 'agenda/index.html').toString('utf8');
  expect(page).toContain('<title>Ton club dans ton agenda — Baromatch</title>');
  const tete = page.match(/<header class="regarder-tete">([\s\S]*?)<\/header>/)[1];
  expect([...tete.matchAll(/<p class="regarder-chapeau">([^<]*)<\/p>/g)].map((m) => m[1])).toEqual([
    'Abonne-toi à l’agenda de ton club : ses matchs arrivent dans le calendrier de ton téléphone.',
    'Un horaire change, un match est reporté : ton agenda suit, sans rien refaire.',
    'Ligue 1 et coupes d’Europe, pour l’instant jusqu’au vendredi 20 novembre.',
  ]);
  // Les clubs, par leur nom court ; pour chacun, l’abonnement (webcal) et l’adresse à copier (https).
  expect([...page.matchAll(/<li class="regarder-carte" id="club-([a-z0-9-]+)">/g)].map((m) => m[1])).toEqual(['angers', 'auxerre', 'brest', 'le-havre', 'lens', 'lille', 'nice', 'ol', 'om', 'psg']);
  expect(page).toContain('<a class="regarder-agenda__bouton" href="webcal://baromatch.fr/agenda/psg.ics">S’abonner<span class="visuellement-cache"> : PSG</span></a>');
  expect(page).toContain('<a href="https://baromatch.fr/agenda/psg.ics">https://baromatch.fr/agenda/psg.ics</a>');
  expect(page).toContain('<p class="regarder-carte__lieu">Paris Saint-Germain · 4 matchs à venir</p>');
  expect(page).toContain('<p class="regarder-carte__lieu">Angers SCO · 1 match à venir</p>');
  expect(page).toContain('<strong>iPhone, iPad et Mac</strong>');
  expect(page).toContain(insecables('« Autres agendas », choisis « Ajouter d’autres agendas », puis « À partir de l’URL »'));
  expect(page).toContain(insecables('« Ajouter un calendrier », puis « S’abonner à partir du web »'));
  expect(page).toContain('<p>Les matchs de ton club au programme de Baromatch : Ligue 1 et Ligue des champions.</p>');
  expect(page).toContain('<p>Ils arrivent quelques semaines à l’avance : pour l’instant, jusqu’au vendredi 20 novembre.</p>');
  expect(page).toContain('<p>Pas de Coupe de France ni de match amical pour l’instant.</p>');
  // Les clubs en simples mots : ni « officiel », ni écusson, ni image.
  const principal = page.match(/<main[\s\S]*<\/main>/)[0];
  expect(principal).not.toMatch(/officiel|écusson|logo|<img|<svg/i);

  // Une Coupe de France dans les listes : la page et l’agenda le disent, et ne disent plus qu’elle manque.
  const avecCoupe = dossierVide();
  const coupe = variante(avecCoupe, (brut) => ({
    ...brut,
    matches: [...brut.matches, { id: 'm-coupe', startAt: '2026-11-14T20:00:00.000Z', league: 'Coupe de France', homeTeam: 'Paris Saint-Germain', awayTeam: 'Olympique Lyonnais', homeClub: { slug: 'paris-saint-germain', canonicalName: 'Paris Saint-Germain' }, awayClub: { slug: 'olympique-lyonnais', canonicalName: 'Olympique Lyonnais' } }],
  }));
  await passer(avecCoupe, '2026-10-23T08:00:00Z', { source: coupe });
  const pageCoupe = octets(avecCoupe, 'agenda/index.html').toString('utf8');
  expect(pageCoupe).toContain('<p class="regarder-chapeau">Ligue 1, Coupe de France et Ligue des champions, pour l’instant jusqu’au vendredi 20 novembre.</p>');
  expect(pageCoupe).toContain('<p>Pas de match amical pour l’instant.</p>');
  expect(lireEtValider(octets(avecCoupe, 'agenda/psg.ics')).calendrier['X-WR-CALDESC']).toContain('(Ligue 1, Coupe de France et Ligue des champions)');
});

// Un fan qui suit un club passe de son agenda à sa page (generateur/suivre.mjs : une par club de contenu/suivre.json) :
// ses matchs à venir et où les voir. La carte d’un club qui a sa page y mène, en dernier, avec les mots de la page d’un
// match ; un club sans page n’a pas ce lien (aucun lien ne meurt). Sur le scénario inventé et sur la copie enregistrée
// des listes publiques (tous les clubs de la liste y jouent en Ligue 1) : chaque lien mène à une page que le même
// passage écrit.
test('la page agenda/ : la carte de chaque club qui a sa page y mène, celle des autres non', async () => {
  const clubsAvecPage = Object.keys(TEXTES_SUIVRE.clubs).filter((cle) => !cle.startsWith('_'));
  for (const [nom, maintenant, options, attendus] of [
    ['le scénario', '2026-10-23T08:00:00Z', {}, ['lens', 'lille', 'nice', 'ol', 'om', 'psg']],
    ['la capture', new Date(MAINTENANT_DE_LA_CAPTURE).toISOString(), { source: `capture:${CAPTURE}`, contenu: chargerLeContenu(racine) }, [...clubsAvecPage].sort()],
  ]) {
    const sortie = dossierVide();
    await passer(sortie, maintenant, options);
    const page = octets(sortie, 'agenda/index.html').toString('utf8');
    const cartes = [...page.matchAll(/<li class="regarder-carte" id="club-([a-z0-9-]+)">([\s\S]*?)<\/li>/g)].map((m) => ({ cle: m[1], carte: m[2] }));
    expect(cartes.length, nom).toBeGreaterThan(attendus.length);
    const lies = cartes.filter((c) => c.carte.includes('/matchs/club/')).map((c) => c.cle).sort();
    expect(lies, nom).toEqual(attendus);
    for (const { cle, carte } of cartes) {
      if (!clubsAvecPage.includes(cle)) continue;
      const lien = `<a href="${cheminDuClub(cle)}">${TEXTES_SUIVRE.lienDuClub.replace('{de}', TEXTES_SUIVRE.clubs[cle].de)}</a>`;
      expect(carte.trimEnd().endsWith(`<p class="regarder-carte__suite">${lien}</p>`), `${nom} : ${cle}`).toBe(true);
      expect(existsSync(path.join(sortie, 'matchs', 'club', cle, 'index.html')), `${nom} : ${cle}`).toBe(true);
    }
  }
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  expect(octets(sortie, 'agenda/index.html').toString('utf8')).toContain(`<p class="regarder-agenda__adresse"><a href="https://baromatch.fr/agenda/psg.ics">https://baromatch.fr/agenda/psg.ics</a></p>
      <p class="regarder-carte__suite"><a href="/matchs/club/psg/">Les matchs du PSG et où les voir</a></p>
    </li>`);
});

test('la page d’un match : « Ajouter à mon agenda » s’il est à venir, l’agenda de ses clubs ; la page d’une ville mène à l’agenda', async () => {
  const sortie = dossierVide();
  await passer(sortie, '2026-10-23T08:00:00Z');
  const match = octets(sortie, 'matchs/psg-ol-2026-10-25/index.html').toString('utf8');
  const tete = match.match(/<header class="regarder-tete">[\s\S]*?<\/header>/)[0];
  expect(tete).toContain(`<div class="regarder-agenda">
    <a class="regarder-agenda__bouton" href="/matchs/psg-ol-2026-10-25/match.ics" type="text/calendar">Ajouter à mon agenda</a>
    <p class="regarder-agenda__clubs">Suis ton club dans ton agenda : <a href="/agenda/#club-psg">PSG</a> <a href="/agenda/#club-ol">OL</a></p>
  </div>`);
  // Le Barça n’a pas d’agenda (pas en Ligue 1) : seul le PSG.
  expect(octets(sortie, 'matchs/psg-barca-2026-10-24/index.html').toString('utf8')).toContain('Suis ton club dans ton agenda : <a href="/agenda/#club-psg">PSG</a></p>');
  // Un match sans club de Ligue 1 : la page agenda/.
  const autre = { slug: 'arsenal-everton-2026-10-24', domicile: { cle: 'arsenal', court: 'Arsenal' }, exterieur: { cle: 'everton', court: 'Everton' } };
  expect(blocDuMatch(autre, { clubsSuivis: new Set(['psg']), fichier: false })).toBe(`<div class="regarder-agenda">
    <p class="regarder-agenda__clubs"><a href="/agenda/">Ton club dans ton agenda</a></p>
  </div>`);
  expect(octets(sortie, 'regarder-le-match/paris/index.html').toString('utf8')).toContain('<p class="regarder-suite"><a href="/agenda/">Ton club dans ton agenda</a></p>');
});

// ---------- La liste blanche, l’écriture, git ----------

test('la liste blanche : agenda/ (sa page, un .ics par club) et match.ics à côté d’une page de match, rien d’autre', () => {
  for (const permis of ['agenda/index.html', 'agenda/psg.ics', 'agenda/le-havre.ics', 'matchs/psg-ol-2026-10-25/match.ics']) expect(estPermis(permis), permis).toBe(true);
  for (const refuse of ['agenda/PSG.ics', 'agenda/x/psg.ics', 'agenda/psg.ics.html', 'agenda/psg.txt', 'agenda/../index.html', 'bar/x/match.ics', 'regarder-le-match/x/match.ics',
    'matchs/a/b/match.ics', 'matchs/match.ics', 'ce-soir/match.ics', 'agenda.ics', 'matchs/x/autre.ics']) {
    expect(estPermis(refuse), refuse).toBe(false);
  }
});

test('un agenda (CRLF) inchangé n’est pas réécrit', () => {
  const sortie = dossierVide();
  const texte = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';
  expect(ecrireUnFichier(sortie, 'agenda/psg.ics', texte)).toBe(true);
  expect(ecrireUnFichier(sortie, 'agenda/psg.ics', texte)).toBe(false);
  expect(octets(sortie, 'agenda/psg.ics').toString('utf8')).toBe(texte);
});

test('git ne touche pas aux fins de ligne des agendas, et l’Action les enregistre', () => {
  const attributs = readFileSync(path.join(racine, '.gitattributes'), 'utf8').split(/\r?\n/);
  expect(attributs).toContain('*.ics -text');
  const action = readFileSync(path.join(racine, '.github', 'workflows', 'pages-des-matchs.yml'), 'utf8');
  expect(action).toContain('for chemin in matchs regarder-le-match bar ce-soir en agenda sitemap.xml; do');
  expect(action).toContain("grep -vqE '^(matchs|regarder-le-match|bar|ce-soir|en|agenda)/|^sitemap\\.xml$'");
});
