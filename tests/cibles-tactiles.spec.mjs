// Les cibles tactiles (WCAG 2.2, 2.5.8) : chaque lien, bouton et question dépliable se touche sur 24 × 24 px au
// moins, sauf un lien pris dans une phrase (l’exception « en ligne »). Les liens qui ne sont pas dans une phrase (pied
// de page, e-mail de la bande des bars, « Retirer » de la sélection) visent 44 px de haut, notre minimum.
// Chaque page est mesurée finie : sur « Pour les bars », le formulaire et sa feuille arrivent après le premier écran.
import { test, expect } from '@playwright/test';
import { PAGES } from './outils/pages.mjs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { couperLAPI, simulerLInvitation } from './outils/invitation.mjs';

const MINIMUM = 24;
const VISE = 44;
const LIENS_SEULS = ['.pied__liens a', '.bars__actions a', '.panier__retirer', '.tablee__plan', '.attente__corriger', '.panier__corriger'];

// Chaque cible visible, sa taille, et si c’est un lien pris dans une phrase (son parent dit plus que lui).
const lireLesCibles = (onglet) => onglet.evaluate((seuls) => [...document.querySelectorAll('a[href], button, summary')]
  .filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
    && !e.closest('.lien-evitement, .attente__piege, .formulaire__piege'))
  .map((e) => {
    const r = e.getBoundingClientRect();
    const parent = e.parentElement;
    return {
      nom: `${e.tagName.toLowerCase()} « ${(e.textContent.trim() || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40)} »`,
      largeur: r.width,
      hauteur: r.height,
      enLigne: e.tagName === 'A' && !!parent && parent.textContent.replace(/\s+/g, ' ').trim() !== e.textContent.replace(/\s+/g, ' ').trim()
        && !seuls.some((s) => e.matches(s)),
      seul: seuls.some((s) => e.matches(s)),
    };
  }), LIENS_SEULS);

const verifier = (cibles) => {
  const petites = cibles.filter((c) => !c.enLigne && (c.largeur < MINIMUM - 0.5 || c.hauteur < MINIMUM - 0.5))
    .map((c) => `${c.nom} : ${Math.round(c.largeur)} × ${Math.round(c.hauteur)} px`);
  expect(petites, `sous ${MINIMUM} × ${MINIMUM} px`).toEqual([]);
  const basses = cibles.filter((c) => c.seul && c.hauteur < VISE - 0.5).map((c) => `${c.nom} : ${Math.round(c.hauteur)} px de haut`);
  expect(basses, `liens seuls sous ${VISE} px de haut`).toEqual([]);
};

for (const page of PAGES) {
  for (const largeur of [360, 1280]) {
    test(`${page.nom} à ${largeur} px : chaque cible se touche sur 24 px au moins, les liens seuls sur 44 px`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.goto(page.chemin);
      // Sur « Pour les bars », les contrôles du formulaire n’existent qu’une fois la page finie.
      await attendreLaPageFinie(onglet);
      verifier(await lireLesCibles(onglet));
    });
  }
}

test('boutique : dans la sélection ouverte, « Retirer » et les boutons de quantité se touchent du doigt', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  await onglet.goto('/boutique.html');
  await onglet.evaluate(() => localStorage.setItem('baromatch-boutique-v1', JSON.stringify([{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 1 }])));
  await onglet.reload();
  await onglet.locator('#barre-ouvrir').click();
  await expect(onglet.locator('.panier__retirer')).toBeVisible();
  verifier(await lireLesCibles(onglet));
});

// Sur Android, la tablée ouverte a aussi « Ouvrir dans l’appli ».
test.describe('sur Android', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });

  test('tablée ouverte à 360 px : « Ouvrir dans l’appli » et chaque cible se touchent du doigt', async ({ page: onglet }) => {
    await simulerLInvitation(onglet);
    await onglet.setViewportSize({ width: 360, height: 800 });
    await onglet.goto('/t/abcdefghjkmn');
    await expect(onglet.locator('#tablee-ouvrir-lien')).toBeVisible();
    verifier(await lireLesCibles(onglet));
  });
});

for (const largeur of [360, 1280]) {
  test(`tablée ouverte à ${largeur} px : « Voir sur la carte » et chaque cible se touchent du doigt`, async ({ page: onglet }) => {
    await simulerLInvitation(onglet);
    await onglet.setViewportSize({ width: largeur, height: 800 });
    await onglet.goto('/t/abcdefghjkmn');
    await expect(onglet.locator('.tablee__plan')).toBeVisible();
    verifier(await lireLesCibles(onglet));
  });
}
