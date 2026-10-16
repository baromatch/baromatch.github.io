// Les pages générées, dans le navigateur : le scénario inventé construit dans un dossier temporaire (avec une copie du
// site autour, tests/outils/site-genere.mjs) et servi comme GitHub Pages le sert. Sur une page de ville, une page de
// match, la semaine et une page de bar : aucune violation d’axe à 360 et 1280 px, rien qui dépende de JavaScript,
// aucun débordement horizontal à 360 px, et chaque lien interne qui répond.
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { violationsAxe } from './outils/axe.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const PAGES = [
  { chemin: '/regarder-le-match/paris/', nom: 'ville avec des bars' },
  { chemin: '/matchs/psg-ol-2026-10-25/', nom: 'match avec des bars' },
  { chemin: '/matchs/lille-lens-2026-10-26/', nom: 'match sans bar' },
  { chemin: '/matchs/', nom: 'semaine' },
  { chemin: '/bar/le-zinc-des-amis-paris-11/', nom: 'bar' },
  { chemin: '/regarder-le-match/', nom: 'villes' },
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
  serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(() => {
  serveur?.arreter();
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

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

    test('sans JavaScript, la page est la même, elle n’en charge aucun, et sa politique de sécurité n’arrête rien', async ({ browser }) => {
      const scripts = [];
      const refus = [];
      const lire = async (avecScript) => {
        const contexte = await browser.newContext({ javaScriptEnabled: avecScript, viewport: { width: 360, height: 800 } });
        const onglet = await contexte.newPage();
        onglet.on('request', (requete) => { if (requete.resourceType() === 'script') scripts.push(requete.url()); });
        onglet.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) refus.push(message.text()); });
        await onglet.goto(`${serveur.adresse}${page.chemin}`);
        const texte = await onglet.locator('main').innerText();
        const titre = await onglet.locator('h1').innerText();
        await contexte.close();
        return { texte, titre };
      };
      const sans = await lire(false);
      const avec = await lire(true);
      expect(sans).toEqual(avec);
      expect(sans.titre.length).toBeGreaterThan(0);
      expect(scripts).toEqual([]);
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
