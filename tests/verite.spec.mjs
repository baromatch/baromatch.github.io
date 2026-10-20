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
