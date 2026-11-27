// axe (WCAG 2.0, 2.1 et 2.2, niveaux A et AA) sur l’accueil, « Ce soir », la page d’un match et « Pour les bars », aux trois
// tailles de la refonte : 390 × 664 (un téléphone sous les barres du navigateur), 390 × 844 et 1440 × 900. Les pages du
// générateur viennent du site d’exemple (le scénario inventé) : l’accueil y a sa carte du prochain match, ouverte aussi.
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { violationsAxe } from './outils/axe.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, MAINTENANT_DU_SCENARIO } from './outils/site-genere.mjs';

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});
const TAILLES = [[390, 664], [390, 844], [1440, 900]];
const PAGES = ['/', '/ce-soir/', '/matchs/psg-ol-2026-10-25/', '/pour-les-bars.html'];

const site = {};
test.beforeAll(async () => {
  site.dossier = mkdtempSync(path.join(tmpdir(), 'axe-trois-'));
  await construireLeSiteDExemple(site.dossier, { rendu: null, qr: null });
  site.serveur = await demarrerServeur(await portLibre(), -1, { dossier: site.dossier });
});
test.afterAll(async () => {
  await site.serveur?.arreter();
  rmSync(site.dossier, { recursive: true, force: true });
});

for (const chemin of PAGES) {
  for (const [largeur, hauteur] of TAILLES) {
    test(`${chemin} à ${largeur} × ${hauteur} : aucune violation axe`, async ({ page }) => {
      await couperLAPI(page);
      await page.clock.setFixedTime(new Date(MAINTENANT_DU_SCENARIO));
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${site.serveur.adresse}${chemin}`);
      await page.waitForLoadState('networkidle');
      await attendreLaPageFinie(page);
      expect(await violationsAxe(page)).toEqual([]);
      if (chemin === '/') {
        // La salle à 20:15 (ta place gardée, au geste) puis au coup d’envoi (les lumières baissées) : sans violation axe non plus.
        await page.locator('[data-maintiens]').click();
        await expect(page.locator('[data-statut]')).toHaveText('Place gardée. Ton rond ambre est dans la salle.');
        expect(await violationsAxe(page)).toEqual([]);
        await page.locator('#bars').scrollIntoViewIfNeeded();
        await expect(page.locator('.veillee')).toHaveAttribute('data-etat', '2100');
        expect(await violationsAxe(page)).toEqual([]);
      }
    });
  }
}

// Le plus petit téléphone (320 px), texte à 100 puis à 200 % : l’accueil, la salle au repos, ta place gardée puis le coup d’envoi, sans violation axe.
for (const pourcent of [100, 200]) {
  test(`/ à 320 × 700, texte à ${pourcent} % : aucune violation axe`, async ({ page }) => {
    await couperLAPI(page);
    await page.clock.setFixedTime(new Date(MAINTENANT_DU_SCENARIO));
    await page.setViewportSize({ width: 320, height: 700 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site.serveur.adresse}/`);
    await page.waitForLoadState('networkidle');
    await attendreLaPageFinie(page);
    await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
    expect(await violationsAxe(page)).toEqual([]);
    await page.locator('[data-maintiens]').click();
    await expect(page.locator('[data-statut]')).toHaveText('Place gardée. Ton rond ambre est dans la salle.');
    expect(await violationsAxe(page)).toEqual([]);
    await page.locator('#bars').scrollIntoViewIfNeeded();
    await expect(page.locator('.veillee')).toHaveAttribute('data-etat', '2100');
    expect(await violationsAxe(page)).toEqual([]);
  });
}
