// La page « Ce soir » (/ce-soir/), écrite par le générateur à chaque passage, sans navigateur : les matchs de ce soir à
// l’heure de Paris et, pour chacun, les vrais bars publiés qui le diffusent, avec leurs places seulement quand l’appli
// est ouverte et que les listes publiques les donnent. Indexable dès qu’un vrai bar publié est sur le site, même un soir
// sans bar (elle le dit, et montre les prochains soirs au bar) ; sans aucun vrai bar, noindex. Elle montre toujours les
// matchs du soir et les suivants, les villes et la liste d’attente : jamais vide, jamais un bar qu’elle n’a pas.
// Le scénario inventé (tests/donnees/scenario.json) et la copie réduite des listes publiques (tests/donnees/capture),
// lus à l’heure qu’on leur donne.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { contenuDuScenario, PUBLIES_DU_SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { construire } from '../generateur/construire.mjs';
import { estPermis } from '../generateur/etat.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { blocsDe, chargerLeVocabulaire, validerLaPage } from '../generateur/validateur.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
const CAPTURE = path.join(racine, 'tests', 'donnees', 'capture');
const CHEMIN = '/ce-soir/';
// Le vendredi 23 octobre 2026, 10 h à Paris : Brest – Nice à 20 h 45, diffusé par un vrai bar publié (Lyon).
const VENDREDI = '2026-10-23T08:00:00Z';
// L’enregistrement de la copie des listes publiques : le jeudi 15 octobre, 21 h 44 à Paris, aucun match ce soir-là.
const ENREGISTREMENT = '2026-10-15T19:44:29Z';
const contenu = contenuDuScenario();
const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
// Le contenu du dépôt tel quel : bars-publies.json est vide, aucun vrai bar n’est publié.
const sansBarPublie = chargerLeContenu(racine);

const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'ce-soir-'));
  dossiers.push(dossier);
  return dossier;
};
test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

// Le scénario retouché (des places, un match de plus…), écrit dans un dossier temporaire.
const scenarioModifie = (modifier) => {
  const fichier = path.join(dossierVide(), 'scenario.json');
  writeFileSync(fichier, JSON.stringify(modifier(JSON.parse(readFileSync(SCENARIO, 'utf8')))));
  return `scenario:${fichier}`;
};

const ceSoir = async ({ source = `scenario:${SCENARIO}`, maintenant = VENDREDI, avec = contenu } = {}) => {
  const site = await construireEnMemoire({ source, maintenant: Date.parse(maintenant), racine, contenu: avec });
  const p = site.pages.find((x) => x.chemin === CHEMIN);
  expect(p, `${CHEMIN} à ${maintenant}`).toBeTruthy();
  return { ...p, site };
};
const NOEUDS = (valeur) => (Array.isArray(valeur) ? valeur.flatMap(NOEUDS)
  : valeur && typeof valeur === 'object' ? [valeur, ...Object.values(valeur).flatMap(NOEUDS)] : []);
const deType = (p, type) => NOEUDS(blocsDe(p.contenu).flatMap((bloc) => bloc['@graph'])).filter((n) => [].concat(n['@type'] ?? []).includes(type));
const robotsDe = (p) => p.contenu.match(/<meta name="robots" content="([^"]*)">/)[1];
const titreDe = (p) => p.contenu.match(/<title>([^<]*)<\/title>/)[1];
const sectionDe = (p, id) => {
  const debut = p.contenu.indexOf(`id="${id}"`);
  expect(debut, `section #${id}`).toBeGreaterThan(-1);
  return p.contenu.slice(debut, p.contenu.indexOf('</section>', debut));
};
const vocabulaire = chargerLeVocabulaire();
const sansErreur = (p) => {
  expect(controlerLaPage(p), p.chemin).toEqual([]);
  expect(validerLaPage(vocabulaire, p.contenu), p.chemin).toEqual([]);
};

test('un soir avec un vrai bar publié : indexable, le match, le bar, la date entière dans le titre', async () => {
  const p = await ceSoir();
  sansErreur(p);
  expect(p.indexable).toBe(true);
  expect(robotsDe(p)).toBe('max-image-preview:large');
  // Le titre dit le jour : sans la marque quand le jour est long (60 caractères au plus).
  expect(titreDe(p)).toBe('Où regarder le match ce soir, vendredi 23 octobre');
  expect(p.contenu).toContain('<h1 class="regarder-titre">Où regarder le match ce soir</h1>');
  expect(p.contenu).toContain('<p class="regarder-quand">Vendredi 23 octobre</p>');
  expect(p.contenu).toContain(`<p class="regarder-chapeau">${contenu.textes.ceSoir.chapeau}</p>`);
  // Avant 17 h, « Aujourd’hui » ; le match, son heure, sa compétition, ses bars par ville, puis la carte du bar.
  const bars = sectionDe(p, 'titre-bars');
  expect(bars).toMatch(/^id="titre-bars">Aujourd’hui, dans un bar<\/h2>/);
  expect(bars).toContain('<h3 class="regarder-soir__match"><a href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a></h3>');
  expect(bars).toContain('<p class="regarder-soir__quand"><time datetime="2026-10-23T20:45:00+02:00">20:45</time> · Ligue 1 · 1 bar à Lyon</p>');
  expect(bars).toContain('<h4 class="regarder-carte__nom"><a href="/bar/la-cave-des-gones-lyon-2/">La Cave des Gones</a></h4>');
  expect(bars).toContain('<p class="regarder-carte__lieu">Lyon 2e · 8 Rue Mercière, 69002 Lyon</p>');
  // La description dit le jour, le nombre de vrais bars et leur ville.
  expect(p.description).toBe('Vendredi 23 octobre : 1 bar diffuse un match aujourd’hui sur Baromatch, à Lyon. Les adresses et l’heure du coup d’envoi, à l’heure de Paris.');
  // Jamais un faux bar : ni le bar de démo, ni un bar d’essai, même dans la liste des bars publiés du scénario.
  expect(p.contenu).not.toMatch(/démo|TestBar|Testament/i);
  // Les prochains matchs, vers leur page, avec leurs vrais bars.
  const prochains = sectionDe(p, 'titre-prochains');
  expect(prochains).toContain('<h3 class="regarder-jour">Samedi 24 octobre</h3>\n  <ul class="regarder-matchs">\n    <li><a class="regarder-matchs__match" href="/matchs/psg-barca-2026-10-24/">PSG – Barça</a> <span class="regarder-matchs__infos"><time datetime="2026-10-24T21:00:00+02:00">21:00</time> · Ligue des champions · <span class="regarder-compte"><a href="/regarder-le-match/paris/">2 bars à Paris</a></span></span></li>');
  expect(prochains).not.toContain('Brest');
  expect(prochains).toContain('<a href="/matchs/">Tous les matchs de la semaine</a>');
});

test('les données structurées : la page, son fil, la liste des matchs de ce soir vers leurs pages ; aucun évènement, aucune offre', async () => {
  const p = await ceSoir();
  const [page] = deType(p, 'CollectionPage');
  expect(page).toMatchObject({ '@id': 'https://baromatch.fr/ce-soir/', url: 'https://baromatch.fr/ce-soir/', name: 'Où regarder le match ce soir, vendredi 23 octobre', inLanguage: 'fr-FR', publisher: { '@id': 'https://baromatch.fr/#organisation' } });
  expect(deType(p, 'BreadcrumbList')[0].itemListElement).toEqual([
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://baromatch.fr/' },
    { '@type': 'ListItem', position: 2, name: 'Ce soir', item: 'https://baromatch.fr/ce-soir/' },
  ]);
  expect(deType(p, 'ItemList')).toEqual([{
    '@type': 'ItemList', name: 'Les matchs d’aujourd’hui', numberOfItems: 1,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Brest – Nice', url: 'https://baromatch.fr/matchs/brest-nice-2026-10-23/' }],
  }]);
  // Les soirées (Event) restent sur les pages des matchs et des bars : une page de liste n’en répète aucune.
  expect(deType(p, 'Event')).toEqual([]);
  expect(deType(p, 'SportsEvent')).toEqual([]);
  expect(p.contenu.split('<body>')[0]).not.toMatch(/Pinte|Menu burger|offre/i);
});

test('un jour sans vrai bar : noindex, les matchs du jour et les suivants vers leurs pages, les villes, la liste d’attente', async () => {
  const p = await ceSoir({ avec: sansBarPublie });
  sansErreur(p);
  expect(p.indexable).toBe(false);
  expect(robotsDe(p)).toBe('noindex');
  expect(p.contenu).not.toContain('id="titre-bars"');
  const matchs = sectionDe(p, 'titre-matchs');
  expect(matchs).toMatch(/^id="titre-matchs">Les matchs d’aujourd’hui<\/h2>/);
  expect(matchs).toContain('Pas encore de bar sur Baromatch pour les matchs d’aujourd’hui.');
  expect(matchs).toContain('<a class="regarder-matchs__match" href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a> <span class="regarder-matchs__infos"><time datetime="2026-10-23T20:45:00+02:00">20:45</time> · Ligue 1 · <span class="regarder-compte">Pas encore de bar</span></span>');
  expect(matchs).toContain('<a href="/pour-les-bars.html">Tu tiens un bar');
  expect(sectionDe(p, 'titre-prochains')).toContain('<a class="regarder-matchs__match" href="/matchs/psg-barca-2026-10-24/">PSG – Barça</a>');
  // Les villes, chacune vers sa page ; la liste d’attente tant que l’appli n’est pas ouverte.
  const villes = sectionDe(p, 'titre-villes');
  for (const ville of ['paris', 'lyon', 'marseille', 'lille']) expect(villes).toContain(`<a class="regarder-matchs__match" href="/regarder-le-match/${ville}/">`);
  expect(p.contenu).toContain('<a class="capsule" href="/#attente">');
  expect(p.description).toBe('Vendredi 23 octobre : 1 match aujourd’hui, à l’heure de Paris. Pas encore de bar pour le voir sur Baromatch : les prochains matchs et les villes.');
  // Le chapeau ne promet pas les bars de chaque match : aucun ne les diffuse.
  expect(p.contenu).toContain(`<p class="regarder-chapeau">${sansBarPublie.textes.ceSoir.chapeauSansBar}</p>`);
  expect(texteVisible(p.contenu.split('</header>')[0])).not.toMatch(/les bars qui l(?:e|es) diffusen?t/);
  // Ni bar, ni place, ni réservation : rien que la page ne puisse tenir.
  expect(p.contenu).not.toMatch(/Cave des Gones|Zinc|Comptoir|BarOrPub|regarder-carte__nom/);
  expect(texteVisible(p.contenu)).not.toMatch(/places|réserv/i);
  // L’ItemList : les matchs du jour, vers leurs pages.
  expect(deType(p, 'ItemList')[0].itemListElement.map((i) => i.url)).toEqual(['https://baromatch.fr/matchs/brest-nice-2026-10-23/']);
});

test('un soir sans bar, avec des vrais bars publiés : indexable, elle le dit, et montre les prochains soirs au bar', async () => {
  // La Cave des Gones, seul bar de Brest – Nice, n’est pas publiée : ce soir, aucun bar ; les autres vrais bars le sont.
  const p = await ceSoir({ avec: { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-gones') } });
  sansErreur(p);
  expect(p.indexable).toBe(true);
  expect(robotsDe(p)).toBe('max-image-preview:large');
  // Ce soir : le match du jour, et « pas encore de bar », en clair ; aucune carte de bar.
  expect(p.contenu).not.toContain('id="titre-bars"');
  expect(p.contenu).not.toContain('regarder-carte__nom');
  const matchs = sectionDe(p, 'titre-matchs');
  expect(matchs).toContain('Pas encore de bar sur Baromatch pour les matchs d’aujourd’hui.');
  expect(matchs).toContain('<a class="regarder-matchs__match" href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a> <span class="regarder-matchs__infos"><time datetime="2026-10-23T20:45:00+02:00">20:45</time> · Ligue 1 · <span class="regarder-compte">Pas encore de bar</span></span>');
  // Les trois prochains soirs qu’un vrai bar a annoncés : le jour, le match vers sa page, chaque bar vers sa soirée, dans
  // l’ordre annoncé (ville, arrondissement, nom).
  const soirs = sectionDe(p, 'titre-soirs');
  expect(soirs).toMatch(/^id="titre-soirs">Les prochains soirs au bar<\/h2>/);
  expect([...soirs.matchAll(/<h3 class="regarder-jour">([^<]+)<\/h3>/g)].map((m) => m[1])).toEqual(['Samedi 24 octobre', 'Dimanche 25 octobre', 'Vendredi 30 octobre']);
  expect(soirs).toContain('<li><a class="regarder-matchs__match" href="/matchs/psg-barca-2026-10-24/">PSG – Barça</a> <span class="regarder-matchs__infos"><time datetime="2026-10-24T21:00:00+02:00">21:00</time> · Ligue des champions · <a href="/bar/le-comptoir-du-canal-paris-10/#soiree-psg-barca-2026-10-24">Le Comptoir du Canal</a> (Paris 10e), <a href="/bar/le-zinc-des-amis-paris-11/#soiree-psg-barca-2026-10-24">Le Zinc des Amis</a> (Paris 11e)</span></li>');
  expect(soirs).toContain('<li><a class="regarder-matchs__match" href="/matchs/psg-ol-2026-10-25/">PSG – OL</a> <span class="regarder-matchs__infos"><time datetime="2026-10-25T20:45:00+01:00">20:45</time> · Ligue 1 · <a href="/bar/le-zinc-des-amis-paris-11/#soiree-psg-ol-2026-10-25">Le Zinc des Amis</a> (Paris 11e)</span></li>');
  expect(soirs).toContain('<a href="/bar/le-comptoir-du-canal-paris-10/#soiree-le-havre-psg-2026-10-30">Le Comptoir du Canal</a> (Paris 10e)</span></li>');
  expect(soirs).not.toContain('Cave des Gones');
  // Ces bars, la page les nomme : l’état le saura (une version refusée ne garde pas un bar retiré).
  expect(p.barsNommes).toEqual(['b-comptoir', 'b-rennes', 'b-zinc']);
  // La description et le chapeau ne promettent que ce qu’elle montre.
  expect(p.description).toBe('Vendredi 23 octobre : 1 match aujourd’hui, à l’heure de Paris. Pas encore de bar pour le voir sur Baromatch : les prochains soirs au bar, et les villes.');
  expect(p.contenu).toContain(`<p class="regarder-chapeau">${contenu.textes.ceSoir.chapeauProchainsSoirs}</p>`);
  // Au-delà de cinq bars pour un match, leur nombre, vers la page du match ; les bars nommés seulement dans l’état.
  const source = scenarioModifie((brut) => ({
    ...brut,
    matchNights: [...brut.matchNights.filter((n) => n.id !== 'n-gones-ce-soir'), ...['b-gones', 'b-coin', 'b-rennes', 'b-t1'].map((bar) => ({ id: `n-${bar}-barca`, status: 'OPEN', bar: { id: bar }, match: { id: 'm-psg-barca-fr' }, offer: null }))],
  }));
  const nombreux = await ceSoir({ source, avec: { ...contenu, forcer: ['b-t1'] } });
  sansErreur(nombreux);
  const barca = sectionDe(nombreux, 'titre-soirs').split('\n').find((ligne) => ligne.includes('PSG – Barça'));
  expect((barca.match(/<a href="\/bar\//g) ?? []).length).toBe(5);
  expect(barca).toMatch(/\) <a href="\/matchs\/psg-barca-2026-10-24\/">et 1 autre bar<\/a><\/span><\/li>$/);
  const lies = new Set([...sectionDe(nombreux, 'titre-soirs').matchAll(/<a href="\/bar\/([^/]+)\//g)].map((m) => m[1]));
  expect(nombreux.barsNommes).toHaveLength(lies.size);
});

test('la copie des listes publiques, un samedi soir : le bar de démo n’est jamais un bar, noindex, les matchs pas finis', async () => {
  // Samedi 17 octobre, 18 h à Paris : Strasbourg – PSG (17 h 15) se joue encore, Everton – Chelsea (13 h 30) est fini.
  const p = await ceSoir({ source: `capture:${CAPTURE}`, maintenant: '2026-10-17T16:00:00Z' });
  sansErreur(p);
  expect(p.indexable).toBe(false);
  expect(p.contenu).not.toMatch(/démo|Exemple/i);
  const matchs = sectionDe(p, 'titre-matchs');
  expect(matchs).toMatch(/^id="titre-matchs">Les matchs de ce soir<\/h2>/);
  expect(matchs).toContain('Strasbourg – PSG</a> <span class="regarder-matchs__infos">Commencé à <time datetime="2026-10-17T17:15:00+02:00">17:15</time>');
  expect(matchs).toContain('Lille – Brest</a> <span class="regarder-matchs__infos"><time datetime="2026-10-17T20:45:00+02:00">20:45</time>');
  expect(matchs).not.toContain('Everton');
  expect(matchs).not.toContain('Espanyol');
});

test('un match fini n’est plus listé ; il l’est encore tant qu’il peut se jouer (trois heures, prolongations comprises)', async () => {
  // 23 h 44 : Brest – Nice (20 h 45) se joue peut-être encore, en prolongations.
  const encore = await ceSoir({ maintenant: '2026-10-23T21:44:00Z' });
  sansErreur(encore);
  expect(encore.indexable).toBe(true);
  expect(sectionDe(encore, 'titre-bars')).toMatch(/^id="titre-bars">Ce soir, dans un bar<\/h2>/);
  expect(sectionDe(encore, 'titre-bars')).toContain('Commencé à <time datetime="2026-10-23T20:45:00+02:00">20:45</time> · Ligue 1');
  // 23 h 46 : fini. La page le dit, ne montre plus de bar pour ce soir, et reste indexable (des vrais bars sont publiés) ;
  // dessous, les prochains soirs au bar, puis la suite.
  const fini = await ceSoir({ maintenant: '2026-10-23T21:46:00Z' });
  sansErreur(fini);
  expect(fini.indexable).toBe(true);
  expect(fini.contenu).not.toContain('Brest – Nice</a>');
  expect(fini.contenu).not.toContain('regarder-carte__nom');
  expect(sectionDe(fini, 'titre-rien')).toMatch(/^id="titre-rien">Fini pour ce soir<\/h2>\n {2}<p>Les matchs de ce soir sont terminés. Les prochains sont juste en dessous.<\/p>/);
  expect(sectionDe(fini, 'titre-soirs')).toContain('<h3 class="regarder-jour">Samedi 24 octobre</h3>');
  expect(sectionDe(fini, 'titre-prochains')).toContain('PSG – Barça');
  // OM – Lens, la veille, n’y est jamais.
  for (const p of [encore, fini]) expect(p.contenu).not.toContain('OM – Lens');
});

test('la nuit : après minuit, la page passe au nouveau jour ; un match commencé la veille reste tant qu’il se joue', async () => {
  // Un match de plus, le vendredi à 23 h 30 à Paris, diffusé par un vrai bar.
  const source = scenarioModifie((brut) => ({
    ...brut,
    matches: [...brut.matches, { id: 'm-tard', startAt: '2026-10-23T21:30:00.000Z', league: 'Ligue 1', homeTeam: 'FC Nantes', awayTeam: 'Stade Rennais FC', homeClub: { slug: 'fc-nantes', canonicalName: 'FC Nantes' }, awayClub: { slug: 'stade-rennais-fc', canonicalName: 'Stade Rennais FC' } }],
    matchNights: [...brut.matchNights, { id: 'n-zinc-tard', status: 'OPEN', bar: { id: 'b-zinc' }, match: { id: 'm-tard' }, offer: null }],
  }));
  // Samedi, 1 h 15 à Paris (le passage d’après minuit) : le samedi, et le match de 23 h 30 qui se joue encore.
  const nuit = await ceSoir({ source, maintenant: '2026-10-23T23:15:00Z' });
  sansErreur(nuit);
  expect(titreDe(nuit)).toBe('Où regarder le match ce soir, samedi 24 octobre — Baromatch');
  expect(nuit.contenu).toContain('<p class="regarder-quand">Samedi 24 octobre</p>');
  const bars = sectionDe(nuit, 'titre-bars');
  expect(bars).toMatch(/^id="titre-bars">Aujourd’hui, dans un bar<\/h2>/);
  expect(bars).toContain('Commencé le <time datetime="2026-10-23T23:30:00+02:00">vendredi 23 octobre · 23:30</time>');
  expect(bars).toContain('/bar/le-zinc-des-amis-paris-11/');
  // Le match du samedi soir, avec ses deux vrais bars, après celui qui se joue encore.
  expect(bars.indexOf('Nantes')).toBeLessThan(bars.indexOf('PSG – Barça'));
  expect(bars).toContain('/bar/le-comptoir-du-canal-paris-10/');
  expect(nuit.contenu).not.toContain('Brest – Nice');
  expect(nuit.indexable).toBe(true);
  // Samedi, 0 h 05 à Paris (le passage de l’Action juste après minuit, 22 h 05 UTC en heure d’été) : déjà le samedi, sa
  // date entière dans le titre et sous lui, et le match de 23 h 30 qui se joue encore.
  const minuit = await ceSoir({ source, maintenant: '2026-10-23T22:05:00Z' });
  sansErreur(minuit);
  expect(titreDe(minuit)).toBe('Où regarder le match ce soir, samedi 24 octobre — Baromatch');
  expect(minuit.contenu).toContain('<p class="regarder-quand">Samedi 24 octobre</p>');
  expect(minuit.description).toMatch(/^Samedi 24 octobre : /);
  expect(sectionDe(minuit, 'titre-bars')).toContain('Commencé le <time datetime="2026-10-23T23:30:00+02:00">vendredi 23 octobre · 23:30</time>');
  // Samedi, 2 h 31 : le match de la veille est fini, il n’est plus listé.
  const tard = await ceSoir({ source, maintenant: '2026-10-24T00:31:00Z' });
  sansErreur(tard);
  expect(tard.contenu).not.toContain('Nantes');
  expect(sectionDe(tard, 'titre-bars')).toContain('PSG – Barça');
});

test('un match de ce soir reporté ou annulé : listé avec son statut, sans ses bars ; la page dit les prochains soirs au bar', async () => {
  const source = scenarioModifie((brut) => ({
    ...brut,
    matches: brut.matches.map((m) => (m.id === 'm-ce-soir' ? { ...m, status: 'POSTPONED' } : m)),
  }));
  const p = await ceSoir({ source });
  sansErreur(p);
  // Indexable : des vrais bars sont publiés, même si aucun ne montre un match ce soir.
  expect(p.indexable).toBe(true);
  expect(p.contenu).not.toContain('id="titre-bars"');
  expect(sectionDe(p, 'titre-soirs')).toContain('/bar/le-zinc-des-amis-paris-11/#soiree-psg-barca-2026-10-24');
  const matchs = sectionDe(p, 'titre-matchs');
  expect(matchs).toContain('<a class="regarder-matchs__match" href="/matchs/brest-nice-2026-10-23/">Brest – Nice</a> <span class="regarder-matchs__infos"><time datetime="2026-10-23T20:45:00+02:00">20:45</time> · Ligue 1 · <strong>Match reporté</strong></span>');
  expect(matchs).not.toContain('Cave des Gones');
  expect(sectionDe(p, 'titre-soirs')).not.toContain('brest-nice');
  // Le bar l’annonçait : la page ne dit pas qu’il n’y a « pas encore de bar ».
  expect(matchs).not.toContain('Pas encore de bar');
  expect(matchs).not.toContain('Tu tiens un bar');
  // Les prochains matchs ont de vrais bars (PSG – Barça, PSG – OL) : la description et le chapeau le disent.
  expect(p.description).toBe('Vendredi 23 octobre : 1 match aujourd’hui, à l’heure de Paris. Les prochains matchs et les bars qui les diffusent sur Baromatch.');
  expect(p.contenu).toContain(`<p class="regarder-chapeau">${contenu.textes.ceSoir.chapeauProchainsSoirs}</p>`);
});

test('un jour sans aucun match : une page utile (les prochains matchs, les villes, la liste d’attente), noindex', async () => {
  const p = await ceSoir({ source: `capture:${CAPTURE}`, maintenant: ENREGISTREMENT });
  sansErreur(p);
  expect(p.indexable).toBe(false);
  expect(titreDe(p)).toBe('Où regarder le match ce soir, jeudi 15 octobre — Baromatch');
  expect(sectionDe(p, 'titre-rien')).toMatch(/^id="titre-rien">Pas de match ce soir<\/h2>/);
  const prochains = sectionDe(p, 'titre-prochains');
  expect(prochains).toContain('<h3 class="regarder-jour">Vendredi 16 octobre</h3>\n  <ul class="regarder-matchs">\n    <li><a class="regarder-matchs__match" href="/matchs/le-mans-toulouse-2026-10-16/">Le Mans – Toulouse</a> <span class="regarder-matchs__infos"><time datetime="2026-10-16T20:45:00+02:00">20:45</time>');
  expect((prochains.match(/<li>/g) ?? []).length).toBe(8);
  expect(sectionDe(p, 'titre-villes')).toContain('<a class="regarder-matchs__match" href="/regarder-le-match/paris/">');
  expect(p.contenu).toContain('<a class="capsule" href="/#attente">');
  // Aucun vrai bar : ni la description ni le chapeau ne parlent des bars qui diffusent les prochains matchs.
  expect(p.description).toBe('Jeudi 15 octobre : pas de match annoncé ce soir. Les prochains, à l’heure de Paris, et les villes, sur Baromatch.');
  expect(p.contenu).toContain(`<p class="regarder-chapeau">${contenu.textes.ceSoir.chapeauSansBar}</p>`);
  // Rien n’annonce ce soir : l’ItemList suit les prochains matchs, vers leurs pages.
  const [liste] = deType(p, 'ItemList');
  expect(liste.name).toBe('Les prochains matchs');
  expect(liste.itemListElement).toHaveLength(8);
});

test('les places : seulement l’appli ouverte, quand les listes les donnent, à l’heure du passage ; jamais un nombre inventé', async () => {
  const nuitsDe = (brut) => brut.matchNights.map((n) => (n.id === 'n-gones-ce-soir'
    ? { ...n, status: 'OPEN', remainingPlatformSeats: 12, isSoldOut: false, reservationsOpen: true } : n));
  const source = scenarioModifie((brut) => ({
    ...brut,
    matchNights: [
      ...nuitsDe(brut),
      { id: 'n-zinc-brest', status: 'OPEN', bar: { id: 'b-zinc' }, match: { id: 'm-ce-soir' }, offer: null, remainingPlatformSeats: 0, isSoldOut: true, reservationsOpen: false },
      { id: 'n-comptoir-brest', status: 'OPEN', bar: { id: 'b-comptoir' }, match: { id: 'm-ce-soir' }, offer: null },
      { id: 'n-coin-brest', status: 'OPEN', bar: { id: 'b-coin' }, match: { id: 'm-ce-soir' }, offer: null, remainingPlatformSeats: 1, isSoldOut: false, reservationsOpen: true },
      { id: 'n-rennes-brest', status: 'CLOSED', bar: { id: 'b-rennes' }, match: { id: 'm-ce-soir' }, offer: null, remainingPlatformSeats: 9, isSoldOut: false, reservationsOpen: false },
    ],
  }));
  const carte = (p, nom) => {
    const debut = p.contenu.indexOf(`>${nom}</a></h4>`);
    expect(debut, nom).toBeGreaterThan(-1);
    return p.contenu.slice(debut, p.contenu.indexOf('</li>', debut));
  };
  const p = await ceSoir({ source, avec: ouverte, maintenant: '2026-10-23T17:17:00Z' });
  sansErreur(p);
  expect(carte(p, 'La Cave des Gones')).toContain('<p class="regarder-carte__places">À 19:17, 12 places à réserver dans l’appli.</p>');
  expect(carte(p, 'Au Bon Coin')).toContain('<p class="regarder-carte__places">À 19:17, 1 place à réserver dans l’appli.</p>');
  expect(carte(p, 'Le Zinc des Amis')).toContain('<p class="regarder-carte__places">À 19:17, plus de place à réserver dans l’appli.</p>');
  // Rien dans les listes, ou une soirée fermée par le bar : la carte ne dit rien des places.
  expect(carte(p, 'Le Comptoir du Canal')).not.toContain('regarder-carte__places');
  expect(carte(p, 'Le Café des Sports')).not.toContain('regarder-carte__places');
  // Aucun nombre dans la tête de la page ni dans ses données structurées : il change d’un passage à l’autre.
  expect(p.contenu.split('<body>')[0]).not.toMatch(/places? à réserver|\b12 places\b/);
  // L’appli fermée : aucun nombre, même donné par les listes.
  const fermee = await ceSoir({ source, maintenant: '2026-10-23T17:17:00Z' });
  expect(fermee.contenu).not.toContain('regarder-carte__places');
  expect(texteVisible(fermee.contenu)).not.toMatch(/places|réserv/i);
  // Le match commencé : on ne réserve plus, la carte n’en parle plus.
  const commence = await ceSoir({ source, avec: ouverte, maintenant: '2026-10-23T19:17:00Z' });
  expect(commence.contenu).not.toContain('regarder-carte__places');
});

test('écrite : dans la liste blanche, au plan du site et à IndexNow seulement indexable, et sortie quand elle ne l’est plus', async () => {
  for (const permis of ['ce-soir/index.html', 'ce-soir/partage.png']) expect(estPermis(permis), permis).toBe(true);
  for (const refuse of ['ce-soir/autre.html', 'ce-soir/x/index.html', 'ce-soir/badge.svg', 'ce-soir/../index.html', 'ce-soir/x/partage.png']) expect(estPermis(refuse), refuse).toBe(false);
  const sortie = dossierVide();
  const passer = (maintenant, avec) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu: avec });
  const plan = () => readFileSync(path.join(sortie, 'sitemap.xml'), 'utf8');
  const adresse = 'https://baromatch.fr/ce-soir/';
  const indexable = await passer(VENDREDI, contenu);
  expect(existsSync(path.join(sortie, 'ce-soir', 'index.html'))).toBe(true);
  expect(plan()).toContain(`<url><loc>${adresse}</loc><lastmod>2026-10-23</lastmod></url>`);
  expect(indexable.changees).toContain(adresse);
  expect(indexable.etat.pages[CHEMIN]).toMatchObject({ type: 'ce-soir', indexable: true, change: '2026-10-23' });
  // Le même soir, rien n’a changé : ni nouvelle date, ni IndexNow.
  const pareil = await passer('2026-10-23T08:30:00Z', contenu);
  expect(pareil.changees).not.toContain(adresse);
  // Plus aucun vrai bar : la page passe en noindex, sort du plan du site, et IndexNow est prévenu.
  const sans = await passer('2026-10-23T09:00:00Z', { ...contenu, publies: [] });
  expect(plan()).not.toContain(adresse);
  expect(plan().match(/<loc>/g).length).toBe(plan().match(/<url>/g).length);
  expect(sans.changees).toContain(adresse);
  expect(readFileSync(path.join(sortie, 'ce-soir', 'index.html'), 'utf8')).toContain('<meta name="robots" content="noindex">');
  // Revenue, elle n’est écrite qu’une fois dans le plan du site.
  await passer('2026-10-23T09:30:00Z', contenu);
  expect(plan().split(adresse).length - 1).toBe(1);
});

test('les liens vers « Ce soir » : depuis l’accueil, la semaine et chaque page de ville', async () => {
  const { site } = await ceSoir();
  const lien = '<a href="/ce-soir/">Où regarder le match ce soir</a>';
  expect(site.pages.find((x) => x.chemin === '/matchs/').contenu).toContain(lien);
  const villes = site.pages.filter((x) => x.type === 'ville');
  expect(villes.length).toBeGreaterThan(3);
  for (const ville of villes) expect(ville.contenu, ville.chemin).toContain(lien);
  // L’accueil : sous « Comment ça va marcher », un lien seul (le fichier existe : tests/liens.spec.mjs le suit).
  expect(readFileSync(path.join(racine, 'index.html'), 'utf8')).toContain('<p class="soiree__suite"><a href="/ce-soir/">Où regarder le match ce soir</a></p>');
});
