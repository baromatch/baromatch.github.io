// Les affiches à imprimer (generateur/affiche.mjs, affiche.css) : un seul moteur, deux entrées.
// - L’affiche de la semaine (/matchs/affiche/), pour tous les bars : les matchs des sept jours de /matchs/, sans les
//   reportés ni les annulés ; on coche, on imprime ; aucun formulaire, aucun champ de texte, rien ne part ailleurs que
//   sur le site. Indexable même sans aucun vrai bar publié : c’est un outil, pas une liste de bars (l’exception validée
//   par le lead, vérifiée ici) ; mais en noindex avec moins de 3 matchs à montrer.
// - L’affiche d’un bar publié (/bar/<bar>/affiche/) : sa prochaine soirée, ses autres soirées de la semaine, un QR code
//   vers sa page ; noindex ; jamais pour un bar qui n’est pas publié, et effacée quand il ne l’est plus.
// À l’impression : seulement la feuille, seulement les lignes cochées (toutes si rien n’est coché), une seule page en A4
// comme en A3 avec 14 matchs. Le QR code : comparé à une matrice de référence fixe, puis lu par un décodeur
// indépendant (jsQR) sur la matrice et sur la capture de la page.
// Le scénario inventé (tests/donnees/scenario.json), complété ici de matchs pour remplir la semaine (dont un reporté,
// un annulé et une heure provisoire), lu à l’heure du vendredi 23 octobre 2026, 10 h à Paris.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jsQR from 'jsqr';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, PUBLIES_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { MOTS_INTERDITS } from '../generateur/donnees.mjs';
import { estPermis, fichierDuChemin } from '../generateur/etat.mjs';
import { baliseDeLaMesure, mesureDuSite } from '../generateur/mesure.mjs';
import { chargerLeQr, MARGE_DU_QR, svgDuQr } from '../generateur/qr.mjs';
import { chargerLeVocabulaire, validerLaPage } from '../generateur/validateur.mjs';

const OUVERTE = '/matchs/affiche/';
const ZINC = '/bar/le-zinc-des-amis-paris-11/';
const AFFICHE_DU_ZINC = `${ZINC}affiche/`;
const { qr } = chargerLeQr();
const contenu = contenuDuScenario();
// Le contenu du dépôt tel quel : bars-publies.json est vide, aucun vrai bar n’est publié.
const sansBarPublie = chargerLeContenu(racine);
const vocabulaire = chargerLeVocabulaire();

// La semaine du scénario, remplie : 15 matchs jouables du vendredi 23 au jeudi 29, un reporté, un annulé (hors de
// l’affiche), une heure provisoire, des noms longs.
const AJOUTS = [
  ['m-ars-che', '2026-10-23T17:00:00Z', 'Premier League', 'Arsenal FC', 'Chelsea FC'],
  ['m-ren-nan', '2026-10-24T13:30:00Z', 'Ligue 1', 'Stade Rennais FC', 'FC Nantes'],
  ['m-str-tou', '2026-10-24T15:00:00Z', 'Ligue 1', 'RC Strasbourg Alsace', 'Toulouse FC'],
  ['m-mon-bre', '2026-10-25T15:00:00Z', 'Ligue 1', 'AS Monaco', 'Stade Brestois 29'],
  ['m-liv-mci', '2026-10-26T20:00:00Z', 'Premier League', 'Liverpool FC', 'Manchester City'],
  ['m-lor-met', '2026-10-27T18:45:00Z', 'Coupe de France', 'FC Lorient', 'FC Metz'],
  ['m-atl-rso', '2026-10-27T20:00:00Z', 'UEFA Europa League', 'Atlético de Madrid', 'Real Sociedad'],
  ['m-pfc-ang', '2026-10-28T17:30:00Z', 'Ligue 1', 'Paris FC', 'Angers SCO', { heureProvisoire: true }],
  ['m-rma-juv', '2026-10-29T20:00:00Z', 'UEFA Champions League', 'Real Madrid', 'Juventus'],
  ['m-nice-lens', '2026-10-27T19:00:00Z', 'Ligue 1', 'OGC Nice', 'RC Lens', { status: 'POSTPONED' }],
  ['m-toulouse-metz', '2026-10-28T19:00:00Z', 'Ligue 1', 'Toulouse FC', 'FC Metz', { status: 'CANCELLED' }],
];
const scenarioCharge = () => {
  const s = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  for (const [id, startAt, league, homeTeam, awayTeam, plus = {}] of AJOUTS) s.matches.push({ id, startAt, league, homeTeam, awayTeam, ...plus });
  return s;
};

const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'affiche-'));
  dossiers.push(dossier);
  return dossier;
};
const ecrireLeScenario = (scenario) => {
  const fichier = path.join(dossierVide(), 'scenario.json');
  writeFileSync(fichier, JSON.stringify(scenario));
  return `scenario:${fichier}`;
};
// Écrit à la demande : les dossiers temporaires partent après les tests d’un passage du fichier dans un processus, et
// un passage suivant dans le même processus réécrit le scénario.
let scenarioEcrit = null;
const sourceChargee = () => {
  if (!scenarioEcrit || !existsSync(scenarioEcrit.slice('scenario:'.length))) scenarioEcrit = ecrireLeScenario(scenarioCharge());
  return scenarioEcrit;
};

const enMemoire = ({ source = sourceChargee(), maintenant = MAINTENANT_DU_SCENARIO, avec = contenu, encodeur = qr } = {}) => construireEnMemoire({
  source, maintenant, racine, contenu: avec, qr: encodeur,
});
const pageDe = (site, chemin) => {
  const p = site.pages.find((x) => x.chemin === chemin);
  expect(p, chemin).toBeTruthy();
  return p;
};
const robotsDe = (p) => p.contenu.match(/<meta name="robots" content="([^"]*)">/)[1];
// Les lignes de l’affiche : « 2026-10-23T20:45:00+02:00 Brest – Nice ».
const lignesDe = (html) => [...html.matchAll(/<li class="affiche-ligne">[\s\S]*?<time class="affiche-heure[^"]*" datetime="([^"]+)">[^<]*<\/time> <span class="affiche-match">([^<]+)<\/span>/g)].map((m) => `${m[1]} ${m[2]}`);
// Les lignes des jours de /matchs/ (le bloc du jour et les jours suivants, sans « La semaine d’après », qui mène aux
// pages des matchs plus lointains), dans le même format.
const lignesDeLaSemaine = (html) => [...html.split('aria-labelledby="titre-ensuite"')[0].matchAll(/<li>(?:<a href="[^"]*">)?([^<]+?)(?:<\/a>)? · <time datetime="([^"]+)">/g)].map((m) => `${m[2]} ${m[1]}`);
// Les modules d’un QR code dessiné par svgDuQr, relus dans son SVG (marge comprise).
const matriceDuSvg = (svg) => {
  const cote = Number(svg.match(/viewBox="0 0 (\d+) \1"/)[1]);
  const lignes = Array.from({ length: cote }, () => Array(cote).fill('.'));
  for (const [, x, y, n] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) for (let i = 0; i < Number(n); i += 1) lignes[Number(y)][Number(x) + i] = 'X';
  return lignes.map((l) => l.join(''));
};
const sansMarge = (matrice) => matrice.slice(MARGE_DU_QR, -MARGE_DU_QR).map((l) => l.slice(MARGE_DU_QR, -MARGE_DU_QR));
// Une matrice (avec sa marge) en pixels RGBA, chaque module sur 8 × 8 pixels, pour jsQR.
const pixelsDe = (matrice) => {
  const k = 8;
  const largeur = matrice.length * k;
  const pixels = new Uint8ClampedArray(largeur * largeur * 4).fill(255);
  matrice.forEach((ligne, y) => [...ligne].forEach((module, x) => {
    if (module !== 'X') return;
    for (let dy = 0; dy < k; dy += 1) for (let dx = 0; dx < k; dx += 1) pixels.fill(0, ((y * k + dy) * largeur + x * k + dx) * 4, ((y * k + dy) * largeur + x * k + dx) * 4 + 3);
  }));
  return { pixels, largeur };
};

test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

// ---------- Le QR code ----------

// https://baromatch.fr/ en QR code (version 2, correction M, octets), tel qu’il doit sortir, module par module : X noir,
// . blanc, sans la marge. Une autre version de l’encodeur qui changerait le dessin fait échouer ce test.
const REFERENCE_ACCUEIL = [
  'XXXXXXX..XXX..X.X.XXXXXXX',
  'X.....X.X.X.XXX...X.....X',
  'X.XXX.X.XX..X..X..X.XXX.X',
  'X.XXX.X.XXXXXX.XX.X.XXX.X',
  'X.XXX.X..X.X....X.X.XXX.X',
  'X.....X......XX.X.X.....X',
  'XXXXXXX.X.X.X.X.X.XXXXXXX',
  '........X...X..X.........',
  'X.....X.X..X.XXX.XX..XXX.',
  '.XXXX.......X..X...XXXXX.',
  'XXX...X.XX..XX.X..X.XX.XX',
  '.XX.XX.X...X....XXX..X..X',
  '..XX.XXX..X.X.XX..XX....X',
  'X.XXXX.X.XX..X.XXX.X...X.',
  'X.....X.XX.XXXXXX.XXXX.XX',
  'X.XXX..XX.XX....X..X.XX.X',
  'X..X..XX.X.X...XXXXXX.X..',
  '........X...XX..X...X....',
  'XXXXXXX...XX....X.X.X...X',
  'X.....X..X..XX.XX...X..XX',
  'X.XXX.X...X.X.XXXXXXX.XXX',
  'X.XXX.X..X....XXXXX....XX',
  'X.XXX.X..XXXX...X....XX.X',
  'X.....X..XXX..X.XX.XX...X',
  'XXXXXXX.XXX..XX.X....X..X',
];

test('le QR code de l’accueil : la matrice de référence, sa marge blanche de 4 modules, et jsQR le lit', () => {
  expect(qr, 'l’encodeur des QR codes (cd generateur/images && npm ci)').toBeTruthy();
  expect(qr.signature).toBe('qrcode-generator 2.0.4');
  expect(qr.matrice('https://baromatch.fr/')).toEqual(REFERENCE_ACCUEIL);
  const svg = svgDuQr(REFERENCE_ACCUEIL, { etiquette: 'QR code vers baromatch.fr' });
  // Le carré blanc peint (il s’imprime sans les fonds), 25 modules et 4 de marge de chaque côté.
  expect(svg).toContain('viewBox="0 0 33 33"');
  expect(svg).toContain('<rect width="33" height="33" fill="#FFFFFF"/>');
  expect(svg).toContain('role="img" aria-label="QR code vers baromatch.fr"');
  const avecMarge = matriceDuSvg(svg);
  expect(sansMarge(avecMarge)).toEqual(REFERENCE_ACCUEIL);
  for (const bord of [avecMarge.slice(0, 4), avecMarge.slice(-4), avecMarge.map((l) => l.slice(0, 4)), avecMarge.map((l) => l.slice(-4))].flat()) expect(bord).toMatch(/^\.+$/);
  const { pixels, largeur } = pixelsDe(avecMarge);
  expect(jsQR(pixels, largeur, largeur, { inversionAttempts: 'dontInvert' })?.data).toBe('https://baromatch.fr/');
  // Une adresse longue (celle d’une page de bar) se lit aussi ; un texte hors ASCII est refusé.
  const bar = 'https://baromatch.fr/bar/le-zinc-des-amis-paris-11/';
  const grand = pixelsDe(matriceDuSvg(svgDuQr(qr.matrice(bar), { etiquette: 'x' })));
  expect(jsQR(grand.pixels, grand.largeur, grand.largeur, { inversionAttempts: 'dontInvert' })?.data).toBe(bar);
  expect(() => qr.matrice('https://baromatch.fr/é')).toThrow(/ASCII/);
});

// ---------- L’affiche de la semaine, dans le générateur ----------

test('l’affiche de la semaine : indexable même sans vrai bar publié, contrôlée, sans script hors de la mesure d’audience, et dans le plan du site', async () => {
  const site = await enMemoire({ avec: sansBarPublie });
  const p = pageDe(site, OUVERTE);
  expect(site.refusees.map((r) => r.chemin)).not.toContain(OUVERTE);
  expect(controlerLaPage(p)).toEqual([]);
  expect(validerLaPage(vocabulaire, p.contenu)).toEqual([]);
  // L’exception à « pas de vrai bar, pas d’index » : un outil fait des vrais matchs, qui ne nomme aucun bar.
  expect(site.donnees.bars).toEqual([]);
  expect(p.indexable).toBe(true);
  expect(robotsDe(p)).toBe('max-image-preview:large');
  expect(p.barsNommes).toEqual([]);
  expect(p.contenu).toContain('<title>Affiche des matchs de la semaine pour ton bar</title>');
  expect(p.contenu).toContain('<meta name="description" content="Les matchs des sept prochains jours, à l’heure de Paris\u00A0: coche ceux que tu diffuses et imprime ton affiche en A4 ou en A3. Gratuit, sans compte.">');
  expect(p.contenu.match(/<h1[\s>]/g)).toHaveLength(1);
  expect(p.contenu).toContain('<h1 class="regarder-titre">L’affiche des matchs de la semaine</h1>');
  expect(p.contenu).toContain('<link rel="stylesheet" href="/affiche.css">');
  // Aucun script, pas même celui du bloc « Partager » : seulement /mesure.js quand marque.json active la mesure
  // d’audience (l’affiche compte ses visites comme les autres pages ; rien de ce qu’on y coche ne part), et les données
  // structurées.
  expect([...p.contenu.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1])).toEqual([
    ...(mesureDuSite().active ? [baliseDeLaMesure(mesureDuSite()).replace(/^<script|><\/script>$/g, '')] : []), ' type="application/ld+json"',
  ]);

  // Écrite par construire : sa place dans la liste blanche, dans le plan du site, et parmi les adresses pour IndexNow.
  const sortie = await siteAvecLeDepot();
  const resultat = await construire({ source: sourceChargee(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: sansBarPublie, rendu: null, qr });
  expect(estPermis(fichierDuChemin(OUVERTE))).toBe(true);
  expect(existsSync(path.join(sortie, 'matchs', 'affiche', 'index.html'))).toBe(true);
  expect(resultat.plan).toContain('<loc>https://baromatch.fr/matchs/affiche/</loc>');
  expect(resultat.changees).toContain('https://baromatch.fr/matchs/affiche/');
  expect(resultat.etat.pages[OUVERTE]).toMatchObject({ type: 'affiche', cle: 'affiche', indexable: true, bars: [] });
});

test('moins de 3 matchs à montrer : l’affiche de la semaine reste lisible, mais en noindex et hors du plan du site', async () => {
  // Le scénario réduit à quelques matchs : deux dans la semaine du vendredi 23 (Brest – Nice, PSG – OL), un reporté qui
  // ne compte pas, puis un troisième (Lille – Lens).
  const avecLesMatchs = (ids, reporte = null) => {
    const brut = JSON.parse(readFileSync(SCENARIO, 'utf8'));
    return ecrireLeScenario({ ...brut, matches: brut.matches.filter((m) => ids.includes(m.id)).map((m) => (m.id === reporte ? { ...m, status: 'POSTPONED' } : m)) });
  };
  const deux = avecLesMatchs(['m-ce-soir', 'm-psg-ol', 'm-lille-lens'], 'm-lille-lens');
  const p = pageDe(await enMemoire({ source: deux, avec: sansBarPublie }), OUVERTE);
  expect(lignesDe(p.contenu)).toHaveLength(2);
  expect(p.indexable).toBe(false);
  expect(robotsDe(p)).toBe('noindex');
  expect(controlerLaPage(p)).toEqual([]);
  const sortie = await siteAvecLeDepot();
  const resultat = await construire({ source: deux, sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: sansBarPublie, rendu: null, qr });
  expect(resultat.plan).not.toContain('/matchs/affiche/');
  expect(resultat.etat.pages[OUVERTE]).toMatchObject({ type: 'affiche', indexable: false });
  // Trois matchs à montrer : indexable, et au plan du site.
  const trois = avecLesMatchs(['m-ce-soir', 'm-psg-ol', 'm-lille-lens']);
  const q = pageDe(await enMemoire({ source: trois, avec: sansBarPublie }), OUVERTE);
  expect(lignesDe(q.contenu)).toHaveLength(3);
  expect(q.indexable).toBe(true);
  const ensuite = await construire({ source: trois, sortie, maintenant: MAINTENANT_DU_SCENARIO + 3_600_000, racine, contenu: sansBarPublie, rendu: null, qr });
  expect(ensuite.plan).toContain('<loc>https://baromatch.fr/matchs/affiche/</loc>');
});

// Un dossier de sortie qui a ce qu’il faut au générateur (l’accueil et le plan du site du dépôt).
const siteAvecLeDepot = async () => {
  const sortie = dossierVide();
  writeFileSync(path.join(sortie, 'index.html'), readFileSync(path.join(racine, 'index.html')));
  writeFileSync(path.join(sortie, 'sitemap.xml'), readFileSync(path.join(racine, 'sitemap.xml')));
  return sortie;
};

test('les lignes sont les matchs des sept jours de /matchs/, dans l’ordre, sans les reportés ni les annulés ; une heure provisoire est « à confirmer »', async () => {
  const site = await enMemoire();
  const affiche = pageDe(site, OUVERTE).contenu;
  const semaine = lignesDeLaSemaine(pageDe(site, '/matchs/').contenu);
  const lignes = lignesDe(affiche);
  // /matchs/ montre aussi les matchs reportés et annulés (avec leur statut ailleurs) : l’affiche, non.
  const horsAffiche = semaine.filter((l) => /Nice – Lens|Toulouse – Metz/.test(l));
  expect(horsAffiche).toHaveLength(2);
  expect(lignes).toEqual(semaine.filter((l) => !horsAffiche.includes(l)));
  expect(lignes).toHaveLength(15);
  // Dans l’ordre des coups d’envoi, groupées par jour ; la première est celle de ce soir, la dernière jeudi.
  expect(lignes[0]).toBe('2026-10-23T19:00:00+02:00 Arsenal – Chelsea');
  expect(lignes.at(-1)).toBe('2026-10-29T21:00:00+01:00 Real Madrid – Juventus');
  expect(affiche).toContain('<p class="affiche-dates">Du vendredi 23 au jeudi 29 octobre</p>');
  expect(affiche).toContain('<h4 class="affiche-jour__nom" id="jour-2026-10-25"><time datetime="2026-10-25">Dimanche 25</time></h4>');
  // Une heure provisoire n’est pas écrite.
  expect(affiche).toContain('<time class="affiche-heure affiche-heure--a-confirmer" datetime="2026-10-28">Heure à confirmer</time> <span class="affiche-match">Paris FC – Angers</span>');
  // Le passé (le match d’hier) et l’au-delà des sept jours (vendredi 30) n’y sont pas.
  expect(affiche).not.toMatch(/OM – Lens|Le Havre – PSG/);
  // Le pied : la phrase de préparation et le QR code vers l’accueil, sans aucun paramètre de suivi.
  expect(affiche).toContain('Programme préparé sur baromatch.fr, à l’heure de Paris, le vendredi 23 octobre.');
  const svg = affiche.match(/<svg class="affiche-qr__code"[\s\S]*?<\/svg>/)[0];
  expect(sansMarge(matriceDuSvg(svg))).toEqual(REFERENCE_ACCUEIL);
  expect(affiche).not.toMatch(/depuis=|utm_|\?[a-z]+=/);
});

test('aucun formulaire, aucun champ de texte : seulement les cases des matchs et le choix du papier', async () => {
  const p = pageDe(await enMemoire(), OUVERTE);
  expect(p.contenu).not.toMatch(/<form\b|<textarea\b|<select\b|contenteditable/i);
  const champs = [...p.contenu.matchAll(/<input\b[^>]*>/g)].map((m) => m[0].match(/type="([^"]+)"/)?.[1]);
  expect(champs.filter((type) => type !== 'checkbox' && type !== 'radio')).toEqual([]);
  expect(champs.filter((type) => type === 'checkbox')).toHaveLength(15);
  expect(champs.filter((type) => type === 'radio')).toHaveLength(2);
  // Aucune case cochée au départ, A4 choisi.
  expect(p.contenu).not.toMatch(/type="checkbox"[^>]*checked/);
  expect(p.contenu).toContain('<input type="radio" name="affiche-format" id="affiche-a4" value="a4" checked>');
});

test('« Ton bar est sur Baromatch ? » seulement quand un vrai bar est publié ; aucun mot interdit, rien sur l’alcool, aucune image', async () => {
  const phrase = 'Ton bar est sur Baromatch\u00A0? Ton affiche, déjà remplie avec tes soirées, est sur la page de ton bar.';
  const avec = pageDe(await enMemoire(), OUVERTE).contenu;
  const sans = pageDe(await enMemoire({ avec: sansBarPublie }), OUVERTE).contenu;
  expect(avec).toContain(phrase);
  expect(sans).not.toContain('Ton bar est sur Baromatch');
  for (const html of [avec, sans]) {
    const texte = texteVisible(html);
    expect(texte).not.toMatch(MOTS_INTERDITS);
    expect(texte).not.toMatch(/alcool|bière|pinte|verre offert|happy|partenaire/i);
    expect(texte).toContain('Ton bar est à Paris ? Propose-le sur Baromatch');
    expect(html.split('<main')[1]).not.toMatch(/<img\b/);
  }
});

// ---------- L’affiche d’un bar publié ----------

test('l’affiche d’un bar publié : noindex, sa prochaine soirée, ses soirées de la semaine, un QR code vers sa page, aucune offre', async () => {
  const site = await enMemoire();
  const p = pageDe(site, AFFICHE_DU_ZINC);
  expect(controlerLaPage(p)).toEqual([]);
  expect(validerLaPage(vocabulaire, p.contenu)).toEqual([]);
  expect(p.indexable).toBe(false);
  expect(robotsDe(p)).toBe('noindex');
  expect(p.type).toBe('affiche-bar');
  expect(p.barsNommes).toEqual(['b-zinc']);
  expect(p.contenu).toContain('<h1 class="regarder-titre">L’affiche de Le Zinc des Amis</h1>');
  expect(p.contenu).toContain('<p class="affiche-bar">Le Zinc des Amis</p>');
  // Pas ce soir : « Ici, on diffuse le match. », puis le match, son jour et son heure en entier.
  expect(p.contenu).toContain('<h3 class="affiche-titre">Ici, on diffuse le match.</h3>');
  expect(p.contenu).toContain('<span class="affiche-prochain__match">PSG – Barça</span> <span class="affiche-prochain__quand">Samedi 24 octobre · <time class="affiche-heure" datetime="2026-10-24T21:00:00+02:00">21:00</time></span>');
  expect(lignesDe(p.contenu)).toEqual(['2026-10-25T20:45:00+01:00 PSG – OL']);
  // L’appli n’est pas ouverte : aucune place promise.
  expect(p.contenu).toContain('Nos soirées de match sont sur Baromatch.');
  expect(p.contenu).not.toContain('Garde ta place');
  // Rien sur l’alcool : l’offre « Pinte et planche » de sa soirée n’y est pas, ni aucune offre.
  expect(p.contenu).not.toMatch(/Pinte|offre|L’abus d’alcool/i);
  // Rien à cocher (ses soirées sont toutes imprimées) : seulement le choix du papier.
  expect(p.contenu).not.toMatch(/type="checkbox"|<form\b|<textarea\b/);
  // Le QR code ouvre sa page, sans paramètre.
  const svg = p.contenu.match(/<svg class="affiche-qr__code"[\s\S]*?<\/svg>/)[0];
  expect(sansMarge(matriceDuSvg(svg))).toEqual(qr.matrice('https://baromatch.fr/bar/le-zinc-des-amis-paris-11/'));
  expect(svg).toContain('aria-label="QR code vers la page de Le Zinc des Amis sur Baromatch"');
  expect(p.contenu).toContain('<figcaption class="affiche-qr__adresse">baromatch.fr/bar/le-zinc-des-amis-paris-11/</figcaption>');
  // La page du bar mène à son affiche.
  expect(pageDe(site, ZINC).contenu).toContain('<p class="regarder-suite"><a href="/bar/le-zinc-des-amis-paris-11/affiche/">Tu tiens ce bar\u00A0? Ton affiche à imprimer</a></p>');
});

test('le jour même : « Ce soir, on diffuse le match. » ; l’appli ouverte : « Garde ta place sur Baromatch. »', async () => {
  const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
  const site = await enMemoire({ maintenant: Date.parse('2026-10-24T08:00:00Z'), avec: ouverte });
  const p = pageDe(site, AFFICHE_DU_ZINC);
  expect(p.contenu).toContain('<h3 class="affiche-titre">Ce soir, on diffuse le match.</h3>');
  expect(p.contenu).toContain('<p class="affiche-appel">Garde ta place sur Baromatch.</p>');
  expect(controlerLaPage(p)).toEqual([]);
});

test('aucune affiche pour un bar qui n’est pas publié ; elle est effacée avec lui ; elle reste hors du plan du site', async () => {
  // Les bars de démo et d’essai, même dans la liste des bars publiés du scénario, n’en ont pas.
  const site = await enMemoire();
  const affichesDeBars = site.pages.filter((p) => p.type === 'affiche-bar').map((p) => p.chemin);
  expect(affichesDeBars).toEqual(site.donnees.bars.map((b) => `/bar/${b.slug}/affiche/`));
  expect(affichesDeBars.join()).not.toMatch(/demo|test|essai/i);
  expect((await enMemoire({ avec: sansBarPublie })).pages.filter((p) => p.type === 'affiche-bar')).toEqual([]);

  // Publié, puis plus publié : sa page passe à « n’est plus sur Baromatch », son affiche est effacée au même passage.
  const sortie = await siteAvecLeDepot();
  const premier = await construire({ source: sourceChargee(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, rendu: null, qr });
  const fichier = path.join(sortie, fichierDuChemin(AFFICHE_DU_ZINC));
  expect(existsSync(fichier)).toBe(true);
  expect(estPermis(fichierDuChemin(AFFICHE_DU_ZINC))).toBe(true);
  expect(premier.plan).not.toMatch(/\/bar\/[a-z0-9-]+\/affiche\//);
  expect(premier.etat.pages[AFFICHE_DU_ZINC]).toMatchObject({ type: 'affiche-bar', indexable: false, bars: ['b-zinc'] });
  const sansLeZinc = { ...contenu, publies: PUBLIES_DU_SCENARIO.filter((id) => id !== 'b-zinc') };
  const second = await construire({ source: sourceChargee(), sortie, maintenant: MAINTENANT_DU_SCENARIO + 3_600_000, racine, contenu: sansLeZinc, rendu: null, qr });
  expect(second.supprimees).toContain(AFFICHE_DU_ZINC);
  expect(existsSync(fichier)).toBe(false);
  expect(existsSync(path.join(sortie, fichierDuChemin(ZINC)))).toBe(true);
  expect(readFileSync(path.join(sortie, fichierDuChemin(ZINC)), 'utf8')).not.toContain('/affiche/');
});

test('sans l’encodeur des QR codes : aucune affiche, ni lien vers elles, et le journal le dit ; l’Action, elle, s’arrête', async () => {
  const site = await enMemoire({ encodeur: null });
  expect(site.pages.filter((p) => p.type.startsWith('affiche'))).toEqual([]);
  expect(pageDe(site, ZINC).contenu).not.toContain('/affiche/');
  expect(site.pages.filter((p) => p.contenu.includes('/affiche/')).map((p) => p.chemin)).toEqual([]);
  const journal = [];
  const sortie = await siteAvecLeDepot();
  const resultat = await construire({ source: sourceChargee(), sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, rendu: null, qr: null, journal: (l) => journal.push(l) });
  expect(resultat.ecrits).not.toContain(OUVERTE);
  expect(journal).toContain('avertissement : affiches : l’encodeur des QR codes est écarté ; les affiches à imprimer ne sont pas écrites.');
  await expect(construire({ source: sourceChargee(), sortie: await siteAvecLeDepot(), maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, images: 'exiger', rendu: { signature: 'essai', rendre: () => Buffer.from('') }, qr: null }))
    .rejects.toThrow('Affiches exigées, rien n’est écrit : l’encodeur des QR codes est écarté.');
});

test('l’Action installe l’encodeur avec le rendu des images, et enregistre les affiches (matchs/ et bar/ sont dans sa liste)', () => {
  const paquet = JSON.parse(readFileSync(path.join(racine, 'generateur', 'images', 'package.json'), 'utf8'));
  expect(paquet.dependencies['qrcode-generator']).toBe('2.0.4');
  const verrou = JSON.parse(readFileSync(path.join(racine, 'generateur', 'images', 'package-lock.json'), 'utf8'));
  expect(verrou.packages['node_modules/qrcode-generator']).toMatchObject({ version: '2.0.4', license: 'MIT' });
  const action = readFileSync(path.join(racine, '.github', 'workflows', 'pages-des-matchs.yml'), 'utf8');
  expect(action).toContain('working-directory: generateur/images\n        run: npm ci --ignore-scripts --no-audit --no-fund');
  expect(action).toContain('--images=exiger');
  expect(action).toContain('for chemin in matchs regarder-le-match bar ce-soir en agenda sitemap.xml; do');
  expect(action).toContain("grep -vqE '^(matchs|regarder-le-match|bar|ce-soir|en|agenda)/|^sitemap\\.xml$'");
});

test('la semaine (/matchs/) mène à l’affiche de ses matchs, par un lien seul, juste avant « Toutes les villes »', async () => {
  const semaine = pageDe(await enMemoire(), '/matchs/').contenu;
  expect(semaine).toContain(`<p class="regarder-suite"><a href="${OUVERTE}">Tu tiens un bar\u00A0? L’affiche des matchs de la semaine, à imprimer</a></p>
<p class="regarder-retour"><a href="/regarder-le-match/">Toutes les villes</a></p>`);
  // Sans vrai bar publié aussi : l’affiche est ouverte à tous les bars.
  expect(pageDe(await enMemoire({ avec: sansBarPublie }), '/matchs/').contenu).toContain(`<a href="${OUVERTE}">`);
});

test('« Partager mon badge » de la page des bars mène à l’affiche de la semaine', () => {
  const html = readFileSync(path.join(racine, 'pour-les-bars.html'), 'utf8');
  const bloc = html.slice(html.indexOf('id="badge"'), html.indexOf('</section>', html.indexOf('id="badge"')));
  expect(bloc).toContain('<a href="/matchs/affiche/">');
});

// ---------- Dans le navigateur ----------

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});
let serveur;
test.describe('dans le navigateur', () => {
  test.beforeAll(async () => {
    const dossier = dossierVide();
    await construireLeSiteDExemple(dossier);
    // La semaine remplie, construite par-dessus le site d’exemple.
    await construire({ source: sourceChargee(), sortie: dossier, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, rendu: null, qr, accepterLesSuppressions: true });
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(() => serveur?.arreter());

  // Chaque requête de la page, au chargement, à l’impression et pendant le PDF : toutes vers le site.
  const surveiller = (onglet) => {
    const ailleurs = [];
    onglet.on('request', (requete) => { if (!requete.url().startsWith(`${serveur.adresse}/`)) ailleurs.push(requete.url()); });
    return ailleurs;
  };
  const visibles = (onglet, selecteur) => onglet.locator(selecteur).evaluateAll((elements) => elements.filter((el) => el.getClientRects().length > 0).length);
  const pagesDuPdf = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;

  test('à l’impression : seulement la feuille ; trois cases cochées, trois matchs et les deux lignes vides ; rien de coché, tous', async ({ page: onglet }) => {
    const ailleurs = surveiller(onglet);
    await onglet.goto(`${serveur.adresse}${OUVERTE}`);
    await onglet.emulateMedia({ media: 'print' });
    expect(await visibles(onglet, '.affiche-ligne')).toBe(15);
    await onglet.emulateMedia({ media: 'screen' });
    const cases = onglet.locator('.affiche-case');
    for (const i of [0, 4, 11]) await cases.nth(i).check();
    await onglet.emulateMedia({ media: 'print' });
    expect(await visibles(onglet, '.affiche-ligne')).toBe(3);
    expect(await onglet.locator('.affiche-ligne').evaluateAll((l) => l.filter((el) => el.getClientRects().length).map((el) => el.querySelector('.affiche-match').textContent)))
      .toEqual(['Arsenal – Chelsea', 'PSG – Barça', 'Atlético – Real Sociedad']);
    // Seulement les jours qui ont une ligne cochée.
    expect(await visibles(onglet, '.affiche-jour')).toBe(3);
    expect(await visibles(onglet, '.affiche-blanc li')).toBe(2);
    expect(await visibles(onglet, '.affiche-qr__code')).toBe(1);
    // Ni l’en-tête, ni le pied du site, ni le mode d’emploi, ni les cases, ni le choix du papier.
    for (const selecteur of ['header.entete', 'footer.pied', '.regarder-fil', '.regarder-tete', '.affiche-mode', '.affiche-case', '#titre-feuille', '#titre-apres']) {
      expect(await visibles(onglet, selecteur), selecteur).toBe(0);
    }
    // Papier blanc, encre noire.
    expect(await onglet.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.affiche-match')).color]))
      .toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    // Le QR code imprimé : 40 mm marge comprise, le code lui-même plus de 3 cm (25 modules sur 33).
    const largeur = await onglet.locator('.affiche-qr__code').evaluate((svg) => svg.getBoundingClientRect().width);
    expect(largeur / 96 * 25.4).toBeCloseTo(40, 0);
    expect(largeur * 25 / 33 / 96 * 25.4).toBeGreaterThan(30);
    await onglet.pdf({ format: 'A4' });
    expect(ailleurs).toEqual([]);
  });

  test('14 matchs cochés : une seule page en A4, une seule en A3 ; l’affiche d’un bar aussi', async ({ page: onglet }) => {
    const ailleurs = surveiller(onglet);
    await onglet.goto(`${serveur.adresse}${OUVERTE}`);
    const cases = onglet.locator('.affiche-case');
    for (let i = 0; i < 14; i += 1) await cases.nth(i).check();
    expect(pagesDuPdf(await onglet.pdf({ format: 'A4' }))).toBe(1);
    await onglet.locator('#affiche-a3').check();
    expect(pagesDuPdf(await onglet.pdf({ format: 'A3' }))).toBe(1);
    await onglet.goto(`${serveur.adresse}${AFFICHE_DU_ZINC}`);
    expect(pagesDuPdf(await onglet.pdf({ format: 'A4' }))).toBe(1);
    await onglet.locator('#affiche-a3').check();
    expect(pagesDuPdf(await onglet.pdf({ format: 'A3' }))).toBe(1);
    expect(ailleurs).toEqual([]);
  });

  test('aucun script hors de la mesure d’audience, aucune requête hors du site ; les cases, le papier et les liens se touchent sur 44 px', async ({ page: onglet }) => {
    for (const chemin of [OUVERTE, AFFICHE_DU_ZINC]) {
      const ailleurs = surveiller(onglet);
      const scripts = [];
      onglet.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
      await onglet.setViewportSize({ width: 360, height: 800 });
      await onglet.goto(`${serveur.adresse}${chemin}`);
      // Seulement /mesure.js, si marque.json active la mesure d’audience (hors de baromatch.fr, elle ne compte rien).
      expect(scripts, chemin).toEqual(mesureDuSite().active ? [`${serveur.adresse}/mesure.js`] : []);
      expect(ailleurs, chemin).toEqual([]);
      const hauteurs = await onglet.locator('label.affiche-ligne__texte, .affiche-format__choix, main .regarder-suite a').evaluateAll((el) => el.map((x) => Math.round(x.getBoundingClientRect().height)));
      expect(hauteurs.length, chemin).toBeGreaterThanOrEqual(chemin === OUVERTE ? 18 : 2);
      expect(hauteurs.filter((h) => h < 44), chemin).toEqual([]);
    }
    // Les liens qui y mènent, depuis la semaine et depuis la page du bar : seuls sur leur ligne, 44 px.
    for (const [chemin, cible] of [['/matchs/', OUVERTE], [ZINC, AFFICHE_DU_ZINC]]) {
      await onglet.goto(`${serveur.adresse}${chemin}`);
      const boite = await onglet.locator(`main .regarder-suite a[href="${cible}"]`).boundingBox();
      expect(Math.round(boite.height), chemin).toBeGreaterThanOrEqual(44);
    }
  });

  test('le QR code, capturé sur la page, se lit : l’accueil, et la page du bar', async ({ page: onglet }) => {
    for (const [chemin, attendu] of [[OUVERTE, 'https://baromatch.fr/'], [AFFICHE_DU_ZINC, 'https://baromatch.fr/bar/le-zinc-des-amis-paris-11/']]) {
      await onglet.setViewportSize({ width: 1280, height: 900 });
      await onglet.goto(`${serveur.adresse}${chemin}`);
      const capture = await onglet.locator('.affiche-qr__code').screenshot();
      // La capture (PNG) relue en pixels par le navigateur, sur une page vide, puis lue par jsQR.
      const lecteur = await onglet.context().newPage();
      await lecteur.setContent(`<img src="data:image/png;base64,${capture.toString('base64')}">`);
      const { largeur, hauteur, pixels } = await lecteur.locator('img').evaluate(async (img) => {
        await img.decode();
        const toile = document.createElement('canvas');
        toile.width = img.naturalWidth;
        toile.height = img.naturalHeight;
        const contexte = toile.getContext('2d');
        contexte.drawImage(img, 0, 0);
        return { largeur: toile.width, hauteur: toile.height, pixels: [...contexte.getImageData(0, 0, toile.width, toile.height).data] };
      });
      await lecteur.close();
      expect(jsQR(Uint8ClampedArray.from(pixels), largeur, hauteur)?.data, chemin).toBe(attendu);
    }
  });
});
