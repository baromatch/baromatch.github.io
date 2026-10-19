// La page introuvable (404.html), que GitHub Pages sert à toute adresse inconnue, même profonde : elle dit où trouver
// le match (« Ce soir », la semaine, chaque ville et toutes les villes), puis ramène à l’accueil. Chaque lien part de la
// racine, sinon il casserait sous /matchs/un-ancien-match/. Une ville de generateur/contenu/villes.json y a son lien.
// Le lien d’une tablée (/t/‹code›) passe par la même page : là, ces liens se cachent (tests/tablee.spec.mjs le reste).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { couperLAPI } from './outils/invitation.mjs';

const HTML = readFileSync(path.join(racine, '404.html'), 'utf8');
const VILLES = Object.entries(JSON.parse(readFileSync(path.join(racine, 'generateur', 'contenu', 'villes.json'), 'utf8')))
  .filter(([cle]) => !cle.startsWith('_'))
  .map(([cle, ville]) => ({ nom: ville.nom, chemin: `/regarder-le-match/${cle}/` }));
const ATTENDUS = [
  { nom: 'Les matchs de ce soir', chemin: '/ce-soir/' },
  { nom: 'Les matchs de la semaine', chemin: '/matchs/' },
  ...VILLES,
  { nom: 'Toutes les villes', chemin: '/regarder-le-match/' },
];

test('chaque lien et chaque fichier de la page partent de la racine (ou sont une adresse complète)', () => {
  const adresses = [...HTML.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  expect(adresses.length).toBeGreaterThan(10);
  expect(adresses.filter((a) => !/^(?:\/(?!\/)|https:\/\/|mailto:|#)/.test(a))).toEqual([]);
});

for (const adresse of ['/une-page-qui-n-existe-pas', '/matchs/un-ancien-match-2025-01-01/', '/bar/un/deux/trois/']) {
  test(`à ${adresse} : « Où regarder le match », « Ce soir », la semaine, chaque ville, puis l’accueil`, async ({ page }) => {
    const reponse = await page.goto(adresse);
    expect(reponse.status()).toBe(404);
    await expect(page.locator('h1:visible')).toHaveText('Cette page n’existe pas.');
    const liens = page.locator('nav.perdu__liens');
    await expect(liens).toBeVisible();
    await expect(liens).toHaveAccessibleName('Où regarder le match');
    const lus = await liens.locator('a').evaluateAll((as) => as.map((a) => ({ nom: a.textContent.trim(), chemin: a.getAttribute('href') })));
    expect(lus).toEqual(ATTENDUS);
    await expect(page.locator('a.perdu__accueil')).toHaveAttribute('href', '/');
    // Rien qui crie, et chaque lien se touche sur 44 px.
    expect(await page.locator('.perdu__introuvable').innerText()).not.toContain('!');
    for (const hauteur of await liens.locator('a').evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height))) {
      expect(hauteur).toBeGreaterThanOrEqual(44);
    }
  });
}

test('depuis une adresse profonde, chaque lien mène à une page qui répond', async ({ page, request }) => {
  await page.goto('/matchs/un-ancien-match-2025-01-01/');
  const cibles = await page.locator('nav.perdu__liens a, a.perdu__accueil').evaluateAll((as) => as.map((a) => a.href));
  expect(cibles).toHaveLength(ATTENDUS.length + 1);
  for (const cible of cibles) expect((await request.get(cible)).status(), cible).toBe(200);
  await page.locator('nav.perdu__liens a', { hasText: 'Les matchs de ce soir' }).click();
  await expect(page).toHaveURL(/\/ce-soir\/$/);
});

test('sur le lien d’une tablée, ces liens se cachent : seule l’invitation compte', async ({ page }) => {
  await couperLAPI(page);
  await page.goto('/t/abcdefghjkmn');
  await expect(page.locator('#tablee')).toBeVisible();
  await expect(page.locator('nav.perdu__liens')).toBeHidden();
});
