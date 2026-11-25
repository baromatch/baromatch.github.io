// Le film de l’accueil (WCAG 2.2.2) : il part seul, muet, en arrivant à l’écran, s’arrête avec son bouton, et se lit aussi en
// texte. Déplacé de accueil.spec.mjs sans changement de fond : seuls la mise en page de l’accueil (le film reste dans
// « L’appli », sous la liste d’attente) et les mots qui parlaient de l’ancien ordre ont été retouchés.
import { test, expect } from '@playwright/test';
import { auJourDeLAccueil } from './outils/horloge.mjs';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();

// Le film (WCAG 2.2.2) : il part seul, muet, en arrivant à l’écran. Son bouton se prend au clavier, et la pause tient :
// revenir au film ne le relance pas. Le Chromium des tests ne lit pas le H.264 du film : la lecture
// est simulée (play, pause, paused et leurs événements), comme un téléphone qui le lit.
const simulerUnLecteur = (page) => page.addInitScript(() => {
  const enPause = new WeakMap();
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return enPause.get(this) ?? true; } });
  HTMLMediaElement.prototype.play = function () {
    if (enPause.get(this) !== false) { enPause.set(this, false); this.dispatchEvent(new Event('play')); }
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {
    if (enPause.get(this) === false) { enPause.set(this, true); this.dispatchEvent(new Event('pause')); }
  };
});
const lireLeFilm = (page) => page.locator('#film').evaluate((v) => ({ enPause: v.paused, muet: v.muted, controles: v.controls }));
// Deux images peintes : l’observateur de défilement a parlé.
const deuxImages = (page) => page.evaluate(() => new Promise((suite) => requestAnimationFrame(() => requestAnimationFrame(suite))));

// L’ordre du clavier est celui du HTML : « Préviens-moi », le plan, les matchs de la semaine, la soirée, puis l’étape 4
// (« L’appli ») : la liste d’attente, son partage, puis le film, dessous. Le test garde cet ordre aux deux largeurs.
for (const [largeur, nom] of [
  [360, 'au téléphone (360 px) : le bouton du film l’arrête au clavier juste après le partage de la liste d’attente, affiché au-dessus de lui'],
  [1280, 'sur ordinateur (1280 px) : le bouton du film l’arrête au clavier juste après le partage de la liste d’attente, affiché au-dessus de lui'],
]) {
  test(`${nom} ; la pause tient en revenant au film`, async ({ page }) => {
    await simulerUnLecteur(page);
    // Le jour du bloc enregistré : une semaine après, la barre des jours et ses cartes s’effacent (main.js).
    await auJourDeLAccueil(page);
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const lecture = page.locator('#film-lecture');
    await page.locator('#film').scrollIntoViewIfNeeded();
    await expect.poll(() => lireLeFilm(page)).toEqual({ enPause: false, muet: true, controles: false });
    await expect(lecture).toBeVisible();
    await expect(lecture).toHaveAccessibleName('Mettre le film en pause');
    await expect(lecture).not.toHaveAttribute('aria-pressed', /.*/);
    // Au clavier : juste après le dernier lien des matchs du jour choisi, dans le cadre du film.
    await page.locator('.appli .partage-site').locator('a:visible, button:visible').last().focus();
    await page.keyboard.press('Tab');
    await expect(lecture).toBeFocused();
    // Ce que chaque largeur affiche : au téléphone, le film sous les matchs ; sur ordinateur, au-dessus d’eux.
    const [film, formulaire] = await Promise.all([page.locator('#film-cadre').boundingBox(), page.locator('#attente').boundingBox()]);
    // Au téléphone, sous la liste d’attente ; sur ordinateur (dès 960 px), à sa droite, dans la même étape.
    if (largeur < 960) expect(film.y).toBeGreaterThan(formulaire.y + formulaire.height);
    else expect(film.x).toBeGreaterThanOrEqual(formulaire.x + formulaire.width);
    const [boite, cadre] = await Promise.all([lecture.boundingBox(), page.locator('#film-cadre').boundingBox()]);
    expect(boite.width).toBeGreaterThanOrEqual(44);
    expect(boite.height).toBeGreaterThanOrEqual(44);
    expect(boite.x).toBeGreaterThanOrEqual(cadre.x);
    expect(boite.x + boite.width).toBeLessThanOrEqual(cadre.x + cadre.width);
    expect(boite.y + boite.height).toBeLessThanOrEqual(cadre.y + cadre.height);
    await page.keyboard.press('Enter');
    await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true });
    await expect(lecture).toHaveAccessibleName('Lire le film');
    await expect(lecture).toBeFocused();
    // Le film sort de l’écran puis y revient : il reste en pause.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await deuxImages(page);
    await page.locator('#film').scrollIntoViewIfNeeded();
    await deuxImages(page);
    await deuxImages(page);
    expect(await lireLeFilm(page)).toMatchObject({ enPause: true });
    await expect(lecture).toHaveAccessibleName('Lire le film');
    // « Lire le film » le relance.
    await lecture.press('Enter');
    await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false });
    await expect(lecture).toHaveAccessibleName('Mettre le film en pause');
  });
}

test('le film part seul quand il arrive à l’écran, et s’arrête quand il en sort', async ({ page }) => {
  await simulerUnLecteur(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await deuxImages(page);
  // Au téléphone, il est sous la liste d’attente : rien ne joue avant d’y arriver.
  expect(await lireLeFilm(page)).toMatchObject({ enPause: true });
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false });
  await page.locator('.en-bref').scrollIntoViewIfNeeded();
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true });
});

test('lecture automatique refusée : le lecteur classique, et une pause faite avec ses commandes tient en revenant au film', async ({ page }) => {
  await simulerUnLecteur(page);
  // Le navigateur refuse la première lecture (pas de lecture automatique) ; la personne lance ensuite le film elle-même.
  await page.addInitScript(() => {
    const jouer = HTMLMediaElement.prototype.play;
    let refuse = false;
    HTMLMediaElement.prototype.play = function () {
      if (!refuse) { refuse = true; return Promise.reject(new DOMException('refusé', 'NotAllowedError')); }
      return jouer.call(this);
    };
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true, controles: true });
  await expect(page.locator('#film-lecture')).toBeHidden();
  await page.locator('#film').evaluate((v) => v.play());
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false });
  await page.locator('#film').evaluate((v) => v.pause());
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await deuxImages(page);
  await page.locator('#film').scrollIntoViewIfNeeded();
  await deuxImages(page);
  await deuxImages(page);
  expect(await lireLeFilm(page)).toMatchObject({ enPause: true, controles: true });
});

test('le film encore en chargement : le bouton l’arrête sans tomber ni perdre le focus', async ({ page }) => {
  // Le vrai lecteur : sa lecture attend des données, et pause() annule cette attente (AbortError). Ce n’est pas un refus
  // de lecture automatique : le bouton reste, sans lecteur classique.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false, controles: false });
  await page.locator('#film-lecture').press('Enter');
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true });
  await deuxImages(page);
  expect(await lireLeFilm(page)).toEqual({ enPause: true, muet: true, controles: false });
  await expect(page.locator('#film-lecture')).toBeFocused();
});

test('avec « réduire les animations », ou en économie de données, le film ne part pas : le lecteur classique', async ({ page }) => {
  await simulerUnLecteur(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await deuxImages(page);
  expect(await lireLeFilm(page)).toEqual({ enPause: true, muet: true, controles: true });
  await expect(page.locator('#film-lecture')).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  await page.reload();
  await page.locator('#film').scrollIntoViewIfNeeded();
  await deuxImages(page);
  expect(await lireLeFilm(page)).toEqual({ enPause: true, muet: true, controles: true });
  await expect(page.locator('#film-lecture')).toBeHidden();
});

// WCAG 1.2.1 : le film n’a pas de son ; sa version en mots, sous lui, dit ce qu’il montre à l’écran, mot pour mot, lu
// sur ses images (ffmpeg) : rien d’autre. Un nouveau film change ces lignes et le texte ensemble.
const LIGNES_DU_FILM = [
  'On regarde le match où ce soir ?',
  'Écrans de démonstration',
  'La Lucarne Lunaire.',
  'Maintiens pour réserver',
  'Maintiens.',
  'Le verre se remplit.',
  'Place gardée.',
  'Ta soirée',
  'Scanne le QR du bar',
  'Tu y es. Scanne-moi.',
  'Tu y es',
  'Sous-bock n°08 collé',
  'Ta soirée se colle dans ton album.',
  'Ton match. Ton bar. Ce soir.',
  'baromatch.fr',
  'Bientôt sur Android, à Paris',
];

test('le texte du film est juste sous lui, replié, avec chaque phrase du film dans l’ordre', async ({ page }) => {
  await page.goto('/');
  const texte = page.locator('#film-texte');
  await expect(texte).toHaveCount(1);
  // Le cadre du film, puis sa légende : la note, et le texte replié.
  expect(await texte.evaluate((d) => d.tagName === 'DETAILS' && !d.open && d.previousElementSibling?.id === 'film-note'
    && d.parentElement.tagName === 'FIGCAPTION' && d.parentElement.previousElementSibling?.id === 'film-cadre')).toBe(true);
  await expect(texte.locator('summary')).toHaveText('Ce que montre le film');
  await texte.locator('summary').click();
  await expect(texte.locator('li').first()).toBeVisible();
  const lu = normaliser(await texte.innerText());
  let depuis = -1;
  for (const ligne of LIGNES_DU_FILM) {
    const ici = lu.indexOf(`« ${ligne} »`, depuis + 1);
    expect(ici, `« ${ligne} » dans l’ordre du film`).toBeGreaterThan(depuis);
    depuis = ici;
  }
  // Les règles de la page : pas de point d’exclamation, et une espace insécable avant « ? » et dans les guillemets.
  const brut = await texte.evaluate((d) => d.textContent);
  expect(brut).not.toContain('!');
  expect(brut).not.toMatch(/ [?:;»]|« /);
});

// La note du film dit qu’il est sans le son, que le texte dessous dit ce qu’il montre, et que tout y est inventé ;
// chaque lecteur du film la cite (aria-describedby), avec ou sans JavaScript.
const NOTE_DU_FILM = 'Un film sans le son, raconté en mots juste dessous. Ses bars, ses clubs, ses pseudos et ses chiffres sont inventés.';

test('la note du film, citée par chaque lecteur, avec ou sans JavaScript', async ({ page, browser }) => {
  await page.goto('/');
  const note = page.locator('#film-note');
  await expect(note).toBeVisible();
  expect(normaliser(await note.innerText())).toBe(NOTE_DU_FILM);
  await expect(page.locator('#film')).toHaveAttribute('aria-describedby', 'film-note');
  await expect(page.locator('#film')).toHaveAccessibleDescription(NOTE_DU_FILM);
  const sansJS = await browser.newContext({ javaScriptEnabled: false });
  try {
    const onglet = await sansJS.newPage();
    await onglet.goto(page.url());
    const lecteur = onglet.locator('#film-cadre video[controls]');
    await expect(lecteur).toBeVisible();
    await expect(lecteur).toHaveAttribute('aria-describedby', 'film-note');
    await expect(onglet.locator('#film-note')).toBeVisible();
    await expect(onglet.locator('#film-lecture')).toBeHidden();
  } finally {
    await sansJS.close();
  }
});

// Le film est en portrait, jamais étiré : son cadre garde le 9:16 du fichier, sous la liste d’attente (étape 4).
for (const [largeur, hauteur] of [[360, 800], [1280, 720], [1440, 900], [2560, 1440]]) {
  test(`à ${largeur}×${hauteur}, le film garde son 9:16, sous la liste d’attente (à sa droite dès 960 px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto('/');
    const [video, bouton] = await Promise.all([page.locator('#film').boundingBox(), page.locator('#attente button[type="submit"]').boundingBox()]);
    // Le cadre est un peu tourné sur ordinateur : la boîte vue garde le rapport à 5 % près.
    expect(Math.abs(video.height / video.width - 16 / 9) / (16 / 9)).toBeLessThan(0.05);
    // Dans l’étape 4 (« L’appli ») : sous la liste d’attente au téléphone, à sa droite dès 960 px.
    if (largeur < 960) expect(video.y).toBeGreaterThan(bouton.y + bouton.height);
    else expect(video.x).toBeGreaterThanOrEqual(bouton.x + bouton.width);
  });
}

// WCAG 2.2.2 : la vague du verre de l’ouverture s’arrête d’elle-même avant 5 s, sur l’image du verre immobile du logo
// (une longueur d’onde entière, 140 px : la dernière image est la première). Sans animation en mouvement réduit.
