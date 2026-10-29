// L’accueil vu par un fan qui arrive un soir de match : dès le premier écran, il lit que Baromatch n’est pas encore
// ouvert, que l’appli est gratuite pour les fans et où elle en est (Android en test, pas d’iPhone), et il voit le champ
// et le bouton de la liste d’attente (sur ordinateur, même un écran court, la phrase « gratuite… pas encore ouverte »).
// La phrase de l’accueil « Ton match. Ton bar. Ce soir. » reste celle de la marque.
import { test, expect } from '@playwright/test';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();
const PLATEFORMES = 'Baromatch est en test sur Android, à Paris. Pas d’appli iPhone pour l’instant.';

test('le premier écran dit « pas encore ouvert », « gratuite pour les fans », et Android ou iPhone', async ({ page }) => {
  await page.goto('/');
  const ouverture = page.locator('section.ouverture');
  await expect(ouverture.locator('h1')).toHaveText('Ton match. Ton bar. Ce soir.');
  const statut = ouverture.locator('.ouverture__statut');
  await expect(statut).toHaveText('Pas encore ouvert · Bientôt à Paris');
  // Le statut est dit avant la promesse, au même niveau qu’elle : juste au-dessus du titre.
  expect(await statut.evaluate((e) => e.nextElementSibling?.tagName)).toBe('H1');
  const texte = normaliser(await ouverture.locator('.ouverture__texte').innerText());
  expect(texte).toBe('Une appli gratuite pour les fans : trouve un bar qui diffuse ton match et garde ta place. Elle n’est pas encore ouverte : rien à réserver ce soir.');
  expect(normaliser(await ouverture.innerText())).toContain(PLATEFORMES);
  // Aucune promesse d’appli iPhone ni de date de lancement (rien n’est annoncé), texte du film compris (son image de fin
  // dit « Bientôt sur Android, à Paris »).
  await page.locator('#film-texte summary').click();
  const page_ = normaliser(await page.evaluate(() => document.body.innerText));
  expect(page_).not.toMatch(/bientôt sur (Android et )?iPhone|iPhone bientôt|disponible sur iPhone/i);
  expect(page_).not.toContain('!');
});

test('le statut se lit comme une étiquette, pas comme un bouton : ni bord ni fond ambre (l’ambre est pour les actions)', async ({ page }) => {
  await page.goto('/');
  const style = await page.locator('.ouverture__statut').evaluate((e) => {
    const s = getComputedStyle(e);
    return { bord: s.borderTopColor, fond: s.backgroundColor };
  });
  const ambre = /^rgba?\(255, 177, 61/;
  expect(style.bord).not.toMatch(ambre);
  expect(style.fond).not.toMatch(ambre);
});

// Le statut est une phrase, pas une étiquette de la marque (12–13 px, capitales, +1,5 px) : il se lit d’un trait, sur
// une seule ligne, du plus petit téléphone à l’ordinateur (en capitales, il passait sur deux lignes à 360 px).
for (const largeur of [320, 360, 1280]) {
  test(`à ${largeur} px, le statut tient sur une ligne, en bas de casse`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const lu = await page.locator('.ouverture__statut').evaluate((e) => {
      const s = getComputedStyle(e);
      const plage = document.createRange();
      plage.selectNodeContents(e);
      const lignes = new Set([...plage.getClientRects()].map((r) => Math.round(r.top)));
      return { lignes: lignes.size, casse: s.textTransform };
    });
    expect(lu).toEqual({ lignes: 1, casse: 'none' });
  });
}

// Sur téléphone, de 640 px de haut (barre du navigateur ôtée) à plus : le statut, le champ et le bouton. Sur ordinateur,
// des écrans courts (1 280 × 720, 1 366 × 768, barre du navigateur ôtée) aux grands (900 px de haut), le titre reste
// très grand : le statut, le titre et la phrase « gratuite pour les fans… pas encore ouverte » sont dans le premier
// écran, le formulaire juste dessous.
for (const ecran of [
  { largeur: 360, hauteur: 640, formulaire: true },
  { largeur: 360, hauteur: 740, formulaire: true },
  { largeur: 390, hauteur: 800, formulaire: true },
  { largeur: 1280, hauteur: 720, formulaire: false },
  { largeur: 1366, hauteur: 768, formulaire: false },
  { largeur: 1280, hauteur: 800, formulaire: false },
  { largeur: 1440, hauteur: 900, formulaire: false },
]) {
  test(`à ${ecran.largeur} × ${ecran.hauteur} : le statut${ecran.formulaire ? ', le champ et le bouton de la liste d’attente sont' : ', le titre et la phrase « gratuite… pas encore ouverte » sont'} dans le premier écran`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
    await page.goto('/');
    const selecteurs = ecran.formulaire ? ['.ouverture__statut', '#attente-mail', '#attente button[type="submit"]'] : ['.ouverture__statut', '#titre', '.ouverture__texte'];
    for (const selecteur of selecteurs) {
      const boite = await page.locator(selecteur).boundingBox();
      expect(boite.y, `${selecteur} : haut`).toBeGreaterThanOrEqual(0);
      expect(boite.y + boite.height, `${selecteur} : bas`).toBeLessThanOrEqual(ecran.hauteur);
    }
  });
}

// Plus bas dans la page, « préviens-moi » revient deux fois : après la soirée et après les questions. La même capsule
// ambre que sur les pages des matchs, vers le formulaire du haut. Un seul appel principal : tout ce qui est en ambre
// dans la page (hors de la bande des bars, ambre elle-même) mène à la liste d’attente ; « Deviens testeur Android » est
// en verre. La boutique n’est plus présentée dans l’accueil : on la trouve dans le menu et le pied de page (décision du
// propriétaire, 28 octobre).
test('« préviens-moi » revient après la soirée et après les questions ; l’ambre ne mène qu’à la liste d’attente', async ({ page }) => {
  await page.goto('/');
  const rappels = page.locator('main .rappel-attente a.capsule');
  await expect(rappels).toHaveCount(2);
  await expect(rappels).toHaveText(['L’appli ouvre bientôt : préviens-moi', 'L’appli ouvre bientôt : préviens-moi']);
  for (const lien of await rappels.all()) await expect(lien).toHaveAttribute('href', '#attente');
  expect(await page.$$eval('main .rappel-attente', (p) => p.map((e) => e.closest('section').className.split(' ')[0])))
    .toEqual(['soiree', 'questions-fans']);
  const testeurs = page.locator('main a[href="/testeurs-android.html"]');
  await expect(testeurs).toHaveCount(1);
  expect(await testeurs.evaluate((a) => getComputedStyle(a).backgroundColor)).not.toBe('rgb(255, 177, 61)');
  await expect(page.locator('main a[href*="boutique"]')).toHaveCount(0);
  expect(normaliser(await page.locator('main').innerText())).not.toMatch(/boutique/i);
  await expect(page.locator('header a[href="/boutique.html"]')).toHaveCount(1);
  const enAmbre = await page.$$eval('main a, main button', (elements) => elements
    .filter((e) => !e.closest('#bars') && getComputedStyle(e).backgroundColor === 'rgb(255, 177, 61)')
    .map((e) => e.getAttribute('href') ?? e.closest('form')?.id));
  expect(enAmbre.length).toBeGreaterThan(0);
  expect(enAmbre.filter((cible) => cible !== '#attente' && cible !== 'attente')).toEqual([]);
  // Un rappel mène au formulaire, et le champ est là.
  await rappels.last().click();
  await expect(page).toHaveURL(/#attente$/);
  await expect(page.locator('#attente-mail')).toBeInViewport();
  // Le champ a le focus : on écrit tout de suite, sans toucher encore.
  await expect(page.locator('#attente-mail')).toBeFocused();
  // Un Ctrl-clic ouvre le formulaire dans un autre onglet : ici, le focus reste où il était.
  await page.evaluate(() => document.activeElement.blur());
  const premier = rappels.first();
  await premier.focus();
  await premier.click({ modifiers: ['Control'] });
  await expect(premier).toBeFocused();
});

for (const largeur of [320, 360]) {
  test(`à ${largeur} px, chaque rappel « préviens-moi » se coupe entre deux mots, jamais dans « préviens-moi », et se touche du doigt`, async ({ page }) => {
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
  for (const selecteur of ['.ouverture__texte', '.attente__etiquette', '#attente-mail']) {
    const boite = await page.locator(selecteur).boundingBox();
    expect(boite.y, `${selecteur} : haut`).toBeGreaterThanOrEqual(0);
    expect(boite.y + boite.height, `${selecteur} : bas`).toBeLessThanOrEqual(640);
  }
});

test('la note de la liste d’attente mène droit à ce qu’on fait de l’adresse, et combien de temps', async ({ page }) => {
  await page.goto('/');
  const lien = page.locator('.attente__note a');
  await expect(lien).toHaveAttribute('href', '/confidentialite.html#liste-attente');
  await expect(lien).toHaveText('Ce qu’on garde, et combien de temps');
  await lien.click();
  await expect(page.locator('#liste-attente')).toHaveText('La liste d’attente');
  await expect(page.locator('#liste-attente')).toBeInViewport();
});

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

for (const largeur of [360, 1280]) {
  test(`à ${largeur} px : le bouton du film l’arrête au clavier, juste après les matchs de la semaine, et la pause tient en revenant au film`, async ({ page }) => {
    await simulerUnLecteur(page);
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const lecture = page.locator('#film-lecture');
    await page.locator('#film').scrollIntoViewIfNeeded();
    await expect.poll(() => lireLeFilm(page)).toEqual({ enPause: false, muet: true, controles: false });
    await expect(lecture).toBeVisible();
    await expect(lecture).toHaveAccessibleName('Mettre le film en pause');
    await expect(lecture).not.toHaveAttribute('aria-pressed', /.*/);
    // Au clavier : juste après le dernier lien des matchs du jour choisi (sous la liste d’attente : au téléphone, le film
    // vient après eux), dans le cadre du film.
    await page.locator('#semaine').locator('a:visible, input:checked').last().focus();
    await page.keyboard.press('Tab');
    await expect(lecture).toBeFocused();
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
  await page.locator('.soiree__suite').scrollIntoViewIfNeeded();
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

// Le film est en portrait, jamais étiré : son cadre garde le 9:16 du fichier, au téléphone sous la liste d’attente, sur
// ordinateur à droite du titre.
for (const [largeur, hauteur] of [[360, 800], [1280, 720], [1440, 900], [2560, 1440]]) {
  test(`à ${largeur}×${hauteur}, le film garde son 9:16, ${largeur < 960 ? 'sous la liste d’attente' : 'à droite du titre'}`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto('/');
    const [video, titre, bouton] = await Promise.all([page.locator('#film').boundingBox(), page.locator('#titre').boundingBox(), page.locator('#attente button[type="submit"]').boundingBox()]);
    // Le cadre est un peu tourné sur ordinateur : la boîte vue garde le rapport à 5 % près.
    expect(Math.abs(video.height / video.width - 16 / 9) / (16 / 9)).toBeLessThan(0.05);
    if (largeur < 960) expect(video.y).toBeGreaterThan(bouton.y + bouton.height);
    else {
      expect(video.x).toBeGreaterThan(titre.x + titre.width);
      expect(video.y + video.height).toBeLessThanOrEqual(hauteur + 120);
    }
  });
}

// WCAG 2.2.2 : la vague du verre de l’ouverture s’arrête d’elle-même avant 5 s, sur l’image du verre immobile du logo
// (une longueur d’onde entière, 140 px : la dernière image est la première). Sans animation en mouvement réduit.
test('la vague du verre s’arrête d’elle-même avant 5 s, sur l’image du verre immobile', async ({ page }) => {
  await page.goto('/');
  const vagues = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'bm-vague').map((a) => {
    const temps = a.effect.getComputedTiming();
    const images = a.effect.getKeyframes();
    return { fin: temps.endTime, iterations: temps.iterations, derniere: images[images.length - 1].transform };
  }));
  expect(vagues).toHaveLength(1);
  for (const vague of vagues) {
    expect(Number.isFinite(vague.iterations), 'un nombre fixe de passages').toBe(true);
    expect(vague.fin).toBeLessThanOrEqual(5000);
    expect(vague.derniere).toBe('translateX(-140px)');
  }
  await page.evaluate(() => document.getAnimations().forEach((a) => { if (a.animationName === 'bm-vague') a.finish(); }));
  expect(await page.locator('.ouverture .bm-vague').evaluate((v) => getComputedStyle(v).transform)).toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'bm-vague').length)).toBe(0);
});

// Un soir de match, minute par minute : ce que l’appli fait aujourd’hui, chez les testeurs, en huit moments dans
// l’ordre de la soirée, chacun avec son vrai écran (bar, clubs et pseudos inventés), marqué « Écran de démonstration ».
// Les phrases qui portent une règle de l’appli sont figées : une règle qui change les change avec elle.
const INSTANTS = [
  { heure: '18:42', titre: 'Le match de ce soir, en premier', ecran: 'ce-soir', telephone: true, dit: ['le match de ce soir, et les bars qui le passent', 'les plus proches qui ont encore de la place', 'Ta position reste sur ton téléphone.'] },
  { heure: '18:50', titre: 'Bar complet ? Mets-toi sur la liste', ecran: 'liste-attente', dit: ['avant le coup d’envoi, le premier de la liste la voit dans l’appli', 'Elle n’est pas mise de côté'] },
  { heure: '19:05', titre: 'La carte cherche pour toi', ecran: 'carte-recherche', dit: ['un club, un bar, un quartier ou une adresse', 'de la place, un grand écran, le son du match, une terrasse, un accès PMR'] },
  { heure: '19:12', titre: 'Garde ta place d’un geste', ecran: 'bar', telephone: true, dit: ['C’est gratuit.', 'Lâche avant la fin : rien n’est réservé.'] },
  { heure: '19:13', titre: 'Ton pass, même sans réseau', ecran: 'ta-soiree', telephone: true, dit: ['un QR code et un code à 6 chiffres', 'même sans réseau', 'ouvre le bar dans ton appli de cartes'] },
  { heure: '19:20', titre: 'Toute la bande à la même table', ecran: 'tablee', dit: ['jusqu’à 8, toi compris', 'Ceux qui la rejoignent dans l’appli ont chacun leur pass.', 'en story'] },
  { heure: '20:25', titre: '« Je suis en retard »', ecran: 'en-retard', dit: ['10, 20 ou 30 minutes', 'jusqu’à quelle heure ta place t’attend'] },
  { heure: '20:37', titre: 'Tu y es', ecran: 'tu-y-es', telephone: true, dit: ['scanne son QR code ou montre ton pass à l’équipe', 'un sous-bock aux noms des deux clubs'] },
];

test('la soirée en huit moments, dans l’ordre, chacun avec son écran de démonstration', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#titre-soiree')).toHaveText('Un soir de match, minute par minute.');
  // Ce que montrent ces moments est publié dans la version de test de l’appli (le propriétaire, 28 octobre).
  await expect(page.locator('.soiree .surtitre')).toHaveText('Dans la version de test de l’appli');
  expect(normaliser(await page.locator('.soiree__chapo').innerText())).toBe('Sur ces écrans, les bars, les clubs et les pseudos sont inventés.');
  const lus = await page.locator('.instant').evaluateAll((instants) => instants.map((m) => ({
    heure: m.querySelector('.instant__heure time').textContent,
    titre: m.querySelector('h3.instant__titre').textContent.replace(/\s+/g, ' ').trim(),
    texte: m.querySelector('.instant__texte').textContent.replace(/\s+/g, ' ').trim(),
    etiquette: m.querySelector('.instant__ecran .exemple')?.textContent,
    img: ((i) => ({ src: i.src, srcset: i.getAttribute('srcset'), alt: i.alt, width: i.getAttribute('width'), height: i.getAttribute('height'), loading: i.getAttribute('loading') }))(m.querySelector('.instant__ecran img')),
  })));
  expect(lus).toHaveLength(INSTANTS.length);
  lus.forEach((lu, i) => {
    const attendu = INSTANTS[i];
    expect(lu.heure).toBe(attendu.heure);
    expect(lu.titre).toBe(attendu.titre);
    for (const morceau of attendu.dit) expect(lu.texte, `${attendu.titre} : « ${morceau} »`).toContain(morceau);
    expect(lu.etiquette).toBe('Écran de démonstration');
    expect(lu.img.src).toMatch(new RegExp(`/img/appli/${attendu.ecran}-300\\.webp$`));
    expect(lu.img.srcset).toBe(`/img/appli/${attendu.ecran}-300.webp 300w, /img/appli/${attendu.ecran}-600.webp 600w`);
    expect(lu.img.alt.length, `${attendu.titre} : un texte pour l’écran`).toBeGreaterThan(40);
    expect([lu.img.width, lu.img.height, lu.img.loading]).toEqual(['300', '649', 'lazy']);
  });
  // Les heures avancent, comme la soirée.
  expect(lus.map((m) => m.heure)).toEqual([...lus.map((m) => m.heure)].sort());
  // Rien d’autre ne promet les notifications : au plus une par match, et la ligne calme d’une heure avant.
  expect(normaliser(await page.locator('.soiree__notifs').innerText())).toBe('Une heure avant le coup d’envoi, ton écran verrouillé te rappelle ta place, sans son, avec un bouton vers ton pass. Pour le reste, au plus une notification par match.');
  const soiree = normaliser(await page.locator('.soiree').innerText());
  expect(soiree).not.toMatch(/[!%]|avis|vérifiés|disponible sur|iPhone/i);
});

test('les écrans de la soirée ne se chargent qu’en approchant, sans rien faire bouger', async ({ page }) => {
  const demandes = [];
  page.on('request', (r) => { const chemin = new URL(r.url()).pathname; if (chemin.startsWith('/img/appli/')) demandes.push(chemin); });
  await page.setViewportSize({ width: 412, height: 823 });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(demandes, 'aucun écran au premier affichage').toEqual([]);
  // Loin de la soirée, ses écrans ne sont pas affichés (un navigateur charge une image paresseuse bien avant qu’elle
  // n’arrive à l’écran, jusqu’à 2 500 px avant sur un réseau lent) : leur place est gardée.
  await expect(page.locator('.soiree')).not.toHaveClass(/est-proche/);
  expect(await page.locator('.instant__ecran img').evaluateAll((i) => i.map((e) => getComputedStyle(e).display))).toEqual(Array(INSTANTS.length).fill('none'));
  const premier = page.locator('.instant__ecran').first();
  const avant = await premier.boundingBox();
  await page.locator('.soiree').scrollIntoViewIfNeeded();
  await expect.poll(() => demandes.length).toBeGreaterThan(0);
  await expect(premier.locator('img')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const apres = await premier.boundingBox();
  expect(apres.height).toBeCloseTo(avant.height, 0);
  expect(apres.y).toBeCloseTo(avant.y, 0);
});

// Au téléphone, quatre moments ont leur écran (les autres se lisent sans : la page reste courte) ; sur ordinateur, les
// huit. Sans JavaScript, ces écrans se voient quand même ; l’essai du geste, qui en a besoin, n’est pas proposé.
test('au téléphone, quatre écrans sur huit, avec ou sans JavaScript ; sans JavaScript, pas d’essai du geste', async ({ page, browser }) => {
  const visibles = (onglet) => onglet.locator('.instant__ecran').evaluateAll((f) => f.map((e) => getComputedStyle(e).display !== 'none'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await visibles(page)).toEqual(INSTANTS.map((m) => Boolean(m.telephone)));
  const contexte = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  try {
    const onglet = await contexte.newPage();
    await onglet.goto('/');
    expect(await visibles(onglet)).toEqual(INSTANTS.map((m) => Boolean(m.telephone)));
    for (const ecran of await onglet.locator('.instant__ecran:not(.instant__ecran--large) img').all()) {
      await ecran.scrollIntoViewIfNeeded();
      await expect(ecran).toBeVisible();
    }
    await expect(onglet.locator('#essai')).toBeHidden();
  } finally {
    await contexte.close();
  }
});

test('sur ordinateur, l’écran à côté des moments suit la lecture : celui du moment au milieu de la fenêtre', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const visibles = () => page.locator('.instant__ecran').evaluateAll((f) => f.map((e) => getComputedStyle(e).opacity === '1'));
  for (const rang of [0, 4, 7]) {
    await page.locator('.instant__corps').nth(rang).evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await expect.poll(visibles).toEqual(INSTANTS.map((_, i) => i === rang));
    // L’écran reste à côté du texte, et dans la fenêtre.
    const [corps, ecran] = await Promise.all([page.locator('.instant__corps').nth(rang).boundingBox(), page.locator('.instant__ecran').nth(rang).boundingBox()]);
    expect(ecran.x).toBeGreaterThan(corps.x + corps.width);
    expect(ecran.y).toBeGreaterThanOrEqual(0);
    expect(ecran.y + ecran.height).toBeLessThanOrEqual(900);
  }
});

// « Maintiens pour essayer » : le geste de l’appli, sur la page. Il se tient au clavier (Espace) comme au doigt ; lâché
// avant 1,4 s, il se vide ; rien n’est envoyé.
test('« Maintiens pour essayer » : tenu jusqu’au bout, « Place gardée. » ; lâché trop tôt, il se vide ; rien ne part', async ({ page }) => {
  const envois = [];
  page.on('request', (r) => { if (r.method() !== 'GET') envois.push(r.url()); });
  await page.goto('/');
  const bouton = page.locator('#essai-bouton');
  const note = page.locator('#essai-note');
  await bouton.scrollIntoViewIfNeeded();
  await expect(bouton).toHaveText('Maintiens pour essayer');
  await expect(note).toHaveText('Ici, c’est un essai.');
  await expect(note).toHaveAttribute('role', 'status');
  await bouton.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(300);
  await page.keyboard.up(' ');
  await expect(note).toHaveText('Lâché trop tôt : le verre se vide. Tiens jusqu’au bout.');
  // Lâché, il ne se remplit pas plus tard.
  await page.waitForTimeout(1600);
  await expect(bouton).not.toHaveClass(/est-plein/);
  await expect(bouton).toHaveText('Maintiens pour essayer');
  await page.keyboard.down(' ');
  await expect(bouton).toHaveText('Place gardée.', { timeout: 3000 });
  await page.keyboard.up(' ');
  await expect(note).toHaveText('C’était un essai : rien n’est réservé.');
  expect(await bouton.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(255, 177, 61)');
  await expect(bouton).toHaveText('Maintiens pour essayer', { timeout: 6000 });
  expect(envois).toEqual([]);
});

test('« Maintiens pour essayer » en mouvement réduit : un appui suffit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#essai-bouton').click();
  await expect(page.locator('#essai-bouton')).toHaveText('Place gardée.');
});

// Un lecteur d’écran active le bouton par un simple clic, sans pointeur ni touche tenue : le verre se remplit d’un coup.
test('« Maintiens pour essayer » avec un lecteur d’écran : un clic sans pointeur suffit', async ({ page }) => {
  await page.goto('/');
  await page.locator('#essai-bouton').evaluate((b) => b.click());
  await expect(page.locator('#essai-bouton')).toHaveText('Place gardée.');
  await expect(page.locator('#essai-note')).toHaveText('C’était un essai : rien n’est réservé.');
});

// Une touche tenue se répète (Espace ou Entrée) : chaque répétition reste une touche tenue, jamais un clic. Lâchée
// avant 1,4 s, le verre se vide, comme au doigt.
for (const touche of [' ', 'Enter']) {
  test(`« Maintiens pour essayer » : ${touche === ' ' ? 'Espace' : 'Entrée'} tenue avec ses répétitions, lâchée trop tôt, ne remplit rien`, async ({ page }) => {
    await page.goto('/');
    const bouton = page.locator('#essai-bouton');
    await bouton.scrollIntoViewIfNeeded();
    await bouton.focus();
    await page.keyboard.down(touche);
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(100);
      await page.keyboard.down(touche);
    }
    await page.keyboard.up(touche);
    await expect(page.locator('#essai-note')).toHaveText('Lâché trop tôt : le verre se vide. Tiens jusqu’au bout.');
    await page.waitForTimeout(1600);
    await expect(bouton).not.toHaveClass(/est-plein/);
    await expect(bouton).toHaveText('Maintiens pour essayer');
  });
}

// « Bar complet ? Mets-toi sur la liste » ne se coupe jamais au trait d’union, du plus petit téléphone à l’ordinateur.
for (const largeur of [320, 360, 375, 390, 1280]) {
  test(`à ${largeur} px, « Mets-toi » reste sur une ligne`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const lignes = await page.locator('.instant__titre .insecable').evaluate((e) => {
      const plage = document.createRange();
      plage.selectNodeContents(e);
      return new Set([...plage.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lignes).toBe(1);
  });
}

