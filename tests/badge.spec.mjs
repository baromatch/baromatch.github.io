// Le badge fixe des bars (/badge/baromatch.svg) et le bloc « Partager mon badge » de « Pour les bars ».
// Le badge vivant de chaque bar (/bar/<slug>/badge.svg, écrit par le générateur) reprend exactement ce dessin : ses
// mesures sont écrites ici (DESSIN). Tant que l’appli n’est pas ouverte, aucun badge ne dit « Réserve ta place » ; son
// nom de fichier est neutre, il restera des années chez les bars. Le lien et le texte du badge portent le nom de
// Baromatch, jamais des mots-clés, et aucun paramètre de suivi (règle de Google sur les liens dans les widgets).
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { racine } from './outils/environnement.mjs';
import { MARQUE } from './outils/marque.mjs';

const duDepot = (...morceaux) => path.join(racine, ...morceaux);
const SVG = readFileSync(duDepot('badge', 'baromatch.svg'), 'utf8');
const PAGE = '/pour-les-bars.html';

const DESSIN = {
  largeur: 360,
  hauteur: 72,
  fond: '#0A0B10',
  texte: '#F7F7F9',
  ambre: '#FFB13D',
  police: '\'Bricolage Grotesque\', system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif',
  titre: 'On diffuse le match · sur Baromatch',
};
const CODE = {
  lien: 'https://baromatch.fr/regarder-le-match/',
  image: 'https://baromatch.fr/badge/baromatch.svg',
  alt: 'Baromatch',
};
const PHRASE_VIVANT = 'Quand ton bar est sur Baromatch, sa page a son propre badge, qui montre ton prochain match.';

// Les tracés du verre du pied de page de l’accueil (.pied__marque) : le badge dessine le même verre.
const traces = (source) => [...source.matchAll(/<path d="([^"]+)"/g)].map(([, d]) => d);
const VERRE = (() => {
  const accueil = readFileSync(duDepot('index.html'), 'utf8');
  const debut = accueil.indexOf('<div class="pied__marque">');
  return traces(accueil.slice(debut, accueil.indexOf('</svg>', debut)));
})();

test.describe('le badge fixe', () => {
  test('360 × 72, la nuit, un bord fin blanc à 14 %, en pilule ; le verre de la marque à gauche', () => {
    expect(SVG).toMatch(new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" width="${DESSIN.largeur}" height="${DESSIN.hauteur}" viewBox="0 0 ${DESSIN.largeur} ${DESSIN.hauteur}" role="img"`));
    expect(SVG).toContain(`<rect x="0.5" y="0.5" width="${DESSIN.largeur - 1}" height="${DESSIN.hauteur - 1}" rx="${(DESSIN.hauteur - 1) / 2}" fill="${DESSIN.fond}" stroke="#FFFFFF" stroke-opacity="0.14"/>`);
    expect(VERRE).toHaveLength(3);
    expect(traces(SVG)).toEqual(VERRE);
    // Le verre tient dans la pilule, à gauche : 44 px de haut, centré.
    expect(SVG).toContain('<g transform="translate(16 14) scale(0.22)">');
  });

  test('son texte : blanc puis « sur Baromatch » en ambre, dans la police de la marque, avec un titre pour les lecteurs d’écran', () => {
    expect(SVG).toContain(`<title id="titre">${DESSIN.titre}</title>`);
    expect(SVG).toContain('aria-labelledby="titre"');
    expect(SVG).toContain(`font-family="${DESSIN.police}"`);
    const textes = [...SVG.matchAll(/<text [^>]*fill="([^"]+)">([^<]+)<\/text>/g)].map(([, couleur, texte]) => [couleur, texte]);
    expect(textes).toEqual([[DESSIN.texte, 'On diffuse le match'], [DESSIN.ambre, 'sur Baromatch']]);
  });

  test('rien de promis tant que l’appli n’est pas ouverte, un nom de fichier neutre, rien d’interne', () => {
    if (!MARQUE.appli.ouverte) expect(SVG).not.toMatch(/r[ée]serv/i);
    expect(existsSync(duDepot('badge', 'reserve-ta-place.svg'))).toBe(false);
    expect(SVG).not.toContain('<!--');
    expect(SVG).not.toMatch(/<script|href=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  });

  test('le navigateur le dessine à sa taille, sans couper le texte', async ({ page }) => {
    await page.goto(PAGE);
    const mesure = await page.evaluate(async () => {
      const image = new Image();
      image.src = '/badge/baromatch.svg';
      await image.decode();
      // Le texte, mesuré dans le SVG lui-même : il finit avant le bord de la pilule, dans la police de la marque comme
      // dans celles qui la remplacent (une image ne charge pas de police : chez un bar, c’est souvent l’une d’elles).
      const hote = document.createElement('div');
      hote.innerHTML = await (await fetch('/badge/baromatch.svg')).text();
      document.body.append(hote);
      const fins = [];
      for (const police of [null, 'system-ui', 'Arial', 'sans-serif']) {
        if (police) hote.querySelector('g[font-family]').setAttribute('font-family', police);
        fins.push(...[...hote.querySelectorAll('text')].map((t) => t.getBBox().x + t.getBBox().width));
      }
      hote.remove();
      return { largeur: image.naturalWidth, hauteur: image.naturalHeight, fins };
    });
    expect([mesure.largeur, mesure.hauteur]).toEqual([DESSIN.largeur, DESSIN.hauteur]);
    for (const fin of mesure.fins) expect(fin).toBeLessThan(DESSIN.largeur - 24);
  });
});

test.describe('« Partager mon badge » sur « Pour les bars »', () => {
  test('le bloc : à quoi sert le badge, l’aperçu, le code, l’image de story, et le badge propre à chaque bar', async ({ page }) => {
    await page.goto(PAGE);
    await attendreLaPageFinie(page);
    const bloc = page.locator('section#badge');
    await expect(bloc.locator('h2')).toHaveText('Partager mon badge');
    await expect(bloc.locator('.badge__intro')).toContainText('Tu ne paies rien');
    await expect(bloc.locator('.badge__vivant')).toHaveText(PHRASE_VIVANT);
    // L’aperçu est le badge lui-même, qui se charge.
    const apercu = bloc.locator('.badge__apercu');
    await expect(apercu).toHaveAttribute('role', 'img');
    expect(await apercu.evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/\/badge\/baromatch\.svg"\)$/);
    expect((await page.request.get('/badge/baromatch.svg')).headers()['content-type']).toMatch(/^image\/svg\+xml/);
    // L’image de story se télécharge, et son aperçu se charge.
    await expect(bloc.locator('a#badge-story')).toHaveAttribute('href', '/badge/story-baromatch.png');
    await expect(bloc.locator('a#badge-story')).toHaveAttribute('download', '');
    expect(await bloc.locator('.badge__story').evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/\/badge\/story-baromatch-apercu\.webp"\)$/);
    expect((await page.request.get('/badge/story-baromatch-apercu.webp')).status()).toBe(200);
  });

  test('le code à coller : un lien vers « Où regarder le match », sans suivi, et l’image du badge nommée Baromatch', async ({ page }) => {
    await page.goto(PAGE);
    const code = page.locator('#badge-code');
    await expect(code).toHaveAttribute('readonly', '');
    const lu = await code.evaluate((zone) => {
      const modele = document.createElement('template');
      modele.innerHTML = zone.value;
      const liens = [...modele.content.querySelectorAll('a')];
      const images = [...modele.content.querySelectorAll('img')];
      return {
        brut: zone.value,
        liens: liens.map((a) => ({ href: a.getAttribute('href'), texte: a.textContent, attributs: a.getAttributeNames() })),
        images: images.map((i) => ({ src: i.getAttribute('src'), largeur: i.getAttribute('width'), hauteur: i.getAttribute('height'), alt: i.getAttribute('alt'), dansLeLien: i.parentElement?.tagName === 'A' })),
      };
    });
    expect(lu.liens).toEqual([{ href: CODE.lien, texte: '', attributs: ['href'] }]);
    expect(lu.images).toEqual([{ src: CODE.image, largeur: String(DESSIN.largeur), hauteur: String(DESSIN.hauteur), alt: CODE.alt, dansLeLien: true }]);
    // Ni paramètre de suivi, ni ancre, ni script : un lien et une image, rien d’autre.
    for (const adresse of [CODE.lien, CODE.image]) {
      expect(new URL(adresse).search).toBe('');
      expect(new URL(adresse).hash).toBe('');
    }
    expect(lu.brut).toBe(`<a href="${CODE.lien}"><img src="${CODE.image}" width="${DESSIN.largeur}" height="${DESSIN.hauteur}" alt="${CODE.alt}"></a>`);
  });

  test('« Copier le code » met le code dans le presse-papiers et le dit', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PAGE);
    await attendreLaPageFinie(page);
    const bouton = page.locator('#badge-copier');
    await expect(bouton).toBeVisible();
    await bouton.click();
    await expect(page.locator('#badge-retour')).toHaveText('Code copié. Colle-le sur ton site, là où le badge doit apparaître.');
    await expect(bouton).toHaveText('Code copié');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.locator('#badge-code').inputValue());
    await expect(bouton).toHaveText('Copier le code', { timeout: 4000 });
  });

  test('le presse-papiers refusé : le code est sélectionné, prêt à copier, et la page le dit', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('refusé')) } });
    });
    await page.goto(PAGE);
    await attendreLaPageFinie(page);
    await page.locator('#badge-copier').click();
    await expect(page.locator('#badge-retour')).toHaveText('Ton navigateur ne nous laisse pas copier : le code est sélectionné, copie-le toi-même.');
    const selection = await page.locator('#badge-code').evaluate((zone) => [zone.selectionStart, zone.selectionEnd, zone.value.length, document.activeElement === zone]);
    expect(selection).toEqual([0, selection[2], selection[2], true]);
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('pas de bouton qui ne marcherait pas ; le code reste dans sa boîte, à sélectionner', async ({ page }) => {
      await page.goto(PAGE);
      await expect(page.locator('#badge-copier')).toBeHidden();
      const code = page.locator('#badge-code');
      await expect(code).toBeVisible();
      await expect(code).toBeEditable({ editable: false });
      await code.focus();
      await page.keyboard.press('Control+A');
      expect(await code.evaluate((zone) => zone.value.slice(zone.selectionStart, zone.selectionEnd))).toBe(await code.inputValue());
      await expect(page.locator('a#badge-story')).toBeVisible();
    });
  });
});
