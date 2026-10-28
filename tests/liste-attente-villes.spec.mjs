// La liste d’attente par ville : sur l’accueil (Paris choisi d’avance) et sur chaque page de ville (sa ville choisie
// d’avance, « Autre » pour une ville hors de la liste), un choix fixe de cinq villes, Paris, Lyon, Marseille, Lille et
// Autre, sans champ libre. L’envoi ne porte que l’adresse et la ville (plus le champ piège et l’objet du mail, comme
// avant) ; rien ne part vers le vrai Formspree. Hors de Paris, une phrase dit qu’il n’y a pas de date, sans script.
// La page de ville marche sans JavaScript (un formulaire ordinaire vers Formspree), et dit la même chose que l’accueil.
// La page de confidentialité dit ce qu’on garde (l’adresse et la ville), pourquoi, et combien de temps.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { violationsAxe } from './outils/axe.mjs';
import { racine } from './outils/environnement.mjs';
import { simulerFormspree } from './outils/formspree.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { ENVOI_DE_LA_LISTE } from '../generateur/attente.mjs';

const VILLES = ['Paris', 'Lyon', 'Marseille', 'Lille', 'Autre'];
const ACCUEIL = readFileSync(path.join(racine, 'index.html'), 'utf8');
const normaliser = (texte) => texte.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const nomsDesChamps = (corps) => [...corps.matchAll(/name="([^"]+)"\r\n/g)].map((m) => m[1]).sort();
const valeurDe = (corps, nom) => corps.match(new RegExp(`name="${nom}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? null;
const PHRASE = {
  Lyon: 'Pas de date pour Lyon. On t’écrit seulement si Baromatch y arrive.',
  Marseille: 'Pas de date pour Marseille. On t’écrit seulement si Baromatch y arrive.',
  Lille: 'Pas de date pour Lille. On t’écrit seulement si Baromatch y arrive.',
  Autre: 'Pas de date pour les autres villes. On t’écrit seulement si Baromatch ouvre dans une nouvelle ville.',
};

// Le champ des villes : un groupe nommé « Ta ville », exactement les cinq villes, dans l’ordre, celle attendue choisie,
// et aucun autre champ à remplir que l’adresse (le champ piège est caché et hors du clavier).
const verifierLeChamp = async (onglet, choisie) => {
  const groupe = onglet.getByRole('group', { name: 'Ta ville' });
  await expect(groupe).toBeVisible();
  await expect(groupe.locator('legend')).toHaveText('Ta ville');
  const choix = groupe.getByRole('radio');
  await expect(choix).toHaveCount(5);
  expect(await choix.evaluateAll((liste) => liste.map((r) => [r.name, r.value, r.labels[0].textContent.trim()]))).toEqual(VILLES.map((v) => ['ville', v, v]));
  for (const ville of VILLES) {
    if (ville === choisie) await expect(groupe.getByRole('radio', { name: ville })).toBeChecked();
    else await expect(groupe.getByRole('radio', { name: ville })).not.toBeChecked();
  }
  const champs = await onglet.locator('#attente').evaluate((f) => [...f.elements]
    .filter((c) => c.matches('input, select, textarea') && c.type !== 'radio' && c.type !== 'hidden' && !c.closest('[aria-hidden="true"]'))
    .map((c) => `${c.name}:${c.type}`));
  expect(champs).toEqual(['email:email']);
  // Ce à quoi sert la ville, juste après le champ, et lié à lui.
  await expect(groupe).toHaveAccessibleDescription(/On t’écrit seulement quand Baromatch ouvre dans ta ville/);
};

const tropPetites = (onglet) => onglet.locator('.attente__ville span').evaluateAll((puces) => puces
  .map((p) => p.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length);

test.describe('l’accueil', () => {
  // L’ouverture de l’accueil glisse au chargement : immobile, elle se mesure et se touche tout de suite.
  test.use({ reducedMotion: 'reduce' });

  test('le champ des villes : cinq villes, Paris choisi d’avance, aucun champ libre, 44 px à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await verifierLeChamp(page, 'Paris');
    expect(await tropPetites(page)).toBe(0);
    // « Autre » n’ouvre aucun champ.
    await page.getByRole('radio', { name: 'Autre' }).check();
    await verifierLeChamp(page, 'Autre');
  });

  test('hors de Paris, la phrase « pas de date » suit la ville choisie, avec et sans JavaScript', async ({ browser, baseURL }) => {
    for (const javaScriptEnabled of [true, false]) {
      const contexte = await browser.newContext({ javaScriptEnabled, baseURL, reducedMotion: 'reduce' });
      const onglet = await contexte.newPage();
      await onglet.goto('/');
      await expect(onglet.locator('.attente__date:visible')).toHaveCount(0);
      for (const ville of ['Lyon', 'Marseille', 'Lille', 'Autre']) {
        await onglet.getByRole('radio', { name: ville }).check();
        await expect(onglet.locator('.attente__date:visible')).toHaveText([PHRASE[ville]]);
      }
      await onglet.getByRole('radio', { name: 'Paris' }).check();
      await expect(onglet.locator('.attente__date:visible')).toHaveCount(0);
      await contexte.close();
    }
  });

  test('l’envoi ne porte que l’adresse et la ville ; le message reprend la ville ; une autre ville rouvre l’envoi', async ({ page }) => {
    const envois = await simulerFormspree(page);
    await page.goto('/');
    await page.getByRole('radio', { name: 'Lyon' }).check();
    await page.locator('#attente-mail').fill('paul@exemple.fr');
    await page.locator('#attente button[type="submit"]').click();
    await expect(page.locator('#attente-retour')).toHaveText('C’est noté : on t’écrit à paul@exemple.fr si Baromatch arrive à Lyon.');
    expect(envois).toHaveLength(1);
    expect(nomsDesChamps(envois[0])).toEqual(['_gotcha', '_subject', 'email', 'ville']);
    expect(valeurDe(envois[0], 'email')).toBe('paul@exemple.fr');
    expect(valeurDe(envois[0], 'ville')).toBe('Lyon');
    expect(valeurDe(envois[0], '_gotcha')).toBe('');

    // Une autre ville, même adresse : l’envoi se rouvre, et la nouvelle inscription dit laquelle elle remplace.
    await page.getByRole('radio', { name: 'Autre' }).check();
    await expect(page.locator('#attente button[type="submit"]')).toHaveText('Me prévenir');
    await page.locator('#attente button[type="submit"]').click();
    await expect(page.locator('#attente-retour')).toHaveText('C’est noté : on t’écrit à paul@exemple.fr si Baromatch ouvre dans une nouvelle ville.');
    expect(envois).toHaveLength(2);
    expect(nomsDesChamps(envois[1])).toEqual(['_gotcha', '_subject', 'email', 'remplace', 'ville']);
    expect(valeurDe(envois[1], 'ville')).toBe('Autre');
    expect(valeurDe(envois[1], 'remplace')).toBe('paul@exemple.fr');
  });

  test('sans JavaScript, le formulaire envoie l’adresse et Paris, rien d’autre', async ({ browser, baseURL }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL, reducedMotion: 'reduce' });
    const onglet = await contexte.newPage();
    const corps = [];
    await onglet.route(/formspree\.io/, (route) => {
      corps.push(route.request().postData());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' });
    });
    await onglet.goto('/');
    await onglet.locator('#attente-mail').fill('paul@gmail.com');
    await onglet.locator('#attente button[type="submit"]').click();
    await onglet.waitForURL(/formspree\.io/, { waitUntil: 'commit' });
    const envoi = new URLSearchParams(corps[0]);
    expect([...envoi.keys()].sort()).toEqual(['_gotcha', '_subject', 'email', 'ville']);
    expect(envoi.get('ville')).toBe('Paris');
    await contexte.close();
  });

  for (const largeur of [360, 1280]) {
    test(`à ${largeur} px, une autre ville choisie : aucune violation d’axe`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.getByRole('radio', { name: 'Marseille' }).check();
      await page.getByRole('radio', { name: 'Marseille' }).focus();
      expect(await violationsAxe(page)).toEqual([]);
    });
  }
});

test.describe('les pages de ville', () => {
  // Les vraies villes, sans aucun bar (les données enregistrées) : chacune a sa ville choisie, et le formulaire de
  // l’accueil, mot pour mot : les villes, et la fin, de la phrase sur l’appli jusqu’à la note.
  test('chaque ville de la capture : le formulaire de l’accueil, sa ville choisie, la même adresse d’envoi', async () => {
    const { pages } = await construireEnMemoire({ source: `capture:${path.join(racine, 'tests', 'donnees', 'capture')}`, maintenant: Date.parse('2026-10-15T19:44:29Z'), racine });
    const villes = pages.filter((p) => p.type === 'ville');
    expect(villes.map((p) => p.chemin)).toEqual(['/regarder-le-match/paris/', '/regarder-le-match/lyon/', '/regarder-le-match/marseille/', '/regarder-le-match/lille/']);
    const action = ACCUEIL.match(/<form class="attente" id="attente" action="([^"]+)" method="POST"/)?.[1];
    expect(action).toBe(ENVOI_DE_LA_LISTE);
    // Les villes et leurs phrases (avant l’adresse), puis la fin du formulaire (après le bouton), mot pour mot.
    const blocs = (html) => [/<fieldset class="attente__villes"[\s\S]*?<label class="attente__etiquette"/, /<p class="attente__plateformes">[\s\S]*?<\/form>/]
      .map((motif) => normaliser(html.match(motif)[0]).replace(' checked', ''));
    const finDeLAccueil = blocs(ACCUEIL);
    for (const [i, p] of villes.entries()) {
      const html = p.contenu;
      expect(html, p.chemin).toContain(`<form class="attente" id="attente" action="${ENVOI_DE_LA_LISTE}" method="POST">`);
      expect([...html.matchAll(/value="(\w+)" checked/g)].map((m) => m[1]), p.chemin).toEqual([VILLES[i]]);
      expect(blocs(html), p.chemin).toEqual(finDeLAccueil);
      // Le champ piège et l’objet du mail, ceux de l’accueil.
      for (const champ of [/<input id="attente-piege"[^>]*>/, /<input type="hidden" name="_subject"[^>]*>/]) expect(html.match(champ)?.[0]).toBe(ACCUEIL.match(champ)?.[0]);
      expect(html).toContain(i === 0 ? '<h2 id="titre-attente">Préviens-moi quand l’appli ouvre à Paris</h2>' : `<h2 id="titre-attente">Préviens-moi quand Baromatch arrive à ${VILLES[i]}</h2>`);
      // Le navigateur vérifie l’adresse : aucun script n’est là pour le faire.
      expect(html).toMatch(/<input class="attente__champ" id="attente-mail" name="email" type="email"[^>]* required>/);
      expect(html).not.toMatch(/<form[^>]*novalidate/);
      expect(html).toContain('form-action https://formspree.io');
    }
  });

  let dossier;
  let serveur;
  test.beforeAll(async () => {
    dossier = mkdtempSync(path.join(tmpdir(), 'site-attente-'));
    await construireLeSiteDExemple(dossier);
    const port = await new Promise((resoudre) => {
      const sonde = createServer();
      sonde.listen(0, '127.0.0.1', () => { const { port: libre } = sonde.address(); sonde.close(() => resoudre(libre)); });
    });
    serveur = await demarrerServeur(port, -1, { dossier });
  });
  test.afterAll(async () => {
    await serveur?.arreter();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  // Le scénario : des bars à Paris, à Lyon et à Rennes ; aucun à Marseille ni à Lille.
  for (const [chemin, choisie, phrases] of [
    ['/regarder-le-match/paris/', 'Paris', []],
    ['/regarder-le-match/marseille/', 'Marseille', [PHRASE.Marseille]],
    ['/regarder-le-match/rennes/', 'Autre', []],
  ]) {
    test(`${chemin} : ${choisie} choisi d’avance, puces de 44 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(`${serveur.adresse}${chemin}`);
      await verifierLeChamp(page, choisie);
      await expect(page.locator('.attente__date:visible')).toHaveText(phrases);
      expect(await tropPetites(page)).toBe(0);
    });
  }

  test('sans JavaScript, la page de Marseille envoie l’adresse et la ville choisie à Formspree, rien d’autre, sans violation', async ({ browser }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
    const onglet = await contexte.newPage();
    const refus = [];
    onglet.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) refus.push(message.text()); });
    const corps = [];
    await onglet.route(/formspree\.io/, (route) => {
      corps.push([route.request().method(), route.request().url(), route.request().postData()]);
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' });
    });
    await onglet.goto(`${serveur.adresse}/regarder-le-match/marseille/`);
    // Sans adresse, le navigateur arrête l’envoi.
    await onglet.locator('#attente button[type="submit"]').click();
    expect(await onglet.locator('#attente-mail').evaluate((c) => c.validity.valueMissing)).toBe(true);
    expect(corps).toEqual([]);

    await onglet.getByRole('radio', { name: 'Lille' }).check();
    await expect(onglet.locator('.attente__date:visible')).toHaveText([PHRASE.Lille]);
    await onglet.locator('#attente-mail').fill('paul@gmail.com');
    await onglet.locator('#attente button[type="submit"]').click();
    await onglet.waitForURL(/formspree\.io/, { waitUntil: 'commit' });
    expect(corps.map(([methode, adresse]) => [methode, adresse])).toEqual([['POST', ENVOI_DE_LA_LISTE]]);
    const envoi = new URLSearchParams(corps[0][2]);
    expect([...envoi.keys()].sort()).toEqual(['_gotcha', '_subject', 'email', 'ville']);
    expect(envoi.get('email')).toBe('paul@gmail.com');
    expect(envoi.get('ville')).toBe('Lille');
    expect(envoi.get('_gotcha')).toBe('');
    expect(refus).toEqual([]);
    await contexte.close();
  });

  for (const largeur of [360, 1280]) {
    test(`la page de Marseille à ${largeur} px, Lille choisi : aucune violation d’axe, aucun débordement`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(`${serveur.adresse}/regarder-le-match/marseille/`);
      await page.getByRole('radio', { name: 'Lille' }).check();
      await expect(page.locator('.attente__date:visible')).toHaveText([PHRASE.Lille]);
      // Rennes a un bar : « Autre » n’a pas de phrase « pas de date ».
      await page.getByRole('radio', { name: 'Autre' }).check();
      await expect(page.locator('.attente__date:visible')).toHaveCount(0);
      await page.getByRole('radio', { name: 'Lille' }).check();
      expect(await violationsAxe(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
});

// « Ta ville » se choisit d’abord, puis l’adresse et le bouton : dans l’ordre de lecture comme au clavier, sur l’accueil
// et sur les pages de ville. La ville choisie se voit sans la couleur : une coche dessinée devant son nom.
const verifierLOrdre = async (onglet, choisie) => {
  expect(await onglet.locator('#attente').evaluate((f) => {
    const avant = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const villes = f.querySelector('.attente__villes');
    return [avant(villes, f.querySelector('.attente__etiquette')), avant(villes, f.querySelector('#attente-mail')), avant(villes, f.querySelector('button[type="submit"]'))];
  })).toEqual([true, true, true]);
  // Au clavier : la ville choisie, puis le champ de l’adresse, puis le bouton.
  await onglet.getByRole('radio', { name: choisie }).focus();
  await onglet.keyboard.press('Tab');
  await expect(onglet.locator('#attente-mail')).toBeFocused();
  await onglet.keyboard.press('Tab');
  await expect(onglet.locator('#attente button[type="submit"]')).toBeFocused();
  // Une coche devant la ville choisie, aucune devant les autres.
  const coches = await onglet.locator('.attente__ville span').evaluateAll((puces) => puces.map((p) => {
    const avant = getComputedStyle(p, '::before');
    return avant.content !== 'none' && parseFloat(avant.width) > 0;
  }));
  expect(coches).toEqual(VILLES.map((v) => v === choisie));
};

test.describe('l’ordre du formulaire', () => {
  test.use({ reducedMotion: 'reduce' });
  let dossier;
  let serveur;
  test.beforeAll(async () => {
    dossier = mkdtempSync(path.join(tmpdir(), 'site-ordre-'));
    await construireLeSiteDExemple(dossier);
    const port = await new Promise((resoudre) => {
      const sonde = createServer();
      sonde.listen(0, '127.0.0.1', () => { const { port: libre } = sonde.address(); sonde.close(() => resoudre(libre)); });
    });
    serveur = await demarrerServeur(port, -1, { dossier });
  });
  test.afterAll(async () => {
    await serveur?.arreter();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  for (const [chemin, choisie] of [['/', 'Paris'], ['/regarder-le-match/marseille/', 'Marseille']]) {
    test(`${chemin} : « Ta ville » avant l’adresse et le bouton, au clavier aussi ; une coche sur la ville choisie`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(`${serveur.adresse}${chemin}`);
      await verifierLOrdre(page, choisie);
      await page.getByRole('radio', { name: 'Lille' }).check();
      expect(await page.locator('.attente__ville span').evaluateAll((puces) => puces.map((p) => getComputedStyle(p, '::before').content !== 'none'))).toEqual(VILLES.map((v) => v === 'Lille'));
    });
  }
});

test('la confidentialité dit ce qu’on garde (l’adresse et la ville), pourquoi, combien de temps, et comment en sortir', async ({ page }) => {
  await page.goto('/confidentialite.html');
  const section = page.locator('#liste-attente + ul');
  const texte = normaliser(await section.innerText());
  expect(texte).toContain('ton adresse mail, et la ville que tu choisis dans la liste (Paris, Lyon, Marseille, Lille ou « Autre »)');
  expect(texte).toContain('ni nom, ni téléphone, ni ville écrite à la main');
  expect(texte).toContain('te prévenir quand Baromatch ouvre dans ta ville');
  expect(texte).toContain('Pour Lyon, Marseille, Lille ou une autre ville, qui n’ont pas de date : jusqu’à l’ouverture de Baromatch dans cette ville, et 12 mois au plus après ton inscription.');
  expect(texte).toContain('Les inscriptions (ton adresse et ta ville) passent par Formspree');
  // Le formulaire des pages de ville et des pages en anglais part sans JavaScript : la page qui suit est celle de Formspree.
  expect(texte).toContain('Depuis une page de ville ou une page en anglais, l’inscription part directement chez Formspree, qui affiche ensuite sa propre page de confirmation.');
  await expect(section.locator('a[href="mailto:contact@baromatch.fr"]')).toHaveCount(1);
  expect(texte).not.toContain('rien d’autre.');
  // La date de la page, et celle du plan du site.
  await expect(page.locator('.document__date')).toHaveText('Mise à jour le 28 octobre 2026');
  expect(readFileSync(path.join(racine, 'sitemap.xml'), 'utf8')).toContain('<url><loc>https://baromatch.fr/confidentialite.html</loc><lastmod>2026-10-28</lastmod></url>');
});
