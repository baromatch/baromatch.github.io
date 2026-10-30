// L’en-tête de chaque page, la navigation « les matchs d’abord » : le logo (120 px au moins, le minimum de la marque),
// les quatre entrées dans cet ordre (« Ce soir » et « La semaine » en paire, « Pour les bars », « À propos »), sans
// chiffre, et « Préviens-moi » sur les pages qui le portent (tests/cadre.spec.mjs dit lesquelles). De 320 à 1280 px,
// chaque lien se voit en entier dans l’écran et se touche du doigt (WCAG 2.2, 2.5.8 : 24 × 24 px au moins ; on vise
// 44 px, notre minimum, dans les deux sens), aucun n’en recouvre un autre, et la page ne défile pas de côté. Sous 22 em
// (352 px), les entrées font une rangée sous le logo, dans la page ; au téléphone debout, un bandeau fixe en bas de
// l’écran ; dès 60 em (960 px), une seule ligne, qui ne suit pas la page. Avec un texte agrandi (125, 150, 200 %),
// tout passe à la ligne au lieu de déborder.
import { test, expect } from '@playwright/test';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';

const LARGEURS = [320, 340, 352, 360, 375, 390, 412, 768, 1024, 1280];
const TEXTES_AGRANDIS = [125, 150, 200];
const CIBLE = 44;
const LOGO_MINIMUM = 120;
const MENU = [['/ce-soir/', 'Ce soir'], ['/matchs/', 'La semaine'], ['/pour-les-bars.html', 'Pour les bars'], ['/a-propos.html', 'À propos']];
// Les pages sans « Préviens-moi » dans l’en-tête : l’accueil (il a le formulaire), « Pour les bars » (son action est
// « Proposer mon bar »), les pages légales, la page introuvable et le lien de tablée qu’elle sert.
const SANS_ACTION = new Set(['/', '/pour-les-bars.html', '/mentions-legales.html', '/cgu.html', '/confidentialite.html', '/supprimer-mon-compte.html', '/404.html', '/t/abcdefghjkmn']);

// Ce que l’en-tête montre : une boîte par lien (le logo, les entrées du menu, « Préviens-moi »), la place du menu, et
// le défilement de côté (de l’en-tête, puis de la page).
const lireLEntete = (onglet) => onglet.evaluate(() => {
  const entete = document.querySelector('.entete');
  const boite = (a) => {
    const r = a.getBoundingClientRect();
    return {
      nom: a.getAttribute('href'),
      texte: a.textContent.replace(/\s+/g, ' ').trim(),
      affiche: a.getClientRects().length > 0 && getComputedStyle(a).visibility !== 'hidden',
      gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom, largeur: r.width, hauteur: r.height,
    };
  };
  const menu = document.querySelector('.menu');
  return {
    enteteDefile: entete.scrollWidth > entete.clientWidth,
    pageDefile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    logo: entete.querySelector('.entete__logo svg').getBoundingClientRect().width,
    liens: [...entete.querySelectorAll('a')].map(boite),
    position: getComputedStyle(menu).position,
    menu: (({ top, bottom, height }) => ({ haut: top, bas: bottom, hauteur: height }))(menu.getBoundingClientRect()),
    hauteurEcran: innerHeight,
  };
});

const serecouvrent = (a, b) => a.gauche < b.droite - 0.5 && b.gauche < a.droite - 0.5 && a.haut < b.bas - 0.5 && b.haut < a.bas - 0.5;

const verifierLesLiens = (lu, largeur, chemin) => {
  const attendus = [['/', ''], ...MENU, ...(SANS_ACTION.has(chemin) ? [] : [['/#attente', 'Préviens-moi']])];
  expect(lu.liens.map((l) => [l.nom, l.texte])).toEqual(attendus);
  expect(lu.enteteDefile, 'l’en-tête défile de côté').toBe(false);
  expect(lu.logo, 'largeur du logo').toBeGreaterThanOrEqual(LOGO_MINIMUM);
  for (const lien of lu.liens) {
    expect(lien.affiche, `${lien.nom} : caché`).toBe(true);
    expect(lien.gauche, `${lien.nom} : sort à gauche`).toBeGreaterThanOrEqual(0);
    expect(lien.droite, `${lien.nom} : sort à droite`).toBeLessThanOrEqual(largeur);
    expect(lien.haut, `${lien.nom} : sort en haut`).toBeGreaterThanOrEqual(0);
    expect(lien.bas, `${lien.nom} : sort en bas`).toBeLessThanOrEqual(lu.hauteurEcran);
    expect(lien.largeur, `${lien.nom} : largeur`).toBeGreaterThanOrEqual(CIBLE);
    expect(lien.hauteur, `${lien.nom} : hauteur`).toBeGreaterThanOrEqual(CIBLE);
  }
  for (const [i, a] of lu.liens.entries()) {
    for (const b of lu.liens.slice(i + 1)) expect(serecouvrent(a, b), `${a.nom} et ${b.nom} se recouvrent`).toBe(false);
  }
};

for (const page of PAGES) {
  for (const largeur of LARGEURS) {
    test(`${page.nom} à ${largeur} px : le logo, les quatre entrées et l’action se voient en entier et se touchent du doigt`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.goto(page.chemin);
      const lu = await lireLEntete(onglet);
      verifierLesLiens(lu, largeur, page.chemin);
      expect(lu.pageDefile, 'la page défile de côté').toBe(false);
      const [logo, ...autres] = lu.liens;
      const menu = autres.slice(0, 4);
      if (largeur < 352) {
        // La rangée sous le logo, dans la page : « Ce soir » et « La semaine » sur un rang, puis les deux autres.
        expect(lu.position).toBe('static');
        for (const lien of menu) expect(lien.haut, `${lien.nom} sous le logo`).toBeGreaterThanOrEqual(logo.bas);
        expect(Math.abs(menu[0].haut - menu[1].haut), 'la paire des matchs sur un rang').toBeLessThan(1);
      } else if (largeur < 960) {
        // Le bandeau du bas, sur un rang, à 10 px du bord.
        expect(lu.position).toBe('fixed');
        expect(lu.hauteurEcran - lu.menu.bas, 'à 10 px du bas de l’écran').toBeCloseTo(10, 0);
        expect(lu.menu.hauteur, 'un seul rang').toBeLessThan(70);
        for (const lien of menu) expect(Math.abs(lien.haut - menu[0].haut), `${lien.nom} sur le rang`).toBeLessThan(1);
      } else {
        // Une seule ligne : chaque lien au milieu de la ligne du logo.
        expect(lu.position).toBe('static');
        for (const lien of autres) {
          expect(Math.abs((logo.haut + logo.bas) - (lien.haut + lien.bas)) / 2, `${lien.nom} au milieu de la ligne`).toBeLessThan(2);
          expect(lien.hauteur, `${lien.nom} sur une ligne`).toBeLessThan(CIBLE + 12);
        }
      }
    });
  }

  for (const pourcent of TEXTES_AGRANDIS) {
    for (const largeur of [320, 360, 412]) {
      test(`${page.nom} à ${largeur} px, texte à ${pourcent} % : l’en-tête passe à la ligne au lieu de déborder`, async ({ page: onglet }) => {
        await couperLAPI(onglet);
        await onglet.setViewportSize({ width: largeur, height: 800 });
        await onglet.goto(page.chemin);
        // Le réglage du navigateur « taille du texte » : par le style de l’élément, que la politique de la page admet.
        // Les media queries ne le voient pas : au-dessus de 352 px, le bandeau reste en bas et grandit de rangs.
        await onglet.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
        verifierLesLiens(await lireLEntete(onglet), largeur, page.chemin);
      });
    }
  }
}

// À l’ordinateur, l’en-tête reste en haut de la page : il ne la suit pas (rien de collant), et le menu non plus.
test('à 1280 px, l’en-tête ne suit pas la page', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 1280, height: 800 });
  await onglet.goto('/a-propos.html');
  await onglet.evaluate(() => window.scrollTo(0, 600));
  const { entete, menu } = await onglet.evaluate(() => ({
    entete: document.querySelector('.entete').getBoundingClientRect().bottom,
    menu: [getComputedStyle(document.querySelector('.menu')).position, getComputedStyle(document.querySelector('.entete')).position],
  }));
  expect(entete).toBeLessThan(0);
  expect(menu).toEqual(['static', 'static']);
});

// Le téléphone couché (844 × 390) : moins de 30 em de haut, les entrées restent une rangée sous le logo, dans la page,
// au lieu d’un bandeau qui mangerait l’écran.
test('le téléphone couché garde la rangée sous le logo', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 844, height: 390 });
  await onglet.goto('/a-propos.html');
  const lu = await lireLEntete(onglet);
  verifierLesLiens(lu, 844, '/a-propos.html');
  expect(lu.position).toBe('static');
});
