// Le référencement : ce que Google et les aperçus de liens lisent sur chaque page.
// Les en-têtes sont lus sans JavaScript, comme un robot qui ne l’exécute pas. Une page de la liste qui n’a pas de
// fichier fait échouer ces tests (elle n’est pas sautée), sauf les liens de tablée, servis par 404.html.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { PROFILS } from './outils/marque.mjs';
import { fichierDe, PAGES } from './outils/pages.mjs';

const ORIGINE = 'https://baromatch.fr';
const canoniqueDe = (chemin) => `${ORIGINE}${chemin}`;
const existe = (page) => existsSync(fichierDe(page.chemin));
const exigerLaPage = (page) => {
  if (!page.chemin.startsWith('/t/')) expect(existe(page), `${page.chemin} : aucun fichier ${fichierDe(page.chemin)}`).toBe(true);
};
const INDEXABLES = PAGES.filter((p) => p.indexable !== false);
// Un fichier du dépôt, lu depuis sa racine (pas depuis le dossier d’où l’on lance les tests).
const duDepot = (...morceaux) => path.join(racine, ...morceaux);

// Les règles maison des pages déjà en ligne. pour-les-bars.html suit le contrat commun ci-dessous.
const TITRES_CHOISIS = {
  '/': 'Baromatch — Trouve un bar qui diffuse ton match, à Paris',
  '/boutique.html': 'La boutique Baromatch — pièces pour les soirs de match',
};
const PAGES_MAISON = ['/', '/boutique.html', '/cgu.html', '/confidentialite.html', '/mentions-legales.html', '/supprimer-mon-compte.html', '/presse.html', '/a-propos.html', '/comment-on-choisit-les-bars.html', '/trouver-un-bar-qui-diffuse-le-match.html'];
const TYPES_ATTENDUS = {
  '/': ['Organization', 'WebSite', 'MobileApplication', 'FAQPage'],
  '/boutique.html': ['FAQPage'],
  '/cgu.html': ['WebPage'],
  '/confidentialite.html': ['WebPage'],
  '/mentions-legales.html': ['WebPage'],
  '/supprimer-mon-compte.html': ['WebPage'],
  '/presse.html': ['AboutPage', 'BreadcrumbList'],
  '/a-propos.html': ['AboutPage', 'BreadcrumbList'],
  '/comment-on-choisit-les-bars.html': ['WebPage', 'BreadcrumbList'],
  '/trouver-un-bar-qui-diffuse-le-match.html': ['Article', 'BreadcrumbList'],
};
// Ce que le site ne peut pas promettre : ni produit en vente, ni note, ni recherche interne.
const TYPES_INTERDITS = ['Product', 'Offer', 'AggregateOffer', 'AggregateRating', 'Review', 'SearchAction'];
const CLES_INTERDITES = ['offers', 'aggregateRating', 'review', 'downloadUrl', 'installUrl'];
// L’appli : seulement ce qui est vrai aujourd’hui (pas encore dans les magasins, Android d’abord).
const CLES_APPLI = ['@type', '@id', 'name', 'description', 'applicationCategory', 'inLanguage', 'publisher'];
const TABLEE = {
  titre: 'Une tablée t’attend — Baromatch',
  description: 'Le bar, le match, l’heure et les places qui restent à la table. Ouvre le lien, même sans l’appli.',
};

// Tout ce que la tête et le corps disent aux robots, lu dans la page servie.
const lirePage = (onglet) => onglet.evaluate(() => {
  const contenus = (selecteur) => [...document.querySelectorAll(selecteur)].map((e) => e.getAttribute('content'));
  const og = {};
  for (const meta of document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')) {
    const cle = meta.getAttribute('property') || meta.getAttribute('name');
    (og[cle] = og[cle] || []).push(meta.getAttribute('content'));
  }
  return {
    titres: [...document.querySelectorAll('title')].map((t) => t.textContent),
    descriptions: contenus('meta[name="description"]'),
    robots: contenus('meta[name="robots"]'),
    canoniques: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
    og,
    h1: document.querySelectorAll('h1').length,
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
  };
});

// Chaque nœud d’un bloc JSON-LD, @graph compris, pour chercher un @type ou une clé où qu’il soit.
const noeuds = (valeur) => {
  if (Array.isArray(valeur)) return valeur.flatMap(noeuds);
  if (!valeur || typeof valeur !== 'object') return [];
  return [valeur, ...Object.values(valeur).flatMap(noeuds)];
};
const typesDe = (noeud) => [].concat(noeud['@type'] ?? []);
const normaliser = (texte) => texte.replace(/[ \t\r\n]+/g, ' ').trim();

// Largeur et hauteur d’un JPEG ou d’un PNG, lues dans le fichier.
const tailleImage = (fichier) => {
  const octets = readFileSync(fichier);
  if (octets.readUInt32BE(0) === 0x89504e47) return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
  if (octets[0] === 0xff && octets[1] === 0xd8) {
    let i = 2;
    while (i < octets.length) {
      const marqueur = octets[i + 1];
      const longueur = octets.readUInt16BE(i + 2);
      if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
        return { largeur: octets.readUInt16BE(i + 7), hauteur: octets.readUInt16BE(i + 5) };
      }
      i += 2 + longueur;
    }
  }
  throw new Error(`${fichier} : format d’image que ce test ne lit pas (JPEG ou PNG attendu)`);
};

test.describe('ce qu’un robot lit sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const page of INDEXABLES) {
    test(`${page.nom} : titre, description, adresse canonique et un seul h1`, async ({ page: onglet }) => {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const lu = await lirePage(onglet);
      expect(lu.titres).toHaveLength(1);
      expect(lu.titres[0].length).toBeGreaterThanOrEqual(15);
      expect(lu.titres[0].length).toBeLessThanOrEqual(60);
      expect(lu.descriptions).toHaveLength(1);
      expect(lu.descriptions[0].length).toBeGreaterThanOrEqual(70);
      expect(lu.descriptions[0].length).toBeLessThanOrEqual(160);
      expect(lu.canoniques).toEqual([canoniqueDe(page.chemin)]);
      expect(lu.og['og:url']).toEqual([canoniqueDe(page.chemin)]);
      expect(lu.h1).toBe(1);
      expect(lu.robots.filter((r) => /noindex/i.test(r))).toEqual([]);
    });

    test(`${page.nom} : carte Open Graph et Twitter complète, avec une vraie image`, async ({ page: onglet }) => {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const { og } = await lirePage(onglet);
      for (const cle of ['og:type', 'og:locale', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:site']) {
        expect(og[cle], cle).toHaveLength(1);
        expect(og[cle][0].trim(), cle).not.toBe('');
      }
      expect(og['og:locale'][0]).toBe('fr_FR');
      expect(og['og:site_name'][0]).toBe('Baromatch');
      expect(og['twitter:card'][0]).toBe('summary_large_image');
      expect(og['twitter:site'][0]).toBe('@baromatchapp');
      // L’image de la carte X : la même que celle d’Open Graph, dite aussi pour X (qui sinon la devine).
      expect(og['twitter:image']).toEqual(og['og:image']);
      const image = og['og:image'][0];
      expect(image.startsWith(`${ORIGINE}/`)).toBe(true);
      const fichierImage = fichierDe(new URL(image).pathname);
      expect(existsSync(fichierImage), fichierImage).toBe(true);
      expect([og['og:image:width'][0], og['og:image:height'][0]]).toEqual(['1200', '630']);
      expect(tailleImage(fichierImage)).toEqual({ largeur: 1200, hauteur: 630 });
    });

    test(`${page.nom} : les données structurées se lisent et ne promettent rien de faux`, async ({ page: onglet }) => {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const { jsonld } = await lirePage(onglet);
      expect(jsonld.length).toBeGreaterThanOrEqual(1);
      const blocs = jsonld.map((texte) => JSON.parse(texte));
      const tous = blocs.flatMap(noeuds);
      expect(tous.flatMap(typesDe).filter((type) => TYPES_INTERDITS.includes(type))).toEqual([]);
      expect(tous.flatMap((n) => Object.keys(n)).filter((cle) => CLES_INTERDITES.includes(cle))).toEqual([]);

      // Une FAQ balisée répète mot pour mot une question et une réponse lisibles dans la page.
      const visibles = await onglet.evaluate(() => {
        const textes = [...document.querySelectorAll('summary, dt, dd, h2, h3, p, li')].map((e) => e.textContent);
        for (const details of document.querySelectorAll('details')) {
          textes.push([...details.children].filter((e) => e.tagName !== 'SUMMARY').map((e) => e.textContent).join(' '));
        }
        return textes;
      });
      const lisibles = new Set(visibles.map(normaliser));
      for (const question of tous.filter((n) => typesDe(n).includes('Question'))) {
        expect(lisibles.has(normaliser(question.name)), question.name).toBe(true);
        expect(lisibles.has(normaliser(question.acceptedAnswer.text)), question.acceptedAnswer.text).toBe(true);
      }
    });

    test(`${page.nom} : ne promet aucun score (le sous-bock n’en montre pas)`, async ({ page: onglet }) => {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const lu = await lirePage(onglet);
      const corps = await onglet.evaluate(() => document.body.textContent);
      const phrases = [corps, ...lu.descriptions, ...Object.values(lu.og).flat(), ...lu.jsonld]
        .flatMap((texte) => normaliser(texte).split(/(?<=[.?!])\s/));
      const promesses = phrases.filter((p) => /\bscores?\b/i.test(p) && !/\b(pas de|aucun|sans) scores?\b/i.test(p));
      expect(promesses).toEqual([]);
    });

    test(`${page.nom} : chaque image a un texte alternatif et ses dimensions`, async ({ page: onglet }) => {
      exigerLaPage(page);
      for (const largeur of [360, 1280]) {
        await onglet.setViewportSize({ width: largeur, height: 800 });
        await onglet.goto(page.chemin);
        const images = await onglet.evaluate(() => [...document.querySelectorAll('img')].map((img) => ({
          src: img.getAttribute('src'),
          alt: img.hasAttribute('alt'),
          largeur: img.getAttribute('width'),
          hauteur: img.getAttribute('height'),
          paresseuse: img.getAttribute('loading') === 'lazy',
          // Une image cachée à cette largeur (display: none, sans boîte) n’est pas à l’écran.
          visible: img.getClientRects().length > 0 && img.getBoundingClientRect().top < window.innerHeight,
        })));
        for (const image of images) {
          expect(image.alt, `${image.src} : alt`).toBe(true);
          expect(Number(image.largeur), `${image.src} : width`).toBeGreaterThan(0);
          expect(Number(image.hauteur), `${image.src} : height`).toBeGreaterThan(0);
          expect(image.visible && image.paresseuse, `${image.src} : chargée tard alors qu’elle est à l’écran à ${largeur} px`).toBe(false);
        }
      }
    });
  }

  test('chaque page indexable a son propre titre et sa propre description', async ({ page: onglet }) => {
    const titres = new Map();
    const descriptions = new Map();
    for (const page of INDEXABLES) {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const lu = await lirePage(onglet);
      titres.set(lu.titres[0], [...(titres.get(lu.titres[0]) ?? []), page.chemin]);
      descriptions.set(lu.descriptions[0], [...(descriptions.get(lu.descriptions[0]) ?? []), page.chemin]);
    }
    const doublons = (vus) => [...vus].filter(([, chemins]) => chemins.length > 1);
    expect(doublons(titres), 'titres en double').toEqual([]);
    expect(doublons(descriptions), 'descriptions en double').toEqual([]);
  });

  for (const chemin of PAGES_MAISON) {
    test(`${chemin} : titre et description repris tels quels dans la carte, grand aperçu permis`, async ({ page: onglet }) => {
      await onglet.goto(chemin);
      const lu = await lirePage(onglet);
      expect(lu.titres[0]).toContain('Baromatch');
      if (TITRES_CHOISIS[chemin]) expect(lu.titres[0]).toBe(TITRES_CHOISIS[chemin]);
      expect(lu.og['og:title']).toEqual(lu.titres);
      expect(lu.og['og:description']).toEqual(lu.descriptions);
      expect(lu.robots).toEqual(['max-image-preview:large']);
    });

    test(`${chemin} : les données structurées attendues, avec l’adresse de la page`, async ({ page: onglet }) => {
      await onglet.goto(chemin);
      const { jsonld } = await lirePage(onglet);
      const tous = jsonld.map((texte) => JSON.parse(texte)).flatMap(noeuds);
      const types = tous.flatMap(typesDe);
      for (const type of TYPES_ATTENDUS[chemin]) expect(types, type).toContain(type);
      const principal = tous.find((n) => typesDe(n).some((t) => TYPES_ATTENDUS[chemin].includes(t)) && n.url);
      expect(principal?.url).toBe(canoniqueDe(chemin));
      // La fiche d’une page porte le titre de la page : un titre changé d’un côté se voit ici.
      if (typesDe(principal).some((t) => t === 'WebPage' || t === 'AboutPage' || t === 'FAQPage')) {
        expect(principal.name).toBe(await onglet.title());
      }
    });
  }

  test('accueil : Organization, WebSite et l’appli disent seulement ce qui est vrai', async ({ page: onglet }) => {
    await onglet.goto('/');
    const { jsonld } = await lirePage(onglet);
    const tous = jsonld.map((texte) => JSON.parse(texte)).flatMap(noeuds);
    const de = (type) => tous.filter((n) => typesDe(n).includes(type));
    const [organisation] = de('Organization');
    expect(de('Organization')).toHaveLength(1);
    expect(organisation.name).toBe('Baromatch');
    expect(organisation.url).toBe(`${ORIGINE}/`);
    expect(organisation.sameAs).toEqual(PROFILS);
    expect(organisation.contactPoint.email).toBe('contact@baromatch.fr');
    expect(organisation.logo.startsWith(`${ORIGINE}/`)).toBe(true);
    expect(existsSync(fichierDe(new URL(organisation.logo).pathname))).toBe(true);

    const [site] = de('WebSite');
    expect(de('WebSite')).toHaveLength(1);
    expect(site.name).toBe('Baromatch');
    expect(site.url).toBe(`${ORIGINE}/`);
    expect(site.publisher['@id']).toBe(organisation['@id']);

    const [appli] = de('MobileApplication');
    expect(de('MobileApplication')).toHaveLength(1);
    expect(Object.keys(appli).filter((cle) => !CLES_APPLI.includes(cle))).toEqual([]);
    expect(appli.name).toBe('Baromatch');
    expect(appli.inLanguage).toBe('fr');
    expect(appli.publisher['@id']).toBe(organisation['@id']);
  });

  test('boutique : chaque question de la page est dans la FAQ balisée, dans l’ordre', async ({ page: onglet }) => {
    await onglet.goto('/boutique.html');
    const { jsonld } = await lirePage(onglet);
    const [faq] = jsonld.map((texte) => JSON.parse(texte)).flatMap(noeuds).filter((n) => typesDe(n).includes('FAQPage'));
    const visibles = await onglet.$$eval('.boutique-questions details', (liste) => liste.map((details) => ({
      question: details.querySelector('summary').textContent,
      reponse: [...details.children].filter((e) => e.tagName !== 'SUMMARY').map((e) => e.textContent).join(' '),
    })));
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text].map(normaliser)))
      .toEqual(visibles.map((v) => [v.question, v.reponse].map(normaliser)));
  });

  for (const chemin of ['/404.html', '/t/abcdefghjkmn']) {
    test(`${chemin} : pas d’index, pas d’adresse canonique, un aperçu qui parle de la tablée`, async ({ page: onglet }) => {
      await onglet.goto(chemin);
      const lu = await lirePage(onglet);
      expect(lu.robots).toEqual(['noindex']);
      expect(lu.canoniques).toEqual([]);
      expect(lu.og['og:url']).toBeUndefined();
      expect(lu.titres).toEqual(['Page introuvable — Baromatch']);
      expect(lu.og['og:title']).toEqual([TABLEE.titre]);
      expect(lu.og['og:description']).toEqual([TABLEE.description]);
      expect(lu.descriptions).toEqual([TABLEE.description]);
      expect(lu.og['og:image']).toEqual([`${ORIGINE}/img/og-image.jpg`]);
    });
  }
});

// Chaque page mène à « Pour les bars » depuis son en-tête et son pied de page, avec un texte qui dit où l’on va (plus
// « Bars partenaires », ni l’ancre /#bars de l’accueil).
test.describe('chaque page mène à « Pour les bars » depuis son en-tête et son pied de page', () => {
  test.use({ javaScriptEnabled: false });

  for (const page of PAGES) {
    test(`${page.nom} : le lien de l’en-tête et celui du pied de page`, async ({ page: onglet }) => {
      exigerLaPage(page);
      await onglet.goto(page.chemin);
      const entete = await onglet.$$eval('.entete__nav a', (liens) => liens.map((l) => ({
        href: l.getAttribute('href'), texte: l.textContent.trim(), classe: l.className, courant: l.getAttribute('aria-current'),
      })));
      expect(entete.filter((l) => l.href === '/pour-les-bars.html')).toEqual([{
        href: '/pour-les-bars.html',
        texte: 'Pour les bars',
        classe: 'entete__lien entete__lien--bars',
        courant: page.chemin === '/pour-les-bars.html' ? 'page' : null,
      }]);
      expect(entete.map((l) => l.href), 'plus d’ancre vers l’accueil').not.toContain('/#bars');
      expect(entete.map((l) => l.texte)).not.toContain('Bars partenaires');

      const pied = await onglet.$$eval('.pied__liens a', (liens) => liens.map((l) => ({ href: l.getAttribute('href'), texte: l.textContent.trim() })));
      expect(pied[0], 'premier lien du pied de page').toEqual({ href: '/pour-les-bars.html', texte: 'Pour les bars' });
      expect(pied.filter((l) => l.href === '/pour-les-bars.html')).toHaveLength(1);
    });
  }
});

test('plan du site : un XML lisible, les pages indexables, chacune avec sa vraie date', async ({ page: onglet }) => {
  const xml = readFileSync(duDepot('sitemap.xml'), 'utf8');
  // Lu par le lecteur XML du navigateur : une erreur (un « & » nu, une balise mal fermée) le rend illisible.
  const lu = await onglet.evaluate((texte) => {
    const doc = new DOMParser().parseFromString(texte, 'application/xml');
    const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    return {
      erreur: doc.getElementsByTagName('parsererror').length > 0,
      racine: [doc.documentElement.localName, doc.documentElement.namespaceURI],
      entrees: [...doc.getElementsByTagNameNS(ns, 'url')].map((url) => ({
        adresse: url.getElementsByTagNameNS(ns, 'loc')[0]?.textContent,
        date: url.getElementsByTagNameNS(ns, 'lastmod')[0]?.textContent,
      })),
    };
  }, xml);
  expect(lu.erreur, 'sitemap.xml illisible').toBe(false);
  expect(lu.racine).toEqual(['urlset', 'http://www.sitemaps.org/schemas/sitemap/0.9']);
  const { entrees } = lu;
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  INDEXABLES.forEach(exigerLaPage);
  // Les pages des matchs, des villes et des bars, écrites par le générateur (generateur/construire.mjs) : celles que
  // son état dit indexables sont dans le plan du site, chacune avec son fichier ; les autres n’y sont pas.
  const fichierEtat = duDepot('regarder-le-match', 'etat.json');
  const etat = existsSync(fichierEtat) ? JSON.parse(readFileSync(fichierEtat, 'utf8')) : { pages: {} };
  const generees = Object.entries(etat.pages).filter(([chemin, p]) => p.indexable && chemin.endsWith('/')).map(([chemin]) => chemin);
  for (const chemin of generees) expect(existsSync(fichierDe(chemin)), chemin).toBe(true);
  const canoniques = [...INDEXABLES.map((p) => canoniqueDe(p.chemin)), ...generees.map(canoniqueDe)];

  const adresses = entrees.map((e) => e.adresse);
  expect(new Set(adresses).size).toBe(adresses.length);
  for (const entree of entrees) {
    expect(canoniques, entree.adresse).toContain(entree.adresse);
    expect(entree.date, entree.adresse).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(entree.date)), entree.adresse).toBe(false);
    expect(entree.date <= aujourdhui, `${entree.adresse} : ${entree.date} est dans le futur`).toBe(true);
  }
  for (const page of INDEXABLES) {
    expect(adresses, page.chemin).toContain(canoniqueDe(page.chemin));
  }
  for (const chemin of generees) expect(adresses, chemin).toContain(canoniqueDe(chemin));
  expect(xml).not.toContain('404.html');

  // Une page qui affiche « Mise à jour le … » donne la même date au plan du site.
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  for (const page of INDEXABLES) {
    const affichee = readFileSync(fichierDe(page.chemin), 'utf8').match(/class="document__date">([^<]*)</);
    if (!affichee || !adresses.includes(canoniqueDe(page.chemin))) continue;
    const texte = affichee[1].replace(/&nbsp;/g, ' ');
    const trouve = texte.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i);
    expect(trouve, `${page.chemin} : date affichée illisible « ${texte} »`).not.toBeNull();
    const mois = MOIS.indexOf(trouve[2].toLowerCase()) + 1;
    expect(mois, `${page.chemin} : mois inconnu « ${trouve[2]} »`).toBeGreaterThan(0);
    const date = `${trouve[3]}-${String(mois).padStart(2, '0')}-${trouve[1].padStart(2, '0')}`;
    expect(entrees.find((e) => e.adresse === canoniqueDe(page.chemin)).date, page.chemin).toBe(date);
  }
});

test('robots.txt : les outils de vérification hors de l’index, le site et ses ressources ouverts', async () => {
  const lignes = readFileSync(duDepot('robots.txt'), 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  expect(lignes).toContain('User-agent: *');
  expect(lignes).toContain('Allow: /');
  expect(lignes).toContain(`Sitemap: ${ORIGINE}/sitemap.xml`);
  for (const chemin of ['/tests/', '/package.json', '/package-lock.json', '/playwright.config.mjs', '/generateur/', '/docs/', '/regarder-le-match/etat.json']) {
    expect(lignes).toContain(`Disallow: ${chemin}`);
  }

  // Les règles du groupe « * », lues comme Google : la plus longue l’emporte, Allow à égalité.
  const regles = [];
  let agents = [];
  let dansLesRegles = false;
  for (const ligne of lignes) {
    const [cle, ...reste] = ligne.split(':');
    const valeur = reste.join(':').trim();
    const nom = cle.trim().toLowerCase();
    if (nom === 'user-agent') {
      if (dansLesRegles) agents = [];
      agents.push(valeur);
      dansLesRegles = false;
    } else if ((nom === 'allow' || nom === 'disallow') && valeur) {
      dansLesRegles = true;
      if (agents.includes('*')) regles.push({ permis: nom === 'allow', motif: valeur });
    }
  }
  const versRegex = (motif) => new RegExp(`^${motif.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\?\$$/, '$')}`);
  const permis = (chemin) => {
    const touchees = regles.filter((r) => versRegex(r.motif).test(chemin))
      .sort((a, b) => b.motif.length - a.motif.length || Number(b.permis) - Number(a.permis));
    return touchees.length === 0 || touchees[0].permis;
  };
  const fichiersSous = (dossier) => readdirSync(duDepot(dossier)).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    return statSync(duDepot(chemin)).isDirectory() ? fichiersSous(chemin) : [`/${chemin.split(path.sep).join('/')}`];
  });

  const fermes = [...fichiersSous('tests'), '/package.json', '/package-lock.json', '/playwright.config.mjs'];
  expect(fermes.filter((chemin) => permis(chemin))).toEqual([]);
  const ouverts = [
    ...INDEXABLES.map((p) => p.chemin), '/t/abcdefghjkmn', '/.well-known/assetlinks.json', '/styles.css', '/main.js',
    '/tablee.js', '/boutique.js', '/fonts/bricolage-grotesque.woff2', '/img/og-image.jpg', '/favicon.svg', '/favicon.ico',
    '/apple-touch-icon.png', '/sitemap.xml', '/pour-les-bars.css', '/pour-les-bars.js', '/pour-les-bars-amorce.js',
    '/img/og-bars.jpg', ...fichiersSous('img/bars'), '/llms.txt', ...fichiersSous('presse'), ...fichiersSous('badge'),
  ];
  expect(ouverts.filter((chemin) => !permis(chemin))).toEqual([]);
});

test.describe('l’ouverture de l’accueil', () => {
  // Les animations du titre et de la phrase d’ouverture, et celles du verre, avec leur fin en millisecondes.
  const lireAnimations = (onglet) => onglet.evaluate(() => document.getAnimations().map((animation) => {
    const cible = animation.effect.target;
    let zone = 'autre';
    if (cible.closest('.ouverture__titre')) zone = 'titre';
    else if (cible.closest('.ouverture__suite')) zone = 'suite';
    else if (cible.closest('.verre')) zone = 'verre';
    return { zone, fin: Math.round(animation.effect.getComputedTiming().endTime) };
  }));

  test('le titre et la phrase d’ouverture sont peints avant 0,6 s, le verre garde son animation', async ({ page: onglet }) => {
    await onglet.goto('/');
    const animations = await lireAnimations(onglet);
    const texte = animations.filter((a) => a.zone === 'titre' || a.zone === 'suite');
    expect(texte.filter((a) => a.zone === 'titre')).toHaveLength(3);
    expect(texte.filter((a) => a.zone === 'suite')).toHaveLength(1);
    expect(texte.filter((a) => a.fin > 600)).toEqual([]);
    // Le verre garde les siennes (goutte, remplissage, reflet, halo, vague), qui finissent après 0,6 s.
    expect(animations.filter((a) => a.zone === 'verre' && Number.isFinite(a.fin) && a.fin > 600).length).toBeGreaterThan(0);
  });

  test('avec « réduire les animations », tout est là d’emblée', async ({ page: onglet }) => {
    await onglet.emulateMedia({ reducedMotion: 'reduce' });
    await onglet.goto('/');
    const animations = await lireAnimations(onglet);
    expect(animations.filter((a) => a.zone !== 'autre')).toEqual([]);
    const styles = await onglet.evaluate(() => ({
      decoupes: [...document.querySelectorAll('.ouverture__titre span')].map((s) => getComputedStyle(s).clipPath),
      opacite: getComputedStyle(document.querySelector('.ouverture__suite')).opacity,
    }));
    expect(styles).toEqual({ decoupes: ['none', 'none', 'none'], opacite: '1' });
  });
});

test.describe('l’affiche du film', () => {
  test('aucune affiche n’est l’image de fin du film, qui annonce des plateformes', () => {
    const ffmpeg = (() => { try { execFileSync('ffmpeg', ['-version']); return true; } catch { return false; } })();
    test.skip(!ffmpeg, 'ffmpeg absent : ce test lit la dernière image du film');
    // L’affiche et la dernière image du film, réduites à 64 × 64 par ffmpeg, en octets RGB.
    const pixels = (...entree) => execFileSync('ffmpeg', ['-v', 'error', ...entree, '-frames:v', '1', '-vf', 'scale=64:64:flags=area',
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1024 * 1024 });
    for (const format of ['16x9', '9x16']) {
      const affiche = pixels('-i', duDepot(`baromatch-film-${format}.webp`));
      const fin = pixels('-sseof', '-0.5', '-i', duDepot(`baromatch-film-${format}.mp4`));
      expect(affiche.length).toBe(64 * 64 * 3);
      expect(fin.length).toBe(affiche.length);
      let somme = 0;
      for (let i = 0; i < affiche.length; i += 1) somme += Math.abs(affiche[i] - fin[i]);
      // Écart moyen de 0 à 255 : environ 3 pour une copie de la fin, près de 20 pour une autre scène.
      expect(somme / affiche.length, `baromatch-film-${format}.webp ressemble à la fin du film`).toBeGreaterThan(10);
    }
  });

  test('sans JavaScript, le cadre du film montre l’affiche paysage et se lit, sans bouton qui ne marche pas', async ({ browser, baseURL }) => {
    for (const largeur of [360, 1280]) {
      const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: largeur, height: 800 } });
      const onglet = await contexte.newPage();
      const demandees = [];
      onglet.on('request', (requete) => {
        const chemin = new URL(requete.url()).pathname;
        if (/^\/baromatch-film-[^/]+\.(jpe?g|png|webp)$/.test(chemin)) demandees.push(chemin);
      });
      await onglet.goto('/');
      const cadre = onglet.locator('#film-cadre');
      await cadre.scrollIntoViewIfNeeded();
      // Sans script, le cadre reste en paysage (la version portrait est choisie par main.js) : l’affiche aussi.
      const boite = await cadre.boundingBox();
      expect(boite.width, `cadre en paysage à ${largeur} px`).toBeGreaterThan(boite.height);
      await expect(onglet.locator('#film')).toBeHidden();
      const lecteur = cadre.locator('video:visible');
      await expect(lecteur).toHaveCount(1);
      await expect(lecteur).toHaveAttribute('poster', '/baromatch-film-16x9.webp');
      await expect(lecteur).toHaveAttribute('controls', '');
      await expect.poll(() => demandees, { timeout: 5000 }).toEqual(['/baromatch-film-16x9.webp']);
      await expect(onglet.locator('#film-son')).toBeHidden();
      await expect(onglet.locator('#film-lecture')).toBeHidden();
      await contexte.close();
    }
  });

  for (const ecran of [
    { largeur: 360, hauteur: 800, affiche: '/baromatch-film-9x16.webp', film: '/baromatch-film-9x16.mp4' },
    { largeur: 1280, hauteur: 800, affiche: '/baromatch-film-16x9.webp', film: '/baromatch-film-16x9.mp4' },
  ]) {
    test(`à ${ecran.largeur} px : le film se charge en arrivant à l’écran, dans la version de l’écran`, async ({ page: onglet }) => {
      const films = [];
      onglet.on('request', (requete) => {
        const chemin = new URL(requete.url()).pathname;
        if (chemin.endsWith('.mp4') && !films.includes(chemin)) films.push(chemin);
      });
      await onglet.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
      await onglet.goto('/');
      await onglet.waitForLoadState('networkidle');
      expect(films).toEqual([]);
      await onglet.locator('#film').scrollIntoViewIfNeeded();
      await expect.poll(() => films, { timeout: 5000 }).toEqual([ecran.film]);
    });

    test(`à ${ecran.largeur} px : une seule affiche, en WebP, celle de l’écran`, async ({ page: onglet }) => {
      const demandees = [];
      onglet.on('request', (requete) => {
        const chemin = new URL(requete.url()).pathname;
        if (/^\/baromatch-film-[^/]+\.(jpe?g|png|webp)$/.test(chemin)) demandees.push(chemin);
      });
      await onglet.setViewportSize({ width: ecran.largeur, height: ecran.hauteur });
      await onglet.goto('/');
      await expect.poll(() => demandees, { timeout: 5000 }).toContain(ecran.affiche);
      await onglet.waitForLoadState('networkidle');
      expect(demandees).toEqual([ecran.affiche]);
    });
  }
});

for (const largeur of [360, 1280]) {
  test(`boutique à ${largeur} px : la collection ne pousse pas la page quand son script arrive tard`, async ({ page: onglet }) => {
    // Le script de la boutique retenu une demi-seconde, comme sur un réseau lent : la page ne doit pas
    // se peindre sans la collection puis sauter quand elle arrive (Cumulative Layout Shift).
    await onglet.route('**/boutique.js', async (route) => {
      await new Promise((resoudre) => setTimeout(resoudre, 500));
      await route.continue();
    });
    await onglet.setViewportSize({ width: largeur, height: 800 });
    await onglet.goto('/boutique.html');
    await expect(onglet.locator('.boutique-produit')).toHaveCount(6);
    const decalage = await onglet.evaluate(() => new Promise((resoudre) => {
      let total = 0;
      new PerformanceObserver((liste) => {
        for (const entree of liste.getEntries()) if (!entree.hadRecentInput) total += entree.value;
      }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resoudre(total), 300);
    }));
    expect(decalage).toBeLessThan(0.01);
  });
}

test('boutique : le nom, le type, le texte et le prix de chaque pièce sont dans le HTML', async ({ browser, page: onglet, baseURL }) => {
  await onglet.goto('/boutique.html');
  const lirePieces = (cible) => cible.$$eval('.boutique-produit', (pieces) => pieces.map((piece) => ({
    type: piece.querySelector('.boutique-produit__type').textContent,
    nom: piece.querySelector('.boutique-produit__nom').textContent,
    texte: piece.querySelector('.boutique-produit__texte').textContent,
    prix: piece.querySelector('.boutique-produit__prix').textContent.replace(/[\s\u00a0\u202f]+/g, ' ').trim(),
    mention: piece.querySelector('.boutique-produit__prix span')?.textContent ?? null,
  })));
  const avecScript = await lirePieces(onglet);
  expect(avecScript).toHaveLength(6);
  // Tant que rien n’est vendu, chaque prix est dit indicatif, par boutique.js comme dans le <noscript>.
  expect(avecScript.map((piece) => piece.mention)).toEqual(Array(6).fill('prix indicatif'));

  const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const sansScript = await contexte.newPage();
  await sansScript.goto('/boutique.html');
  expect(await lirePieces(sansScript)).toEqual(avecScript);
  // Sans script, la place gardée pour la collection dessinée par boutique.js est rendue : pas de trou.
  expect((await sansScript.locator('#boutique-grille').boundingBox()).height).toBe(0);
  await contexte.close();
});
