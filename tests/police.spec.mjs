// La police allégée : Bricolage Grotesque en trois fichiers (styles.css). Le cœur, le seul que chaque page précharge,
// doit avoir chaque caractère que le site dessine avec elle : sinon le navigateur le prend dans une autre police, ou
// charge un second fichier, et la page change d’aspect. Seule exception : une lettre du latin étendu (le Ş de
// « Galatasaray A.Ş. »), qui vient du nom d’un club donné par l’appli ; le fichier étendu la dessine.
// Vérifié dans les fichiers eux-mêmes (leur table cmap, tests/outils/police.mjs), sur tout ce que le site écrit lui-même :
// les pages écrites à la main et les pages que le générateur écrit sur des données figées (le scénario inventé et la
// capture enregistrée), ouvertes dans le navigateur (le texte, les contenus CSS comme le « › » du fil d’Ariane, les textes
// d’exemple des champs) ; et les textes que les scripts du site et le générateur écrivent plus tard (un message du
// formulaire, une carte de la boutique). Pas les pages des matchs publiées : leurs noms de clubs et de bars viennent des
// données du jour (l’Action les publie toutes les trois heures, sans lancer les tests) ; un caractère que Bricolage
// Grotesque n’a pas y est dessiné par le système, comme avant.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { caracteresDuFichier, facesDeBricolage, premiereFace } from './outils/police.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { CAPTURE, MAINTENANT_DE_LA_CAPTURE, construireLeSiteDExemple } from './outils/site-genere.mjs';

const COEUR = 'fonts/bricolage-grotesque.woff2';
const SIGNES = 'fonts/bricolage-grotesque-signes.woff2';
const ETENDU = 'fonts/bricolage-grotesque-etendu.woff2';
const faces = facesDeBricolage();
const couverture = Object.fromEntries([COEUR, SIGNES, ETENDU].map((f) => [f, caracteresDuFichier(path.join(racine, f))]));
const coeur = couverture[COEUR];
// Un signe que Bricolage Grotesque n’a dans aucun de ses fichiers (ni latin, ni latin étendu, ni vietnamien) : le
// système le dessine, comme avant. « ✓ » : les promesses de « Pour les bars ».
const SANS_DESSIN_DANS_BRICOLAGE = new Set(['✓']);
const plage = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
const nom = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')} « ${String.fromCodePoint(code)} »`;

test('trois fichiers : chacun a ses caractères, et le navigateur va d’abord au bon', () => {
  expect(faces.map((face) => face.fichier)).toEqual([COEUR, SIGNES, ETENDU]);
  // Le cœur sans unicode-range : il est essayé pour tout caractère que les deux autres ne prennent pas.
  expect(faces[0].plages).toBeNull();
  const essayee = premiereFace(faces);
  const egarees = Object.entries(couverture).flatMap(([fichier, codes]) => [...codes]
    .filter((code) => essayee(code)?.fichier !== fichier).map((code) => `${nom(code)} : dans ${fichier}, essayé d’abord dans ${essayee(code)?.fichier}`));
  expect(egarees).toEqual([]);
  // Et l’inverse : une plage n’annonce aucun caractère que son fichier n’a pas (sinon le navigateur le charge pour rien,
  // puis dessine le caractère dans une autre police).
  const annonces = faces.filter((face) => face.plages).flatMap((face) => face.plages
    .flatMap(([debut, fin]) => plage(debut, fin)).filter((code) => !couverture[face.fichier].has(code))
    .map((code) => `${nom(code)} : dans l’unicode-range de ${face.fichier}, pas dans le fichier`));
  expect(annonces).toEqual([]);
  // Aucun caractère dans deux fichiers.
  const doubles = [...couverture[SIGNES], ...couverture[ETENDU]].filter((code) => coeur.has(code)
    || (couverture[SIGNES].has(code) && couverture[ETENDU].has(code)));
  expect(doubles.map(nom)).toEqual([]);
});

test('aucun caractère perdu : tout ce que l’ancienne police dessinait l’est encore, et le cœur garde ce qu’écrit le site', () => {
  const tous = new Set([...coeur, ...couverture[SIGNES], ...couverture[ETENDU]]);
  // L’ancienne police (un seul fichier, jusqu’au 30 octobre 2026) : le latin de base, le latin-1, Œ œ et la ponctuation.
  const ancienne = [...plage(0x20, 0x7e), ...plage(0xa0, 0xff).filter((c) => ![0xa4, 0xad].includes(c)), 0x152, 0x153,
    0x2009, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x20ac, 0x2122];
  expect(ancienne.filter((code) => !tous.has(code)).map(nom)).toEqual([]);
  // Le cœur : le latin de base, toutes les lettres du latin-1 et ı (les noms de clubs : Bodø, Atlético, Malmö,
  // Kasımpaşa…), la ponctuation française, l’euro, et ‹ › − que le site écrit.
  const attendus = [...plage(0x20, 0x7e), ...plage(0xc0, 0xff).filter((c) => c !== 0xf7), ...'ı«»’‘“”–—…·°©€Œœ‹›−'].map((c) => (typeof c === 'string' ? c.codePointAt(0) : c));
  expect(attendus.filter((code) => !coeur.has(code)).map(nom)).toEqual([]);
});

// Les caractères qu’une page dessine avec Bricolage Grotesque (sa première police, calculée) : texte, contenus CSS
// (::before, ::after, ::marker), textes d’exemple et valeurs des champs ; cachés compris (un panneau qui s’ouvre).
const lireLesCaracteres = (onglet) => onglet.evaluate(() => {
  const vus = new Set();
  const garder = (element, texte, pseudo) => {
    const famille = getComputedStyle(element, pseudo).fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (famille === 'Bricolage Grotesque') for (const c of texte) vus.add(c);
  };
  for (const element of [document.body, ...document.body.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(element.tagName)) continue;
    let texte = '';
    for (const noeud of element.childNodes) if (noeud.nodeType === Node.TEXT_NODE) texte += noeud.nodeValue;
    if (texte.trim()) garder(element, texte);
    for (const pseudo of ['::before', '::after', '::marker']) {
      const contenu = getComputedStyle(element, pseudo).content;
      const litteral = (contenu.match(/"(?:[^"\\]|\\.)*"/g) ?? []).map((m) => m.slice(1, -1)).join('');
      if (litteral) garder(element, litteral, pseudo);
    }
    if (element.placeholder) garder(element, element.placeholder);
    if (element.tagName === 'INPUT' && element.value && !['hidden', 'checkbox', 'radio'].includes(element.type)) garder(element, element.value);
  }
  return [...vus];
});

// Ce qu’un caractère a de travers, ou null : hors du cœur, il n’est permis que s’il est une lettre du fichier étendu
// (un nom de club), ou un signe que Bricolage Grotesque n’a pas du tout.
const ecart = (c) => {
  const code = c.codePointAt(0);
  // Un caractère de commande, ou qu’on ne dessine jamais (le trait d’union conditionnel, l’espace sans chasse) : rien à dessiner.
  if (code < 0x20 || /\p{Default_Ignorable_Code_Point}/u.test(c) || coeur.has(code) || SANS_DESSIN_DANS_BRICOLAGE.has(c)) return null;
  if (couverture[ETENDU].has(code) && /\p{L}/u.test(c)) return null;
  if (couverture[SIGNES].has(code) || couverture[ETENDU].has(code)) return `${nom(code)} : hors du cœur (il chargerait un second fichier)`;
  return `${nom(code)} : dans aucun fichier de Bricolage Grotesque`;
};

const relever = (releve, c, ou) => {
  const motif = ecart(c);
  if (!motif) return;
  releve[motif] ??= [];
  if (releve[motif].length < 3) releve[motif].push(ou);
};

const parcourir = async (onglet, adresse, chemins) => {
  const releve = {};
  await couperLAPI(onglet);
  for (const chemin of chemins) {
    await onglet.goto(`${adresse}${chemin}`, { waitUntil: 'load' });
    for (const c of await lireLesCaracteres(onglet)) relever(releve, c, chemin);
  }
  return releve;
};

const fichiersHtml = (dossier, garder) => {
  const res = [];
  const marcher = (relatif) => {
    for (const entree of readdirSync(path.join(dossier, relatif))) {
      const chemin = path.join(relatif, entree);
      if (statSync(path.join(dossier, chemin)).isDirectory()) marcher(chemin);
      else if (entree.endsWith('.html')) res.push(`/${chemin.split(path.sep).join('/')}`);
    }
  };
  marcher('');
  return res.filter(garder).sort();
};

// Les pages écrites à la main : chaque HTML du dépôt que le site sert, hors des dossiers que le générateur écrit (et
// hors des tests, du générateur et des documents).
const A_LA_MAIN = execFileSync('git', ['ls-files', '*.html'], { cwd: racine, encoding: 'utf8' }).trim().split('\n')
  .filter((f) => !/^(?:tests|generateur|docs|matchs|en|regarder-le-match|ce-soir|agenda|bar)\//.test(f)).map((f) => `/${f}`);

test.describe('chaque caractère que le site dessine avec Bricolage Grotesque est dans le cœur', () => {
  test.describe.configure({ timeout: 240_000 });

  // Et le lien d’une tablée (servi par 404.html, l’API coupée).
  test('les pages écrites à la main', async ({ page }) => {
    const chemins = [...A_LA_MAIN, '/t/abcdefghjkmn'];
    expect(chemins.length).toBeGreaterThan(10);
    expect(await parcourir(page, '', chemins)).toEqual({});
  });

  for (const [genre, options] of [
    ['le scénario inventé', {}],
    ['la capture enregistrée des données de l’appli', { source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE }],
  ]) {
    test(`les pages que le générateur écrit avec ${genre}`, async ({ page }) => {
      const dossier = mkdtempSync(path.join(tmpdir(), 'police-'));
      let serveur;
      try {
        await construireLeSiteDExemple(dossier, { rendu: null, qr: null, ...options });
        serveur = await demarrerServeur(await portLibre(), -1, { dossier });
        const chemins = fichiersHtml(dossier, (c) => /^\/(?:matchs|en|regarder-le-match|ce-soir|agenda|bar)\//.test(c));
        expect(chemins.length).toBeGreaterThan(10);
        expect(await parcourir(page, serveur.adresse, chemins)).toEqual({});
      } finally {
        await serveur?.arreter();
        rmSync(dossier, { recursive: true, force: true });
      }
    });
  }
});

// La police de secours (styles.css : Arial, Liberation Sans ou Roboto aux mesures de Bricolage Grotesque) : sur une
// connexion lente, la page s’affiche avant que la police arrive ; quand elle arrive, le texte change de police en
// poussant le moins possible ce qui suit. Mesuré comme Chrome le mesure (les décalages de mise en page, layout-shift),
// la police retenue 1,5 s. Sans elle (jusqu’au 30 octobre 2026), à 390 px, la Confidentialité se décalait de 0,20 et
// une page de match de 0,16 ; avec elle, 0,085 et 0,032. Deux polices ne coupent jamais leurs lignes tout à fait aux
// mêmes mots : le seuil est celui que Google dit « bon », 0,1 (web.dev/cls).
const SEUIL_DECALAGE = 0.1;
test.describe('la police de secours : quand Bricolage Grotesque arrive tard, la page bouge à peine', () => {
  for (const [largeur, hauteur] of [[390, 844], [1280, 800]]) {
    for (const chemin of ['/', '/cgu.html', '/confidentialite.html', '/matchs/psg-ol-2026-10-25/']) {
      test(`${chemin} à ${largeur} px : décalage sous ${SEUIL_DECALAGE}`, async ({ browser, baseURL }) => {
        const contexte = await browser.newContext({ baseURL, viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce', locale: 'fr-FR' });
        await contexte.addInitScript(() => {
          window.decalages = [];
          new PerformanceObserver((liste) => {
            for (const e of liste.getEntries()) if (!e.hadRecentInput) window.decalages.push(e.value);
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const onglet = await contexte.newPage();
        const retenues = [];
        await onglet.route('**/fonts/*.woff2', (route) => {
          const envoi = new Promise((resoudre) => { setTimeout(resoudre, 1_500); }).then(() => route.continue());
          retenues.push(envoi);
          return envoi;
        });
        try {
          await onglet.goto(chemin, { waitUntil: 'domcontentloaded' });
          // La page s’affiche d’abord sans la police : sinon le test ne mesurerait pas l’arrivée tardive.
          await onglet.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
          expect(await onglet.evaluate(() => [...document.fonts].filter((f) => f.family === 'Bricolage Grotesque' && f.status === 'loaded').length)).toBe(0);
          // … dessinée avec la police de secours, trouvée sur cette machine (Arial, Liberation Sans ou Roboto).
          expect(await onglet.evaluate(() => [...document.fonts].some((f) => f.family.startsWith('Bricolage repli') && f.status === 'loaded'))).toBe(true);
          await onglet.waitForFunction(() => [...document.fonts].some((f) => f.family === 'Bricolage Grotesque' && f.status === 'loaded'));
          await onglet.evaluate(() => new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(suite, 300))); }));
          expect(retenues.length).toBeGreaterThan(0);
          const total = await onglet.evaluate(() => window.decalages.reduce((s, v) => s + v, 0));
          expect(total).toBeLessThanOrEqual(SEUIL_DECALAGE);
        } finally {
          await Promise.all(retenues);
          await contexte.close();
        }
      });
    }
  }
});

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

// Les chaînes d’un script (entre ' ', " " ou ` `), sans ses commentaires ni ses expressions régulières. Leurs
// échappements (\u2192, \u{1F37A}, \x41) sont décodés : le dépôt écrit ainsi ses caractères spéciaux (pour-les-bars.js).
const chainesDuScript = (source) => {
  const chaines = [];
  let i = 0;
  let precedent = '';
  while (i < source.length) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') { i = source.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i + 2) + 2; continue; }
    if (c === '/' && (precedent === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(precedent) || /\b(?:return|typeof|case)$/.test(source.slice(Math.max(0, i - 7), i).trimEnd()))) {
      let j = i + 1;
      let classe = false;
      while (j < source.length && (source[j] !== '/' || classe)) {
        if (source[j] === '\\') j += 1;
        else if (source[j] === '[') classe = true;
        else if (source[j] === ']') classe = false;
        j += 1;
      }
      i = j + 1;
      precedent = ')';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let texte = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') {
          const echappe = /^\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2}))/.exec(source.slice(j, j + 12));
          if (echappe) {
            texte += String.fromCodePoint(parseInt(echappe[1] ?? echappe[2] ?? echappe[3], 16));
            j += echappe[0].length;
          } else {
            texte += { n: '\n', r: '\r', t: '\t' }[source[j + 1]] ?? source[j + 1];
            j += 2;
          }
          continue;
        }
        texte += source[j];
        j += 1;
      }
      chaines.push(texte);
      i = j + 1;
      precedent = ')';
      continue;
    }
    if (!/\s/.test(c)) precedent = c;
    i += 1;
  }
  return chaines;
};

const textesDuJson = (valeur) => {
  if (typeof valeur === 'string') return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textesDuJson);
  if (valeur && typeof valeur === 'object') return Object.entries(valeur).flatMap(([cle, v]) => (cle.startsWith('_') ? [] : textesDuJson(v)));
  return [];
};

test('les textes que les scripts du site et le générateur écrivent plus tard sont dans le cœur', () => {
  const releve = {};
  const scripts = execFileSync('git', ['ls-files', '*.js'], { cwd: racine, encoding: 'utf8' }).trim().split('\n')
    .filter((f) => !/^(?:tests|generateur|docs)\//.test(f));
  expect(scripts).toContain('main.js');
  for (const script of scripts) {
    for (const chaine of chainesDuScript(readFileSync(path.join(racine, script), 'utf8'))) for (const c of chaine) relever(releve, c, script);
  }
  const contenus = readdirSync(path.join(racine, 'generateur', 'contenu')).filter((f) => f.endsWith('.json'));
  expect(contenus).toContain('clubs.json');
  for (const fichier of contenus) {
    const json = JSON.parse(readFileSync(path.join(racine, 'generateur', 'contenu', fichier), 'utf8'));
    for (const texte of textesDuJson(json)) for (const c of texte) relever(releve, c, `generateur/contenu/${fichier}`);
  }
  expect(releve).toEqual({});
});

test('l’outil de lecture des scripts : il garde les chaînes, laisse les commentaires et les expressions régulières, décode les échappements', () => {
  expect(chainesDuScript('var a = "un ½"; // « ✓ » commentaire\n/* ł */ var b = /["✓]/.test(x) ? \'deux\' : `trois ${a}`;'))
    .toEqual(['un ½', 'deux', 'trois ${a}']);
  expect(chainesDuScript('var c = "\\u2192 \\u{1F37A} \\x41\\u00a0fin \\"cité\\" \\\\";'))
    .toEqual(['→ 🍺 A\u00a0fin "cité" \\']);
});
