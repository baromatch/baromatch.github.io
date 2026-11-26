// L’accueil vu par un fan qui arrive un soir de match : dès le premier écran, il lit la promesse de la marque (« Ton
// match. Ton bar. Ce soir. »), qu’elle est gratuite pour les fans et arrive bientôt sur les stores, et il voit le geste
// de garder sa place sur un téléphone « Démo ». Juste dessous, le prochain match (accueil-prochain-match.spec.mjs). La liste
// d’attente (« Préviens-moi ») garde son formulaire et ses mots ; aucune pastille « Arrive bientôt » en haut de page.
import { test, expect } from '@playwright/test';
import { BLOC_AU_PLUS_PX, ECRANS_A_LA_MAIN, lireLaHauteurDeLAccueil } from './outils/hauteur-accueil.mjs';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();
const PLATEFORMES = 'L’appli Baromatch existe sur iPhone et Android. Elle arrive bientôt sur l’App Store et Google Play, d’abord à Paris.';

test('le premier écran : la promesse de la marque, « gratuite pour les fans », « bientôt sur les stores », et aucune pastille « Arrive bientôt »', async ({ page }) => {
  await page.goto('/');
  const ouverture = page.locator('section.geste');
  await expect(ouverture.locator('h1')).toHaveText('Ton match. Ton bar. Ce soir.');
  await expect(page.locator('h1')).toHaveCount(1);
  const texte = normaliser(await ouverture.locator('.geste__texte').innerText());
  expect(texte).toBe('Une appli gratuite pour les fans : trouve un bar qui diffuse ton match et garde ta place. Bientôt sur les stores : rien à réserver ce soir.');
  // Le titre est écrit à la main, et sous lui vient le téléphone.
  expect(await ouverture.evaluate((s) => [...s.children].map((e) => (e.getAttribute('class') ?? '').split(' ')[0]).filter(Boolean))).toEqual(['planche', 'geste__titre', 'geste__texte', 'geste__scene']);
  expect(normaliser(await page.locator('main').innerText())).not.toMatch(/arrive bientôt\s*$/m);
  await expect(page.locator('.ouverture__statut')).toHaveCount(0);
  // La phrase des plateformes suit le formulaire de la liste d’attente.
  expect(normaliser(await page.locator('.attente__plateformes').innerText())).toBe(PLATEFORMES);
  // Aucune date de lancement (rien n’est annoncé), ni lien vers un store.
  const page_ = normaliser(await page.evaluate(() => document.body.innerText));
  expect(page_).not.toMatch(/disponible sur l’App Store|disponible sur Google Play|télécharge(r|z)? (sur|dans) l’App Store/i);
  await expect(page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(0);
  expect(page_).not.toContain('!');
});

// Le premier écran, sur téléphone (barres du navigateur affichées ou ôtées) comme sur ordinateur : le titre, sa phrase, le
// téléphone « Démo » et son geste (le verre qu’on maintient) tiennent dans la hauteur de l’écran.
for (const ecran of [
  { largeur: 360, hauteur: 640 },
  { largeur: 390, hauteur: 664 },
  { largeur: 390, hauteur: 844 },
  { largeur: 1280, hauteur: 720 },
  { largeur: 1366, hauteur: 768 },
  { largeur: 1440, hauteur: 900 },
]) {
  test(`à ${ecran.largeur} × ${ecran.hauteur} : le titre, sa phrase, l’étiquette « Démo » et le verre qu’on maintient sont dans le premier écran`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
    await page.goto('/');
    for (const selecteur of ['#titre', '.geste__texte', '.g-tel .etiquette-demo', '.g-verre']) {
      const boite = await page.locator(selecteur).boundingBox();
      expect(boite.y, `${selecteur} : haut`).toBeGreaterThanOrEqual(0);
      expect(boite.y + boite.height, `${selecteur} : bas`).toBeLessThanOrEqual(ecran.hauteur);
    }
  });
}

// Tout ce qui est en ambre dans la page (hors de la bande des bars) est l’action de l’utilisateur : « Que faire pour ce
// match » (le bouton de la carte), ou un rappel qui mène à la liste d’attente. « Deviens testeur Android » est en verre.
// La boutique n’est pas présentée dans l’accueil (décision du propriétaire, 28 octobre), ni dans le menu du haut (29
// octobre) : on la trouve dans le pied de page.
const ouMeneLAmbre = (page) => page.$$eval('main a, main button, main summary', (elements) => elements
  .filter((e) => !e.closest('#bars') && getComputedStyle(e).backgroundColor === 'rgb(255, 177, 61)')
  .map((e) => ({ cible: e.getAttribute('href') ?? e.closest('form')?.id ?? e.className })));

test('« préviens-moi » revient après les questions ; l’ambre ne mène qu’à la liste d’attente ou à la réponse de la carte', async ({ page }) => {
  await page.goto('/');
  const rappels = page.locator('main .rappel-attente a.capsule');
  await expect(rappels).toHaveCount(1);
  await expect(rappels).toHaveText(['L’appli arrive bientôt : préviens-moi']);
  await expect(rappels.first()).toHaveAttribute('href', '#attente');
  expect(await page.$$eval('main .rappel-attente', (p) => p.map((e) => e.closest('section').className.split(' ')[0]))).toEqual(['questions-fans']);
  // Aucun lien « testeur » dans le contenu : le bloc des testeurs est sorti de l’accueil (26 nov. 2026) ; le pied de page y mène.
  await expect(page.locator('main a[href="/testeurs-android.html"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/testeurs-android.html"]')).toHaveCount(1);
  await expect(page.locator('main a[href*="boutique"]')).toHaveCount(0);
  expect(normaliser(await page.locator('main').innerText())).not.toMatch(/boutique/i);
  await expect(page.locator('header a[href="/boutique.html"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/boutique.html"]')).toHaveCount(1);
  const enAmbre = await ouMeneLAmbre(page);
  expect(enAmbre.filter(({ cible }) => cible === '#attente').length).toBeGreaterThan(0);
  expect(enAmbre.filter(({ cible }) => cible !== '#attente' && cible !== 'attente' && !/capsule faire__bouton/.test(cible)).map(({ cible }) => cible)).toEqual([]);
  // L’en-tête non plus : ni bord ni souligné ambre, même translucide, sur ses liens (le menu, au téléphone comme à
  // l’ordinateur).
  for (const largeur of [360, 1280]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    const enteteAmbre = await page.$$eval('header a', (liens) => liens.flatMap((a) => {
      const s = getComputedStyle(a);
      const bords = ['Top', 'Right', 'Bottom', 'Left'].filter((cote) => parseFloat(s[`border${cote}Width`]) > 0).map((cote) => [`bord ${cote}`, s[`border${cote}Color`]]);
      const souligne = s.textDecorationLine.includes('underline') ? [['souligné', s.textDecorationColor]] : [];
      return [...bords, ...souligne].filter(([, couleur]) => /^rgba?\(255, 177, 61/.test(couleur)).map(([quoi, couleur]) => `${a.textContent.trim()} : ${quoi} ${couleur}`);
    }));
    expect(enteteAmbre, `${largeur} px`).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // Le rappel mène au formulaire, et le champ est là, avec le focus : on écrit tout de suite.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await rappels.last().click();
  await expect(page).toHaveURL(/#attente$/);
  await expect(page.locator('#attente-mail')).toBeInViewport();
  await expect(page.locator('#attente-mail')).toBeFocused();
  // Un Ctrl-clic ouvre le formulaire dans un autre onglet : ici, le focus reste où il était.
  await page.evaluate(() => document.activeElement.blur());
  const premier = rappels.first();
  await premier.focus();
  await premier.click({ modifiers: ['Control'] });
  await expect(premier).toBeFocused();
});

for (const largeur of [320, 360]) {
  test(`à ${largeur} px, le rappel « préviens-moi » se coupe entre deux mots, jamais dans « préviens-moi », et se touche du doigt`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    for (const rappel of await page.locator('main .rappel-attente a.capsule').all()) {
      const r = await rappel.evaluate((a) => {
        // Les lignes du texte, telles que le navigateur les a coupées.
        const plage = document.createRange();
        const texte = a.firstChild;
        const lignes = [];
        for (let i = 0; i < texte.length; i += 1) {
          plage.setStart(texte, i);
          plage.setEnd(texte, i + 1);
          const haut = Math.round(plage.getBoundingClientRect().top);
          if (!lignes.length || lignes.at(-1).haut !== haut) lignes.push({ haut, texte: '' });
          lignes.at(-1).texte += texte.data[i];
        }
        const boite = a.getBoundingClientRect();
        const section = a.closest('section').getBoundingClientRect();
        return {
          lignes: lignes.map((l) => l.texte.trim()),
          hauteur: boite.height,
          dedans: boite.left >= section.left && boite.right <= section.right,
          defile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(r.lignes.join(' | ')).not.toMatch(/préviens-$|préviens- \|/);
      expect(r.lignes.some((l) => l.endsWith('préviens-moi') || l === 'préviens-moi')).toBe(true);
      expect(r.hauteur).toBeGreaterThanOrEqual(44);
      expect(r.dedans).toBe(true);
      expect(r.defile).toBe(false);
    }
  });
}

test('le lien /#attente arrive sur le formulaire avec son étiquette et la phrase qui dit pourquoi', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/#attente');
  await page.waitForFunction(() => window.scrollY > 0);
  for (const selecteur of ['.attente__etiquette', '#attente-mail']) {
    const boite = await page.locator(selecteur).boundingBox();
    expect(boite.y, `${selecteur} : haut`).toBeGreaterThanOrEqual(0);
    expect(boite.y + boite.height, `${selecteur} : bas`).toBeLessThanOrEqual(640);
  }
});

test('la note de la liste d’attente mène droit à ce qu’on fait de l’adresse, et combien de temps', async ({ page }) => {
  await page.goto('/');
  const lien = page.locator('#attente .attente__note a');
  await expect(lien).toHaveAttribute('href', '/confidentialite.html#liste-attente');
  await expect(lien).toHaveText('Ce qu’on garde, et combien de temps');
  await lien.click();
  await expect(page.locator('#liste-attente')).toHaveText('La liste d’attente');
  await expect(page.locator('#liste-attente')).toBeInViewport();
});

test('l’accueil est court : le geste, le prochain match, l’appli, les bars, l’essentiel et les questions ; ni soirée en huit moments, ni plan, ni semaine', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.$$eval('main > section', (s) => s.map((e) => e.className.split(' ')[0]))).toEqual(['geste', 'prochain', 'appli', 'bars', 'en-bref', 'questions-fans']);
  for (const retire of ['.soiree', '.semaine', '.paris', '.essai', '.une-grille']) await expect(page.locator(retire), retire).toHaveCount(0);
  // Au téléphone : ce qui est écrit à la main tient en moins de 8 écrans (il en avait 11,4) ; le bloc du générateur (la carte,
  // sa bande, la semaine pliée), qui suit les matchs du jour, tient en moins d’un écran, quelle que soit leur semaine : la
  // hauteur de l’accueil ne dépend pas des données (tests/accueil-sans-bar.spec.mjs la mesure dans une semaine pleine).
  const { horsDuBloc, bloc } = await lireLaHauteurDeLAccueil(page);
  expect(horsDuBloc, 'l’accueil écrit à la main').toBeLessThan(ECRANS_A_LA_MAIN * 844);
  expect(bloc, 'le bloc du prochain match, au plus').toBeLessThanOrEqual(BLOC_AU_PLUS_PX);
});
