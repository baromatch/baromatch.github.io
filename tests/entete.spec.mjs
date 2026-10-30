// L’en-tête de chaque page, la navigation « les matchs d’abord » : le logo (120 px au moins, le minimum de la marque),
// « Préviens-moi » sur les pages qui le portent (tests/cadre.spec.mjs dit lesquelles), puis les quatre entrées dans cet
// ordre (« Ce soir » et « La semaine » en paire, « Pour les bars », « À propos »), sans chiffre : c’est aussi l’ordre du
// clavier. De 320 à 1280 px, chaque lien se voit en entier dans l’écran et se touche du doigt (WCAG 2.2, 2.5.8 : 24 ×
// 24 px au moins ; on vise 44 px, notre minimum, dans les deux sens), aucun n’en recouvre un autre, et la page ne
// défile pas de côté. À l’arrivée, les entrées sont un rang sous le logo, dans la page : deux rangs de deux sous 22,5 em
// (360 px), un seul au téléphone (360 à 719 px), et une seule ligne avec le logo dès 60 em (960 px), qui ne suit pas la
// page. Au téléphone debout, le rang devient le bandeau du bas une fois sorti de l’écran par le haut, sans rien déplacer
// (tests/bandeau-du-bas.spec.mjs vérifie qu’il ne cache rien). Avec un texte agrandi (125, 150, 200 %), tout passe à la
// ligne au lieu de déborder. La police est attendue avant chaque mesure ; avec la police de secours (Bricolage pas
// encore arrivée), le rang du téléphone tient aussi sur une ligne, dans sa place.
import { test, expect } from '@playwright/test';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';

const LARGEURS = [320, 340, 352, 359, 360, 375, 390, 412, 600, 719, 720, 768, 1024, 1280];
const TEXTES_AGRANDIS = [125, 150, 200];
const CIBLE = 44;
const LOGO_MINIMUM = 120;
const MENU = [['/ce-soir/', 'Ce soir'], ['/matchs/', 'La semaine'], ['/pour-les-bars.html', 'Pour les bars'], ['/a-propos.html', 'À propos']];
const ACTION = ['/#attente', 'Préviens-moi quand Baromatch arrive'];
// Les pages sans « Préviens-moi » dans l’en-tête : l’accueil (il a le formulaire), « Pour les bars » (son action est
// « Proposer mon bar »), les pages légales, la page introuvable et le lien de tablée qu’elle sert.
const SANS_ACTION = new Set(['/', '/pour-les-bars.html', '/mentions-legales.html', '/cgu.html', '/confidentialite.html', '/supprimer-mon-compte.html', '/404.html', '/t/abcdefghjkmn']);

const ouvrir = async (onglet, chemin, largeur, hauteur = 800) => {
  await couperLAPI(onglet);
  await onglet.setViewportSize({ width: largeur, height: hauteur });
  await onglet.goto(chemin);
  await onglet.evaluate(() => document.fonts.ready);
};

// Ce que l’en-tête montre : une boîte par lien (le logo, « Préviens-moi », les entrées du menu), la place du menu, et
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
  const liste = document.querySelector('.menu__liste');
  return {
    enteteDefile: entete.scrollWidth > entete.clientWidth,
    pageDefile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    logo: entete.querySelector('.entete__logo svg').getBoundingClientRect().width,
    liens: [...entete.querySelectorAll('a')].map(boite),
    position: getComputedStyle(liste).position,
    menu: (({ top, bottom, height }) => ({ haut: top, bas: bottom, hauteur: height }))(liste.getBoundingClientRect()),
    hauteurEcran: innerHeight,
  };
});

const serecouvrent = (a, b) => a.gauche < b.droite - 0.5 && b.gauche < a.droite - 0.5 && a.haut < b.bas - 0.5 && b.haut < a.bas - 0.5;

const verifierLesLiens = (lu, largeur, chemin) => {
  const attendus = [['/', ''], ...(SANS_ACTION.has(chemin) ? [] : [ACTION]), ...MENU];
  expect(lu.liens.map((l) => [l.nom, l.texte])).toEqual(attendus);
  expect(lu.enteteDefile, 'l’en-tête défile de côté').toBe(false);
  expect(lu.logo, 'largeur du logo').toBeGreaterThanOrEqual(LOGO_MINIMUM);
  for (const lien of lu.liens) {
    expect(lien.affiche, `${lien.nom} : caché`).toBe(true);
    expect(lien.gauche, `${lien.nom} : sort à gauche`).toBeGreaterThanOrEqual(0);
    expect(lien.droite, `${lien.nom} : sort à droite`).toBeLessThanOrEqual(largeur);
    expect(lien.haut, `${lien.nom} : sort en haut`).toBeGreaterThanOrEqual(0);
    expect(lien.largeur, `${lien.nom} : largeur`).toBeGreaterThanOrEqual(CIBLE);
    expect(lien.hauteur, `${lien.nom} : hauteur`).toBeGreaterThanOrEqual(CIBLE);
  }
  for (const [i, a] of lu.liens.entries()) {
    for (const b of lu.liens.slice(i + 1)) expect(serecouvrent(a, b), `${a.nom} et ${b.nom} se recouvrent`).toBe(false);
  }
};

for (const page of PAGES) {
  for (const largeur of LARGEURS) {
    test(`${page.nom} à ${largeur} px : à l’arrivée, le logo, l’action et les quatre entrées se voient en entier et se touchent du doigt`, async ({ page: onglet }) => {
      await ouvrir(onglet, page.chemin, largeur);
      const lu = await lireLEntete(onglet);
      verifierLesLiens(lu, largeur, page.chemin);
      expect(lu.pageDefile, 'la page défile de côté').toBe(false);
      // À l’arrivée, rien de fixe : les entrées sont dans la page.
      expect(lu.position).toBe('static');
      const [logo] = lu.liens;
      const menu = lu.liens.slice(-4);
      if (largeur < 960) {
        // Le rang sous le logo : « Ce soir » et « La semaine » sur un rang ; au téléphone, les quatre sur le même.
        for (const lien of menu) expect(lien.haut, `${lien.nom} sous le logo`).toBeGreaterThanOrEqual(logo.bas);
        expect(Math.abs(menu[0].haut - menu[1].haut), 'la paire des matchs sur un rang').toBeLessThan(1);
        if (largeur >= 360 && largeur < 720) {
          for (const lien of menu) expect(Math.abs(lien.haut - menu[0].haut), `${lien.nom} sur le rang`).toBeLessThan(1);
          expect(lu.menu.hauteur, 'un seul rang').toBeLessThan(70);
        }
      } else {
        // Une seule ligne : chaque lien au milieu de la ligne du logo.
        for (const lien of lu.liens.slice(1)) {
          expect(Math.abs((logo.haut + logo.bas) - (lien.haut + lien.bas)) / 2, `${lien.nom} au milieu de la ligne`).toBeLessThan(2);
          expect(lien.hauteur, `${lien.nom} sur une ligne`).toBeLessThan(CIBLE + 12);
        }
      }
    });
  }

  for (const pourcent of TEXTES_AGRANDIS) {
    for (const largeur of [320, 360, 412]) {
      test(`${page.nom} à ${largeur} px, texte à ${pourcent} % : l’en-tête passe à la ligne au lieu de déborder`, async ({ page: onglet }) => {
        await ouvrir(onglet, page.chemin, largeur);
        // Le réglage du navigateur « taille du texte » : par le style de l’élément, que la politique de la page admet.
        // Les media queries ne le voient pas : au téléphone, le rang reste un rang et grandit.
        await onglet.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
        verifierLesLiens(await lireLEntete(onglet), largeur, page.chemin);
      });
    }
  }
}

// Au téléphone debout (400 px de haut au moins), une fois le rang sorti de l’écran par le haut, il devient le bandeau du
// bas (10 px au-dessus du bord) ; revenu en haut, il redevient le rang. La page ne bouge pas : la place du rang reste
// gardée sous le logo. Ailleurs (une tablette, l’ordinateur, le téléphone couché), rien ne devient fixe.
for (const [largeur, hauteur] of [[360, 740], [375, 548], [390, 844], [412, 915], [600, 900], [719, 800], [720, 900], [768, 1024], [1280, 800], [844, 390], [667, 375]]) {
  const bandeau = largeur >= 360 && largeur < 720 && hauteur >= 400;
  test(`à ${largeur} × ${hauteur} px, en faisant défiler : ${bandeau ? 'le rang devient le bandeau du bas, sans rien déplacer' : 'rien ne devient fixe'}`, async ({ page: onglet }) => {
    await ouvrir(onglet, '/a-propos.html', largeur, hauteur);
    const lire = () => onglet.evaluate(async () => {
      await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
      const liste = document.querySelector('.menu__liste');
      const r = liste.getBoundingClientRect();
      return { position: getComputedStyle(liste).position, bas: r.bottom, ecran: innerHeight, main: document.querySelector('main').getBoundingClientRect().top + scrollY };
    });
    const arrivee = await lire();
    expect(arrivee.position).toBe('static');
    await onglet.evaluate(() => window.scrollTo(0, document.querySelector('.menu').getBoundingClientRect().bottom + scrollY + 40));
    const loin = await lire();
    expect(loin.position).toBe(bandeau ? 'fixed' : 'static');
    if (bandeau) expect(loin.ecran - loin.bas, 'à 10 px du bas de l’écran').toBeCloseTo(10, 0);
    expect(loin.main, 'la page ne bouge pas').toBeCloseTo(arrivee.main, 0);
    await onglet.evaluate(() => window.scrollTo(0, 0));
    expect((await lire()).position).toBe('static');
  });
}

// En cours de lecture, les barres du navigateur qui reviennent (la hauteur passe de 659 à 548 px, puis à 480) : le
// bandeau reste en bas, à 10 px du bord.
test('les barres du navigateur qui reviennent en cours de lecture : le bandeau reste en bas', async ({ page: onglet }) => {
  await ouvrir(onglet, '/a-propos.html', 393, 659);
  await onglet.evaluate(() => window.scrollTo(0, document.querySelector('.menu').getBoundingClientRect().bottom + scrollY + 40));
  for (const hauteur of [659, 548, 480]) {
    await onglet.setViewportSize({ width: 393, height: hauteur });
    const lu = await onglet.evaluate(async () => {
      await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
      const liste = document.querySelector('.menu__liste');
      return { position: getComputedStyle(liste).position, bas: innerHeight - liste.getBoundingClientRect().bottom };
    });
    expect(lu.position, `${hauteur} px`).toBe('fixed');
    expect(lu.bas, `${hauteur} px`).toBeCloseTo(10, 0);
  }
});

// La police de secours de la page (avant que Bricolage Grotesque arrive, ou si elle n’arrive pas) : au téléphone, les
// quatre entrées tiennent sur un rang, dans la place gardée ; la page ne bouge donc pas quand la police arrive.
for (const largeur of [360, 375, 390, 412, 600, 719]) {
  test(`à ${largeur} px, avec la police de secours : les quatre entrées sur un rang, dans la place gardée`, async ({ page: onglet }) => {
    await onglet.route('**/fonts/*.woff2', (route) => route.abort());
    await ouvrir(onglet, '/a-propos.html', largeur);
    const lu = await onglet.evaluate(() => ({
      bricolage: [...document.fonts].filter((f) => f.family.includes('Bricolage Grotesque') && f.status === 'loaded').length,
      menu: document.querySelector('.menu').getBoundingClientRect().height,
      reserve: parseFloat(getComputedStyle(document.querySelector('.menu')).minHeight),
      hauts: [...document.querySelectorAll('.menu__lien')].map((a) => a.getBoundingClientRect().top),
      larges: [...document.querySelectorAll('.menu__lien')].map((a) => a.scrollWidth <= a.clientWidth),
    }));
    expect(lu.bricolage, 'Bricolage Grotesque ne s’est pas chargée').toBe(0);
    for (const haut of lu.hauts) expect(Math.abs(haut - lu.hauts[0]), 'un seul rang').toBeLessThan(1);
    expect(lu.larges, 'aucun mot ne déborde de son entrée').toEqual([true, true, true, true]);
    expect(lu.menu, 'dans la place gardée').toBe(lu.reserve);
  });
}

// La place gardée sous le logo, au téléphone, quelle que soit la taille du texte (un font-size sur <html>, que les media
// queries ne voient pas, comme le réglage du texte d’Android) : le rang y tient toujours (la page ne bouge pas quand il
// devient le bandeau du bas), et elle ne dépasse pas le rang de plus de 20 px au texte normal et à 200 %.
for (const largeur of [360, 390, 412, 576, 719]) {
  test(`à ${largeur} px, de 100 à 300 % de texte : le rang tient dans la place gardée, sans place perdue`, async ({ page: onglet }) => {
    await ouvrir(onglet, '/a-propos.html', largeur);
    for (const pourcent of [100, 112.5, 115, 116, 120, 125, 150, 175, 200, 225, 250, 275, 300]) {
      const lu = await onglet.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
        return {
          liste: document.querySelector('.menu__liste').getBoundingClientRect().height,
          menu: document.querySelector('.menu').getBoundingClientRect().height,
          reserve: parseFloat(getComputedStyle(document.querySelector('.menu')).minHeight),
        };
      }, pourcent);
      expect(lu.menu, `${pourcent} % : le rang (${lu.liste} px) dépasse la place gardée`).toBe(lu.reserve);
      if (pourcent === 100 || pourcent === 200) expect(lu.reserve - lu.liste, `${pourcent} % : place perdue`).toBeLessThanOrEqual(20);
    }
  });
}

// À l’ordinateur, l’en-tête reste en haut de la page : il ne la suit pas (rien de collant), et le menu non plus.
test('à 1280 px, l’en-tête ne suit pas la page', async ({ page: onglet }) => {
  await ouvrir(onglet, '/a-propos.html', 1280);
  await onglet.evaluate(() => window.scrollTo(0, 600));
  const { entete, positions } = await onglet.evaluate(() => ({
    entete: document.querySelector('.entete').getBoundingClientRect().bottom,
    positions: ['.menu', '.menu__liste', '.entete'].map((s) => getComputedStyle(document.querySelector(s)).position),
  }));
  expect(entete).toBeLessThan(0);
  expect(positions).toEqual(['static', 'static', 'static']);
});

// Le téléphone couché (844 × 390) : les entrées restent un rang sous le logo, dans la page.
test('le téléphone couché garde le rang sous le logo', async ({ page: onglet }) => {
  await ouvrir(onglet, '/a-propos.html', 844, 390);
  const lu = await lireLEntete(onglet);
  verifierLesLiens(lu, 844, '/a-propos.html');
  expect(lu.position).toBe('static');
});

// L’ordre du clavier suit l’écran : le lien d’évitement, le logo, « Préviens-moi » (en haut, à côté du logo), puis les
// quatre entrées.
test('l’ordre du clavier : le logo, « Préviens-moi », puis les quatre entrées', async ({ page: onglet }) => {
  await ouvrir(onglet, '/a-propos.html', 390, 844);
  await onglet.locator('.lien-evitement').focus();
  const ordre = [];
  for (let i = 0; i < 6; i += 1) {
    await onglet.keyboard.press('Tab');
    ordre.push(await onglet.evaluate(() => document.activeElement.getAttribute('href')));
  }
  expect(ordre).toEqual(['/', '/#attente', ...MENU.map(([href]) => href)]);
});
