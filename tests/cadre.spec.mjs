// Le cadre de chaque page (l’en-tête et le pied de page) vient d’une seule source, generateur/cadre.mjs :
// - chaque page écrite à la main a, entre ses repères, exactement ce que la source écrit (« npm run cadre ») ; une
//   retouche à la main de l’en-tête ou du pied est refusée ; les pages du générateur ont le même cadre, et, à la page où
//   l’on est et à l’action près, l’en-tête et le pied sont les mêmes partout ;
// - la page où l’on est le dit (aria-current), dans le menu et le pied, et se voit : la pilule pleine et le point ambre ;
// - « Préviens-moi » est dans l’en-tête des pages décidées, ambre si la page n’a pas déjà son bouton ambre, en contour
//   sinon (lu tel qu’il est peint) ;
// - la ligne d’état du pied suit marque.json (comme la pilule de l’accueil) ;
// - l’ancien cadre (les pages des matchs publiées avant cette navigation) reste en forme avec la feuille de style neuve ;
// - les contrastes, mesurés tels qu’ils sont peints, la nuit et au jour : 4,5:1 pour le texte, 3:1 pour le focus et les
//   bords.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  actionDeLaPage, ecrireLeCadre, entete, lireLeCadre, pageAvecLeCadre, PAGES_DU_CADRE, pageDuGenerateurAvecLAction, pied,
} from '../generateur/cadre.mjs';
import { pagesEcritesALaMain } from '../generateur/mesure.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { lireCouleur, poser, rapport } from './outils/contraste.mjs';
import { racine } from './outils/environnement.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';

const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');
const MARQUE = JSON.parse(lire('marque.json'));
const TEXTES = JSON.parse(lire('generateur/contenu/cadre.json'));
const ENTETE = /<header class="entete page"[^>]*>[\s\S]*?<\/header>/;
const PIED = /<footer class="pied page"[^>]*>[\s\S]*?<\/footer>/;
const MENU = ['/ce-soir/', '/matchs/', '/pour-les-bars.html', '/a-propos.html'];
const AMBRE = 'rgb(255, 177, 61)';
// Les pages écrites à la main qui portent « Préviens-moi » (décidé le 29 octobre) ; les autres n’en ont pas : l’accueil,
// « Pour les bars », les pages légales, la page introuvable.
const AVEC_L_ACTION = ['/a-propos.html', '/presse.html', '/comment-on-choisit-les-bars.html', '/trouver-un-bar-qui-diffuse-le-match.html', '/testeurs-android.html', '/boutique.html'];

// Le scénario inventé, en mémoire, avec l’encodeur des QR codes (les affiches à imprimer et la feuille du patron).
const { qr } = chargerLeQr();
const scenario = () => construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario(), qr });
const actionDe = (html) => {
  const trouve = html.match(ENTETE)[0].match(/class="entete__attente( entete__attente--contour)?"/);
  if (!trouve) return null;
  return trouve[1] ? 'contour' : 'ambre';
};
// Des couches de fond (de l’élément vers la page) posées l’une sur l’autre : la couleur que l’œil voit derrière.
const composer = (couches) => couches.map(lireCouleur).filter((c) => c.a > 0).reverse().reduce((dessous, couche) => poser(couche, dessous));
const pagesHtml = (pages) => pages.filter((p) => typeof p.contenu === 'string' && p.contenu.includes('<header class="entete page"'));
const courantsDe = (bloc) => [...bloc.matchAll(/href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
// L’en-tête et le pied, sans ce qui dépend de la page : la page où l’on est, l’action, la langue.
const commun = (bloc) => bloc.replace(/ aria-current="page"/g, '').replace(/\n *<a class="entete__attente[^\n]*/, '')
  .replace(/ lang="fr"/, '').replace(/\n *<p class="pied__langue"[^\n]*/, '');

// ---------- Une seule source ----------

test.describe('une seule source pour l’en-tête et le pied', () => {
  test('chaque page écrite à la main a, entre ses repères, le cadre de generateur/cadre.mjs', () => {
    expect(PAGES_DU_CADRE.map((p) => p.fichier).sort()).toEqual(pagesEcritesALaMain(racine));
    expect(ecrireLeCadre({ verifier: true }), 'lance « npm run cadre »').toEqual([]);
    for (const p of PAGES_DU_CADRE) {
      const html = lire(p.fichier);
      for (const repere of ['<!-- entete:debut -->', '<!-- entete:fin -->', '<!-- pied:debut -->', '<!-- pied:fin -->']) {
        expect(html.split(repere).length - 1, `${p.fichier} : ${repere}`).toBe(1);
      }
      expect(html.match(/<header class="entete page"/g), p.fichier).toHaveLength(1);
      expect(html.match(/<footer class="pied page"/g), p.fichier).toHaveLength(1);
    }
  });

  test('un en-tête ou un pied retouché à la main est refusé, et rendu tel que la source l’écrit', () => {
    const page = PAGES_DU_CADRE.find((p) => p.fichier === 'a-propos.html');
    const juste = lire(page.fichier);
    const retouches = [
      juste.replace('aria-current="page">À propos</a>', 'aria-current="page">Le projet</a>'),
      juste.replace('<a class="entete__attente" href="/#attente">', '<a class="entete__attente" href="/#attente" style="color:red">'),
      juste.replace('<li><a href="/boutique.html">Boutique</a></li>\n', ''),
      juste.replace('<p class="pied__etat">', '<p class="pied__etat">Ouvert · '),
    ];
    for (const retouche of retouches) {
      expect(retouche).not.toBe(juste);
      expect(pageAvecLeCadre(retouche, page, { marque: MARQUE })).toBe(juste);
    }
    expect(() => pageAvecLeCadre(juste.replace('<!-- pied:fin -->', ''), page, { marque: MARQUE })).toThrow(/pied:debut/);
  });

  test('les pages du générateur ont le même cadre : à la page où l’on est et à l’action près, le même partout', async () => {
    const cadre = lireLeCadre();
    const { pages } = await scenario();
    expect(pages.length).toBeGreaterThan(20);
    const ecrites = PAGES_DU_CADRE.map((p) => ({ chemin: p.chemin, html: lire(p.fichier) }));
    const generees = pagesHtml(pages);
    for (const p of generees) {
      const langue = p.langue ?? 'fr';
      const corps = p.contenu.slice(p.contenu.indexOf('<main'), p.contenu.indexOf('</main>'));
      const action = pageDuGenerateurAvecLAction(p.chemin) ? actionDeLaPage(corps) : null;
      expect(p.contenu.match(ENTETE)[0], p.chemin).toBe(entete(cadre, { chemin: p.chemin, action, langue }));
      expect(p.contenu.match(PIED)[0], p.chemin).toBe(pied(cadre, { marque: MARQUE, chemin: p.chemin, langue }));
    }
    const toutes = [...ecrites, ...generees.map((p) => ({ chemin: p.chemin, html: p.contenu }))];
    const [premiere] = toutes;
    for (const p of toutes) {
      expect(commun(p.html.match(ENTETE)[0]), `${p.chemin} : l’en-tête`).toBe(commun(premiere.html.match(ENTETE)[0]));
      expect(commun(p.html.match(PIED)[0]), `${p.chemin} : le pied`).toBe(commun(premiere.html.match(PIED)[0]));
    }
  });
});

// ---------- La page où l’on est ----------

test.describe('la page où l’on est', () => {
  test('aria-current sur son entrée du menu et sur son lien du pied, et seulement eux', async () => {
    const { pages } = await scenario();
    const toutes = [
      ...PAGES_DU_CADRE.map((p) => ({ chemin: p.chemin, html: lire(p.fichier) })),
      ...pagesHtml(pages).map((p) => ({ chemin: p.chemin, html: p.contenu })),
    ];
    const vus = new Set();
    for (const { chemin, html } of toutes) {
      const menu = courantsDe(html.match(ENTETE)[0]);
      expect(menu, chemin).toEqual(MENU.includes(chemin) ? [chemin] : []);
      if (menu.length) vus.add(chemin);
      const liensDuPied = [...html.match(PIED)[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      expect(courantsDe(html.match(PIED)[0]), chemin).toEqual(liensDuPied.filter((href) => href === chemin));
    }
    // Les quatre entrées ont chacune leur page, marquée.
    expect([...vus].sort()).toEqual([...MENU].sort());
  });

  for (const largeur of [390, 1280]) {
    test(`à ${largeur} px, la pilule pleine et le point ambre, la nuit comme au jour`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/a-propos.html');
      const lirePilule = () => page.evaluate(() => {
        const a = document.querySelector('.menu__lien[aria-current="page"]');
        const s = getComputedStyle(a);
        return { texte: a.textContent, fond: s.backgroundColor, couleur: s.color, point: getComputedStyle(a, '::before').backgroundColor, autres: [...document.querySelectorAll('.menu__lien:not([aria-current])')].map((l) => getComputedStyle(l).backgroundColor) };
      });
      const nuit = await lirePilule();
      expect(nuit.texte).toBe('À propos');
      expect(nuit.fond).toBe('rgb(247, 247, 249)');
      expect(nuit.point).toBe(AMBRE);
      expect(rapport(lireCouleur(nuit.couleur), lireCouleur(nuit.fond))).toBeGreaterThanOrEqual(4.5);
      for (const fond of nuit.autres) expect(fond).not.toBe(nuit.fond);
      // Une page passée au jour (<html class="jour">) : le bleu nuit.
      await page.evaluate(() => document.documentElement.classList.add('jour'));
      const jour = await lirePilule();
      expect(jour.fond).toBe('rgb(10, 11, 16)');
      expect(jour.point).toBe(AMBRE);
      expect(rapport(lireCouleur(jour.couleur), lireCouleur(jour.fond))).toBeGreaterThanOrEqual(4.5);
      expect(rapport(lireCouleur(jour.point), lireCouleur(jour.fond))).toBeGreaterThanOrEqual(3);
    });
  }
});

// ---------- L’action de l’en-tête ----------

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

test.describe('« Préviens-moi » dans l’en-tête', () => {
  let site = null;
  test.beforeAll(async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'cadre-'));
    site = { dossier };
    await construireLeSiteDExemple(dossier, { rendu: null });
    site.serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(async () => {
    await site?.serveur?.arreter();
    if (site) rmSync(site.dossier, { recursive: true, force: true });
  });

  test('sur les pages décidées, et seulement elles ; sur toutes les pages des matchs, sauf les affiches', async () => {
    for (const p of PAGES_DU_CADRE) {
      expect(actionDe(lire(p.fichier)) !== null, p.chemin).toBe(AVEC_L_ACTION.includes(p.chemin));
    }
    const { pages } = await scenario();
    const avecUnEntete = pagesHtml(pages);
    expect(avecUnEntete.some((p) => p.chemin.includes('/affiche/'))).toBe(true);
    for (const p of avecUnEntete) expect(actionDe(p.contenu) !== null, p.chemin).toBe(!p.chemin.includes('/affiche/'));
  });

  // Tel qu’il est peint : une page qui montre un bouton ambre (hors de l’en-tête et du pied) a « Préviens-moi » en
  // contour, sinon en ambre ; le contour se voit à 3:1, son texte à 4,5:1.
  const CHEMINS_GENERES = ['/matchs/', '/ce-soir/', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/', '/matchs/club/psg/', '/agenda/', '/en/'];
  for (const largeur of [390, 1280]) {
    for (const chemin of [...AVEC_L_ACTION, ...CHEMINS_GENERES]) {
      test(`${chemin} à ${largeur} px : ambre seulement si la page n’a pas déjà son bouton ambre`, async ({ page }) => {
        await couperLAPI(page);
        await page.setViewportSize({ width: largeur, height: 800 });
        await page.goto(CHEMINS_GENERES.includes(chemin) ? `${site.serveur.adresse}${chemin}` : chemin);
        await attendreLaPageFinie(page);
        // La boutique dessine ses pièces (et leurs boutons) par son script.
        if (chemin === '/boutique.html') await expect(page.locator('#boutique-grille button').first()).toBeVisible();
        const lu = await page.evaluate((ambre) => {
          const ambres = [...document.querySelectorAll('body *')].filter((e) => !e.closest('.entete, .pied, .lien-evitement')
            && getComputedStyle(e).backgroundColor === ambre && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
          const a = document.querySelector('.entete__attente');
          const s = getComputedStyle(a);
          const fonds = [];
          for (let n = a.parentElement; n; n = n.parentElement) {
            fonds.push(getComputedStyle(n).backgroundColor);
            if (/^rgb\(/.test(fonds.at(-1))) break;
          }
          return { ambres: ambres.map((e) => e.className || e.tagName), classe: a.className, fond: s.backgroundColor, couleur: s.color, bord: s.borderTopColor, largeurDuBord: s.borderTopWidth, fonds };
        }, AMBRE);
        const page_ = lu.fonds.map(lireCouleur).filter((c) => c.a > 0).reverse().reduce((dessous, couche) => poser(couche, dessous));
        if (lu.ambres.length) {
          expect(lu.classe, `la page a déjà ${lu.ambres.join(', ')}`).toBe('entete__attente entete__attente--contour');
          expect(lu.fond).toBe('rgba(0, 0, 0, 0)');
          expect(lu.largeurDuBord).toBe('1px');
          expect(rapport(poser(lireCouleur(lu.bord), page_), page_), 'le contour, à 3:1').toBeGreaterThanOrEqual(3);
          expect(rapport(lireCouleur(lu.couleur), page_), 'le texte, à 4,5:1').toBeGreaterThanOrEqual(4.5);
        } else {
          expect(lu.classe).toBe('entete__attente');
          expect(lu.fond).toBe(AMBRE);
          expect(rapport(lireCouleur(lu.couleur), lireCouleur(lu.fond))).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

// ---------- L’ancien cadre ----------

// Les pages des matchs publiées (dans le dépôt) avant cette navigation ont encore l’ancien en-tête (.entete__nav) et
// l’ancien pied (.pied__liens), jusqu’au premier passage de l’Action « Pages des matchs » qui les réécrit. Servies avec
// la feuille de style neuve, elles restent en forme : les liens de l’en-tête à droite du logo (l’ordinateur) ou à côté
// de lui (le téléphone), entiers, de 44 px de haut, lisibles, la nuit comme au jour ; le pied en ligne, ses liens sans
// puce et de 44 px de haut ; rien ne déborde de côté. Quand plus aucune page du dépôt ne les porte, ce test le dit :
// le bloc « Transition » de styles.css et ce test se retirent alors ensemble.
const ANCIENNES = (() => {
  const trouvees = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(path.join(racine, dossier), { withFileTypes: true })) {
      const relatif = path.join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(relatif);
      else if (entree.name === 'index.html' && readFileSync(path.join(racine, relatif), 'utf8').includes('<nav class="entete__nav"')) trouvees.push(`/${path.dirname(relatif)}/`);
    }
  };
  for (const dossier of ['matchs', 'ce-soir', 'regarder-le-match', 'agenda', 'en', 'bar']) {
    try { parcourir(dossier); } catch (erreur) { if (erreur.code !== 'ENOENT') throw erreur; }
  }
  return trouvees.sort();
})();
// Une page de chaque sorte : un match, « Ce soir », une ville, une page en anglais (son pied a une phrase de plus).
const ECHANTILLON = [/^\/matchs\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/$/, /^\/ce-soir\/$/, /^\/regarder-le-match\/[a-z-]+\/$/, /^\/en\/[a-z-]+\/$/]
  .map((forme) => ANCIENNES.find((c) => forme.test(c))).filter(Boolean);

test('l’ancien cadre : des pages du dépôt le portent encore (sinon, retire le bloc « Transition » de styles.css et ce test)', () => {
  expect(ANCIENNES.length, 'plus aucune page n’a l’ancien cadre : retire le bloc « Transition » de styles.css et ce test').toBeGreaterThan(0);
  expect(ECHANTILLON.length).toBeGreaterThan(0);
});

for (const chemin of ECHANTILLON) {
  for (const [largeur, hauteur] of [[340, 740], [390, 844], [1280, 800]]) {
    test(`l’ancien cadre de ${chemin} à ${largeur} px, avec la feuille de style neuve : en forme, la nuit comme au jour`, async ({ page }) => {
      await couperLAPI(page);
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.goto(chemin);
      await page.evaluate(() => document.fonts.ready);
      const mesurer = () => page.evaluate(() => {
        const boite = (e) => (({ left, right, top, bottom, width, height }) => ({ gauche: left, droite: right, haut: top, bas: bottom, largeur: width, hauteur: height }))(e.getBoundingClientRect());
        const fonds = (e) => {
          const couches = [];
          for (let n = e; n; n = n.parentElement) {
            const c = getComputedStyle(n).backgroundColor;
            couches.push(c);
            if (/^rgb\(/.test(c)) break;
          }
          return couches;
        };
        const entete = document.querySelector('header.entete');
        const s = getComputedStyle(entete);
        const nav = entete.querySelector('.entete__nav');
        const pied = document.querySelector('footer.pied');
        return {
          pageDefile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          entete: { ...boite(entete), dedansDroite: entete.getBoundingClientRect().right - parseFloat(s.paddingRight) },
          logo: boite(entete.querySelector('.entete__logo svg')),
          nav: boite(nav),
          liens: [...nav.querySelectorAll('a')].map((a) => ({ texte: a.textContent, ...boite(a), couleur: getComputedStyle(a).color, fonds: fonds(a) })),
          pied: { affichage: getComputedStyle(pied).display },
          liste: (({ listStyleType, paddingLeft, display }) => ({ listStyleType, paddingLeft, display }))(getComputedStyle(pied.querySelector('.pied__liens'))),
          liensDuPied: [...pied.querySelectorAll('.pied__liens a')].map((a) => ({ texte: a.textContent, ...boite(a), couleur: getComputedStyle(a).color, fonds: fonds(a) })),
          marque: getComputedStyle(pied.querySelector(':scope > .pied__marque')).fontSize === getComputedStyle(pied).fontSize,
          verre: pied.querySelector(':scope > .pied__marque svg').getBoundingClientRect().width,
        };
      });
      for (const moment of ['nuit', 'jour']) {
        if (moment === 'jour') await page.evaluate(() => document.documentElement.classList.add('jour'));
        const lu = await mesurer();
        expect(lu.pageDefile, `${moment} : la page défile de côté`).toBe(false);
        expect(lu.liens.map((l) => l.texte)).toEqual(['Boutique', 'Pour les bars']);
        for (const l of [...lu.liens, ...lu.liensDuPied]) {
          expect(l.hauteur, `${moment} : ${l.texte}, hauteur`).toBeGreaterThanOrEqual(44);
          expect(l.gauche, `${moment} : ${l.texte}, à gauche`).toBeGreaterThanOrEqual(0);
          expect(l.droite, `${moment} : ${l.texte}, à droite`).toBeLessThanOrEqual(largeur);
          const fond = composer(l.fonds);
          expect(rapport(poser(lireCouleur(l.couleur), fond), fond), `${moment} : ${l.texte}, contraste`).toBeGreaterThanOrEqual(4.5);
        }
        for (const l of lu.liens) {
          const dessus = l.gauche < lu.logo.droite && lu.logo.gauche < l.droite && l.haut < lu.logo.bas && lu.logo.haut < l.bas;
          expect(dessus, `${moment} : ${l.texte} sur le logo`).toBe(false);
        }
        // Les liens au bout de la ligne du logo, contre le bord droit de l’en-tête.
        expect(lu.nav.droite).toBeCloseTo(lu.entete.dedansDroite, 0);
        expect(lu.pied.affichage).toBe('flex');
        expect(lu.liste).toEqual({ listStyleType: 'none', paddingLeft: '0px', display: 'flex' });
        expect(lu.liensDuPied.length).toBeGreaterThanOrEqual(10);
        expect(lu.marque, 'le nom du pied à la taille du pied').toBe(true);
        expect(lu.verre).toBe(30);
      }
    });
  }
}

// ---------- La ligne d’état du pied ----------

test.describe('la ligne d’état du pied de page suit marque.json', () => {
  test('sur chaque page écrite à la main : celle de l’état de l’appli, la même que la pilule de l’accueil', () => {
    const etat = TEXTES.pied.etat[MARQUE.appli.ouverte ? 'ouverte' : 'fermee'];
    expect(etat).toBeTruthy();
    for (const p of PAGES_DU_CADRE) expect(lire(p.fichier).match(PIED)[0], p.fichier).toContain(`<p class="pied__etat">${etat}</p>`);
    expect(lire('index.html')).toContain(`<p class="ouverture__statut">${etat}</p>`);
  });

  test('l’appli ouverte : la phrase de l’appli ouverte, et aucune ligne tant qu’elle n’est pas écrite', async () => {
    const cadre = lireLeCadre();
    const ouverte = { ...MARQUE, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } };
    expect(pied(cadre, { marque: ouverte })).not.toContain('pied__etat');
    expect(pied(cadre, { marque: MARQUE })).toContain(`<p class="pied__etat">${TEXTES.pied.etat.fermee}</p>`);
    const avecPhrase = { ...cadre, textes: { ...cadre.textes, pied: { ...cadre.textes.pied, etat: { ...cadre.textes.pied.etat, ouverte: 'Ouvert à Paris' } } } };
    expect(pied(avecPhrase, { marque: ouverte })).toContain('<p class="pied__etat">Ouvert à Paris</p>');
    // Les pages du générateur, construites avec l’appli ouverte : plus la ligne « Pas encore ouvert ».
    const { pages } = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: { ...contenuDuScenario(), marque: ouverte } });
    for (const p of pagesHtml(pages)) expect(p.contenu.match(PIED)[0], p.chemin).not.toContain('pied__etat');
  });
});

// ---------- Les contrastes ----------

// Chaque couleur de l’en-tête et du pied, telle qu’elle est peinte, contre ce qui l’entoure : le texte à 4,5:1, le focus
// et les bords à 3:1. La nuit (une page fixe) et le jour (l’accueil), au téléphone (le bandeau) et à l’ordinateur.
const lireLesCouleurs = (page) => page.evaluate(() => {
  const fonds = (e) => {
    const couches = [];
    for (let n = e; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      couches.push(c);
      if (/^rgb\(/.test(c)) break;
    }
    return couches;
  };
  const elements = [
    ...document.querySelectorAll('.menu__lien, .entete__attente, .pied a, .pied h2, .pied__slogan, .pied__etat, .pied__legal p, .pied__marque span, .pied__contact p'),
  ].filter((e) => e.getClientRects().length > 0);
  return elements.map((e) => {
    const s = getComputedStyle(e);
    // Le focus : son contour, posé sur ce qui entoure l’élément (le contour est dehors, à 2 ou 3 px).
    e.focus({ preventScroll: true });
    const f = getComputedStyle(e);
    const focus = document.activeElement === e ? { couleur: f.outlineColor, largeur: f.outlineWidth, style: f.outlineStyle, fonds: fonds(e.parentElement) } : null;
    e.blur();
    return { quoi: `${e.className || e.tagName} « ${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)} »`, couleur: s.color, fonds: fonds(e), focus };
  });
});

for (const [nom, chemin] of [['la nuit (CGU)', '/cgu.html'], ['le jour (accueil)', '/'], ['la nuit, la page où l’on est (À propos)', '/a-propos.html']]) {
  for (const largeur of [390, 1280]) {
    test(`${nom} à ${largeur} px : le texte à 4,5:1, le focus et les bords à 3:1`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(chemin);
      // Le clavier d’abord : le contour du focus est celui du clavier (:focus-visible).
      await page.keyboard.press('Shift');
      const couleurs = await lireLesCouleurs(page);
      expect(couleurs.length).toBeGreaterThan(40);
      const faibles = [];
      for (const c of couleurs) {
        const fond = composer(c.fonds);
        const texte = rapport(poser(lireCouleur(c.couleur), fond), fond);
        if (texte < 4.5) faibles.push(`${c.quoi} : texte à ${texte.toFixed(2)}:1`);
        if (c.focus) {
          if (c.focus.style === 'none' || parseFloat(c.focus.largeur) < 2) faibles.push(`${c.quoi} : pas de contour de focus`);
          const autour = composer(c.focus.fonds);
          const anneau = rapport(poser(lireCouleur(c.focus.couleur), autour), autour);
          if (anneau < 3) faibles.push(`${c.quoi} : focus à ${anneau.toFixed(2)}:1`);
        }
      }
      expect(faibles).toEqual([]);
      // Les bords : le bandeau (ou la paire des matchs à l’ordinateur) contre la page.
      const bords = await page.evaluate(() => [...document.querySelectorAll('.menu__liste, .menu__matchs')]
        .map((e) => ({ s: getComputedStyle(e), e }))
        .filter(({ s }) => parseFloat(s.borderTopWidth) >= 1)
        .map(({ s, e }) => {
          const couches = [];
          for (let n = e.parentElement; n; n = n.parentElement) {
            const c = getComputedStyle(n).backgroundColor;
            couches.push(c);
            if (/^rgb\(/.test(c)) break;
          }
          return { quoi: e.className, bord: s.borderTopColor, dedans: s.backgroundColor, couches };
        }));
      expect(bords.length).toBeGreaterThan(0);
      for (const b of bords) {
        const page_ = composer(b.couches);
        expect(rapport(poser(lireCouleur(b.bord), poser(lireCouleur(b.dedans), page_)), page_), `${b.quoi} : son bord`).toBeGreaterThanOrEqual(3);
      }
    });
  }
}
