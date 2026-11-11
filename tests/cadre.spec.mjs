// Le cadre de chaque page (l’en-tête et le pied de page) vient d’une seule source, generateur/cadre.mjs :
// - chaque page écrite à la main a, entre ses repères, exactement ce que la source écrit (« npm run cadre ») ; une
//   retouche à la main de l’en-tête ou du pied est refusée ; les pages du générateur ont le même cadre, et, à la page où
//   l’on est et à l’action près, l’en-tête et le pied sont les mêmes partout ;
// - la page où l’on est le dit (aria-current), dans le menu et le pied, et se voit : la pilule pleine et son point, de la
//   couleur de son texte (l’ambre est pour l’action) ; dans le pied, elle est soulignée (pas seulement une couleur) ;
// - « Préviens-moi » est dans l’en-tête des pages décidées, ambre si la page n’a pas déjà son bouton ambre, en contour
//   sinon (lu tel qu’il est peint) ; il mène à la liste d’attente de la page quand elle en a une (une ville) ;
// - le pied : ses deux actions, « Presse et partenariats » vers la page Presse, l’adresse e-mail soulignée ;
// - la ligne d’état du pied suit marque.json (comme la pilule de l’accueil) ;
// - l’ancien cadre (les pages des matchs publiées avant cette navigation) reste en forme avec la feuille de style neuve ;
// - les contrastes, mesurés tels qu’ils sont peints, la nuit et au jour : 4,5:1 pour le texte, 3:1 pour le focus et les
//   bords.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  actionDeLaPage, cibleDeLAction, ecrireLeCadre, entete, lireLeCadre, pageAvecLeCadre, PAGES_DU_CADRE, pageDuGenerateurAvecLAction, pied,
} from '../generateur/cadre.mjs';
import { insigne } from '../generateur/insigne.mjs';
import { pagesEcritesALaMain } from '../generateur/mesure.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { echapper } from '../generateur/texte.mjs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { bordsTropFaibles, mesurerLesBords } from './outils/bords-peints.mjs';
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
      juste.replace(/(<a class="entete__attente[^"]*" href="\/#attente")>/, '$1 style="color:red">'),
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
      expect(p.contenu.match(ENTETE)[0], p.chemin).toBe(entete(cadre, { chemin: p.chemin, action, cible: cibleDeLAction(corps), langue }));
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
    test(`à ${largeur} px, la pilule pleine et son point de la couleur du texte (pas l’ambre de l’action), la nuit comme au jour`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/a-propos.html');
      const lirePilule = () => page.evaluate(() => {
        const a = document.querySelector('.menu__lien[aria-current="page"]');
        const s = getComputedStyle(a);
        return { texte: a.textContent, fond: s.backgroundColor, couleur: s.color, point: getComputedStyle(a, '::before').backgroundColor, autres: [...document.querySelectorAll('.menu__lien:not([aria-current])')].map((l) => getComputedStyle(l).backgroundColor) };
      });
      // À propos est au jour (<html class="jour">) : la nuit se lit en retirant la classe, le jour en la remettant.
      await page.evaluate(() => document.documentElement.classList.remove('jour'));
      const nuit = await lirePilule();
      expect(nuit.texte).toBe('À propos');
      expect(nuit.fond).toBe('rgb(247, 247, 249)');
      expect(nuit.point).toBe(nuit.couleur);
      expect(nuit.point).not.toBe(AMBRE);
      expect(rapport(lireCouleur(nuit.couleur), lireCouleur(nuit.fond))).toBeGreaterThanOrEqual(4.5);
      for (const fond of nuit.autres) expect(fond).not.toBe(nuit.fond);
      // Une page passée au jour (<html class="jour">) : le bleu nuit.
      await page.evaluate(() => document.documentElement.classList.add('jour'));
      const jour = await lirePilule();
      expect(jour.fond).toBe('rgb(10, 11, 16)');
      expect(jour.point).toBe(jour.couleur);
      expect(jour.point).not.toBe(AMBRE);
      expect(rapport(lireCouleur(jour.couleur), lireCouleur(jour.fond))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// Le contraste élevé de Windows (couleurs forcées, thème sombre et clair), la nuit (À propos) et le jour (l’accueil, qui
// n’a pas de page courante dans le menu ; « La semaine » y est essayée) : la page où l’on est se distingue sans couleur
// (soulignée), son focus se voit (l’image du menu change quand elle le prend), et le mot du logo prend la couleur du
// texte (pas noir sur noir).
for (const schema of ['dark', 'light']) {
  for (const largeur of [390, 1280]) {
    test(`couleurs forcées (${schema === 'dark' ? 'sombre' : 'clair'}) à ${largeur} px : la page où l’on est soulignée, son focus visible, le logo lisible`, async ({ browser }) => {
      const contexte = await browser.newContext({ viewport: { width: largeur, height: 800 }, forcedColors: 'active', colorScheme: schema });
      try {
        const onglet = await contexte.newPage();
        for (const chemin of ['/a-propos.html', '/']) {
          await couperLAPI(onglet);
          await onglet.goto(chemin);
          await onglet.evaluate(() => document.fonts.ready);
          const lu = await onglet.evaluate(() => {
            const mot = document.querySelector('.entete__logo path[fill="#F7F7F9"]');
            const courant = document.querySelector('.menu__lien[aria-current="page"]');
            return { fond: getComputedStyle(document.body).backgroundColor, mot: getComputedStyle(mot).fill, trait: courant ? getComputedStyle(courant).textDecorationLine : null };
          });
          expect(rapport(lireCouleur(lu.mot), lireCouleur(lu.fond)), `${chemin} : le mot du logo sur le fond`).toBeGreaterThanOrEqual(4.5);
          if (chemin === '/a-propos.html') expect(lu.trait, 'la page où l’on est, soulignée').toBe('underline');
          const lien = onglet.locator(chemin === '/' ? '.menu__lien[href="/matchs/"]' : '.menu__lien[aria-current="page"]');
          const menu = onglet.locator('.menu__liste');
          const sans = await menu.screenshot({ animations: 'disabled' });
          await onglet.keyboard.press('Shift');
          await lien.focus();
          expect(await lien.evaluate((a) => a.matches(':focus-visible'))).toBe(true);
          const avec = await menu.screenshot({ animations: 'disabled' });
          expect(avec.equals(sans), `${chemin} : le focus ne se voit pas`).toBe(false);
          await lien.blur();
        }
      } finally {
        await contexte.close();
      }
    });
  }
}

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

  test('sur les pages décidées, et seulement elles ; sur toutes les pages des matchs, sauf les affiches et les pages en anglais', async () => {
    for (const p of PAGES_DU_CADRE) {
      expect(actionDe(lire(p.fichier)) !== null, p.chemin).toBe(AVEC_L_ACTION.includes(p.chemin));
    }
    const { pages } = await scenario();
    const avecUnEntete = pagesHtml(pages);
    expect(avecUnEntete.some((p) => p.chemin.includes('/affiche/'))).toBe(true);
    for (const p of avecUnEntete) expect(actionDe(p.contenu) !== null, p.chemin).toBe(!p.chemin.includes('/affiche/') && !p.chemin.startsWith('/en/'));
  });

  // Une page en anglais a sa liste d’attente en anglais (« Notify me ») : l’en-tête, resté en français, n’y ajoute pas
  // un « Préviens-moi » en tête de page.
  test('aucune page en anglais n’a « Préviens-moi » dans son en-tête', async () => {
    const { pages } = await scenario();
    const enAnglais = pagesHtml(pages).filter((p) => p.chemin.startsWith('/en/'));
    expect(enAnglais.length, 'des pages en anglais').toBeGreaterThan(3);
    expect(enAnglais.filter((p) => actionDe(p.contenu) !== null).map((p) => p.chemin)).toEqual([]);
    for (const p of enAnglais) expect(p.contenu, p.chemin).toContain('id="attente"');
  });

  // Une page qui a sa propre liste d’attente (une ville) : « Préviens-moi » mène à elle, sur la page ; ailleurs, à celle
  // de l’accueil. Son nom dit de quoi on est prévenu.
  test('vers la liste d’attente de la page quand elle en a une, sinon vers celle de l’accueil', async () => {
    const lien = (html) => html.match(ENTETE)[0].match(/<a class="entete__attente[^"]*" href="([^"]+)">([\s\S]*?)<\/a>/);
    const { pages } = await scenario();
    const toutes = [
      ...PAGES_DU_CADRE.map((p) => ({ chemin: p.chemin, html: lire(p.fichier) })),
      ...pagesHtml(pages).map((p) => ({ chemin: p.chemin, html: p.contenu })),
    ].filter((p) => lien(p.html));
    const avecSaListe = toutes.filter((p) => /<form\b[^>]*\bid="attente"/.test(p.html)).map((p) => p.chemin);
    expect(avecSaListe).toContain('/regarder-le-match/paris/');
    for (const p of toutes) {
      const [, cible, nom] = lien(p.html);
      expect(cible, p.chemin).toBe(avecSaListe.includes(p.chemin) ? '#attente' : '/#attente');
      expect(nom.replace(/<[^>]+>/g, ''), p.chemin).toBe(`${TEXTES.action}${TEXTES.actionSuite}`);
    }
    expect(`${TEXTES.action}${TEXTES.actionSuite}`).toBe('Préviens-moi quand Baromatch arrive');
  });

  // Tel qu’il est peint : une page qui montre un bouton ambre (hors de l’en-tête et du pied) a « Préviens-moi » en
  // contour, sinon en ambre ; le contour se voit à 3:1, son texte à 4,5:1.
  const CHEMINS_GENERES = ['/matchs/', '/ce-soir/', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/', '/matchs/club/psg/', '/agenda/'];
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

// ---------- Les clubs du pied ----------

// Chaque club du pied : l’insigne de l’appli (generateur/insigne.mjs) à 24 px, sur la nuit du pied (il est de nuit sur
// chaque page, même au jour), décoratif, fait de formes, devant le nom écrit ; plus aucun disque. Ses identifiants
// prennent « pied- » devant : une page qui dessine aussi le club (Monaco, dont l’insigne a une découpe à 24 px comme à
// 30 px) garde un pied identique à celui des autres pages, et chaque identifiant n’y sert qu’une fois.
test.describe('les clubs du pied de page', () => {
  test('l’insigne de l’appli à 24 px, sur la nuit, devant le nom ; ses identifiants à part', () => {
    const cadre = lireLeCadre();
    expect(cadre.clubs.length).toBeGreaterThan(5);
    const html = pied(cadre, { marque: MARQUE });
    const liens = [...html.matchAll(/<a class="pied__club" href="\/matchs\/club\/([^/]+)\/">([\s\S]*?)<\/a>/g)];
    expect(liens.map(([, cle]) => cle)).toEqual(cadre.clubs.map((c) => c.cle));
    for (const [i, [, cle, dedans]] of liens.entries()) {
      const { nom } = cadre.clubs[i];
      // Le dessin de l’appli, à l’identifiant près.
      expect(dedans.replace(/( id="|url\(#)pied-/g, '$1'), cle).toBe(`${insigne({ cle, nom }, { taille: 24, fond: 'night' })}${echapper(nom)}`);
      expect(dedans, cle).toMatch(/^<svg class="insigne" width="24" height="24" viewBox="0 0 200 200" aria-hidden="true" focusable="false">(?:(?!<svg)[\s\S])*<\/svg>[^<]+$/);
      expect(dedans, cle).not.toMatch(/<image|href=|<text|<title|style=/);
      for (const [, id] of dedans.matchAll(/ id="([^"]+)"/g)) expect(id, cle).toMatch(/^pied-ib-f-/);
      for (const [, cible] of dedans.matchAll(/url\(#([^)]+)\)/g)) expect(cible, cle).toMatch(/^pied-ib-f-/);
    }
    // Au moins un club du pied a une découpe (Monaco), donc des identifiants à renommer.
    expect(html).toMatch(/ id="pied-ib-f-/);
    // Sur la nuit : ni le filet d’encre à 60 %, ni le bord d’encre que l’insigne prend sur un fond clair.
    expect(html).not.toMatch(/stroke="rgba\(20,21,31,0\.6\)"|stroke-opacity="0\.85"/);
    expect(html).not.toMatch(/class="disque|viewBox="0 0 2 2"/);
    // Chaque page écrite à la main porte ces insignes, un par club.
    for (const p of PAGES_DU_CADRE) expect(lire(p.fichier).match(PIED)[0].match(/<svg class="insigne" width="24"/g), p.fichier).toHaveLength(cadre.clubs.length);
  });

  test('une page qui dessine aussi Monaco : son pied est celui des autres pages, chaque identifiant n’y sert qu’une fois', async () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'cadre-monaco-'));
    let site;
    try {
      const fichier = path.join(dossier, 'scenario.json');
      const club = (slug, canonicalName) => ({ slug, canonicalName });
      writeFileSync(fichier, JSON.stringify({
        matches: [
          { id: 'c-monaco-lens', startAt: '2026-10-30T19:00:00.000Z', league: 'Ligue 1', homeTeam: 'AS Monaco', awayTeam: 'RC Lens', homeClub: club('as-monaco', 'AS Monaco'), awayClub: club('rc-lens', 'RC Lens') },
          { id: 'c-nice-monaco', startAt: '2026-11-01T16:00:00.000Z', league: 'Ligue 1', homeTeam: 'OGC Nice', awayTeam: 'AS Monaco', homeClub: club('ogc-nice', 'OGC Nice'), awayClub: club('as-monaco', 'AS Monaco') },
        ],
        bars: [],
        matchNights: [],
      }));
      site = await construireEnMemoire({ source: `scenario:${fichier}`, maintenant: Date.parse('2026-10-29T09:00:00Z'), racine });
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
    const cadre = lireLeCadre();
    // L’insigne que la page dessine elle-même suit son fond, le jour (« sl0 ») ; celui du pied reste de nuit (« sn0 »).
    const pages = pagesHtml(site.pages).filter((p) => / id="ib-f-as-monaco-small-sl0-field"/.test(p.contenu));
    expect(pages.map((p) => p.chemin)).toEqual(expect.arrayContaining(['/matchs/club/monaco/', '/matchs/', '/matchs/club/nice/']));
    for (const p of pages) {
      expect(p.contenu.match(PIED)[0], p.chemin).toBe(pied(cadre, { marque: MARQUE, chemin: p.chemin, langue: p.langue ?? 'fr' }));
      const ids = [...p.contenu.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
      expect(ids.length - new Set(ids).size, p.chemin).toBe(0);
      for (const [, cible] of p.contenu.matchAll(/url\(#([^)]+)\)/g)) expect(ids, p.chemin).toContain(cible);
      expect(ids, p.chemin).toContain('pied-ib-f-as-monaco-small-sn0-field');
    }
  });
});

// ---------- Le contact du pied ----------

// « Presse et partenariats » mène à la page Presse (et, à côté, l’adresse e-mail) ; sans page Presse, le titre seul. Les
// deux actions ambre du pied, et seulement elles. Tel qu’il est peint : les deux liens de la ligne sont soulignés (ils
// se distinguent du texte), et la page où l’on est aussi (pas seulement par sa couleur).
test.describe('le contact du pied de page', () => {
  test('« Presse et partenariats » vers la page Presse, l’adresse e-mail à côté, et les deux actions', () => {
    const cadre = lireLeCadre();
    const ligne = (html) => html.match(PIED)[0].match(/<div class="pied__contact">[\s\S]*?<\/div>/)[0];
    for (const p of PAGES_DU_CADRE) {
      const contact = ligne(lire(p.fichier));
      expect(contact, p.fichier).toMatch(new RegExp(`<p><a href="/presse\\.html"( aria-current="page")?>${TEXTES.pied.contact}</a>\u00A0: <a href="mailto:${MARQUE.contact}">`));
      expect([...contact.matchAll(/class="pied__action" href="([^"]+)"/g)].map((m) => m[1]), p.fichier).toEqual(['/#attente', '/pour-les-bars.html#proposer']);
      expect(lire(p.fichier).match(PIED)[0].match(/pied__action/g), p.fichier).toHaveLength(2);
    }
    expect(ligne(pied(cadre, { marque: MARQUE, avecPresse: false }))).toContain(`<p>${TEXTES.pied.contact}\u00A0: <a href="mailto:`);
  });

  for (const largeur of [390, 1280]) {
    test(`à ${largeur} px : l’adresse e-mail et « Presse et partenariats » soulignés, la page où l’on est aussi`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/presse.html');
      const lu = await page.evaluate(() => [...document.querySelectorAll('.pied__contact p a, .pied a[aria-current="page"]')]
        .map((a) => ({ texte: a.textContent.replace(/\s+/g, ' '), trait: getComputedStyle(a).textDecorationLine, courant: a.getAttribute('aria-current') })));
      expect(lu.map((l) => l.texte)).toEqual(['Presse et partenariats', 'contact@baromatch.fr', 'X : @baromatchapp', 'Presse et partenariats']);
      for (const l of lu) expect(l.trait, l.texte).toBe('underline');
      expect(lu.filter((l) => l.courant).map((l) => l.texte)).toEqual(['Presse et partenariats', 'Presse et partenariats']);
    });
  }
});

// Le pied, texte à 100 et 200 %, au téléphone et à l’ordinateur : aucun titre, lien ni phrase coupé en plein mot
// (« Compétitions » à 200 % sur ordinateur), et chaque lien se touche sur 44 × 44 px au moins (« Lyon », « Lille »
// prennent toute leur case).
for (const largeur of [360, 390, 1280]) {
  test(`le pied à ${largeur} px, texte à 100 et 200 % : aucun mot coupé, chaque lien de 44 × 44 px au moins`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/cgu.html');
    await page.evaluate(() => document.fonts.ready);
    for (const pourcent of [100, 200]) {
      const lu = await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
        const coupes = [];
        for (const e of document.querySelectorAll('.pied h2, .pied a, .pied p')) {
          const marcheur = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
          for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
            for (const mot of n.data.matchAll(/\S+/g)) {
              const plage = document.createRange();
              plage.setStart(n, mot.index);
              plage.setEnd(n, mot.index + mot[0].length);
              if (new Set([...plage.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1) coupes.push(`« ${mot[0]} » dans « ${e.textContent.trim()} »`);
            }
          }
        }
        const petits = [...document.querySelectorAll('.pied a')].map((a) => ({ texte: a.textContent.trim(), r: a.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 44 || r.height < 44).map(({ texte, r }) => `${texte} : ${Math.round(r.width)} × ${Math.round(r.height)}`);
        return { coupes: [...new Set(coupes)], petits };
      }, pourcent);
      expect(lu.coupes, `${pourcent} % : mots coupés`).toEqual([]);
      expect(lu.petits, `${pourcent} % : liens sous 44 px`).toEqual([]);
    }
  });
}

// Deux liens voisins d’une liste du pied se lisent comme deux : quand un lien passe à la ligne (« Comment on choisit
// les bars », puis « Comment trouver un bar qui diffuse le match », dans une colonne étroite), l’écart jusqu’au lien
// suivant reste plus grand que l’interligne, de 4 px au moins. À l’ordinateur et au téléphone, texte à 100 et 200 %.
for (const largeur of [320, 393, 1280]) {
  test(`le pied à ${largeur} px, texte à 100 et 200 % : deux liens voisins ne se lisent pas comme un seul`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/cgu.html');
    await page.evaluate(() => document.fonts.ready);
    let paires = 0;
    for (const pourcent of [100, 200]) {
      const lu = await page.evaluate((p) => {
        document.documentElement.style.fontSize = `${p}%`;
        const collees = [];
        let vues = 0;
        for (const liste of document.querySelectorAll('.pied__contact ul, .pied__plan ul:not(.pied__clubs), .pied__legal ul')) {
          const liens = [...liste.querySelectorAll('a')].map((a) => {
            const plage = document.createRange();
            plage.selectNodeContents(a);
            const lignes = [...plage.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
            return { texte: a.textContent.trim(), haut: lignes[0], bas: lignes.at(-1), interligne: parseFloat(getComputedStyle(a).lineHeight) - lignes[0].height };
          });
          for (const a of liens) {
            // Le lien juste en dessous, dans la même colonne.
            const dessous = liens.filter((b) => b !== a && b.haut.top >= a.bas.bottom - 0.5 && b.haut.left < a.bas.right && a.bas.left < b.haut.right)
              .sort((x, y) => x.haut.top - y.haut.top)[0];
            if (!dessous) continue;
            vues += 1;
            const ecart = dessous.haut.top - a.bas.bottom;
            if (ecart < a.interligne + 4) collees.push(`« ${a.texte} » puis « ${dessous.texte} » : ${ecart.toFixed(1)} px, l’interligne ${a.interligne.toFixed(1)} px`);
          }
        }
        return { collees, vues };
      }, pourcent);
      paires += lu.vues;
      expect(lu.collees, `${pourcent} % : liens voisins collés`).toEqual([]);
    }
    expect(paires, 'des liens voisins, l’un sous l’autre').toBeGreaterThan(5);
  });
}

// ---------- Plus d’ancien cadre ----------

// L’ancien en-tête (.entete__nav, .entete__lien) et l’ancien pied (.pied__liens) ont quitté toutes les pages publiées :
// le premier passage de l’Action « Pages des matchs » après les pages au jour les a réécrites avec le cadre neuf. Leurs
// règles de transition sont donc retirées de styles.css. Si une page les remettait, elle serait sans forme : ce test le dit.
const ANCIEN_CADRE = /class="(?:[^"]* )?(?:entete__nav|entete__lien|pied__liens)(?:[ "])/;
const pagesPubliees = () => {
  const trouvees = [];
  const parcourir = (dossier) => {
    for (const entree of readdirSync(path.join(racine, dossier), { withFileTypes: true })) {
      if (entree.name.startsWith('.') || ['node_modules', 'tests', 'test-results', 'playwright-report'].includes(entree.name)) continue;
      const relatif = path.join(dossier, entree.name);
      if (entree.isDirectory()) parcourir(relatif);
      else if (entree.name.endsWith('.html')) trouvees.push(relatif);
    }
  };
  parcourir('.');
  return trouvees.sort();
};

test('plus d’ancien cadre : aucune page publiée ne le porte, styles.css ne le met plus en forme', () => {
  const pages = pagesPubliees();
  expect(pages.length, 'les pages du site').toBeGreaterThan(100);
  expect(pages.filter((fichier) => ANCIEN_CADRE.test(lire(fichier))), 'des pages avec l’ancien cadre').toEqual([]);
  expect(lire('styles.css').match(/\.(?:entete__nav|entete__lien|pied__liens)\b/g) ?? [], 'des règles de l’ancien cadre').toEqual([]);
});

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

  // Le jour où l’appli ouvre, une page dit « Réserve ta place dans l’appli » : son cadre ne dit plus « Préviens-moi quand
  // Baromatch arrive », ni dans l’en-tête, ni dans le pied (« Proposer mon bar » reste). Les mots qui le remplaceront
  // reviennent au propriétaire ; d’ici là, rien plutôt qu’une phrase devenue fausse.
  test('l’appli ouverte : plus de « Préviens-moi » dans l’en-tête ni dans le pied, sur les pages du générateur comme sur celles écrites à la main', async () => {
    const ouverte = { ...MARQUE, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } };
    const attente = `${TEXTES.action}${TEXTES.actionSuite}`;
    const { pages } = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: { ...contenuDuScenario(), marque: ouverte } });
    const generees = pagesHtml(pages);
    expect(generees.some((p) => p.contenu.includes('magasin.exemple/baromatch-android')), 'les pages disent « Réserve ta place dans l’appli »').toBe(true);
    const ecrites = PAGES_DU_CADRE.map((p) => ({ chemin: p.chemin, contenu: pageAvecLeCadre(lire(p.fichier), p, { marque: ouverte }) }));
    for (const p of [...generees, ...ecrites]) {
      expect(actionDe(p.contenu), `${p.chemin} : l’action de l’en-tête`).toBeNull();
      const lePied = p.contenu.match(PIED)[0];
      expect(lePied, p.chemin).not.toContain(attente);
      expect(lePied, p.chemin).toContain('<a class="pied__action" href="/pour-les-bars.html#proposer">');
    }
    // L’appli pas encore ouverte : les deux, comme aujourd’hui.
    expect(pied(lireLeCadre(), { marque: MARQUE })).toContain(`<a class="pied__action" href="/#attente">${attente}</a>`);
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

// ---------- Les bords de l’en-tête, tels qu’ils sont peints ----------

// Le bord du menu (le rang sous le logo, le bandeau du bas, la paire des matchs à l’ordinateur) et celui de
// « Préviens-moi » en contour, lus au pixel (tests/outils/bords-peints.mjs), à 3:1 au moins contre ce qui les touche,
// dehors et dedans, au jour (l’accueil, « Pour les bars ») comme la nuit (les CGU). Le bandeau se lit à chaque
// demi-écran, du rang sorti jusqu’au bas de la page : sous lui passent le crème, les halos, les cartes, les bandes de
// nuit et les images, et son ombre se pose autour de lui.
test.describe('les bords de l’en-tête, tels qu’ils sont peints', () => {
  test.use({ deviceScaleFactor: 3 });
  const ouvrir = async (page, chemin, largeur, hauteur) => {
    await couperLAPI(page);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto(chemin);
    await attendreLaPageFinie(page);
    await page.evaluate(() => document.fonts.ready);
  };
  for (const [nom, chemin] of [['le jour (accueil)', '/'], ['le jour (« Pour les bars »)', '/pour-les-bars.html'], ['la nuit (CGU)', '/cgu.html']]) {
    test(`${nom}, au téléphone : le rang à l’arrivée, puis le bandeau du bas tout le long de la page`, async ({ page }) => {
      await ouvrir(page, chemin, 390, 844);
      const faibles = bordsTropFaibles(await mesurerLesBords(page, '.menu__liste'), 3, 'le rang, à l’arrivée : ');
      const { debut, total, ecran } = await page.evaluate(() => ({
        debut: Math.ceil(document.querySelector('.menu').getBoundingClientRect().bottom + scrollY + 40), total: document.documentElement.scrollHeight, ecran: innerHeight,
      }));
      let lus = 0;
      for (let y = debut; y < total - ecran / 2; y += Math.round(ecran / 2)) {
        await page.evaluate((haut) => window.scrollTo({ top: haut, behavior: 'instant' }), y);
        const fixe = await page.evaluate(async () => {
          await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
          return getComputedStyle(document.querySelector('.menu__liste')).position === 'fixed';
        });
        expect(fixe, `la page à ${y} px : le bandeau du bas`).toBe(true);
        lus += 1;
        faibles.push(...bordsTropFaibles(await mesurerLesBords(page, '.menu__liste'), 3, `le bandeau, la page à ${y} px : `));
      }
      expect(lus, 'le bandeau lu tout le long de la page').toBeGreaterThan(4);
      expect(faibles).toEqual([]);
    });

    test(`${nom}, à l’ordinateur : la paire des matchs`, async ({ page }) => {
      await ouvrir(page, chemin, 1280, 800);
      const mesures = await mesurerLesBords(page, '.menu__matchs');
      expect(mesures.flatMap((m) => m.cotes.map((c) => c.cote)).sort()).toEqual(['bas', 'haut']);
      expect(bordsTropFaibles(mesures)).toEqual([]);
    });
  }

  // « Préviens-moi » en contour (le guide des testeurs a son bouton ambre) : sur sa page de nuit, et sur la même passée
  // au jour (les pages qui le portent passeront au jour).
  for (const largeur of [390, 1280]) {
    test(`« Préviens-moi » en contour à ${largeur} px, la nuit comme au jour`, async ({ page }) => {
      await ouvrir(page, '/testeurs-android.html', largeur, 800);
      const faibles = bordsTropFaibles(await mesurerLesBords(page, '.entete__attente--contour'), 3, 'la nuit : ');
      await page.evaluate(() => document.documentElement.classList.add('jour'));
      const jour = await mesurerLesBords(page, '.entete__attente--contour');
      expect(jour.flatMap((m) => m.cotes.map((c) => c.cote)).sort()).toEqual(['bas', 'haut']);
      faibles.push(...bordsTropFaibles(jour, 3, 'le jour : '));
      expect(faibles).toEqual([]);
    });
  }
});
