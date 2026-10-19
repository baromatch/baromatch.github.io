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
// Deux fois : la mesure d’audience arrêtée (le code de marque.json vide), puis active (un code d’essai). Active, chaque
// page charge en plus /mesure.js, et rien d’autre : son budget l’admet (AVEC_LA_MESURE), quelle que soit marque.json.
// Chaque page est servie par un site d’exemple (tests/outils/site-genere.mjs : une copie des pages du dépôt, réécrites
// avec la mesure comme l’Action le ferait, et le scénario inventé construit par-dessus).
// Les seuils sont un peu au-dessus des mesures du 19 octobre 2026 (en Ko, juste au-dessus de PAGES). Une page qui
// grossit exprès (une nouvelle section, une image) relève son seuil ici, dans le même commit, en le disant.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const KO = 1024;
// genere : la page vient du scénario inventé (tests/donnees/scenario.json), avec de vrais bars.
// Mesuré le 19 octobre 2026 (Ko) : accueil 6 requêtes, 162 transférés, JS 12, CSS 48, images 15 ; CGU 4, 142, 0, 48, 0 ;
// pour les bars 11, 234, 56, 72, 59 ; « Ce soir », match, ville et pages en anglais 6, 144 à 146, 2, 61, 0 ; bar 7,
// 144, 2, 61, 2 ; agenda/ 5, 143, 0, 61, 0 ; les affiches 6, 147, 0, 72 (affiche.css, 11 Ko), 0.
// La police (121 Ko) fait l’essentiel de chaque page.
const PAGES = [
  { nom: 'accueil', chemin: '/', budget: { requetes: 8, transfere: 180, js: 16, css: 58, images: 24 } },
  { nom: 'page fixe (CGU)', chemin: '/cgu.html', budget: { requetes: 6, transfere: 155, js: 0, css: 58, images: 0 } },
  { nom: 'pour les bars', chemin: '/pour-les-bars.html', budget: { requetes: 13, transfere: 260, js: 68, css: 86, images: 72 } },
  { nom: '« Ce soir »', chemin: '/ce-soir/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'page de match', chemin: '/matchs/psg-ol-2026-10-25/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'page de ville', chemin: '/regarder-le-match/paris/', genere: true, budget: { requetes: 8, transfere: 165, js: 4, css: 72, images: 4 } },
  { nom: 'page de bar', chemin: '/bar/le-zinc-des-amis-paris-11/', genere: true, budget: { requetes: 9, transfere: 160, js: 4, css: 72, images: 6 } },
  { nom: 'page en anglais (Paris)', chemin: '/en/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'match en anglais', chemin: '/en/matches/psg-barca-2026-10-24/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: '« Ton club dans ton agenda »', chemin: '/agenda/', genere: true, budget: { requetes: 8, transfere: 160, js: 4, css: 72, images: 4 } },
  { nom: 'affiche de la semaine', chemin: '/matchs/affiche/', genere: true, budget: { requetes: 8, transfere: 165, js: 4, css: 86, images: 4 } },
  { nom: 'affiche d’un bar', chemin: '/bar/le-zinc-des-amis-paris-11/affiche/', genere: true, budget: { requetes: 8, transfere: 165, js: 4, css: 86, images: 4 } },
];
// /mesure.js : 6,7 Ko, 2,6 Ko compressé, une requête.
const AVEC_LA_MESURE = { requetes: 1, transfere: 3, js: 7 };
const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
const MESURES = [
  { nom: 'la mesure d’audience arrêtée', marque: { ...MARQUE, mesure: { ...MARQUE.mesure, code: '' } }, plus: {} },
  { nom: 'la mesure d’audience active', marque: { ...MARQUE, mesure: { ...MARQUE.mesure, outil: 'goatcounter', code: 'essai' } }, plus: AVEC_LA_MESURE },
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

const sites = [];
test.beforeAll(async () => {
  for (const { marque } of MESURES) {
    const dossier = mkdtempSync(path.join(tmpdir(), 'budget-vitesse-'));
    sites.push({ dossier });
    await construireLeSiteDExemple(dossier, { rendu: null, marque });
    sites.at(-1).serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  }
});
test.afterAll(() => {
  for (const { dossier, serveur } of sites) {
    serveur?.arreter();
    rmSync(dossier, { recursive: true, force: true });
  }
});

for (const [rang, { nom, marque, plus }] of MESURES.entries()) {
  for (const page of PAGES) {
    test(`${page.nom}, ${nom} : dans son budget sur un téléphone`, async ({ browser }) => {
      const origine = sites[rang].serveur.adresse;
      const { ressources, ratees, scriptsBloquants } = await mesurer(browser, `${origine}${page.chemin}`);
      expect(ratees).toEqual([]);
      const mesure = {
        requetes: ressources.length,
        transfere: Math.round(ressources.reduce((total, r) => total + r.transferes, 0) / KO),
        js: Math.round(somme(ressources, 'script') / KO),
        css: Math.round(somme(ressources, 'stylesheet') / KO),
        images: Math.round(somme(ressources, 'image') / KO),
      };
      const budget = Object.fromEntries(Object.entries(page.budget).map(([cle, max]) => [cle, max + (plus[cle] ?? 0)]));
      const depasse = Object.entries(budget).filter(([cle, max]) => mesure[cle] > max).map(([cle, max]) => `${cle} : ${mesure[cle]} pour ${max} au plus`);
      expect(depasse, `mesuré ${JSON.stringify(mesure)}`).toEqual([]);
      // /mesure.js, seulement quand la mesure est active (hors de baromatch.fr, il ne compte rien et n’envoie rien).
      const actif = Boolean(marque.mesure.code);
      expect(ressources.filter((r) => new URL(r.adresse).pathname === '/mesure.js')).toHaveLength(actif ? 1 : 0);
      // Une seule police, et rien d’un autre site : ni script, ni style, ni police, ni envoi de la mesure d’audience.
      expect(ressources.filter((r) => r.type === 'font').map((r) => new URL(r.adresse).pathname)).toHaveLength(POLICES_MAX);
      expect(ressources.filter((r) => new URL(r.adresse).origin !== origine).map((r) => r.adresse)).toEqual([]);
      expect(scriptsBloquants).toEqual([]);
    });
  }
}
