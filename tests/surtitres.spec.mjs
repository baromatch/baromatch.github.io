// Les surtitres (la petite ligne au-dessus d’un titre : « Dans la version de test de l’appli », « Pour les bars »,
// « La boutique », le type d’une pièce de la boutique) et le cadre de chaque page (l’en-tête, le bandeau du bas, le pied
// en feuille de match) se lisent dans leur casse, et s’affichent comme ils se lisent.
//
// Écrit en capitales, ou mis en capitales par le style, un mot peut être épelé ou lu comme un sigle par un lecteur
// d’écran : Safari (VoiceOver) lit le texte que text-transform a transformé. L’arbre d’accessibilité de Chromium, lui,
// garde la casse du HTML même sous text-transform (vérifié : « Dans la version de test de l’appli » y reste tel quel) :
// il ne peut donc pas prouver ce que Safari lit, ni pour text-transform, ni pour des petites capitales que Chromium
// fabrique (Bricolage Grotesque n’en a pas). La correction sûre : la casse normale dans le HTML et à l’écran, sans
// text-transform ni petites capitales, et une autre mise en forme pour l’étiquette (petite, grasse, espacée, discrète),
// comme les surtitres des pages des matchs (.regarder-surtitre).
//
// Vérifié sur chaque page écrite à la main (toutes portent le cadre de cette navigation) : aucun texte affiché n’y est
// mis en capitales par le style ; les surtitres sont écrits en casse normale, exposés tels quels, affichés tels quels ;
// les titres du pied sont exposés tels qu’ils sont écrits. Hors de cette navigation, et laissée telle quelle : la tablée
// (/t/, servie par 404.html), que seule une tâche qui la nomme peut changer.
import { test, expect } from '@playwright/test';
import { PAGES_DU_CADRE } from '../generateur/cadre.mjs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { couperLAPI } from './outils/invitation.mjs';

// Les surtitres des pages de cette navigation, tels qu’ils sont écrits (la boutique écrit ses pièces par son script).
const SURTITRES = [
  { chemin: '/', selecteur: '.surtitre', textes: ['Dans la version de test de l’appli', 'Testeurs Android'] },
  { chemin: '/pour-les-bars.html', selecteur: '.etiquette', textes: ['Pour les bars'] },
  { chemin: '/boutique.html', selecteur: '.boutique-sur', textes: ['La boutique'] },
  { chemin: '/boutique.html', selecteur: '#boutique-grille .boutique-produit__type', textes: ['T-shirt', 'Sweat à capuche', 'Casquette brodée', 'Écharpe tricotée', 'Tote bag', 'Lot de 6'] },
];
const TITRES_DU_PIED = ['Les matchs', 'Clubs', 'Compétitions', 'Villes', 'Baromatch'];

const ouvrir = async (page, chemin) => {
  await couperLAPI(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(chemin);
  await attendreLaPageFinie(page);
  if (chemin === '/boutique.html') await expect(page.locator('#boutique-grille button').first()).toBeVisible();
};

for (const { chemin } of PAGES_DU_CADRE) {
  test(`${chemin} : aucun texte affiché n’est mis en capitales par le style`, async ({ page }) => {
    await ouvrir(page, chemin);
    const enCapitales = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .filter((e) => !e.closest('.tablee') && e.checkVisibility({ visibilityProperty: true })
        && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        && getComputedStyle(e).textTransform !== 'none')
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} « ${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)} » (${getComputedStyle(e).textTransform})`));
    expect(enCapitales).toEqual([]);
  });
}

for (const { chemin, selecteur, textes } of SURTITRES) {
  test(`${chemin}, ${selecteur} : écrit, exposé et affiché dans sa casse`, async ({ page }) => {
    await ouvrir(page, chemin);
    const surtitres = page.locator(selecteur);
    await expect(surtitres).toHaveCount(textes.length);
    for (const [i, texte] of textes.entries()) {
      const surtitre = surtitres.nth(i);
      // Écrit en casse normale : une minuscule au moins, aucun mot de plus d’une lettre tout en capitales.
      const ecrit = await surtitre.evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim());
      expect(ecrit).toBe(texte);
      expect(ecrit, 'une minuscule au moins').toMatch(/\p{Ll}/u);
      expect(ecrit.split(/[\s’']+/).filter((mot) => /^\p{Lu}{2,}$/u.test(mot)), 'un mot en capitales').toEqual([]);
      // Exposé tel qu’il est écrit (l’arbre d’accessibilité de Chromium).
      expect(await surtitre.ariaSnapshot()).toBe(`- paragraph: ${texte}`);
      // Affiché tel qu’il se lit : ni capitales par le style, ni petites capitales fabriquées.
      const style = await surtitre.evaluate((e) => ({ transformation: getComputedStyle(e).textTransform, capitales: getComputedStyle(e).fontVariantCaps }));
      expect(style).toEqual({ transformation: 'none', capitales: 'normal' });
    }
  });
}

test('le pied de page en feuille de match : ses titres exposés et affichés tels qu’ils sont écrits', async ({ page }) => {
  await ouvrir(page, '/cgu.html');
  const pied = page.locator('footer.pied');
  const titres = await pied.locator('h2').evaluateAll((liste) => liste.map((h) => ({
    texte: h.textContent.trim(), transformation: getComputedStyle(h).textTransform, capitales: getComputedStyle(h).fontVariantCaps,
  })));
  expect(titres).toEqual(TITRES_DU_PIED.map((texte) => ({ texte, transformation: 'none', capitales: 'normal' })));
  const arbre = await pied.ariaSnapshot();
  for (const titre of TITRES_DU_PIED) expect(arbre).toContain(`- heading "${titre}" [level=2]`);
});
