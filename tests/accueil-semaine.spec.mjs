// Le moment de 19:30, « Choisis ton match », que le générateur (generateur/accueil.mjs) écrit dans l’accueil : une phrase qui
// dit le jour et ce qui est vrai des bars, les matchs du jour (leur heure, leurs deux insignes, le lien de leur page), puis la
// semaine dessinée, sept jours en piles d’insignes, qui mène à tous les matchs. Ce fichier vérifie la logique du jour
// (« Ce soir », « Aujourd’hui », « Demain », la date), la vérité sur les bars, la liste courte, la semaine, les insignes, et la
// tenue de la page dans une semaine chargée (25 matchs, tests/donnees/semaine-pleine.json : un samedi de 10 matchs).
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { blocDeLaSemaine, controlerLaSemaine, jourDit, matchsDeLAccueil, MATCHS_DE_L_ACCUEIL, INSIGNES_PAR_PILE } from '../generateur/accueil.mjs';
import { texteVisible } from '../generateur/controle.mjs';
import { DUREE_MATCH_MS } from '../generateur/donnees.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { racine } from './outils/environnement.mjs';
import { lireLesDebordements } from './outils/debordements.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const SEMAINE_PLEINE = path.join(racine, 'tests', 'donnees', 'semaine-pleine.json');
const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();
const phrase = (bloc) => normaliser(bloc.match(/<p class="chapo" data-soir-phrase>([^<]*)<\/p>/)?.[1].replace(/&amp;/g, '&') ?? '');

let site;
test.beforeAll(async () => {
  site = await construireEnMemoire({ source: `scenario:${SEMAINE_PLEINE}`, maintenant: Date.parse('2026-10-30T07:00:00Z'), racine });
});
const bloc = (maintenant, donnees = site.donnees) => blocDeLaSemaine({ donnees, textes: site.contenu.textes, maintenant: Date.parse(maintenant) });

test.describe('le jour, dit comme on le dit', () => {
  test('« Ce soir » quand les matchs du jour sont du soir, « Aujourd’hui » quand le premier est avant 17 h, « Demain » quand rien ne reste, la date quand c’est plus loin', () => {
    // Vendredi : deux matchs, à 19 h et 21 h 05 à Paris, à venir à 8 h comme à 19 h.
    expect(phrase(bloc('2026-10-30T07:00:00Z'))).toMatch(/^Ce soir, vendredi 30 octobre : 2 matchs\. /);
    expect(phrase(bloc('2026-10-30T17:00:00Z'))).toMatch(/^Ce soir, vendredi 30 octobre : 2 matchs\. /);
    // Vendredi 21 h 30 : ils ont commencé, le prochain jour de matchs est demain (les dix du samedi).
    expect(phrase(bloc('2026-10-30T20:30:00Z'))).toMatch(/^Demain, samedi 31 octobre : 10 matchs\. /);
    // Samedi : le premier match est à 13 h 30, avant 17 h.
    expect(phrase(bloc('2026-10-31T07:00:00Z'))).toMatch(/^Aujourd’hui, samedi 31 octobre : 10 matchs\. /);
    const sansLesDeuxProchains = { ...site.donnees, matchs: site.donnees.matchs.filter((m) => !/^2026-11-0[1-4]/.test(new Date(m.debut).toISOString())) };
    expect(phrase(bloc('2026-10-31T23:00:00Z', sansLesDeuxProchains))).toMatch(/^Jeudi 5 novembre : \d matchs?\. /);
  });

  test('un jour sans match à venir : les matchs du prochain jour qui en a ; aucun match à venir : une phrase vraie et un lien', () => {
    const saisons = matchsDeLAccueil(site.donnees, Date.parse('2026-11-02T10:00:00Z'));
    expect(saisons.length).toBeGreaterThan(0);
    expect(new Set(saisons.map((m) => new Date(m.debut).toISOString().slice(0, 10))).size).toBe(1);
    const rien = bloc('2026-12-30T10:00:00Z');
    expect(rien).toContain('Aucun match annoncé pour l’instant.');
    expect(rien).toContain('<a class="lien-trait" href="/matchs/">Voir la semaine</a>');
    expect(rien).not.toContain('<ul class="soir">');
    expect(controlerLaSemaine(rien)).toEqual([]);
  });

  test('jourDit : ce soir, aujourd’hui, demain, ou la date', () => {
    const t = site.contenu.textes.accueil;
    expect(jourDit(Date.parse('2026-10-30T19:00:00Z'), Date.parse('2026-10-30T07:00:00Z'), t)).toBe('ce soir');
    expect(jourDit(Date.parse('2026-10-30T11:00:00Z'), Date.parse('2026-10-30T07:00:00Z'), t)).toBe('aujourd’hui');
    expect(jourDit(Date.parse('2026-10-31T19:00:00Z'), Date.parse('2026-10-30T07:00:00Z'), t)).toBe('demain');
    expect(jourDit(Date.parse('2026-11-02T19:00:00Z'), Date.parse('2026-10-30T07:00:00Z'), t)).toBe('lundi 2 novembre');
  });
});

test.describe('la vérité sur les bars', () => {
  test('aujourd’hui aucun bar n’est publié : la phrase le dit, chaque match a sa page, aucune ligne de match ne parle d’un bar', () => {
    const b = bloc('2026-10-31T07:00:00Z');
    expect(phrase(b)).toContain('Aucun bar ne les annonce encore sur Baromatch : chaque match a déjà sa page.');
    expect(b).not.toContain('match__bars');
  });

  test('dès qu’un match a un bar, la phrase et la ligne du match le disent : « Un de ces matchs a déjà un bar » puis « 2 de ces matchs ont déjà un bar »', () => {
    const jour = matchsDeLAccueil(site.donnees, Date.parse('2026-10-31T07:00:00Z'));
    const bar = (ville) => ({ bar: { ville: { nom: ville } } });
    const avec = (nombre) => ({ ...site.donnees, matchs: site.donnees.matchs.map((m) => (jour.slice(0, nombre).includes(m) ? { ...m, soirees: [bar('Paris')] } : m)) });
    const un = blocDeLaSemaine({ donnees: avec(1), textes: site.contenu.textes, maintenant: Date.parse('2026-10-31T07:00:00Z') });
    expect(phrase(un)).toContain('Un de ces matchs a déjà un bar sur Baromatch. Chaque match a sa page.');
    expect(un).toContain('<span class="match__bars">1 bar à Paris</span>');
    const deux = blocDeLaSemaine({ donnees: avec(2), textes: site.contenu.textes, maintenant: Date.parse('2026-10-31T07:00:00Z') });
    expect(phrase(deux)).toContain('2 de ces matchs ont déjà un bar sur Baromatch.');
    expect(deux.match(/class="match__bars"/g)).toHaveLength(2);
    expect(controlerLaSemaine(un)).toEqual([]);
  });
});

test.describe('la liste du jour', () => {
  test('au plus six matchs, du premier au dernier, avec le lien de leur page, leur heure et leurs deux insignes ; le reste, un lien vers « Ce soir »', () => {
    const b = bloc('2026-10-31T07:00:00Z');
    const lignes = [...b.matchAll(/<li><a class="match" href="([^"]+)"><time class="match__heure" datetime="([^"]+)">(\d\d:\d\d)<\/time><span class="match__paire">(<svg[\s\S]*?<\/svg>){2}<\/span><span class="match__nom">([^<]+)<\/span>/g)];
    expect(lignes).toHaveLength(MATCHS_DE_L_ACCUEIL);
    const heures = lignes.map((l) => l[3]);
    expect(heures).toEqual([...heures].sort());
    for (const [, lien] of lignes) expect(lien).toMatch(/^\/matchs\/[a-z0-9-]+-2026-10-31\/$/);
    expect(b).toContain('<p class="soir__suite"><a class="lien-trait" href="/ce-soir/">Tous les matchs de ce soir</a></p>');
    // Un jour de deux matchs : pas de lien « Tous les matchs de ce soir » (la liste est complète).
    expect(bloc('2026-10-30T07:00:00Z')).not.toContain('soir__suite');
    expect(bloc('2026-10-30T20:30:00Z')).toContain('href="/matchs/">Tous les matchs de la semaine');
  });

  test('un match commencé ou fini n’y est plus ; un match reporté ou à l’heure non confirmée non plus', () => {
    const m0 = site.donnees.matchs.find((m) => new Date(m.debut).toISOString().startsWith('2026-10-30'));
    const donnees = { ...site.donnees, matchs: site.donnees.matchs.map((m) => (m === m0 ? { ...m, statut: 'POSTPONED' } : m)) };
    expect(matchsDeLAccueil(donnees, Date.parse('2026-10-30T07:00:00Z')).includes(m0)).toBe(false);
    const sansHeure = { ...site.donnees, matchs: site.donnees.matchs.map((m) => (m === m0 ? { ...m, heureConfirmee: false } : m)) };
    expect(matchsDeLAccueil(sansHeure, Date.parse('2026-10-30T07:00:00Z')).includes(m0)).toBe(false);
    // Un match en cours reste dans la liste du jour ; fini, il en sort.
    expect(matchsDeLAccueil(site.donnees, m0.debut + 1000).includes(m0)).toBe(true);
    expect(matchsDeLAccueil(site.donnees, m0.debut + DUREE_MATCH_MS + 1000).includes(m0)).toBe(false);
  });
});

test.describe('la semaine dessinée', () => {
  test('sept jours, chacun en pile de quatre insignes au plus, son nom et son nombre de matchs ; un seul lien, vers tous les matchs', () => {
    const b = bloc('2026-10-30T07:00:00Z');
    const semaine = b.match(/<a class="sept" href="\/matchs\/">[\s\S]*?<\/a>/)[0].replace(/\u00A0/g, ' ');
    expect(b.match(/<a class="sept"/g)).toHaveLength(1);
    const jours = [...semaine.matchAll(/<span class="sept__jour[^"]*">([\s\S]*?)<\/span><\/span>/g)];
    expect(jours).toHaveLength(7);
    expect(semaine.match(/<span class="sept__nom">([^<]+)<\/span>/g).map((x) => x.replace(/<[^>]+>/g, ''))).toEqual(['ven', 'sam', 'dim', 'lun', 'mar', 'mer', 'jeu']);
    expect(semaine.match(/<span class="sept__n">(\d+)<\/span>/g).map((x) => Number(x.replace(/<[^>]+>/g, '')))).toEqual([2, 10, 5, 1, 2, 1, 4]);
    for (const [, jour] of jours) expect((jour.match(/<use /g) ?? []).length).toBeLessThanOrEqual(INSIGNES_PAR_PILE);
    expect(semaine).toContain('<b>La semaine : 25 matchs</b>');
    expect(semaine).toContain('Tous les matchs, clubs et villes');
    // Pour un lecteur d’écran : chaque jour et son nombre de matchs, en toutes lettres ; le dessin est muet.
    expect(semaine).toContain('Vendredi 30 octobre : 2 matchs ; Samedi 31 octobre : 10 matchs');
    expect(semaine).toContain('<span class="sept__jours" aria-hidden="true">');
  });

  test('après le dernier jour que les données connaissent, un jour dit « — », pas « 0 » : on ne sait pas encore', () => {
    // Les données s’arrêtent au lundi 2 novembre : mardi, mercredi et jeudi ne sont pas « sans match », ils sont inconnus.
    const jusquAuLundi = { ...site.donnees, matchs: site.donnees.matchs.filter((m) => new Date(m.debut).toISOString() < '2026-11-02T23:00:00Z') };
    const semaine = bloc('2026-10-30T07:00:00Z', jusquAuLundi).match(/<a class="sept" href="\/matchs\/">[\s\S]*?<\/a>/)[0];
    expect(semaine.match(/<span class="sept__n">([^<]+)<\/span>/g).map((x) => x.replace(/<[^>]+>/g, ''))).toEqual(['2', '10', '5', '1', '—', '—', '—']);
    expect(semaine.match(/sept__jour--inconnu/g)).toHaveLength(3);
    // Un jour connu sans match dit bien « 0 ».
    const sansLeLundi = { ...site.donnees, matchs: site.donnees.matchs.filter((m) => !new Date(m.debut).toISOString().startsWith('2026-11-02')) };
    const autre = bloc('2026-10-30T07:00:00Z', sansLeLundi).match(/<a class="sept" href="\/matchs\/">[\s\S]*?<\/a>/)[0];
    expect(autre.match(/<span class="sept__n">([^<]+)<\/span>/g).map((x) => x.replace(/<[^>]+>/g, ''))[3]).toBe('0');
  });

  test('le bloc passe son contrôle, n’écrit aucun titre et aucun mot qui pousse à boire, et son texte est celui des données', () => {
    for (const maintenant of ['2026-10-30T07:00:00Z', '2026-10-31T07:00:00Z', '2026-11-02T10:00:00Z', '2026-12-30T10:00:00Z']) {
      const b = bloc(maintenant);
      expect(controlerLaSemaine(b), maintenant).toEqual([]);
      expect(texteVisible(`<body>${b}`)).not.toMatch(/happy hour|tournée|verre offert|!/i);
    }
  });
});

test.describe('dans une semaine chargée (25 matchs, un samedi de 10)', () => {
  let page_;
  test.beforeAll(async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-semaine-'));
    try {
      await construireLeSiteDExemple(dossier, { source: `scenario:${SEMAINE_PLEINE}`, maintenant: Date.parse('2026-10-31T07:00:00Z'), rendu: null });
      page_ = readFileSync(path.join(dossier, 'index.html'), 'utf8');
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
  const ouvrir = async (page, largeur, hauteur = 844) => {
    await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: page_ }));
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  };

  for (const largeur of [320, 360, 390]) {
    test(`à ${largeur} px, texte à 200 % : rien ne sort de l’écran, la page ne défile pas de côté`, async ({ page }) => {
      await ouvrir(page, largeur);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const lu = await lireLesDebordements(page);
      expect(lu.dehors).toEqual([]);
      expect(lu.defile, 'la page défile de côté').toBe(false);
    });
  }

  test('à 390 px : la liste de six matchs et la semaine tiennent en deux écrans au plus, et chaque ligne se touche du doigt (44 px)', async ({ page }) => {
    await ouvrir(page, 390);
    const mesure = await page.evaluate(() => {
      const titre = document.querySelector('#titre-choisis').getBoundingClientRect();
      const fin = document.querySelector('.sept').getBoundingClientRect();
      return { bloc: fin.bottom - titre.top, lignes: [...document.querySelectorAll('.match')].map((e) => e.getBoundingClientRect().height), semaine: fin.height };
    });
    expect(mesure.bloc).toBeLessThanOrEqual(2 * 844);
    expect(mesure.lignes).toHaveLength(6);
    for (const h of mesure.lignes) expect(h).toBeGreaterThanOrEqual(44);
    expect(mesure.semaine).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.soir__suite a')).toHaveAttribute('href', '/ce-soir/');
  });

  test('les liens de la liste et le lien de la semaine mènent aux pages que le générateur écrit', async ({ page }) => {
    await ouvrir(page, 390);
    const liens = await page.$$eval('.match, .sept, .soir__suite a', (a) => a.map((l) => l.getAttribute('href')));
    expect(liens).toHaveLength(8);
    expect(liens.filter((l) => l.startsWith('/matchs/') && l !== '/matchs/')).toHaveLength(6);
  });
});
