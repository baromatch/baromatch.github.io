// L’en-tête de chaque page : le logo (120 px au moins, le minimum de la marque) et les deux liens (Boutique, Pour les
// bars) restent visibles jusqu’à 320 px, sans faire défiler la page de côté, et chaque lien se touche du doigt
// (WCAG 2.2, 2.5.8 : 24 × 24 px au moins ; on vise 44 px, notre minimum). Avec un texte agrandi (125, 150, 200 %),
// l’en-tête passe sur deux lignes au lieu de déborder.
import { test, expect } from '@playwright/test';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';

const LARGEURS = [320, 340, 359, 360, 400, 1280];
const TEXTES_AGRANDIS = [125, 150, 200];
const CIBLE = 44;
const LOGO_MINIMUM = 120;

// Ce que l’en-tête montre : une boîte par lien, la largeur du logo dessiné, et le défilement de côté (de l’en-tête,
// puis de la page).
const lireLEntete = (onglet) => onglet.evaluate(() => {
  const entete = document.querySelector('.entete');
  const boite = (a) => {
    const r = a.getBoundingClientRect();
    return {
      nom: a.getAttribute('href'),
      affiche: a.getClientRects().length > 0 && getComputedStyle(a).visibility !== 'hidden',
      gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom, largeur: r.width, hauteur: r.height,
    };
  };
  return {
    enteteDefile: entete.scrollWidth > entete.clientWidth,
    pageDefile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    logo: entete.querySelector('.entete__logo svg').getBoundingClientRect().width,
    liens: [...entete.querySelectorAll('a')].map(boite),
  };
});

// Deux boîtes se recouvrent si elles partagent de la surface.
const serecouvrent = (a, b) => a.gauche < b.droite - 0.5 && b.gauche < a.droite - 0.5 && a.haut < b.bas - 0.5 && b.haut < a.bas - 0.5;

const verifierLesLiens = (lu, largeur) => {
  expect(lu.liens.map((l) => l.nom)).toEqual(['/', '/boutique.html', '/pour-les-bars.html']);
  expect(lu.enteteDefile, 'l’en-tête défile de côté').toBe(false);
  expect(lu.logo, 'largeur du logo').toBeGreaterThanOrEqual(LOGO_MINIMUM);
  for (const lien of lu.liens) {
    expect(lien.affiche, `${lien.nom} : caché`).toBe(true);
    expect(lien.gauche, `${lien.nom} : sort à gauche`).toBeGreaterThanOrEqual(0);
    expect(lien.droite, `${lien.nom} : sort à droite`).toBeLessThanOrEqual(largeur);
    expect(lien.largeur, `${lien.nom} : largeur`).toBeGreaterThanOrEqual(CIBLE);
    expect(lien.hauteur, `${lien.nom} : hauteur`).toBeGreaterThanOrEqual(CIBLE);
  }
  const [logo, boutique, bars] = lu.liens;
  expect(serecouvrent(logo, boutique), 'le logo et Boutique se recouvrent').toBe(false);
  expect(serecouvrent(logo, bars), 'le logo et Pour les bars se recouvrent').toBe(false);
  expect(serecouvrent(boutique, bars), 'Boutique et Pour les bars se recouvrent').toBe(false);
};

for (const page of PAGES) {
  for (const largeur of LARGEURS) {
    test(`${page.nom} à ${largeur} px : le logo et les deux liens se voient en entier et se touchent du doigt`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.setViewportSize({ width: largeur, height: 700 });
      await onglet.goto(page.chemin);
      const lu = await lireLEntete(onglet);
      verifierLesLiens(lu, largeur);
      expect(lu.pageDefile, 'la page défile de côté').toBe(false);
      // Au réglage normal, tout tient sur une ligne : les deux liens sont de même hauteur et à la même hauteur que le logo.
      const [logo, boutique, bars] = lu.liens;
      expect(boutique.hauteur, 'Boutique sur une ligne').toBeLessThan(CIBLE + 12);
      expect(bars.hauteur, 'Pour les bars sur une ligne').toBeLessThan(CIBLE + 12);
      expect(Math.abs(boutique.haut - bars.haut), 'les deux liens sur la même ligne').toBeLessThan(1);
      expect(Math.abs((logo.haut + logo.bas) - (boutique.haut + boutique.bas)) / 2, 'le logo au milieu de la ligne').toBeLessThan(1.5);
    });
  }

  for (const pourcent of TEXTES_AGRANDIS) {
    for (const largeur of [320, 360]) {
      test(`${page.nom} à ${largeur} px, texte à ${pourcent} % : l’en-tête passe à la ligne au lieu de déborder`, async ({ page: onglet }) => {
        await couperLAPI(onglet);
        await onglet.setViewportSize({ width: largeur, height: 700 });
        await onglet.goto(page.chemin);
        // Le réglage du navigateur « taille du texte » : par le style de l’élément, que la politique de la page admet.
        await onglet.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
        // Seul l’en-tête est jugé ici : d’autres parties des pages (liens du pied de page, titre de l’accueil, textes
        // longs) débordaient déjà à 200 %, avant ce lien.
        verifierLesLiens(await lireLEntete(onglet), largeur);
      });
    }
  }
}
