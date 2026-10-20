// Les finitions des pages générées, dans le navigateur, sur le scénario inventé (tests/outils/site-genere.mjs) :
// « Une offre du bar dans l’appli » se lit comme un texte, pas comme un bouton.
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const MATCH = '/matchs/psg-ol-2026-10-25/';
const ZINC = '/bar/le-zinc-des-amis-paris-11/';

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => { const { port } = sonde.address(); sonde.close(() => resoudre(port)); });
});

let dossier;
let serveur;
test.beforeAll(async () => {
  dossier = mkdtempSync(path.join(tmpdir(), 'finitions-'));
  await construireLeSiteDExemple(dossier, { rendu: null });
  serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(() => {
  serveur?.arreter();
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

test('« Une offre du bar dans l’appli » : un texte discret, sans fond ni cadre, comme l’étiquette d’une offre', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  for (const chemin of [MATCH, ZINC]) {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    const offre = onglet.locator('.regarder-offre', { hasText: 'Une offre du bar dans l’appli' });
    await expect(offre, chemin).toHaveCount(1);
    const lu = await offre.evaluate((bloc) => {
      const style = getComputedStyle(bloc);
      const texte = getComputedStyle(bloc.querySelector('.regarder-offre__texte'));
      return { fond: style.backgroundColor, bord: style.borderTopStyle, gauche: style.paddingLeft, couleur: texte.color };
    });
    const discret = await onglet.evaluate(() => getComputedStyle(document.body).getPropertyValue('--texte-doux').trim());
    const attendu = await onglet.evaluate((c) => { const s = document.createElement('span'); s.style.color = c; document.body.append(s); const lu = getComputedStyle(s).color; s.remove(); return lu; }, discret);
    expect(lu, chemin).toEqual({ fond: 'rgba(0, 0, 0, 0)', bord: 'none', gauche: '0px', couleur: attendu });
  }
});
