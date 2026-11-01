// La condition du propriétaire pour le bandeau du bas, mot pour mot : « au téléphone, le bandeau du bas ne cache jamais
// rien (la fin des pages, « Proposer mon bar », les boutons d’un formulaire) et respecte la zone basse de l’iPhone et la
// barre d’outils de Safari ». Vérifié dans Chromium (Safari n’est pas installé ici : un vrai iPhone reste à essayer),
// sur chaque page écrite à la main et sur les pages des matchs d’un site d’exemple :
// - à l’arrivée, sur les écrans d’iPhone et d’Android avec les barres du navigateur affichées (une hauteur réduite),
//   rien n’est fixe : les entrées sont un rang sous le logo, visible, qui ne couvre rien ;
// - une fois ce rang sorti de l’écran, le bandeau du bas, à 390 et 375 px de large (iPhone), 412 et 360 px (Android),
//   texte à 100 et 200 % (un font-size posé sur <html>, que les media queries ne voient pas : le bandeau grandit de
//   rangs, le cas le plus dur) :
//   - la fin de la page remonte au-dessus de lui ;
//   - « Proposer mon bar » et chaque bouton de formulaire, amenés en bas de l’écran (comme le fait une ancre) puis par
//     le focus, s’arrêtent au-dessus de lui ;
//   - un champ texte, ou tout ce qui a le focus dans un formulaire, le fait rentrer dans son rang ; une puce le laisse ;
//   - à la tabulation, aucun arrêt n’est sous lui ;
//   - les retours des formulaires (l’inscription faite ou en panne, « Corriger l’adresse », l’envoi, la case oubliée)
//     se voient au-dessus de lui, que le bouton touché garde le focus (Android) ou non (iPhone) ;
//   - sur la boutique, il laisse la barre de sélection seule en bas, et reste dans son rang, au clavier ;
// - arrivé par un lien vers un formulaire (#attente, #proposer), que le navigateur amène en haut de l’écran, texte à
//   125 et 200 % dès le chargement : aucun champ ni bouton du formulaire n’est sous le bandeau (il reste dans son rang) ;
//   - il est à 10 px du bord, plus --zone-basse : sans viewport-fit=cover, Chromium donne 0 à
//     env(safe-area-inset-bottom) (Safari aussi, d’après sa documentation : à vérifier sur un vrai iPhone) ; la zone
//     basse d’un iPhone à encoche est aussi simulée, à 34 px.
// Avec le vrai réglage du navigateur (la taille du texte à 200 %, que les media queries voient), rien n’est fixe. Le
// bandeau ne se règle sur aucune hauteur d’écran (vh).
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { racine } from './outils/environnement.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

// La zone basse d’un iPhone à encoche, simulée (sans viewport-fit=cover, Safari la garde hors de la page).
const ZONE_BASSE = 34;
const BORD = 10;
// Deux iPhone (15 et SE), deux Android (Pixel 7, et le plus étroit, 360 px, où le bandeau commence) ; la zone basse
// simulée partout (plus dur qu’Android, dont la barre des gestes est hors de la page).
const CAS = [
  { largeur: 390, hauteur: 844, texte: 100 },
  { largeur: 390, hauteur: 844, texte: 200 },
  { largeur: 375, hauteur: 667, texte: 100 },
  { largeur: 375, hauteur: 667, texte: 200 },
  { largeur: 412, hauteur: 780, texte: 100 },
  { largeur: 412, hauteur: 780, texte: 200 },
  { largeur: 360, hauteur: 640, texte: 100 },
  { largeur: 360, hauteur: 640, texte: 200 },
];
// L’arrivée, les barres du navigateur affichées : la hauteur qu’il reste à la page.
const ECRANS_D_ARRIVEE = [
  { nom: 'iPhone 15, barres de Safari', largeur: 393, hauteur: 659 },
  { nom: 'iPhone 13 mini, barres de Safari', largeur: 375, hauteur: 629 },
  { nom: 'iPhone SE, barres de Safari', largeur: 375, hauteur: 548 },
  { nom: 'Pixel 7, barres de Chrome', largeur: 412, hauteur: 780 },
  { nom: 'Android de 360 px, barres de Chrome', largeur: 360, hauteur: 640 },
];
// Les pages des matchs du site d’exemple : la semaine, « Ce soir », un match, une ville (avec sa liste d’attente), un
// club, un bar, et une page en anglais.
const GENEREES = ['/matchs/', '/ce-soir/', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/', '/matchs/club/psg/', '/bar/le-zinc-des-amis-paris-11/', '/en/'];

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

let site = null;
test.beforeAll(async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'bandeau-du-bas-'));
  site = { dossier };
  await construireLeSiteDExemple(dossier, { rendu: null });
  site.serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(async () => {
  await site?.serveur?.arreter();
  if (site) rmSync(site.dossier, { recursive: true, force: true });
});

// Deux outils que le test pose dans la page : le bandeau tel qu’il est peint (fixe ou dans son rang, sa boîte), lu deux
// images plus tard (le passage du rang au bandeau suit le défilement), et la boîte d’un élément (une case cachée se
// voit par son étiquette).
const OUTILS = () => {
  window.bandeauDuBas = async () => {
    await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
    const liste = document.querySelector('.menu__liste');
    const s = getComputedStyle(liste);
    const r = liste.getBoundingClientRect();
    return { fixe: s.position === 'fixed', visible: s.visibility !== 'hidden', haut: r.top, bas: r.bottom, ecran: innerHeight };
  };
  window.boiteDuBandeau = (e) => {
    const cible = e.getBoundingClientRect().width < 2 ? (e.closest('label') ?? e.parentElement) : e;
    const r = cible.getBoundingClientRect();
    const quoi = (e.getAttribute('aria-label') || e.textContent || e.name || e.id || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
    return { quoi, haut: r.top, bas: r.bottom, hauteur: r.height, dansLeMenu: !!e.closest('.menu') };
  };
};

const ouvrir = async (onglet, adresse, { largeur, hauteur, texte }, zone = ZONE_BASSE) => {
  await couperLAPI(onglet);
  await onglet.setViewportSize({ width: largeur, height: hauteur });
  await onglet.goto(adresse);
  await attendreLaPageFinie(onglet);
  await onglet.evaluate(() => document.fonts.ready);
  await onglet.evaluate(({ texte, zone }) => {
    document.documentElement.style.fontSize = `${texte}%`;
    if (zone !== null) document.documentElement.style.setProperty('--zone-basse', `${zone}px`);
  }, { texte, zone });
  await onglet.evaluate(OUTILS);
};

const lireLeBandeau = (onglet) => onglet.evaluate(() => window.bandeauDuBas());
// Le rang sorti par le haut de l’écran, quand la page est assez longue : le bandeau est alors en bas.
const sortirLeRang = (onglet) => onglet.evaluate(() => {
  const bas = document.querySelector('.menu').getBoundingClientRect().bottom + scrollY;
  window.scrollTo(0, bas + 40);
  return document.documentElement.scrollHeight - innerHeight > bas + 40;
});

// Une boîte se voit (44 px d’elle au moins, ou toute, si elle est plus petite), et le bandeau n’en cache rien ; une
// boîte plus haute que la place au-dessus du bandeau (une grande image) ne peut que s’y voir en partie.
const auDessus = (boite, bandeau) => {
  const libre = !bandeau.fixe || !bandeau.visible || boite.dansLeMenu;
  const limite = libre ? bandeau.ecran : bandeau.haut;
  const vu = Math.min(boite.bas, limite) - Math.max(boite.haut, 0);
  if (vu < Math.min(boite.hauteur, 44) - 0.5) return false;
  return libre || boite.hauteur > bandeau.haut || boite.bas <= bandeau.haut + 0.5;
};
const dire = (boite, vu, facon = '') => `« ${boite.quoi} »${facon ? ` (${facon})` : ''} : ${Math.round(boite.haut)}–${Math.round(boite.bas)} px, bandeau ${vu.fixe ? `dès ${Math.round(vu.haut)} px` : 'dans son rang'}`;

const verifierLaPage = async (onglet, chemin, cas) => {
  // Le rang sorti par le haut : le bandeau en bas, à 10 px au-dessus de la zone basse.
  const longue = await sortirLeRang(onglet);
  const bandeau = await lireLeBandeau(onglet);
  expect(bandeau.fixe, 'le rang sorti de l’écran devient le bandeau du bas').toBe(longue);
  if (bandeau.fixe) expect(bandeau.ecran - bandeau.bas, 'le bas du bandeau, au-dessus du bord et de la zone basse').toBeCloseTo(BORD + ZONE_BASSE, 0);

  // La fin de la page : tout en bas, le dernier élément peint remonte au-dessus du bandeau.
  const fin = await onglet.evaluate(async () => {
    // Deux fois : une image paresseuse chargée en arrivant en bas ne change pas la hauteur (CLS 0), mais on s’en assure.
    for (let fois = 0; fois < 2; fois += 1) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
    }
    let bas = 0;
    let quoi = '';
    for (const e of document.body.querySelectorAll('*')) {
      if (e.matches('.pied, .menu, .menu *, .visuellement-cache, .visuellement-cache *, .lien-evitement, script, style, noscript, noscript *')) continue;
      const s = getComputedStyle(e);
      if (s.position === 'fixed' || s.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom > bas) { bas = r.bottom; quoi = `${e.tagName.toLowerCase()}.${e.className}`; }
    }
    return { bas, quoi, auBout: window.scrollY + innerHeight >= document.documentElement.scrollHeight - 1 };
  });
  expect(fin.auBout).toBe(true);
  const bandeauEnBas = await lireLeBandeau(onglet);
  if (bandeauEnBas.fixe) expect(fin.bas, `la fin de la page (${fin.quoi}) passe sous le bandeau`).toBeLessThanOrEqual(bandeauEnBas.haut + 0.5);

  // « Proposer mon bar » et les boutons des formulaires, amenés en bas de l’écran, puis par le focus.
  const cibles = await onglet.evaluate(() => [...document.querySelectorAll('a, button, input[type="submit"]')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.closest('.menu')
      && (e.textContent.replace(/\s+/g, ' ').trim() === 'Proposer mon bar' || (e.closest('form') && e.matches('button, input[type="submit"]'))))
    .map((e, i) => { e.dataset.cibleDuBandeau = String(i); return i; }));
  if (chemin.startsWith('/pour-les-bars')) expect(cibles.length, '« Proposer mon bar » et le bouton du formulaire').toBeGreaterThanOrEqual(4);
  expect(cibles.length, 'au moins « Proposer mon bar » du pied de page').toBeGreaterThan(0);
  for (const i of cibles) {
    for (const facon of ['bas', 'focus']) {
      const boite = await onglet.evaluate(({ i, facon }) => {
        const e = document.querySelector(`[data-cible-du-bandeau="${i}"]`);
        if (facon === 'bas') e.scrollIntoView({ block: 'end' });
        else { window.scrollTo(0, 0); e.focus(); }
        return window.boiteDuBandeau(e);
      }, { i, facon });
      const vu = await lireLeBandeau(onglet);
      expect(auDessus(boite, vu), dire(boite, vu, facon)).toBe(true);
      await onglet.evaluate(() => document.activeElement?.blur());
    }
  }

  // Un champ texte, ou tout ce qui a le focus dans un formulaire, fait rentrer le bandeau dans son rang ; une puce le
  // laisse comme il était.
  const champs = await onglet.evaluate(() => [...document.querySelectorAll('input, textarea')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.closest('[hidden], .attente__piege, .formulaire__piege'))
    .map((e, i) => { e.dataset.champDuBandeau = String(i); return { i, puce: e.type === 'radio' }; }));
  for (const { i, puce } of champs) {
    await onglet.evaluate((rang) => { window.scrollTo(0, document.documentElement.scrollHeight); document.querySelector(`[data-champ-du-bandeau="${rang}"]`).focus(); }, i);
    expect(await onglet.evaluate((rang) => document.activeElement?.dataset.champDuBandeau === String(rang), i), `champ ${i} : le focus`).toBe(true);
    const avec = await lireLeBandeau(onglet);
    await onglet.evaluate(() => document.activeElement?.blur());
    const sans = await lireLeBandeau(onglet);
    if (puce) expect(avec.fixe, `puce ${i} : le bandeau reste comme il était`).toBe(sans.fixe);
    else expect(avec.fixe, `champ ${i} : le bandeau rentre dans son rang`).toBe(false);
  }

  // La tabulation, du lien d’évitement au dernier lien de la page : aucun arrêt sous le bandeau.
  await onglet.evaluate(() => { const l = document.querySelector('.lien-evitement'); l.dataset.arretDuBandeau = 'depart'; l.focus(); });
  const vus = new Set(['depart']);
  const caches = [];
  for (let n = 0; n < 400; n += 1) {
    await onglet.keyboard.press('Tab');
    const arret = await onglet.evaluate((rang) => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      e.dataset.arretDuBandeau ??= String(rang);
      return { cle: e.dataset.arretDuBandeau, ...window.boiteDuBandeau(e) };
    }, n);
    if (!arret || vus.has(arret.cle)) break;
    vus.add(arret.cle);
    const vu = await lireLeBandeau(onglet);
    if (!auDessus(arret, vu)) caches.push(dire(arret, vu));
  }
  expect(vus.size, 'la tabulation parcourt la page').toBeGreaterThan(10);
  expect(caches, `${cas.largeur} px, texte ${cas.texte} % : arrêts sous le bandeau`).toEqual([]);
};

// ---------- À l’arrivée ----------

// Ce qui se touche au premier écran, et ce qui est fixe : rien ne doit l’être, et le rang des entrées se voit.
const lireLArrivee = (onglet) => onglet.evaluate(async () => {
  await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
  const liste = document.querySelector('.menu__liste');
  const r = liste.getBoundingClientRect();
  // Un décor fixe, derrière la page et sans pointeur (la lumière de « Pour les bars »), ne couvre rien.
  const fixes = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && getComputedStyle(e).pointerEvents !== 'none' && e.checkVisibility({ visibilityProperty: true }))
    .map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.height && b.bottom > 0 && b.top < innerHeight);
  const touches = [...document.querySelectorAll('a, button, input, select, textarea, summary')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.closest('.lien-evitement, .attente__piege, .formulaire__piege'))
    .map((e) => ({ quoi: (e.textContent || e.name || e.id).replace(/\s+/g, ' ').trim().slice(0, 40), b: e.getBoundingClientRect() }))
    .filter(({ b }) => b.width && b.height && b.bottom > 0 && b.top < innerHeight);
  const couverts = touches.filter(({ b }) => fixes.some((f) => b.left < f.right && f.left < b.right && b.top < f.bottom && f.top < b.bottom)).map(({ quoi }) => quoi);
  return { position: getComputedStyle(liste).position, rang: { haut: r.top, bas: r.bottom }, ecran: innerHeight, couverts };
});

for (const ecran of ECRANS_D_ARRIVEE) {
  for (const texte of [100, 200]) {
    test.describe(`à l’arrivée, ${ecran.nom} (${ecran.largeur} × ${ecran.hauteur}), texte à ${texte} %`, () => {
      const chemins = [...PAGES.map((p) => [p.nom, p.chemin, false]), ...GENEREES.map((c) => [c, c, true])];
      for (const [nom, chemin, genere] of chemins) {
        test(`${nom} : rien de fixe ne couvre le premier écran, et le rang des entrées se voit`, async ({ page: onglet }) => {
          await ouvrir(onglet, genere ? `${site.serveur.adresse}${chemin}` : chemin, { largeur: ecran.largeur, hauteur: ecran.hauteur, texte });
          const lu = await lireLArrivee(onglet);
          expect(lu.position, 'à l’arrivée, les entrées sont dans la page').toBe('static');
          expect(lu.couverts, 'ce qu’un élément fixe couvre').toEqual([]);
          expect(lu.rang.haut, 'le rang se voit').toBeGreaterThanOrEqual(0);
          expect(lu.rang.bas, 'le rang se voit').toBeLessThanOrEqual(lu.ecran);
          // Un premier geste ne le fait pas encore sauter en bas : il reste à sa place tant qu’il se voit.
          await onglet.evaluate(() => window.scrollTo(0, 24));
          expect((await lireLArrivee(onglet)).position).toBe('static');
        });
      }
    });
  }
}

// ---------- Une fois le rang sorti de l’écran ----------

for (const cas of CAS) {
  const nom = `${cas.largeur} px, texte à ${cas.texte} %`;
  test.describe(nom, () => {
    for (const page of PAGES) {
      test(`${page.nom} : le bandeau du bas ne cache rien`, async ({ page: onglet }) => {
        await ouvrir(onglet, page.chemin, cas);
        await verifierLaPage(onglet, page.chemin, cas);
      });
    }
    for (const chemin of GENEREES) {
      test(`${chemin} (page des matchs) : le bandeau du bas ne cache rien`, async ({ page: onglet }) => {
        await ouvrir(onglet, `${site.serveur.adresse}${chemin}`, cas);
        await verifierLaPage(onglet, chemin, cas);
      });
    }

    // Les retours des formulaires, une fois le bouton touché : ce qui s’affiche se voit au-dessus du bandeau, que le
    // bouton garde le focus (Chrome sur Android) ou non (Safari sur iPhone ne le donne pas au bouton touché).
    for (const iphone of [false, true]) {
      const qui = iphone ? 'sans focus sur le bouton, comme sur iPhone' : 'le bouton garde le focus';
      const toucher = async (onglet, selecteur) => {
        await onglet.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'end' }), selecteur);
        await onglet.locator(selecteur).click();
        if (iphone) await onglet.evaluate(() => document.activeElement?.blur());
      };
      const verifierLesBoites = async (onglet, selecteurs) => {
        const boites = await onglet.evaluate((liste) => liste.map((s) => document.querySelector(s)).filter((e) => e && e.checkVisibility({ visibilityProperty: true }))
          .map((e) => window.boiteDuBandeau(e)), selecteurs);
        expect(boites.length).toBeGreaterThan(0);
        const vu = await lireLeBandeau(onglet);
        for (const boite of boites) expect(auDessus(boite, vu), dire(boite, vu)).toBe(true);
      };

      for (const issue of ['ok', 'panne']) {
        test(`l’accueil, la liste d’attente (${issue === 'ok' ? 'inscription faite' : 'en panne'}, ${qui}) : le retour se voit`, async ({ page: onglet }) => {
          await onglet.route('https://formspree.io/**', (route) => (issue === 'ok'
            ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) : route.abort()));
          await ouvrir(onglet, '/', cas);
          await onglet.locator('#attente-mail').fill('fan.inventee@example.org');
          await onglet.evaluate(() => document.activeElement?.blur());
          await toucher(onglet, '.attente__bouton');
          await expect(onglet.locator('#attente-retour')).toHaveText(issue === 'ok' ? /C’est noté/ : /pas passée/);
          await verifierLesBoites(onglet, ['#attente-retour', '#attente-corriger']);
        });
      }

      // Une adresse vide ou incomplète : le message dit quoi corriger, sous le champ, et le champ prend le focus (le
      // bandeau rentre dans son rang). Le message se voit tout de suite, puis encore une fois le clavier fermé (le champ
      // perd le focus, le bandeau revient).
      for (const [quoi, adresse, message] of [['vide', '', /Vérifie ton adresse/], ['incomplète', 'fan.inventee@exemple', /Il manque la fin/]]) {
        test(`l’accueil, la liste d’attente, une adresse ${quoi} (${qui}) : le message se voit, le clavier ouvert puis fermé`, async ({ page: onglet }) => {
          await ouvrir(onglet, '/', cas);
          await onglet.locator('#attente-mail').fill(adresse);
          await onglet.evaluate(() => document.activeElement?.blur());
          await toucher(onglet, '.attente__bouton');
          await expect(onglet.locator('#attente-retour')).toHaveText(message);
          await verifierLesBoites(onglet, ['#attente-retour']);
          await onglet.evaluate(() => document.activeElement?.blur());
          await verifierLesBoites(onglet, ['#attente-retour']);
        });
      }

      test(`« Pour les bars », la case oubliée puis l’envoi (${qui}) : la case, son message et le bouton se voient`, async ({ page: onglet }) => {
        await ouvrir(onglet, '/pour-les-bars.html', cas);
        for (const [id, valeur] of [['demande-bar', 'Le Zinc inventé'], ['demande-ville', 'Paris'], ['demande-nom', 'Camille Exemple'], ['demande-email', 'patron.invente@example.org']]) {
          await onglet.locator(`#${id}`).fill(valeur);
        }
        await onglet.evaluate(() => document.activeElement?.blur());
        await toucher(onglet, '#demande-envoyer');
        await expect(onglet.locator('#demande-accord-erreur')).toBeVisible();
        await verifierLesBoites(onglet, ['#demande-accord', '#demande-accord-erreur']);
        await onglet.locator('#demande-accord').check();
        await toucher(onglet, '#demande-envoyer');
        await expect(onglet.locator('#demande-envoyer')).toHaveText(/Envoi/);
        await verifierLesBoites(onglet, ['#demande-envoyer']);
      });

      test(`« Deviens testeur Android », la case oubliée (${qui}) : la case et le bouton se voient`, async ({ page: onglet }) => {
        await ouvrir(onglet, '/testeurs-android.html', cas);
        for (const [id, valeur] of [['testeur-prenom', 'Lou_test'], ['testeur-mail', 'lou.inventee@example.org'], ['testeur-ville', 'Paris']]) {
          await onglet.locator(`#${id}`).fill(valeur);
        }
        await onglet.evaluate(() => document.activeElement?.blur());
        await onglet.evaluate(() => document.querySelector('.inscription__bouton').scrollIntoView({ block: 'end' }));
        await onglet.locator('.inscription__bouton').click();
        // La validation du navigateur met le focus sur la case : le bandeau rentre dans son rang.
        await expect(onglet.locator('#testeur-majeur')).toBeFocused();
        await verifierLesBoites(onglet, ['#testeur-majeur', '.inscription__bouton']);
      });
    }

    test('la boutique, avec une sélection : le bandeau laisse la barre seule en bas, et reste dans son rang, au clavier', async ({ page: onglet }) => {
      await onglet.goto('/boutique.html');
      await onglet.evaluate(() => localStorage.setItem('baromatch-boutique-v1', JSON.stringify([{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 1 }])));
      await ouvrir(onglet, '/boutique.html', cas);
      await expect(onglet.locator('body')).toHaveClass(/avec-barre/);
      await sortirLeRang(onglet);
      const barre = await onglet.locator('#barre-ouvrir').evaluate((e) => e.getBoundingClientRect().toJSON());
      expect(barre.bottom).toBeLessThanOrEqual(cas.hauteur);
      expect((await lireLeBandeau(onglet)).fixe, 'le bandeau sur la barre de sélection').toBe(false);
      // Les entrées restent atteignables au clavier et lues : dans leur rang, sous le logo.
      await onglet.locator('.menu__lien').first().focus();
      await expect(onglet.locator('.menu__lien').first()).toBeFocused();
      await expect(onglet.locator('.menu__lien').first()).toBeInViewport();
      // Sans sélection, le bandeau revient.
      await onglet.evaluate(() => document.body.classList.remove('avec-barre'));
      await sortirLeRang(onglet);
      expect((await lireLeBandeau(onglet)).fixe).toBe(true);
    });
  });
}

// ---------- L’arrivée par un lien vers un formulaire ----------

// « Préviens-moi » (/#attente, ou #attente sur une page de ville) et « Proposer mon bar » (/pour-les-bars.html#proposer)
// mènent à un formulaire, que le navigateur amène lui-même en haut de l’écran. Avec le texte agrandi dès le chargement
// (un font-size sur <html>, le cas le plus dur), la page défile alors plus bas que le rang, qui deviendrait le bandeau
// du bas, par-dessus le champ ou le bouton. Arrivé ainsi, le rang reste sous le logo : aucun champ ni bouton du
// formulaire n’est sous un bandeau fixe.
const ARRIVEES_PAR_UN_LIEN = [
  { adresse: '/#attente', genere: false, boites: ['#attente-mail', '.attente__bouton'] },
  { adresse: '/pour-les-bars.html#proposer', genere: false, boites: ['#demande-bar'] },
  { adresse: '/regarder-le-match/paris/#attente', genere: true, boites: ['#attente-mail', '.attente__bouton'] },
];
for (const [largeur, hauteur] of [[360, 560], [375, 548], [390, 664], [430, 739]]) {
  for (const texte of [125, 200]) {
    for (const { adresse, genere, boites } of ARRIVEES_PAR_UN_LIEN) {
      test(`arrivée par ${adresse} à ${largeur} × ${hauteur}, texte à ${texte} % : aucun champ ni bouton sous le bandeau`, async ({ page: onglet }) => {
        await couperLAPI(onglet);
        await onglet.setViewportSize({ width: largeur, height: hauteur });
        // Le texte agrandi avant le premier affichage : c’est à cette taille que le navigateur suit le lien.
        await onglet.addInitScript((t) => {
          const poser = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; };
          poser();
          new MutationObserver(poser).observe(document, { childList: true });
        }, texte);
        await onglet.goto(genere ? `${site.serveur.adresse}${adresse}` : adresse);
        await attendreLaPageFinie(onglet);
        await onglet.evaluate(() => document.fonts.ready);
        await onglet.evaluate(OUTILS);
        const bandeau = await lireLeBandeau(onglet);
        const lu = await onglet.evaluate((liste) => ({
          taille: getComputedStyle(document.documentElement).fontSize,
          defile: scrollY,
          boites: liste.map((s) => window.boiteDuBandeau(document.querySelector(s))),
        }), boites);
        expect(lu.taille, 'le texte agrandi dès le chargement').toBe(`${16 * texte / 100}px`);
        expect(lu.defile, 'le navigateur a suivi le lien').toBeGreaterThan(0);
        const sous = lu.boites.filter((b) => bandeau.fixe && bandeau.visible && b.bas > bandeau.haut + 0.5 && b.haut < bandeau.bas - 0.5)
          .map((b) => dire(b, bandeau));
        expect(sous, 'sous le bandeau du bas').toEqual([]);
      });
    }
  }
}

// Seul un lien vers un formulaire range le bandeau : « Aller au contenu » (#contenu, le <main>, qui contient la liste
// d’attente ou le formulaire des bars) le garde, et le bandeau revient quand le rang sort de l’écran. Et quand un lien
// vers un formulaire l’a rangé, rien n’est réservé en bas pour un bandeau absent (ni la marge du pied, ni scroll-padding).
for (const chemin of ['/', '/pour-les-bars.html']) {
  test(`arrivée par ${chemin}#contenu (« Aller au contenu ») à 390 × 844 : le bandeau revient quand le rang sort de l’écran`, async ({ page: onglet }) => {
    await ouvrir(onglet, `${chemin}#contenu`, { largeur: 390, hauteur: 844, texte: 100 }, null);
    expect(await sortirLeRang(onglet), 'la page est assez longue').toBe(true);
    expect((await lireLeBandeau(onglet)).fixe, 'le bandeau du bas').toBe(true);
  });
}
for (const adresse of ['/#attente', '/pour-les-bars.html#proposer']) {
  test(`arrivée par ${adresse} à 390 × 844 : le rang reste sous le logo, et rien n’est réservé en bas pour lui`, async ({ page: onglet }) => {
    await ouvrir(onglet, adresse, { largeur: 390, hauteur: 844, texte: 100 }, null);
    await sortirLeRang(onglet);
    const lu = await onglet.evaluate(async () => {
      await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
      return {
        rang: getComputedStyle(document.querySelector('.menu__liste')).position,
        pied: getComputedStyle(document.querySelector('.pied')).paddingBottom,
        defilement: getComputedStyle(document.documentElement).scrollPaddingBottom,
      };
    });
    expect(lu).toEqual({ rang: 'static', pied: '40px', defilement: 'auto' });
  });
}

// ---------- Sans animation liée au défilement ----------

// Un navigateur sans animation liée au défilement (Firefox, Safari avant la version 26) ne lit pas les règles du bandeau
// (@supports (animation-timeline: view())) : le rang reste sous le logo, rien ne devient fixe, et rien n’est réservé en
// bas (ni la marge du pied, ni scroll-padding). Simulé en retirant ces règles de la feuille, comme il les ignore.
for (const [largeur, hauteur] of [[390, 844], [360, 640]]) {
  for (const chemin of ['/', '/a-propos.html', '/cgu.html', '/pour-les-bars.html', '/boutique.html']) {
    test(`sans animation liée au défilement, ${chemin} à ${largeur} × ${hauteur} : le rang reste sous le logo, rien de fixe, rien de réservé en bas`, async ({ page: onglet }) => {
      await couperLAPI(onglet);
      await onglet.setViewportSize({ width: largeur, height: hauteur });
      await onglet.goto(chemin);
      await attendreLaPageFinie(onglet);
      const retirees = await onglet.evaluate(() => {
        const feuille = [...document.styleSheets].find((f) => (f.href ?? '').endsWith('/styles.css'));
        let n = 0;
        for (let i = feuille.cssRules.length - 1; i >= 0; i -= 1) {
          const regle = feuille.cssRules[i];
          if (regle instanceof CSSSupportsRule && regle.conditionText.includes('animation-timeline')) { feuille.deleteRule(i); n += 1; }
        }
        return n;
      });
      expect(retirees, 'les règles du bandeau, sous @supports').toBe(2);
      for (const ou of ['l’arrivée', 'le rang sorti de l’écran', 'le bas de la page']) {
        const lu = await onglet.evaluate(async (moment) => {
          if (moment === 'le rang sorti de l’écran') window.scrollTo(0, document.querySelector('.menu').getBoundingClientRect().bottom + scrollY + 40);
          if (moment === 'le bas de la page') window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
          const fixes = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && getComputedStyle(e).pointerEvents !== 'none' && e.checkVisibility({ visibilityProperty: true }));
          return {
            rang: getComputedStyle(document.querySelector('.menu__liste')).position,
            fixes: fixes.map((e) => e.className || e.tagName),
            pied: getComputedStyle(document.querySelector('.pied')).paddingBottom,
            defilement: getComputedStyle(document.documentElement).scrollPaddingBottom,
            deCote: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        }, ou);
        expect(lu, ou).toEqual({ rang: 'static', fixes: [], pied: '40px', defilement: 'auto', deCote: false });
      }
    });
  }
}

// ---------- La zone basse, sans simulation ----------

// Sans la valeur simulée : --zone-basse vaut ce que donne env(safe-area-inset-bottom) (écrit ainsi dans styles.css, le
// dernier test le lit), 0 ici (sans viewport-fit=cover, Safari donne 0 lui aussi, d’après sa documentation), et le
// bandeau est à 10 px du bord.
test('sans simulation, la zone basse vaut env(safe-area-inset-bottom) : le bandeau est à 10 px du bord', async ({ page: onglet }) => {
  await ouvrir(onglet, '/cgu.html', { largeur: 390, hauteur: 844, texte: 100 }, null);
  expect(await onglet.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--zone-basse').trim())).toBe('0px');
  await sortirLeRang(onglet);
  const vu = await lireLeBandeau(onglet);
  expect(vu.fixe).toBe(true);
  expect(vu.ecran - vu.bas).toBeCloseTo(BORD, 0);
});

// Le vrai réglage du navigateur (la taille du texte par défaut à 32 px, 200 %) : les media queries en em le voient ; le
// menu est un rang sous le logo, dans la page, et rien ne devient fixe en faisant défiler.
for (const page of PAGES.filter((p) => ['/', '/pour-les-bars.html', '/cgu.html', '/boutique.html'].includes(p.chemin))) {
  test(`${page.nom}, réglage du navigateur à 200 % : le menu est une rangée dans la page`, async ({ page: onglet }) => {
    const cdp = await onglet.context().newCDPSession(onglet);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await couperLAPI(onglet);
    await onglet.setViewportSize({ width: 390, height: 844 });
    await onglet.goto(page.chemin);
    await onglet.evaluate(OUTILS);
    const lu = await onglet.evaluate(() => ({
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      menu: document.querySelector('.menu').getBoundingClientRect().top,
      logo: document.querySelector('.entete__logo').getBoundingClientRect().bottom,
      defile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(lu.rem).toBe(32);
    expect(lu.menu).toBeGreaterThanOrEqual(lu.logo);
    expect(lu.defile).toBe(false);
    await sortirLeRang(onglet);
    expect((await lireLeBandeau(onglet)).fixe).toBe(false);
  });
}

test('aucune page ne demande viewport-fit=cover, et le bandeau ne se règle sur aucune hauteur d’écran', () => {
  for (const page of PAGES.filter((p) => !p.chemin.startsWith('/t/'))) {
    const fichier = path.join(racine, page.chemin === '/' ? 'index.html' : page.chemin.slice(1));
    expect(readFileSync(fichier, 'utf8'), page.chemin).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  expect(readFileSync(path.join(racine, 'generateur', 'gabarits.mjs'), 'utf8')).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  const css = readFileSync(path.join(racine, 'styles.css'), 'utf8');
  const debut = css.indexOf('/* Au téléphone (22,5 à 45 em');
  const bloc = css.slice(debut, css.indexOf('/* Le contraste élevé de Windows', debut));
  expect(bloc).toContain('@keyframes bandeau-du-bas');
  expect(bloc).not.toMatch(/\d(?:s|d|l)?vh\b/);
  expect(bloc).toContain('bottom: calc(10px + var(--zone-basse))');
  expect(css).toContain('--zone-basse: env(safe-area-inset-bottom, 0px);');
});
