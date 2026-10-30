// Le texte agrandi (WCAG 2.2, 1.4.4 et 1.4.10) : avec le texte à 200 % sur un écran de 320 ou 360 px, rien ne sort de
// l’écran sur aucune page et la page ne défile pas de côté (une adresse e-mail passe à la ligne au lieu de pousser le
// bord). Le lien « Aller au contenu » reste entièrement caché tant qu’il n’a pas le focus, à toutes les tailles de
// texte, et se voit en entier quand il l’a.
import { test, expect } from '@playwright/test';
import { PAGES } from './outils/pages.mjs';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { auJourDeLAccueil } from './outils/horloge.mjs';
import { couperLAPI, simulerLInvitation } from './outils/invitation.mjs';

// Le réglage du navigateur « taille du texte » : par le style de l’élément racine, comme dans tests/entete.spec.mjs.
const agrandir = (onglet, pourcent) => onglet.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pourcent);

// Ce qui dépasse à gauche ou à droite de l’écran. Hors jeu : le verre et son halo (coupés exprès par leur section),
// les dessins, le lien d’évitement (posé hors de l’écran exprès) et les champs pièges des robots.
const lireLesDebordements = (onglet) => onglet.evaluate(() => {
  const largeur = document.documentElement.clientWidth;
  const dehors = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.getClientRects().length) continue;
    if (e.closest('.verre, svg, .lien-evitement, .attente__piege, .formulaire__piege, .visuellement-cache')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > largeur + 0.5 || r.left < -0.5) {
      dehors.push(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''} « ${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)} » de ${Math.round(r.left)} à ${Math.round(r.right)} px`);
    }
  }
  return { defile: document.documentElement.scrollWidth > largeur, dehors };
});

for (const page of PAGES) {
  for (const largeur of [320, 360]) {
    test(`${page.nom} à ${largeur} px, texte à 200 % : rien ne sort de l’écran, la page ne défile pas de côté`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.emulateMedia({ reducedMotion: 'reduce' });
      await onglet.setViewportSize({ width: largeur, height: 700 });
      await onglet.goto(page.chemin);
      // Sur « Pour les bars », le formulaire et sa feuille arrivent après le premier écran : on mesure la page finie.
      await attendreLaPageFinie(onglet);
      await agrandir(onglet, 200);
      const lu = await lireLesDebordements(onglet);
      expect(lu.dehors).toEqual([]);
      expect(lu.defile, 'la page défile de côté').toBe(false);
    });
  }

  test(`${page.nom} : « Aller au contenu » reste caché sans le focus à 100, 150 et 200 %, et se voit en entier avec`, async ({ page: onglet }) => {
    await couperLAPI(onglet);
    await onglet.setViewportSize({ width: 360, height: 700 });
    await onglet.goto(page.chemin);
    const lien = onglet.locator('.lien-evitement');
    await expect(lien).toHaveCount(1);
    for (const pourcent of [100, 150, 200]) {
      await agrandir(onglet, pourcent);
      await onglet.evaluate(() => document.activeElement?.blur());
      const cache = await lien.evaluate((a) => a.getBoundingClientRect().bottom);
      expect(cache, `à ${pourcent} % sans le focus : bas du lien`).toBeLessThanOrEqual(0);
      await lien.focus();
      const vu = await lien.evaluate((a) => {
        const r = a.getBoundingClientRect();
        return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right };
      });
      expect(vu.haut, `à ${pourcent} % avec le focus : haut du lien`).toBeGreaterThanOrEqual(0);
      expect(vu.gauche).toBeGreaterThanOrEqual(0);
      expect(vu.droite).toBeLessThanOrEqual(360);
      expect(vu.bas).toBeLessThanOrEqual(700);
    }
  });
}

// La page d’une tablée avec l’invitation affichée (carte, « Tu n’as pas l’appli ? », l’appli) : la plus chargée.
for (const largeur of [320, 360]) {
  test(`tablée ouverte à ${largeur} px, texte à 200 % : rien ne sort de l’écran, la page ne défile pas de côté`, async ({ page: onglet }) => {
    await simulerLInvitation(onglet);
    await onglet.emulateMedia({ reducedMotion: 'reduce' });
    await onglet.setViewportSize({ width: largeur, height: 700 });
    await onglet.goto('/t/abcdefghjkmn');
    await expect(onglet.locator('#tablee-carte')).toBeVisible();
    await agrandir(onglet, 200);
    const lu = await lireLesDebordements(onglet);
    expect(lu.dehors).toEqual([]);
    expect(lu.defile, 'la page défile de côté').toBe(false);
  });
}

// L’étiquette « Écran de démonstration », posée à cheval sur le haut d’un écran : à 200 %, elle passe sur deux lignes.
// Son texte doit rester dans sa pilule nuit (sinon sa première ligne, claire, sort sur le crème de l’accueil : 1:1).
for (const chemin of ['/', '/pour-les-bars.html']) {
  for (const largeur of [320, 1280]) {
    test(`${chemin} à ${largeur} px, texte à 200 % : le texte de chaque « Écran de démonstration » reste dans sa pilule`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.emulateMedia({ reducedMotion: 'reduce' });
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.goto(chemin);
      await attendreLaPageFinie(onglet);
      await agrandir(onglet, 200);
      const lu = await onglet.evaluate(() => [...document.querySelectorAll('.exemple')].filter((e) => e.checkVisibility()).map((e) => {
        const boite = e.getBoundingClientRect();
        const plage = document.createRange();
        plage.selectNodeContents(e);
        const lignes = [...plage.getClientRects()];
        const dehors = lignes.filter((l) => l.top < boite.top - 0.5 || l.bottom > boite.bottom + 0.5 || l.left < boite.left - 0.5 || l.right > boite.right + 0.5);
        return { lignes: lignes.length, dehors: dehors.map((l) => `${Math.round(l.top)}–${Math.round(l.bottom)} px pour ${Math.round(boite.top)}–${Math.round(boite.bottom)} px`) };
      }));
      expect(lu.length).toBeGreaterThan(0);
      expect(lu.flatMap((e) => e.dehors)).toEqual([]);
    });
  }
}

// Un titre très grand, texte à 200 % sur un petit écran : il passe à la ligne entre deux mots, jamais au milieu d’un
// mot (« Baromatc / h », qu’un titre de 72 px coupait à 320 px). Chaque mot de chaque titre h1 et h2 visible de
// l’accueil et de « Pour les bars » reste sur une seule ligne.
for (const [nom, chemin] of [['l’accueil', '/'], ['« Pour les bars »', '/pour-les-bars.html']]) for (const largeur of [320, 360]) {
  test(`${nom} à ${largeur} px, texte à 200 % : aucun mot d’un titre h1 ou h2 n’est coupé sur deux lignes`, async ({ page: onglet }) => {
    await auJourDeLAccueil(onglet);
    await couperLAPI(onglet);
    await onglet.emulateMedia({ reducedMotion: 'reduce' });
    await onglet.setViewportSize({ width: largeur, height: 700 });
    await onglet.goto(chemin);
    // Sur « Pour les bars », le formulaire et sa feuille arrivent après le premier écran : on mesure la page finie.
    if (chemin !== '/') await attendreLaPageFinie(onglet);
    await onglet.evaluate(() => document.fonts.ready);
    await agrandir(onglet, 200);
    const lu = await onglet.evaluate(() => {
      const titres = [...document.querySelectorAll('h1, h2')].filter((t) => t.checkVisibility() && !t.closest('.visuellement-cache'));
      const coupes = [];
      for (const titre of titres) {
        const marcheur = document.createTreeWalker(titre, NodeFilter.SHOW_TEXT);
        for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
          for (const mot of n.data.matchAll(/\S+/g)) {
            const plage = document.createRange();
            plage.setStart(n, mot.index);
            plage.setEnd(n, mot.index + mot[0].length);
            if (new Set([...plage.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1) coupes.push(`#${titre.id} : « ${mot[0]} »`);
          }
        }
      }
      return { titres: titres.length, coupes };
    });
    expect(lu.titres).toBeGreaterThan(5);
    expect(lu.coupes).toEqual([]);
  });
}

// Le réglage des places de la salle, texte à 200 % sur un iPhone (393 px) : il passe sur deux lignes, et son fond arrondi
// reste un rectangle aux coins arrondis. Avec un rayon de 999px, il devenait un ovale dont le bord traversait le
// bouton « − » et le début de « places sur Baromatch ». Chaque bouton (un disque) est tout entier dans le fond, et chaque
// ligne de son texte commence dedans.
test('« Pour les bars » à 393 px, texte à 200 % : le réglage des places, sur deux lignes, garde ses boutons et son texte dans son fond', async ({ page: onglet }) => {
  await couperLAPI(onglet);
  await onglet.emulateMedia({ reducedMotion: 'reduce' });
  await onglet.setViewportSize({ width: 393, height: 659 });
  await onglet.goto('/pour-les-bars.html');
  await attendreLaPageFinie(onglet);
  await onglet.evaluate(() => document.fonts.ready);
  await agrandir(onglet, 200);
  const lu = await onglet.evaluate(() => {
    const pas = document.querySelector('.pas');
    const p = pas.getBoundingClientRect();
    const r = Math.min(parseFloat(getComputedStyle(pas).borderTopLeftRadius), p.width / 2, p.height / 2);
    // La distance d’un point au bord du fond arrondi, vers l’intérieur (négative dehors).
    const marge = (x, y) => {
      const cx = Math.min(Math.max(x, p.left + r), p.right - r);
      const cy = Math.min(Math.max(y, p.top + r), p.bottom - r);
      return r - Math.hypot(x - cx, y - cy);
    };
    const dehors = [];
    for (const bouton of pas.querySelectorAll('.pas__bouton')) {
      const b = bouton.getBoundingClientRect();
      if (marge(b.left + b.width / 2, b.top + b.height / 2) < b.width / 2 - 0.5) dehors.push(`le bouton « ${bouton.textContent} »`);
    }
    const plage = document.createRange();
    plage.selectNodeContents(pas.querySelector('.pas__nom'));
    for (const ligne of [...plage.getClientRects()].filter((l) => l.width > 0)) {
      if (marge(ligne.left, ligne.top + ligne.height / 2) < 0) dehors.push(`la ligne de texte à ${Math.round(ligne.top - p.top)} px`);
    }
    return { deuxLignes: p.height > 100, dehors };
  });
  expect(lu.deuxLignes, 'le réglage passe sur deux lignes').toBe(true);
  expect(lu.dehors).toEqual([]);
});
