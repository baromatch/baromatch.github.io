// Les pages générées, dans le navigateur : le scénario inventé construit dans un dossier temporaire (avec une copie du
// site autour, tests/outils/site-genere.mjs) et servi comme GitHub Pages le sert. Sur une page de ville, une page de
// match, la semaine, une page de bar, « Ce soir », « Ton club dans ton agenda », les affiches, la page neutre (celle qui
// remplace une page refusée, refus.mjs) et les pages en anglais (anglais.mjs : Paris, les deux guides, un match indexable
// et un match à un seul bar de Paris) :
// aucune violation d’axe à 360 et 1280 px, rien qui dépende de JavaScript (hors du bloc « Partager », que partage.js
// enrichit), aucun débordement horizontal à 360 px, et chaque lien interne qui répond.
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { violationsAxe } from './outils/axe.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';
import { lireLeCadre } from '../generateur/gabarits.mjs';
import { mesureDuSite } from '../generateur/mesure.mjs';
import { pageDeRepli } from '../generateur/refus.mjs';

// partage : la page a le bloc « Partager » (et son seul script, /partage.js).
const PAGES = [
  { chemin: '/regarder-le-match/paris/', nom: 'ville avec des bars', partage: true },
  { chemin: '/matchs/psg-ol-2026-10-25/', nom: 'match avec des bars', partage: true },
  { chemin: '/matchs/lille-lens-2026-10-26/', nom: 'match sans bar', partage: true },
  { chemin: '/matchs/', nom: 'semaine' },
  { chemin: '/bar/le-zinc-des-amis-paris-11/', nom: 'bar', partage: true },
  { chemin: '/regarder-le-match/', nom: 'villes' },
  { chemin: '/matchs/page-neutre/', nom: 'page neutre' },
  { chemin: '/ce-soir/', nom: 'ce soir', partage: true },
  { chemin: '/agenda/', nom: 'agenda' },
  { chemin: '/matchs/affiche/', nom: 'affiche de la semaine' },
  { chemin: '/bar/le-zinc-des-amis-paris-11/affiche/', nom: 'affiche d’un bar' },
  { chemin: '/en/', nom: 'Paris en anglais', partage: true },
  { chemin: '/en/premier-league/', nom: 'Premier League en anglais', partage: true },
  { chemin: '/en/champions-league/', nom: 'Ligue des champions en anglais', partage: true },
  { chemin: '/en/matches/psg-barca-2026-10-24/', nom: 'match en anglais avec des bars', partage: true },
  { chemin: '/en/matches/le-havre-psg-2026-10-30/', nom: 'match en anglais, un bar de Paris', partage: true },
];

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

let dossier;
let serveur;
test.beforeAll(async () => {
  dossier = mkdtempSync(path.join(tmpdir(), 'site-genere-'));
  await construireLeSiteDExemple(dossier);
  // La page neutre, écrite à une adresse à elle dans le site d’exemple.
  const neutre = pageDeRepli({ chemin: '/matchs/page-neutre/', type: 'match', cle: 'page-neutre' }, {
    cadre: lireLeCadre(dossier), marque: JSON.parse(readFileSync(path.join(dossier, 'marque.json'), 'utf8')), avecPresse: existsSync(path.join(dossier, 'presse.html')),
  });
  mkdirSync(path.join(dossier, 'matchs', 'page-neutre'), { recursive: true });
  writeFileSync(path.join(dossier, 'matchs', 'page-neutre', 'index.html'), neutre.contenu);
  serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(async () => {
  await serveur?.arreter();
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

// Le texte agrandi à 200 % (la méthode de texte-agrandi.spec.mjs), sur une page sans bar en français et en anglais : la
// carte « Tu tiens un bar ? » et son bouton restent dans l’écran, le bouton passe à la ligne et se touche du doigt.
for (const chemin of ['/matchs/lille-lens-2026-10-26/', '/en/premier-league/']) {
  for (const largeur of [320, 360]) {
    test(`${chemin} à ${largeur} px, texte à 200 % : la carte des bars et son bouton restent dans l’écran`, async ({ page: onglet }) => {
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.goto(`${serveur.adresse}${chemin}`);
      await onglet.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const r = await onglet.evaluate(() => {
        const carte = document.querySelector('.regarder-bars-pro');
        const bouton = carte.querySelector('.regarder-bars-pro__bouton');
        const [c, b] = [carte.getBoundingClientRect(), bouton.getBoundingClientRect()];
        const ecran = document.documentElement.clientWidth;
        return {
          dansLaCarte: b.left >= c.left - 0.5 && b.right <= c.right + 0.5,
          dansLEcran: c.right <= ecran + 0.5 && b.right <= ecran + 0.5,
          defile: document.documentElement.scrollWidth > ecran,
          hauteur: b.height,
        };
      });
      expect({ ...r, hauteur: r.hauteur >= 44 }).toEqual({ dansLaCarte: true, dansLEcran: true, defile: false, hauteur: true });
    });
  }
  // En contraste forcé (Windows), l’ombre qui dessine la capsule disparaît : un vrai bord (transparent, repeint par le
  // système) garde au bouton sa forme.
  test(`${chemin} en contraste forcé : « Proposer mon bar » garde un bord`, async ({ page: onglet }) => {
    await onglet.emulateMedia({ forcedColors: 'active' });
    await onglet.goto(`${serveur.adresse}${chemin}`);
    const bord = await onglet.locator('.regarder-bars-pro__bouton').evaluate((b) => [getComputedStyle(b).borderTopStyle, getComputedStyle(b).borderTopWidth]);
    expect(bord).toEqual(['solid', '1px']);
  });
}

for (const page of PAGES) {
  test.describe(page.nom, () => {
    for (const largeur of [360, 1280]) {
      test(`à ${largeur} px : aucune violation d’axe, aucun débordement`, async ({ page: onglet }) => {
        await onglet.setViewportSize({ width: largeur, height: 800 });
        await onglet.goto(`${serveur.adresse}${page.chemin}`);
        // Le badge replié se déplie : son code et son image sont jugés aussi.
        await onglet.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
        expect(await violationsAxe(onglet)).toEqual([]);
        const debord = await onglet.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(debord, 'débordement horizontal').toBeLessThanOrEqual(0);
      });
    }

    test(`sans JavaScript, la page est la même, elle ne charge ${page.partage ? 'que partage.js' : 'aucun script'}, et sa politique de sécurité n’arrête rien`, async ({ browser }) => {
      const scripts = [];
      const refus = [];
      const lire = async (avecScript) => {
        const contexte = await browser.newContext({ javaScriptEnabled: avecScript, viewport: { width: 360, height: 800 } });
        const onglet = await contexte.newPage();
        onglet.on('request', (requete) => { if (requete.resourceType() === 'script') scripts.push(requete.url()); });
        onglet.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) refus.push(message.text()); });
        await onglet.goto(`${serveur.adresse}${page.chemin}`);
        // Le bloc « Partager » est le seul que JavaScript change (tests/partage.spec.mjs le suit avec et sans).
        expect(await onglet.locator('.partage').count()).toBe(page.partage ? 1 : 0);
        await onglet.locator('.partage').evaluateAll((blocs) => blocs.forEach((bloc) => bloc.remove()));
        const texte = await onglet.locator('main').innerText();
        const titre = await onglet.locator('h1').innerText();
        await contexte.close();
        return { texte, titre };
      };
      const sans = await lire(false);
      const avec = await lire(true);
      expect(sans).toEqual(avec);
      expect(sans.titre.length).toBeGreaterThan(0);
      // Et /mesure.js, si marque.json active la mesure d’audience (hors de baromatch.fr, elle ne compte rien).
      expect(scripts).toEqual([...(page.partage ? [`${serveur.adresse}/partage.js`] : []), ...(mesureDuSite().active ? [`${serveur.adresse}/mesure.js`] : [])]);
      expect(refus).toEqual([]);
    });

    test('chaque lien interne et chaque fichier de la page répondent, chaque ancre existe', async ({ page: onglet, request }) => {
      await onglet.goto(`${serveur.adresse}${page.chemin}`);
      const liens = await onglet.evaluate(() => [...document.querySelectorAll('a[href], link[href], img[src]')]
        .map((e) => e.getAttribute('href') ?? e.getAttribute('src')));
      const internes = [...new Set(liens)].filter((l) => l.startsWith('/') || l.startsWith('https://baromatch.fr/'));
      expect(internes.length).toBeGreaterThan(5);
      const casses = [];
      for (const lien of internes) {
        const url = new URL(lien.replace('https://baromatch.fr', serveur.adresse), `${serveur.adresse}${page.chemin}`);
        const reponse = await request.get(url.href.replace(url.hash, ''));
        if (reponse.status() !== 200) casses.push(`${lien} : ${reponse.status()}`);
        if (url.hash && url.hash.length > 1) {
          const html = await reponse.text();
          if (!html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) casses.push(`${lien} : ancre absente`);
        }
      }
      expect(casses).toEqual([]);
    });
  });
}

test('le badge d’un bar se dessine à 360 × 72', async ({ page: onglet }) => {
  await onglet.goto(`${serveur.adresse}/bar/le-zinc-des-amis-paris-11/`);
  await onglet.evaluate(() => { document.querySelector('details').open = true; });
  const image = onglet.locator('.regarder-badge__image');
  await expect(image).toBeVisible();
  expect(await image.evaluate((img) => [img.complete, img.naturalWidth, img.naturalHeight])).toEqual([true, 360, 72]);
});

test('les cibles de 44 px, le chevron du fil sans alternative lue, et la boîte du code à la taille du code', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  const mesurer = (selecteur) => onglet.locator(selecteur).evaluateAll((liens) => liens.map((a) => {
    const { width, height } = a.getBoundingClientRect();
    return { texte: a.textContent.trim(), width: Math.round(width), height: Math.round(height) };
  }));
  const tropPetits = (mesures, largeur = 0) => mesures.filter((m) => m.height < 44 || m.width < largeur);
  await onglet.goto(`${serveur.adresse}/matchs/psg-ol-2026-10-25/`);
  // Le fil : chaque lien fait au moins 44 px de large et de haut, et le chevron reste sur la ligne du lien qui le suit.
  expect(tropPetits(await mesurer('.regarder-fil a'), 44)).toEqual([]);
  expect(await onglet.locator('.regarder-fil li + li').first().evaluate((li) => getComputedStyle(li, '::before').content)).toBe('"›" / ""');
  for (const selecteur of ['.regarder-carte__nom a', '.regarder-matchs a']) expect(tropPetits(await mesurer(selecteur)), selecteur).toEqual([]);
  await onglet.goto(`${serveur.adresse}/regarder-le-match/paris/`);
  expect(tropPetits(await mesurer('.regarder-retour a'))).toEqual([]);
  await onglet.goto(`${serveur.adresse}/matchs/page-neutre/`);
  for (const selecteur of ['.regarder-fil a', '.regarder-matchs a']) expect(tropPetits(await mesurer(selecteur)), selecteur).toEqual([]);
  await onglet.goto(`${serveur.adresse}/bar/le-zinc-des-amis-paris-11/`);
  expect(await onglet.locator('.regarder-badge__code').evaluate((t) => getComputedStyle(t).fieldSizing)).toBe('content');
});

test('« Ce soir » au téléphone : le match, le bar et chaque lien seul se touchent sur 44 px', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  await onglet.goto(`${serveur.adresse}/ce-soir/`);
  await expect(onglet.locator('h1')).toHaveText('Où regarder le match ce soir');
  await expect(onglet.locator('.regarder-soir__match a')).toHaveText('Brest – Nice');
  await expect(onglet.locator('.regarder-carte__nom a')).toHaveText('La Cave des Gones');
  for (const selecteur of ['.regarder-soir__match a', '.regarder-carte__nom a', '.regarder-matchs a', '.regarder-suite a']) {
    const hauteurs = await onglet.locator(selecteur).evaluateAll((liens) => liens.map((a) => Math.round(a.getBoundingClientRect().height)));
    expect(hauteurs.length, selecteur).toBeGreaterThan(0);
    expect(hauteurs.filter((h) => h < 44), selecteur).toEqual([]);
  }
  // La semaine et une ville y mènent par un lien seul, lui aussi de 44 px.
  for (const chemin of ['/matchs/', '/regarder-le-match/paris/']) {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    const lien = onglet.locator('.regarder-suite a[href="/ce-soir/"]');
    await expect(lien, chemin).toHaveText('Où regarder le match ce soir');
    expect(Math.round((await lien.boundingBox()).height), chemin).toBeGreaterThanOrEqual(44);
  }
});

test('« Ton club dans ton agenda » : ses boutons et ses liens sur 44 px, chaque agenda servi en text/calendar, chaque lien webcal vers un agenda', async ({ page: onglet, request }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  const hauteurs = (selecteur) => onglet.locator(selecteur).evaluateAll((liens) => liens.map((a) => Math.round(a.getBoundingClientRect().height)));
  await onglet.goto(`${serveur.adresse}/agenda/`);
  for (const selecteur of ['.regarder-agenda__bouton', '.regarder-agenda__adresse a', '.regarder-retour a']) {
    const mesures = await hauteurs(selecteur);
    expect(mesures.length, selecteur).toBeGreaterThan(0);
    expect(mesures.filter((h) => h < 44), selecteur).toEqual([]);
  }
  const abonnements = await onglet.locator('a[href^="webcal:"]').evaluateAll((liens) => liens.map((a) => a.getAttribute('href')));
  const adresses = await onglet.locator('.regarder-agenda__adresse a').evaluateAll((liens) => liens.map((a) => a.getAttribute('href')));
  expect(abonnements).toHaveLength(10);
  expect(adresses).toEqual(abonnements.map((lien) => lien.replace('webcal:', 'https:')));
  for (const lien of abonnements) {
    const reponse = await request.get(lien.replace('webcal://baromatch.fr', serveur.adresse));
    expect(reponse.status(), lien).toBe(200);
    expect(reponse.headers()['content-type'], lien).toMatch(/^text\/calendar/);
    expect((await reponse.text()).startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'), lien).toBe(true);
  }
  // La page d’un match à venir : « Ajouter à mon agenda » (44 px), son fichier en text/calendar, l’agenda de ses clubs.
  await onglet.goto(`${serveur.adresse}/matchs/psg-ol-2026-10-25/`);
  const bouton = onglet.locator('.regarder-agenda__bouton');
  await expect(bouton).toHaveText('Ajouter à mon agenda');
  const boite = await bouton.boundingBox();
  expect(Math.round(boite.height)).toBeGreaterThanOrEqual(44);
  expect(Math.round(boite.width)).toBeGreaterThanOrEqual(44);
  expect((await hauteurs('.regarder-agenda__clubs a')).filter((h) => h < 44)).toEqual([]);
  const fichier = await request.get(`${serveur.adresse}${await bouton.getAttribute('href')}`);
  expect(fichier.status()).toBe(200);
  expect(fichier.headers()['content-type']).toMatch(/^text\/calendar/);
  // La page d’une ville y mène, par un lien seul de 44 px.
  await onglet.goto(`${serveur.adresse}/regarder-le-match/paris/`);
  const lien = onglet.locator('.regarder-suite a[href="/agenda/"]');
  await expect(lien).toHaveText('Ton club dans ton agenda');
  expect(Math.round((await lien.boundingBox()).height)).toBeGreaterThanOrEqual(44);
});

test('les pages en anglais au téléphone : le lien de langue, le fil, les matchs et les bars se touchent sur 44 px', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  const hauteurs = (selecteur) => onglet.locator(selecteur).evaluateAll((liens) => liens.map((a) => Math.round(a.getBoundingClientRect().height)));
  for (const [chemin, selecteurs] of [
    ['/en/', ['.regarder-langue a', '.regarder-matchs a', '.regarder-suite a', '.regarder-carte__nom a', '.regarder-carte__suite a']],
    ['/en/matches/psg-barca-2026-10-24/', ['.regarder-langue a', '.regarder-fil a', '.regarder-carte__nom a', '.regarder-matchs a', '.regarder-retour a']],
    ['/en/premier-league/', ['.regarder-fil a', '.regarder-retour a']],
    // Les jumelles en français mènent à leur version en anglais par un lien seul, lui aussi de 44 px.
    ['/regarder-le-match/paris/', ['.regarder-langue a']],
    ['/matchs/psg-barca-2026-10-24/', ['.regarder-langue a']],
  ]) {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    for (const selecteur of selecteurs) {
      const liste = await hauteurs(selecteur);
      expect(liste.length, `${chemin} ${selecteur}`).toBeGreaterThan(0);
      expect(liste.filter((h) => h < 44), `${chemin} ${selecteur}`).toEqual([]);
    }
  }
  // Le lien de langue dit sa langue (lang, hreflang) et mène à la jumelle.
  await onglet.goto(`${serveur.adresse}/regarder-le-match/paris/`);
  await expect(onglet.locator('.regarder-langue a')).toHaveText('English');
  expect(await onglet.locator('.regarder-langue a').evaluate((a) => [a.getAttribute('href'), a.lang, a.hreflang])).toEqual(['/en/', 'en', 'en']);
  await onglet.goto(`${serveur.adresse}/en/`);
  expect(await onglet.evaluate(() => [document.documentElement.lang, document.querySelector('.entete').lang, document.querySelector('.pied').lang])).toEqual(['en', 'fr', 'fr']);
  await expect(onglet.locator('.regarder-langue a')).toHaveText('Version française');
});
