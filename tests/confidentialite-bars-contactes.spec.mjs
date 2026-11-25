// La section « Les bars que nous contactons » de confidentialite.html : ce que Baromatch garde sur les bars qu'il
// démarche lui-même (prospection entre professionnels). Le texte est celui que le propriétaire a validé le 25 novembre
// 2026 : chaque point est comparé en entier, pour qu'une promesse en trop ou en moins fasse échouer le test.
import { test, expect } from '@playwright/test';

const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();

const POINTS = [
  'Ce qu’on garde : le nom du bar, ses coordonnées professionnelles publiques, et nos notes sur ses soirs de match.',
  'D’où ça vient : des pages publiques du bar (son site, ses réseaux, sa fiche sur les cartes en ligne).',
  'Pourquoi : te présenter Baromatch. Rien d’autre.',
  'Sur quelle base : notre intérêt légitime à présenter Baromatch à des professionnels, dans le cadre que fixe la CNIL pour la prospection entre professionnels : on ne te parle que de ton métier.',
  'Combien de temps : trois ans au plus après notre dernier contact, puis on efface.',
  'Pour refuser : réponds « non merci », ou écris à contact@baromatch.fr. On ne t’écrit plus. On garde seulement le nom du bar et ton refus, pour ne pas te recontacter.',
  'Tes droits : voir, corriger ou effacer ces données, à la même adresse. Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL sur cnil.fr.',
];

test('la section des bars contactés dit le texte validé, entre les demandes des bars et « Tes droits »', async ({ page }) => {
  await page.goto('/confidentialite.html#bars-contactes');
  await expect(page.locator('h2#bars-contactes')).toHaveText('Les bars que nous contactons');
  const ordre = await page.locator('main h2').evaluateAll((h) => h.map((e) => e.id));
  expect(ordre.indexOf('bars-contactes')).toBe(ordre.indexOf('bars') + 1);
  expect(ordre.indexOf('droits')).toBe(ordre.indexOf('bars-contactes') + 1);
  const points = (await page.locator('#bars-contactes + p + ul > li').allTextContents()).map(normaliser);
  expect(points).toEqual(POINTS);
  // Une seule adresse pour refuser ou exercer ses droits, et la CNIL en lien.
  const liens = await page.locator('#bars-contactes + p + ul a').evaluateAll((a) => a.map((l) => l.getAttribute('href')));
  expect(liens).toEqual(['mailto:contact@baromatch.fr', 'https://www.cnil.fr']);
});

test('l’introduction de la page mène à la section des bars contactés', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const intro = page.locator('main > h1 + .document__date + p');
  await expect(intro.locator('a[href="#bars-contactes"]')).toHaveText('les bars que nous contactons');
  await intro.locator('a[href="#bars-contactes"]').click();
  await expect(page.locator('#bars-contactes')).toBeInViewport();
});
