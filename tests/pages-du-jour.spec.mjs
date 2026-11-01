// À propos (« le parti pris ») et Presse et partenariats (« le kit sur la page »), passées au jour comme l’accueil :
// ce que le propriétaire a choisi, mesuré dans le navigateur, tel que la page est peinte.
// - Un seul bouton ambre par page (« Proposer mon bar », « Écrire pour la presse ») : aucune autre surface, aucun texte
//   ni aucun bord ambre dans la page (le disque de couleur du kit, qui montre l’ambre, excepté).
// - Chaque texte à 4,5:1 au moins sur son fond, chaque bord d’une action et chaque contour du focus à 3:1.
// - Chaque action hors d’une phrase se touche sur 44 px de haut ; un lien pris dans une phrase, sur toute sa ligne, et
//   toucher son texte n’ouvre jamais un autre lien.
// - Avec le texte à 200 %, du téléphone à l’ordinateur, et de 125 à 200 % sur grand écran : rien ne sort de l’écran,
//   aucun mot n’est coupé (passer à la ligne après un trait d’union n’en coupe pas), aucune ponctuation n’est seule en
//   début de ligne, et l’étiquette « Écran de démonstration » garde son texte dans sa pilule.
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

    // Du téléphone au grand écran : les colonnes suivent la place du texte, pas la largeur de l’écran (avant, à 960 px, la
    // page défilait de côté ; dès 1 728 px avec le texte à 150 % (« Très grande » dans Chrome), les colonnes se réglaient
    // sur l’écran entier : « Écrire à Baromatc/h », « engagemen/t. », « d’habitude » puis « . » seul). Chaque ligne
    // commence après une espace ou un trait d’union : aucun mot coupé, aucune ponctuation seule en début de ligne, et
    // jamais à une espace insécable (avant, à 320 px et 200 % : « Par où commencer » puis « ? » seul).
    const TEXTE_AGRANDI = [[[320, 324, 328, 336, 344, 352, 360], [200]], ...[375, 390, 768, 960, 1024, 1280].map((l) => [[l], [200]]),
      ...[1440, 1728, 1920, 2560].map((l) => [[l], [125, 150, 175, 200]])];
    for (const [largeurs, pourcents] of TEXTE_AGRANDI) {
      test(`à ${largeurs.join(', ')} px, texte à ${pourcents.join(', ')} % : rien ne sort de l’écran, aucun mot coupé ni ponctuation seule en début de ligne, chaque étiquette garde son texte`, async ({ page }) => {
        await ouvrir(page, chemin, largeurs[0], 700);
        await chargerLesImages(page);
        for (const largeur of largeurs) for (const pourcent of pourcents) {
          const ici = `${largeur} px, ${pourcent} %`;
          await page.setViewportSize({ width: largeur, height: 700 });
          await agrandir(page, pourcent);
          const lu = await page.evaluate(() => {
            const ecran = document.documentElement.clientWidth;
            const dehors = [...document.querySelectorAll('main *')].filter((e) => e.getClientRects().length && !e.closest('svg, .visuellement-cache'))
              .filter((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > ecran + 0.5; }).map(nomDe);
            // Chaque signe visible, dans l’ordre, avec son bloc ; puis chaque début de ligne, et ce qui le précède.
            const signes = [];
            const parcours = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
            while (parcours.nextNode()) {
              const noeud = parcours.currentNode;
              if (!noeud.parentElement.getClientRects().length || noeud.parentElement.closest('.visuellement-cache')) continue;
              let bloc = noeud.parentElement;
              while (/^(inline|contents)/.test(getComputedStyle(bloc).display)) bloc = bloc.parentElement;
              for (let i = 0; i < noeud.nodeValue.length; i += 1) {
                if (/[ \t\n\r]/.test(noeud.nodeValue[i])) continue;
                const plage = document.createRange();
                plage.setStart(noeud, i);
                plage.setEnd(noeud, i + 1);
                const r = [...plage.getClientRects()].find((x) => x.width > 0);
                if (r) signes.push({ noeud, i, bloc, milieu: (r.top + r.bottom) / 2, haut: r.height });
              }
            }
            const coupes = [];
            for (let k = 1; k < signes.length; k += 1) {
              const [avant, ici] = [signes[k - 1], signes[k]];
              if (avant.bloc !== ici.bloc || ici.milieu - avant.milieu <= ici.haut / 2) continue;
              const signe = ici.noeud.nodeValue[ici.i];
              const extrait = `${avant.noeud.nodeValue.slice(Math.max(0, avant.i - 14), avant.i + 1)}|${ici.noeud.nodeValue.slice(ici.i, ici.i + 6)}`;
              const espace = avant.noeud !== ici.noeud || /[ \t\n\r]/.test(avant.noeud.nodeValue.slice(avant.i + 1, ici.i));
              if (',.;:!?»)…'.includes(signe)) coupes.push(`« ${signe} » seul en début de ligne : « ${extrait} »`);
              else if (!espace && !/[-‑–—]/.test(avant.noeud.nodeValue[avant.i])) coupes.push(`mot coupé : « ${extrait} »`);
            }
            const etiquettes = [...document.querySelectorAll('main .exemple')].filter((e) => e.checkVisibility()).map((e) => {
              const boite = e.getBoundingClientRect();
              const plage = document.createRange();
              plage.selectNodeContents(e);
              return [...plage.getClientRects()].filter((l) => l.top < boite.top - 0.5 || l.bottom > boite.bottom + 0.5 || l.left < boite.left - 0.5 || l.right > boite.right + 0.5).length;
            });
            return { dehors, coupes, signes: signes.length, etiquettes, defile: document.documentElement.scrollWidth > ecran };
          });
          expect(lu.dehors, ici).toEqual([]);
          expect(lu.defile, `${ici} : la page défile de côté`).toBe(false);
          expect(lu.signes, ici).toBeGreaterThan(2000);
          expect(lu.coupes, `${ici} : des mots coupés`).toEqual([]);
          expect(lu.etiquettes.length, ici).toBeGreaterThan(0);
          expect(lu.etiquettes.filter((n) => n > 0), `${ici} : une étiquette dont le texte sort`).toEqual([]);
        }
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
  // Jusqu’à 699 px, à 100 %, chaque légende reste à côté de son écran (avant, sous 500 px de place seulement).
  for (const largeur of [600, 696]) {
    await ouvrir(page, '/a-propos.html', largeur);
    const cote = await page.$$eval('.apropos__ecran', (li) => li.map((e) => e.querySelector('figcaption').getBoundingClientRect().left >= e.querySelector('.apropos__cadre').getBoundingClientRect().right));
    expect(cote, `${largeur} px`).toEqual([true, true, true]);
  }
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
// les deux polices n’ont pas tout à fait la même largeur : dans une rangée de capsules ou de liens (le sommaire de
// Presse, « Proposer mon bar », « Me prévenir »), chacun glisse de quelques pixels de côté ; aucune ligne ne se coupe
// autrement. 0,0005 au plus (mesuré 0,00004 et 0,00024 ; Google dit « bon » sous 0,1).
const decalageQuandLaPoliceArrive = async (browser, baseURL, chemin, largeur, hauteur) => {
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
    return await onglet.evaluate(() => { window.relever(); return window.decalages.reduce((t, v) => t + v, 0); });
  } finally {
    lacher();
    await Promise.all(retenues);
    await contexte.close();
  }
};
for (const { chemin } of PAGES) {
  for (const [largeur, hauteur] of [[320, 568], [390, 844]]) {
    test(`${chemin} à ${largeur} px : quand la police arrive tard, rien ne bouge (CLS ${largeur < 360 ? '0' : 'sous 0,0005'})`, async ({ browser, baseURL }) => {
      const total = await decalageQuandLaPoliceArrive(browser, baseURL, chemin, largeur, hauteur);
      if (largeur < 360) expect(total).toBe(0);
      else expect(total).toBeLessThanOrEqual(0.0005);
    });
  }
}

// Le chapô de Presse, plus long, se coupait autrement selon la police : à 576 px, quatre lignes dans la police de
// secours et cinq dans Bricolage Grotesque ; à son arrivée, tout le premier écran descendait d’une ligne (CLS 0,018).
// Puis, sous 480 px et à 808 px, le chapô, la phrase des droits ou le sommaire changeaient encore de lignes (CLS 0,015
// à 0,018 de 337 à 464 px, 0,178 à 476 px, 0,026 à 808 px ; 0,04 à 416 et 464 px avec le texte à 200 %). Désormais,
// rien dans l’ouverture ne dépend de la police (presse.css) : le titre a une largeur en em, le chapô et les phrases des
// largeurs calées sur des pas en rem, choisis là où Bricolage Grotesque, Arial et Roboto coupent pareil (mesuré avec
// chacune de 320 à 1 440 px, à 100 et 200 %, avec aussi la phrase des droits de la PR à venir), et chaque capsule du
// sommaire une largeur où son mot tient dans les trois polices. À 576 px, rien ne bouge (les capsules glissent de
// côté : 0,0005 au plus, comme à 390 px).
test('/presse.html à 576 px : quand la police arrive tard, le premier écran ne bouge pas (CLS sous 0,0005)', async ({ browser, baseURL }) => {
  expect(await decalageQuandLaPoliceArrive(browser, baseURL, '/presse.html', 576, 900)).toBeLessThanOrEqual(0.0005);
});

// Une page ouverte deux fois : dans la police de secours (Bricolage Grotesque refusée) et dans Bricolage Grotesque.
const deuxPolices = async (browser, baseURL, chemin, largeur) => {
  const ouvrirAvec = async (secours) => {
    const contexte = await browser.newContext({ baseURL, viewport: { width: largeur, height: 900 }, reducedMotion: 'reduce' });
    const onglet = await contexte.newPage();
    if (secours) await onglet.route('**/fonts/*.woff2', (route) => route.abort());
    await onglet.goto(chemin);
    await onglet.evaluate(() => document.fonts.ready);
    const chargee = await onglet.evaluate(() => [...document.fonts].some((f) => f.family === 'Bricolage Grotesque' && f.status === 'loaded'));
    expect(chargee, secours ? 'la police de secours' : 'Bricolage Grotesque').toBe(!secours);
    return { contexte, onglet };
  };
  const polices = [await ouvrirAvec(true), await ouvrirAvec(false)];
  return { onglets: polices.map((p) => p.onglet), fermer: () => Promise.all(polices.map((p) => p.contexte.close())) };
};

// Presse, de 320 à 1 440 px, toutes les 1 px (avant : de 480 px, toutes les 8 px, qui ne voyaient rien sous 480 px), texte
// à 100 et 200 % : le titre et le chapô ont la même hauteur dans les deux polices, et le sommaire autant de rangées ; à
// 100 %, les deux boutons, la ligne des bars et la phrase des droits (sous les boutons depuis le 1er novembre) aussi (à
// 200 %, ils sont sous le premier écran).
// Avant : 214 écarts. Un texte de l’ouverture qui change peut tomber sur une largeur où les polices coupent autrement :
// ce test le dit, et le pas de presse.css se recale (une largeur où les trois polices coupent pareil).
const OUVERTURE_DE_PRESSE = ['.presse__titre', '.presse__chapo', '.presse__actions', '.presse__bar', '.presse__bar + p'];
for (const pourcent of [100, 200]) {
  test(`Presse, de 320 à 1 440 px, texte à ${pourcent} % : l’ouverture garde ses lignes et le sommaire ses rangées quand la police arrive`, async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    const { onglets, fermer } = await deuxPolices(browser, baseURL, '/presse.html', 320);
    const blocs = pourcent === 100 ? OUVERTURE_DE_PRESSE : OUVERTURE_DE_PRESSE.slice(0, 2);
    const lire = (onglet) => onglet.evaluate((selecteurs) => [...selecteurs.map((s) => document.querySelector(s).getBoundingClientRect().height),
      new Set([...document.querySelectorAll('.presse__sommaire li')].map((li) => Math.round(li.getBoundingClientRect().top))).size], blocs);
    const ecarts = [];
    try {
      for (const onglet of onglets) await agrandir(onglet, pourcent);
      for (let largeur = 320; largeur <= 1440; largeur += 1) {
        for (const onglet of onglets) await onglet.setViewportSize({ width: largeur, height: 900 });
        const [secours, bricolage] = [await lire(onglets[0]), await lire(onglets[1])];
        [...blocs, 'rangées du sommaire'].forEach((nom, i) => {
          if (Math.abs(secours[i] - bricolage[i]) > 0.5) ecarts.push(`${largeur} px, ${nom} : ${Math.round(secours[i])} dans la police de secours, ${Math.round(bricolage[i])} dans Bricolage Grotesque`);
        });
      }
    } finally {
      await fermer();
    }
    expect(ecarts).toEqual([]);
  });
}

// Les deux boutons de l’ouverture de Presse, « Écrire pour la presse » et « Écrire pour un partenariat » : côte à côte
// seulement avec 16 px d’air au moins dans leur rangée, sinon l’un sous l’autre, de la même largeur, alignés à gauche.
// Avant, ils passaient à la ligne comme des mots : juste au-dessus du seuil, ils tenaient côte à côte à 0,5 px près
// (532 et 916 px) ; juste en dessous, la police de secours, un peu plus large, les mettait l’un sous l’autre, et à son
// arrivée le premier écran sautait (CLS 0,109 à 528 px, 0,121 à 912 px) ; l’un sous l’autre, ils n’avaient pas la même
// largeur. Mesuré au téléphone (360, 375, 390, 393, 412, 430 px), puis de 480 à 1 440 px toutes les 4 px, à 100 et 200 %.
// Sur un iPhone 12 à 15 (390 × 664 et 393 × 659 de page, sous la barre de Safari), le second finit 16 px au moins
// au-dessus du bas du premier écran (avant : 3,5 px sur l’iPhone 15).
const lireLesBoutons = (page) => page.evaluate(() => {
  const liste = document.querySelector('.presse__actions').getBoundingClientRect();
  const [a, b] = [...document.querySelectorAll('.presse__actions a')].map((x) => x.getBoundingClientRect());
  return { coteACote: Math.abs(a.top - b.top) < 1, air: liste.right - b.right, gauches: [a.left, b.left], largeurs: [a.width, b.width], ecart: b.top - a.bottom, basDuSecond: b.bottom };
});
const fautesDesBoutons = (lu) => {
  if (lu.coteACote) return lu.air < 16 ? [`côte à côte avec ${lu.air.toFixed(1)} px d’air`] : [];
  const fautes = [];
  if (Math.abs(lu.gauches[0] - lu.gauches[1]) > 0.5) fautes.push('l’un sous l’autre, pas alignés');
  if (Math.abs(lu.largeurs[0] - lu.largeurs[1]) > 0.5) fautes.push(`l’un sous l’autre, de largeurs ${lu.largeurs.map(Math.round).join(' et ')} px`);
  if (lu.ecart < 8) fautes.push(`l’un sous l’autre, à ${lu.ecart.toFixed(1)} px`);
  return fautes;
};
test('Presse : les deux boutons de l’ouverture côte à côte avec 16 px d’air, ou l’un sous l’autre de la même largeur ; sur un iPhone, 16 px sous le second', async ({ page }) => {
  test.setTimeout(120_000);
  const fautes = [];
  for (const [largeur, hauteur] of [[360, 740], [375, 667], [390, 664], [393, 659], [412, 839], [430, 739]]) {
    await ouvrir(page, '/presse.html', largeur, hauteur);
    const lu = await lireLesBoutons(page);
    fautes.push(...fautesDesBoutons(lu).map((f) => `${largeur} px : ${f}`));
    if ([390, 393].includes(largeur) && hauteur - lu.basDuSecond < 16) fautes.push(`${largeur} × ${hauteur} : ${(hauteur - lu.basDuSecond).toFixed(1)} px sous le second bouton`);
  }
  for (const pourcent of [100, 200]) {
    await agrandir(page, pourcent);
    for (let largeur = 480; largeur <= 1440; largeur += 4) {
      await page.setViewportSize({ width: largeur, height: 900 });
      fautes.push(...fautesDesBoutons(await lireLesBoutons(page)).map((f) => `${largeur} px, ${pourcent} % : ${f}`));
    }
  }
  expect(fautes).toEqual([]);
});

for (const largeur of [528, 912]) {
  test(`/presse.html à ${largeur} px : quand la police arrive tard, les deux boutons ne changent pas de rangée (CLS sous 0,0005)`, async ({ browser, baseURL }) => {
    expect(await decalageQuandLaPoliceArrive(browser, baseURL, '/presse.html', largeur, 900)).toBeLessThanOrEqual(0.0005);
  });
}

// Les liens pris dans une phrase, dans ces pages (pas l’en-tête ni le pied, partagés ; ils restent en ligne :
// tests/liens-en-ligne.spec.mjs) : un padding agrandit leur zone à toucher jusqu’à la hauteur de leur ligne, jamais
// au-delà (l’exception « en ligne » de WCAG 2.5.8, comme tests/cibles-tactiles.spec.mjs). Mesuré là où le doigt touche
// (elementFromPoint), pas sur la boîte : sur 7 × 7 points de chaque morceau de texte d’un lien, c’est ce lien qui
// répond ; au milieu de chaque morceau, il répond sur toute la hauteur de sa ligne, à 0,1 em près (le padding compte la
// boîte du texte pour 1,25 em ; celle de Bricolage Grotesque fait de 1,20 à 1,24 em). Avant, ce padding portait la
// boîte à 44 px sur des lignes de 26 px : la boîte d’un lien couvrait le bas du texte du lien de la ligne du dessus, et
// toucher « comment on choisit les bars » ouvrait « pourquoi Baromatch existe » (Presse, de 320 à 528 px) ou les
// « CGU » (À propos) ; le test d’alors lisait la hauteur de la boîte, et passait.
const toucherLesLiens = () => {
  const nom = (e) => e.textContent.replace(/\s+/g, ' ').trim();
  const repond = (x, y) => document.elementFromPoint(x, y)?.closest('a') ?? null;
  const fautes = [];
  let liens = 0;
  for (const a of document.querySelectorAll('main a[href]')) {
    if (getComputedStyle(a).display !== 'inline' || !a.getClientRects().length || a.closest('.visuellement-cache')) continue;
    let bloc = a.parentElement;
    while (/^(inline|contents)/.test(getComputedStyle(bloc).display)) bloc = bloc.parentElement;
    if (nom(bloc) === nom(a)) continue;
    liens += 1;
    const interligne = parseFloat(getComputedStyle(bloc).lineHeight);
    const taille = parseFloat(getComputedStyle(a).fontSize);
    // Le bord de la zone où ce lien répond, depuis un point où il répond, vers le haut (-1) ou le bas (1), au 1/64 px.
    const bord = (x, depart, sens) => {
      let dedans = depart;
      let dehors = depart + sens;
      while (Math.abs(dehors - depart) < interligne && repond(x, dehors) === a) { dedans = dehors; dehors += sens; }
      for (let i = 0; i < 6; i += 1) { const m = (dedans + dehors) / 2; if (repond(x, m) === a) dedans = m; else dehors = m; }
      return dedans;
    };
    a.scrollIntoView({ block: 'center' });
    const morceaux = [];
    const parcours = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    while (parcours.nextNode()) {
      if (!parcours.currentNode.nodeValue.trim() || parcours.currentNode.parentElement.closest('.visuellement-cache')) continue;
      const plage = document.createRange();
      plage.selectNodeContents(parcours.currentNode);
      morceaux.push(...[...plage.getClientRects()].filter((r) => r.width > 2));
    }
    for (const r of morceaux) {
      const points = Array.from({ length: 49 }, (_, k) => [r.left + 1 + ((r.width - 2) * (k % 7)) / 6, r.top + 1 + ((r.height - 2) * Math.floor(k / 7)) / 6]);
      // Un autre lien (au bord du dernier signe, le point qui suit le lien, rapproché par le crénage, répond pour la phrase).
      const ailleurs = points.map(([x, y]) => repond(x, y)).find((c) => c && c !== a);
      if (ailleurs) fautes.push(`toucher « ${nom(a)} » ouvre « ${nom(ailleurs)} »`);
      const x = r.left + r.width / 2;
      const milieu = (r.top + r.bottom) / 2;
      const hauteur = bord(x, milieu, 1) - bord(x, milieu, -1);
      if (hauteur < interligne - 0.1 * taille) fautes.push(`« ${nom(a)} » se touche sur ${hauteur.toFixed(1)} px, sa ligne en fait ${interligne.toFixed(1)}`);
    }
  }
  return { liens, fautes: [...new Set(fautes)] };
};
const LARGEURS_DES_LIENS = [[320, 480, 8], [496, 960, 16], [976, 1440, 16]];
for (const { chemin } of PAGES) for (const [debut, fin, pas] of LARGEURS_DES_LIENS) {
  test(`${chemin}, de ${debut} à ${fin} px, texte à 100, 150 et 200 % : toucher le texte d’un lien pris dans une phrase ouvre ce lien, jamais un autre, sur toute la hauteur de sa ligne`, async ({ page }) => {
    test.setTimeout(120_000);
    await ouvrir(page, chemin, debut);
    const fautes = [];
    for (let largeur = debut; largeur <= fin; largeur += pas) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const pourcent of [100, 150, 200]) {
        await agrandir(page, pourcent);
        const lu = await page.evaluate(toucherLesLiens);
        expect(lu.liens, `${largeur} px, ${pourcent} %`).toBe(7);
        fautes.push(...lu.fautes.map((f) => `${largeur} px, ${pourcent} % : ${f}`));
      }
    }
    expect(fautes).toEqual([]);
  });
}

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

// Sur un ordinateur ou une tablette (×1, ×2), de 320 à 1 920 px, texte à 100 et 200 % : aucune image n’est montrée plus
// grande que le fichier chargé (sa place à l’écran, en pixels de l’écran, ne dépasse pas la largeur du fichier, lue en
// le rechargeant seul). Avant, à 200 % dès 1 400 px, les trois écrans d’À propos prenaient leur colonne entière
// (340 px pour un fichier de 300, ou de 600 à ×2) : leur cadre plafonne à 272 px. Une page chargée par largeur (le
// fichier choisi dépend de la largeur au chargement), mesurée aux deux tailles de texte.
const PLAGES_IMAGES = [[320, 940], [960, 1420], [1440, 1920]];
for (const ratio of [1, 2]) for (const [debut, fin] of PLAGES_IMAGES) {
  test(`×${ratio}, de ${debut} à ${fin} px, texte à 100 et 200 % : aucune image d’À propos ni de Presse montrée plus grande que son fichier`, async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const contexte = await browser.newContext({ baseURL, viewport: { width: debut, height: 900 }, deviceScaleFactor: ratio, reducedMotion: 'reduce' });
    const onglet = await contexte.newPage();
    const agrandies = [];
    let mesurees = 0;
    try {
      for (const { chemin } of PAGES) for (let largeur = debut; largeur <= fin; largeur += 20) {
        await onglet.setViewportSize({ width: largeur, height: 900 });
        await onglet.goto(chemin);
        // Les images paresseuses, demandées toutes, puis chargées.
        await onglet.evaluate(() => { for (const image of document.querySelectorAll('main img')) image.loading = 'eager'; });
        await onglet.waitForFunction(() => [...document.querySelectorAll('main img')].filter((i) => i.getClientRects().length).every((i) => i.complete && i.naturalWidth > 0));
        for (const pourcent of [100, 200]) {
          await agrandir(onglet, pourcent);
          const images = await onglet.evaluate(() => Promise.all([...document.querySelectorAll('main img')]
            .filter((image) => image.getClientRects().length && !/\.svg$/.test(image.currentSrc))
            .map(async (image) => {
              const fichier = new Image();
              fichier.src = image.currentSrc;
              await fichier.decode();
              return { src: image.currentSrc.replace(/^.*\//, ''), fichier: fichier.naturalWidth, place: image.getBoundingClientRect().width * devicePixelRatio };
            })));
          mesurees += images.length;
          for (const image of images) {
            if (image.place > image.fichier + 1) agrandies.push(`${chemin} à ${largeur} px, ${pourcent} % : ${image.src} (${image.fichier} px) montré sur ${Math.round(image.place)} px`);
          }
        }
      }
    } finally {
      await contexte.close();
    }
    expect(mesurees).toBeGreaterThan(100);
    expect(agrandies).toEqual([]);
  });
}

// L’étiquette « Écran de démonstration » est posée sur le bord du cadre, jamais sur l’écran (la règle de la marque) :
// sur À propos, son bas est dans le bord haut du téléphone (6 px, entre le haut du téléphone et celui de l’écran), sur une
// ligne comme sur deux, et rien au-dessus d’elle ne la touche ; sur Presse, elle est au-dessus du téléphone. De 320 à
// 1 440 px, texte à 100 et 200 %. Avant, sur À propos, elle était posée à cheval sur l’écran : 6 px de l’écran cachés
// sur une ligne, 46 px sur deux (le texte à 200 %, dès 712 px).
for (const { chemin } of PAGES) {
  test(`${chemin}, de 320 à 1 440 px, texte à 100 et 200 % : chaque étiquette « Écran de démonstration » posée sur le bord du cadre, jamais sur l’écran`, async ({ page }) => {
    await ouvrir(page, chemin, 320);
    const fautes = [];
    let mesurees = 0;
    for (let largeur = 320; largeur <= 1440; largeur += 8) {
      await page.setViewportSize({ width: largeur, height: 900 });
      for (const pourcent of [100, 200]) {
        await agrandir(page, pourcent);
        const lu = await page.evaluate(() => [...document.querySelectorAll('main figure')].filter((f) => f.querySelector('.exemple')).map((figure) => {
          const etiquette = figure.querySelector('.exemple').getBoundingClientRect();
          const telephone = figure.querySelector('.telephone').getBoundingClientRect();
          const ecran = figure.querySelector('.telephone__ecran').getBoundingClientRect();
          // Ce qui est juste au-dessus : l’écran d’avant s’il est dans la même colonne, sinon le titre de la section.
          const li = figure.closest('li');
          const avant = [li.previousElementSibling, li.parentElement.previousElementSibling].find((e) => {
            const r = e?.getBoundingClientRect();
            return r && r.left < etiquette.right && r.right > etiquette.left;
          })?.getBoundingClientRect();
          return { nom: figure.querySelector('img').getAttribute('src').replace(/^.*\//, ''), bas: etiquette.bottom, haut: etiquette.top, telephone: telephone.top, ecran: ecran.top, avant: avant?.bottom ?? -Infinity };
        }));
        mesurees += lu.length;
        for (const e of lu) {
          const ici = `${largeur} px, ${pourcent} %, ${e.nom}`;
          if (e.bas > e.ecran + 0.5) fautes.push(`${ici} : l’étiquette cache ${Math.round(e.bas - e.ecran)} px du haut de l’écran`);
          if (chemin === '/a-propos.html' && e.bas < e.telephone - 0.5) fautes.push(`${ici} : l’étiquette flotte ${Math.round(e.telephone - e.bas)} px au-dessus du cadre`);
          if (e.haut < e.avant - 0.5) fautes.push(`${ici} : l’étiquette touche ce qui est au-dessus d’elle`);
        }
      }
    }
    expect(mesurees).toBeGreaterThan(500);
    expect(fautes).toEqual([]);
  });
}

// L’étiquette « Écran de démonstration » d’À propos est dans le flux : sur trois colonnes, elle est centrée sur le bord du
// cadre et peut le déborder de 8 px de chaque côté, comme au téléphone. Avant, posée dans le coin (24 px de chaque
// côté), elle passait à la ligne dans Bricolage Grotesque et pas dans la police de secours (768 px à 100 %, 880 px à
// 125 %) : à l’arrivée de la police, les trois écrans descendaient de 11 à 18 px. De 320 à 1 440 px, texte à 100, 125,
// 150 et 200 % : autant de lignes dans les deux polices, et une seule à 100 %.
test('À propos, de 320 à 1 440 px, texte à 100, 125, 150 et 200 % : l’étiquette des écrans a autant de lignes dans les deux polices, une seule à 100 %', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const { onglets, fermer } = await deuxPolices(browser, baseURL, '/a-propos.html', 320);
  const lire = (onglet) => onglet.$$eval('.apropos__cadre .exemple', (etiquettes) => etiquettes.map((e) => {
    const plage = document.createRange();
    plage.selectNodeContents(e);
    return new Set([...plage.getClientRects()].map((r) => Math.round(r.top))).size;
  }));
  const fautes = [];
  try {
    for (const pourcent of [100, 125, 150, 200]) {
      for (const onglet of onglets) await agrandir(onglet, pourcent);
      for (let largeur = 320; largeur <= 1440; largeur += 8) {
        for (const onglet of onglets) await onglet.setViewportSize({ width: largeur, height: 900 });
        const [secours, bricolage] = [await lire(onglets[0]), await lire(onglets[1])];
        expect(secours.length).toBe(3);
        if (secours.join() !== bricolage.join()) fautes.push(`${largeur} px, ${pourcent} % : ${secours.join(', ')} lignes dans la police de secours, ${bricolage.join(', ')} dans Bricolage Grotesque`);
        else if (pourcent === 100 && bricolage.some((n) => n > 1)) fautes.push(`${largeur} px, 100 % : ${bricolage.join(', ')} lignes`);
      }
    }
  } finally {
    await fermer();
  }
  expect(fautes).toEqual([]);
});

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

// Le nombre de lignes d’un texte : ses morceaux de texte, regroupés quand ils se chevauchent en hauteur (le texte d’un
// lien et celui de sa phrase, sur la même ligne, comptent pour une).
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
// Les trois cartes vont côte à côte seulement dès 72 rem (1 152 px à 100 %), là où chaque petite phrase tient sur une ligne.
for (const largeur of [320, 375, 390, 820, 1024, 1280]) {
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
  // Des petites capitales fabriquées à 70 % : à 1,125 rem, chaque titre est au moins aussi grand que dans ses capitales
  // de 13 px d’avant (la largeur rendue du même texte, en capitales, 0,8125 rem, mêmes graisse et espacement).
  for (const largeur of [390, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    const tailles = await page.$$eval('.apropos__rail', (titres) => titres.map((titre) => {
      const plage = document.createRange();
      plage.selectNodeContents(titre);
      const rendu = plage.getBoundingClientRect().width;
      const avant = document.createElement('span');
      Object.assign(avant.style, { position: 'absolute', whiteSpace: 'nowrap', fontSize: '0.8125rem', fontWeight: '700', letterSpacing: '0.14em', textTransform: 'uppercase', fontVariantCaps: 'normal' });
      avant.textContent = titre.textContent;
      document.body.append(avant);
      const largeurAvant = avant.getBoundingClientRect().width;
      avant.remove();
      return { titre: titre.textContent, lignes: plage.getClientRects().length, rendu: Math.round(rendu), avant: Math.round(largeurAvant) };
    }));
    // Un titre sur une ligne se mesure à sa largeur ; sur deux (le rail de 12 rem sur ordinateur), il est au moins aussi haut.
    for (const t of tailles.filter((x) => x.lignes === 1)) expect(t.rendu, `${t.titre} à ${largeur} px`).toBeGreaterThanOrEqual(t.avant);
    expect(await page.locator('.apropos__rail').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  }
});
