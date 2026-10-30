// Les pages du générateur au jour (<html class="jour">, generateur/gabarits.mjs ; leurs règles du jour dans regarder.css et
// affiche.css) : la semaine, un match (avec un bar inventé, et sans bar), « Ce soir », l’agenda, un club, une
// compétition, une ville et la liste des villes, la page d’un bar et son code, les affiches, la feuille du patron, la
// page neutre, les pages en anglais, et les pages telles qu’elles sont sans aucun bar publié (la copie enregistrée des
// listes publiques). Le crème, le bleu nuit pour le texte, l’ambre seulement pour l’action ; le pied de page de nuit.
// Mesuré tel qu’il est peint : chaque texte à 4,5:1 (tests/outils/textes-peints.mjs), chaque contour de focus et chaque
// bord de champ à 3:1, chaque survol lisible et visible ; le premier affichage déjà au jour ; le texte à 200 % à 320 px
// qui reste dans l’écran ; et CLS 0 sans la police.
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lireCouleur, luminance, poser, rapport } from './outils/contraste.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { racine } from './outils/environnement.mjs';
import { CAPTURE, MAINTENANT_DE_LA_CAPTURE, construireLeSiteDExemple } from './outils/site-genere.mjs';
import { decrireLesCouples, mesurerLesTextes, textesTropFaibles } from './outils/textes-peints.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { lireLeCadre } from '../generateur/gabarits.mjs';
import { pageDeRepli } from '../generateur/refus.mjs';

// Chaque type de page. site : le scénario inventé (des bars publiés), ou la copie enregistrée (aucun bar publié).
// etat : ce qui amène un second état à mesurer (une case cochée, une autre ville choisie). textes : le moins de textes
// que la mesure doit lire (une mesure qui ne lit presque rien ne prouve rien) ; la page neutre n’en a que quelques-uns.
const cocherLaPremiereCase = (onglet) => onglet.locator('.affiche-case').first().check();
const TYPES = [
  { nom: 'la semaine', chemin: '/matchs/' },
  { nom: 'un match avec un bar inventé', chemin: '/matchs/psg-ol-2026-10-25/' },
  { nom: 'un match sans bar', chemin: '/matchs/lille-lens-2026-10-26/' },
  { nom: 'ce soir', chemin: '/ce-soir/' },
  { nom: 'l’agenda', chemin: '/agenda/' },
  { nom: 'un club', chemin: '/matchs/club/psg/' },
  { nom: 'une compétition', chemin: '/matchs/competition/ligue-1/' },
  { nom: 'une ville', chemin: '/regarder-le-match/paris/' },
  { nom: 'la liste des villes', chemin: '/regarder-le-match/' },
  { nom: 'la page d’un bar et son code', chemin: '/bar/le-zinc-des-amis-paris-11/' },
  { nom: 'l’affiche de la semaine', chemin: '/matchs/affiche/', etat: cocherLaPremiereCase },
  { nom: 'l’affiche d’un bar', chemin: '/bar/le-zinc-des-amis-paris-11/affiche/' },
  { nom: 'la feuille du patron', chemin: '/matchs/affiche/pour-le-patron/' },
  { nom: 'la page neutre', chemin: '/matchs/page-neutre/', textes: 6 },
  { nom: 'Paris en anglais', chemin: '/en/' },
  { nom: 'un match en anglais', chemin: '/en/matches/psg-barca-2026-10-24/' },
  { nom: 'une ligue en anglais', chemin: '/en/premier-league/' },
  { nom: 'sans bar publié, la semaine', chemin: '/matchs/', site: 'sansBar' },
  { nom: 'sans bar publié, un match', chemin: '/matchs/psg-barca-2026-10-20/', site: 'sansBar' },
  { nom: 'sans bar publié, une ville et sa liste d’attente', chemin: '/regarder-le-match/paris/', site: 'sansBar', etat: (onglet) => onglet.locator('.attente__ville', { hasText: 'Lyon' }).click() },
];
const LARGEURS = [390, 1280];
// Les moments de nuit d’une page générée : le pied de page. Et ce qui n’est pas à voir : le piège à robots de la liste.
const NUIT = '.nuit, .pied, .attente__piege';

const NUIT_RGB = 'rgb(10, 11, 16)';
const CREME = 'rgb(250, 247, 241)';
// L’ambre (#FFB13D), plein ou translucide, tel que getComputedStyle l’écrit.
const AMBRE = '^rgba?\\(255, 177, 61(?:, (?!0\\))[\\d.]+)?\\)$';

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

const sites = {};
test.beforeAll(async () => {
  // Deux sites à construire : plus que les 30 s d’un crochet ordinaire, sur une machine chargée.
  test.setTimeout(180_000);
  const avecBars = mkdtempSync(path.join(tmpdir(), 'site-jour-'));
  await construireLeSiteDExemple(avecBars);
  // La page neutre (celle qui remplace une page refusée, refus.mjs), écrite à une adresse à elle.
  const neutre = pageDeRepli({ chemin: '/matchs/page-neutre/', type: 'match', cle: 'page-neutre' }, {
    cadre: lireLeCadre(avecBars), marque: JSON.parse(readFileSync(path.join(avecBars, 'marque.json'), 'utf8')), avecPresse: existsSync(path.join(avecBars, 'presse.html')),
  });
  mkdirSync(path.join(avecBars, 'matchs', 'page-neutre'), { recursive: true });
  writeFileSync(path.join(avecBars, 'matchs', 'page-neutre', 'index.html'), neutre.contenu);
  const sansBar = mkdtempSync(path.join(tmpdir(), 'site-jour-sans-bar-'));
  await construireLeSiteDExemple(sansBar, { source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, contenu: chargerLeContenu(racine) });
  for (const [cle, dossier] of [['bars', avecBars], ['sansBar', sansBar]]) {
    sites[cle] = { dossier, serveur: await demarrerServeur(await portLibre(), -1, { dossier }) };
  }
});
test.afterAll(async () => {
  for (const { dossier, serveur } of Object.values(sites)) {
    await serveur?.arreter();
    rmSync(dossier, { recursive: true, force: true });
  }
});

const adresseDe = (type) => `${sites[type.site ?? 'bars'].serveur.adresse}${type.chemin}`;

// La page ouverte comme un visiteur la voit, au mouvement réduit (une couleur lue est celle de l’état posé), la police
// arrivée ; ses <details> ouverts (le code du badge, les réponses des questions) pour que tout passe à la mesure.
const ouvrir = async (onglet, type, largeur) => {
  await onglet.setViewportSize({ width: largeur, height: 900 });
  await onglet.emulateMedia({ reducedMotion: 'reduce' });
  await onglet.goto(adresseDe(type));
  await onglet.evaluate(() => document.fonts.ready);
  await onglet.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
};

// Le fond plein derrière un élément (les fonds translucides empilés jusqu’au premier fond plein), son propre fond compris
// ou non : posé dans chaque page avant ses scripts (addInitScript, que la politique de sécurité de la page n’arrête pas),
// pour les mesures du focus, des bords et des survols.
test.beforeEach(async ({ page: onglet }) => {
  await onglet.addInitScript(() => {
    window.fondPeint = (element, avecLeSien) => {
      const lire = (css) => { const [r, v, b, a = 1] = css.match(/[\d.]+/g).map(Number); return { r, v, b, a }; };
      const couches = [];
      for (let e = avecLeSien ? element : element.parentElement; e; e = e.parentElement) {
        const f = lire(getComputedStyle(e).backgroundColor);
        if (f.a > 0) couches.push(f);
        if (f.a === 1) break;
      }
      const f = couches.reverse().reduce((d, h) => ({ r: h.r * h.a + d.r * (1 - h.a), v: h.v * h.a + d.v * (1 - h.a), b: h.b * h.a + d.b * (1 - h.a) }), { r: 255, v: 255, b: 255 });
      return `rgb(${Math.round(f.r)}, ${Math.round(f.v)}, ${Math.round(f.b)})`;
    };
  });
});
const contraste = (dessus, dessous) => Math.round(rapport(poser(lireCouleur(dessus), lireCouleur(dessous)), lireCouleur(dessous)) * 100) / 100;

test.describe('le jour posé', () => {
  for (const type of TYPES) {
    test(`${type.nom} : la classe jour, la barre du navigateur crème, le fond crème, le titre bleu nuit, le pied de page de nuit`, async ({ page: onglet }) => {
      await ouvrir(onglet, type, 390);
      const lu = await onglet.evaluate(() => ({
        classe: document.documentElement.className,
        barre: document.querySelector('meta[name="theme-color"]').content,
        fond: getComputedStyle(document.body).backgroundColor,
        titre: getComputedStyle(document.querySelector('h1')).color,
        pied: getComputedStyle(document.querySelector('.pied')).backgroundColor,
        schema: getComputedStyle(document.documentElement).colorScheme,
      }));
      expect(lu).toEqual({ classe: 'jour', barre: '#FAF7F1', fond: CREME, titre: NUIT_RGB, pied: NUIT_RGB, schema: 'light' });
    });
  }
});

test.describe('le contraste de chaque texte sur le clair, mesuré', () => {
  for (const type of TYPES) {
    for (const largeur of LARGEURS) {
      test(`${type.nom}, à ${largeur} px : chaque texte à 4,5:1 au moins${type.etat ? ', au repos et après un choix' : ''}`, async ({ page: onglet }, infos) => {
        await ouvrir(onglet, type, largeur);
        const mesures = await mesurerLesTextes(onglet, NUIT);
        if (type.etat) {
          await type.etat(onglet);
          mesures.push(...await mesurerLesTextes(onglet, NUIT));
        }
        expect(mesures.length).toBeGreaterThan(type.textes ?? 15);
        infos.annotations.push({ type: 'contraste', description: decrireLesCouples(mesures) });
        expect(textesTropFaibles(mesures)).toEqual([]);
      });
    }
  }
});

// L’ambre marque l’action (l’appel des fans, l’envoi de la liste d’attente) et le choix du visiteur (la ville cochée),
// rien d’autre : ni un texte, ni un bord, ni un soulignement, ni une case (le contour du focus a son test plus bas). Sur le
// crème, il ne ferait que 1,7:1.
test.describe('l’ambre seulement pour l’action', () => {
  const ACTIONS = '.capsule, .attente__bouton, .attente__ville input:checked + span';
  for (const type of TYPES) {
    test(`${type.nom} : aucun texte, bord, soulignement ni case en ambre ; un fond ambre seulement sous une action`, async ({ page: onglet }) => {
      await ouvrir(onglet, type, 1280);
      if (type.etat) await type.etat(onglet);
      const ambres = await onglet.evaluate(({ nuit, actions, motif }) => {
        const ambre = (css) => new RegExp(motif).test(css);
        const trouves = [];
        for (const element of document.querySelectorAll('main, main *')) {
          if (element.closest(nuit) || !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
          const s = getComputedStyle(element);
          const nom = `${element.tagName.toLowerCase()}${typeof element.className === 'string' && element.className ? `.${element.className.split(' ')[0]}` : ''}`;
          const traits = [
            ['texte', s.color],
            ['soulignement', s.textDecorationLine !== 'none' ? s.textDecorationColor : ''],
            ...['Top', 'Right', 'Bottom', 'Left'].map((c) => [`bord ${c}`, s[`border${c}Style`] !== 'none' && parseFloat(s[`border${c}Width`]) > 0 ? s[`border${c}Color`] : '']),
            ['case', element.matches('input[type="checkbox"], input[type="radio"]') ? s.accentColor : ''],
          ];
          for (const [quoi, couleur] of traits) if (ambre(couleur)) trouves.push(`${nom} : ${quoi} ${couleur}`);
          if (ambre(s.backgroundColor) && !element.matches(actions)) trouves.push(`${nom} : fond ${s.backgroundColor}`);
        }
        return [...new Set(trouves)];
      }, { nuit: NUIT, actions: ACTIONS, motif: AMBRE });
      expect(ambres).toEqual([]);
    });
  }
});

// Ce que peint le focus de l’élément actif : son contour, ou celui de ce qui le montre (la puce d’un bouton radio
// invisible, la pilule du champ d’e-mail), et le fond plein derrière ce contour.
const lireLeFocus = (onglet) => onglet.evaluate(() => {
  const actif = document.activeElement;
  if (!actif || actif === document.body) return null;
  const visible = (e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  const contoure = (e) => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; };
  const candidats = [actif, actif.nextElementSibling, ...(function* parents() { for (let e = actif.parentElement; e; e = e.parentElement) yield e; }())]
    .filter((e) => e && visible(e) && contoure(e) && (e === actif || e === actif.nextElementSibling || e.matches(':has(:focus-visible)')));
  const peint = candidats[0];
  const quoi = `${actif.tagName.toLowerCase()}${actif.className && typeof actif.className === 'string' ? `.${actif.className.split(' ')[0]}` : ''} « ${(actif.textContent || actif.getAttribute('aria-label') || actif.value || '').trim().slice(0, 30)} »`;
  if (!peint) return { quoi, contour: null };
  return { quoi, contour: getComputedStyle(peint).outlineColor, fond: window.fondPeint(peint, false) };
});

test.describe('le focus au clavier sur le clair', () => {
  for (const type of TYPES) {
    for (const largeur of LARGEURS) {
      test(`${type.nom}, à ${largeur} px : chaque arrêt a son contour, et sur le clair il s’en détache à 3:1 au moins`, async ({ page: onglet }) => {
        await ouvrir(onglet, type, largeur);
        const arrets = [];
        for (let i = 0; i < 600; i += 1) {
          await onglet.keyboard.press('Tab');
          const arret = await lireLeFocus(onglet);
          if (!arret || (arrets.length && arret.quoi === arrets[0].quoi)) break;
          arrets.push(arret);
        }
        expect(arrets.length).toBeGreaterThan(10);
        expect(arrets.filter((a) => !a.contour).map((a) => a.quoi), 'un arrêt sans contour').toEqual([]);
        const clairs = arrets.filter((a) => luminance(lireCouleur(a.fond)) > 0.5);
        expect(clairs.length).toBeGreaterThan(5);
        const faibles = clairs.filter((a) => contraste(a.contour, a.fond) < 3).map((a) => `${a.quoi} : ${a.contour} sur ${a.fond}, ${contraste(a.contour, a.fond)}:1`);
        expect([...new Set(faibles)]).toEqual([]);
      });
    }
  }
});

// Le bord d’un champ, d’un choix ou d’une case, peint sur ce qui l’entoure et sur son propre fond : 3:1 au moins
// (WCAG 1.4.11), au repos, choisi et, pour la pilule de la liste d’attente, quand on y écrit.
const lireLesBords = (onglet, selecteur) => onglet.locator(selecteur).evaluateAll((elements) => elements.filter((e) => e.checkVisibility()).map((e) => {
  const s = getComputedStyle(e);
  return { quoi: `${e.tagName.toLowerCase()}.${e.className.split(' ')[0]} « ${e.textContent.trim().slice(0, 20)} »`, largeur: s.borderTopWidth, bord: s.borderTopColor, dehors: window.fondPeint(e, false), dedans: window.fondPeint(e, true) };
}));
// Le bord, posé sur le propre fond de l’élément (il est peint dessus), contre ce fond et contre ce qui l’entoure.
const bordsTropFaibles = (bords) => bords.map((b) => {
  const peint = poser(lireCouleur(b.bord), lireCouleur(b.dedans));
  const avec = (fond) => Math.round(rapport(peint, lireCouleur(fond)) * 100) / 100;
  return { ...b, rapport: Math.min(avec(b.dehors), avec(b.dedans)) };
})
  .filter((b) => b.largeur === '0px' || b.rapport < 3).map((b) => `${b.quoi} : bord ${b.bord} (${b.largeur}) entre ${b.dehors} et ${b.dedans}, ${b.rapport}:1`);
// La couleur d’une case ou d’un bouton radio coché (accent-color) sur la feuille blanche ou le fond qui l’entoure.
const casesTropFaibles = (onglet, selecteur) => onglet.locator(selecteur).evaluateAll((cases) => cases
  .map((c) => ({ quoi: c.id || c.className, accent: getComputedStyle(c).accentColor, fond: window.fondPeint(c, false) }))).then((cases) => cases.filter((c) => c.accent === 'auto' || contraste(c.accent, c.fond) < 3).map((c) => `${c.quoi} : ${c.accent} sur ${c.fond}`));

test.describe('les bords des champs et des choix sur le clair', () => {
  for (const largeur of LARGEURS) {
    test(`la liste d’attente d’une ville, à ${largeur} px : le champ, les villes (au repos et choisie), et la pilule quand on y écrit`, async ({ page: onglet }) => {
      await ouvrir(onglet, TYPES.find((t) => t.site === 'sansBar' && t.chemin === '/regarder-le-match/paris/'), largeur);
      const champ = largeur >= 560 ? '.attente__ligne' : '.attente__champ';
      const bords = [...await lireLesBords(onglet, champ), ...await lireLesBords(onglet, '.attente__ville span')];
      expect(bords.length).toBe(6);
      await onglet.locator('#attente-mail').focus();
      bords.push(...await lireLesBords(onglet, champ));
      expect(bordsTropFaibles(bords)).toEqual([]);
    });
  }

  for (const chemin of ['/matchs/affiche/', '/bar/le-zinc-des-amis-paris-11/affiche/', '/matchs/affiche/pour-le-patron/']) {
    test(`${chemin} : le choix du papier (au repos et choisi) et chaque case cochée à 3:1 au moins`, async ({ page: onglet }) => {
      await ouvrir(onglet, { chemin }, 1280);
      expect(bordsTropFaibles(await lireLesBords(onglet, '.affiche-format__choix'))).toEqual([]);
      expect(await casesTropFaibles(onglet, '.affiche-format input, .affiche-case')).toEqual([]);
    });
  }

  test('la page d’un bar : la boîte du code du badge, son bord et son texte', async ({ page: onglet }) => {
    await ouvrir(onglet, { chemin: '/bar/le-zinc-des-amis-paris-11/' }, 390);
    expect(bordsTropFaibles(await lireLesBords(onglet, '.regarder-badge__code'))).toEqual([]);
  });
});

// Chaque bouton et chaque lien survolé : son texte reste à 4,5:1 sur le fond survolé ; un bouton (une capsule) montre
// le survol par son fond ou sa couleur, sans devenir blanc sur blanc.
const SURVOLS = [
  { chemin: '/matchs/lille-lens-2026-10-26/', boutons: ['.regarder-bars-pro__bouton', '.partage__bouton:visible', '.regarder-agenda__bouton', '.regarder-agenda__clubs a', '.capsule'], liens: ['.regarder-fil a', '.regarder-suite a'] },
  { chemin: '/matchs/psg-ol-2026-10-25/', liens: ['.regarder-carte__nom a', '.regarder-ville a', '.regarder-langue a', '.regarder-compte a'] },
  { chemin: '/ce-soir/', liens: ['.regarder-soir__match a', '.regarder-carte__nom a', '.regarder-suite a'] },
  { chemin: '/agenda/', boutons: ['.regarder-agenda__bouton'], liens: ['.regarder-agenda__adresse a', '.regarder-retour a'] },
  { chemin: '/regarder-le-match/paris/', boutons: ['.attente__bouton'], liens: ['.regarder-langue a', '.attente__note a'], resumes: ['.regarder-faq summary'] },
  { chemin: '/bar/le-zinc-des-amis-paris-11/', liens: ['.regarder-suite a'], resumes: ['.regarder-badge summary'] },
  { chemin: '/matchs/club/psg/', liens: ['.regarder-carte__suite a', '.regarder-matchs a'] },
  { chemin: '/matchs/affiche/', boutons: ['.affiche-format__choix'] },
  { chemin: '/en/', liens: ['.regarder-carte__suite a', '.regarder-langue a'] },
];
const lireLeSurvol = (locator) => locator.evaluate((e) => {
  const s = getComputedStyle(e);
  return { couleur: s.color, fond: window.fondPeint(e, true), ombre: s.boxShadow, bord: s.borderTopColor, soulignement: `${s.textDecorationLine} ${s.textDecorationColor}` };
});

test.describe('les survols sur le clair', () => {
  for (const { chemin, boutons = [], liens = [], resumes = [] } of SURVOLS) {
    test(`${chemin} : chaque survol se lit à 4,5:1${boutons.length ? ', et chaque bouton le montre' : ''}`, async ({ page: onglet }) => {
      await ouvrir(onglet, { chemin }, 1280);
      const problemes = [];
      for (const selecteur of [...boutons, ...liens, ...resumes]) {
        const element = onglet.locator(selecteur).first();
        await expect(element, selecteur).toBeVisible();
        await onglet.mouse.move(0, 0);
        const repos = await lireLeSurvol(element);
        await element.hover();
        const survol = await lireLeSurvol(element);
        const r = contraste(survol.couleur, survol.fond);
        if (r < 4.5) problemes.push(`${selecteur} survolé : ${survol.couleur} sur ${survol.fond}, ${r}:1`);
        if (boutons.includes(selecteur) && JSON.stringify(repos) === JSON.stringify(survol)) problemes.push(`${selecteur} : rien ne change au survol (${repos.fond})`);
      }
      expect(problemes).toEqual([]);
    });
  }
});

// Le premier affichage est déjà le jour : la classe est dans le HTML (jamais posée par un script) et chaque feuille de
// style bloque l’affichage. Les feuilles des pages générées arrivent ici en retard (400 ms) : la première image que le
// navigateur peint (le premier requestAnimationFrame où le titre existe) a déjà le crème, le bleu nuit et les cartes
// blanches.
test.describe('le premier affichage', () => {
  const noterLaPremiereImage = (onglet) => onglet.addInitScript(() => {
    const lire = () => {
      const titre = document.querySelector('h1');
      if (!titre) { requestAnimationFrame(lire); return; }
      const carte = document.querySelector('.regarder-carte, .regarder-bars-pro, .regarder-ce-soir, .affiche, .regarder-badge');
      window.premiereImage = {
        fond: getComputedStyle(document.body).backgroundColor,
        titre: getComputedStyle(titre).color,
        carte: carte ? getComputedStyle(carte).backgroundColor : null,
      };
    };
    requestAnimationFrame(lire);
  });

  // Le témoin : une feuille qui ne bloque pas l’affichage et arrive en retard ; la première image n’a pas encore son fond.
  test('témoin : la première image peinte est lue avant une feuille de style qui arrive en retard sans bloquer', async ({ page: onglet }) => {
    await noterLaPremiereImage(onglet);
    await onglet.route('http://temoin.test/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="stylesheet" href="/lente.css" media="print" onload="this.media=\'all\'"><h1>Un titre</h1>' }));
    await onglet.route('http://temoin.test/lente.css', async (route) => {
      await new Promise((r) => { setTimeout(r, 400); });
      await route.fulfill({ contentType: 'text/css', body: 'body { background: #FAF7F1; }' });
    });
    await onglet.goto('http://temoin.test/');
    await onglet.waitForFunction(() => window.premiereImage);
    await expect.poll(() => onglet.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(CREME);
    expect(await onglet.evaluate(() => window.premiereImage.fond)).not.toBe(CREME);
  });

  for (const type of TYPES) {
    test(`${type.nom} : la première image peinte est déjà au jour`, async ({ page: onglet }) => {
      await onglet.route(/\/(regarder|affiche)\.css$/, async (route) => {
        await new Promise((r) => { setTimeout(r, 400); });
        await route.continue();
      });
      await noterLaPremiereImage(onglet);
      await onglet.setViewportSize({ width: 390, height: 900 });
      await onglet.goto(adresseDe(type));
      await onglet.waitForFunction(() => window.premiereImage);
      const premiere = await onglet.evaluate(() => window.premiereImage);
      const finale = await onglet.evaluate(() => {
        const carte = document.querySelector('.regarder-carte, .regarder-bars-pro, .regarder-ce-soir, .affiche, .regarder-badge');
        return carte ? getComputedStyle(carte).backgroundColor : null;
      });
      expect(premiere).toEqual({ fond: CREME, titre: NUIT_RGB, carte: finale });
      if (finale) expect(finale).toBe('rgb(255, 255, 255)');
    });
  }
});

// Le texte agrandi à 200 % (la méthode de texte-agrandi.spec.mjs) sur un écran de 320 px : rien ne sort de l’écran, la
// page ne défile pas de côté.
test.describe('le texte à 200 % sur 320 px', () => {
  for (const type of TYPES) {
    test(`${type.nom} : rien ne sort de l’écran`, async ({ page: onglet }) => {
      await ouvrir(onglet, type, 320);
      await onglet.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const lu = await onglet.evaluate(() => {
        const ecran = document.documentElement.clientWidth;
        const dehors = [...document.querySelectorAll('main *')]
          .filter((n) => n.checkVisibility() && n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().right > ecran + 0.5 && !n.closest('.visuellement-cache, .attente__piege'))
          .map((n) => `${n.tagName.toLowerCase()}.${typeof n.className === 'string' ? n.className.split(' ')[0] : ''} (${Math.round(n.getBoundingClientRect().right)} px)`);
        return { defile: document.documentElement.scrollWidth - ecran, dehors: [...new Set(dehors)] };
      });
      expect(lu).toEqual({ defile: 0, dehors: [] });
    });
  }
});

// Rien ne bouge au chargement (CLS 0), au téléphone comme sur ordinateur : la mise en page du jour elle-même. Sans la
// police : son remplacement (font-display: swap) a sa propre correction et son propre test, comme sur l’accueil. Et sans
// partage.js, le seul script de ces pages : il remplace l’adresse du bloc « Partager » par ses boutons, parfois après la
// première image, et les sections du dessous remontent alors (0,014 à 0,030 à 390 px, déjà ainsi à la nuit). Ce
// décalage-là n’est pas une affaire de couleurs : il aura sa propre correction et son propre test.
test.describe('CLS 0 sans la police', () => {
  const compterLesDecalages = (onglet) => onglet.addInitScript(() => {
    window.decalages = 0;
    new PerformanceObserver((liste) => { for (const e of liste.getEntries()) if (!e.hadRecentInput) window.decalages += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });

  // Le témoin : la mesure voit un décalage, une image sans dimensions arrivée en retard qui pousse le texte du dessous.
  test('témoin : la mesure voit un décalage', async ({ page: onglet }) => {
    await compterLesDecalages(onglet);
    await onglet.route('http://temoin.test/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Au-dessus</p><img src="/lente.png" alt=""><p>Le texte du dessous</p>' }));
    await onglet.route('http://temoin.test/lente.png', async (route) => {
      await new Promise((r) => { setTimeout(r, 500); });
      await route.fulfill({ path: path.join(racine, 'apple-touch-icon.png') });
    });
    await onglet.goto('http://temoin.test/');
    await onglet.waitForLoadState('networkidle');
    expect(await onglet.evaluate(() => window.decalages)).toBeGreaterThan(0);
  });

  for (const type of TYPES) {
    test(`${type.nom} : rien ne bouge au chargement, à 390 et 1280 px`, async ({ page: onglet }) => {
      await onglet.route(/\/(fonts\/bricolage-grotesque\.woff2|partage\.js)$/, (route) => route.abort());
      await compterLesDecalages(onglet);
      for (const largeur of LARGEURS) {
        await onglet.setViewportSize({ width: largeur, height: 900 });
        await onglet.goto(adresseDe(type));
        await onglet.waitForLoadState('networkidle');
        expect(await onglet.evaluate(() => window.decalages), `${largeur} px`).toBe(0);
      }
    });
  }
});
