// Gratuit, combien de temps, comment supprimer son compte : un fan trouve les trois réponses en moins d’une minute.
// Le pied de page commun (tests/outils/pied.mjs) mène à « Supprimer mon compte » et dit que les règles de l’appli sont
// les CGU ; « L’essentiel » des règles dit combien de temps la place est gardée et comment supprimer son compte ;
// la page Confidentialité s’ouvre sur « En bref », avec des liens vers la durée de conservation, la suppression du
// compte et l’adresse à qui écrire. La page « Pour les bars » a le même pied de page que les autres.
import { test, expect } from '@playwright/test';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';
import { PIED } from './outils/pied.mjs';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();

for (const page of PAGES) {
  test(`${page.nom} : le pied de page mène à « Supprimer mon compte » et nomme les CGU`, async ({ page: onglet }) => {
    await couperLAPI(onglet);
    await onglet.goto(page.chemin);
    const liens = await onglet.$$eval('.pied__liens a', (a) => a.map((l) => [l.getAttribute('href'), l.textContent.replace(/\s+/g, ' ').trim()]));
    expect(liens).toEqual(PIED);
  });
}

test('les règles : « L’essentiel » dit combien de temps la place est gardée et comment supprimer son compte', async ({ page }) => {
  await page.goto('/cgu.html');
  const essentiel = page.locator('#essentiel + ul');
  const texte = normaliser(await essentiel.innerText());
  expect(texte).toContain('Baromatch est gratuit');
  expect(texte).toContain('Ta place est gardée jusqu’à 30 minutes après le coup d’envoi au plus, parfois moins selon le bar : l’heure exacte est écrite dans l’appli.');
  expect(texte).toContain('Tu peux supprimer ton compte quand tu veux, avec ou sans l’appli.');
  await expect(essentiel.locator('a[href="/supprimer-mon-compte.html"]')).toHaveText('avec ou sans l’appli');
});

// La correction d’une adresse dit seulement laquelle elle remplace : le propriétaire n’a pas dit qu’il effacerait
// l’ancienne (question encore ouverte), la page ne le promet donc pas. Le champ « remplace » ne fait que l’informer.
test('confidentialité : une adresse corrigée dit laquelle elle remplace, sans promettre d’effacer l’ancienne', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const texte = normaliser(await page.locator('main').innerText());
  expect(texte).toContain('Si tu corriges ton adresse ou ta ville juste après l’inscription, la nouvelle inscription dit quelle adresse elle remplace.');
  expect(texte).toContain('Si tu corriges ton adresse juste après l’envoi, le nouvel envoi dit quelle adresse il remplace.');
  expect(texte).not.toMatch(/efface(r)? l’ancienne/);
});

test('confidentialité : « En bref » en tête, avec la durée de conservation, la suppression du compte et à qui écrire', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/confidentialite.html');
  const titres = await page.$$eval('main h2', (h) => h.map((e) => e.id || e.textContent.trim()));
  expect(titres[0]).toBe('en-bref');
  await expect(page.locator('#en-bref')).toHaveText('En bref');
  const bref = page.locator('#en-bref + ul');
  const liens = await bref.locator('a').evaluateAll((a) => a.map((l) => [l.getAttribute('href'), l.textContent.trim()]));
  expect(liens).toEqual([
    ['#combien-de-temps', 'Combien de temps on garde tes données'],
    ['#liste-attente', 'ton adresse de la liste d’attente'],
    ['/supprimer-mon-compte.html', 'Supprimer ton compte'],
    ['mailto:confidentialite@baromatch.fr', 'confidentialite@baromatch.fr'],
  ]);
  await expect(page.locator('#combien-de-temps')).toHaveText('Combien de temps');
  // « En bref » se lit sans faire défiler longtemps : son haut est dans les deux premiers écrans.
  expect((await page.locator('#en-bref').boundingBox()).y).toBeLessThan(740 * 2);
  await bref.locator('a[href="#combien-de-temps"]').click();
  await expect(page.locator('#combien-de-temps')).toBeInViewport();
});
