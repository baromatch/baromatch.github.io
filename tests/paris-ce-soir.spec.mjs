// Le plan « Paris, ce soir » (generateur/plan.mjs, plan.css, plan.js) : ce qui doit rester vrai, vérifié sur les pages que
// le générateur écrit (sans navigateur) et sur l’accueil au téléphone (avec).
// - la vérité : tant qu’aucun bar n’est publié, aucun bar inventé n’est posé en un point du plan (ni pastille, ni nom, ni
//   liste de bars) ; la démo allume des arrondissements entiers, marquée « Démo », sous « Aucun bar ne l’annonce encore
//   sur Baromatch. » ; avec de vrais bars, la démo disparaît ;
// - « Maintiens » : « Place gardée, en démo », jamais « réserv… » sur un bouton, une étiquette ou un titre, sauf
//   « rien n’est réservé » ;
// - « Ce soir » et la page d’un match ne chargent pas plan.js (leur budget de vitesse : 4 Ko de JavaScript) : leur plan se
//   lit sans lui, sa lumière allumée par plan.css, sans heure qui avance ni état d’horloge, le geste devenu un lien ;
// - un match commencé dit « Le match a commencé. » (l’appli connaît l’heure, pas l’état du match), jamais « en cours » ;
// - le premier écran de l’accueil au téléphone (390 × 844) : la vérité, « Préviens-moi » en ambre, la bande des matchs ;
// - le pied de chaque page : Supprimer mon compte, Confidentialité, CGU, Mentions légales, Deviens testeur Android, contact ;
// - chaque étiquette « Démo » fait au moins 12 px ; aucun style en ligne, aucun « % », aucun « ! ».
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple, contenuDuScenario } from './outils/site-genere.mjs';
import { chargerLeContenu } from '../generateur/contenu.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { controlerLaPage, texteVisible } from '../generateur/controle.mjs';
import { PLAN_DEMO, planDeParis } from '../generateur/plan.mjs';

const SCENARIO = path.join(racine, 'tests', 'donnees', 'scenario.json');
// Le vendredi 23 octobre 2026, 10 h à Paris : des matchs ce soir-là.
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');
const sansBarPublie = chargerLeContenu(racine);
const avecBarsPublies = contenuDuScenario();
const lire = (fichier) => readFileSync(path.join(racine, fichier), 'utf8');

const fabriquer = async (contenu) => construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: VENDREDI, racine, contenu });
const pageDe = (site, chemin) => site.pages.find((p) => p.chemin === chemin);
const MENTION = /réserv/i;
// Le bloc du plan : de sa première balise jusqu’à la première section suivante de la page.
const LE_PLAN = /<div class="soir [\s\S]*?(?=<section class="regarder-section|<\/main>)/;

test('un seul interrupteur de la démo : « arrondissements » ou « aucune »', () => {
  expect(['arrondissements', 'aucune']).toContain(PLAN_DEMO);
});

test.describe('sans aucun bar publié : jamais un bar inventé sur le plan', () => {
  test('Ce soir et la page d’un match : le plan allume des arrondissements, aucune pastille, aucun nom de bar', async () => {
    const site = await fabriquer(sansBarPublie);
    const matchs = site.pages.filter((p) => p.type === 'match' && p.contenu.includes('class="soir '));
    expect(matchs.length, 'des pages de match avec le plan').toBeGreaterThan(0);
    for (const p of [pageDe(site, '/ce-soir/'), ...matchs]) {
      const plan = p.contenu.match(LE_PLAN)?.[0];
      expect(plan, p.chemin).toBeTruthy();
      expect(plan, `${p.chemin} : une pastille de bar`).not.toMatch(/class="pin |<circle class="dot"|class="bar__ligne" href=/);
      expect(plan, `${p.chemin} : « Aucun bar ne l’annonce encore sur Baromatch. »`).toContain('Aucun bar ne l’annonce encore sur Baromatch.');
      if (PLAN_DEMO === 'arrondissements') {
        expect(plan, p.chemin).toContain('class="plan__demo">Démo<');
        expect(plan, `${p.chemin} : des arrondissements entiers`).toMatch(/<use class="allume" href="#pl-a\d+"\/>/);
        const lignes = [...plan.matchAll(/class="bar bar--demo"/g)];
        expect(lignes.length, `${p.chemin} : une ligne par arrondissement allumé`).toBeGreaterThanOrEqual(5);
      } else {
        expect(plan, p.chemin).not.toContain('class="allume"');
      }
    }
    // Les exemples d’avant (des noms de bars inventés) ne reviennent nulle part.
    for (const p of site.pages) expect(p.contenu, p.chemin).not.toMatch(/Lucarne Lunaire|Poteau Rentrant|Reprise de Volée|Petit Pont|Grand Filet/);
  });

  test('l’accueil : le bloc des matchs de la semaine porte le plan, sans bar posé à un point', async () => {
    const { blocDeLaSemaine } = await import('../generateur/accueil.mjs');
    const site = await fabriquer(sansBarPublie);
    const bloc = blocDeLaSemaine({ donnees: site.donnees, textes: sansBarPublie.textes, marque: sansBarPublie.marque, maintenant: VENDREDI });
    expect(bloc).toContain('class="soir soir--rail"');
    expect(bloc).not.toMatch(/class="pin |<circle class="dot"/);
    expect(bloc.replace(/\u00a0/g, ' ')).toContain('Aucun bar publié pour l’instant');
  });
});

test.describe('avec des bars publiés : seuls les vrais bars, leur arrondissement allumé', () => {
  test('la démo disparaît ; les pastilles sont celles des vrais bars', async () => {
    const site = await fabriquer(avecBarsPublies);
    const p = pageDe(site, '/ce-soir/');
    const plan = p.contenu.match(LE_PLAN)?.[0];
    expect(plan).toBeTruthy();
    expect(plan).not.toContain('plan__demo');
    expect(plan).not.toContain('bar--demo');
    const noms = site.donnees.bars.map((b) => b.nom);
    const pastilles = [...plan.matchAll(/class="pin pi\d" [^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
    for (const a of pastilles) expect(noms.some((n) => a.startsWith(n)), `« ${a} » est un vrai bar`).toBe(true);
  });
});

test.describe('ce que le plan ne dit jamais', () => {
  test('aucun style en ligne, aucun « % », aucun « ! », aucun « réserv… » hors de « rien n’est réservé », aucun « en cours »', async () => {
    for (const contenu of [sansBarPublie, avecBarsPublies]) {
      const site = await fabriquer(contenu);
      for (const p of [pageDe(site, '/ce-soir/'), ...site.pages.filter((x) => x.type === 'match')]) {
        const plan = p.contenu.match(LE_PLAN)?.[0];
        if (!plan) continue;
        expect(plan, `${p.chemin} : un style en ligne`).not.toMatch(/\sstyle\s*=/i);
        const texte = texteVisible(`<body>${plan}`);
        expect(texte, `${p.chemin} : « % »`).not.toContain('%');
        expect(texte, `${p.chemin} : « ! »`).not.toContain('!');
        expect(texte.replace(/rien n’est réservé/g, ''), `${p.chemin} : « réserv… »`).not.toMatch(MENTION);
        expect(texte, `${p.chemin} : « en cours »`).not.toMatch(/en cours/i);
        expect(controlerLaPage(p), p.chemin).toEqual([]);
      }
    }
  });

  test('« Maintiens pour garder ta place » : le geste (accueil, avec plan.js) ou son lien (sans), la démo, jamais une réservation', async () => {
    const site = await fabriquer(sansBarPublie);
    const { blocDeLaSemaine } = await import('../generateur/accueil.mjs');
    const accueil = blocDeLaSemaine({ donnees: site.donnees, textes: sansBarPublie.textes, marque: sansBarPublie.marque, maintenant: VENDREDI });
    expect(accueil).toContain('Maintiens pour garder ta place');
    expect(accueil).toContain('data-hold');
    const ceSoir = pageDe(site, '/ce-soir/').contenu;
    expect(ceSoir).toContain('Garder ta place dans l’appli');
    expect(ceSoir, 'pas de geste sans le script qui le fait').not.toContain('data-hold');
    for (const plan of [accueil, ceSoir]) {
      expect(plan.replace(/\u00a0/g, ' ')).toContain('Démo : rien n’est réservé. Pour de vrai, c’est dans l’appli.');
      for (const bouton of plan.matchAll(/<a class="tenir__btn"[\s\S]*?<\/a>/g)) expect(texteVisible(`<body>${bouton[0]}`)).not.toMatch(MENTION);
    }
  });

  test('la page d’un match : l’arrondissement le plus proche, jamais une adresse', async () => {
    const site = await fabriquer(avecBarsPublies);
    const p = site.pages.find((x) => x.type === 'match' && x.contenu.includes('class="pin '));
    if (!p) return;
    const plan = p.contenu.match(LE_PLAN)[0];
    for (const bar of site.donnees.bars) expect(plan, `l’adresse de ${bar.nom}`).not.toContain(bar.rue);
  });
});

test.describe('« Ce soir » et la page d’un match : le plan sans plan.js', () => {
  test('aucune page générée ne charge plan.js ; le plan est allumé par la feuille, sans heure ni état d’horloge', async () => {
    for (const contenu of [sansBarPublie, avecBarsPublies]) {
      const site = await fabriquer(contenu);
      const avecPlan = [pageDe(site, '/ce-soir/'), ...site.pages.filter((p) => p.type === 'match')].filter((p) => p.contenu.includes('<div class="soir '));
      expect(avecPlan.length, 'des pages avec le plan').toBeGreaterThan(1);
      for (const p of site.pages) expect(p.contenu, `${p.chemin} : plan.js`).not.toContain('/plan.js');
      for (const p of avecPlan) {
        expect(p.contenu, p.chemin).toContain('<link rel="stylesheet" href="/plan.css">');
        expect(p.contenu, `${p.chemin} : la lumière allumée par la feuille`).toContain('soir--sans-script');
        expect(p.contenu, `${p.chemin} : un état d’horloge`).not.toContain('prog__etat');
        expect(p.contenu, `${p.chemin} : une heure qui avance`).not.toContain('plan__heure');
        expect(p.contenu, `${p.chemin} : un geste`).not.toContain('data-hold');
      }
    }
  });

  test('l’accueil, lui, garde son script : le bloc du plan n’est pas la version sans script', async () => {
    const { blocDeLaSemaine } = await import('../generateur/accueil.mjs');
    const site = await fabriquer(sansBarPublie);
    const bloc = blocDeLaSemaine({ donnees: site.donnees, textes: sansBarPublie.textes, marque: sansBarPublie.marque, maintenant: VENDREDI });
    expect(bloc).not.toContain('soir--sans-script');
    expect(bloc).toContain('prog__etat');
    expect(bloc).toContain('plan__heure');
    expect(lire('index.html')).toContain('<script src="/plan.js" defer></script>');
  });
});

test.describe('« Ce soir » servi : le plan allumé sans plan.js', () => {
  let dossier;
  let serveur;
  const portLibre = () => new Promise((resoudre) => {
    const sonde = createServer();
    sonde.listen(0, '127.0.0.1', () => {
      const { port } = sonde.address();
      sonde.close(() => resoudre(port));
    });
  });
  test.beforeAll(async () => {
    dossier = mkdtempSync(path.join(tmpdir(), 'plan-ce-soir-'));
    await construireLeSiteDExemple(dossier, { rendu: null });
    serveur = await demarrerServeur(await portLibre(), -1, { dossier });
  });
  test.afterAll(async () => {
    await serveur?.arreter();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
  });

  for (const chemin of ['/ce-soir/', '/matchs/psg-ol-2026-10-25/']) {
    test(`${chemin} à 390 × 844 : pas de plan.js, la lumière des clubs allumée, « Préviens-moi » ambre dans l’en-tête`, async ({ browser }) => {
      const contexte = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const onglet = await contexte.newPage();
      const scripts = [];
      onglet.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname); });
      await onglet.goto(`${serveur.adresse}${chemin}`);
      await onglet.waitForLoadState('networkidle');
      expect(scripts.filter((s) => s === '/plan.js')).toEqual([]);
      const lueur = onglet.locator('.scene[data-i="1"] .lueur');
      await expect(lueur).toHaveCount(1);
      expect(await lueur.evaluate((n) => Number(getComputedStyle(n).opacity))).toBeGreaterThan(0.9);
      await expect(onglet.locator('.scene[data-i="1"] .plan__svg')).toBeVisible();
      await expect(onglet.locator('.scene[data-i="1"] .liste')).toBeVisible();
      const action = onglet.locator('.entete__attente');
      expect(await action.evaluate((a) => getComputedStyle(a).backgroundColor)).toBe('rgb(255, 177, 61)');
      const lien = onglet.locator('.essai-place .tenir__btn');
      await expect(lien).toHaveText('Garder ta place dans l’appli');
      await expect(lien).toHaveAttribute('href', '/#attente');
      await contexte.close();
    });
  }
});

test('planDeParis : sans match, rien', async () => {
  const site = await fabriquer(sansBarPublie);
  expect(planDeParis({ matchs: [], donnees: site.donnees, marque: sansBarPublie.marque, chemin: '/ce-soir/', maintenant: VENDREDI })).toBe('');
});

// ---------- L’accueil, au téléphone ----------

test.describe('l’accueil à 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('le premier écran : la vérité, « Préviens-moi » en ambre, la bande des matchs, « Démo » en grand', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const verite = await page.locator('.soir__verite--haut').boundingBox();
    expect(verite.y, 'la vérité : haut').toBeGreaterThanOrEqual(0);
    expect(verite.y + verite.height, 'la vérité : bas').toBeLessThanOrEqual(844);
    const bande = await page.locator('.soir .prog__l').first().boundingBox();
    expect(bande.y, 'la bande des matchs sous la vérité').toBeGreaterThan(verite.y + verite.height - 1);
    expect(bande.y, 'la bande des matchs est dans le premier écran').toBeLessThan(844);
    const cta = page.locator('.ouverture__cta .capsule');
    const boite = await cta.boundingBox();
    expect(boite.y + boite.height).toBeLessThanOrEqual(844);
    expect(boite.height).toBeGreaterThanOrEqual(44);
    expect(await cta.evaluate((a) => getComputedStyle(a).backgroundColor)).toBe('rgb(255, 177, 61)');
    await expect(cta).toHaveAttribute('href', '#attente');
    const entete = await page.locator('.entete__attente').boundingBox();
    expect(entete.height, 'le bouton « Préviens-moi » de l’en-tête').toBeGreaterThanOrEqual(44);
  });

  test('chaque étiquette « Démo » fait au moins 12 px, et son contraste est d’au moins 4,5:1', async ({ page }) => {
    await page.goto('/');
    const etiquettes = await page.$$eval('.etiquette-demo, .plan__demo', (liste) => liste.filter((e) => e.offsetParent !== null).map((e) => {
      const s = getComputedStyle(e);
      return { taille: parseFloat(s.fontSize), couleur: s.color, fond: s.backgroundColor };
    }));
    expect(etiquettes.length).toBeGreaterThan(0);
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => { const x = Number(v) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const e of etiquettes) {
      expect(e.taille).toBeGreaterThanOrEqual(12);
      const [a, b] = [lum(e.couleur), lum(e.fond)].sort((x, y) => y - x);
      expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('l’horloge de Paris : « dans 1 h 42 » avant le coup d’envoi, « Le match a commencé. » après, jamais « en cours »', async ({ page }) => {
    const debut = await page.goto('/').then(() => page.locator('.prog__etat').first().getAttribute('data-debut'));
    const coup = Date.parse(debut);
    await page.clock.install({ time: coup - (60 + 42) * 60000 });
    await page.goto('/');
    await expect(page.locator('.prog__etat').first()).toHaveText('dans 1 h 42');
    await page.clock.fastForward((60 + 43) * 60000);
    await expect(page.locator('.prog__etat').first()).toHaveText('Le match a commencé.');
    expect(await page.locator('.soir').innerText()).not.toMatch(/en cours/i);
  });

  test('l’heure avance avec le défilement, du coup d’envoi moins 2 h 18 au coup d’envoi ; elle ne bouge pas seule', async ({ page }) => {
    await page.goto('/');
    const heure = page.locator('.scene[data-i="1"] .plan__heure');
    const avant = await heure.textContent();
    await page.waitForTimeout(600);
    expect(await heure.textContent(), 'rien ne bouge seul').toBe(avant);
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(async () => heure.textContent()).not.toBe(avant);
    const debut = await heure.getAttribute('data-debut');
    const attendu = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(Date.parse(debut)));
    expect(await heure.textContent()).toBe(attendu);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => heure.textContent()).toBe(avant);
  });

  test('mouvement réduit : le soir, immobile ; « Maintiens » devient un simple appui', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const debut = await page.locator('.scene[data-i="1"] .plan__heure').getAttribute('data-debut');
    const attendu = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(Date.parse(debut)));
    expect(await page.locator('.scene[data-i="1"] .plan__heure').textContent()).toBe(attendu);
    const essai = page.locator('.essai-place .tenir');
    await essai.scrollIntoViewIfNeeded();
    await essai.locator('[data-hold]').click();
    await expect(essai.locator('.tenir__suite')).toContainText('Place gardée, en démo.');
    await expect(essai.locator('.tenir__suite a')).toHaveAttribute('href', '#attente');
  });

  test('« Maintiens » : la barre d’espace tenue jusqu’au bout garde la place, en démo ; rien ne part', async ({ page }) => {
    const demandes = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) demandes.push(r.url()); });
    await page.goto('/');
    const essai = page.locator('.essai-place .tenir');
    await essai.scrollIntoViewIfNeeded();
    const bouton = essai.locator('[data-hold]');
    await bouton.focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(1400);
    await page.keyboard.up('Space');
    await expect(essai.locator('.tenir__suite')).toContainText('Place gardée, en démo. Pour de vrai, l’appli arrive bientôt');
    expect(demandes).toEqual([]);
  });

  test('sans JavaScript : le plan s’allume et la liste se lit', async ({ browser }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    await page.goto('/');
    await expect(page.locator('.scene[data-i="1"] .plan__svg')).toBeVisible();
    await expect(page.locator('.scene[data-i="1"] .bars--demo li').first()).toBeVisible();
    await expect(page.locator('.tenir__txt').first()).toHaveText('Maintiens pour garder ta place');
    await contexte.close();
  });
});

// ---------- Le pied de chaque page ----------

const PAGES_A_LA_MAIN = ['index.html', 'pour-les-bars.html', 'a-propos.html', 'presse.html', 'boutique.html', 'testeurs-android.html', 'comment-on-choisit-les-bars.html',
  'trouver-un-bar-qui-diffuse-le-match.html', 'confidentialite.html', 'cgu.html', 'mentions-legales.html', 'supprimer-mon-compte.html', '404.html'];
const LIENS_DU_PIED = ['/supprimer-mon-compte.html', '/confidentialite.html', '/cgu.html', '/mentions-legales.html', '/testeurs-android.html', 'mailto:contact@baromatch.fr'];

test('le pied de chaque page écrite à la main porte les six liens obligatoires, et aucune pastille de magasin', () => {
  for (const fichier of PAGES_A_LA_MAIN) {
    const pied = lire(fichier).match(/<!-- pied:debut -->([\s\S]*?)<!-- pied:fin -->/)?.[1];
    expect(pied, fichier).toBeTruthy();
    for (const lien of LIENS_DU_PIED) expect(pied, `${fichier} : ${lien}`).toContain(`href="${lien}"`);
    expect(pied, `${fichier} : une pastille de magasin`).not.toMatch(/apps\.apple\.com|play\.google\.com/);
  }
});

test('le pied de chaque page générée porte les six liens obligatoires', async () => {
  const site = await fabriquer(sansBarPublie);
  for (const p of site.pages.filter((x) => ['ce-soir', 'match', 'semaine', 'ville', 'club'].includes(x.type)).slice(0, 12)) {
    const pied = p.contenu.match(/<footer[\s\S]*?<\/footer>/)?.[0];
    expect(pied, p.chemin).toBeTruthy();
    for (const lien of LIENS_DU_PIED) expect(pied, `${p.chemin} : ${lien}`).toContain(`href="${lien}"`);
  }
});

test('l’accueil : les formulaires partent là où le site les envoie aujourd’hui (Formspree pour la liste d’attente)', () => {
  const accueil = lire('index.html');
  expect(accueil).toContain('action="https://formspree.io/f/mqpeedoj"');
  expect(accueil).toContain('name="ville" value="Paris" checked');
  expect(accueil).toContain('name="_gotcha"');
});
