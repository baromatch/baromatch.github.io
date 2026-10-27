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
test.afterAll(async () => {
  await serveur?.arreter();
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

// Les listes de matchs (la semaine, « Ce soir », une ville, une page de match, les pages en anglais) : le match, un
// lien de 44 px, seul sur sa ligne ; dessous, l’heure, la compétition et les bars, sans « · » en tête. Une ligne qui
// commence par la date commence par une capitale, partout.
const LISTES = ['/ce-soir/', '/matchs/', '/regarder-le-match/paris/', '/regarder-le-match/lyon/', MATCH, '/en/', '/en/matches/psg-barca-2026-10-24/'];

test('les listes de matchs à 360 px : le match sur sa ligne (44 px), les détails dessous, sans « · » en tête', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  for (const chemin of LISTES) {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    const lignes = await onglet.locator('.regarder-matchs > li').evaluateAll((liste) => liste.map((li) => {
      const match = li.firstElementChild;
      const infos = li.querySelector('.regarder-matchs__infos');
      const m = match.getBoundingClientRect();
      const i = infos?.getBoundingClientRect();
      return {
        texte: li.textContent.replace(/\s+/g, ' ').trim(),
        estLeMatch: match.classList.contains('regarder-matchs__match'),
        hauteur: match.tagName === 'A' ? Math.round(m.height) : 44,
        infos: infos ? infos.textContent.replace(/\s+/g, ' ').trim() : null,
        dessous: i ? i.top >= m.bottom - 1 : false,
      };
    }));
    expect(lignes.length, chemin).toBeGreaterThan(0);
    for (const l of lignes) {
      expect(l.estLeMatch, `${chemin} : ${l.texte}`).toBe(true);
      expect(l.hauteur, `${chemin} : ${l.texte}`).toBeGreaterThanOrEqual(44);
      expect(l.infos, `${chemin} : ${l.texte}`).not.toBeNull();
      expect(l.infos, `${chemin} : ${l.texte}`).not.toMatch(/^·/);
      expect(l.infos, `${chemin} : ${l.texte}`).toMatch(/^[\p{Lu}\d]/u);
      expect(l.dessous, `${chemin} : ${l.texte}`).toBe(true);
    }
  }
});

test('la date en tête de ligne prend une capitale : la tête d’un match, les soirées d’un bar, les listes', async ({ page: onglet }) => {
  await onglet.goto(`${serveur.adresse}${MATCH}`);
  await expect(onglet.locator('.regarder-quand')).toHaveText('Dimanche 25 octobre · 20:45');
  await expect(onglet.locator('.regarder-matchs__infos').first()).toHaveText('Vendredi 30 octobre · 19:00 · Ligue 1');
  await onglet.goto(`${serveur.adresse}${ZINC}`);
  expect(await onglet.locator('#titre-soirees ~ .regarder-cartes .regarder-carte__lieu').allTextContents()).toEqual([
    'Samedi 24 octobre · 21:00 · Ligue des champions',
    'Dimanche 25 octobre · 20:45 · Ligue 1',
  ]);
});

// Les cibles qui restaient sous 44 px : « 1 bar à Lyon » (le décompte des bars), le nom d’une ville au-dessus de ses
// bars, les clubs de « Suis ton club dans ton agenda ». Et, sur agenda/, le lien de chaque carte vers la page du club.
test('« 1 bar à Lyon », la ville au-dessus des bars et les clubs de l’agenda se touchent sur 44 × 44 px', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  for (const [chemin, selecteurs] of [
    [MATCH, ['.regarder-compte a', '.regarder-ville a', '.regarder-agenda__clubs a']],
    ['/matchs/', ['.regarder-compte a']],
    ['/ce-soir/', ['.regarder-compte a']],
    ['/agenda/', ['.regarder-carte__suite a']],
  ]) {
    await onglet.goto(`${serveur.adresse}${chemin}`);
    for (const selecteur of selecteurs) {
      const tailles = await onglet.locator(selecteur).evaluateAll((liens) => liens.map((a) => {
        const r = a.getBoundingClientRect();
        return `${a.textContent.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`;
      }));
      expect(tailles.length, `${chemin} ${selecteur}`).toBeGreaterThan(0);
      expect(tailles.filter((t) => { const [l, h] = t.split(' ').at(-1).split('×').map(Number); return l < 44 || h < 44; }), `${chemin} ${selecteur}`).toEqual([]);
    }
  }
});

// La page d’un bar : un seul bloc « Tu tiens ce bar ? », qui donne l’affiche à imprimer et le badge.
test('la page d’un bar : un seul bloc « Tu tiens ce bar ? », avec l’affiche et le badge', async ({ page: onglet }) => {
  await onglet.setViewportSize({ width: 360, height: 800 });
  await onglet.goto(`${serveur.adresse}${ZINC}`);
  const texte = await onglet.locator('main').innerText();
  expect(texte.match(/Tu tiens ce bar/g)).toHaveLength(1);
  const bloc = onglet.locator('section.regarder-patron');
  await expect(bloc).toHaveCount(1);
  await expect(bloc.getByRole('heading', { level: 2 })).toHaveText('Tu tiens ce bar ?');
  await expect(bloc.locator(`a[href="${ZINC}affiche/"]`)).toHaveText('Ton affiche à imprimer');
  await expect(bloc.locator('details.regarder-badge summary')).toHaveText('Ton badge, pour ton site');
  // Le lien de l’affiche se touche sur 44 px, le badge se déplie au clavier.
  expect(Math.round((await bloc.locator(`a[href="${ZINC}affiche/"]`).boundingBox()).height)).toBeGreaterThanOrEqual(44);
  await bloc.locator('summary').focus();
  await onglet.keyboard.press('Enter');
  await expect(bloc.locator('.regarder-badge__code')).toBeVisible();
});
