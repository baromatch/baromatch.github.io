// À propos (« le parti pris ») et Presse et partenariats (« le kit sur la page »), passées au jour comme l’accueil :
// ce que le propriétaire a choisi, mesuré dans le navigateur, tel que la page est peinte.
// - Un seul bouton ambre par page (« Proposer mon bar », « Écrire pour la presse ») : aucune autre surface, aucun texte
//   ni aucun bord ambre dans la page (le disque de couleur du kit, qui montre l’ambre, excepté).
// - Chaque texte à 4,5:1 au moins sur son fond, chaque bord d’une action et chaque contour du focus à 3:1.
// - Chaque action hors d’une phrase se touche sur 44 px de haut.
// - Avec le texte à 200 % sur 320, 375 et 390 px : rien ne sort de l’écran, aucun mot n’est coupé (passer à la ligne
//   après un trait d’union n’en coupe pas), et l’étiquette « Écran de démonstration » garde son texte dans sa pilule.
// - Chaque écran de l’appli porte « Écran de démonstration », et la page dit que ses bars, clubs et pseudos sont inventés.
// - Rien ne bouge (ni animation, ni transition), avec ou sans « réduire les animations », et rien ne saute au chargement
//   (CLS 0, mesuré sans la police, comme l’accueil).
// - Rien que des fichiers du site, et chaque page charge sa propre feuille, qu’aucune autre ne charge.
// - Rien de ce qu’on ne dit jamais : ni « ! », ni pourcentage, ni « vous », ni promesse sur Google Play, ni avis vérifiés,
//   ni affiche QR imprimée, ni notification, ni rien qui pousse à boire.
// Le reste (axe, référencement, liens, politique de sécurité, pied de page) vient des tests qui parcourent
// tests/outils/pages.mjs ; ce que chaque page dit, de tests/confiance.spec.mjs et tests/presse.spec.mjs.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { chargerLesImages } from './outils/attente.mjs';

const PAGES = [
  { chemin: '/a-propos.html', feuille: '/a-propos.css', ambre: ['Proposer mon bar', '/pour-les-bars.html#proposer'] },
  { chemin: '/presse.html', feuille: '/presse.css', ambre: ['Écrire pour la presse', 'mailto:contact@baromatch.fr?subject=Presse%20%E2%80%93%20Baromatch'] },
];
const AMBRE = 'rgb(255, 177, 61)';
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const agrandir = (page, pourcent) => page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
const ouvrir = async (page, chemin, largeur, hauteur = 900) => {
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(chemin);
  await page.evaluate(() => document.fonts.ready);
};

// Les outils de mesure, posés dans la page : lire une couleur, la poser sur une autre, le contraste de WCAG 2.2, et le
// fond plein derrière un élément (les fonds translucides empilés jusqu’au premier fond opaque).
const OUTILS = `
  window.lireCouleur = (css) => { const [r, v, b, a = 1] = css.match(/[\\d.]+/g).map(Number); return { r, v, b, a }; };
  window.poser = (dessus, dessous) => ({ r: dessus.r * dessus.a + dessous.r * (1 - dessus.a), v: dessus.v * dessus.a + dessous.v * (1 - dessus.a), b: dessus.b * dessus.a + dessous.b * (1 - dessus.a), a: 1 });
  window.luminance = ({ r, v, b }) => [r, v, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  window.rapport = (x, y) => { const [c, s] = [luminance(x), luminance(y)].sort((m, n) => n - m); return Math.round(((c + 0.05) / (s + 0.05)) * 100) / 100; };
  window.fondDe = (element) => {
    const couches = [];
    for (let e = element; e; e = e.parentElement) {
      const f = lireCouleur(getComputedStyle(e).backgroundColor);
      if (f.a > 0) couches.push(f);
      if (f.a === 1) break;
    }
    return couches.reverse().reduce((dessous, dessus) => poser(dessus, dessous), { r: 255, v: 255, b: 255, a: 1 });
  };
  window.nomDe = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '') + ' « ' + (e.textContent || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 32) + ' »';
  window.normaliser = (t) => t.replace(/[\\s\\u00a0\\u202f]+/g, ' ').trim();
  window.visible = (e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !e.closest('.visuellement-cache');
`;
test.beforeEach(async ({ page }) => { await page.addInitScript(OUTILS); });

for (const { chemin, feuille, ambre } of PAGES) {
  test.describe(chemin, () => {
    for (const largeur of [390, 1280]) {
      test(`à ${largeur} px : un seul bouton ambre, « ${ambre[0]} », et l’ambre nulle part ailleurs dans la page`, async ({ page }) => {
        await ouvrir(page, chemin, largeur);
        const peint = await page.evaluate((ambreCss) => {
          const surfaces = [];
          const textes = [];
          const bords = [];
          for (const e of document.querySelectorAll('main, main *')) {
            if (!visible(e)) continue;
            const s = getComputedStyle(e);
            if (s.backgroundColor === ambreCss) surfaces.push(e);
            if (s.color === ambreCss && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) textes.push(nomDe(e));
            for (const cote of ['Top', 'Right', 'Bottom', 'Left']) {
              if (parseFloat(s[`border${cote}Width`]) > 0 && s[`border${cote}Style`] !== 'none' && s[`border${cote}Color`] === ambreCss) bords.push(nomDe(e));
            }
          }
          return {
            boutons: surfaces.filter((e) => !e.matches('.presse__disque')).map((e) => [e.tagName, e.textContent.trim(), e.getAttribute('href')]),
            disques: surfaces.filter((e) => e.matches('.presse__disque')).map((e) => Math.round(e.getBoundingClientRect().width)),
            textes,
            bords: [...new Set(bords)],
          };
        }, AMBRE);
        expect(peint.boutons).toEqual([['A', ...ambre]]);
        // Sur la page Presse, l’ambre se montre en un disque de 72 px sur une carte blanche, pas en surface.
        expect(peint.disques).toEqual(chemin === '/presse.html' ? [72] : []);
        expect(peint.textes, 'du texte ambre').toEqual([]);
        expect(peint.bords, 'des bords ambre').toEqual([]);
      });

      test(`à ${largeur} px : chaque texte se lit à 4,5:1 au moins sur son fond, chaque bord d’une action à 3:1`, async ({ page }, infos) => {
        await ouvrir(page, chemin, largeur);
        const lu = await page.evaluate(() => {
          const textes = [];
          for (const e of document.querySelectorAll('main *')) {
            if (!visible(e)) continue;
            if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const fond = fondDe(e);
            textes.push({ quoi: nomDe(e), rapport: rapport(poser(lireCouleur(getComputedStyle(e).color), fond), fond) });
          }
          const bords = [];
          for (const e of document.querySelectorAll('main a[href], main button')) {
            if (!visible(e)) continue;
            const s = getComputedStyle(e);
            if (!(parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none')) continue;
            const derriere = fondDe(e.parentElement);
            bords.push({ quoi: nomDe(e), rapport: rapport(poser(lireCouleur(s.borderTopColor), derriere), derriere) });
          }
          return { textes, bords };
        });
        expect(lu.textes.length).toBeGreaterThan(40);
        expect(lu.bords.length).toBeGreaterThanOrEqual(2);
        infos.annotations.push({ type: 'contraste', description: `texte le plus faible ${Math.min(...lu.textes.map((t) => t.rapport))}:1, bord le plus faible ${Math.min(...lu.bords.map((b) => b.rapport))}:1` });
        expect(lu.textes.filter((t) => t.rapport < 4.5).map((t) => `${t.quoi} : ${t.rapport}:1`)).toEqual([]);
        expect(lu.bords.filter((b) => b.rapport < 3).map((b) => `${b.quoi} : ${b.rapport}:1`)).toEqual([]);
      });

      test(`à ${largeur} px : au clavier, chaque contour du focus se voit à 3:1 sur son fond ; chaque action se touche sur 44 px`, async ({ page }) => {
        await ouvrir(page, chemin, largeur);
        const arrets = [];
        for (let i = 0; i < 120; i += 1) {
          await page.keyboard.press('Tab');
          const arret = await page.evaluate(() => {
            const actif = document.activeElement;
            if (!actif || actif === document.body) return null;
            const s = getComputedStyle(actif);
            const derriere = fondDe(actif.parentElement);
            return { quoi: nomDe(actif), contour: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, rapport: rapport(poser(lireCouleur(s.outlineColor), derriere), derriere) };
          });
          if (!arret || (arrets.length && arret.quoi === arrets[0].quoi)) break;
          arrets.push(arret);
        }
        expect(arrets.length).toBeGreaterThan(15);
        expect(arrets.filter((a) => !a.contour).map((a) => a.quoi), 'un arrêt sans contour').toEqual([]);
        expect(arrets.filter((a) => a.rapport < 3).map((a) => `${a.quoi} : ${a.rapport}:1`)).toEqual([]);
        // Une action hors d’une phrase (un bouton, une capsule, un lien seul sur sa ligne) : 44 px de haut au moins.
        const petites = await page.evaluate(() => [...document.querySelectorAll('main a[href], main button')].filter(visible).filter((e) => {
          const parent = e.parentElement;
          const dansUnePhrase = parent && normaliser(parent.textContent) !== normaliser(e.textContent);
          return !dansUnePhrase && e.getBoundingClientRect().height < 43.5;
        }).map((e) => `${nomDe(e)} : ${Math.round(e.getBoundingClientRect().height)} px`).filter(Boolean));
        expect(petites).toEqual([]);
      });
    }

    // Du téléphone à l’ordinateur : les colonnes suivent la taille du texte (avant, à 960 px, la page défilait de côté).
    for (const largeur of [320, 375, 390, 768, 960, 1024, 1280]) {
      test(`à ${largeur} px, texte à 200 % : rien ne sort de l’écran, aucun mot n’est coupé, chaque étiquette garde son texte`, async ({ page }) => {
        await ouvrir(page, chemin, largeur, 700);
        await chargerLesImages(page);
        await agrandir(page, 200);
        const lu = await page.evaluate(() => {
          const ecran = document.documentElement.clientWidth;
          const dehors = [...document.querySelectorAll('main *')].filter((e) => e.getClientRects().length && !e.closest('svg, .visuellement-cache'))
            .filter((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > ecran + 0.5; }).map(nomDe);
          // Chaque mot (entre deux espaces ou deux traits d’union) : une seule ligne.
          const coupes = [];
          const parcours = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
          while (parcours.nextNode()) {
            const noeud = parcours.currentNode;
            if (!noeud.parentElement.getClientRects().length || noeud.parentElement.closest('.visuellement-cache')) continue;
            for (const mot of noeud.nodeValue.matchAll(/[^\s  \-‑–]+/g)) {
              const morceau = document.createRange();
              morceau.setStart(noeud, mot.index);
              morceau.setEnd(noeud, mot.index + mot[0].length);
              const hauts = [...morceau.getClientRects()].filter((r) => r.width > 0).map((r) => r.top);
              if (hauts.length > 1 && Math.max(...hauts) - Math.min(...hauts) > 2) coupes.push(mot[0]);
            }
          }
          const etiquettes = [...document.querySelectorAll('main .exemple')].filter((e) => e.checkVisibility()).map((e) => {
            const boite = e.getBoundingClientRect();
            const plage = document.createRange();
            plage.selectNodeContents(e);
            return [...plage.getClientRects()].filter((l) => l.top < boite.top - 0.5 || l.bottom > boite.bottom + 0.5 || l.left < boite.left - 0.5 || l.right > boite.right + 0.5).length;
          });
          return { dehors, coupes, etiquettes, defile: document.documentElement.scrollWidth > ecran };
        });
        expect(lu.dehors).toEqual([]);
        expect(lu.defile, 'la page défile de côté').toBe(false);
        expect(lu.coupes, 'des mots coupés').toEqual([]);
        expect(lu.etiquettes.length).toBeGreaterThan(0);
        expect(lu.etiquettes.filter((n) => n > 0), 'une étiquette dont le texte sort').toEqual([]);
      });
    }

    test('chaque écran de l’appli porte « Écran de démonstration », et la page dit que tout y est inventé', async ({ page }) => {
      await ouvrir(page, chemin, 390);
      const ecrans = await page.$$eval('main img[src^="/img/appli/"]', (images) => images.map((img) => {
        const figure = img.closest('figure');
        return { src: img.getAttribute('src'), etiquette: figure?.querySelector('.exemple')?.textContent.trim(), visible: figure?.querySelector('.exemple')?.checkVisibility() };
      }));
      expect(ecrans.length).toBe(chemin === '/presse.html' ? 5 : 3);
      for (const ecran of ecrans) expect([ecran.src, ecran.etiquette, ecran.visible]).toEqual([ecran.src, 'Écran de démonstration', true]);
      expect(normaliser(await page.locator('main').textContent())).toContain('Sur ces écrans, les bars, les clubs, les pseudos et les chiffres sont inventés.');
    });

    for (const mouvement of ['reduce', 'no-preference']) {
      test(`rien ne bouge (« ${mouvement} ») : ni animation, ni transition ; et rien ne saute au chargement (CLS 0)`, async ({ page }) => {
        // Seuls les décalages de la page elle-même : sans la police (son remplacement est mesuré à part, comme sur l’accueil).
        await page.route('**/fonts/bricolage-grotesque.woff2', (route) => route.abort());
        await page.addInitScript(() => {
          window.decalages = 0;
          new PerformanceObserver((liste) => { for (const e of liste.getEntries()) if (!e.hadRecentInput) window.decalages += e.value; })
            .observe({ type: 'layout-shift', buffered: true });
        });
        for (const largeur of [390, 1280]) {
          await page.setViewportSize({ width: largeur, height: 900 });
          await page.emulateMedia({ reducedMotion: mouvement });
          await page.goto(chemin);
          await chargerLesImages(page);
          const bouge = await page.evaluate(() => ({
            animations: document.getAnimations().length,
            mobiles: [...document.querySelectorAll('main, main *')].filter((e) => {
              const s = getComputedStyle(e);
              return s.animationName !== 'none' || s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
            }).map(nomDe),
          }));
          expect(bouge, `${largeur} px`).toEqual({ animations: 0, mobiles: [] });
          expect(await page.evaluate(() => window.decalages), `${largeur} px`).toBe(0);
        }
      });
    }

    test('rien que des fichiers du site, et sa propre feuille, qu’aucune autre page ne charge', async ({ page, baseURL }) => {
      const demandes = [];
      page.on('request', (r) => demandes.push(r.url()));
      await ouvrir(page, chemin, 390);
      await chargerLesImages(page);
      expect(demandes.filter((u) => new URL(u).origin !== new URL(baseURL).origin)).toEqual([]);
      const feuilles = await page.$$eval('link[rel="stylesheet"]', (l) => l.map((x) => x.getAttribute('href')));
      expect(feuilles).toEqual(['/styles.css', feuille]);
      const html = readdirSync(racine).filter((f) => f.endsWith('.html') && `/${f}` !== chemin);
      for (const f of html) expect(readFileSync(path.join(racine, f), 'utf8'), f).not.toContain(feuille);
      await expect(page.locator('html')).toHaveClass('jour');
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#FAF7F1');
    });

    test('rien de ce qu’on ne dit jamais, et le tutoiement', async ({ page }) => {
      await ouvrir(page, chemin, 390);
      const texte = normaliser(await page.locator('main').textContent());
      const alt = (await page.$$eval('main img', (i) => i.map((x) => x.alt))).join(' ');
      for (const lu of [texte, alt]) {
        expect(lu).not.toMatch(/!|%/);
        expect(lu).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
        expect(lu).not.toMatch(/Soir de Match/);
        // L’appli ne coûte rien au fan, mais la boutique vend des pièces : jamais « tu ne paies rien à Baromatch ».
        expect(lu).not.toMatch(/ne paies rien|ne payez rien/i);
        expect(lu).not.toMatch(/disponible sur Google Play|télécharge(?:r|z)? (?:l’appli )?sur Google Play/i);
        expect(lu).not.toMatch(/avis vérifiés?|affiche (?:QR|imprimée)|QR imprimé|notifications?/i);
        expect(lu).not.toMatch(/happy[\s-]*hour|tournée|verre offert|\b(?:bières?|pintes?|cocktails?|whisky|vodka|rhum|pastis|apéro|apéritif)\b/i);
        // Aucune promesse datée.
        expect(lu).not.toMatch(/\b(?:en|dès|d’ici|avant) (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|20\d\d)\b/i);
      }
    });
  });
}

// À propos au téléphone : les trois écrans font de petits cadres, leur légende à côté ; la bande de nuit reste courte.
test('/a-propos.html à 390 px : la bande de nuit tient sous 1 300 px, chaque légende à côté de son écran', async ({ page }) => {
  await ouvrir(page, '/a-propos.html', 390);
  const lu = await page.evaluate(() => ({
    hauteur: document.querySelector('.apropos__appli').getBoundingClientRect().height,
    cotes: [...document.querySelectorAll('.apropos__ecran')].map((li) => {
      const cadre = li.querySelector('.apropos__cadre').getBoundingClientRect();
      const legende = li.querySelector('figcaption').getBoundingClientRect();
      return { cadre: Math.round(cadre.width), aCote: legende.left >= cadre.right && Math.abs(legende.top - cadre.top) < 2 };
    }),
  }));
  expect(lu.hauteur).toBeLessThan(1300);
  expect(lu.cotes).toEqual([{ cadre: 152, aCote: true }, { cadre: 152, aCote: true }, { cadre: 152, aCote: true }]);
  // Sur ordinateur, trois colonnes, la légende sous l’écran.
  await ouvrir(page, '/a-propos.html', 1280);
  const colonnes = await page.$$eval('.apropos__ecran', (li) => li.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(colonnes).size).toBe(1);
});

// ---------- Après relecture : le petit téléphone, la police qui arrive tard, les liens, les images ----------

// L’iPhone SE (320 × 568) : le premier écran montre l’action. Sur Presse, l’icône s’efface et « Écrire pour la presse »
// tient dans l’écran ; sur À propos, au moins la première entrée.
test('iPhone SE (320 × 568) : le premier écran montre « Écrire pour la presse », et la première entrée d’À propos', async ({ page }) => {
  await ouvrir(page, '/presse.html', 320, 568);
  await expect(page.locator('.presse__icone')).toBeHidden();
  expect((await page.locator('.presse__actions .capsule').boundingBox()).y + (await page.locator('.presse__actions .capsule').boundingBox()).height).toBeLessThanOrEqual(568);
  await ouvrir(page, '/a-propos.html', 320, 568);
  const premiere = await page.locator('.apropos__entrees li').first().boundingBox();
  expect(premiere.y + premiere.height).toBeLessThanOrEqual(568);
  // Sur un iPhone 15 (393 × 659), l’icône de l’ouverture s’efface aussi (elle reste dans « Le logo ») : les deux
  // boutons tiennent dans le premier écran. Dès 600 px, elle revient.
  await ouvrir(page, '/presse.html', 393, 659);
  await expect(page.locator('.presse__icone')).toBeHidden();
  const partenariat = await page.locator('.presse__actions .presse__bouton').boundingBox();
  expect(partenariat.y + partenariat.height).toBeLessThanOrEqual(659);
  await expect(page.locator('#logos ~ .presse__logos img[src="/presse/baromatch-icone.svg"]')).toBeVisible();
  await ouvrir(page, '/presse.html', 600, 900);
  await expect(page.locator('.presse__icone')).toBeVisible();
});

// La police retenue jusqu’au premier affichage, puis lâchée (comme tests/police.spec.mjs) : la page s’affiche dans la
// police de secours, et quand Bricolage Grotesque arrive, rien ne bouge. Sous 360 px, chaque entrée d’À propos tient sur
// deux lignes quelle que soit la police (avant, elle passait d’une à deux lignes : 0,003 sur un iPhone SE). À 390 px,
// deux polices ne coupent jamais leurs lignes tout à fait aux mêmes pixels : 0,001 au plus (mesuré 0,00004 à 0,0003 ;
// Google dit « bon » sous 0,1).
for (const { chemin } of PAGES) {
  for (const [largeur, hauteur] of [[320, 568], [390, 844]]) {
    test(`${chemin} à ${largeur} px : quand la police arrive tard, rien ne bouge (CLS ${largeur < 360 ? '0' : 'sous 0,001'})`, async ({ browser, baseURL }) => {
      const contexte = await browser.newContext({ baseURL, viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce', locale: 'fr-FR' });
      await contexte.addInitScript(() => {
        window.decalages = [];
        const garder = (entrees) => { for (const e of entrees) if (!e.hadRecentInput) window.decalages.push(e.value); };
        window.observateurDesDecalages = new PerformanceObserver((liste) => garder(liste.getEntries()));
        window.observateurDesDecalages.observe({ type: 'layout-shift', buffered: true });
        window.relever = () => garder(window.observateurDesDecalages.takeRecords());
      });
      const onglet = await contexte.newPage();
      let lacher;
      const porte = new Promise((resoudre) => { lacher = resoudre; });
      const retenues = [];
      await onglet.route('**/fonts/*.woff2', (route) => { const envoi = porte.then(() => route.continue()); retenues.push(envoi); return envoi; });
      try {
        await onglet.goto(chemin, { waitUntil: 'domcontentloaded' });
        await onglet.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
        expect(retenues.length).toBeGreaterThan(0);
        lacher();
        await onglet.waitForFunction(() => [...document.fonts].some((f) => f.family === 'Bricolage Grotesque' && f.status === 'loaded'));
        await onglet.evaluate(() => new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); }));
        const total = await onglet.evaluate(() => { window.relever(); return window.decalages.reduce((t, v) => t + v, 0); });
        if (largeur < 360) expect(total).toBe(0);
        else expect(total).toBeLessThanOrEqual(0.001);
      } finally {
        lacher();
        await Promise.all(retenues);
        await contexte.close();
      }
    });
  }
}

// Les liens pris dans une phrase, dans ces pages (pas l’en-tête ni le pied, partagés) : 44 px de haut eux aussi.
test('les liens pris dans une phrase des deux pages se touchent sur 44 px', async ({ page }) => {
  const hauteurs = [];
  for (const [chemin, selecteur] of [['/a-propos.html', '.apropos__rassure a, .apropos__note-carte a, .apropos__qui-publie a'], ['/presse.html', '.presse__police a, .presse__autre-format a, .presse__bar a']]) {
    await ouvrir(page, chemin, 390);
    hauteurs.push(...await page.$$eval(selecteur, (liens) => liens.map((a) => [a.textContent.trim(), Math.round(a.getBoundingClientRect().height)])));
  }
  expect(hauteurs.length).toBe(7);
  expect(hauteurs.filter(([, h]) => h < 44)).toEqual([]);
});

// Les écrans de l’appli et l’affiche du film ne sont jamais agrandis : l’image chargée a au moins autant de pixels que
// sa place à l’écran, sur un iPhone SE (×2) et un iPhone 15 (×3), à 100 % (deux écrans par ligne sur Presse) comme
// avec le texte à 200 % (un par ligne, plus large ; les cadres plafonnés en px).
for (const [appareil, largeur, hauteur, ratio] of [['iPhone SE', 320, 568, 2], ['iPhone 15', 393, 659, 3]]) for (const pourcent of [100, 200]) {
  test(`${appareil} (×${ratio}), texte à ${pourcent} % : chaque écran de l’appli, et l’affiche du film, chargés assez grands pour leur place`, async ({ browser, baseURL }) => {
    const contexte = await browser.newContext({ baseURL, viewport: { width: largeur, height: hauteur }, deviceScaleFactor: ratio, reducedMotion: 'reduce' });
    await contexte.addInitScript((p) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${p}%`; }); }, pourcent);
    const onglet = await contexte.newPage();
    try {
      for (const { chemin } of PAGES) {
        await onglet.goto(chemin);
        await chargerLesImages(onglet);
        const ecrans = await onglet.$$eval('main img[src^="/img/appli/"], main img[src="/baromatch-film.webp"]', (images) => images.map((img) => ({
          // La largeur du fichier chargé, dite par son nom (-300, -600, -720 ; l’affiche sans suffixe fait 540) :
          // naturalWidth, lui, suit l’attribut sizes.
          src: img.currentSrc.replace(/^.*\//, ''), largeur: Number(img.currentSrc.match(/-(\d+)\.webp$/)?.[1] ?? 540), place: Math.round(img.getBoundingClientRect().width * devicePixelRatio), haut: Math.round(img.getBoundingClientRect().top + scrollY),
        })));
        expect(ecrans.length, chemin).toBeGreaterThan(2);
        expect(ecrans.filter((e) => e.largeur + 1 < e.place).map((e) => `${e.src} : ${e.largeur} px pour ${e.place}`), chemin).toEqual([]);
        // Sur Presse, à 100 %, deux écrans par ligne.
        if (chemin === '/presse.html' && pourcent === 100) expect(ecrans[0].haut).toBe(ecrans[1].haut);
        if (chemin === '/presse.html') expect(ecrans.map((e) => e.src)).toContainEqual(expect.stringMatching(/^baromatch-film/));
      }
    } finally {
      await contexte.close();
    }
  });
}

// La carte des couleurs à 320 px, texte à 200 % : le disque passe au-dessus de son texte, qui garde toute la largeur.
test('Presse à 320 px, texte à 200 % : chaque disque de couleur est au-dessus de son nom', async ({ page }) => {
  await ouvrir(page, '/presse.html', 320, 700);
  await agrandir(page, 200);
  const teintes = await page.$$eval('.presse__teintes li', (li) => li.map((l) => {
    const disque = l.querySelector('.presse__disque').getBoundingClientRect();
    const nom = l.querySelector('.presse__teinte-nom').getBoundingClientRect();
    return disque.bottom <= nom.top + 0.5;
  }));
  expect(teintes).toEqual([true, true]);
});

// Le nombre de lignes d’un texte : ses morceaux de texte, regroupés quand ils se chevauchent en hauteur (un lien de
// 44 px dans la ligne ne compte pas pour une ligne de plus).
const lignesDe = (page, selecteur) => page.$$eval(selecteur, (elements) => elements.map((e) => {
  const rects = [];
  const parcours = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  while (parcours.nextNode()) {
    const plage = document.createRange();
    plage.selectNodeContents(parcours.currentNode);
    rects.push(...[...plage.getClientRects()].filter((r) => r.width > 0));
  }
  const lignes = [];
  for (const r of rects.sort((a, b) => a.top - b.top)) {
    const milieu = (r.top + r.bottom) / 2;
    if (!lignes.some((l) => milieu > l.top && milieu < l.bottom)) lignes.push({ top: r.top, bottom: r.bottom });
  }
  return lignes.length;
}));

// L’adresse de la phrase de secours, d’un seul tenant dès 360 px ; les petites phrases sous les boutons de la fin
// d’À propos, sur une ligne.
for (const largeur of [320, 375, 390, 1280]) {
  test(`à ${largeur} px : sous chaque bouton de la fin d’À propos, une ligne ; l’adresse de secours de Presse ${largeur >= 360 ? 'd’un seul tenant' : 'peut passer à la ligne'}`, async ({ page }) => {
    await ouvrir(page, '/a-propos.html', largeur);
    expect(await lignesDe(page, '.apropos__rassure')).toEqual([1, 1, 1]);
    await ouvrir(page, '/presse.html', largeur);
    const adresse = await page.locator('.presse__adresse').evaluate((e) => getComputedStyle(e).whiteSpace);
    expect(adresse).toBe(largeur >= 360 ? 'nowrap' : 'normal');
    if (largeur >= 360) expect(await lignesDe(page, '.presse__adresse')).toEqual([1]);
  });
}

// Presse au téléphone, plus courte : les cartes du logo vont par deux (une seule par ligne avec le texte à 200 %).
test('Presse au téléphone : les cartes du logo par deux à 100 %, une par ligne à 200 %', async ({ page }) => {
  for (const largeur of [360, 390, 412]) {
    await ouvrir(page, '/presse.html', largeur);
    const hauts = await page.$$eval('.presse__logo', (cartes) => cartes.map((c) => Math.round(c.getBoundingClientRect().top)));
    expect(hauts[0], `${largeur} px`).toBe(hauts[1]);
  }
  await agrandir(page, 200);
  const colonnes = await page.$$eval('.presse__logo', (cartes) => new Set(cartes.map((c) => Math.round(c.getBoundingClientRect().left))).size);
  expect(colonnes).toBe(1);
});

// Couleurs forcées (contraste élevé de Windows) : la capsule ambre garde un bord ; les aperçus du logo et les disques de
// couleur gardent leurs couleurs (sinon le logo blanc disparaît sur un fond devenu clair, et les disques se vident).
test('couleurs forcées : la capsule ambre a un bord, les aperçus du logo et les disques gardent leurs couleurs', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  for (const { chemin } of PAGES) {
    await page.goto(chemin);
    const bord = await page.locator('main .capsule').first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopWidth));
    expect(bord, chemin).toBeGreaterThanOrEqual(1);
  }
  const lu = await page.evaluate(() => ({
    sombre: getComputedStyle(document.querySelector('.presse__apercu--sombre')).backgroundColor,
    ambre: getComputedStyle(document.querySelector('.presse__disque--ambre')).backgroundColor,
    nuit: getComputedStyle(document.querySelector('.presse__disque--nuit')).backgroundColor,
  }));
  expect(lu).toEqual({ sombre: 'rgb(10, 11, 16)', ambre: AMBRE, nuit: 'rgb(10, 11, 16)' });
});

// Les titres de rubrique d’À propos, en petites capitales dessinées : le lecteur d’écran lit « Pourquoi Baromatch
// existe », pas « POURQUOI BAROMATCH EXISTE » (le nom que Chromium donne au titre, lu dans son arbre d’accessibilité).
test('À propos : les titres de rubrique gardent leur casse dans l’arbre d’accessibilité', async ({ page }) => {
  await page.goto('/a-propos.html');
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const titres = nodes.filter((n) => n.role?.value === 'heading' && n.properties?.some((p) => p.name === 'level' && p.value.value === 2)).map((n) => n.name?.value);
  expect(titres).toEqual(['Pourquoi Baromatch existe', 'Ce que fait l’appli', 'Ce qu’on refuse', 'Le mot du fondateur', 'Où va Baromatch', 'Et maintenant']);
  expect(await page.locator('.apropos__rail').first().evaluate((e) => getComputedStyle(e).fontVariantCaps)).toBe('all-small-caps');
});
