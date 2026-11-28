// Les captures de l'en-tête et du pied de page pour le propriétaire, sur les pages qui comptent : l'accueil, « Pour les
// bars », un match, Ce soir, La semaine, À propos, Presse, la Confidentialité, les CGU (de nuit), une ville, la page
// introuvable, « For bars ».
// Au téléphone (iPhone 13, 390 px ; Pixel 7, 412 px) : le premier écran, le milieu de la page (la barre du bas) et le pied ;
// à l'ordinateur (1440 px) : le premier écran et le pied. Puis, à 390 px, le texte à 200 % (premier écran, milieu, pied),
// « réduire les animations » (premier écran et milieu), et le premier écran flouté de 12 px (le regard plissé).
// Usage : node tests/outils/captures-cadre.cjs <adresse du site> <dossier de sortie> <préfixe> [pages séparées par des virgules]
// Les images sont en JPEG (qualité 82) : le dossier de relecture reste léger.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const [,, BASE, OUT, PREFIXE = 'apres', CHOIX] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const TOUTES = {
  accueil: '/',
  bars: '/pour-les-bars.html',
  match: '/matchs/arsenal-man-city-2026-11-29/',
  'ce-soir': '/ce-soir/',
  semaine: '/matchs/',
  'a-propos': '/a-propos.html',
  presse: '/presse.html',
  confidentialite: '/confidentialite.html',
  cgu: '/cgu.html',
  ville: '/regarder-le-match/paris/',
  introuvable: '/404.html',
  'for-bars': '/en/for-bars/',
};
const IMAGE = { type: 'jpeg', quality: 82 };
const PAGES = CHOIX ? Object.fromEntries(CHOIX.split(',').map((n) => [n, TOUTES[n]])) : TOUTES;
const bloquer = (ctx) => ctx.route(/formspree|goatcounter|api\.baromatch/, (r) => r.abort());
const charger = async (page, url, { texte200 = false } = {}) => {
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate((t) => { if (t) document.documentElement.style.fontSize = '200%'; return document.fonts.ready; }, texte200);
  await page.waitForTimeout(700);
};
const milieu = (page) => page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.45, behavior: 'instant' }));
const pied = async (page, chemin) => {
  const p = page.locator('footer.pied').first();
  if (await p.count()) { await p.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await p.screenshot({ path: chemin, ...IMAGE }); }
};
const flou = async (ctx, image, chemin) => {
  const f = await ctx.newPage();
  await f.setContent(`<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${image.toString('base64')}" style="display:block;width:100vw;filter:blur(12px)"></body>`);
  await f.waitForTimeout(300); await f.screenshot({ path: chemin, ...IMAGE }); await f.close();
};
(async () => {
  const installe = '/opt/pw-browsers/chromium';
  const b = await chromium.launch(fs.existsSync(installe) ? { executablePath: installe } : {});
  const appareils = [['390', devices['iPhone 13']], ['412', devices['Pixel 7']], ['1440', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]];
  for (const [nom, d] of appareils) {
    const ctx = await b.newContext({ ...d }); await bloquer(ctx);
    const page = await ctx.newPage();
    for (const [p, chemin] of Object.entries(PAGES)) {
      await charger(page, BASE + chemin);
      const haut = await page.screenshot({ path: `${OUT}/${PREFIXE}-${p}-${nom}-haut.jpg`, ...IMAGE });
      if (nom === '390') await flou(ctx, haut, `${OUT}/${PREFIXE}-${p}-${nom}-flou-12px.jpg`);
      if (nom !== '1440') { await milieu(page); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${PREFIXE}-${p}-${nom}-milieu.jpg`, ...IMAGE }); }
      await pied(page, `${OUT}/${PREFIXE}-${p}-${nom}-pied.jpg`);
    }
    await ctx.close();
  }
  // Le texte à 200 % et « réduire les animations », à 390 px.
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); await bloquer(ctx);
  const page = await ctx.newPage();
  const rctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' }); await bloquer(rctx);
  const rp = await rctx.newPage();
  for (const [p, chemin] of Object.entries(PAGES)) {
    await charger(page, BASE + chemin, { texte200: true });
    await page.screenshot({ path: `${OUT}/${PREFIXE}-${p}-390-texte200-haut.jpg`, ...IMAGE });
    await milieu(page); await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${PREFIXE}-${p}-390-texte200-milieu.jpg`, ...IMAGE });
    await pied(page, `${OUT}/${PREFIXE}-${p}-390-texte200-pied.jpg`);
    await charger(rp, BASE + chemin);
    await rp.screenshot({ path: `${OUT}/${PREFIXE}-${p}-390-reduit-haut.jpg`, ...IMAGE });
    await milieu(rp); await rp.waitForTimeout(300);
    await rp.screenshot({ path: `${OUT}/${PREFIXE}-${p}-390-reduit-milieu.jpg`, ...IMAGE });
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
