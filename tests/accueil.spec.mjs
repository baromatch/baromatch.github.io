// L’accueil vu par un fan qui arrive un soir de match : dès le premier écran, il lit que Baromatch n’est pas encore
// ouvert, que l’appli est gratuite pour les fans et où elle en est (Android en test, pas d’iPhone), et il voit le champ
// et le bouton de la liste d’attente (sur ordinateur, même un écran court, la phrase « gratuite… pas encore ouverte »).
// La phrase de l’accueil « Ton match. Ton bar. Ce soir. » reste celle de la marque. Sous les étapes, « Ton club » mène
// à la page de chaque club.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { racine } from './outils/environnement.mjs';
import { fichierDe } from './outils/pages.mjs';
import { CAPTURE, MAINTENANT_DE_LA_CAPTURE } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { TEXTES_SUIVRE, cheminDuClub } from '../generateur/suivre.mjs';

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
  // Aucune promesse d’appli iPhone ni de date de lancement (rien n’est annoncé), dans ce que la page dit elle-même. La
  // transcription du film (#film-texte) recopie son image de fin telle qu’elle est, « Bientôt sur Android et iPhone » :
  // c’est le film qui le dit (question posée au propriétaire), elle est lue à part, plus bas.
  const page_ = normaliser(await page.evaluate(() => {
    const transcription = document.getElementById('film-texte');
    const parent = transcription?.parentNode;
    const suivant = transcription?.nextSibling;
    transcription?.remove();
    const texte = document.body.innerText;
    if (transcription) parent.insertBefore(transcription, suivant);
    return texte;
  }));
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

// Plus bas dans la page, « préviens-moi » revient deux fois : après le film et après les questions. La même capsule
// ambre que sur les pages des matchs, vers le formulaire du haut. « Voir la boutique » passe en verre : près de ces
// rappels, l’ambre reste à l’appel des fans (« Deviens testeur Android » garde le sien).
test('« préviens-moi » revient après le film et après les questions ; la boutique en verre', async ({ page }) => {
  await page.goto('/');
  const rappels = page.locator('main .rappel-attente a.capsule');
  await expect(rappels).toHaveCount(2);
  await expect(rappels).toHaveText(['L’appli ouvre bientôt : préviens-moi', 'L’appli ouvre bientôt : préviens-moi']);
  for (const lien of await rappels.all()) await expect(lien).toHaveAttribute('href', '#attente');
  expect(await page.$$eval('main .rappel-attente', (p) => p.map((e) => e.closest('section').className.split(' ')[0])))
    .toEqual(['film', 'questions-fans']);
  const boutique = page.locator('main a[href="/boutique.html"]');
  await expect(boutique).toHaveCount(1);
  expect(await boutique.evaluate((a) => getComputedStyle(a).backgroundColor)).not.toBe('rgb(255, 177, 61)');
  expect(await page.locator('main a[href="/testeurs-android.html"]').evaluate((a) => getComputedStyle(a).backgroundColor)).toBe('rgb(255, 177, 61)');
  // Un rappel mène au formulaire, et le champ est là.
  await rappels.last().click();
  await expect(page).toHaveURL(/#attente$/);
  await expect(page.locator('#attente-mail')).toBeInViewport();
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

// Le film (WCAG 2.2.2) : il part seul, muet, en arrivant à l’écran. « Pause », juste avant le son, se prend au clavier,
// et la pause tient : revenir au film ne le relance pas. Le Chromium des tests ne lit pas le H.264 du film : la lecture
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
  test(`à ${largeur} px : « Pause » arrête le film au clavier, juste avant le son, et la pause tient en revenant au film`, async ({ page }) => {
    await simulerUnLecteur(page);
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const lecture = page.locator('#film-lecture');
    const son = page.locator('#film-son');
    await page.locator('#film').scrollIntoViewIfNeeded();
    await expect.poll(() => lireLeFilm(page)).toEqual({ enPause: false, muet: true, controles: false });
    await expect(lecture).toBeVisible();
    await expect(lecture).toHaveText('Pause');
    // Au clavier : juste après le dernier lien avant le film, et juste avant le son, à côté de lui dans le cadre.
    await page.locator('.attente__note a').focus();
    await page.keyboard.press('Tab');
    await expect(lecture).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(son).toBeFocused();
    const [boiteLecture, boiteSon, cadre] = await Promise.all([lecture.boundingBox(), son.boundingBox(), page.locator('#film-cadre').boundingBox()]);
    for (const boite of [boiteLecture, boiteSon]) {
      expect(boite.x).toBeGreaterThanOrEqual(cadre.x);
      expect(boite.x + boite.width).toBeLessThanOrEqual(cadre.x + cadre.width);
      expect(boite.y + boite.height).toBeLessThanOrEqual(cadre.y + cadre.height);
    }
    expect(Math.abs(boiteLecture.y - boiteSon.y), 'sur la même ligne que le son').toBeLessThan(1);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true });
    await expect(lecture).toHaveText('Lire');
    await expect(lecture).toBeFocused();
    // Le film sort de l’écran puis y revient : il reste en pause.
    await page.evaluate(() => window.scrollTo(0, 0));
    await deuxImages(page);
    await page.locator('#film').scrollIntoViewIfNeeded();
    await deuxImages(page);
    await deuxImages(page);
    expect(await lireLeFilm(page)).toMatchObject({ enPause: true });
    await expect(lecture).toHaveText('Lire');
    // « Lire » le relance.
    await lecture.press('Enter');
    await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false });
    await expect(lecture).toHaveText('Pause');
  });
}

test('le film encore en chargement : « Pause » l’arrête sans faire tomber les boutons ni le focus', async ({ page }) => {
  // Le vrai lecteur : sa lecture attend des données, et pause() annule cette attente (AbortError). Ce n’est pas un refus
  // de lecture automatique : les boutons restent, sans lecteur classique.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: false, controles: false });
  await page.locator('#film-lecture').press('Enter');
  await expect.poll(() => lireLeFilm(page)).toMatchObject({ enPause: true });
  await deuxImages(page);
  expect(await lireLeFilm(page)).toEqual({ enPause: true, muet: true, controles: false });
  await expect(page.locator('#film-lecture')).toBeFocused();
  await expect(page.locator('#film-son')).toBeVisible();
});

test('avec « réduire les animations », le film ne part pas : le lecteur classique, sans « Pause » ni « Mettre le son »', async ({ page }) => {
  await simulerUnLecteur(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await deuxImages(page);
  expect(await lireLeFilm(page)).toEqual({ enPause: true, muet: true, controles: true });
  await expect(page.locator('#film-lecture')).toBeHidden();
  await expect(page.locator('#film-son')).toBeHidden();
});

// WCAG 4.1.2 : le bouton du son dit ce qu’il fera (« Mettre le son », « Couper le son ») ; il n’a pas en plus un état
// « enfoncé », qui ferait entendre « Couper le son, enfoncé » pendant que le son joue.
test('le bouton du son change de nom, sans état « enfoncé » qui contredirait ce nom', async ({ page }) => {
  await simulerUnLecteur(page);
  await page.goto('/');
  const son = page.locator('#film-son');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect(son).toHaveText('Mettre le son');
  await expect(son).not.toHaveAttribute('aria-pressed', /.*/);
  await son.click();
  await expect(son).toHaveText('Couper le son');
  await expect(son).not.toHaveAttribute('aria-pressed', /.*/);
  expect(await lireLeFilm(page)).toMatchObject({ muet: false });
  await son.click();
  await expect(son).toHaveText('Mettre le son');
  expect(await lireLeFilm(page)).toMatchObject({ muet: true });
});

// WCAG 1.2.3 et 1.2.5 : le texte du film, à côté de lui. Ce que le film montre à l’écran, mot pour mot, lu sur ses images
// (ffmpeg, des deux versions) : rien d’autre. L’image de fin dit « Bientôt sur Android et iPhone » : la transcription le
// recopie tel quel (question posée au propriétaire, comme celle d’une voix dans la bande-son).
const LIGNES_DU_FILM = [
  'Ce soir, y a match.',
  'Tu le regardes où ?',
  'Les bars qui passent ton match. Juste à côté.',
  'Maintiens.',
  'Ça se remplit.',
  'C’est à toi.',
  'Ta place est gardée.',
  'Tu y es.',
  'La soirée, tu la gardes.',
  'Ton match, ton bar.',
  'Bientôt sur Android et iPhone · baromatch.fr',
];

test('le texte du film est juste sous lui, replié, avec chaque phrase du film dans l’ordre', async ({ page }) => {
  await page.goto('/');
  const texte = page.locator('#film-texte');
  await expect(texte).toHaveCount(1);
  expect(await texte.evaluate((d) => d.tagName === 'DETAILS' && d.previousElementSibling?.id === 'film-note'
    && d.previousElementSibling.previousElementSibling?.id === 'film-cadre' && !d.open)).toBe(true);
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

// WCAG 1.2.5 : le film a une bande-son, donc le texte seul ne suffit pas au niveau AA, sauf si le film se présente
// comme l’alternative en images d’un texte de la page. Une phrase visible le dit, et chaque lecteur du film la cite
// (aria-describedby), avec ou sans JavaScript.
const NOTE_DU_FILM = 'Ce film reprend en images le texte « Ce que montre le film », juste dessous. Ses bars, ses places et ses chiffres sont inventés.';

test('le film se présente comme les images du texte qui le suit, avec ou sans JavaScript', async ({ page, browser }) => {
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
  } finally {
    await sansJS.close();
  }
});

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

test('les cinq étapes disent que ça va marcher ainsi, que la place est gratuite, et ce qu’est un sous-bock', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#titre-soiree')).toHaveText('Comment ça va marcher');
  const etapes = await page.locator('.etape').evaluateAll((li) => li.map((e) => ({
    titre: e.querySelector('.etape__titre').textContent.replace(/\s+/g, ' ').trim(),
    texte: e.querySelector('.etape__texte').textContent.replace(/\s+/g, ' ').trim(),
  })));
  expect(etapes).toEqual([
    { titre: 'Choisis ton match', texte: 'Les matchs à venir, avec l’heure du coup d’envoi.' },
    { titre: 'Trouve ton bar', texte: 'Les bars qui le diffusent près de chez toi, et les places qui leur restent.' },
    { titre: 'Garde ta place', texte: 'Pour toi seul ou pour toute la bande, gratuitement, avant de partir.' },
    { titre: 'Arrive et montre ton pass', texte: 'À l’entrée, l’équipe du bar scanne ton pass, ou tu scannes le QR du bar : le bar sait que tu es là.' },
    { titre: 'Garde la soirée', texte: 'Chaque soirée validée devient un sous-bock, le souvenir du match, du bar et de la date, dans ton album.' },
  ]);
});

// « Ton club » : la page de chaque club (generateur/suivre.mjs en écrit une par club de generateur/contenu/suivre.json),
// dans l’ordre de cette liste et par son nom court (generateur/contenu/clubs.json), comme le guide et la semaine les
// donnent. Ni plus ni moins : un club ajouté à la liste, ou retiré, change l’accueil aussi. Et chaque page existe, dans
// le dépôt (le site servi) comme dans ce que le générateur écrit (la copie enregistrée des listes publiques) : si une
// page de club n’est plus écrite, le test échoue.
test('« Ton club » : la page de chaque club de la liste, dans son ordre, et chacune existe', async ({ page }) => {
  const { clubs } = chargerLeContenu(racine);
  const attendus = Object.keys(TEXTES_SUIVRE.clubs).filter((cle) => !cle.startsWith('_'))
    .map((cle) => ({ href: cheminDuClub(cle), texte: clubs[cle].court }));
  expect(attendus.length).toBeGreaterThan(0);
  await page.goto('/');
  const bloc = page.locator('#clubs-accueil');
  await expect(bloc.locator('h3')).toHaveText('Ton club');
  await expect(bloc.locator('p')).toHaveText('Ses prochains matchs, à l’heure de Paris : le jour, le coup d’envoi, la compétition.');
  const liens = await bloc.locator('a').evaluateAll((a) => a.map((l) => ({ href: l.getAttribute('href'), texte: l.textContent.trim() })));
  expect(liens).toEqual(attendus);
  for (const { href } of attendus) expect(existsSync(fichierDe(href)), href).toBe(true);
  const site = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, racine, contenu: chargerLeContenu(racine) });
  expect(site.pages.filter((p) => p.type === 'club').map((p) => p.chemin).sort()).toEqual(attendus.map((a) => a.href).sort());
});

// Il se lit sous les étapes et « Où regarder le match ce soir », dans « Comment ça va marcher », avant la bande des
// bars : bien après la liste d’attente. Des capsules de verre, sans ambre (l’ambre reste à « préviens-moi » et aux
// bars), de 44 × 44 px au moins ; au clavier, chaque club prend le focus à son tour, et le focus se voit.
for (const largeur of [360, 1280]) {
  test(`à ${largeur} px, « Ton club » suit les étapes, avant les bars, en capsules de verre de 44 px, au clavier`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    const ordre = await page.evaluate(() => {
      const bloc = document.getElementById('clubs-accueil');
      const avant = (a, b) => Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        section: bloc?.closest('section')?.classList[0] ?? null,
        apresLeFormulaire: avant(document.getElementById('attente'), bloc),
        apresCeSoir: avant(document.querySelector('.soiree__suite'), bloc),
        avantLesBars: avant(bloc, document.getElementById('bars')),
      };
    });
    expect(ordre).toEqual({ section: 'soiree', apresLeFormulaire: true, apresCeSoir: true, avantLesBars: true });
    const capsules = await page.locator('#clubs-accueil a').all();
    expect(capsules.length).toBeGreaterThan(0);
    // Alignées sur le titre, pas centrées comme sur la page introuvable : le style de l’accueil s’applique (son empreinte
    // est dans la politique de sécurité).
    const bords = await page.evaluate(() => [document.getElementById('titre-clubs-accueil'), document.querySelector('#clubs-accueil a')]
      .map((e) => e.getBoundingClientRect().left));
    expect(Math.abs(bords[0] - bords[1])).toBeLessThan(1);
    const ambre = /^rgba?\(255, 177, 61/;
    for (const capsule of capsules) {
      const lu = await capsule.evaluate((a) => {
        const s = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return { fond: s.backgroundColor, couleur: s.color, bord: s.borderTopColor, rayon: parseFloat(s.borderTopLeftRadius), largeur: r.width, hauteur: r.height };
      });
      const nom = await capsule.textContent();
      for (const cle of ['fond', 'couleur', 'bord']) expect(lu[cle], `${nom} : ${cle}`).not.toMatch(ambre);
      expect(lu.fond, nom).not.toBe('rgba(0, 0, 0, 0)');
      expect(lu.rayon, nom).toBeGreaterThanOrEqual(22);
      expect(lu.hauteur, nom).toBeGreaterThanOrEqual(44);
      expect(lu.largeur, nom).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.soiree__suite a').focus();
    for (const capsule of capsules) {
      await page.keyboard.press('Tab');
      await expect(capsule).toBeFocused();
      const contour = await capsule.evaluate((a) => ({ style: getComputedStyle(a).outlineStyle, epaisseur: parseFloat(getComputedStyle(a).outlineWidth) }));
      expect(contour.style).not.toBe('none');
      expect(contour.epaisseur).toBeGreaterThanOrEqual(2);
    }
  });
}
