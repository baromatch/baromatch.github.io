// Le référencement des pages que le générateur écrit, sur des sites construits de bout en bout (comme maillage.spec.mjs) :
// la copie enregistrée de l’appli (des matchs, aucun bar publié : la réalité d’aujourd’hui) et le scénario inventé (de vrais
// bars dans trois villes : celle de demain), puis ce même scénario quelques jours et quelques semaines plus tard.
// Les règles valent pour toute page que le générateur écrit, y compris celles qu’il écrira plus tard :
// - un titre de 15 à 60 caractères, une description de 70 à 155, une adresse canonique, un seul h1, des titres dans l’ordre,
//   la langue de la page, un texte alternatif à chaque image, des titres et des descriptions tous différents ;
// - des données structurées qui se lisent, que le vocabulaire de schema.org accepte, avec un fil d’Ariane partout et, sur la
//   page d’un match, un SportsEvent seulement si son stade est connu (aujourd’hui, jamais) ; une FAQ balisée seulement si elle est
//   visible ;
// - des aperçus de partage complets (Open Graph et X) ;
// - un plan du site qui liste chaque page indexable, une fois, avec la date de son dernier vrai changement, et qui oublie un
//   match passé comme le robot le supprime ; robots.txt n’en ferme aucune ;
// - les liens qui relient l’accueil, « Ce soir », les pages des matchs et « Pour les bars », avec un texte qui dit où l’on va.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import {
  CAPTURE, MAINTENANT_DE_LA_CAPTURE, MAINTENANT_DU_SCENARIO, SCENARIO, construireLeSiteDExemple, contenuDuScenario,
} from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITRE_MAX, TITRE_MIN } from '../generateur/bornes.mjs';
import { JOUR_MS } from '../generateur/donnees.mjs';
import { jourDeParis } from '../generateur/heure.mjs';
import { evenementDuMatch } from '../generateur/jsonld.mjs';
import { blocsDe, chargerLeVocabulaire, validerLaPage, validerUnBloc } from '../generateur/validateur.mjs';

const ORIGINE = 'https://baromatch.fr';
const vocabulaire = chargerLeVocabulaire();
const decoder = (texte) => texte.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&');
const normaliser = (texte) => decoder(texte).replace(/[\s  ]+/g, ' ').trim();

// Toutes les pages HTML d’un dossier, par chemin servi (« /matchs/x/ », « /cgu.html »).
const pagesDu = (dossier) => {
  const pages = new Map();
  const parcourir = (relatif) => {
    for (const nom of readdirSync(path.join(dossier, relatif))) {
      const enfant = path.posix.join(relatif, nom);
      if (statSync(path.join(dossier, enfant)).isDirectory()) parcourir(enfant);
      else if (nom.endsWith('.html')) pages.set(`/${enfant.replace(/(^|\/)index\.html$/, '$1')}`, readFileSync(path.join(dossier, enfant), 'utf8'));
    }
  };
  parcourir('');
  return pages;
};

const un = (html, motif) => (html.match(motif) ?? [])[1];
const metas = (html) => {
  const lu = {};
  for (const m of html.matchAll(/<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s+content="([^"]*)"/g)) (lu[m[1]] ??= []).push(decoder(m[2]));
  return lu;
};
const tete = (html) => ({
  titres: [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => decoder(m[1])),
  descriptions: [...html.matchAll(/<meta name="description" content="([^"]*)"/g)].map((m) => decoder(m[1])),
  robots: [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]),
  canoniques: [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]),
  langue: un(html, /<html lang="([^"]*)"/),
  h1: (html.match(/<h1[\s>]/g) ?? []).length,
  titresDeLaPage: [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1])),
});
const noeuds = (valeur) => {
  if (Array.isArray(valeur)) return valeur.flatMap(noeuds);
  if (!valeur || typeof valeur !== 'object') return [];
  return [valeur, ...Object.values(valeur).flatMap(noeuds)];
};
const typesDe = (noeud) => [].concat(noeud['@type'] ?? []);
const deType = (html, type) => blocsDe(html).flatMap(noeuds).filter((n) => typesDe(n).includes(type));
const indexable = (html) => !/<meta name="robots" content="noindex">/.test(html);
// Le plan du site, lu : { adresse, date }.
const lirePlan = (xml) => [...xml.matchAll(/<url><loc>([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?<\/url>/g)].map((m) => ({ adresse: m[1], date: m[2] }));
const cheminDe = (adresse) => adresse.slice(ORIGINE.length);

const SITES = [
  { nom: 'la capture (aucun bar publié)', options: { source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, contenu: chargerLeContenu(racine) } },
  { nom: 'le scénario (de vrais bars)', options: { maintenant: MAINTENANT_DU_SCENARIO } },
];

for (const site of SITES) {
  test.describe(site.nom, () => {
    let dossier;
    let resultat;
    let pages;
    let robots;

    test.beforeAll(async () => {
      dossier = mkdtempSync(path.join(tmpdir(), 'referencement-'));
      resultat = await construireLeSiteDExemple(dossier, { ...site.options, rendu: null });
      pages = pagesDu(dossier);
      robots = readFileSync(path.join(dossier, 'robots.txt'), 'utf8');
    });
    test.afterAll(() => {
      if (dossier) rmSync(dossier, { recursive: true, force: true });
    });

    // Les pages que le générateur a écrites (hors 404, hors pages écrites à la main).
    const generees = () => Object.keys(resultat.etat.pages).filter((chemin) => chemin.endsWith('/')).map((chemin) => [chemin, pages.get(chemin)]);

    test('chaque page générée : titre, description, adresse canonique, un seul h1, langue, titres dans l’ordre', () => {
      expect(generees().length).toBeGreaterThan(20);
      for (const [chemin, html] of generees()) {
        expect(html, `${chemin} : aucun fichier`).toBeTruthy();
        const lu = tete(html);
        expect(lu.titres, chemin).toHaveLength(1);
        expect(lu.titres[0].length, `${chemin} : ${lu.titres[0]}`).toBeGreaterThanOrEqual(TITRE_MIN);
        expect(lu.titres[0].length, `${chemin} : ${lu.titres[0]}`).toBeLessThanOrEqual(TITRE_MAX);
        expect(lu.descriptions, chemin).toHaveLength(1);
        expect(lu.descriptions[0].length, `${chemin} : ${lu.descriptions[0]}`).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(lu.descriptions[0].length, `${chemin} : ${lu.descriptions[0]}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(lu.canoniques, chemin).toEqual([`${ORIGINE}${chemin}`]);
        expect(lu.h1, `${chemin} : h1`).toBe(1);
        expect(lu.langue, chemin).toBe(chemin.startsWith('/en/') ? 'en' : 'fr');
        // Aucun titre ne saute de niveau en descendant (h2 puis h4), et la page commence par son h1.
        expect(lu.titresDeLaPage[0], `${chemin} : le premier titre`).toBe(1);
        lu.titresDeLaPage.forEach((niveau, i) => {
          if (i > 0) expect(niveau, `${chemin} : h${lu.titresDeLaPage[i - 1]} puis h${niveau}`).toBeLessThanOrEqual(lu.titresDeLaPage[i - 1] + 1);
        });
        // Le titre n’est jamais l’ancien nom ni un point d’exclamation, et ne pousse pas à boire.
        expect(`${lu.titres[0]} ${lu.descriptions[0]}`, chemin).not.toMatch(/!|Soir de Match|[Hh]appy hour|[Tt]ournée|verre offert/);
        // Une image a toujours son texte alternatif, ses dimensions ; une seule page ne se dit pas deux fois indexable.
        for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
          expect(img, `${chemin} : ${img}`).toMatch(/\salt="/);
          expect(img, `${chemin} : ${img}`).toMatch(/\swidth="\d+"/);
          expect(img, `${chemin} : ${img}`).toMatch(/\sheight="\d+"/);
        }
      }
    });

    test('les titres et les descriptions des pages indexables sont tous différents', () => {
      const indexables = generees().filter(([, html]) => indexable(html));
      for (const cle of ['titres', 'descriptions']) {
        const vus = new Map();
        for (const [chemin, html] of indexables) vus.set(tete(html)[cle][0], [...(vus.get(tete(html)[cle][0]) ?? []), chemin]);
        expect([...vus].filter(([, chemins]) => chemins.length > 1), cle).toEqual([]);
      }
    });

    test('chaque page générée a son aperçu de partage complet, Open Graph et X, avec une image du site', () => {
      for (const [chemin, html] of generees()) {
        const lu = metas(html);
        const { titres, descriptions } = tete(html);
        for (const cle of ['og:type', 'og:locale', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:site', 'twitter:image']) {
          expect(lu[cle], `${chemin} : ${cle}`).toHaveLength(1);
          expect(lu[cle][0].trim(), `${chemin} : ${cle}`).not.toBe('');
        }
        expect(lu['og:title'], chemin).toEqual(titres);
        expect(lu['og:description'], chemin).toEqual(descriptions);
        expect(lu['og:url'], chemin).toEqual([`${ORIGINE}${chemin}`]);
        expect(lu['twitter:card'], chemin).toEqual(['summary_large_image']);
        expect(lu['twitter:image'], chemin).toEqual(lu['og:image']);
        expect(lu['og:image'][0].startsWith(`${ORIGINE}/`), chemin).toBe(true);
        expect([lu['og:image:width'][0], lu['og:image:height'][0]], chemin).toEqual(['1200', '630']);
        // Une image de l’état courant du site : celle de la page (partage.png, écrite avec elle) ou l’image générale, jamais
        // un écusson ni un logo ajouté pour l’occasion.
        const fichier = decodeURIComponent(new URL(lu['og:image'][0]).pathname);
        expect(existsSync(path.join(dossier, fichier)) || /^\/(?:matchs|regarder-le-match|bar|ce-soir|en)\/.*partage\.png$/.test(fichier), `${chemin} : ${fichier}`).toBe(true);
      }
    });

    test('les données structurées se lisent, passent schema.org, et chaque page a son fil d’Ariane', () => {
      for (const [chemin, html] of generees()) {
        const blocs = blocsDe(html);
        expect(blocs.length, chemin).toBeGreaterThanOrEqual(1);
        expect(validerLaPage(vocabulaire, html), chemin).toEqual([]);
        const tous = blocs.flatMap(noeuds);
        const fil = tous.filter((n) => typesDe(n).includes('BreadcrumbList'));
        expect(fil, `${chemin} : fil d’Ariane`).toHaveLength(1);
        expect(fil[0].itemListElement.length, chemin).toBeGreaterThanOrEqual(2);
        // Ni note, ni avis, ni produit : rien que le site ne puisse prouver.
        expect(tous.flatMap((n) => Object.keys(n)).filter((cle) => ['aggregateRating', 'review', 'ratingValue'].includes(cle)), chemin).toEqual([]);
        expect(tous.flatMap(typesDe).filter((type) => ['Product', 'AggregateRating', 'Review', 'SearchAction'].includes(type)), chemin).toEqual([]);
      }
    });

    test('une FAQ balisée est visible dans la page, mot pour mot', () => {
      let faq = 0;
      for (const [chemin, html] of generees()) {
        const questions = deType(html, 'Question');
        if (!questions.length) continue;
        faq += 1;
        const corps = normaliser(html.split('<body>')[1].replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' '));
        for (const question of questions) {
          expect(corps, `${chemin} : ${question.name}`).toContain(normaliser(question.name));
          expect(corps, `${chemin} : ${question.acceptedAnswer.text}`).toContain(normaliser(question.acceptedAnswer.text));
        }
      }
      // Les villes avec un guide ont leur FAQ visible ; sans bar publié, aucune ville n’est indexable, mais la page l’écrit.
      expect(faq).toBeGreaterThan(0);
    });

    test('la page d’un match à venir : aucun SportsEvent sans stade connu ; ses soirées portent le match, avec un bar publié pour lieu', () => {
      const matchs = resultat.fichiers.filter((f) => f.type === 'match' && f.chemin.endsWith('/') && /<h2 id="titre-(?:bars|premiers)"/.test(f.contenu));
      expect(matchs.length).toBeGreaterThan(5);
      const barsPublies = new Set((resultat.donnees.bars ?? []).map((b) => b.nom));
      for (const f of matchs) {
        // Les données n’ont pas le stade : aucun SportsEvent à la racine de la page, donc aucun lieu inventé.
        const racines = blocsDe(f.contenu).flatMap((b) => b['@graph']);
        expect(racines.filter((n) => typesDe(n).includes('SportsEvent')), f.chemin).toEqual([]);
        expect(deType(f.contenu, 'WebPage')[0].mainEntity, f.chemin).toBeUndefined();
        // Le fil d’Ariane mène à l’accueil et à la semaine.
        const fil = deType(f.contenu, 'BreadcrumbList')[0].itemListElement;
        expect(fil.map((i) => i.item ?? null), f.chemin).toEqual([`${ORIGINE}/`, `${ORIGINE}/matchs/`, `${ORIGINE}${f.chemin}`]);
        // Chaque soirée : le lieu est un bar publié, jamais un autre ; le match est son « about », avec son nom, son jour
        // (le décalage de Paris) et ses deux équipes, sans lieu.
        for (const soiree of deType(f.contenu, 'Event')) {
          expect(barsPublies.has(soiree.location.name), `${f.chemin} : ${soiree.location.name}`).toBe(true);
          expect(soiree.about.name, f.chemin).toMatch(/^.+ – .+$/);
          expect(soiree.about.startDate, f.chemin).toMatch(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}\+0[12]:00)?$/);
          expect(soiree.about.homeTeam.name, f.chemin).toBeTruthy();
          expect(soiree.about.awayTeam.name, f.chemin).toBeTruthy();
          expect(soiree.about.location, f.chemin).toBeUndefined();
        }
      }
    });

    test('l’accueil et les pages écrites à la main : leurs données structurées passent schema.org', () => {
      const accueil = pages.get('/');
      const types = blocsDe(accueil).flatMap(noeuds).flatMap(typesDe);
      expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']));
      for (const [chemin, html] of pages) {
        if (generees().some(([c]) => c === chemin) || chemin === '/404.html') continue;
        expect(validerLaPage(vocabulaire, html), chemin).toEqual([]);
        const lu = tete(html);
        expect(lu.langue, chemin).toBe(chemin === '/en/for-bars/' ? 'en' : 'fr');
        expect(lu.h1, `${chemin} : h1`).toBe(1);
        expect(lu.titresDeLaPage[0], `${chemin} : le premier titre`).toBe(1);
        lu.titresDeLaPage.forEach((niveau, i) => {
          if (i > 0) expect(niveau, `${chemin} : h${lu.titresDeLaPage[i - 1]} puis h${niveau}`).toBeLessThanOrEqual(lu.titresDeLaPage[i - 1] + 1);
        });
        expect(lu.titres[0].length, chemin).toBeLessThanOrEqual(TITRE_MAX);
        expect(lu.descriptions[0].length, chemin).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(lu.descriptions[0].length, `${chemin} : ${lu.descriptions[0]}`).toBeLessThanOrEqual(DESCRIPTION_MAX);
      }
    });

    test('le plan du site : chaque page indexable du site, une fois, avec sa date ; aucune page en noindex', () => {
      const plan = lirePlan(readFileSync(path.join(dossier, 'sitemap.xml'), 'utf8'));
      const adresses = plan.map((e) => e.adresse);
      expect(new Set(adresses).size, 'une adresse deux fois').toBe(adresses.length);
      // Les pages du dossier qui ne disent pas noindex (la 404, qui le dit, n’y est pas).
      const attendues = [...pages].filter(([, html]) => indexable(html)).map(([chemin]) => `${ORIGINE}${chemin}`).sort();
      expect(adresses.slice().sort()).toEqual(attendues);
      const aujourdhui = jourDeParis(site.options.maintenant);
      for (const { adresse, date } of plan) {
        expect(date, adresse).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(date)), adresse).toBe(false);
        const html = pages.get(cheminDe(adresse));
        expect(html, adresse).toBeTruthy();
        expect(tete(html).canoniques, adresse).toEqual([adresse]);
        // Une page générée prend la date de son dernier vrai changement, dite par l’état du générateur.
        const entree = resultat.etat.pages[cheminDe(adresse)];
        if (entree) expect(date, adresse).toBe(entree.change);
      }
      // Rien de ce qui est dans le plan n’est fermé par robots.txt.
      const fermes = robots.split('\n').map((l) => l.trim()).filter((l) => /^Disallow:\s*\S/i.test(l)).map((l) => l.replace(/^Disallow:\s*/i, ''));
      for (const { adresse } of plan) expect(fermes.filter((f) => cheminDe(adresse).startsWith(f)), adresse).toEqual([]);
      expect(robots).toContain(`Sitemap: ${ORIGINE}/sitemap.xml`);
      // Les dates ne sont pas dans le futur de ce passage, sauf celles des pages écrites à la main, datées à la main.
      for (const [chemin, entree] of Object.entries(resultat.etat.pages)) if (chemin.endsWith('/')) expect(entree.change <= aujourdhui, chemin).toBe(true);
    });

    test('les liens qui relient l’accueil, « Ce soir », les pages des matchs et « Pour les bars », avec un texte qui dit où l’on va', () => {
      const liens = (html) => [...html.split('<body>')[1].replace(/<textarea[\s\S]*?<\/textarea>/g, '').matchAll(/<a\b[^>]*?\shref="([^"#]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
        .map((m) => ({
          href: decoder(m[1]),
          // Le texte du lien, sinon son nom parlé (le lien du logo n’a que celui-là).
          texte: normaliser(m[2].replace(/<[^>]+>/g, ' ')) || normaliser(decoder((m[0].match(/aria-label="([^"]*)"/) ?? [])[1] ?? '')),
        }));
      const vers = (html, chemin) => liens(html).filter((l) => l.href === chemin);
      const matchs = generees().filter(([chemin]) => /^\/matchs\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/$/.test(chemin) && !/Ce match est passé/.test(pages.get(chemin)));
      expect(matchs.length).toBeGreaterThan(5);
      // Aucun texte de lien vide ou qui ne dit rien.
      const VAGUE = /^(?:ici|cliquez ici|clique ici|en savoir plus|lire la suite|voir|plus)$/i;
      for (const chemin of ['/', '/ce-soir/', '/pour-les-bars.html', matchs[0][0]]) {
        const html = pages.get(chemin);
        for (const lien of liens(html).filter((l) => l.href.startsWith('/'))) expect(lien.texte.replace(VAGUE, ''), `${chemin} → ${lien.href}`).not.toBe('');
      }
      // L’accueil → « Ce soir » et « Pour les bars » ; « Ce soir » → l’accueil et « Pour les bars » ; la page d’un match →
      // l’accueil, « Ce soir » (dans son corps, par une phrase) et « Pour les bars » ; « Pour les bars » → l’accueil et « Ce soir ».
      // (le menu : « Ce soir » ; sous la carte du prochain match, quand il se joue ce soir : « Tous les matchs de ce soir »)
      expect(vers(pages.get('/'), '/ce-soir/').map((l) => l.texte)).toEqual(expect.arrayContaining(['Ce soir']));
      expect(vers(pages.get('/'), '/pour-les-bars.html').length).toBeGreaterThan(0);
      expect(vers(pages.get('/ce-soir/'), '/').length).toBeGreaterThan(0);
      expect(vers(pages.get('/ce-soir/'), '/pour-les-bars.html').length).toBeGreaterThan(0);
      expect(vers(pages.get('/pour-les-bars.html'), '/').length).toBeGreaterThan(0);
      expect(vers(pages.get('/pour-les-bars.html'), '/ce-soir/').length).toBeGreaterThan(0);
      for (const [chemin, html] of matchs) {
        expect(vers(html, '/').length, chemin).toBeGreaterThan(0);
        expect(vers(html, '/pour-les-bars.html').length, chemin).toBeGreaterThan(0);
        const corps = html.split('<main')[1].split('</main>')[0];
        expect([...corps.matchAll(/<a href="\/ce-soir\/">([^<]*)<\/a>/g)].map((m) => decoder(m[1])), `${chemin} : le lien « Ce soir » dans le corps`).toHaveLength(1);
        expect(vers(html, '/ce-soir/').map((l) => l.texte), chemin).toContain(site.options.source?.startsWith('capture') ? 'Les matchs de ce soir' : 'Où regarder le match ce soir');
        // La page du match mène aussi à la semaine, et chaque page de la semaine y est liée.
        expect(vers(pages.get('/matchs/'), chemin).length, chemin).toBeGreaterThan(0);
      }
      // « Ce soir » mène à un match de son programme, quand il y en a ce soir-là.
      const programme = liens(pages.get('/ce-soir/')).filter((l) => /^\/matchs\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/$/.test(l.href));
      for (const lien of programme) expect(pages.has(lien.href), lien.href).toBe(true);
    });
  });
}

// Le plan du site au fil des jours : un match passé en sort dès qu’il est passé (sa page reste, en noindex), et disparaît
// du dossier comme du plan quand le robot la supprime, 30 jours après ; l’accueil prend la date de son dernier vrai changement.
test.describe('le plan du site au fil des passages', () => {
  test.describe.configure({ mode: 'serial' });
  let dossier;
  const passer = (maintenant) => construire({ source: `scenario:${SCENARIO}`, sortie: dossier, maintenant, racine, contenu: contenuDuScenario(), rendu: null, accepterLesSuppressions: true });
  const planDe = () => lirePlan(readFileSync(path.join(dossier, 'sitemap.xml'), 'utf8'));
  const etat = () => JSON.parse(readFileSync(path.join(dossier, 'regarder-le-match', 'etat.json'), 'utf8'));
  const MATCH = '/matchs/psg-ol-2026-10-25/';
  const heure = (iso) => Date.parse(iso);

  test.beforeEach(async () => {
    dossier = mkdtempSync(path.join(tmpdir(), 'referencement-jours-'));
    await construireLeSiteDExemple(dossier, { maintenant: MAINTENANT_DU_SCENARIO, rendu: null });
    // Le plan du dossier d’essai vient de celui du dépôt, que le robot réécrit à chaque passage (la date de l’accueil
    // avance). L’essai part de la date du plan écrit à la main, 2026-10-28, jamais de celle du jour : il réécrit la
    // ligne de l’accueil dans sa copie et ne lit jamais le fichier du robot.
    const plan = path.join(dossier, 'sitemap.xml');
    writeFileSync(plan, readFileSync(plan, 'utf8').replace(/(<loc>https:\/\/baromatch\.fr\/<\/loc><lastmod>)[^<]*/, '$12026-10-28'));
  });
  test.afterEach(() => {
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  test('un match à venir est au plan ; passé, il en sort et dit noindex ; supprimé par le robot, il n’y est plus', async () => {
    expect(planDe().map((e) => e.adresse)).toContain(`${ORIGINE}${MATCH}`);
    expect(indexable(readFileSync(path.join(dossier, MATCH, 'index.html'), 'utf8'))).toBe(true);

    // Trois jours après le match : sa page reste (les anciens liens), en noindex, et n’est plus au plan.
    await passer(heure('2026-10-28T08:00:00Z'));
    expect(existsSync(path.join(dossier, MATCH, 'index.html'))).toBe(true);
    expect(indexable(readFileSync(path.join(dossier, MATCH, 'index.html'), 'utf8'))).toBe(false);
    expect(planDe().map((e) => e.adresse)).not.toContain(`${ORIGINE}${MATCH}`);
    // Aucune page du plan n’est en noindex, ni absente du dossier.
    for (const { adresse } of planDe()) {
      const fichier = path.join(dossier, cheminDe(adresse).endsWith('/') ? `${cheminDe(adresse)}index.html` : cheminDe(adresse));
      expect(existsSync(fichier), adresse).toBe(true);
      expect(indexable(readFileSync(fichier, 'utf8')), adresse).toBe(true);
    }

    // 31 jours après le match : le robot supprime la page, et le plan ne la connaît plus.
    await passer(heure('2026-10-25T20:45:00Z') + 31 * JOUR_MS);
    expect(existsSync(path.join(dossier, MATCH, 'index.html'))).toBe(false);
    expect(planDe().map((e) => e.adresse).filter((a) => a.includes('psg-ol-2026-10-25'))).toEqual([]);
    expect(Object.keys(etat().pages).filter((c) => c.includes('psg-ol-2026-10-25'))).toEqual([]);
  });

  test('l’accueil prend la date de son dernier vrai changement (celle de son bloc des matchs), sans jamais reculer', async () => {
    const accueil = () => planDe().find((e) => e.adresse === `${ORIGINE}/`).date;
    // Le plan écrit à la main dit 2026-10-28 : un passage plus tard, avec des matchs dans la semaine, avance la date.
    await passer(heure('2026-10-29T08:00:00Z'));
    expect(etat().accueil.change).toBe('2026-10-29');
    expect(accueil()).toBe('2026-10-29');
    // Le même jour, plus tard, avec les mêmes matchs : le bloc est le même, la date aussi.
    await passer(heure('2026-10-29T11:00:00Z'));
    expect(etat().accueil.change).toBe('2026-10-29');
    expect(accueil()).toBe('2026-10-29');
    // Le lendemain : le bloc change (le jour, les matchs), la date avance.
    await passer(heure('2026-10-30T08:00:00Z'));
    expect(etat().accueil.change).toBe('2026-10-30');
    expect(accueil()).toBe('2026-10-30');
    // Un passage fait avec une horloge en retard ne fait jamais reculer la date du plan.
    await passer(heure('2026-10-29T08:00:00Z'));
    expect(accueil()).toBe('2026-10-30');
  });
});

// Le SportsEvent d’un match : seulement avec un stade connu (match.lieu), jamais sans. Aucune donnée n’en a un aujourd’hui :
// ce test le prouve avec un match d’exemple.
test('un match avec un stade (exemple) : un SportsEvent juste ; sans stade, ou avec un faux stade : rien', () => {
  const match = {
    slug: 'psg-ol-2026-10-25', competition: 'Ligue 1', statut: null, heureConfirmee: true, debut: Date.parse('2026-10-25T19:45:00Z'),
    domicile: { nom: 'Paris Saint-Germain', court: 'PSG' }, exterieur: { nom: 'Olympique Lyonnais', court: 'OL' },
  };
  expect(evenementDuMatch(match)).toBeNull();
  expect(evenementDuMatch({ ...match, lieu: { nom: 'Stade d’exemple' } })).toBeNull();
  const sportif = evenementDuMatch({ ...match, lieu: { nom: 'Stade d’exemple', rue: '1 Rue du Stade', codePostal: '75016', ville: 'Paris' } });
  expect(sportif).toMatchObject({
    '@type': 'SportsEvent',
    '@id': `${ORIGINE}/matchs/psg-ol-2026-10-25/#match`,
    name: 'Paris Saint-Germain – Olympique Lyonnais',
    startDate: '2026-10-25T20:45:00+01:00',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: 'Stade d’exemple', address: { postalCode: '75016', addressLocality: 'Paris', addressCountry: 'FR' } },
  });
  expect(sportif.image).toBeUndefined();
  expect(validerUnBloc(vocabulaire, { '@context': 'https://schema.org', '@graph': [sportif] })).toEqual([]);
  expect(evenementDuMatch({ ...match, statut: 'reporte', lieu: { nom: 'S', rue: 'R', codePostal: '1', ville: 'V' } }).eventStatus).toBe('https://schema.org/EventPostponed');
});
