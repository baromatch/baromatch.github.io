// Les pages « Où regarder les matchs de … dans un bar » (generateur/suivre.mjs) : une par club et par compétition de
// contenu/suivre.json, faites des vraies données. Sur le scénario inventé (de vrais bars) et sur la copie enregistrée
// des listes publiques (aucun bar publié : la réalité d’aujourd’hui) :
// - indexable avec au moins 2 matchs à venir, noindex en dessous, et la page le dit ;
// - un titre qui ne promet un bar que si la page en montre un ;
// - seulement les vrais bars publiés, jamais une offre, jamais une chaîne ;
// - des titres, des descriptions et des h1 tous différents, et pas de pages presque identiques ;
// - la semaine, chaque page de match et le guide mènent à elles ; elles mènent aux matchs et à agenda/.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { CAPTURE, MAINTENANT_DE_LA_CAPTURE, MAINTENANT_DU_SCENARIO, SCENARIO, contenuDuScenario } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { texteVisible } from '../generateur/controle.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { CHEMIN_DU_GUIDE, TEXTES_SUIVRE, cheminDeLaCompetition, cheminDuClub } from '../generateur/suivre.mjs';

const CLUBS = Object.keys(TEXTES_SUIVRE.clubs);
const COMPETITIONS = Object.values(TEXTES_SUIVRE.competitions).map((c) => c.cle);
const CHEMINS = [...CLUBS.map(cheminDuClub), ...COMPETITIONS.map(cheminDeLaCompetition)];
// La typographie des pages : une espace insécable avant « : » (gabarits.mjs, insecables).
const fine = (texte) => texte.replace(/ ([?!:;»])/g, '\u00A0$1');
const robotsDe = (p) => p.contenu.match(/<meta name="robots" content="([^"]*)">/)[1];
const corps = (p) => texteVisible(`<body>${p.contenu.split('<main')[1].split('</main>')[0]}`);
const blocs = (p) => [...p.contenu.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph']);
// Ce que les données ne donnent pas : aucune page n’écrit de chaîne.
const CHAINES = /canal\s*\+|bein|dazn|prime video|amazon|ligue 1\+|tf1|m6|france ?2|france ?3|rmc|eurosport|la chaîne l’équipe|sky|w9/i;

let scenario;
let capture;
test.beforeAll(async () => {
  scenario = await construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: contenuDuScenario() });
  capture = await construireEnMemoire({ source: `capture:${CAPTURE}`, maintenant: MAINTENANT_DE_LA_CAPTURE, racine, contenu: chargerLeContenu(racine) });
});
const pageDe = (site, chemin) => {
  const trouvee = site.pages.find((p) => p.chemin === chemin);
  expect(trouvee, chemin).toBeTruthy();
  return trouvee;
};

test('une page par club et par compétition de la liste, et aucune autre', () => {
  for (const site of [scenario, capture]) {
    expect(site.pages.filter((p) => ['club', 'competition'].includes(p.type)).map((p) => p.chemin).sort()).toEqual([...CHEMINS].sort());
    expect(site.refusees.filter((p) => ['club', 'competition'].includes(p.type))).toEqual([]);
  }
});

test('un club avec des matchs à venir et de vrais bars : indexable, ses matchs vers leurs pages, ses bars vers les leurs', () => {
  const psg = pageDe(scenario, '/matchs/club/psg/');
  expect(psg.indexable).toBe(true);
  expect(robotsDe(psg)).toBe('max-image-preview:large');
  expect(psg.titre).toBe('Où regarder les matchs du PSG dans un bar — Baromatch');
  expect(psg.contenu).toContain('<h1 class="regarder-titre">Où regarder les matchs du PSG dans un bar</h1>');
  expect(psg.description).toBe('4 matchs du PSG au programme, à l’heure de Paris, et 3 bars qui en diffusent sur Baromatch. Le prochain : PSG – Barça, samedi 24 octobre à 21:00.');
  expect(psg.contenu).toContain('<a class="regarder-matchs__match" href="/matchs/psg-ol-2026-10-25/">PSG – OL</a>');
  expect(psg.contenu).toContain(fine('Le prochain : Paris Saint-Germain – FC Barcelona, samedi 24 octobre à 21:00, Ligue des champions, à domicile.'));
  // Les vrais bars publiés seulement, et jamais leur offre (loi Evin) : leur nom, leur adresse, leur prochain match.
  expect(psg.contenu).toContain('<a href="/bar/le-zinc-des-amis-paris-11/">Le Zinc des Amis</a>');
  expect(psg.barsNommes.sort()).toEqual(['b-comptoir', 'b-gones', 'b-zinc']);
  expect(psg.contenu).not.toMatch(/regarder-offre|démo|Rivoli/i);
  expect(psg.contenu).toContain('href="webcal://baromatch.fr/agenda/psg.ics"');
  expect(psg.contenu).toContain('<a href="/regarder-le-match/paris/">Où regarder le match à Paris</a>');
  expect(psg.contenu).toContain(`<a href="${CHEMIN_DU_GUIDE}">`);
  const types = blocs(psg).map((n) => n['@type']);
  expect(types).toEqual(['CollectionPage', 'BreadcrumbList', 'ItemList', 'ItemList']);
  expect(blocs(psg)[0].about).toEqual({ '@type': 'SportsTeam', name: 'Paris Saint-Germain', sport: 'Football' });
  // Aucun Event sur ces pages : les soirées sont décrites sur les pages des matchs et des bars.
  expect(psg.contenu).not.toContain('"Event"');
});

test('sans match à venir : la page reste, en noindex, et le dit', () => {
  const monaco = pageDe(scenario, '/matchs/club/monaco/');
  expect(monaco.indexable).toBe(false);
  expect(robotsDe(monaco)).toBe('noindex');
  expect(corps(monaco)).toContain('Pas de match au programme pour l’instant.');
  expect(corps(monaco)).toContain('Aucun bar ne diffuse encore un de ces matchs sur Baromatch.');
  const europa = pageDe(scenario, '/matchs/competition/ligue-europa/');
  expect(europa.indexable).toBe(false);
  // Un seul match à venir (Lille – Lens) : une page mince, en noindex.
  const lille = pageDe(scenario, '/matchs/club/lille/');
  expect(lille.indexable).toBe(false);
  expect(robotsDe(lille)).toBe('noindex');
  expect(lille.titre).toBe('Matchs de Lille : quand et où les regarder — Baromatch');
});

test('aujourd’hui, sans aucun bar publié : indexable avec des matchs à venir, sans rien promettre, titre compris', () => {
  for (const chemin of CHEMINS) {
    const p = pageDe(capture, chemin);
    expect(p.indexable, chemin).toBe(true);
    expect(`${p.titre} · ${p.contenu.match(/<h1[^>]*>([^<]*)/)[1]}`, chemin).not.toMatch(/(?<!\p{L})bars?(?!\p{L})|diffus/iu);
    // La page le dit une fois, juste sous sa tête, avant ses matchs : « En attendant les premiers bars », l’appel des
    // fans et une ligne pour les bars. Aucune ligne de match ne le répète, et la section des bars n’est pas là.
    expect(corps(p), chemin).toContain('En attendant les premiers bars Pas encore de bar sur Baromatch. Dès qu’un bar annonce un de ces matchs, il s’affiche ici. L’appli ouvre bientôt : préviens-moi');
    expect(p.contenu, chemin).toMatch(/<\/header>\n<section class="regarder-section regarder-premiers" aria-labelledby="titre-premiers">[\s\S]*?<\/section>\n<section class="regarder-section" aria-labelledby="titre-matchs">/);
    expect(corps(p).match(/Pas encore de bar/g), chemin).toHaveLength(1);
    expect(p.contenu, chemin).not.toContain('id="titre-bars"');
    // La description ne compte aucun bar, le chapeau ne promet pas de bars.
    expect(p.description, chemin).not.toMatch(/\d+ bars? qui/);
    expect(p.contenu.match(/<p class="regarder-chapeau">([^<]*)/)[1], chemin).not.toMatch(/bars/);
    expect(p.barsNommes, chemin).toEqual([]);
    expect(p.contenu, chemin).not.toContain('regarder-carte__nom');
  }
});

test('ni chaîne, ni score, ni offre : la page dit que Baromatch ne donne pas la chaîne', () => {
  for (const site of [scenario, capture]) {
    for (const chemin of CHEMINS) {
      const p = pageDe(site, chemin);
      expect(corps(p), chemin).not.toMatch(CHAINES);
      expect(corps(p), chemin).toContain('Baromatch ne dit pas sur quelle chaîne passe un match');
      expect(corps(p), chemin).not.toMatch(/\bscores?\b|L’offre du bar/i);
    }
  }
});

test('des titres, des descriptions et des h1 tous différents, aux bonnes longueurs, et pas de pages presque identiques', () => {
  for (const site of [scenario, capture]) {
    const pages = CHEMINS.map((c) => pageDe(site, c));
    for (const cle of ['titre', 'description']) expect(new Set(pages.map((p) => p[cle])).size, cle).toBe(pages.length);
    expect(new Set(pages.map((p) => p.contenu.match(/<h1[^>]*>([^<]*)/)[1])).size).toBe(pages.length);
    for (const p of pages) {
      expect(p.titre.length, p.chemin).toBeLessThanOrEqual(60);
      expect(p.description.length, p.chemin).toBeGreaterThanOrEqual(70);
      expect(p.description.length, p.chemin).toBeLessThanOrEqual(160);
    }
    // Deux pages indexables de la liste ne partagent pas plus de 60 % de leurs suites de cinq mots (le corps, sans
    // l’en-tête ni le pied du site) : le gabarit ne prend pas le pas sur les données.
    const suites = (p) => {
      const mots = corps(p).toLowerCase().split(/\s+/);
      return new Set(mots.slice(0, -4).map((_, i) => mots.slice(i, i + 5).join(' ')));
    };
    // Les pages indexables seulement : une page sans match à venir est en noindex, et presque vide exprès.
    const toutes = pages.filter((p) => p.indexable).map((p) => [p.chemin, suites(p)]);
    for (let i = 0; i < toutes.length; i += 1) {
      for (let j = i + 1; j < toutes.length; j += 1) {
        const [a, A] = toutes[i];
        const [b, B] = toutes[j];
        const communes = [...A].filter((s) => B.has(s)).length;
        expect(communes / (A.size + B.size - communes), `${a} et ${b}`).toBeLessThan(0.6);
      }
    }
  }
});

test('le maillage : la semaine et chaque page de match y mènent, le guide aussi', () => {
  const semaine = pageDe(scenario, '/matchs/');
  for (const chemin of CHEMINS) expect(semaine.contenu, chemin).toContain(`href="${chemin}"`);
  const match = pageDe(scenario, '/matchs/psg-ol-2026-10-25/');
  expect(match.contenu).toContain('<a href="/matchs/club/psg/">Les matchs du PSG et où les voir</a>');
  expect(match.contenu).toContain('<a href="/matchs/club/ol/">Les matchs de l’OL et où les voir</a>');
  expect(match.contenu).toContain('<a href="/matchs/competition/ligue-1/">Les matchs de la Ligue 1 et où les voir</a>');
  const guide = readFileSync(path.join(racine, CHEMIN_DU_GUIDE.slice(1)), 'utf8');
  for (const chemin of CHEMINS) expect(guide, chemin).toContain(`href="${chemin}"`);
  const competition = pageDe(scenario, '/matchs/competition/ligue-1/');
  expect(competition.contenu).toContain('<a class="regarder-matchs__match" href="/matchs/club/psg/">PSG</a> <span class="regarder-matchs__infos">3 matchs à venir en Ligue 1</span>');
  expect(competition.contenu).toContain(fine('Les coups d’envoi de ces matchs, à l’heure de Paris :'));
});
