// L’accueil quand le prochain match n’a pas encore de bar (« Aucun bar encore pour ce match. »), dans une vraie semaine
// chargée : le bloc que le générateur écrit (generateur/accueil.mjs) tient dans l’écran à 320, 360 et 390 px, texte à
// 200 %, fermé comme ouvert, et l’accueil reste court. L’état est figé (tests/donnees/semaine-pleine.json : 25 matchs, aucun
// bar, lus le vendredi 30 octobre 2026 à 8 h à Paris) : les tests qui lisent l’index.html du dépôt, que l’Action réécrit
// toutes les 3 heures, tiennent donc quel que soit l’état des données du jour, et celui-ci est épinglé ici pour de bon.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { lireLesDebordements } from './outils/debordements.mjs';
import { BLOC_AU_PLUS_PX, ECRANS_A_LA_MAIN, lireLaHauteurDeLAccueil } from './outils/hauteur-accueil.mjs';
import { arreterLHorloge } from './outils/horloge.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const SEMAINE_PLEINE = path.join(racine, 'tests', 'donnees', 'semaine-pleine.json');
const INSTANT = Date.parse('2026-10-30T07:00:00Z');

let accueil;
test.beforeAll(async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'accueil-sans-bar-'));
  try {
    await construireLeSiteDExemple(dossier, { source: `scenario:${SEMAINE_PLEINE}`, maintenant: INSTANT, rendu: null });
    accueil = readFileSync(path.join(dossier, 'index.html'), 'utf8');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

const ouvrir = async (page, largeur, hauteur = 700) => {
  await page.route((adresse) => adresse.pathname === '/', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: accueil }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: largeur, height: hauteur });
  await arreterLHorloge(page, INSTANT);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};
const agrandir = (page, pourcent) => page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);

test('l’état épinglé est bien « aucun bar encore » dans une semaine pleine', () => {
  expect(accueil).toContain('data-faire-titre>Aucun bar encore pour ce match.</p>');
  expect(accueil).toContain('id="attente-carte"');
  expect(accueil.match(/<a href="\/matchs\/[^"]+\/">/g)?.length ?? 0, 'les liens de « Toute la semaine »').toBeGreaterThanOrEqual(20);
});

for (const largeur of [320, 360, 390]) {
  for (const ouverte of [false, true]) {
    test(`à ${largeur} px, texte à 200 %, la réponse ${ouverte ? 'ouverte' : 'fermée'} : rien ne sort de l’écran, la page ne défile pas de côté`, async ({ page }) => {
      await ouvrir(page, largeur);
      await agrandir(page, 200);
      if (ouverte) await page.locator('.faire__bouton').click();
      const lu = await lireLesDebordements(page);
      expect(lu.dehors).toEqual([]);
      expect(lu.defile, 'la page défile de côté').toBe(false);
    });
  }
}

test('à 320 px, texte à 200 % : la réponse ouverte garde chaque champ et chaque bouton dans son cadre', async ({ page }) => {
  await ouvrir(page, 320);
  await agrandir(page, 200);
  await page.locator('.faire__bouton').click();
  const lu = await page.evaluate(() => {
    const cadre = document.querySelector('.faire__corps').getBoundingClientRect();
    const dedans = [...document.querySelectorAll('.faire__corps :is(textarea, input:not([type=hidden]), .msg__envoi, .lien-trait, .prevenir__bouton)')]
      .filter((e) => e.getClientRects().length && !e.closest('.attente__piege'))
      .map((e) => ({ quoi: e.id || e.className, gauche: e.getBoundingClientRect().left - cadre.left, droite: cadre.right - e.getBoundingClientRect().right, haut: e.getBoundingClientRect().height }));
    return { colonnes: getComputedStyle(document.querySelector('.faire__corps')).gridTemplateColumns, largeur: cadre.width, dedans };
  });
  expect(lu.dedans.length).toBeGreaterThanOrEqual(6);
  for (const e of lu.dedans) {
    expect(e.gauche, `${e.quoi} : bord gauche`).toBeGreaterThanOrEqual(-0.5);
    expect(e.droite, `${e.quoi} : bord droit (${JSON.stringify(e)})`).toBeGreaterThanOrEqual(-0.5);
  }
  expect(parseFloat(lu.colonnes), 'la colonne de la réponse ne dépasse pas son cadre').toBeLessThanOrEqual(lu.largeur);
});

test('à 390 px, texte à 100 % : l’accueil reste court avec une semaine pleine (le bloc tient en un écran, le reste en moins de 8)', async ({ page }) => {
  await ouvrir(page, 390, 844);
  const { horsDuBloc, bloc } = await lireLaHauteurDeLAccueil(page);
  expect(horsDuBloc, 'l’accueil écrit à la main').toBeLessThan(ECRANS_A_LA_MAIN * 844);
  expect(bloc, 'le bloc du prochain match, au plus').toBeLessThanOrEqual(BLOC_AU_PLUS_PX);
});

test('« Toute la semaine » est pliée, et garde un lien vers chaque match de la semaine', async ({ page }) => {
  await ouvrir(page, 390, 844);
  const liste = page.locator('.jours__plie');
  await expect(liste).not.toHaveAttribute('open', /.*/);
  expect(await page.locator('.jours a[href^="/matchs/"]').count()).toBeGreaterThanOrEqual(20);
  const ferme = await page.locator('.jours').evaluate((e) => e.getBoundingClientRect().height);
  expect(ferme, 'pliée : une ligne de 44 px et sa gouttière').toBeLessThan(90);
  await page.locator('.jours__titre').click();
  await expect(liste).toHaveAttribute('open', '');
  await expect(page.locator('.jours ul')).toBeVisible();
});
