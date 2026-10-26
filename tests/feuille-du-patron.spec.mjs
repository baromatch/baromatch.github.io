// La feuille à laisser au patron d’un bar (/matchs/affiche/pour-le-patron/ : generateur/feuille-du-patron.mjs, la
// troisième entrée du moteur des affiches, affiche.css). Une page utilitaire, comme l’affiche d’un bar : noindex, hors du
// plan du site, écrite seulement avec l’encodeur des QR codes. Sur la feuille : le titre, quatre lignes que les pages
// publiées disent déjà (vérifié ici, phrase par phrase), la ligne « Où on en est » liée à l’état de l’appli
// (marque.json), et un QR code vers le formulaire de la page des bars, sans paramètre de suivi (comparé à la matrice de
// l’encodeur, puis lu par jsQR sur la matrice et sur la capture de la page). Rien sur l’alcool, aucun « ! ».
// À l’impression : seulement la feuille, papier blanc, encre noire ; en A4, deux feuilles l’une au-dessus de l’autre
// (une seule page) ; en A5, une seule. Le scénario inventé (tests/donnees/scenario.json), lu à l’heure du vendredi
// 23 octobre 2026, 10 h à Paris.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jsQR from 'jsqr';
import { violationsAxe } from './outils/axe.mjs';
import { racine } from './outils/environnement.mjs';
import { MARQUE } from './outils/marque.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario, MAINTENANT_DU_SCENARIO, SCENARIO } from './outils/site-genere.mjs';
import { TEXTES_DE_LA_FEUILLE_DU_PATRON } from '../generateur/affiche.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construire } from '../generateur/construire.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { MOTS_INTERDITS } from '../generateur/donnees.mjs';
import { estPermis, fichierDuChemin } from '../generateur/etat.mjs';
import { ADRESSE_DU_QR_DU_PATRON } from '../generateur/feuille-du-patron.mjs';
import { baliseDeLaMesure, mesureDuSite } from '../generateur/mesure.mjs';
import { chargerLeQr, MARGE_DU_QR } from '../generateur/qr.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { chargerLeVocabulaire, validerLaPage } from '../generateur/validateur.mjs';

const FEUILLE = '/matchs/affiche/pour-le-patron/';
const OUVERTE = '/matchs/affiche/';
const QR_ATTENDU = 'https://baromatch.fr/pour-les-bars.html#proposer';
const { qr } = chargerLeQr();
const contenu = contenuDuScenario();
// Le contenu du dépôt tel quel : aucun vrai bar publié.
const sansBarPublie = chargerLeContenu(racine);
const vocabulaire = chargerLeVocabulaire();
const SOURCE = `scenario:${SCENARIO}`;

// Le texte de la feuille, tel qu’il a été relu (les espaces insécables de la typographie française comprises).
const TITRE = 'Les soirs de match, ton bar sur Baromatch.';
const LIGNES = [
  'Sur l’appli Baromatch, les fans de foot trouvent un bar qui diffuse leur match et y gardent leur place.',
  'Tu choisis tes matchs et combien de places tu ouvres.',
  'Gratuit pour tes clients. Pour ton bar, gratuit pendant le lancement, sans engagement. Aucun paiement tant que tu n’as pas accepté un tarif, et tu arrêtes quand tu veux.',
  'Sur baromatch.fr, ton bar n’apparaît qu’avec ton accord écrit.',
];
const OU_EN_EST = 'Baromatch cherche ses premiers bars à Paris. L’appli est en test sur Android ; les fans ne réservent pas encore.';

const dossiers = [];
const dossierVide = () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'patron-'));
  dossiers.push(dossier);
  return dossier;
};
test.afterAll(() => { for (const dossier of dossiers) rmSync(dossier, { recursive: true, force: true }); });

const enMemoire = ({ avec = contenu, encodeur = qr } = {}) => construireEnMemoire({ source: SOURCE, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: avec, qr: encodeur });
const pageDe = (site, chemin) => {
  const p = site.pages.find((x) => x.chemin === chemin);
  expect(p, chemin).toBeTruthy();
  return p;
};
// La feuille (pas sa copie) : du début de la première .affiche--patron à celui de la copie.
const laFeuille = (html) => html.slice(html.indexOf('<div class="affiche affiche--patron">'), html.indexOf('<div class="affiche affiche--patron affiche--copie"'));
// Un dossier de sortie qui a ce qu’il faut au générateur (l’accueil et le plan du site du dépôt).
const siteAvecLeDepot = () => {
  const sortie = dossierVide();
  writeFileSync(path.join(sortie, 'index.html'), readFileSync(path.join(racine, 'index.html')));
  writeFileSync(path.join(sortie, 'sitemap.xml'), readFileSync(path.join(racine, 'sitemap.xml')));
  return sortie;
};
// Les modules d’un QR code dessiné par svgDuQr, relus dans son SVG (marge comprise), et en pixels pour jsQR.
const matriceDuSvg = (svg) => {
  const cote = Number(svg.match(/viewBox="0 0 (\d+) \1"/)[1]);
  const lignes = Array.from({ length: cote }, () => Array(cote).fill('.'));
  for (const [, x, y, n] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) for (let i = 0; i < Number(n); i += 1) lignes[Number(y)][Number(x) + i] = 'X';
  return lignes.map((l) => l.join(''));
};
const sansMarge = (matrice) => matrice.slice(MARGE_DU_QR, -MARGE_DU_QR).map((l) => l.slice(MARGE_DU_QR, -MARGE_DU_QR));
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
// Le texte d’une page fixe du dépôt, balises ôtées, espaces (insécables comprises) normalisées.
const texteDuDepot = (fichier) => readFileSync(path.join(racine, fichier), 'utf8')
  .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ')
  .replace(/\s+/g, ' ');

// ---------- Dans le générateur ----------

test('la feuille : dans la liste blanche, noindex, hors du plan du site, contrôlée, sans script ni formulaire', async () => {
  expect(qr, 'l’encodeur des QR codes (cd generateur/images && npm ci)').toBeTruthy();
  const site = await enMemoire({ avec: sansBarPublie });
  const p = pageDe(site, FEUILLE);
  expect(site.refusees.map((r) => r.chemin)).not.toContain(FEUILLE);
  expect(controlerLaPage(p)).toEqual([]);
  expect(validerLaPage(vocabulaire, p.contenu)).toEqual([]);
  expect(p).toMatchObject({ type: 'affiche-patron', cle: 'pour-le-patron', indexable: false, barsNommes: [] });
  expect(p.contenu).toContain('<meta name="robots" content="noindex">');
  expect(p.contenu).toContain('<title>Feuille à laisser au patron d’un bar</title>');
  expect(p.contenu).toContain('<h1 class="regarder-titre">La feuille à laisser au patron</h1>');
  expect(p.contenu).toContain('<link rel="stylesheet" href="/affiche.css">');
  // Le fil : l’accueil, la semaine, l’affiche de la semaine, puis la feuille.
  expect(p.contenu).toContain(`<li><a href="${OUVERTE}">L’affiche de la semaine</a></li>
    <li aria-current="page">La feuille du patron</li>`);
  // Aucun script (seulement /mesure.js quand marque.json active la mesure d’audience, et les données structurées) ;
  // aucun formulaire ni champ de texte : seulement le choix du papier.
  expect([...p.contenu.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1])).toEqual([
    ...(mesureDuSite().active ? [baliseDeLaMesure(mesureDuSite()).replace(/^<script|><\/script>$/g, '')] : []), ' type="application/ld+json"',
  ]);
  expect(p.contenu).not.toMatch(/<form\b|<textarea\b|<select\b|contenteditable/i);
  expect([...p.contenu.matchAll(/<input\b[^>]*>/g)].map((m) => m[0])).toEqual([
    '<input type="radio" name="patron-papier" id="patron-a4" value="a4" checked>',
    '<input type="radio" name="patron-papier" id="patron-a5" value="a5">',
  ]);

  // Écrite par construire : sa place dans la liste blanche (sans l’élargir), hors du plan du site et d’IndexNow.
  const sortie = siteAvecLeDepot();
  const resultat = await construire({ source: SOURCE, sortie, maintenant: MAINTENANT_DU_SCENARIO, racine, contenu: sansBarPublie, rendu: null, qr });
  expect(estPermis(fichierDuChemin(FEUILLE))).toBe(true);
  expect(existsSync(path.join(sortie, 'matchs', 'affiche', 'pour-le-patron', 'index.html'))).toBe(true);
  expect(resultat.plan).not.toContain('pour-le-patron');
  expect([...resultat.changees].join()).not.toContain('pour-le-patron');
  expect(resultat.etat.pages[FEUILLE]).toMatchObject({ type: 'affiche-patron', cle: 'pour-le-patron', indexable: false, bars: [] });
});

test('sans l’encodeur des QR codes : ni feuille, ni lien vers elle', async () => {
  const site = await enMemoire({ encodeur: null });
  expect(site.pages.map((p) => p.chemin)).not.toContain(FEUILLE);
  expect(site.pages.filter((p) => p.contenu.includes('pour-le-patron')).map((p) => p.chemin)).toEqual([]);
  const resultat = await construire({ source: SOURCE, sortie: siteAvecLeDepot(), maintenant: MAINTENANT_DU_SCENARIO, racine, contenu, rendu: null, qr: null });
  expect(resultat.ecrits).not.toContain(FEUILLE);
  expect(Object.keys(resultat.etat.pages)).not.toContain(FEUILLE);
});

test('le QR code : exactement le formulaire de la page des bars, sans paramètre, et jsQR le lit ; l’adresse en clair dessous', async () => {
  expect(ADRESSE_DU_QR_DU_PATRON).toBe(QR_ATTENDU);
  // L’ancre existe sur la page des bars : le formulaire.
  expect(readFileSync(path.join(racine, 'pour-les-bars.html'), 'utf8')).toContain('<section class="contact bloc page" id="proposer"');
  const p = pageDe(await enMemoire(), FEUILLE);
  const svgs = [...p.contenu.matchAll(/<svg class="affiche-qr__code"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  // La feuille et sa copie : le même code.
  expect(svgs).toHaveLength(2);
  expect(svgs[1]).toBe(svgs[0]);
  const avecMarge = matriceDuSvg(svgs[0]);
  expect(sansMarge(avecMarge)).toEqual(qr.matrice(QR_ATTENDU));
  const { pixels, largeur } = pixelsDe(avecMarge);
  expect(jsQR(pixels, largeur, largeur, { inversionAttempts: 'dontInvert' })?.data).toBe(QR_ATTENDU);
  expect(svgs[0]).toContain('role="img" aria-label="QR code vers la page des bars de baromatch.fr, au formulaire pour proposer un bar"');
  expect(laFeuille(p.contenu)).toContain('<figcaption class="affiche-qr__adresse">baromatch.fr/pour-les-bars.html</figcaption>');
  expect(p.contenu).not.toMatch(/depuis=|utm_|\.html\?|\/\?[a-z]+=/);
});

test('le texte de la feuille : le titre, les quatre lignes, où on en est et le pied ; chaque phrase est déjà publiée', async () => {
  const p = pageDe(await enMemoire(), FEUILLE);
  const feuille = laFeuille(p.contenu);
  expect(feuille).toContain('<p class="affiche-patron__surtitre">Baromatch · pour les bars</p>');
  expect(feuille).toContain(`<h3 class="affiche-titre">${TITRE}</h3>`);
  expect([...feuille.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1])).toEqual(LIGNES);
  expect(feuille).toContain(`<p class="affiche-patron__etat"><strong>Où on en est :</strong> ${OU_EN_EST}</p>`);
  expect(feuille).toContain('<p class="affiche-appel">Propose ton bar : scanne le code.</p>');
  expect(feuille).toContain(`<p class="affiche-appel__suite">Ou écris à ${MARQUE.contact}</p>`);
  expect(MARQUE.contact).toBe('contact@baromatch.fr');
  // « Laissée par : » et sa ligne vide : un dessin, écrit au stylo sur le papier, qu’un lecteur d’écran ne lit pas.
  expect(feuille).toContain('<p class="affiche-laissee" aria-hidden="true">Laissée par :<span class="affiche-laissee__trait"></span></p>');
  expect(feuille).toContain('<span>Feuille préparée sur baromatch.fr, le vendredi 23 octobre.</span>');
  // La copie (la seconde feuille de l’A4) dit la même chose, cachée aux lecteurs d’écran, sans titre ni identifiant à elle.
  const copie = p.contenu.slice(p.contenu.indexOf('<div class="affiche affiche--patron affiche--copie" aria-hidden="true">'), p.contenu.indexOf('</section>', p.contenu.indexOf('affiche--copie')));
  expect(texteVisible(`<body>${copie}`)).toBe(texteVisible(`<body>${feuille}`));
  expect(copie).not.toMatch(/<h\d/);
  const ids = [...p.contenu.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  expect(ids.length).toBe(new Set(ids).size);

  // Ce que la feuille affirme, les pages publiées le disent déjà : la page des bars, « Comment on choisit les bars ».
  // Une de ces pages change : relire la feuille (generateur/contenu/feuille-du-patron.json), puis ce test.
  const publie = {
    'pour-les-bars.html': texteDuDepot('pour-les-bars.html').toLowerCase(),
    'comment-on-choisit-les-bars.html': texteDuDepot('comment-on-choisit-les-bars.html').toLowerCase(),
  };
  const SOURCES = [
    [TITRE, 'pour-les-bars.html', ['Les soirs de match, ton bar sur Baromatch.']],
    [LIGNES[0], 'pour-les-bars.html', ['Sur l’appli Baromatch, les fans qui cherchent où voir le match trouvent ton bar et gardent leur place.', 'le fan choisit son match et voit les bars qui le diffusent']],
    [LIGNES[1], 'pour-les-bars.html', ['tu choisis tes matchs', 'Tu choisis combien de places tu ouvres']],
    [LIGNES[2], 'pour-les-bars.html', ['Gratuit pour tes clients', 'Pour ton bar : gratuit pendant le lancement, sans engagement. Aucun paiement tant que tu n’as pas accepté un tarif, et tu arrêtes quand tu veux.']],
    [LIGNES[3], 'comment-on-choisit-les-bars.html', ['Il n’apparaît sur ce site qu’avec son accord écrit.']],
    [LIGNES[3], 'pour-les-bars.html', ['Sur ce site, ton bar n’apparaît qu’avec ton accord écrit']],
    [OU_EN_EST, 'pour-les-bars.html', ['Baromatch cherche ses premiers bars à Paris.', 'en test sur Android', 'les fans ne réservent pas encore']],
  ];
  for (const [phrase, page, dejaDit] of SOURCES) for (const morceau of dejaDit) expect(publie[page], `${phrase} ← ${page}`).toContain(morceau.toLowerCase());
});

test('les conditions des premiers bars sur la feuille ; aucune page générée ne dit plus « tarif à préciser »', async () => {
  // Les mots du fondateur (26 octobre 2026), tels que la page des bars les publie, et rien de plus.
  const conditions = 'Pour ton bar, gratuit pendant le lancement, sans engagement. Aucun paiement tant que tu n’as pas accepté un tarif, et tu arrêtes quand tu veux.';
  expect(TEXTES_DE_LA_FEUILLE_DU_PATRON.feuille.lignes.filter((ligne) => ligne.includes(conditions))).toHaveLength(1);
  for (const avec of [contenu, sansBarPublie]) {
    const site = await enMemoire({ avec });
    expect(laFeuille(pageDe(site, FEUILLE).contenu)).toContain(conditions);
    const disent = site.pages.filter((p) => /tarif\s+(?:est\s+)?à\s+préciser/i.test(p.contenu.replace(/&nbsp;/g, ' '))).map((p) => p.chemin);
    expect(disent).toEqual([]);
  }
});

test('« Où on en est » suit marque.json : l’appli ouverte, la feuille n’est plus écrite tant que sa phrase n’est pas relue', async () => {
  // La feuille dit « les fans ne réservent pas encore » : vrai tant que l’appli n’est pas ouverte. Le jour où elle ouvre
  // (marque.json), ce test échoue tant que la phrase de l’appli ouverte n’est pas écrite et relue.
  expect(MARQUE.appli.ouverte, 'l’appli est ouverte : écrire la ligne « Où on en est » de l’appli ouverte (generateur/contenu/feuille-du-patron.json, « ouverte »), puis ce test').toBe(false);
  expect(TEXTES_DE_LA_FEUILLE_DU_PATRON.feuille.ouEnEst.ouverte).toBe('');

  // L’appli ouverte, sans phrase pour elle : ni feuille, ni lien de l’affiche de la semaine, et le journal le dit.
  const ouverte = { ...contenu, marque: { ...contenu.marque, appli: { ouverte: true, android: 'https://magasin.exemple/baromatch-android', iphone: '' } } };
  const site = await enMemoire({ avec: ouverte });
  expect(site.pages.map((p) => p.chemin)).not.toContain(FEUILLE);
  expect(pageDe(site, OUVERTE).contenu).not.toContain('pour-le-patron');
  expect(site.pages.filter((p) => p.contenu.includes('pour-le-patron')).map((p) => p.chemin)).toEqual([]);
  expect(site.avertissements).toContain('feuille du patron : sa ligne « Où on en est » pour l’appli ouverte est vide (generateur/contenu/feuille-du-patron.json, « ouverte ») ; la feuille n’est pas écrite.');
  expect(site.pages.map((p) => texteVisible(p.contenu)).join(' ')).not.toContain('ne réservent pas encore');

  // Sa phrase écrite : la feuille revient, avec elle.
  const { ouEnEst } = TEXTES_DE_LA_FEUILLE_DU_PATRON.feuille;
  ouEnEst.ouverte = 'Phrase d’essai pour l’appli ouverte.';
  try {
    const relue = await enMemoire({ avec: ouverte });
    const p = pageDe(relue, FEUILLE);
    expect(laFeuille(p.contenu)).toContain('<strong>Où on en est :</strong> Phrase d’essai pour l’appli ouverte.</p>');
    expect(p.contenu).not.toContain('ne réservent pas encore');
    expect(pageDe(relue, OUVERTE).contenu).toContain(`<a href="${FEUILLE}">`);
  } finally {
    ouEnEst.ouverte = '';
  }
});

test('aucun « ! », jamais l’ancien nom, rien sur l’alcool, aucune image ; l’affiche de la semaine y mène par un lien seul', async () => {
  const p = pageDe(await enMemoire(), FEUILLE);
  const texte = texteVisible(p.contenu);
  expect(texte).not.toContain('!');
  expect(texte).not.toMatch(MOTS_INTERDITS);
  expect(texte).not.toMatch(/alcool|bière|pinte|boisson|verre offert|happy|apéro|partenaire/i);
  expect(p.contenu).not.toMatch(/soir de match/i);
  expect(p.contenu.split('<main')[1]).not.toMatch(/<img\b/);
  // Les textes eux-mêmes (sans le mode d’emploi du fichier, qui dit « rien sur l’alcool ») : apostrophes typographiques.
  const { _lisezMoi, ...textes } = JSON.parse(readFileSync(path.join(racine, 'generateur', 'contenu', 'feuille-du-patron.json'), 'utf8'));
  expect(_lisezMoi).toBeTruthy();
  expect(JSON.stringify(textes)).not.toMatch(/!|soir de match|alcool|bière|boisson|'/i);

  // Le lien de « Avant d’afficher » (/matchs/affiche/), un lien seul, avec ou sans vrai bar publié.
  for (const avec of [contenu, sansBarPublie]) {
    const apres = pageDe(await enMemoire({ avec }), OUVERTE).contenu.match(/<section class="regarder-section" aria-labelledby="titre-apres">[\s\S]*?<\/section>/)[0];
    expect(apres).toContain(`\n  <p class="regarder-suite"><a href="${FEUILLE}">Un patron veut en savoir plus ? La feuille à lui laisser</a></p>\n</section>`);
  }
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
    await construireLeSiteDExemple(dossier, { rendu: null });
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(async () => { await serveur?.arreter(); });

  // Chaque requête de la page, au chargement, à l’impression et pendant le PDF : toutes vers le site.
  const surveiller = (onglet) => {
    const ailleurs = [];
    onglet.on('request', (requete) => { if (!requete.url().startsWith(`${serveur.adresse}/`)) ailleurs.push(requete.url()); });
    return ailleurs;
  };
  const visibles = (onglet, selecteur) => onglet.locator(selecteur).evaluateAll((elements) => elements.filter((el) => el.getClientRects().length > 0).length);
  const pagesDuPdf = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
  const MM = 96 / 25.4;
  // Les feuilles imprimées : leur haut et leur hauteur (mm), et ce qui dépasse de chacune (px) : le bas de son élément
  // le plus bas sous le bas de la feuille. Ni la ligne de coupe (dessinée 7 mm sous la première feuille), ni l’intérieur
  // des dessins (la vague du verre, rognée par son cercle) n’en sont.
  const feuilles = (onglet) => onglet.locator('.affiche--patron').evaluateAll((liste) => liste.filter((f) => f.getClientRects().length).map((f) => {
    const cadre = f.getBoundingClientRect();
    return {
      haut: cadre.top, hauteur: cadre.height,
      deborde: Math.max(...[...f.querySelectorAll('*:not(svg *)')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom)) - cadre.bottom,
    };
  }));

  test('à l’impression, en A4 : la feuille et sa copie sur une seule page, la coupe au milieu ; papier blanc, encre noire, rien d’autre du site', async ({ page: onglet }) => {
    const ailleurs = surveiller(onglet);
    // La largeur imprimable d’une A4 entre les marges de 12 mm (186 mm).
    await onglet.setViewportSize({ width: Math.round(186 * MM), height: 1000 });
    await onglet.goto(`${serveur.adresse}${FEUILLE}`);
    await onglet.evaluate(() => document.fonts.ready);
    await onglet.emulateMedia({ media: 'print' });
    await expect(onglet.locator('#patron-a4')).toBeChecked();
    const [haut, bas] = await feuilles(onglet);
    expect(bas, 'la copie s’imprime en A4').toBeTruthy();
    // 127 mm chacune, 5 mm de jeu dans la zone imprimable (273 mm), sans rien qui dépasse ; la coupe, en pointillés,
    // entre les deux. Chacune reste d’un seul tenant si la page est plus courte (break-inside).
    for (const f of [haut, bas]) {
      expect(f.hauteur / MM).toBeCloseTo(127, 0);
      expect(f.deborde).toBeLessThanOrEqual(0.5);
    }
    expect(await onglet.locator('.affiche--patron').evaluateAll((liste) => liste.map((f) => getComputedStyle(f).breakInside))).toEqual(['avoid', 'avoid']);
    expect((bas.haut - haut.haut - haut.hauteur) / MM).toBeCloseTo(14, 0);
    expect((bas.haut + bas.hauteur - haut.haut) / MM).toBeLessThanOrEqual(268.5);
    // La ligne de coupe tient à la première feuille, 7 mm sous elle : au milieu de l’écart de 14 mm.
    expect(await onglet.locator('.affiche--patron').evaluateAll((liste) => liste.map((f) => [getComputedStyle(f, '::after').borderTopStyle, getComputedStyle(f, '::after').bottom])))
      .toEqual([['dashed', `${(-7 * 96 / 25.4).toFixed(4).replace(/0+$/, '')}px`], ['none', 'auto']]);
    // Ni l’en-tête, ni le pied du site, ni le fil, ni la tête de la page, ni le mode d’emploi et le choix du papier.
    for (const selecteur of ['header.entete', 'footer.pied', '.regarder-fil', '.regarder-tete', '.affiche-mode', '.affiche-format', '#titre-feuille']) {
      expect(await visibles(onglet, selecteur), selecteur).toBe(0);
    }
    expect(await visibles(onglet, '.affiche-qr__code')).toBe(2);
    expect(await visibles(onglet, '.affiche-laissee__trait')).toBe(2);
    // Papier blanc, encre noire ; le QR code, 36 mm marge comprise (le code lui-même, 33 modules sur 41, près de 3 cm).
    expect(await onglet.evaluate(() => [
      getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.querySelector('.affiche--patron')).backgroundColor,
      getComputedStyle(document.querySelector('.affiche-patron__lignes li')).color,
      getComputedStyle(document.querySelector('.affiche--patron .affiche-titre')).color,
    ])).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)']);
    const cote = await onglet.locator('.affiche--patron .affiche-qr__code').first().evaluate((svg) => svg.getBoundingClientRect().width);
    expect(cote / MM).toBeCloseTo(36, 0);
    expect(pagesDuPdf(await onglet.pdf({ format: 'A4' }))).toBe(1);
    expect(ailleurs).toEqual([]);
  });

  test('à l’impression, en A4 sur une page plus courte (Letter) : la copie passe entière sur la page suivante', async ({ page: onglet }) => {
    // Le choix A4 resté coché, mais du papier Letter dans la fenêtre d’impression (192 × 255 mm imprimables) : les deux
    // feuilles ne tiennent plus sur une page ; la copie, d’un seul tenant, va sur la deuxième.
    await onglet.setViewportSize({ width: Math.round(191.9 * MM), height: 1000 });
    await onglet.goto(`${serveur.adresse}${FEUILLE}`);
    await onglet.evaluate(() => document.fonts.ready);
    await expect(onglet.locator('#patron-a4')).toBeChecked();
    expect(pagesDuPdf(await onglet.pdf({ format: 'Letter' }))).toBe(2);
    // Deux pages, coupée ou non : on regarde donc les feuilles dans une colonne de la hauteur d’une page Letter (le même
    // découpage que l’impression). Chaque feuille y tient d’un seul morceau.
    await onglet.emulateMedia({ media: 'print' });
    expect(await onglet.evaluate(() => {
      Object.assign(document.querySelector('.affiche-zone').style, { height: '255.4mm', columnCount: '1', columnGap: '0', columnFill: 'auto' });
      return [...document.querySelectorAll('.affiche--patron')].map((f) => f.getClientRects().length);
    })).toEqual([1, 1]);
  });

  test('à l’impression, en A5 : la feuille seule, sur une seule page, sans rien qui dépasse', async ({ page: onglet }) => {
    // La largeur imprimable d’une A5 entre les marges de 12 mm (124 mm).
    await onglet.setViewportSize({ width: Math.round(124 * MM), height: 1000 });
    await onglet.goto(`${serveur.adresse}${FEUILLE}`);
    await onglet.evaluate(() => document.fonts.ready);
    await onglet.locator('#patron-a5').check();
    await onglet.emulateMedia({ media: 'print' });
    const imprimees = await feuilles(onglet);
    expect(imprimees).toHaveLength(1);
    expect(imprimees[0].deborde).toBeLessThanOrEqual(0.5);
    expect(imprimees[0].hauteur / MM).toBeLessThanOrEqual(186);
    expect(await visibles(onglet, '.affiche-qr__code')).toBe(1);
    expect(pagesDuPdf(await onglet.pdf({ format: 'A5' }))).toBe(1);
    // En A5, une feuille seule : pas de ligne de coupe.
    expect(await onglet.locator('.affiche--patron').first().evaluate((f) => getComputedStyle(f, '::after').borderTopStyle)).toBe('none');
  });

  test('à l’écran : une seule feuille, sa copie cachée ; aucune violation d’axe à 360 et 1280 px, rien ne défile de côté', async ({ page: onglet }) => {
    for (const largeur of [360, 1280]) {
      await onglet.setViewportSize({ width: largeur, height: 800 });
      await onglet.goto(`${serveur.adresse}${FEUILLE}`);
      expect(await visibles(onglet, '.affiche--patron'), `${largeur} px`).toBe(1);
      await expect(onglet.locator('.affiche--copie')).toBeHidden();
      await expect(onglet.locator('.affiche--copie')).toHaveAttribute('aria-hidden', 'true');
      // Ce qu’un lecteur d’écran lit de la feuille : son titre, une seule fois.
      await expect(onglet.getByRole('heading', { name: TITRE })).toHaveCount(1);
      expect(await violationsAxe(onglet), `${largeur} px`).toEqual([]);
      expect(await onglet.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${largeur} px`).toBeLessThanOrEqual(0);
    }
    // Au téléphone, le choix du papier se touche sur 44 px.
    const hauteurs = await onglet.locator('.affiche-format__choix').evaluateAll((el) => el.map((x) => Math.round(x.getBoundingClientRect().height)));
    expect(hauteurs).toHaveLength(2);
    expect(hauteurs.filter((h) => h < 44)).toEqual([]);
  });

  test('aucun script hors de la mesure d’audience, aucune requête hors du site ; le lien de l’affiche de la semaine se touche sur 44 px et y mène', async ({ page: onglet }) => {
    const ailleurs = surveiller(onglet);
    const scripts = [];
    onglet.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    await onglet.setViewportSize({ width: 360, height: 800 });
    await onglet.goto(`${serveur.adresse}${OUVERTE}`);
    const lien = onglet.locator(`main .regarder-suite a[href="${FEUILLE}"]`);
    await expect(lien).toHaveText('Un patron veut en savoir plus ? La feuille à lui laisser');
    expect(Math.round((await lien.boundingBox()).height)).toBeGreaterThanOrEqual(44);
    await lien.click();
    await expect(onglet).toHaveURL(`${serveur.adresse}${FEUILLE}`);
    await expect(onglet.locator('h1')).toHaveText('La feuille à laisser au patron');
    expect(scripts).toEqual(mesureDuSite().active ? [`${serveur.adresse}/mesure.js`, `${serveur.adresse}/mesure.js`] : []);
    expect(ailleurs).toEqual([]);
  });

  test('le QR code, capturé sur la page, se lit : le formulaire de la page des bars', async ({ page: onglet }) => {
    await onglet.setViewportSize({ width: 1280, height: 900 });
    await onglet.goto(`${serveur.adresse}${FEUILLE}`);
    const capture = await onglet.locator('.affiche--patron .affiche-qr__code').first().screenshot();
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
    expect(jsQR(Uint8ClampedArray.from(pixels), largeur, hauteur)?.data).toBe(QR_ATTENDU);
  });
});
