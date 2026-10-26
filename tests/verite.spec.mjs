// Ce que les pages de confiance affirment, vrai à la lettre : le film de l’accueil dit que ses bars et ses chiffres
// sont inventés (« Les captures … le disent ») ; une offre qui parle d’alcool ne s’affiche jamais sur le site (la page
// dit seulement « Une offre du bar dans l’appli ») et la mention santé l’accompagne dans l’appli ; « ni mise, ni cote,
// ni argent en jeu », comme llms.txt et la page presse ; le nom d’un bar parti reste dans l’adresse de sa page ; et
// aucune phrase datée qui deviendrait fausse le jour où un bar arrive.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');
const TEXTES = JSON.parse(lire('generateur/contenu/textes.json'));
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const CONFIANCE = '/comment-on-choisit-les-bars.html';
const MENTION_SANTE = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';

test.use({ javaScriptEnabled: false });

// Tant que l’appli n’est pas ouverte, aucun fan ne trouve un bar sur Baromatch : le guide, et la carte « Tu tiens un
// bar ? » des pages générées, disent ce qui est vrai, que Baromatch cherche ses premiers bars.
test('avant l’ouverture, ni le guide ni les pages générées ne disent aux bars que des fans les trouvent', async ({ page }) => {
  expect(JSON.parse(lire('marque.json')).appli.ouverte, 'l’appli est ouverte : relire ce que le guide et la carte des bars promettent').toBe(false);
  await page.goto('/trouver-un-bar-qui-diffuse-le-match.html');
  const bars = normaliser(await page.locator('#bars + p').textContent());
  expect(bars).toContain('Baromatch cherche ses premiers bars à Paris.');
  expect(bars).not.toMatch(/te trouvent|Annonce tes matchs/);
  expect(TEXTES.match.tuTiensUnBarSuite).toBe('Baromatch cherche ses premiers bars à Paris.');
});

// De même sur la page presse, que les journalistes citent : « Pour les bars » dit ce qui est vrai avant l’ouverture,
// avec les mots de la page des bars, et y mène toujours.
test('avant l’ouverture, la page presse ne dit pas que des fans trouvent les bars', async ({ page }) => {
  expect(JSON.parse(lire('marque.json')).appli.ouverte, 'l’appli est ouverte : relire ce que la page presse dit des bars').toBe(false);
  await page.goto('/presse.html');
  const bars = page.locator('.presse__faits > div').filter({ has: page.locator('dt', { hasText: 'Pour les bars' }) }).locator('dd');
  const texte = normaliser(await bars.textContent());
  expect(texte).toMatch(/^Baromatch cherche ses premiers bars à Paris\. Chaque bar choisit ses matchs et combien de places il ouvre\. /);
  expect(texte).not.toMatch(/trouvent|annoncent|gardées avant l’arrivée/);
  await expect(bars.locator('a')).toHaveAttribute('href', '/pour-les-bars.html');
});

// Les cartes de fin de page : « bientôt » pour les fans (le guide, À propos, Comment on choisit les bars), « ses premiers
// bars » pour les bars (À propos, Comment on choisit les bars ; sur le guide, le paragraphe de #bars, vérifié plus haut,
// le dit déjà). Vrai tant que l’appli n’est pas ouverte ; le jour où elle ouvre, ce test le rappelle.
test('avant l’ouverture, les cartes de fin de page disent « bientôt » aux fans et « ses premiers bars » aux bars', async ({ page }) => {
  expect(JSON.parse(lire('marque.json')).appli.ouverte, 'l’appli est ouverte : relire les cartes de fin de page').toBe(false);
  for (const [chemin, carteDesBars] of [['/trouver-un-bar-qui-diffuse-le-match.html', false], ['/a-propos.html', true], [CONFIANCE, true]]) {
    await page.goto(chemin);
    const fans = normaliser(await page.locator('.fin-de-page__carte:has(a[href="/#attente"])').textContent());
    expect(fans, chemin).toContain('Baromatch est en test sur Android, à Paris.');
    expect(fans, chemin).toContain('L’appli ouvre bientôt : préviens-moi');
    expect(fans, chemin).not.toMatch(/te trouvent|réserve ta place|garde ta place/i);
    if (!carteDesBars) continue;
    const bars = normaliser(await page.locator('.fin-de-page__carte:has(a[href="/pour-les-bars.html#proposer"])').textContent());
    expect(bars, chemin).toContain('Baromatch cherche ses premiers bars à Paris.');
    expect(bars, chemin).not.toMatch(/te trouvent|réserve ta place|garde ta place/i);
  }
});

test('le film de l’accueil dit que ses bars, ses places et ses chiffres sont inventés', async ({ page }) => {
  await page.goto('/');
  const note = normaliser(await page.locator('#film-note').innerText());
  expect(note).toContain('Ses bars, ses places et ses chiffres sont inventés.');
  // La page de confiance le promet pour chaque capture de l’appli.
  await page.goto(CONFIANCE);
  expect(normaliser(await page.locator('#accord + ul').textContent())).toContain('utilisent des bars et des pseudos inventés, et le disent');
});

test('une offre qui parle d’alcool : jamais affichée sur le site, la mention santé dans l’appli', async ({ page }) => {
  await page.goto(CONFIANCE);
  const boire = normaliser(await page.locator('#refus + ul > li', { hasText: 'Ce qui pousse à boire.' }).textContent());
  expect(boire).toContain(`Sur ce site, une offre de bar qui parle d’alcool ne s’affiche jamais : la page dit seulement « ${TEXTES.offre.dansLAppli} ».`);
  expect(boire).toContain(`Dans l’appli, une offre que le bar marque « contient de l’alcool » s’affiche avec, dessous : « ${MENTION_SANTE} »`);
  expect(boire).not.toContain('on écrit');
});

test('les paris : « ni mise, ni cote, ni argent en jeu », sur chaque page qui en parle, jamais « pronostic »', async ({ page }) => {
  for (const chemin of ['/a-propos.html', CONFIANCE, '/presse.html']) {
    await page.goto(chemin);
    const texte = normaliser(await page.locator('main').textContent());
    expect(texte, chemin).toMatch(/ni mise, ni cote, ni argent en jeu/i);
    expect(texte, chemin).not.toMatch(/pronostic/i);
  }
  expect(lire('llms.txt')).toContain('ni mise, ni cote, ni argent en jeu');
});

test('un bar parti : la page dit que son nom reste dans l’adresse, 30 jours', async ({ page }) => {
  await page.goto(CONFIANCE);
  const accord = normaliser(await page.locator('#accord + ul').textContent());
  expect(accord).toContain(`Sa page dit alors « ${TEXTES.bar.parti} » pendant 30 jours, puis disparaît.`);
  expect(accord).toContain('Son nom n’y est plus écrit, sauf dans l’adresse de la page.');
  expect(accord).not.toContain('sans son nom');
});

test('aucune phrase datée qui deviendrait fausse le jour où un bar arrive', async ({ page }) => {
  await page.goto(CONFIANCE);
  const texte = normaliser(await page.locator('main').textContent());
  expect(texte).not.toMatch(/aucun bar n’est encore publié/);
  expect(texte).not.toMatch(/\bAu \d{1,2}(?:er)? [a-zéû]+ \d{4}\b/);
});
