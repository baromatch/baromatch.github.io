// Les cartes de fin de page, sur « À propos », « Comment on choisit les bars » et le guide « Trouver un bar qui diffuse
// le match » : après le contenu, une carte pour les fans (la liste d’attente de l’accueil) et une pour les bars (le
// formulaire de la page des bars). Le guide a déjà sa section « Tu tiens un bar qui diffuse les matchs ? » juste
// au-dessus : il garde seulement la carte des fans, et « Proposer mon bar » arrive sous le paragraphe de cette section,
// plutôt qu’une carte qui le répète. Des liens seulement : aucun formulaire, aucun script. Leurs mots sont ceux déjà
// publiés sur les pages des matchs (generateur/contenu/textes.json : l’appel des fans, la carte « Tu tiens un bar ? »),
// mot pour mot. Chaque bouton se touche sur 44 px ; à 320 et 360 px, il passe à la ligne sans sortir de sa carte (ou de
// la page), texte à 200 % compris, et « préviens-moi » ne se coupe pas au texte normal ; en contraste forcé (Windows), il
// garde un bord. La vérité de ces mots (« bientôt », « cherche ses premiers bars ») est liée à l’état de l’appli dans
// tests/verite.spec.mjs ; axe, les liens et le texte agrandi de chaque page, dans leurs propres tests.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const TEXTES = JSON.parse(readFileSync(path.join(racine, 'generateur', 'contenu', 'textes.json'), 'utf8'));
const normaliser = (texte) => texte.replace(/[\s  ]+/g, ' ').trim();
const FANS = { texte: normaliser(TEXTES.appel.fermee.note), lien: normaliser(TEXTES.appel.fermee.texte), adresse: TEXTES.appel.fermee.adresse };
const BARS = { texte: normaliser(`${TEXTES.match.tuTiensUnBar} ${TEXTES.match.tuTiensUnBarSuite}`), lien: TEXTES.match.proposerMonBar, adresse: '/pour-les-bars.html#proposer' };
// cartes : les cartes de la fin, dans l’ordre ; sousLesBars : « Proposer mon bar » sous le paragraphe de #bars.
const PAGES = [
  { chemin: '/trouver-un-bar-qui-diffuse-le-match.html', cartes: [FANS], sousLesBars: true },
  { chemin: '/a-propos.html', cartes: [FANS, BARS], sousLesBars: false },
  { chemin: '/comment-on-choisit-les-bars.html', cartes: [FANS, BARS], sousLesBars: false },
];
// Les boutons : ceux des cartes, et celui des bars sur le guide.
const BOUTONS = 'main .fin-de-page a, main a.fin-de-page__bouton';

// Les cartes, telles qu’elles se lisent : leur texte et leur lien.
const lireLesCartes = (onglet) => onglet.$$eval('main > .fin-de-page > .fin-de-page__carte', (cartes) => cartes.map((carte) => ({
  texte: carte.querySelector('p')?.textContent ?? '',
  liens: [...carte.querySelectorAll('a')].map((a) => ({ texte: a.textContent, adresse: a.getAttribute('href') })),
})));
// Chaque bouton, tel qu’il se touche : sa boîte et celle de ce qui le contient (sa carte, ou son paragraphe).
const lireLesBoutons = (onglet) => onglet.$$eval(BOUTONS, (liens) => liens.map((a) => {
  const [l, c] = [a.getBoundingClientRect(), (a.closest('.fin-de-page__carte') ?? a.parentElement).getBoundingClientRect()];
  return { adresse: a.getAttribute('href'), cadre: { gauche: c.left, droite: c.right }, gauche: l.left, droite: l.right, hauteur: l.height, largeur: l.width };
}));

test.use({ javaScriptEnabled: false });

for (const { chemin, cartes: attendues, sousLesBars } of PAGES) {
  test(`${chemin} : après le contenu, ${attendues.length === 2 ? 'une carte pour les fans et une pour les bars' : 'la carte des fans, et « Proposer mon bar » sous « Tu tiens un bar »'}, avec les mots déjà publiés`, async ({ page }) => {
    await page.goto(chemin);
    // La dernière chose de la page, une seule fois.
    await expect(page.locator('.fin-de-page')).toHaveCount(1);
    expect(await page.locator('main > :last-child').getAttribute('class')).toBe('fin-de-page');
    const cartes = await lireLesCartes(page);
    expect(cartes.map(({ texte, liens }) => ({ texte: normaliser(texte), liens: liens.map((l) => ({ ...l, texte: normaliser(l.texte) })) })))
      .toEqual(attendues.map(({ texte, lien, adresse }) => ({ texte, liens: [{ texte: lien, adresse }] })));
    // L’ambre à l’appel des fans (la capsule de l’accueil et des pages des matchs) ; le bouton des bars en verre, un seul.
    await expect(page.locator('.fin-de-page a[href="/#attente"]')).toHaveClass('capsule');
    const bars = page.locator('main a[href="/pour-les-bars.html#proposer"]');
    await expect(bars).toHaveCount(1);
    await expect(bars).toHaveClass('fin-de-page__bouton');
    await expect(bars).toHaveText(BARS.lien);
    if (sousLesBars) {
      // Le guide : sous le paragraphe de « Tu tiens un bar qui diffuse les matchs ? », seul dans le sien ; et une seule
      // invitation à laisser son adresse, la carte (le texte du guide ne la répète pas).
      await expect(page.locator('#bars + p + p > a.fin-de-page__bouton')).toHaveCount(1);
      expect(normaliser(await page.locator('#bars + p + p').textContent())).toBe(BARS.lien);
      await expect(page.locator('main a[href="/#attente"]')).toHaveCount(1);
      expect(normaliser(await page.locator('main').textContent())).not.toMatch(/laisse ton adresse sur/i);
    }
    // La typographie du site : une espace insécable avant « : » et « ? ».
    const source = readFileSync(path.join(racine, chemin), 'utf8');
    const bloc = source.slice(source.indexOf('<div class="fin-de-page">'), source.indexOf('</main>'));
    expect(bloc).toContain('ouvre bientôt&nbsp;: préviens-moi');
    if (attendues.includes(BARS)) expect(bloc).toContain('Tu tiens un bar&nbsp;?');
    // Des liens seulement : ni formulaire, ni champ, ni script sur la page (les données structurées ne s’exécutent pas).
    await expect(page.locator('form, input, button, textarea, select')).toHaveCount(0);
    await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
  });

  for (const largeur of [320, 360, 1280]) {
    test(`${chemin} à ${largeur} px : chaque bouton se touche sur 44 px, dans sa carte, et « préviens-moi » ne se coupe pas`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(chemin);
      const boutons = await lireLesBoutons(page);
      expect(boutons.map((b) => b.adresse)).toEqual(sousLesBars ? [BARS.adresse, FANS.adresse] : [FANS.adresse, BARS.adresse]);
      for (const bouton of boutons) {
        expect(bouton.hauteur, bouton.adresse).toBeGreaterThanOrEqual(44);
        expect(bouton.largeur, bouton.adresse).toBeGreaterThanOrEqual(44);
        expect(bouton.gauche, bouton.adresse).toBeGreaterThanOrEqual(bouton.cadre.gauche);
        expect(bouton.droite, bouton.adresse).toBeLessThanOrEqual(bouton.cadre.droite);
      }
      // Les lignes de « L’appli ouvre bientôt : préviens-moi », telles que le navigateur les a coupées.
      const lignes = await page.locator('.fin-de-page a[href="/#attente"]').evaluate((a) => {
        const plage = document.createRange();
        const texte = a.firstChild;
        const vues = [];
        for (let i = 0; i < texte.length; i += 1) {
          plage.setStart(texte, i);
          plage.setEnd(texte, i + 1);
          const haut = Math.round(plage.getBoundingClientRect().top);
          if (!vues.length || vues.at(-1).haut !== haut) vues.push({ haut, texte: '' });
          vues.at(-1).texte += texte.data[i];
        }
        return vues.map((l) => l.texte.trim());
      });
      expect(lignes.some((l) => l.endsWith('préviens-moi')), lignes.join(' | ')).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  for (const largeur of [320, 360]) {
    test(`${chemin} à ${largeur} px, texte à 200 % : les cartes et leurs boutons restent dans l’écran, la page ne défile pas de côté`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(chemin);
      // Le réglage du navigateur « taille du texte », comme dans tests/texte-agrandi.spec.mjs.
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const ecran = await page.evaluate(() => document.documentElement.clientWidth);
      const boutons = await lireLesBoutons(page);
      expect(boutons).toHaveLength(2);
      for (const bouton of boutons) {
        expect(bouton.cadre.gauche, bouton.adresse).toBeGreaterThanOrEqual(0);
        expect(bouton.cadre.droite, bouton.adresse).toBeLessThanOrEqual(ecran + 0.5);
        expect(bouton.gauche, bouton.adresse).toBeGreaterThanOrEqual(bouton.cadre.gauche);
        expect(bouton.droite, bouton.adresse).toBeLessThanOrEqual(bouton.cadre.droite + 0.5);
        expect(bouton.hauteur, bouton.adresse).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  // En contraste forcé (Windows), le fond et l’ombre qui dessinent les boutons disparaissent : un vrai bord (transparent,
  // repeint par le système) leur garde leur forme.
  test(`${chemin} en contraste forcé : les deux boutons gardent un bord`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(chemin);
    const bords = await page.locator(BOUTONS).evaluateAll((liens) => liens.map((a) => [getComputedStyle(a).borderTopStyle, getComputedStyle(a).borderTopWidth]));
    expect(bords).toEqual([['solid', '1px'], ['solid', '1px']]);
  });
}
