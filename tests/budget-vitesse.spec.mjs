// Le budget de vitesse : une page échoue si elle s’alourdit sur un téléphone. Des mesures exactes, qui ne dépendent pas
// de la charge de la machine (Lighthouse, lui, varie de 77 à 99 sur la même page quand la machine est occupée : voir
// npm run lighthouse:budget). Chaque page est ouverte comme Lighthouse l’ouvre sur mobile (412 × 823, ×1,75, tactile),
// jusqu’à ce que le réseau se taise ; on compte ce que le navigateur a vraiment chargé :
// - le poids transféré : celui de GitHub Pages, qui compresse le texte (HTML, CSS, JS, SVG) en gzip ; la police et les
//   images passent telles quelles ;
// - le nombre de requêtes, et le poids (non compressé) du JavaScript, du CSS et des images ;
// - une seule police : le cœur de Bricolage Grotesque, préchargé (ses deux autres fichiers, les signes rares et le
//   latin étendu, ne viennent que pour un caractère que ces pages n’écrivent pas) ;
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
const SEMAINE_PLEINE = path.join(racine, 'tests', 'donnees', 'semaine-pleine.json');
// genere : la page vient du scénario inventé (tests/donnees/scenario.json), avec de vrais bars.
// Mesuré le 19 octobre 2026 (Ko) : accueil 6 requêtes, 162 transférés, JS 12, CSS 48, images 15 ; CGU 4, 142, 0, 48, 0 ;
// pour les bars 11, 234, 56, 72, 59 ; « Ce soir », match, ville et pages en anglais 6, 144 à 146, 2, 61, 0 ; bar 7,
// 144, 2, 61, 2 ; agenda/ 5, 143, 0, 61, 0 ; les affiches 6, 147, 0, 72 (affiche.css, 11 Ko), 0.
// La police (121 Ko) fait l’essentiel de chaque page.
// 26 octobre 2026 : le CSS des deux affiches passe de 86 à 87 Ko. styles.css gagne le mot du fondateur (À propos,
// Presse) ; avec « Pour les bars » dans l’en-tête et l’accueil revu, elles arrivent à 86,8 Ko, compté 87.
// 29 octobre 2026 : styles.css gagne le jour (l’accueil en clair) et les matchs de la semaine de l’accueil : de 50,8 à
// 61,4 Ko (2,6 Ko de plus, compressés) : chaque seuil de CSS monte de 11 Ko (celui de l’accueil et des pages fixes, au
// plus juste, de 58 à 62), et le JS de l’accueil de 16 à 17 Ko (main.js remet les dates de la semaine lue un autre jour).
// 29 octobre 2026, après relecture : styles.css gagne le contour du focus du jour, la semaine sans :has(), le point des
// jours qui ont des bars et les longs jours (de 61,4 à 63,7 Ko) : le CSS de l’accueil et des pages fixes monte de 62 à
// 65 Ko ; main.js retire la semaine toute passée (de 17,1 à 17,8 Ko) : le JS de l’accueil, de 17 à 18 Ko.
// 30 octobre 2026 : « Pour les bars » passe au jour. pour-les-bars.css va de 24,3 à 28,6 Ko, styles.css est à 64,4 Ko
// (l’accueil au jour, et l’étiquette des écrans et la page courante de l’en-tête du jour) ; aucun seuil ne bouge.
// Mesuré ce jour-là (Ko) : accueil 6 requêtes, 177 transférés, JS 17,8, CSS 64,4, images 19 ; CGU 4, 147, 0, 64,4, 0 ;
// pour les bars 7, 185, 64, 92,9 (styles.css et pour-les-bars.css), 0 (ses captures se chargent au défilement) ;
// « Ce soir » 6, 150, 2, 80,9, 0 ; l’affiche de la semaine 6, 154, 0, 97,2, 0.
// 30 octobre 2026, après la relecture : le seuil de « Pour les bars » serre au plus juste. Mesuré (Ko) : 7 requêtes,
// 186 transférés, JS 65,3 (pour-les-bars.js 59,9, l’amorce 5,4), CSS 94,1 (styles.css 65,5, pour-les-bars.css 28,7),
// images 0 (ses captures se chargent au défilement) : seuils 8, 190, 67, 96, 4 (de 13, 260, 68, 97, 72).
// 30 octobre 2026 : la police allégée (105 Ko au lieu de 121 : le crénage et les chiffres tabulaires seulement, les
// signes rares à part). Chaque seuil de transfert baisse de 15 Ko ; mesuré : accueil 157, CGU 128, le guide 127, pour
// les bars 165, les pages générées 130 à 133, les affiches 135. Le CSS gagne 3,8 Ko (les @font-face et la police de
// secours) : ses seuils restent.
// 30 octobre 2026, après relecture : la police de secours ne dessine plus que les caractères des trois fichiers (8 fois
// la même unicode-range, 365 octets ; 0,2 Ko compressé) : styles.css passe de 55,8 à 57,7 Ko. Les seuils de CSS montent
// d’autant : l’accueil et les pages fixes de 58 à 59 Ko, les pages générées de 72 à 75, les affiches de 87 à 91.
// 30 octobre 2026, la police allégée et l’accueil au jour ensemble : les seuils de la police (ci-dessus), plus ce que
// l’accueil ajoute vraiment. styles.css : 57,8 Ko de la police, plus 14,3 Ko de l’accueil (le jour, les matchs de la
// semaine) : 72,1 Ko. Mesuré (Ko de CSS) : l’accueil et les pages fixes 72,1, les pages générées 88,7 (avec regarder.css),
// les affiches 105,0 (et affiche.css), pour les bars 96,5 (et pour-les-bars.css). Chaque seuil de CSS monte de 14 Ko :
// l’accueil et les pages fixes de 59 à 73, les pages générées de 75 à 89, les affiches de 91 à 105, pour les bars de 86
// à 100. main.js : 18,3 Ko (16,2 avant l’accueil), le JS de l’accueil de 16 à 18 Ko. Le transfert de l’accueil garde
// les 5 Ko du bloc de la semaine (165 à 170), celui des pages fixes les 3 Ko de leur CSS (140 à 143).
// 30 octobre 2026, la police allégée et « Pour les bars » au jour ensemble : le seuil de la page serre au plus juste.
// Mesuré (Ko) : 7 requêtes, 172 transférés, JS 65,7 (pour-les-bars.js 60,3, l’amorce 5,4), CSS 101,3 (styles.css 72,5,
// pour-les-bars.css 28,7), images 0 (ses captures se chargent au défilement) : seuils 8, 176, 67, 103, 4.
// styles.css garde aussi les trois règles du jour de « Pour les bars » (l’étiquette des écrans, la page courante de
// l’en-tête) : 72,5 Ko ; le CSS des affiches mesure 105,4 Ko (105,6 avant leur commentaire raccourci) : leur seuil
// passe de 105 à 106.
// 30 octobre 2026, les insignes des clubs (ceux de l’appli, generateur/insigne.mjs) : styles.css et regarder.css gagnent
// leurs règles (0,7 Ko ; avec les règles de « Pour les bars », 89,8 Ko pour les pages générées, 106,2 avec affiche.css) :
// le CSS des pages générées monte de 89 à 90 Ko, celui des affiches reste à 106. Le HTML gagne les dessins : mesuré, chaque page
// générée du scénario de 2,4 à 5,9 Ko compressés (une paire de 30 px par ligne de match, deux insignes de 58 px en
// tête d’un match) ; transférés, de 137 à 145 Ko, sous leurs seuils. L’accueil du scénario : 4,7 Ko de plus (6 cartes).
// L’accueil d’une semaine pleine est mesuré à part, le scénario n’en ayant que 6 cartes : avec la copie enregistrée des
// listes publiques (20 cartes sur ses sept jours, 40 insignes, et non 25), 164 Ko transférés sans les insignes, 182 avec
// (les insignes de l’appli ajoutent environ 18 à 21 Ko compressés, surtout les tracés de leurs lettres) ; seuil 185.
// Lighthouse au téléphone reste à 99-100 sur l’accueil réel.
// 30 octobre 2026, les insignes à l’impression : les affiches gagnent leurs insignes imprimés et la paire du
// prochain match d’un bar (affiche.css de 16 915 à 17 474 octets, ses commentaires raccourcis) : leur CSS mesure
// 107,22 Ko (109 797 octets), seuil de 106 à 107. Les pages générées mesurent 90,36 Ko (92 524 octets), l’accueil et les
// pages fixes 73,20 Ko (74 954 octets) : leurs seuils restent.
// 30 octobre 2026, la semaine pleine : celle de l’accueil réel de ce jour (tests/donnees/semaine-pleine.json : 25 matchs,
// 50 insignes, relus dans l’état enregistré du site), à la place de la copie des listes publiques (20 cartes). Mesurée :
// 186,09 Ko transférés (190 559 octets) : seuil 187.
const PAGES = [
  { nom: 'accueil', chemin: '/', budget: { requetes: 8, transfere: 170, js: 18, css: 73, images: 24 } },
  { nom: 'accueil, une semaine pleine (25 matchs)', chemin: '/', semainePleine: true, budget: { requetes: 8, transfere: 187, js: 18, css: 73, images: 24 } },
  { nom: 'page fixe (CGU)', chemin: '/cgu.html', budget: { requetes: 6, transfere: 143, js: 0, css: 73, images: 0 } },
  { nom: 'le guide (trouver un bar)', chemin: '/trouver-un-bar-qui-diffuse-le-match.html', budget: { requetes: 6, transfere: 143, js: 0, css: 73, images: 0 } },
  { nom: 'pour les bars', chemin: '/pour-les-bars.html', budget: { requetes: 8, transfere: 176, js: 67, css: 103, images: 4 } },
  { nom: '« Ce soir »', chemin: '/ce-soir/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'page de match', chemin: '/matchs/psg-ol-2026-10-25/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'page d’un club', chemin: '/matchs/club/psg/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'page d’une compétition', chemin: '/matchs/competition/ligue-1/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'page de ville', chemin: '/regarder-le-match/paris/', genere: true, budget: { requetes: 8, transfere: 150, js: 4, css: 90, images: 4 } },
  { nom: 'page de bar', chemin: '/bar/le-zinc-des-amis-paris-11/', genere: true, budget: { requetes: 9, transfere: 145, js: 4, css: 90, images: 6 } },
  { nom: 'page en anglais (Paris)', chemin: '/en/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'match en anglais', chemin: '/en/matches/psg-barca-2026-10-24/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: '« Ton club dans ton agenda »', chemin: '/agenda/', genere: true, budget: { requetes: 8, transfere: 145, js: 4, css: 90, images: 4 } },
  { nom: 'affiche de la semaine', chemin: '/matchs/affiche/', genere: true, budget: { requetes: 8, transfere: 150, js: 4, css: 107, images: 4 } },
  { nom: 'affiche d’un bar', chemin: '/bar/le-zinc-des-amis-paris-11/affiche/', genere: true, budget: { requetes: 8, transfere: 150, js: 4, css: 107, images: 4 } },
];
// /mesure.js : 6,7 Ko, 2,6 Ko compressé, une requête.
const AVEC_LA_MESURE = { requetes: 1, transfere: 3, js: 7 };
const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
const MESURES = [
  { nom: 'la mesure d’audience arrêtée', marque: { ...MARQUE, mesure: { ...MARQUE.mesure, code: '' } }, plus: {} },
  { nom: 'la mesure d’audience active', marque: { ...MARQUE, mesure: { ...MARQUE.mesure, outil: 'goatcounter', code: 'essai' } }, plus: AVEC_LA_MESURE },
];
// La seule police de ces pages : le cœur, celui que chaque page précharge.
const POLICES = ['/fonts/bricolage-grotesque.woff2'];
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
    // L’accueil d’une vraie semaine : les 25 matchs de l’accueil du vendredi 30 octobre 2026 (tests/donnees/semaine-pleine.json),
    // lus à 8 h à Paris ce jour-là.
    const plein = mkdtempSync(path.join(tmpdir(), 'budget-vitesse-'));
    sites.at(-1).plein = { dossier: plein };
    await construireLeSiteDExemple(plein, { source: `scenario:${SEMAINE_PLEINE}`, maintenant: Date.parse('2026-10-30T07:00:00Z'), rendu: null, marque });
    sites.at(-1).plein.serveur = await demarrerServeur(await portLibre(), -1, { dossier: plein });
  }
});
// Un même processus de test peut repasser par ce fichier (tests en parallèle : un second lot de ses tests, après un autre
// fichier) : beforeAll repart alors d’une liste vide, sinon sites[rang] serait encore un serveur arrêté par afterAll
// (« net::ERR_CONNECTION_REFUSED », vu une fois sous charge).
test.afterAll(async () => {
  for (const { dossier, serveur, plein } of sites) {
    await serveur?.arreter();
    rmSync(dossier, { recursive: true, force: true });
    await plein?.serveur?.arreter();
    if (plein) rmSync(plein.dossier, { recursive: true, force: true });
  }
  sites.length = 0;
});

test('la semaine pleine : 25 cartes sur ses sept jours, 50 insignes', () => {
  const accueil = readFileSync(path.join(sites[0].plein.dossier, 'index.html'), 'utf8');
  const bloc = accueil.split('<!-- semaine:debut -->')[1].split('<!-- semaine:fin -->')[0];
  expect((bloc.match(/<li class="carte-match/g) ?? []).length).toBe(25);
  expect((bloc.match(/<svg class="insignes"/g) ?? []).length * 2 + (bloc.match(/<svg class="insigne"/g) ?? []).length).toBe(50);
});

for (const [rang, { nom, marque, plus }] of MESURES.entries()) {
  for (const page of PAGES) {
    test(`${page.nom}, ${nom} : dans son budget sur un téléphone`, async ({ browser }) => {
      const origine = (page.semainePleine ? sites[rang].plein : sites[rang]).serveur.adresse;
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
      // Une seule police, le cœur, et rien d’un autre site : ni script, ni style, ni police, ni envoi de la mesure d’audience.
      expect(ressources.filter((r) => r.type === 'font').map((r) => new URL(r.adresse).pathname)).toEqual(POLICES);
      expect(ressources.filter((r) => new URL(r.adresse).origin !== origine).map((r) => r.adresse)).toEqual([]);
      expect(scriptsBloquants).toEqual([]);
    });
  }
}
