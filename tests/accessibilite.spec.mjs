// Chaque page passe axe (WCAG 2.0, 2.1 et 2.2, niveaux A et AA) sur téléphone et sur ordinateur, une fois finie (sur
// « Pour les bars », le formulaire et sa feuille arrivent après le premier écran). Une page de la liste qui n’a pas de
// fichier fait échouer le test (elle n’est pas sautée), sauf les liens de tablée, servis par 404.html.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { violationsAxe } from './outils/axe.mjs';
import { simulerFormspree } from './outils/formspree.mjs';
import { couperLAPI, simulerLInvitation } from './outils/invitation.mjs';
import { fichierDe, PAGES } from './outils/pages.mjs';

const LARGEURS = [360, 1280];

for (const page of PAGES) {
  for (const largeur of LARGEURS) {
    test(`${page.nom} à ${largeur} px : aucune violation axe`, async ({ page: onglet }) => {
      if (!page.chemin.startsWith('/t/')) expect(existsSync(fichierDe(page.chemin)), `${page.chemin} : aucun fichier ${fichierDe(page.chemin)}`).toBe(true);
      await couperLAPI(onglet);
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.emulateMedia({ reducedMotion: 'reduce' });
      await onglet.goto(page.chemin);
      // axe lit la page finie : plus rien ne se charge, et sur « Pour les bars » le formulaire est là.
      await onglet.waitForLoadState('networkidle');
      await attendreLaPageFinie(onglet);
      expect(await violationsAxe(onglet)).toEqual([]);
    });
  }
}

// Les états que la page n’a pas au chargement : la liste d’attente après l’inscription, la sélection de la boutique
// ouverte (avec une erreur, puis envoyée), l’invitation d’une tablée affichée.
for (const largeur of LARGEURS) {
  test(`états à ${largeur} px : liste d’attente inscrite, sélection ouverte et envoyée, invitation affichée, sans violation axe`, async ({ page: onglet }) => {
    await onglet.setViewportSize({ width: largeur, height: 800 });
    await onglet.emulateMedia({ reducedMotion: 'reduce' });
    await simulerFormspree(onglet);

    await onglet.goto('/');
    await onglet.locator('#attente-mail').fill('paul@gmail');
    await onglet.locator('#attente button[type="submit"]').click();
    expect(await violationsAxe(onglet), 'liste d’attente, adresse incomplète').toEqual([]);
    await onglet.locator('#attente-mail').fill('paul@gmail.com');
    await onglet.locator('#attente button[type="submit"]').click();
    await expect(onglet.locator('#attente-corriger')).toBeVisible();
    expect(await violationsAxe(onglet), 'liste d’attente, inscrite').toEqual([]);

    await onglet.goto('/boutique.html');
    await onglet.evaluate(() => localStorage.setItem('baromatch-boutique-v1', JSON.stringify([{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 1 }])));
    await onglet.reload();
    await onglet.locator('#barre-ouvrir').click();
    await onglet.locator('#panier-form button[type="submit"]').click();
    await expect(onglet.locator('#panier-retour')).not.toBeEmpty();
    expect(await violationsAxe(onglet), 'sélection, erreur').toEqual([]);
    await onglet.locator('#panier-mail').fill('paul@gmail.com');
    await onglet.locator('#panier-accord').check();
    await onglet.locator('#panier-form button[type="submit"]').click();
    await expect(onglet.locator('#panier-merci')).toBeVisible();
    expect(await violationsAxe(onglet), 'sélection envoyée').toEqual([]);

    await simulerLInvitation(onglet);
    await onglet.goto('/t/abcdefghjkmn');
    await expect(onglet.locator('#tablee-carte')).toBeVisible();
    expect(await violationsAxe(onglet), 'invitation affichée').toEqual([]);
  });
}

// Les envois qui échouent : leurs messages (avec le lien de secours dans la boutique) passent axe aussi.
test('états d’échec à 360 px : liste d’attente en panne, sélection refusée, tablée en panne, sans violation axe', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  await onglet.emulateMedia({ reducedMotion: 'reduce' });
  await simulerFormspree(onglet, 500);
  await onglet.goto('/');
  await onglet.locator('#attente-mail').fill('paul@gmail.com');
  await onglet.locator('#attente button[type="submit"]').click();
  await expect(onglet.locator('#attente-retour')).toContainText('contact@baromatch.fr');
  expect(await violationsAxe(onglet), 'liste d’attente en panne').toEqual([]);

  await onglet.goto('/boutique.html');
  await onglet.evaluate(() => localStorage.setItem('baromatch-boutique-v1', JSON.stringify([{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 1 }])));
  await onglet.reload();
  await onglet.locator('#barre-ouvrir').click();
  await onglet.locator('#panier-mail').fill('paul@gmail.com');
  await onglet.locator('#panier-accord').check();
  await onglet.locator('#panier-form button[type="submit"]').click();
  await expect(onglet.locator('#panier-retour a')).toBeVisible();
  expect(await violationsAxe(onglet), 'sélection pas partie').toEqual([]);

  await couperLAPI(onglet);
  await onglet.goto('/t/abcdefghjkmn');
  await expect(onglet.locator('#tablee-reessayer')).toBeVisible();
  expect(await violationsAxe(onglet), 'tablée en panne').toEqual([]);
});
