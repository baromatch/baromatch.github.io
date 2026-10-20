// La page d’un match en anglais : « Add to calendar » (le même fichier match.ics que sa jumelle en français), le
// nombre de bars dit à l’anglaise (« 1 bar in Paris », jamais « 1 Paris bar ») ; sous la liste d’attente, l’essentiel
// de la confidentialité en anglais (qui, pourquoi, quoi, Formspree aux États-Unis, combien de temps, tes droits et
// l’adresse de la page Confidentialité), en HTML seul.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

let site;
const pageDe = (chemin) => site.pages.find((p) => p.chemin === chemin);
test.beforeAll(async () => {
  site = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario() });
});

test('« Add to calendar » : le même fichier que la page en français, pour un match à venir', () => {
  const bouton = '<a class="regarder-agenda__bouton" href="/matchs/psg-barca-2026-10-24/match.ics" type="text/calendar">Add to calendar</a>';
  expect(pageDe('/en/matches/psg-barca-2026-10-24/').contenu).toContain(bouton);
  expect(pageDe('/matchs/psg-barca-2026-10-24/').contenu).toContain('href="/matchs/psg-barca-2026-10-24/match.ics"');
  expect(pageDe('/en/matches/le-havre-psg-2026-10-30/').contenu).toContain('href="/matchs/le-havre-psg-2026-10-30/match.ics" type="text/calendar">Add to calendar</a>');
});

test('le nombre de bars à l’anglaise : « 2 bars in Paris », « 1 bar in Paris »', () => {
  const avecDeux = pageDe('/en/matches/psg-barca-2026-10-24/').contenu;
  expect(avecDeux).toContain('<p class="regarder-compte">2 bars in Paris</p>');
  expect(pageDe('/en/matches/le-havre-psg-2026-10-30/').contenu).toContain('<p class="regarder-compte">1 bar in Paris</p>');
  for (const p of site.pages.filter((x) => x.langue === 'en')) expect(p.contenu, p.chemin).not.toMatch(/\d Paris bars?\b/);
});

test('sous la liste d’attente en anglais : qui, pourquoi, quoi, Formspree (USA), combien de temps, tes droits, le contact', () => {
  const confidentialite = readFileSync(path.join(racine, 'confidentialite.html'), 'utf8');
  const contact = confidentialite.split('id="liste-attente"')[1].match(/mailto:([^"]+)"/)[1];
  for (const chemin of ['/en/', '/en/matches/psg-barca-2026-10-24/']) {
    const html = pageDe(chemin).contenu;
    const bloc = html.match(/<ul class="attente__vie-privee">[\s\S]*?<\/ul>/)?.[0];
    expect(bloc, chemin).toBeTruthy();
    const texte = bloc.replace(/<[^>]+>/g, '').replace(/[\s ]+/g, ' ');
    for (const attendu of ['Who: Baromatch', 'Why: to email you when the app opens in Paris', 'What: your email address', 'Formspree', 'USA', 'until the app launches in Paris, then 12 months at most', contact]) {
      expect(texte, `${chemin} : ${attendu}`).toContain(attendu);
    }
    expect(bloc).toContain(`href="mailto:${contact}"`);
    expect(html).toContain('href="/confidentialite.html#liste-attente" hreflang="fr"');
    expect(html.split('<ul class="attente__vie-privee">')[0]).toContain('<form class="attente"');
  }
});
