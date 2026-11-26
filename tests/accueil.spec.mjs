// L’accueil « La salle » (piste C) : la page fait l’heure, de 18:42 au coup d’envoi, en cinq moments. La salle d’un bar,
// dessinée (42 places, deux clubs inventés), reste à l’écran pendant qu’on descend et se remplit ; le geste « Maintiens »
// garde ta place ; le sous-bock se retourne ; au coup d’envoi, la salle s’éteint et l’écran du fond s’allume. Ce fichier
// vérifie la page elle-même : son premier écran, ses cinq moments, ses états, son geste, ce qu’elle ne montre plus, sa
// vérité (« Exemple », « Démo »), et la page sans script. Les matchs et la semaine (le bloc du générateur) : tests/accueil-semaine.spec.mjs.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CLUBS_DE_DEMO } from '../generateur/insigne.mjs';
import { salleDeLaPage } from '../generateur/outils/salle.mjs';
import { racine } from './outils/environnement.mjs';

const ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8');
const CSS = readFileSync(path.join(racine, 'accueil.css'), 'utf8');
const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();
const MOMENTS = [
  ['1842', '18:42', 'Ton match. Ton bar. Ce soir.'],
  ['1930', '19:30', 'Choisis ton match'],
  ['2015', '20:15', 'Garde ta place'],
  ['2055', '20:55', 'Tu y es'],
  ['2100', '21:00 · coup d’envoi', 'Cette salle, c’est peut-être la tienne'],
];
const etat = (page) => page.locator('.veillee').getAttribute('data-etat');
// Faire défiler jusqu’à un moment, comme un doigt : son titre juste sous la salle.
const aller = async (page, heure) => {
  await page.evaluate((h) => {
    const m = document.querySelector(`[data-heure="${h}"]`);
    const salle = document.querySelector('.salle').getBoundingClientRect();
    const grand = window.matchMedia('(min-width: 960px)').matches;
    window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - (grand ? window.innerHeight * 0.4 : salle.height + 24), behavior: 'instant' });
  }, heure);
  await expect(page.locator('.veillee')).toHaveAttribute('data-etat', heure);
};
const visibles = (page) => page.evaluate(() => [...document.querySelectorAll('.salle .gens')].filter((e) => Number(getComputedStyle(e).opacity) > 0.99).length);

test.describe('la page', () => {
  test('cinq moments, de 18:42 au coup d’envoi, chacun avec son heure et son titre ; un seul h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    const moments = page.locator('.moment');
    await expect(moments).toHaveCount(5);
    for (const [i, [heure, texte, titre]] of MOMENTS.entries()) {
      const moment = moments.nth(i);
      await expect(moment).toHaveAttribute('data-heure', heure);
      await expect(moment.locator(i === 0 ? 'h1' : 'h2')).toHaveText(titre);
      if (i) expect(normaliser(await moment.locator('.moment__heure').innerText())).toBe(texte);
    }
    // La promesse de la marque, et ce que l’appli est aujourd’hui : gratuite, bientôt sur les stores, rien à réserver ce soir.
    expect(normaliser(await page.locator('.moment--ouverture .chapo').innerText())).toBe('Une appli gratuite pour les fans : trouve un bar qui diffuse ton match et garde ta place. Bientôt sur les stores : rien à réserver ce soir.');
    expect(normaliser(await page.locator('.attente__plateformes').innerText())).toBe('L’appli Baromatch existe sur iPhone et Android. Elle arrive bientôt sur l’App Store et Google Play, d’abord à Paris.');
    await expect(page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(0);
    expect(normaliser(await page.evaluate(() => document.body.innerText))).not.toContain('!');
  });

  for (const ecran of [{ largeur: 390, hauteur: 844 }, { largeur: 360, hauteur: 640 }, { largeur: 1440, hauteur: 900 }]) {
    test(`à ${ecran.largeur} × ${ecran.hauteur} : le titre, la salle et l’inscription (le seul bouton ambre) sont dans le premier écran`, async ({ page }) => {
      await page.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const bas = (sel) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().bottom);
      expect(await bas('h1')).toBeLessThanOrEqual(ecran.hauteur);
      await expect(page.locator('.salle__dessin')).toBeInViewport();
      // Sur un petit écran (640 px), l’inscription commence dans le premier écran ; dès 844 px, le champ et le bouton y sont en entier.
      await expect(page.locator('.moment--ouverture .attente')).toBeInViewport();
      if (ecran.hauteur >= 800) {
        await expect(page.locator('#attente-mail')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.attente__bouton')).toBeInViewport({ ratio: 1 });
      }
      // Un seul bouton ambre dans la page au repos : celui de la liste d’attente ; ni la salle ni le geste n’en ont avant l’action du visiteur.
      const ambres = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
        const f = getComputedStyle(e).backgroundColor;
        const r = e.getBoundingClientRect();
        return f === 'rgb(255, 177, 61)' && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight && r.left >= 0 && r.left < window.innerWidth;
      }).map((e) => e.className));
      expect(ambres.filter((c) => c !== 'attente__bouton'), 'rien d’autre n’est ambre dans le premier écran').toEqual([]);
      if (ecran.hauteur >= 800) expect(ambres).toEqual(['attente__bouton']);
    });
  }

  test('ce que la page ne montre plus : le film, l’appli en vitrine, « en bref », les questions, ni leurs données structurées', async ({ page }) => {
    await page.goto('/');
    for (const sel of ['video', '#film', '.film', '.appli', '.en-bref', '.questions-fans', 'details.faire', '.g-tel']) await expect(page.locator(sel), sel).toHaveCount(0);
    expect(ACCUEIL).not.toMatch(/FAQPage|"@type": "Question"|id="questions"|Baromatch en bref|Tes questions/);
    const types = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].map((x) => x['@type']));
    expect(types).toEqual(['Organization', 'WebSite', 'MobileApplication']);
    // Ce que la page dit encore, les données structurées le disent : sa promesse, et seulement elle.
    expect(ACCUEIL).toContain('"slogan": "Ton match. Ton bar. Ce soir."');
  });

  test('la vérité : « Exemple » sur la salle et sur le sous-bock, « Démo » sur le geste ; aucun écusson, aucun mot qui pousse à boire', async ({ page }) => {
    await page.goto('/');
    expect(normaliser(await page.locator('.salle__legende').innerText())).toBe('Exemple : une salle de 42 places, deux clubs inventés.');
    expect(normaliser(await page.locator('.sousbock figcaption').innerText())).toMatch(/^Exemple : le sous-bock d’une soirée, aux couleurs de deux clubs inventés/);
    expect(normaliser(await page.locator('.maintien__aide').innerText())).toContain('Démo : rien n’est réservé.');
    // 42 places : 36 chaises autour de neuf tables, six places debout au comptoir ; la tienne est l’une d’elles.
    const places = await page.evaluate(() => ({
      chaises: document.querySelectorAll('.s-chaise').length, toi: document.querySelectorAll('.toi').length,
      gens: document.querySelectorAll('.salle__dessin use.gens').length, debout: document.querySelectorAll('.salle__dessin use.gens[href="#gens-debout"]').length,
    }));
    expect(places.toi).toBe(1);
    expect(places.debout).toBe(6);
    expect(places.chaises + places.toi + places.debout).toBe(42);
    const texte = normaliser(await page.evaluate(() => document.body.innerText));
    expect(texte).not.toMatch(/happy hour|tournée|verre offert|bière|apéro|cocktail|alcool/i);
    expect(ACCUEIL).not.toMatch(/Soir de Match|<img[^>]*(ecusson|blason)/i);
    expect(ACCUEIL).not.toMatch(/<(video|img)\b/);
  });

  test('la salle de la page est celle que l’outil dessine (generateur/outils/salle.mjs) : rien à la main, et jamais l’ambre dans la lumière', () => {
    expect(ACCUEIL).toContain(salleDeLaPage());
    const dessin = salleDeLaPage();
    expect(dessin).not.toMatch(/FFB13D|ffb13d/i);
    expect(dessin).not.toMatch(/<(image|text|title)\b|style=/);
    // L’ambre du style : l’action du visiteur et sa place, rien d’autre.
    const usages = [...CSS.matchAll(/([^{}]+)\{[^}]*var\(--ambre\)[^}]*\}/g)].map(([, sel]) => sel.trim().replace(/\s+/g, ' '));
    expect(usages).toEqual(['.toi-plein', '.tenir__niveau', '.tenir.plein']);
    expect(CSS).not.toMatch(/#FFB13D/i);
  });

  test('les deux clubs de la salle sont les deux clubs inventés de l’appli : Alvène (vert et corail), Orvèle (indigo et lime), aux couleurs de leurs insignes', () => {
    const [a, b] = CLUBS_DE_DEMO.map((c) => c.fiche.colours);
    expect(CSS).toContain(`--camp-a: ${a.primary}; --camp-a2: ${a.secondary}; --camp-b: ${b.primary}; --camp-b2: ${b.secondary};`);
    expect(CLUBS_DE_DEMO.map((c) => c.cle)).toEqual(['alvene', 'orvele']);
  });
});

test.describe('la salle suit l’heure', () => {
  test('la salle reste à l’écran pendant qu’on descend : en haut au téléphone, à gauche sur ordinateur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await aller(page, '2015');
    const haut = await page.locator('.salle').evaluate((e) => Math.round(e.getBoundingClientRect().top));
    expect(haut).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await aller(page, '2055');
    const boite = await page.locator('.salle').evaluate((e) => { const r = e.getBoundingClientRect(); return { haut: Math.round(r.top), gauche: r.left, droite: r.right, hauteur: r.height }; });
    expect(boite.haut).toBe(0);
    expect(boite.droite).toBeLessThan(900);
    const moments = await page.locator('.moments').evaluate((e) => e.getBoundingClientRect().left);
    expect(moments).toBeGreaterThan(boite.droite - 1);
  });

  test('chaque moment qui entre à l’écran donne son heure à la salle ; la salle se remplit des deux camps, puis les lumières baissent', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await etat(page)).toBe('1842');
    const gens = [];
    for (const [heure] of MOMENTS) {
      await aller(page, heure);
      await expect(page.locator(`.salle__heure .h${heure}`)).toBeVisible();
      await page.waitForTimeout(1000);
      gens.push(await visibles(page));
    }
    expect(gens[0]).toBeGreaterThanOrEqual(5);
    expect(gens[0]).toBeLessThan(gens[1]);
    expect(gens[1]).toBeLessThan(gens[2]);
    expect(gens[2]).toBeLessThan(gens[3]);
    expect(gens[4]).toBe(gens[3]);
    // Les deux camps sont là, aux couleurs de leur club.
    const camps = await page.evaluate(() => ['a', 'b'].map((c) => document.querySelectorAll(`.salle use.gens.${c}`).length));
    expect(camps[0]).toBeGreaterThan(8);
    expect(camps[1]).toBeGreaterThan(8);
    // Remonter les rejoue : la salle redevient ce qu’elle était à 18:42.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('.veillee')).toHaveAttribute('data-etat', '1842');
    await page.waitForTimeout(1000);
    expect(await visibles(page)).toBe(gens[0]);
  });

  test('18:42 : éclairée chaud, pas ambre ; 21:00 : les lumières baissent, l’écran du fond s’allume aux couleurs des deux clubs, sa lumière coule sur le sol et découpe les silhouettes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const lire = () => page.evaluate(() => {
      const o = (s) => Number(getComputedStyle(document.querySelector(s)).opacity);
      return { nuit: o('.s-nuits'), jeu: o('.s-jeu'), coule: o('.s-coule'), contre: o('.s-contre'), lueur: o('.s-lueur'), reflet: o('.s-reflet') };
    });
    await page.waitForTimeout(900);
    const tot = await lire();
    expect(tot).toMatchObject({ nuit: 0, jeu: 0, coule: 0, contre: 0 });
    expect(tot.lueur).toBeGreaterThan(0.5);
    // Les appliques : un blanc chaud, jamais l’ambre de la marque.
    const chaud = await page.evaluate(() => [...document.querySelectorAll('#s-chaud stop')].map((s) => s.getAttribute('stop-color')));
    expect(chaud.length).toBeGreaterThan(1);
    for (const c of chaud) { const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); expect(r).toBeGreaterThan(240); expect(g).toBeGreaterThan(230); expect(b).toBeGreaterThan(195); }
    await aller(page, '2055');
    await page.waitForTimeout(900);
    const avant = await lire();
    expect(avant.nuit).toBeGreaterThan(0.1);
    expect(avant.nuit).toBeLessThan(0.4);
    expect(avant.jeu).toBe(0);
    await aller(page, '2100');
    await page.waitForTimeout(900);
    const nuit = await lire();
    expect(nuit.nuit).toBeGreaterThan(0.5);
    expect(nuit.jeu).toBe(1);
    expect(nuit.coule).toBeGreaterThan(0.4);
    expect(nuit.contre).toBe(1);
    expect(nuit.lueur).toBeLessThan(0.2);
    expect(nuit.reflet).toBe(0);
    // L’écran a les couleurs des deux clubs.
    const couleurs = await page.evaluate(() => ['.s-jeu-a', '.s-jeu-a2', '.s-jeu-b', '.s-jeu-b2'].map((s) => getComputedStyle(document.querySelector(s)).fill));
    expect(couleurs).toEqual(['rgb(15, 139, 126)', 'rgb(255, 127, 102)', 'rgb(58, 63, 168)', 'rgb(198, 228, 90)']);
  });

  test('les gens se posent (transform et opacité seulement), rien ne glisse ni ne bouge seul', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.getAnimations().length), 'aucune animation au repos').toBe(0);
    const proprietes = await page.evaluate(() => [...new Set([...document.querySelectorAll('.salle .gens, .salle .s-nuits, .salle .s-jeu, .sousbock__tour')].map((e) => getComputedStyle(e).transitionProperty))]);
    for (const p of proprietes) expect(p).toMatch(/^(opacity, transform|opacity|transform)$/);
    expect(CSS).not.toMatch(/@keyframes|animation\s*:/);
    // Seuls transform et opacité bougent : aucune règle ne fait transitionner autre chose.
    for (const [, valeur] of CSS.matchAll(/transition:\s*([^;}]+)/g)) {
      for (const part of valeur.split(',')) expect(part.trim().split(/\s+/)[0], valeur).toMatch(/^(opacity|transform|none)$/);
    }
  });

  test('« réduire les animations » : l’état change sans fondu, et le sous-bock se retourne d’un coup', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const durees = await page.evaluate(() => ['.gens', '.s-nuits', '.s-jeu', '.sousbock__tour', '.toi-plein'].map((s) => getComputedStyle(document.querySelector(s)).transitionDuration));
    for (const d of durees) expect(d.split(',').every((x) => parseFloat(x) === 0), d).toBe(true);
    await aller(page, '2100');
    expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.s-jeu')).opacity))).toBe(1);
    expect(await visibles(page)).toBeGreaterThan(30);
  });
});

test.describe('le geste « Maintiens »', () => {
  const ouvrir = async (page, reduit = false) => {
    if (reduit) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await aller(page, '2015');
    await page.evaluate(() => { const r = document.querySelector('[data-maintiens]').getBoundingClientRect(); window.scrollBy(0, r.top - window.innerHeight * 0.55); });
    return page.locator('[data-maintiens]');
  };
  const place = (page) => page.evaluate(() => ({ gardee: document.documentElement.classList.contains('place-gardee'), plein: Number(getComputedStyle(document.querySelector('.toi-plein')).opacity) }));

  test('le texte du geste, l’aide et sa démo ; une cible de 44 px au moins', async ({ page }) => {
    const bouton = await ouvrir(page);
    expect(normaliser(await bouton.innerText())).toBe('Maintiens · 2 places jusqu’à 21:30');
    await expect(bouton).toHaveAttribute('aria-describedby', 'maintien-aide');
    expect((await bouton.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await place(page)).toEqual({ gardee: false, plein: 0 });
  });

  test('tenu jusqu’au bout (souris), ta place passe à l’ambre dans la salle ; lâché trop tôt, rien ne change', async ({ page }) => {
    const bouton = await ouvrir(page);
    const r = await bouton.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    await expect(page.locator('[data-statut]')).toHaveText('Trop tôt : maintiens jusqu’en haut.');
    expect(await place(page)).toEqual({ gardee: false, plein: 0 });
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();
    await expect(page.locator('[data-statut]')).toHaveText('Place gardée.');
    await expect(bouton).toHaveClass(/plein/);
    await page.waitForTimeout(900);
    expect((await place(page)).gardee).toBe(true);
    expect((await place(page)).plein).toBe(1);
    // Elle est cochée quand tu y es (20:55), et l’ambre n’est nulle part ailleurs dans la salle.
    await aller(page, '2055');
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.toi-coche')).opacity))).toBe(1);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.toi-plein')).fill)).toBe('rgb(255, 177, 61)');
  });

  test('au clavier : la barre d’espace tenue, puis relâchée', async ({ page }) => {
    const bouton = await ouvrir(page);
    await bouton.focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(1700);
    await page.keyboard.up('Space');
    await expect(page.locator('[data-statut]')).toHaveText('Place gardée.');
  });

  test('avec « réduire les animations », un appui suffit', async ({ page }) => {
    const bouton = await ouvrir(page, true);
    await bouton.click();
    await expect(page.locator('[data-statut]')).toHaveText('Place gardée.');
    expect((await place(page)).gardee).toBe(true);
  });
});

test.describe('le sous-bock', () => {
  test('il se retourne quand 20:55 entre à l’écran : le dos du carton avant, les couleurs des deux clubs, l’heure et la date ensuite', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const tour = () => page.locator('.sousbock__tour').evaluate((e) => getComputedStyle(e).transform);
    await page.waitForTimeout(1100);
    const retourne = await tour();
    await aller(page, '2055');
    await page.waitForTimeout(1200);
    const face = await tour();
    expect(face).not.toBe(retourne);
    // Retourné : une matrice 3D avec un demi-tour autour de Y (cos π = −1) ; face visible : plus de demi-tour.
    expect(parseFloat(retourne.split(',')[0].replace('matrix3d(', '').replace('matrix(', ''))).toBeLessThan(-0.9);
    expect(parseFloat(face.split(',')[0].replace('matrix3d(', '').replace('matrix(', ''))).toBeGreaterThan(0.9);
    await expect(page.locator('.sousbock__face .sb-heure')).toHaveText('21:00');
    await expect(page.locator('.sousbock__face .sb-clubs')).toHaveText('Alvène – Orvèle');
    // La date est celle d’aujourd’hui, à Paris, dite comme on la dit.
    const date = await page.locator('[data-jour]').textContent();
    expect(date).toMatch(/^(lun|mar|mer|jeu|ven|sam|dim)\.? \d{1,2} (janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/i);
    // Du carton, des couleurs de club : jamais une boisson (ni verre, ni bouteille, ni mousse) dans le dessin.
    const dessin = await page.locator('.sousbock').innerHTML();
    expect(dessin).not.toMatch(/verre|bouteille|mousse|bi[èe]re/i);
  });
});

test.describe('la fin : la porte pour les bars', () => {
  test('« Proposer mon bar » mène droit au formulaire de « Pour les bars » (l’adresse ne bouge pas), la semaine à tous les matchs ; l’ancre #bars reste', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('section#bars').getByRole('link', { name: 'Proposer mon bar' })).toHaveAttribute('href', '/pour-les-bars.html#proposer');
    await expect(page.getByRole('link', { name: /Tous les matchs, clubs et villes/ })).toHaveAttribute('href', '/matchs/');
    await expect(page.locator('section#bars')).toHaveCount(1);
    // La barre du haut : « Préviens-moi » mène au formulaire, qui est dans le premier moment.
    await expect(page.locator('a[href="#attente"]').first()).toBeVisible();
    await expect(page.locator('.moment--ouverture #attente')).toHaveCount(1);
  });
});

test.describe('sans script', () => {
  test.use({ javaScriptEnabled: false });
  test('la page est complète : cinq moments, la salle à moitié pleine, le formulaire, la liste, le sous-bock face visible, pas d’heure qui ment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.moment')).toHaveCount(5);
    for (const [i, , titre] of MOMENTS.entries()) await expect(page.locator('.moment').nth(i).locator(i === 0 ? 'h1' : 'h2')).toHaveText(MOMENTS[i][2]);
    await expect(page.locator('#attente-mail')).toBeVisible();
    await expect(page.locator('.match').first()).toBeAttached();
    expect(await visibles(page)).toBeGreaterThan(15);
    await expect(page.locator('.salle__heure span:visible')).toHaveCount(0);
    expect(await page.locator('.sousbock__tour').evaluate((e) => getComputedStyle(e).transform)).not.toMatch(/-1,/);
    await expect(page.locator('[data-jour]')).toHaveText('Ce soir');
    // Le geste a besoin du script : sans lui, le bouton ne promet rien de plus que ce qu’il fait (il est une démo, dite telle).
    await expect(page.locator('.maintien__aide')).toContainText('Démo : rien n’est réservé.');
  });
});
