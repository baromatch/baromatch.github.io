// Les images de la marque que le site publie : les logos de la page presse (SVG copiés tels quels des fichiers
// officiels, PNG rendus par tests/outils/images-marque.mjs), les captures de l’appli en WebP et l’image de story des
// bars. Chaque SVG est public et téléchargé : il ne dit rien d’interne (ni commentaire, ni nom de fichier de travail,
// ni trace d’un logiciel de dessin). L’image de story ne promet rien tant que l’appli n’est pas ouverte au public.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { pngAPalette } from './outils/png-palette.mjs';

const duDepot = (...morceaux) => path.join(racine, ...morceaux);
const MARQUE = JSON.parse(readFileSync(duDepot('marque.json'), 'utf8'));

const LOGOS = ['baromatch-logo-fond-sombre', 'baromatch-logo-fond-clair'];
const CAPTURES = ['capture-ton-club', 'capture-trouve-ton-bar', 'capture-garde-ta-place', 'capture-souvenir'];

// Largeur, hauteur et type de couleur (6 : avec transparence) d’un PNG, lus dans son en-tête.
const enTetePng = (fichier) => {
  const octets = readFileSync(fichier);
  expect(octets.readUInt32BE(0), `${fichier} : pas un PNG`).toBe(0x89504e47);
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20), couleur: octets[25] };
};
// Largeur et hauteur d’un WebP (VP8X, VP8 ou VP8L), lues dans son en-tête.
const tailleWebp = (fichier) => {
  const octets = readFileSync(fichier);
  expect(octets.toString('ascii', 0, 4) + octets.toString('ascii', 8, 12), `${fichier} : pas un WebP`).toBe('RIFFWEBP');
  const morceau = octets.toString('ascii', 12, 16);
  if (morceau === 'VP8X') return { largeur: 1 + octets.readUIntLE(24, 3), hauteur: 1 + octets.readUIntLE(27, 3) };
  if (morceau === 'VP8 ') return { largeur: octets.readUInt16LE(26) & 0x3fff, hauteur: octets.readUInt16LE(28) & 0x3fff };
  const bits = octets.readUInt32LE(21);
  return { largeur: 1 + (bits & 0x3fff), hauteur: 1 + ((bits >> 14) & 0x3fff) };
};
const proportionsSvg = (svg) => {
  const [, , largeur, hauteur] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  return largeur / hauteur;
};
// L’opacité (0 à 255) de quelques pixels d’une image, lue par le navigateur.
const opacites = (onglet, fichier, points) => onglet.evaluate(async ({ base64, points }) => {
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const canevas = new OffscreenCanvas(image.width, image.height);
  const contexte = canevas.getContext('2d');
  contexte.drawImage(image, 0, 0);
  return points.map(([x, y]) => contexte.getImageData(Math.round(x * (image.width - 1)), Math.round(y * (image.height - 1)), 1, 1).data[3]);
}, { base64: readFileSync(fichier).toString('base64'), points });

test.describe('les logos de la page presse', () => {
  test('chaque SVG publié est propre : un dessin, son nom, rien d’interne', () => {
    const svgs = readdirSync(duDepot('presse')).filter((nom) => nom.endsWith('.svg'));
    expect(svgs.sort()).toEqual(['baromatch-icone.svg', ...LOGOS.map((nom) => `${nom}.svg`)].sort());
    for (const nom of svgs) {
      const svg = readFileSync(duDepot('presse', nom), 'utf8');
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${nom} : commence par <svg>`).toBe(true);
      expect(svg, nom).toContain('role="img" aria-label="Baromatch"');
      expect(svg, `${nom} : un commentaire`).not.toContain('<!--');
      expect(svg, `${nom} : des métadonnées`).not.toMatch(/<\?xml|<metadata|<title|<desc|sodipodi|inkscape|figma|illustrator|sketch|data-name/i);
      expect(svg, `${nom} : un nom de fichier`).not.toMatch(/[\w-]+\.(?:svg|png|jpe?g|ai|fig|psd|webp)\b/i);
      expect(svg, `${nom} : un chemin`).not.toMatch(/[A-Za-z]:\\|\/(?:Users|home)\//);
    }
  });

  test('chaque logo a son PNG de 2400 px de large, aux proportions du SVG, sur fond transparent', async ({ page: onglet }) => {
    for (const nom of LOGOS) {
      const fichier = duDepot('presse', `${nom}.png`);
      const { largeur, hauteur, couleur } = enTetePng(fichier);
      expect(largeur, nom).toBe(2400);
      expect(couleur, `${nom} : PNG avec transparence`).toBe(6);
      const attendue = 2400 / proportionsSvg(readFileSync(duDepot('presse', `${nom}.svg`), 'utf8'));
      expect(Math.abs(hauteur - attendue), `${nom} : hauteur ${hauteur}, ${Math.round(attendue)} attendus`).toBeLessThanOrEqual(1);
      // Les quatre coins sont transparents ; le dessin, lui, est peint (le jambage du B).
      expect(await opacites(onglet, fichier, [[0, 0], [1, 0], [0, 1], [1, 1]]), `${nom} : coins`).toEqual([0, 0, 0, 0]);
      expect((await opacites(onglet, fichier, [[0.03, 0.4]]))[0], `${nom} : le dessin`).toBe(255);
      expect(statSync(fichier).size, nom).toBeLessThan(200 * 1024);
    }
  });

  test('l’icône de l’appli : un carré de 1024 px, en SVG et en PNG', () => {
    expect(enTetePng(duDepot('presse', 'baromatch-icone.png'))).toMatchObject({ largeur: 1024, hauteur: 1024 });
    expect(proportionsSvg(readFileSync(duDepot('presse', 'baromatch-icone.svg'), 'utf8'))).toBe(1);
  });
});

test('les captures de l’appli : des WebP légers, de largeur raisonnable', () => {
  for (const nom of CAPTURES) {
    const fichier = duDepot('presse', `${nom}.webp`);
    const { largeur, hauteur } = tailleWebp(fichier);
    expect(largeur, nom).toBe(480);
    expect(hauteur, nom).toBeGreaterThan(largeur);
    expect(statSync(fichier).size, nom).toBeLessThan(60 * 1024);
  }
  expect(readdirSync(duDepot('presse')).filter((nom) => nom.startsWith('capture-')).sort())
    .toEqual(CAPTURES.map((nom) => `${nom}.webp`).sort());
});

test.describe('l’image de story des bars', () => {
  test('1080 × 1920, un PNG léger ; son aperçu pour « Pour les bars », un WebP de 360 px', () => {
    const fichier = duDepot('badge', 'story-baromatch.png');
    expect(enTetePng(fichier)).toMatchObject({ largeur: 1080, hauteur: 1920 });
    expect(statSync(fichier).size).toBeLessThan(400 * 1024);
    const apercu = duDepot('badge', 'story-baromatch-apercu.webp');
    expect(tailleWebp(apercu)).toEqual({ largeur: 360, hauteur: 640 });
    expect(statSync(apercu).size).toBeLessThan(30 * 1024);
  });

  test('son texte ne promet pas de réserver tant que l’appli n’est pas ouverte, et ne parle pas d’alcool', () => {
    const source = readFileSync(duDepot('tests', 'outils', 'story-baromatch.html'), 'utf8');
    const affiche = source.slice(source.indexOf('<body>')).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    expect(affiche).toBe('Ce soir, on diffuse le match. On est sur Baromatch. baromatch.fr');
    if (!MARQUE.appli.ouverte) expect(affiche).not.toMatch(/r[ée]serv/i);
    expect(affiche).not.toMatch(/bi[èe]re|alcool|verre offert|tourn[ée]e|happy/i);
  });
});

test('le PNG à palette : une image relue par le navigateur, à sa taille, aux couleurs proches', async ({ page: onglet }) => {
  // Un dégradé de 64 × 32 px, de la nuit à l’ambre.
  const largeur = 64;
  const hauteur = 32;
  const rgba = Buffer.alloc(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const t = x / (largeur - 1);
      rgba.set([Math.round(10 + t * 245), Math.round(11 + t * 166), Math.round(16 + t * 45), 255], (y * largeur + x) * 4);
    }
  }
  const png = pngAPalette(rgba, largeur, hauteur);
  expect(png[25], 'type de couleur : palette').toBe(3);
  const lu = await onglet.evaluate(async (base64) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canevas = new OffscreenCanvas(image.width, image.height);
    const contexte = canevas.getContext('2d');
    contexte.drawImage(image, 0, 0);
    return { largeur: image.width, hauteur: image.height, pixels: [...contexte.getImageData(0, 0, image.width, image.height).data] };
  }, png.toString('base64'));
  expect([lu.largeur, lu.hauteur]).toEqual([largeur, hauteur]);
  let ecart = 0;
  for (let i = 0; i < rgba.length; i += 1) ecart = Math.max(ecart, Math.abs(rgba[i] - lu.pixels[i]));
  expect(ecart).toBeLessThanOrEqual(12);
});
