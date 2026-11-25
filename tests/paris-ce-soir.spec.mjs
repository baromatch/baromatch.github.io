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
        // Par scène (un match) : une seule ligne honnête qui nomme les arrondissements allumés, jamais une rangée de lignes
        // toutes pareilles.
        expect(plan, `${p.chemin} : plus de rangée de bars de démonstration`).not.toMatch(/bar--demo|bars--demo/);
        const scenes = plan.split('<div class="scene"').slice(1);
        expect(scenes.length, `${p.chemin} : des scènes`).toBeGreaterThan(0);
        for (const scene of scenes) {
          expect([...scene.matchAll(/class="liste__compte liste__compte--demo"/g)].length, `${p.chemin} : une seule ligne de démo`).toBe(1);
          expect(scene.match(/<p class="liste__compte liste__compte--demo">([^<]*)<\/p>/)[1], p.chemin).toContain('Les bars publiés s’afficheront ici.');
          expect([...scene.matchAll(/<use class="allume" href="#pl-a\d+"\/>/g)].length, `${p.chemin} : des arrondissements allumés`).toBeGreaterThanOrEqual(5);
        }
      } else {
        expect(plan, p.chemin).not.toContain('class="allume"');
      }
    }
    // Les exemples d’avant (des noms de bars inventés) ne reviennent nulle part.
    for (const p of site.pages) expect(p.contenu, p.chemin).not.toMatch(/Lucarne Lunaire|Poteau Rentrant|Reprise de Volée|Petit Pont|Grand Filet/);
  });

  test('l’accueil : le bloc du prochain match dit « Aucun bar encore pour ce match. », sans bar posé ni inventé', async () => {
    const site = await fabriquer(sansBarPublie);
    const { blocDeLaSemaine } = await import('../generateur/accueil.mjs');
    const bloc = blocDeLaSemaine({ donnees: site.donnees, textes: sansBarPublie.textes, marque: sansBarPublie.marque, maintenant: VENDREDI });
    expect(bloc).toContain('Aucun bar encore pour ce match.');
    expect(bloc).not.toContain('class="pin');
    expect(bloc).not.toMatch(/Voir les bars|data-voir-bars/);
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

  test('« Garder ta place dans l’appli » : le lien de « Ce soir », la démo, jamais une réservation', async () => {
    const site = await fabriquer(sansBarPublie);
    const ceSoir = pageDe(site, '/ce-soir/').contenu;
    expect(ceSoir).toContain('Garder ta place dans l’appli');
    expect(ceSoir, 'pas de geste sans le script qui le fait').not.toContain('data-hold');
    expect(ceSoir.replace(/\u00a0/g, ' ')).toContain('Démo : rien n’est réservé. Pour de vrai, c’est dans l’appli.');
    for (const bouton of ceSoir.matchAll(/<a class="tenir__btn"[\s\S]*?<\/a>/g)) expect(texteVisible(`<body>${bouton[0]}`)).not.toMatch(MENTION);
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

  test('le contrôle des pages refuse plan.js sur une page générée : l’Action ne peut pas le remettre', async () => {
    const site = await fabriquer(sansBarPublie);
    const p = pageDe(site, '/ce-soir/');
    expect(controlerLaPage(p), 'la page telle qu’elle est').toEqual([]);
    const avecLeScript = { ...p, contenu: p.contenu.replace('</head>', '<script src="/plan.js" defer></script>\n</head>') };
    expect(controlerLaPage(avecLeScript).join(' ')).toMatch(/un script autre que/);
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

// ---------- Le bandeau du bas : rien de fixe à l’arrivée, jamais deux barres fixes ----------

test.describe('pour les bars au téléphone : rien de fixe au premier écran, jamais plus d’une barre fixe en bas', () => {
  for (const texte of [100, 200]) {
    test(`390 × 844, texte à ${texte} % : au plus une barre fixe à chaque pas du défilement, aucune à l’arrivée`, async ({ browser }) => {
      const contexte = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const onglet = await contexte.newPage();
      await onglet.goto('/pour-les-bars.html');
      await onglet.waitForLoadState('networkidle');
      await onglet.evaluate((pc) => { document.documentElement.style.fontSize = `${pc}%`; }, texte);
      const fixes = () => onglet.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
        const s = getComputedStyle(e);
        if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      }).map((e) => e.className || e.tagName));
      expect(await fixes(), 'à l’arrivée, rien n’est fixe').toEqual([]);
      const pas = await onglet.evaluate(() => Math.ceil(document.documentElement.scrollHeight / 250));
      for (let i = 0; i <= pas; i += 1) {
        await onglet.evaluate((y) => window.scrollTo(0, y), i * 250);
        await onglet.waitForTimeout(60);
        const lues = await fixes();
        const y = await onglet.evaluate(() => window.pageYOffset);
        expect(lues.length, `à ${y} px : ${lues.join(', ')}`).toBeLessThanOrEqual(1);
      }
      await contexte.close();
    });
  }
});

// ---------- L'accueil à l'ordinateur : pas de moitié vide au premier écran ----------


test('planDeParis : sans match, rien', async () => {
  const site = await fabriquer(sansBarPublie);
  expect(planDeParis({ matchs: [], donnees: site.donnees, marque: sansBarPublie.marque, chemin: '/ce-soir/', maintenant: VENDREDI })).toBe('');
});

// ---------- L’accueil, au téléphone ----------

test.describe('l’accueil à 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('chaque étiquette « Démo » fait au moins 12 px, et son contraste est d’au moins 4,5:1', async ({ page }) => {
    await page.goto('/');
    const etiquettes = await page.$$eval('.etiquette-demo', (liste) => liste.filter((e) => e.offsetParent !== null).map((e) => {
      const s = getComputedStyle(e);
      return { taille: parseFloat(s.fontSize), couleur: s.color, fond: s.backgroundColor };
    }));
    expect(etiquettes.length).toBeGreaterThan(1);
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
