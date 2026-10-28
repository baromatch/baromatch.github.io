// Le badge fixe des bars (/badge/baromatch.svg), et le bloc « Partager mon badge », retiré de « Pour les bars » tant
// qu’aucun bar n’est publié. Le badge vivant de chaque bar (/bar/<slug>/badge.svg, écrit par le générateur) reprend
// exactement ce dessin : ses mesures sont écrites ici (DESSIN). Tant que l’appli n’est pas ouverte, aucun badge ne dit
// « Réserve ta place » ; son nom de fichier est neutre, il restera des années chez les bars.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
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

// « Partager mon badge » parle à un bar déjà sur Baromatch (« Ton bar est sur Baromatch ? Colle ce badge… ») : tant
// qu’aucun bar n’est publié (generateur/bars-publies.json), la page des bars ne l’a pas. Les fichiers du badge restent
// servis (un bar a pu copier le code) ; le bloc revient avec le premier bar publié. Ce jour-là, ce test échoue.
const BARS_PUBLIES = JSON.parse(readFileSync(duDepot('generateur', 'bars-publies.json'), 'utf8')).bars;
const REMETTRE_LE_BLOC = 'Un bar est publié (generateur/bars-publies.json) : remettre « Partager mon badge » sur '
  + 'pour-les-bars.html. Les commits qui l’ont retiré (git log -S "Partager mon badge") rendent aussi son style, son '
  + 'script et ses tests. Ou mettre ce test à jour.';

test.describe('« Partager mon badge », retiré de « Pour les bars » tant qu’aucun bar n’est publié', () => {
  test('aucun bar publié : ni le bloc, ni son code, ni son bouton ; les fichiers du badge restent servis', async ({ page }) => {
    expect(BARS_PUBLIES, REMETTRE_LE_BLOC).toEqual([]);
    const source = readFileSync(duDepot('pour-les-bars.html'), 'utf8');
    expect(source).not.toMatch(/id="badge|class="badge|Partager mon badge|Colle ce badge/);
    await page.goto(PAGE);
    await expect(page.locator('[id^="badge"], [class*="badge"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Partager mon badge|Colle ce badge/);
    // Les fichiers, eux, restent en ligne.
    expect((await page.request.get('/badge/baromatch.svg')).headers()['content-type']).toMatch(/^image\/svg\+xml/);
    for (const fichier of ['/badge/story-baromatch.png', '/badge/story-baromatch-apercu.webp']) {
      expect((await page.request.get(fichier)).status(), fichier).toBe(200);
    }
  });
});
