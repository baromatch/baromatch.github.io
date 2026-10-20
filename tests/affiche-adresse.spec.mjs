// L’adresse écrite sous le QR code de l’affiche d’un bar (.affiche-qr__adresse) passe à la ligne : avec un nom de bar
// très long (une longue adresse de page), à 360 px avec le texte à 200 %, la page ne défile pas de côté et l’adresse
// reste dans la feuille ; à l’impression aussi, en A4 comme en A3.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, SCENARIO } from './outils/site-genere.mjs';

const NOM = 'Le Très Grand Comptoir des Supporters du Canal Saint-Martin et de la Rue du Faubourg';
const AFFICHE = '/bar/le-tres-grand-comptoir-des-supporters-du-canal-saint-martin-et-de-la-rue-du-faubourg-paris-11/affiche/';

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => { const { port } = sonde.address(); sonde.close(() => resoudre(port)); });
});

let dossier;
let serveur;
test.beforeAll(async () => {
  dossier = mkdtempSync(path.join(tmpdir(), 'affiche-adresse-'));
  const scenario = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  scenario.bars.find((b) => b.id === 'b-zinc').name = NOM;
  const fichier = path.join(tmpdir(), `scenario-adresse-${process.pid}.json`);
  writeFileSync(fichier, JSON.stringify(scenario));
  await construireLeSiteDExemple(dossier, { source: `scenario:${fichier}`, rendu: null });
  rmSync(fichier, { force: true });
  serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(async () => {
  await serveur?.arreter();
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

// L’adresse : ce qui dépasse de sa propre boîte, de la feuille, et de la page.
const mesurer = (onglet) => onglet.evaluate(() => {
  const adresse = document.querySelector('.affiche-qr__adresse');
  const feuille = document.querySelector('.affiche').getBoundingClientRect();
  const r = adresse.getBoundingClientRect();
  return {
    texte: adresse.textContent,
    deborde: adresse.scrollWidth > adresse.clientWidth + 0.5,
    horsDeLaFeuille: r.right > feuille.right + 0.5 || r.left < feuille.left - 0.5,
    defile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

test('à 360 px, texte à 200 % : l’adresse sous le QR code passe à la ligne, rien ne défile de côté', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 700 });
  await onglet.goto(`${serveur.adresse}${AFFICHE}`);
  for (const pourcent of [100, 200]) {
    await onglet.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);
    const lu = await mesurer(onglet);
    expect(lu.texte).toBe(`baromatch.fr${AFFICHE.replace('affiche/', '')}`);
    expect(lu, `texte à ${pourcent} %`).toMatchObject({ deborde: false, horsDeLaFeuille: false, defile: false });
  }
});

test('à l’impression, en A4 et en A3 : l’adresse sous le QR code reste dans la feuille', async ({ page: onglet }) => {
  await onglet.goto(`${serveur.adresse}${AFFICHE}`);
  // La largeur imprimable de la feuille (210 ou 297 mm, moins 2 × 12 mm de marge), à 96 px par pouce.
  for (const [format, millimetres] of [['a4', 186], ['a3', 273]]) {
    await onglet.emulateMedia({ media: 'screen' });
    await onglet.locator(`#affiche-${format}`).check();
    await onglet.emulateMedia({ media: 'print' });
    await onglet.setViewportSize({ width: Math.round((millimetres / 25.4) * 96), height: 1100 });
    expect(await mesurer(onglet), format).toMatchObject({ deborde: false, horsDeLaFeuille: false });
  }
});
