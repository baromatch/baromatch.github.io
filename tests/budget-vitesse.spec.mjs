// Le budget de vitesse : une page échoue si elle s’alourdit sur un téléphone. Des mesures exactes, qui ne dépendent pas
// de la charge de la machine (Lighthouse, lui, varie de 77 à 99 sur la même page quand la machine est occupée : voir
// npm run lighthouse:budget). Chaque page est ouverte comme Lighthouse l’ouvre sur mobile (412 × 823, ×1,75, tactile),
// jusqu’à ce que le réseau se taise ; on compte ce que le navigateur a vraiment chargé :
// - le poids transféré : celui de GitHub Pages, qui compresse le texte (HTML, CSS, JS, SVG) en gzip ; la police et les
//   images passent telles quelles ;
// - le nombre de requêtes, et le poids (non compressé) du JavaScript, du CSS et des images ;
// - une seule police (Bricolage Grotesque, un seul fichier) ;
// - rien d’un autre site pendant le chargement, et aucun script qui bloque l’affichage (chaque script de fichier est
//   defer ou async).
// Les seuils sont un peu au-dessus des mesures du 19 octobre 2026 (en Ko, juste au-dessus de PAGES). Une page qui
// grossit exprès (une nouvelle section, une image) relève son seuil ici, dans le même commit, en le disant.
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const KO = 1024;
// genere : la page vient du scénario inventé (tests/donnees/scenario.json), construit à part, avec de vrais bars.
// Mesuré le 19 octobre 2026 (Ko) : accueil 6 requêtes, 162 transférés, JS 12, CSS 48, images 15 ; CGU 4, 142, 0, 48, 0 ;
// pour les bars 11, 234, 56, 72, 59 ; « Ce soir », match et ville 6, 144 à 145, 2, 59, 0 ; bar 7, 144, 2, 59, 2.
// La police (121 Ko) fait l’essentiel de chaque page.
const PAGES = [
  { nom: 'accueil', chemin: '/', budget: { requetes: 8, transfere: 180, js: 16, css: 58, images: 24 } },
  { nom: 'page fixe (CGU)', chemin: '/cgu.html', budget: { requetes: 6, transfere: 155, js: 0, css: 58, images: 0 } },
  { nom: 'pour les bars', chemin: '/pour-les-bars.html', budget: { requetes: 13, transfere: 260, js: 68, css: 86, images: 72 } },
  { nom: '« Ce soir »', chemin: '/ce-soir/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'page de match', chemin: '/matchs/psg-ol-2026-10-25/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'page de ville', chemin: '/regarder-le-match/paris/', genere: true, budget: { requetes: 8, transfere: 165, js: 4, css: 72, images: 4 } },
  { nom: 'page de bar', chemin: '/bar/le-zinc-des-amis-paris-11/', genere: true, budget: { requetes: 9, transfere: 160, js: 4, css: 72, images: 6 } },
];
const POLICES_MAX = 1;
const TEXTE = /^(?:text\/|application\/(?:javascript|json|ld\+json|xml)|image\/svg\+xml)/;

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

// Ouvre la page comme Lighthouse sur mobile et rend ce qu’elle a chargé : { type, adresse, octets, transferes }.
const mesurer = async (browser, adresse) => {
  const contexte = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const onglet = await contexte.newPage();
  const lectures = [];
  const ratees = [];
  onglet.on('requestfinished', (requete) => lectures.push((async () => {
    const reponse = await requete.response();
    const corps = reponse ? await reponse.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
    const texte = TEXTE.test(reponse?.headers()['content-type'] ?? '');
    return { type: requete.resourceType(), adresse: requete.url(), octets: corps.length, transferes: texte ? gzipSync(corps).length : corps.length };
  })()));
  onglet.on('requestfailed', (requete) => ratees.push(requete.url()));
  await onglet.goto(adresse, { waitUntil: 'load' });
  await onglet.waitForLoadState('networkidle');
  const scripts = await onglet.evaluate(() => [...document.querySelectorAll('script[src]')]
    .filter((s) => !s.defer && !s.async && s.type !== 'module').map((s) => s.getAttribute('src')));
  const ressources = await Promise.all(lectures);
  await contexte.close();
  return { ressources, ratees, scriptsBloquants: scripts };
};

const somme = (ressources, type) => ressources.filter((r) => !type || r.type === type).reduce((total, r) => total + r.octets, 0);

let site;
let serveur;
test.beforeAll(async () => {
  site = mkdtempSync(path.join(tmpdir(), 'budget-vitesse-'));
  await construireLeSiteDExemple(site, { rendu: null });
  serveur = await demarrerServeur(await portLibre(), -1, { dossier: site });
});
test.afterAll(() => {
  serveur?.arreter();
  if (site) rmSync(site, { recursive: true, force: true });
});

for (const page of PAGES) {
  test(`${page.nom} : dans son budget sur un téléphone`, async ({ browser, baseURL }) => {
    const origine = page.genere ? serveur.adresse : baseURL;
    const { ressources, ratees, scriptsBloquants } = await mesurer(browser, `${origine}${page.chemin}`);
    expect(ratees).toEqual([]);
    const mesure = {
      requetes: ressources.length,
      transfere: Math.round(ressources.reduce((total, r) => total + r.transferes, 0) / KO),
      js: Math.round(somme(ressources, 'script') / KO),
      css: Math.round(somme(ressources, 'stylesheet') / KO),
      images: Math.round(somme(ressources, 'image') / KO),
    };
    const depasse = Object.entries(page.budget).filter(([cle, max]) => mesure[cle] > max).map(([cle, max]) => `${cle} : ${mesure[cle]} pour ${max} au plus`);
    expect(depasse, `mesuré ${JSON.stringify(mesure)}`).toEqual([]);
    // Une seule police, et rien d’un autre site : ni script, ni style, ni police, ni mesure d’audience.
    expect(ressources.filter((r) => r.type === 'font').map((r) => new URL(r.adresse).pathname)).toHaveLength(POLICES_MAX);
    expect(ressources.filter((r) => new URL(r.adresse).origin !== origine).map((r) => r.adresse)).toEqual([]);
    expect(scriptsBloquants).toEqual([]);
  });
}
