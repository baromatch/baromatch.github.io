// Les images de la marque, rendues par le Chromium de la machine : rien n’est dessiné à la main, tout se refait.
//
// Usage :
//   node tests/outils/images-marque.mjs [port]
//     - les logos de la page presse en PNG, 2400 px de large, fond transparent, depuis leurs SVG (presse/) ;
//     - l’image de story des bars (badge/story-baromatch.png, 1080 × 1920), depuis tests/outils/story-baromatch.html,
//       enregistrée en PNG à palette (png-palette.mjs), deux fois plus légère que la capture ; et son aperçu pour la
//       page « Pour les bars » (badge/story-baromatch-apercu.webp, 360 px de large).
//   node tests/outils/images-marque.mjs webp <image d’entrée> <fichier .webp de sortie> <largeur> [qualité de 0 à 1]
//     - une capture réduite à cette largeur (proportions gardées) et enregistrée en WebP (qualité 0,8 par défaut).
//
// Le site est servi en local (comme GitHub Pages) pour que la story ait sa police ; port 4374 par défaut.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CHROMIUM, racine } from './environnement.mjs';
import { pngAPalette } from './png-palette.mjs';
import { demarrerServeur } from './serveur.mjs';

const LARGEUR_LOGO = 2400;
const LOGOS = ['baromatch-logo-fond-sombre', 'baromatch-logo-fond-clair'];
const STORY = { largeur: 1080, hauteur: 1920, page: '/tests/outils/story-baromatch.html', sortie: 'badge/story-baromatch.png' };
const APERCU = { largeur: 360, sortie: 'badge/story-baromatch-apercu.webp' };

const duDepot = (...morceaux) => path.join(racine, ...morceaux);

// Largeur et hauteur d’un SVG, lues dans son viewBox.
const proportionsDe = (svg) => {
  const [, , largeur, hauteur] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  return { largeur, hauteur };
};

const rendreLesImages = async (port) => {
  const { adresse, arreter } = await demarrerServeur(port);
  let navigateur = null;
  try {
    navigateur = await chromium.launch({ executablePath: CHROMIUM });
    const onglet = await navigateur.newPage({ deviceScaleFactor: 1 });

    for (const nom of LOGOS) {
      const svg = readFileSync(duDepot('presse', `${nom}.svg`), 'utf8');
      const { largeur, hauteur } = proportionsDe(svg);
      const hauteurPng = Math.round((LARGEUR_LOGO * hauteur) / largeur);
      await onglet.setViewportSize({ width: LARGEUR_LOGO, height: hauteurPng });
      await onglet.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block}</style></head>`
        + `<body><img src="${adresse}/presse/${nom}.svg" width="${LARGEUR_LOGO}" height="${hauteurPng}" alt=""></body></html>`);
      await onglet.locator('img').evaluate((img) => img.decode());
      await onglet.screenshot({ path: duDepot('presse', `${nom}.png`), omitBackground: true, clip: { x: 0, y: 0, width: LARGEUR_LOGO, height: hauteurPng } });
      console.log(`presse/${nom}.png : ${LARGEUR_LOGO} × ${hauteurPng}`);
    }

    await onglet.setViewportSize({ width: STORY.largeur, height: STORY.hauteur });
    await onglet.goto(`${adresse}${STORY.page}`, { waitUntil: 'networkidle' });
    await onglet.evaluate(() => document.fonts.ready);
    const capture = await onglet.screenshot({ clip: { x: 0, y: 0, width: STORY.largeur, height: STORY.hauteur } });
    // Les pixels de la capture, lus par le navigateur, puis enregistrés en PNG à palette (png-palette.mjs).
    const pixels = await onglet.evaluate(async (base64) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canevas = new OffscreenCanvas(image.width, image.height);
      const contexte = canevas.getContext('2d');
      contexte.drawImage(image, 0, 0);
      const octets = contexte.getImageData(0, 0, image.width, image.height).data;
      let texte = '';
      for (let i = 0; i < octets.length; i += 0x8000) texte += String.fromCharCode(...octets.subarray(i, i + 0x8000));
      return btoa(texte);
    }, capture.toString('base64'));
    const png = pngAPalette(Buffer.from(pixels, 'base64'), STORY.largeur, STORY.hauteur);
    writeFileSync(duDepot(STORY.sortie), png);
    console.log(`${STORY.sortie} : ${STORY.largeur} × ${STORY.hauteur}, ${Math.round(png.length / 1024)} Ko (capture : ${Math.round(capture.length / 1024)} Ko)`);
  } finally {
    await navigateur?.close();
    await arreter();
  }
  await versWebp(duDepot(STORY.sortie), duDepot(APERCU.sortie), APERCU.largeur, 0.8);
};

// Une image réduite par le navigateur (createImageBitmap, qualité haute) puis encodée en WebP par son canevas.
const versWebp = async (entree, sortie, largeur, qualite) => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const onglet = await navigateur.newPage();
    const type = /\.png$/i.test(entree) ? 'image/png' : 'image/jpeg';
    const donnees = readFileSync(entree).toString('base64');
    const resultat = await onglet.evaluate(async ({ donnees, type, largeur, qualite }) => {
      const blob = await (await fetch(`data:${type};base64,${donnees}`)).blob();
      const source = await createImageBitmap(blob);
      const hauteur = Math.round((source.height * largeur) / source.width);
      const reduite = await createImageBitmap(source, { resizeWidth: largeur, resizeHeight: hauteur, resizeQuality: 'high' });
      const canevas = document.createElement('canvas');
      canevas.width = largeur;
      canevas.height = hauteur;
      canevas.getContext('2d').drawImage(reduite, 0, 0);
      const url = canevas.toDataURL('image/webp', qualite);
      if (!url.startsWith('data:image/webp')) throw new Error('Ce navigateur n’encode pas le WebP');
      return { base64: url.slice(url.indexOf(',') + 1), hauteur };
    }, { donnees, type, largeur, qualite });
    writeFileSync(sortie, Buffer.from(resultat.base64, 'base64'));
    console.log(`${sortie} : ${largeur} × ${resultat.hauteur}`);
  } finally {
    await navigateur.close();
  }
};

if (process.argv[2] === 'webp') {
  const [, , , entree, sortie, largeur, qualite = '0.8'] = process.argv;
  if (!entree || !sortie || !Number(largeur)) throw new Error('Usage : node tests/outils/images-marque.mjs webp <entrée> <sortie.webp> <largeur> [qualité]');
  await versWebp(path.resolve(entree), path.resolve(sortie), Number(largeur), Number(qualite));
} else {
  await rendreLesImages(Number(process.argv[2] ?? 4374));
}
