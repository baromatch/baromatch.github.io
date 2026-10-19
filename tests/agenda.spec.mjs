// L’écriture iCalendar des agendas (generateur/ical.mjs) et le validateur iCalendar strict des tests
// (tests/outils/icalendar.mjs) : un iCalendar juste passe, chaque défaut est trouvé ; les lignes de 75 octets au plus,
// sans couper un caractère ; les textes échappés ; les instants en UTC.
import { test, expect } from '@playwright/test';
import { erreursDuCalendrier } from './outils/icalendar.mjs';
import { echapperTexte, instantUtc, lendemain, plier } from '../generateur/ical.mjs';

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
