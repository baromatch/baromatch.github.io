// La condition du propriétaire pour le bandeau du bas, mot pour mot : « au téléphone, le bandeau du bas ne cache jamais
// rien (la fin des pages, « Proposer mon bar », les boutons d’un formulaire) et respecte la zone basse de l’iPhone et la
// barre d’outils de Safari ». Vérifié dans Chromium, sur chaque page écrite à la main et sur les pages des matchs d’un
// site d’exemple, à 390 et 375 px de large, texte à 100 et 200 % (un font-size posé sur <html>, que les media queries ne
// voient pas : le bandeau reste en bas et grandit de rangs, le cas le plus dur), avec la zone basse de l’iPhone simulée
// (--zone-basse à 34 px, ce que vaut env(safe-area-inset-bottom) sur un iPhone à encoche) :
// - la fin de la page remonte au-dessus du bandeau ;
// - « Proposer mon bar » et chaque bouton de formulaire, amenés en bas de l’écran (comme le fait une ancre ou le focus),
//   s’arrêtent au-dessus du bandeau ;
// - un champ texte qui a le focus efface le bandeau (le clavier est là) ; une puce (radio) le laisse ;
// - à la tabulation, aucun arrêt n’est sous le bandeau ;
// - sur la boutique, le bandeau laisse la barre de sélection seule en bas ;
// - le bandeau est à 10 px au moins du bord, plus la zone basse.
// Avec le vrai réglage du navigateur (la taille du texte à 200 %, que les media queries voient), le bandeau devient une
// rangée sous le logo, dans la page : rien de fixe en bas. La page ne demande jamais viewport-fit=cover (Safari garde
// la zone basse hors de la page) et le bandeau ne se règle sur aucune hauteur d’écran (vh). Safari n’est pas installé
// ici : un vrai iPhone reste à essayer (barre d’outils, clavier ouvert sur un champ).
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { attendreLaPageFinie } from './outils/attente.mjs';
import { racine } from './outils/environnement.mjs';
import { couperLAPI } from './outils/invitation.mjs';
import { PAGES } from './outils/pages.mjs';
import { demarrerServeur } from './outils/serveur.mjs';
import { construireLeSiteDExemple } from './outils/site-genere.mjs';

const ZONE_BASSE = 34;
const BORD = 10;
const CAS = [
  { largeur: 390, hauteur: 844, texte: 100 },
  { largeur: 390, hauteur: 844, texte: 200 },
  { largeur: 375, hauteur: 667, texte: 100 },
  { largeur: 375, hauteur: 667, texte: 200 },
];
// Les pages des matchs du site d’exemple : la semaine, « Ce soir », un match, une ville (avec sa liste d’attente), un
// club, un bar, et une page en anglais.
const GENEREES = ['/matchs/', '/ce-soir/', '/matchs/psg-ol-2026-10-25/', '/regarder-le-match/paris/', '/matchs/club/psg/', '/bar/le-zinc-des-amis-paris-11/', '/en/'];

const portLibre = () => new Promise((resoudre) => {
  const sonde = createServer();
  sonde.listen(0, '127.0.0.1', () => {
    const { port } = sonde.address();
    sonde.close(() => resoudre(port));
  });
});

let site = null;
test.beforeAll(async () => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'bandeau-du-bas-'));
  site = { dossier };
  await construireLeSiteDExemple(dossier, { rendu: null });
  site.serveur = await demarrerServeur(await portLibre(), -1, { dossier });
});
test.afterAll(async () => {
  await site?.serveur?.arreter();
  if (site) rmSync(site.dossier, { recursive: true, force: true });
});

// Deux outils que le test pose dans la page : le bandeau tel qu’il est peint (fixe ou dans la page, visible ou effacé,
// sa boîte), et la boîte d’un élément (une case cachée se voit par son étiquette).
const OUTILS = () => {
  window.bandeauDuBas = () => {
    const menu = document.querySelector('.menu');
    const s = getComputedStyle(menu);
    const r = menu.querySelector('.menu__liste').getBoundingClientRect();
    return { fixe: s.position === 'fixed', visible: s.visibility !== 'hidden', haut: r.top, bas: r.bottom, ecran: innerHeight };
  };
  window.boiteDuBandeau = (e) => {
    const cible = e.getBoundingClientRect().width < 2 ? (e.closest('label') ?? e.parentElement) : e;
    const r = cible.getBoundingClientRect();
    const quoi = (e.getAttribute('aria-label') || e.textContent || e.name || e.id || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
    return { quoi, haut: r.top, bas: r.bottom, hauteur: r.height, dansLeMenu: !!e.closest('.menu') };
  };
};

const ouvrir = async (onglet, adresse, { largeur, hauteur, texte }) => {
  await couperLAPI(onglet);
  await onglet.setViewportSize({ width: largeur, height: hauteur });
  await onglet.goto(adresse);
  await attendreLaPageFinie(onglet);
  await onglet.evaluate(() => document.fonts.ready);
  await onglet.evaluate(({ texte, zone }) => {
    document.documentElement.style.fontSize = `${texte}%`;
    document.documentElement.style.setProperty('--zone-basse', `${zone}px`);
  }, { texte, zone: ZONE_BASSE });
  await onglet.evaluate(OUTILS);
};

const lireLeBandeau = (onglet) => onglet.evaluate(() => window.bandeauDuBas());

// Une boîte se voit (44 px d’elle au moins, ou toute, si elle est plus petite), et le bandeau n’en cache rien ; une
// boîte plus haute que la place au-dessus du bandeau (une grande image) ne peut que s’y voir en partie.
const auDessus = (boite, bandeau) => {
  const libre = !bandeau.fixe || !bandeau.visible || boite.dansLeMenu;
  const limite = libre ? bandeau.ecran : bandeau.haut;
  const vu = Math.min(boite.bas, limite) - Math.max(boite.haut, 0);
  if (vu < Math.min(boite.hauteur, 44) - 0.5) return false;
  return libre || boite.hauteur > bandeau.haut || boite.bas <= bandeau.haut + 0.5;
};

const verifierLaPage = async (onglet, chemin, cas) => {
  const bandeau = await lireLeBandeau(onglet);
  expect(bandeau.fixe, 'au téléphone debout, le bandeau est en bas').toBe(true);
  // La zone basse de l’iPhone : le bandeau est à 10 px au-dessus d’elle.
  expect(bandeau.ecran - bandeau.bas, 'le bas du bandeau, au-dessus du bord et de la zone basse').toBeCloseTo(BORD + ZONE_BASSE, 0);

  // La fin de la page : tout en bas, le dernier élément peint remonte au-dessus du bandeau.
  const fin = await onglet.evaluate(async () => {
    // Deux fois : une image paresseuse chargée en arrivant en bas ne change pas la hauteur (CLS 0), mais on s’en assure.
    for (let fois = 0; fois < 2; fois += 1) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((suite) => { requestAnimationFrame(() => requestAnimationFrame(suite)); });
    }
    let bas = 0;
    let quoi = '';
    for (const e of document.body.querySelectorAll('*')) {
      if (e.matches('.pied, .menu, .menu *, .visuellement-cache, .visuellement-cache *, .lien-evitement, script, style, noscript, noscript *')) continue;
      const s = getComputedStyle(e);
      if (s.position === 'fixed' || s.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom > bas) { bas = r.bottom; quoi = `${e.tagName.toLowerCase()}.${e.className}`; }
    }
    return { bas, quoi, auBout: window.scrollY + innerHeight >= document.documentElement.scrollHeight - 1 };
  });
  expect(fin.auBout).toBe(true);
  const bandeauEnBas = await lireLeBandeau(onglet);
  expect(fin.bas, `la fin de la page (${fin.quoi}) passe sous le bandeau`).toBeLessThanOrEqual(bandeauEnBas.haut + 0.5);

  // « Proposer mon bar » et les boutons des formulaires, amenés en bas de l’écran, puis par le focus.
  const cibles = await onglet.evaluate(() => [...document.querySelectorAll('a, button, input[type="submit"]')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.menu')
      && (e.textContent.replace(/\s+/g, ' ').trim() === 'Proposer mon bar' || (e.closest('form') && e.matches('button, input[type="submit"]'))))
    .map((e, i) => { e.dataset.cibleDuBandeau = String(i); return i; }));
  if (chemin.startsWith('/pour-les-bars')) expect(cibles.length, '« Proposer mon bar » et le bouton du formulaire').toBeGreaterThanOrEqual(4);
  expect(cibles.length, 'au moins « Proposer mon bar » du pied de page').toBeGreaterThan(0);
  for (const i of cibles) {
    for (const facon of ['bas', 'focus']) {
      const boite = await onglet.evaluate(({ i, facon }) => {
        const e = document.querySelector(`[data-cible-du-bandeau="${i}"]`);
        if (facon === 'bas') e.scrollIntoView({ block: 'end' });
        else { window.scrollTo(0, 0); e.focus(); }
        return window.boiteDuBandeau(e);
      }, { i, facon });
      const vu = await lireLeBandeau(onglet);
      expect(auDessus(boite, vu), `« ${boite.quoi} » (${facon}) sous le bandeau : ${Math.round(boite.haut)}–${Math.round(boite.bas)} px, bandeau dès ${Math.round(vu.haut)} px`).toBe(true);
    }
  }
  await onglet.evaluate(() => document.activeElement?.blur());

  // Un champ texte qui a le focus efface le bandeau ; une puce le laisse.
  const champs = await onglet.evaluate(() => [...document.querySelectorAll('input, textarea')]
    .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.closest('[hidden], .attente__piege, .formulaire__piege') && getComputedStyle(e).visibility !== 'hidden')
    .map((e, i) => { e.dataset.champDuBandeau = String(i); return { i, texte: !['radio', 'checkbox', 'range', 'submit', 'button'].includes(e.type) }; }));
  for (const { i, texte } of champs) {
    await onglet.locator(`[data-champ-du-bandeau="${i}"]`).focus();
    expect(await onglet.evaluate((rang) => document.activeElement?.dataset.champDuBandeau === String(rang), i), `champ ${i} : le focus`).toBe(true);
    const vu = await lireLeBandeau(onglet);
    expect(vu.visible, `champ ${i} (${texte ? 'texte : le bandeau s’efface' : 'puce : le bandeau reste'})`).toBe(!texte);
  }
  await onglet.evaluate(() => document.activeElement?.blur());

  // La tabulation, du lien d’évitement au dernier lien de la page : aucun arrêt sous le bandeau.
  await onglet.evaluate(() => { const l = document.querySelector('.lien-evitement'); l.dataset.arretDuBandeau = 'depart'; l.focus(); });
  const vus = new Set(['depart']);
  const caches = [];
  for (let n = 0; n < 400; n += 1) {
    await onglet.keyboard.press('Tab');
    const arret = await onglet.evaluate((rang) => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      e.dataset.arretDuBandeau ??= String(rang);
      return { cle: e.dataset.arretDuBandeau, ...window.boiteDuBandeau(e) };
    }, n);
    if (!arret || vus.has(arret.cle)) break;
    vus.add(arret.cle);
    const vu = await lireLeBandeau(onglet);
    if (!auDessus(arret, vu)) caches.push(`« ${arret.quoi} » : ${Math.round(arret.haut)}–${Math.round(arret.bas)} px, bandeau dès ${Math.round(vu.haut)} px`);
  }
  expect(vus.size, 'la tabulation parcourt la page').toBeGreaterThan(10);
  expect(caches, `${cas.largeur} px, texte ${cas.texte} % : arrêts sous le bandeau`).toEqual([]);
};

for (const cas of CAS) {
  const nom = `${cas.largeur} px, texte à ${cas.texte} %`;
  test.describe(nom, () => {
    for (const page of PAGES) {
      test(`${page.nom} : le bandeau du bas ne cache rien`, async ({ page: onglet }) => {
        await ouvrir(onglet, page.chemin, cas);
        await verifierLaPage(onglet, page.chemin, cas);
      });
    }
    for (const chemin of GENEREES) {
      test(`${chemin} (page des matchs) : le bandeau du bas ne cache rien`, async ({ page: onglet }) => {
        await ouvrir(onglet, `${site.serveur.adresse}${chemin}`, cas);
        await verifierLaPage(onglet, chemin, cas);
      });
    }

    test('la boutique : le bandeau laisse la barre de sélection seule en bas', async ({ page: onglet }) => {
      await onglet.goto('/boutique.html');
      await onglet.evaluate(() => localStorage.setItem('baromatch-boutique-v1', JSON.stringify([{ id: 'casquette', couleur: 'nuit', taille: null, quantite: 1 }])));
      await ouvrir(onglet, '/boutique.html', cas);
      await expect(onglet.locator('body')).toHaveClass(/avec-barre/);
      const barre = await onglet.locator('#barre-ouvrir').evaluate((e) => e.getBoundingClientRect().toJSON());
      expect(barre.bottom).toBeLessThanOrEqual(cas.hauteur);
      const vu = await lireLeBandeau(onglet);
      expect(vu.visible, 'le bandeau sur la barre de sélection').toBe(false);
      // Sans sélection, le bandeau revient.
      await onglet.evaluate(() => document.body.classList.remove('avec-barre'));
      expect((await lireLeBandeau(onglet)).visible).toBe(true);
    });
  });
}

// Le vrai réglage du navigateur (la taille du texte par défaut à 32 px, 200 %) : les media queries en em le voient, et
// le bandeau devient une rangée sous le logo, dans la page ; rien n’est fixe en bas.
for (const page of PAGES.filter((p) => ['/', '/pour-les-bars.html', '/cgu.html', '/boutique.html'].includes(p.chemin))) {
  test(`${page.nom}, réglage du navigateur à 200 % : le menu est une rangée dans la page`, async ({ page: onglet }) => {
    const cdp = await onglet.context().newCDPSession(onglet);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await couperLAPI(onglet);
    await onglet.setViewportSize({ width: 390, height: 844 });
    await onglet.goto(page.chemin);
    const lu = await onglet.evaluate(() => ({
      position: getComputedStyle(document.querySelector('.menu')).position,
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      menu: document.querySelector('.menu').getBoundingClientRect().top,
      logo: document.querySelector('.entete__logo').getBoundingClientRect().bottom,
      defile: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(lu.rem).toBe(32);
    expect(lu.position).toBe('static');
    expect(lu.menu).toBeGreaterThanOrEqual(lu.logo);
    expect(lu.defile).toBe(false);
  });
}

test('aucune page ne demande viewport-fit=cover, et le bandeau ne se règle sur aucune hauteur d’écran', () => {
  for (const page of PAGES.filter((p) => !p.chemin.startsWith('/t/'))) {
    const fichier = path.join(racine, page.chemin === '/' ? 'index.html' : page.chemin.slice(1));
    expect(readFileSync(fichier, 'utf8'), page.chemin).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  expect(readFileSync(path.join(racine, 'generateur', 'gabarits.mjs'), 'utf8')).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  const css = readFileSync(path.join(racine, 'styles.css'), 'utf8');
  const blocs = [...css.matchAll(/@media screen and \(min-width: (?:22|36)em\) and \(max-width: 59\.99em\) and \(min-height: 30em\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  expect(blocs).toHaveLength(2);
  for (const bloc of blocs) expect(bloc).not.toMatch(/\d(?:s|d|l)?vh\b/);
  expect(blocs[0]).toContain('bottom: calc(10px + var(--zone-basse))');
  expect(css).toContain('--zone-basse: env(safe-area-inset-bottom, 0px);');
});
