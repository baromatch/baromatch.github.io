// Le bord des champs se voit (WCAG 2.2, 1.4.11 « contraste des éléments non textuels » : 3:1 au moins).
// Le champ de la liste d’attente (sur téléphone), sa pilule (dès 560 px) et les champs de la sélection de la
// boutique ont un bord blanc translucide : ce test calcule le contraste de ce bord, tel qu’il est peint, contre la
// surface qui entoure le champ. La case à cocher est dessinée par le navigateur : on lit ses pixels.
import { test, expect } from '@playwright/test';
import { lireCouleur, poser, rapport } from './outils/contraste.mjs';

const SEUIL = 3;

// Les couleurs dont dépend chaque bord, lues dans la page : le bord, le fond du champ (et s’il passe sous le bord),
// puis les fonds des parents, du plus proche au premier opaque.
const lireLesCouleurs = (page, selecteur) => page.evaluate((sel) => [...document.querySelectorAll(sel)]
  .filter((e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0)
  .map((e) => {
    const style = getComputedStyle(e);
    const parents = [];
    for (let n = e.parentElement; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none') throw new Error(`${n.tagName}.${n.className} : fond en image, que ce test ne lit pas`);
      parents.push(s.backgroundColor);
      if (/^rgb\(/.test(s.backgroundColor)) break;
    }
    return { champ: e.id || e.className, bord: style.borderTopColor, fond: style.backgroundColor, clip: style.backgroundClip, parents };
  }), selecteur);

// Le bord peint = sa couleur posée sur le fond du champ (le fond passe sous le bord, sauf `background-clip` plus
// étroit), posé sur la surface qui entoure le champ.
const mesurerLesBords = async (page, selecteur) => (await lireLesCouleurs(page, selecteur)).map((champ) => {
  const couches = champ.parents.map(lireCouleur).filter((c) => c.a > 0);
  if (!couches.length || couches[couches.length - 1].a !== 1) throw new Error('aucun fond opaque derrière le champ');
  const dehors = couches.reverse().reduce((dessous, couche) => poser(couche, dessous));
  const fond = champ.clip === 'border-box' ? poser(lireCouleur(champ.fond), dehors) : dehors;
  return { champ: champ.champ, bord: champ.bord, rapport: rapport(poser(lireCouleur(champ.bord), fond), dehors) };
});

const ouvrirLaSelection = (page) => page.evaluate(() => document.querySelector('dialog.panier').showModal());

// Le meilleur contraste, sur la ligne médiane, entre la surface (le pixel de la marge) et les pixels du bord de la case.
// Les pixels de la capture se lisent dans un onglet vierge : la politique de sécurité de la boutique refuse les images
// data: (et elle a raison).
const rapportDesPixelsDeLaCase = async (page) => {
  const boite = await page.locator('#panier-accord').boundingBox();
  const marge = 8;
  const image = await page.screenshot({ clip: { x: boite.x - marge, y: boite.y - marge, width: boite.width + 2 * marge, height: boite.height + 2 * marge } });
  const vierge = await page.context().newPage();
  const ligne = await vierge.evaluate(async (base64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const toile = document.createElement('canvas');
    toile.width = img.width;
    toile.height = img.height;
    const contexte = toile.getContext('2d');
    contexte.drawImage(img, 0, 0);
    return [...contexte.getImageData(0, Math.floor(img.height / 2), img.width, 1).data];
  }, image.toString('base64'));
  await vierge.close();
  const pixel = (x) => ({ r: ligne[x * 4], v: ligne[x * 4 + 1], b: ligne[x * 4 + 2], a: 1 });
  let meilleur = 1;
  for (let x = 1; x < marge + 4; x++) meilleur = Math.max(meilleur, rapport(pixel(x), pixel(0)));
  return meilleur;
};

test.describe('le bord des champs de la liste d’attente (accueil)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const largeur of [360, 559]) {
    test(`à ${largeur} px : le bord du champ e-mail contraste 3:1 avec la page`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/');
      const bords = await mesurerLesBords(page, '.attente__champ');
      expect(bords, 'le champ a un bord à cette largeur').toHaveLength(1);
      expect(bords[0].rapport, `bord ${bords[0].bord}`).toBeGreaterThanOrEqual(SEUIL);
    });
  }

  for (const largeur of [560, 1280]) {
    test(`à ${largeur} px : le bord de la pilule contraste 3:1 avec la page`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/');
      const bords = await mesurerLesBords(page, '.attente__ligne, .attente__champ');
      expect(bords.map((b) => b.champ), 'seule la pilule porte le bord à cette largeur').toEqual(['attente__ligne']);
      expect(bords[0].rapport, `bord ${bords[0].bord}`).toBeGreaterThanOrEqual(SEUIL);
    });
  }
});

test.describe('le bord des champs de la sélection (boutique)', () => {
  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px : le bord de chaque champ contraste 3:1 avec le panneau`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/boutique.html');
      await ouvrirLaSelection(page);
      const bords = await mesurerLesBords(page, '.panier__champ');
      expect(bords.map((b) => b.champ)).toEqual(['panier-prenom', 'panier-mail']);
      for (const bord of bords) expect(bord.rapport, `${bord.champ} : bord ${bord.bord}`).toBeGreaterThanOrEqual(SEUIL);
    });
  }

  test('la case de consentement se détache du panneau : 3:1 au moins (pixels dessinés par le navigateur)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/boutique.html');
    await ouvrirLaSelection(page);
    expect(await rapportDesPixelsDeLaCase(page)).toBeGreaterThanOrEqual(SEUIL);
  });
});

// Le formulaire de la page des bars reprend .panier__champ et pose un bord à 0,34 de blanc sur sa carte de verre.
// Le fond de nuit de .panier__champ s’arrête au bord (background-clip) : sans cela, il tirerait le bord peint à
// 2,6:1. Ce test lit le bord tel qu’il est peint, pour qu’un retour en arrière échoue.
test.describe('le bord des champs du formulaire des bars', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px : le bord de chacun des six champs contraste 3:1 avec la carte`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/pour-les-bars.html');
      const bords = await mesurerLesBords(page, '.formulaire .panier__champ');
      expect(bords.map((b) => b.champ)).toEqual(['demande-bar', 'demande-ville', 'demande-nom', 'demande-email', 'demande-telephone', 'demande-message']);
      for (const bord of bords) expect(bord.rapport, `${bord.champ} : bord ${bord.bord}`).toBeGreaterThanOrEqual(SEUIL);
    });
  }
});
