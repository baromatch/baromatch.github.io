// La mesure d’audience (marque.json, « mesure » ; generateur/mesure.mjs et /mesure.js) : arrêtée tant que le code est
// vide, et alors aucune page ne change ; active avec un code, chaque page compte sa visite et quelques gestes, sans
// cookie ni identifiant, et sa politique de sécurité n’admet que ce compte-là.
// Dans le navigateur, le site d’exemple (tests/outils/site-genere.mjs) est servi à l’adresse du vrai site,
// https://baromatch.fr (le seul endroit où /mesure.js compte), par des routes : rien ne part vers GoatCounter, ni vers
// un autre service. Chaque envoi à GoatCounter est gardé et répondu par un GIF, comme le vrai.
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { violationsAxe } from './outils/axe.mjs';
import { racine } from './outils/environnement.mjs';
import { construireLeSiteDExemple, contenuDuScenario, SCENARIO } from './outils/site-genere.mjs';
import { controlerLaPage } from '../generateur/controle.mjs';
import { politiqueDesPages } from '../generateur/gabarits.mjs';
import {
  appliquerAUnePage, appliquerLaMesure, baliseDeLaMesure, lireLaMesure, MESURE_ARRETEE, pagesEcritesALaMain, politiqueAvecLaMesure, TEXTES_DE_LA_MESURE,
} from '../generateur/mesure.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';

const MARQUE = JSON.parse(readFileSync(path.join(racine, 'marque.json'), 'utf8'));
const CODE = 'essai';
const AVEC = { ...MARQUE, mesure: { ...MARQUE.mesure, outil: 'goatcounter', code: CODE } };
const SANS = { ...MARQUE, mesure: { ...MARQUE.mesure, code: '' } };
const ACTIVE = lireLaMesure(AVEC);
const ORIGINE = `https://${CODE}.goatcounter.com`;
const SITE = 'https://baromatch.fr';
const lire = (relatif) => readFileSync(path.join(racine, relatif), 'utf8');
// Une page du dépôt sans mesure, que marque.json l’active ou non : le point de départ de chaque cas.
const sansMesure = (relatif) => appliquerAUnePage(lire(relatif), MESURE_ARRETEE);
const politiqueDe = (html) => [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)].map((m) => m[1]);
const directivesDe = (politique) => Object.fromEntries(politique.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [nom, ...valeurs] = d.split(/\s+/);
  return [nom, valeurs];
}));

// ---------- marque.json ----------

test.describe('le réglage de marque.json', () => {
  test('vide, la mesure est arrêtée ; un code, ou l’adresse du compte collée telle quelle, l’active', () => {
    expect(MARQUE.mesure).toEqual(expect.objectContaining({ outil: 'goatcounter', code: expect.any(String) }));
    expect(MARQUE.mesure._lisezMoi).toMatch(/GoatCounter/);
    for (const marque of [SANS, {}, { mesure: {} }, { mesure: { code: '  ' } }, { mesure: { outil: 'autre', code: '' } }]) {
      expect(lireLaMesure(marque)).toEqual({ active: false });
    }
    for (const colle of ['baromatch', ' Baromatch ', 'baromatch.goatcounter.com', 'https://baromatch.goatcounter.com', 'https://baromatch.goatcounter.com/count', '//baromatch.goatcounter.com/count']) {
      expect(lireLaMesure({ mesure: { code: colle } }), colle).toEqual({
        active: true, outil: 'goatcounter', code: 'baromatch', origine: 'https://baromatch.goatcounter.com', adresse: 'https://baromatch.goatcounter.com/count',
      });
    }
  });

  test('un code illisible ou un autre outil arrête tout, avec ce qu’il faut corriger', () => {
    for (const code of ['b', 'ba romatch', 'baromatch.fr', 'https://exemple.fr/count', '-baromatch', 'baromatch-', 'é'.repeat(3), 'a'.repeat(51)]) {
      expect(() => lireLaMesure({ mesure: { outil: 'goatcounter', code } }), code).toThrow(/marque\.json : « mesure » → « code » vaut .* Rien n’est écrit/);
    }
    expect(() => lireLaMesure({ mesure: { outil: 'plausible', code: 'baromatch' } })).toThrow(/seul « goatcounter » est prévu/);
  });
});

// ---------- Les pages écrites à la main ----------

test.describe('les pages écrites à la main', () => {
  const PAGES = pagesEcritesALaMain();

  test('la liste : chaque page .html servie, hors des pages générées et des outils', () => {
    expect(PAGES).toEqual(expect.arrayContaining(['index.html', '404.html', 'confidentialite.html', 'pour-les-bars.html', 'cgu.html']));
    expect(PAGES.filter((p) => /^(?:matchs|regarder-le-match|bar|ce-soir|en|agenda|tests|generateur|node_modules)\//.test(p))).toEqual([]);
  });

  test('elles sont déjà dans l’état que dit marque.json : l’Action n’aurait rien à réécrire', () => {
    const mesure = lireLaMesure(MARQUE);
    const ecarts = PAGES.filter((p) => appliquerAUnePage(lire(p), mesure) !== lire(p));
    expect(ecarts, 'lance « npm run mesure » : ces pages ne suivent pas « mesure » de marque.json').toEqual([]);
  });

  test('chaque page sauf la 404 a son adresse canonique : c’est elle que la mesure compte, sans « ? » ni « # »', () => {
    const sans = PAGES.filter((p) => p !== '404.html' && !/<link rel="canonical" href="https:\/\/baromatch\.fr\/[^"?#]*">/.test(lire(p)));
    expect(sans).toEqual([]);
  });

  test('arrêtée, la mesure ne touche à rien ; active, seulement la politique, la balise et le bloc de Confidentialité', () => {
    for (const p of PAGES) {
      const html = sansMesure(p);
      const active = appliquerAUnePage(html, ACTIVE);
      expect(appliquerAUnePage(html, MESURE_ARRETEE), p).toBe(html);
      expect(appliquerAUnePage(active, ACTIVE), `${p} : deux fois de suite`).toBe(active);
      expect(appliquerAUnePage(active, MESURE_ARRETEE), `${p} : arrêtée de nouveau`).toBe(html);
      // Une autre adresse de compte remplace la première.
      const autre = appliquerAUnePage(active, lireLaMesure({ mesure: { code: 'autre-compte' } }));
      expect(autre, p).not.toContain(ORIGINE);
      expect(autre.split('https://autre-compte.goatcounter.com').length - 1, p).toBe(2);

      // Ce qui change : la balise juste avant </head>, une fois ; la politique.
      expect(active.split(baliseDeLaMesure(ACTIVE)).length - 1, p).toBe(1);
      expect(active, p).toContain(`\n${baliseDeLaMesure(ACTIVE)}\n</head>`);
      const avant = politiqueDe(html);
      const apres = politiqueDe(active);
      expect(apres, p).toHaveLength(avant.length);
      if (!avant.length) continue;
      const a = directivesDe(avant[0]);
      const b = directivesDe(apres[0]);
      // connect-src : ce que la page admettait, plus le compte, et rien d’autre ; script-src : les fichiers du site.
      expect(b['connect-src'], p).toEqual([...(a['connect-src'] ?? ["'self'"]), ORIGINE]);
      expect(b['script-src'], p).toEqual(["'self'", ...a['script-src'].filter((v) => v !== "'self'" && v !== "'none'")]);
      expect(Object.keys(b).filter((nom) => !['connect-src', 'script-src'].includes(nom)).map((nom) => [nom, b[nom]]), p)
        .toEqual(Object.keys(a).filter((nom) => !['connect-src', 'script-src'].includes(nom)).map((nom) => [nom, a[nom]]));
    }
  });

  test('Confidentialité dit la vérité dans les deux cas, d’après generateur/contenu/mesure.json', () => {
    const html = sansMesure('confidentialite.html');
    const bloc = (page) => page.match(/<!-- mesure : début[\s\S]*?-->\n([\s\S]*?)\n[ \t]*<!-- mesure : fin -->/)?.[1];
    expect(bloc(html)).toBe(TEXTES_DE_LA_MESURE.confidentialite.arretee.join('\n'));
    expect(bloc(html)).toContain('pas de mesure d’audience');
    const active = appliquerAUnePage(html, ACTIVE);
    expect(bloc(active)).toBe(TEXTES_DE_LA_MESURE.confidentialite.active.join('\n'));
    const texte = bloc(active).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    // Ce que la CNIL demande de dire : l’outil, ce qui part, ce qui est gardé et combien de temps, pour qui, sur quelle
    // base, et comment refuser (Do Not Track, Global Privacy Control, le bouton, sans JavaScript).
    for (const attendu of ['GoatCounter', 'sans cookie', 'adresse IP', '24 mois', 'seulement Baromatch', 'intérêt légitime', 'CNIL', 'Do Not Track', 'Global Privacy Control', 'JavaScript', 'baromatch:mesure', '/t/']) {
      expect(texte, attendu).toContain(attendu);
    }
    expect(texte).not.toContain('pas de mesure d’audience');
    expect(texte).not.toMatch(/!/);
    expect(bloc(active)).toContain('id="mesure-refus"');
    // Les autres pages ne changent pas de texte.
    for (const p of PAGES.filter((x) => x !== 'confidentialite.html')) {
      const sansBalise = (page) => page.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<script src="\/mesure\.js"[^>]*><\/script>\n/, '');
      expect(sansBalise(appliquerAUnePage(sansMesure(p), ACTIVE)), p).toBe(sansBalise(sansMesure(p)));
    }
  });

  test('la ligne de commande : tout est contrôlé avant d’écrire, une page douteuse arrête tout', () => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'mesure-'));
    try {
      for (const p of ['index.html', 'cgu.html', 'confidentialite.html']) writeFileSync(path.join(dossier, p), sansMesure(p));
      // Les pages que le générateur écrit (matchs/, en/, agenda/…), déjà dans le dépôt.
      const generees = ['matchs/x/index.html', 'en/index.html', 'agenda/index.html'];
      for (const g of generees) {
        mkdirSync(path.dirname(path.join(dossier, g)), { recursive: true });
        writeFileSync(path.join(dossier, g), '<html><head>\n</head></html>');
      }
      writeFileSync(path.join(dossier, 'marque.json'), JSON.stringify(SANS));
      expect(appliquerLaMesure({ racine: dossier }).changees).toEqual([]);
      writeFileSync(path.join(dossier, 'marque.json'), JSON.stringify(AVEC));
      expect(appliquerLaMesure({ racine: dossier }).changees).toEqual(['cgu.html', 'confidentialite.html', 'index.html']);
      // Les pages des matchs, en anglais et de l’agenda sont au générateur : jamais touchées ici.
      for (const g of generees) expect(readFileSync(path.join(dossier, g), 'utf8'), g).toBe('<html><head>\n</head></html>');
      expect(appliquerLaMesure({ racine: dossier }).changees).toEqual([]);
      writeFileSync(path.join(dossier, 'marque.json'), JSON.stringify(SANS));
      expect(appliquerLaMesure({ racine: dossier }).changees).toEqual(['cgu.html', 'confidentialite.html', 'index.html']);
      for (const p of ['index.html', 'cgu.html', 'confidentialite.html']) expect(readFileSync(path.join(dossier, p), 'utf8')).toBe(sansMesure(p));

      // Deux politiques dans une page : rien n’est écrit, nulle part.
      const meta = politiqueDe(sansMesure('cgu.html'))[0];
      writeFileSync(path.join(dossier, 'cgu.html'), sansMesure('cgu.html').replace('<title>', `<meta http-equiv="Content-Security-Policy" content="${meta}">\n<title>`));
      writeFileSync(path.join(dossier, 'marque.json'), JSON.stringify(AVEC));
      expect(() => appliquerLaMesure({ racine: dossier })).toThrow(/rien n’est écrit\.\ncgu\.html : plusieurs politiques/);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(sansMesure('index.html'));
      // Un code illisible : rien non plus.
      writeFileSync(path.join(dossier, 'cgu.html'), sansMesure('cgu.html'));
      writeFileSync(path.join(dossier, 'marque.json'), JSON.stringify({ ...AVEC, mesure: { code: 'x y' } }));
      expect(() => appliquerLaMesure({ racine: dossier })).toThrow(/n’est pas un code GoatCounter/);
      expect(readFileSync(path.join(dossier, 'index.html'), 'utf8')).toBe(sansMesure('index.html'));
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('l’Action applique la mesure avant le générateur, aux deux passages, et n’enregistre en plus que les pages qu’elle a réécrites', () => {
    const action = lire('.github/workflows/pages-des-matchs.yml');
    const lignes = action.split('\n').map((l) => l.trim()).filter((l) => !l.startsWith('#'));
    const mesures = lignes.map((l, i) => [l, i]).filter(([l]) => l.includes('generateur/mesure.mjs'));
    expect(mesures.map(([l]) => l)).toEqual(['node generateur/mesure.mjs --ecrites="$RUNNER_TEMP/mesure.txt"', 'env -u JETON_GITHUB node generateur/mesure.mjs --ecrites="$mesure"']);
    const generateurs = lignes.map((l, i) => [l, i]).filter(([l]) => l.includes('node generateur/construire.mjs'));
    expect(mesures.map(([, i]) => i + (lignes[i + 1]?.startsWith('option=') ? 3 : 1))).toEqual(generateurs.map(([, i]) => i));
    expect(action).toContain('mesure="$RUNNER_TEMP/mesure.txt"');
    expect(action).toContain('if [ -s "$mesure" ]; then xargs -d \'\\n\' -a "$mesure" git add --; fi');
    expect(action).toContain('git diff --cached --name-only | grep -vxF -f "$mesure" | grep -vqE');
  });
});

// ---------- Les pages générées ----------

test.describe('les pages générées', () => {
  const MAINTENANT = Date.parse('2026-10-23T08:00:00Z');
  // Avec l’encodeur des QR codes : les affiches à imprimer comptent leurs visites comme les autres pages.
  const { qr } = chargerLeQr();
  const construireAvec = (marque) => construireEnMemoire({ source: `scenario:${SCENARIO}`, maintenant: MAINTENANT, racine, contenu: { ...contenuDuScenario(), marque }, qr });

  test('arrêtée : ni balise, ni GoatCounter ; active : la balise une fois, et le compte dans la politique', async () => {
    const sans = await construireAvec(SANS);
    for (const p of sans.pages) {
      expect(p.contenu, p.chemin).not.toContain('mesure.js');
      expect(p.contenu, p.chemin).not.toContain('goatcounter');
      expect(politiqueDe(p.contenu), p.chemin).toEqual([politiqueDesPages(MESURE_ARRETEE)]);
    }
    const avec = await construireAvec(AVEC);
    expect(avec.refusees).toEqual([]);
    expect(avec.pages.length).toBe(sans.pages.length);
    // Toutes les sortes de pages : les affiches, l’agenda et les pages en anglais comprises.
    expect(new Set(avec.pages.map((p) => p.type))).toEqual(new Set(['match', 'semaine', 'villes', 'ville', 'bar', 'ce-soir', 'agenda', 'affiche', 'affiche-bar', 'match-en', 'guide-en']));
    for (const p of avec.pages) {
      expect(p.contenu.split('<script src="/mesure.js"').length - 1, p.chemin).toBe(1);
      expect(p.contenu, p.chemin).toContain(`${baliseDeLaMesure(ACTIVE)}\n<script type="application/ld+json">`);
      expect(politiqueDe(p.contenu), p.chemin).toEqual([politiqueAvecLaMesure(politiqueDesPages(MESURE_ARRETEE), ACTIVE)]);
      expect(directivesDe(politiqueDe(p.contenu)[0])['connect-src'], p.chemin).toEqual(["'self'", ORIGINE]);
    }
  });

  test('le contrôle exige exactement la balise de la mesure, et seulement quand elle est active', async () => {
    const avec = await construireAvec(AVEC);
    const p = avec.pages.find((x) => x.chemin === '/matchs/psg-ol-2026-10-25/');
    expect(controlerLaPage(p, { mesure: ACTIVE })).toEqual([]);
    const controler = (remplacer, mesure = ACTIVE) => controlerLaPage({ ...p, contenu: remplacer(p.contenu) }, { mesure }).join('\n');
    const balise = baliseDeLaMesure(ACTIVE);
    expect(controler((h) => h.replace(`${balise}\n`, ''))).toMatch(/0 balises de la mesure d’audience pour une mesure active/);
    expect(controler((h) => h.replace(balise, `${balise}\n${balise}`))).toMatch(/2 balises/);
    for (const autre of [
      '<script src="/mesure.js" data-mesure="https://autre.goatcounter.com/count" defer></script>',
      '<script src="/mesure.js" data-mesure="https://essai.goatcounter.com/count"></script>',
      '<script src="https://gc.zgo.at/count.js" data-goatcounter="https://essai.goatcounter.com/count" async></script>',
    ]) {
      expect(controler((h) => h.replace(balise, autre)), autre).toMatch(/un script autre que les données structurées et le partage/);
    }
    // La politique d’une mesure arrêtée, ou d’un autre compte, est refusée.
    expect(controler((h) => h.replace(`connect-src 'self' ${ORIGINE};`, "connect-src 'self';"))).toMatch(/politique de sécurité/);
    // La même page, la mesure arrêtée : refusée (la balise, la politique).
    expect(controlerLaPage(p, { mesure: MESURE_ARRETEE }).join('\n')).toMatch(/politique de sécurité[\s\S]*1 balises de la mesure d’audience pour une mesure arrêtée/);
  });

  test('un code illisible dans marque.json arrête le passage avant toute page', async () => {
    await expect(construireAvec({ ...MARQUE, mesure: { outil: 'goatcounter', code: 'pas un code' } })).rejects.toThrow(/n’est pas un code GoatCounter/);
  });
});

// ---------- Dans le navigateur, à l’adresse du vrai site ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4',
};
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Le site d’exemple servi à https://baromatch.fr comme GitHub Pages le sert (index.html d’un dossier, 404.html pour une
// adresse inconnue) ; GoatCounter simulé ; tout autre service refusé et noté (sorties). Formspree et l’API des bars se
// simulent par une route ajoutée ensuite (la dernière ajoutée passe devant).
const servir = async (contexte, dossier) => {
  const envois = [];
  const sorties = [];
  await contexte.route(() => true, async (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    if (url.origin === SITE) {
      const relatif = decodeURIComponent(url.pathname).replace(/^\//, '');
      const candidats = [relatif.endsWith('/') || relatif === '' ? `${relatif}index.html` : relatif, `${relatif}.html`];
      const trouve = candidats.find((c) => existsSync(path.join(dossier, c)) && !c.endsWith('/'));
      const fichier = trouve ?? '404.html';
      return route.fulfill({ status: trouve ? 200 : 404, contentType: TYPES[path.extname(fichier)] ?? 'application/octet-stream', body: readFileSync(path.join(dossier, fichier)) });
    }
    if (url.hostname.endsWith('.goatcounter.com')) {
      envois.push({ methode: requete.method(), url, entetes: await requete.allHeaders() });
      return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF, headers: { 'access-control-allow-origin': '*' } });
    }
    sorties.push(url.href);
    return route.abort('blockedbyclient');
  });
  return { envois, sorties };
};
// Ce qui est parti vers GoatCounter, lisible : « p=…&e=… » pour chaque envoi.
const lisibles = (envois) => envois.map(({ url }) => Object.fromEntries(url.searchParams));
const ouvrir = async (onglet, chemin, options) => {
  await onglet.goto(`${SITE}${chemin}`, options);
  await onglet.waitForLoadState('networkidle');
};

let siteSans;
let siteAvec;
test.beforeAll(async () => {
  siteSans = mkdtempSync(path.join(tmpdir(), 'mesure-sans-'));
  siteAvec = mkdtempSync(path.join(tmpdir(), 'mesure-avec-'));
  await construireLeSiteDExemple(siteSans, { marque: SANS });
  await construireLeSiteDExemple(siteAvec, { marque: AVEC });
});
test.afterAll(() => {
  for (const dossier of [siteSans, siteAvec]) if (dossier) rmSync(dossier, { recursive: true, force: true });
});

const CHEMINS = [
  '/', '/cgu.html', '/confidentialite.html', '/pour-les-bars.html', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/', '/ce-soir/', '/matchs/',
  '/matchs/affiche/', '/agenda/', '/en/', '/t/abcdefghjkmn',
];

test.describe('le code vide', () => {
  test('aucune page ne charge /mesure.js ni n’envoie rien à GoatCounter', async ({ context, page }) => {
    const { envois, sorties } = await servir(context, siteSans);
    const scripts = [];
    page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname); });
    for (const chemin of CHEMINS) {
      await ouvrir(page, chemin);
      expect(await page.locator('script[src="/mesure.js"]').count(), chemin).toBe(0);
      expect(await page.content(), chemin).not.toContain('goatcounter');
    }
    expect(scripts).not.toContain('/mesure.js');
    expect(envois).toEqual([]);
    expect(sorties.filter((s) => !s.startsWith('https://api-production-8ce4.up.railway.app/'))).toEqual([]);
  });
});

test.describe('avec un code', () => {
  test('chaque page : une visite, son adresse sans « ? » ni « # », sans cookie, référent ni stockage, sans violation de la politique', async ({ context, page }) => {
    const { envois, sorties } = await servir(context, siteAvec);
    const violations = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    const attendus = {
      '/': '/', '/cgu.html': '/cgu.html', '/confidentialite.html': '/confidentialite.html', '/pour-les-bars.html': '/pour-les-bars.html',
      '/matchs/psg-ol-2026-10-25/': '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/': '/regarder-le-match/paris/', '/ce-soir/': '/ce-soir/',
      '/matchs/': '/matchs/', '/matchs/affiche/': '/matchs/affiche/', '/agenda/': '/agenda/', '/en/': '/en/', '/t/abcdefghjkmn': '/t/',
    };
    for (const [chemin, compte] of Object.entries(attendus)) {
      const avant = envois.length;
      await ouvrir(page, `${chemin}?utm_source=essai&email=paul%40exemple.fr#attente`);
      await expect.poll(() => envois.length, chemin).toBe(avant + 1);
      expect(lisibles(envois.slice(avant)), chemin).toEqual([{ p: compte, b: '153' }]);
    }
    await ouvrir(page, '/une-adresse-inconnue?x=1');
    await expect.poll(() => lisibles(envois).at(-1)).toEqual({ p: '/404', b: '153' });
    for (const { methode, url, entetes } of envois) {
      expect(methode).toBe('POST');
      expect(url.origin + url.pathname).toBe(`${ORIGINE}/count`);
      expect(entetes.cookie).toBeUndefined();
      expect(entetes.referer).toBeUndefined();
    }
    expect(violations).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, document.cookie])).toEqual([0, '']);
    expect(sorties.filter((s) => !s.startsWith('https://api-production-8ce4.up.railway.app/'))).toEqual([]);
  });

  test('l’affiche de la semaine : sa visite compte, les cases cochées et le papier choisi ne partent pas', async ({ context, page }) => {
    const { envois, sorties } = await servir(context, siteAvec);
    await ouvrir(page, '/matchs/affiche/');
    await expect.poll(() => lisibles(envois)).toEqual([{ p: '/matchs/affiche/', b: '153' }]);
    await page.locator('label.affiche-ligne__texte').first().click();
    await page.locator('#affiche-a3').check();
    await page.waitForTimeout(300);
    expect(await page.locator('.affiche-case:checked').count()).toBe(1);
    expect(lisibles(envois)).toEqual([{ p: '/matchs/affiche/', b: '153' }]);
    expect(sorties).toEqual([]);
  });

  test('le site d’où l’on vient : seulement son nom, et rien depuis une page du site', async ({ context, page }) => {
    const { envois } = await servir(context, siteAvec);
    await ouvrir(page, '/matchs/', { referer: 'https://www.google.com/search?q=ou+regarder+psg+ol&client=abc' });
    await expect.poll(() => lisibles(envois)).toEqual([{ p: '/matchs/', r: 'https://www.google.com', b: '153' }]);
    await page.locator('a[href="/matchs/psg-ol-2026-10-25/"]').first().click();
    await expect.poll(() => lisibles(envois).at(-1)).toEqual({ p: '/matchs/psg-ol-2026-10-25/', b: '153' });
  });

  test('les gestes : un lien vers la liste d’attente, l’inscription d’une page de ville, un magasin, data-compter', async ({ context, page }) => {
    const { envois } = await servir(context, siteAvec);
    const formspree = [];
    await context.route(/formspree\.io/, (route) => {
      formspree.push(route.request().method());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' });
    });
    const evenements = () => lisibles(envois).filter((e) => e.e === 'true');

    await ouvrir(page, '/matchs/psg-ol-2026-10-25/');
    await page.locator('a[href="/#attente"]').first().click();
    await page.waitForURL(`${SITE}/#attente`);
    await expect.poll(evenements).toEqual([{ p: 'lien-liste-attente /matchs/psg-ol-2026-10-25/', e: 'true', b: '153' }]);

    // Une adresse refusée par le navigateur : rien ne part, rien n’est compté.
    await ouvrir(page, '/regarder-le-match/paris/');
    await page.locator('#attente-mail').fill('paul@');
    await page.locator('#attente button[type="submit"]').click();
    await page.waitForTimeout(300);
    expect(evenements()).toHaveLength(1);
    await page.locator('#attente-mail').fill('paul@exemple.fr');
    await page.locator('#attente button[type="submit"]').click();
    await page.waitForURL(/formspree\.io/);
    await expect.poll(evenements).toHaveLength(2);
    expect(evenements()[1]).toEqual({ p: 'liste-attente /regarder-le-match/paris/', e: 'true', b: '153' });
    expect(formspree).toEqual(['POST']);
    // Ni l’adresse, ni la ville, nulle part dans ce qui part à GoatCounter.
    expect(JSON.stringify(lisibles(envois))).not.toMatch(/paul|exemple|Paris"/);

    // Un lien vers un magasin, et un élément marqué data-compter (l’affiche, par exemple).
    await context.route(/play\.google\.com|apps\.apple\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Magasin</p>' }));
    await ouvrir(page, '/cgu.html');
    await page.evaluate(() => {
      const lien = document.createElement('a');
      lien.href = 'https://play.google.com/?referrer=x';
      lien.textContent = 'Android';
      lien.id = 'magasin';
      const bouton = document.createElement('button');
      bouton.setAttribute('data-compter', 'affiche-imprimee');
      bouton.innerHTML = '<span>Imprimer</span>';
      bouton.id = 'affiche';
      const nul = document.createElement('button');
      nul.setAttribute('data-compter', 'Pas Un Nom');
      nul.id = 'nul';
      document.querySelector('main').append(lien, bouton, nul);
    });
    await page.locator('#affiche span').click();
    await page.locator('#nul').click();
    await page.locator('#magasin').click();
    await page.waitForURL(/play\.google\.com/);
    await expect.poll(evenements).toHaveLength(4);
    expect(evenements().slice(2)).toEqual([
      { p: 'affiche-imprimee /cgu.html', e: 'true', b: '153' },
      { p: 'appli-android /cgu.html', e: 'true', b: '153' },
    ]);
  });

  test('l’accueil : une inscription réussie compte, une adresse refusée par Formspree non', async ({ context, page }) => {
    const { envois } = await servir(context, siteAvec);
    let statut = 422;
    await context.route(/formspree\.io/, (route) => route.fulfill({
      status: statut, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(statut === 200 ? { ok: true } : { errors: [{ code: 'TYPE_EMAIL', field: 'email' }] }),
    }));
    const evenements = () => lisibles(envois).filter((e) => e.e === 'true');
    await ouvrir(page, '/');
    await page.locator('#attente-mail').fill('paul@exemple.fr');
    await page.locator('#attente button[type="submit"]').click();
    await expect(page.locator('#attente-retour')).toContainText('Cette adresse ne semble pas valide');
    expect(evenements()).toEqual([]);
    statut = 200;
    await page.locator('#attente-ville-1').check();
    await page.locator('#attente button[type="submit"]').click();
    await expect(page.locator('#attente-retour')).toContainText('C’est noté');
    await expect.poll(evenements).toEqual([{ p: 'liste-attente /', e: 'true', b: '153' }]);
    expect(JSON.stringify(lisibles(envois))).not.toMatch(/paul|Lyon/);
  });

  test('« Proposer mon bar » : une demande envoyée compte, sans rien de ce qui est écrit', async ({ context, page }) => {
    const { envois } = await servir(context, siteAvec);
    await context.route('https://api-production-8ce4.up.railway.app/api/public/bar-contact', (route) => route.fulfill({
      status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}',
    }));
    await page.clock.install();
    await ouvrir(page, '/pour-les-bars.html');
    await expect(page.locator('#demande')).toBeVisible();
    for (const [champ, valeur] of Object.entries({ '#demande-bar': 'Le Zinc des Amis', '#demande-ville': 'Paris', '#demande-nom': 'Camille Martin', '#demande-email': 'camille@lezinc.fr' })) {
      await page.fill(champ, valeur);
    }
    await page.check('#demande-accord');
    await page.clock.fastForward(3000);
    await page.click('#demande-envoyer');
    await expect(page.locator('#demande-envoyee')).toBeVisible();
    await expect.poll(() => lisibles(envois).filter((e) => e.e === 'true')).toEqual([{ p: 'proposer-mon-bar /pour-les-bars.html', e: 'true', b: '153' }]);
    expect(JSON.stringify(lisibles(envois))).not.toMatch(/Zinc|Camille|lezinc/);
  });

  for (const [nom, signal] of [['Do Not Track', 'doNotTrack'], ['Global Privacy Control', 'globalPrivacyControl']]) {
    test(`${nom} : rien n’est compté, ni la visite ni les gestes, et Confidentialité le dit`, async ({ context, page }) => {
      const { envois } = await servir(context, siteAvec);
      await context.addInitScript((cle) => {
        Object.defineProperty(Navigator.prototype, cle, { get: () => (cle === 'doNotTrack' ? '1' : true), configurable: true });
      }, signal);
      for (const chemin of ['/', '/matchs/psg-ol-2026-10-25/', '/confidentialite.html']) await ouvrir(page, chemin);
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('baromatch:compter', { detail: 'liste-attente' })));
      await expect(page.locator('#mesure-refus-statut')).toHaveText('Ton navigateur demande déjà de ne pas être suivi : tes visites ne sont pas comptées.');
      await expect(page.locator('#mesure-refus-bouton')).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(envois).toEqual([]);
    });
  }

  test('Confidentialité : refuser la mesure sur ce navigateur, puis l’accepter de nouveau', async ({ context, page }) => {
    const { envois } = await servir(context, siteAvec);
    await ouvrir(page, '/confidentialite.html');
    await expect.poll(() => envois.length).toBe(1);
    const bouton = page.locator('#mesure-refus-bouton');
    await expect(page.locator('#mesure-refus')).toBeVisible();
    await expect(bouton).toHaveText('Ne plus compter mes visites');
    expect(await violationsAxe(page)).toEqual([]);
    expect(Math.round((await bouton.boundingBox()).height)).toBeGreaterThanOrEqual(44);
    await bouton.click();
    await expect(page.locator('#mesure-refus-statut')).toHaveText('C’est noté : tes visites ne sont plus comptées sur ce navigateur.');
    await expect(bouton).toHaveText('Compter de nouveau mes visites');
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ 'baromatch:mesure': 'refus' });
    for (const chemin of ['/', '/matchs/psg-ol-2026-10-25/']) await ouvrir(page, chemin);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('baromatch:compter', { detail: 'liste-attente' })));
    await page.waitForTimeout(300);
    expect(envois).toHaveLength(1);
    await ouvrir(page, '/confidentialite.html');
    await expect(bouton).toHaveText('Compter de nouveau mes visites');
    await bouton.click();
    await expect(page.locator('#mesure-refus-statut')).toHaveText('C’est noté : tes visites sont de nouveau comptées sur ce navigateur.');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await ouvrir(page, '/');
    await expect.poll(() => lisibles(envois).at(-1)).toEqual({ p: '/', b: '153' });
  });

  test('hors de https://baromatch.fr (une copie du site, les tests en local), rien n’est compté', async ({ context, page }) => {
    const envois = [];
    await context.route(/goatcounter\.com/, (route) => {
      envois.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
    });
    await context.route(/^http:\/\/copie\.exemple\//, (route) => {
      const relatif = new URL(route.request().url()).pathname.replace(/^\//, '') || 'index.html';
      const fichier = path.join(siteAvec, relatif.endsWith('/') ? `${relatif}index.html` : relatif);
      return existsSync(fichier)
        ? route.fulfill({ status: 200, contentType: TYPES[path.extname(fichier)] ?? 'application/octet-stream', body: readFileSync(fichier) })
        : route.fulfill({ status: 404, body: '' });
    });
    for (const chemin of ['/', '/cgu.html', '/matchs/psg-ol-2026-10-25/']) {
      await page.goto(`http://copie.exemple${chemin}`);
      await page.waitForLoadState('networkidle');
      expect(await page.locator('script[src="/mesure.js"]').count()).toBe(1);
    }
    expect(envois).toEqual([]);
  });

  test('sans JavaScript, rien n’est compté, et Confidentialité garde le bouton caché', async ({ browser }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false });
    const { envois } = await servir(contexte, siteAvec);
    const onglet = await contexte.newPage();
    for (const chemin of ['/', '/matchs/psg-ol-2026-10-25/', '/confidentialite.html']) await ouvrir(onglet, chemin);
    await expect(onglet.locator('#mesure-refus')).toBeHidden();
    expect(envois).toEqual([]);
    await contexte.close();
  });
});
