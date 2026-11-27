// Les captures de l'accueil « La salle » pour le propriétaire : iPhone 13 et Pixel 7 (le haut de page « avant », les cinq
// moments, le geste réussi, le texte à 200 %, « réduire les animations »), l'ordinateur à 1440 px (les cinq moments et le
// texte à 200 %), et un film de 10 s du défilement au téléphone (WebM, et MP4 si ffmpeg est là, pour l'iPhone).
// Avec une quatrième adresse (la branche avant le travail du jour), le haut de page « avant aujourd'hui » ; et pour le
// regard plissé, le premier écran de l'iPhone flouté à 12 px (premier-ecran-flou-12px.png).
// Usage : node tests/outils/captures-accueil.cjs <adresse de la branche> <adresse de main> <dossier de sortie> [<adresse d'avant>]
// (des serveurs locaux, par exemple npx http-server . et une copie de la version en ligne ; Formspree et GoatCounter bloqués).
const { chromium, devices } = require('playwright');
const [,, URL_B, URL_M, OUT, URL_AVANT] = process.argv;
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const MOMENTS = ['1842', '1930', '2015', '2055', '2100'];
const aller = (page, h) => page.evaluate((h) => {
  const m = document.querySelector(`[data-heure="${h}"]`);
  const salle = document.querySelector('.salle').getBoundingClientRect();
  const grand = window.matchMedia('(min-width: 960px)').matches;
  window.scrollTo({ top: h === '1842' ? 0 : m.getBoundingClientRect().top + window.scrollY - (grand ? window.innerHeight * 0.4 : salle.height + 24), behavior: 'instant' });
}, h);
const bloquer = (ctx) => ctx.route(/formspree|goatcounter/, (r) => r.abort());
(async () => {
  // Le Chromium de la machine quand il est là (celui des tests, tests/outils/environnement.mjs), sinon celui de Playwright.
  const installe = '/opt/pw-browsers/chromium';
  const b = await chromium.launch(fs.existsSync(installe) ? { executablePath: installe } : {});
  const appareils = [['iphone', devices['iPhone 13']], ['android', devices['Pixel 7']]];
  for (const [nom, d] of appareils) {
    const ctx = await b.newContext({ ...d }); await bloquer(ctx);
    const page = await ctx.newPage();
    await page.goto(URL_M, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${nom}-avant-haut.png` });
    if (URL_AVANT) {
      await page.goto(URL_AVANT, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${nom}-avant-aujourd-hui-haut.png` });
    }
    await page.goto(URL_B, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    if (nom === 'iphone') {
      // Le regard plissé : le premier écran, flouté de 12 px (CSS), à la même densité.
      const image = (await page.screenshot()).toString('base64');
      const flou = await ctx.newPage();
      await flou.setContent(`<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${image}" style="display:block;width:100vw;filter:blur(12px)"></body>`);
      await flou.waitForTimeout(300);
      await flou.screenshot({ path: `${OUT}/premier-ecran-flou-12px.png` });
      await flou.close();
    }
    for (const h of MOMENTS) { await aller(page, h); await page.waitForTimeout(1400); await page.screenshot({ path: `${OUT}/${nom}-${h}.png` }); }
    // le geste réussi, à 20:15
    await aller(page, '2015'); await page.waitForTimeout(600);
    const bt = page.locator('[data-maintiens]'); await bt.scrollIntoViewIfNeeded(); await aller(page, '2015');
    const box = await bt.boundingBox();
    if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up(); await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/${nom}-2015-place-gardee.png` }); }
    // texte à 200 %
    await page.goto(URL_B, { waitUntil: 'load' }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; return document.fonts.ready; }); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${nom}-texte-200-haut.png` });
    await aller(page, '2015'); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${nom}-texte-200-2015.png` });
    await ctx.close();
    // « réduire les animations » : chaque arrêt est une image fixe
    const rctx = await b.newContext({ ...d, reducedMotion: 'reduce' }); await bloquer(rctx);
    const rp = await rctx.newPage();
    await rp.goto(URL_B, { waitUntil: 'load' }); await rp.evaluate(() => document.fonts.ready);
    for (const h of ['1842', '2100']) { await aller(rp, h); await rp.waitForTimeout(600); await rp.screenshot({ path: `${OUT}/${nom}-reduit-${h}.png` }); }
    await rctx.close();
  }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); await bloquer(ctx);
  const page = await ctx.newPage();
  await page.goto(URL_M, { waitUntil: 'load' }); await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/ordinateur-avant-haut.png` });
  if (URL_AVANT) { await page.goto(URL_AVANT, { waitUntil: 'load' }); await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/ordinateur-avant-aujourd-hui-haut.png` }); }
  await page.goto(URL_B, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  for (const h of MOMENTS) { await aller(page, h); await page.waitForTimeout(1400); await page.screenshot({ path: `${OUT}/ordinateur-${h}.png` }); }
  await page.goto(URL_B, { waitUntil: 'load' }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; return document.fonts.ready; }); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ordinateur-texte-200-haut.png` });
  await ctx.close();
  // le film : 10 s de défilement au téléphone
  const fctx = await b.newContext({ ...devices['iPhone 13'], recordVideo: { dir: `${OUT}/film-tmp`, size: { width: 390, height: 844 } } }); await bloquer(fctx);
  const fp = await fctx.newPage();
  await fp.goto(URL_B, { waitUntil: 'load' }); await fp.evaluate(() => document.fonts.ready); await fp.waitForTimeout(900);
  const fin = await fp.evaluate(() => document.querySelector('[data-heure="2100"]').getBoundingClientRect().top + scrollY - 300);
  const t0 = Date.now();
  while (Date.now() - t0 < 8200) { const k = (Date.now() - t0) / 8200; const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2; await fp.evaluate((y) => window.scrollTo(0, y), fin * e); await fp.waitForTimeout(30); }
  await fp.waitForTimeout(1200);
  const v = fp.video(); await fctx.close(); fs.renameSync(await v.path(), `${OUT}/film-defilement-iphone.webm`); fs.rmSync(`${OUT}/film-tmp`, { recursive: true, force: true });
  try {
    require('child_process').execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/film-defilement-iphone.webm`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', `${OUT}/film-defilement-iphone.mp4`]);
  } catch (e) { console.log('ffmpeg absent ou en échec : le film reste en WebM'); }
  await b.close();
})();
