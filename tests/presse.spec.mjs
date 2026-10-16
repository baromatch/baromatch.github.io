// La page presse : ce qu’est Baromatch dit avec les mots de marque.json, ce qu’il n’est pas (ni paris sportifs, ni
// diffuseur, ni vente d’alcool), l’emplacement de l’histoire du fondateur laissé à Skander, les logos à télécharger,
// les captures, le film et le contact. Ses données structurées la relient à l’Organization de l’accueil.
// Le reste (référencement, liens, accessibilité, politique de sécurité, pied de page) vient de tests/outils/pages.mjs.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const PAGE = '/presse.html';
const ORIGINE = 'https://baromatch.fr';
const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();

test.use({ javaScriptEnabled: false });

test('Baromatch en bref : le slogan, la phrase et la description de marque.json, mot pour mot', async ({ page }) => {
  await page.goto(PAGE);
  const texte = normaliser(await page.locator('main').textContent());
  for (const cle of ['slogan', 'uneLigne', 'description']) expect(texte, cle).toContain(normaliser(MARQUE[cle]));
  // Vrai aujourd’hui : en test, Android, Paris, pas encore ouvert, gratuit pour les fans.
  if (!MARQUE.appli.ouverte) expect(texte).toContain('L’appli n’est pas encore ouverte au public, ni sur iPhone.');
  const fait = async (nom) => normaliser(await page.locator('.presse__faits > div').filter({ has: page.locator('dt', { hasText: nom }) }).locator('dd').textContent());
  expect(await fait('Pour les fans')).toMatch(/^Gratuit\./);
  expect(await fait('Aujourd’hui')).toMatch(/^En test sur Android, à Paris\./);
});

test('ce que Baromatch n’est pas : ni paris sportifs, ni diffuseur, ni vente d’alcool', async ({ page }) => {
  await page.goto(PAGE);
  const points = (await page.locator('#n-est-pas + ul > li > strong').allTextContents()).map(normaliser);
  expect(points).toEqual(['Pas un site de paris sportifs.', 'Pas un diffuseur.', 'Pas un vendeur d’alcool.']);
});

test('l’histoire du fondateur : un emplacement visible et marqué, pas un faux texte', async ({ page }) => {
  await page.goto(PAGE);
  const bloc = page.locator('#histoire + .presse__a-ecrire');
  await expect(bloc).toBeVisible();
  await expect(bloc.locator('.presse__a-ecrire-titre')).toHaveText('À écrire par Skander');
});

test('les logos : fond sombre, fond clair et icône, chacun en SVG et en PNG à télécharger', async ({ page }) => {
  await page.goto(PAGE);
  const fichiers = await page.$$eval('.presse__logo .presse__fichiers a', (liens) => liens.map((a) => [a.getAttribute('href'), a.hasAttribute('download')]));
  expect(fichiers).toEqual(['baromatch-logo-fond-sombre', 'baromatch-logo-fond-clair', 'baromatch-icone']
    .flatMap((nom) => [[`/presse/${nom}.svg`, true], [`/presse/${nom}.png`, true]]));
  // Chaque aperçu montre le SVG qu’on télécharge.
  const apercus = await page.$$eval('.presse__apercu img', (images) => images.map((img) => img.getAttribute('src')));
  expect(apercus).toEqual(['/presse/baromatch-logo-fond-sombre.svg', '/presse/baromatch-logo-fond-clair.svg', '/presse/baromatch-icone.svg']);
});

test('les captures et le film : des images légères chargées tard, le film à un clic', async ({ page }) => {
  await page.goto(PAGE);
  const captures = await page.$$eval('.presse__captures img', (images) => images.map((img) => ({
    src: img.getAttribute('src'), paresseuse: img.getAttribute('loading') === 'lazy', legende: img.closest('figure').querySelector('figcaption')?.textContent ?? '',
  })));
  expect(captures).toHaveLength(4);
  for (const capture of captures) {
    expect(capture.src).toMatch(/^\/presse\/capture-[a-z-]+\.webp$/);
    expect(capture.paresseuse, capture.src).toBe(true);
    expect(capture.legende.trim(), capture.src).not.toBe('');
  }
  await expect(page.locator('a.presse__film')).toHaveAttribute('href', '/baromatch-film-16x9.mp4');
  await expect(page.locator('a.presse__film img')).toHaveAttribute('src', '/baromatch-film-16x9.webp');
});

test('le contact presse : l’adresse de marque.json', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#contact + p a[href^="mailto:"]')).toHaveAttribute('href', `mailto:${MARQUE.contact}`);
});

test('données structurées : une page « à propos » de l’Organization de l’accueil, et son fil d’Ariane', async ({ page }) => {
  await page.goto('/');
  const accueil = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const organisation = accueil['@graph'].find((n) => n['@type'] === 'Organization');

  await page.goto(PAGE);
  const { '@graph': graphe } = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const fiche = graphe.find((n) => n['@type'] === 'AboutPage');
  const fil = graphe.find((n) => n['@type'] === 'BreadcrumbList');
  expect(fiche.about['@id']).toBe(organisation['@id']);
  expect(fiche.isPartOf['@id']).toBe(`${ORIGINE}/#site`);
  expect(fiche.breadcrumb['@id']).toBe(fil['@id']);
  expect(fiche.description).toBe(await page.locator('meta[name="description"]').getAttribute('content'));
  expect(fil.itemListElement.map((e) => [e.position, e.name, e.item])).toEqual([
    [1, 'Accueil', `${ORIGINE}/`],
    [2, 'Presse', `${ORIGINE}${PAGE}`],
  ]);
});
