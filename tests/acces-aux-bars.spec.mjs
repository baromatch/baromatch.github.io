// Les chemins qui mènent à « Pour les bars » depuis le reste du site : le moment « coup d’envoi » de l’accueil (en « tu »,
// avec son lien vers le formulaire de la page) et le lien des règles de l’appli, au texte qui dit où l’on
// va (un lien interne descriptif aide aussi le référencement de la page).
import { test, expect } from '@playwright/test';
import { MARQUE } from './outils/marque.mjs';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();

test.describe('le moment « bars » de l’accueil, au coup d’envoi', () => {
  test('il garde son ancre #bars et parle « tu », sans « vous »', async ({ page }) => {
    await page.goto('/#bars');
    const fin = page.locator('section#bars');
    await expect(fin).toHaveCount(1);
    await expect(fin).toHaveAttribute('aria-labelledby', 'titre-bars');
    await expect(fin.locator('h2#titre-bars')).toHaveText('Cette salle, c’est peut-être la tienne');
    const texte = normaliser(await fin.innerText());
    expect(texte).not.toMatch(/\b(vous|vos|votre)\b|(?<!-)\bnous\b/i);
    // La phrase vraie de la page des bars, tant que l’appli n’est pas ouverte : aucun fan ne voit encore les soirées
    // d’un bar sur Baromatch.
    expect(MARQUE.appli.ouverte, 'l’appli est ouverte : relire la phrase du moment des bars').toBe(false);
    expect(texte).toContain('Baromatch cherche ses premiers bars à Paris');
    // Les conditions de la page des bars, dans ses mots : un patron sait tout de suite ce que ça coûte.
    expect(texte).toContain('Gratuit pendant le lancement, sans engagement.');
    expect(texte).not.toMatch(/aux fans qui cherchent|qui a réservé|les fans te trouvent/i);
  });

  test('« Proposer mon bar » mène droit au formulaire de la page Pour les bars, comme chaque « Proposer mon bar » du site', async ({ page }) => {
    await page.goto('/');
    const lien = page.locator('section#bars a.bouton-trait');
    await expect(lien).toHaveCount(1);
    await expect(lien).toHaveAttribute('href', '/pour-les-bars.html#proposer');
    await expect(lien).toHaveText('Proposer mon bar');
    await expect(page.locator('section#bars a')).toHaveCount(1);
  });

  test('il ferme la page : après l’inscription, les matchs, le geste et le sous-bock', async ({ page }) => {
    await page.goto('/');
    const ordre = await page.$$eval('main .moment', (sections) => sections.map((s) => s.dataset.heure));
    expect(ordre).toEqual(['1842', '1930', '2015', '2055', '2100']);
    expect(await page.$eval('main .moment:last-child', (s) => s.id)).toBe('bars');
  });

  test('aucune phrase du moment ne promet ce que Baromatch ne tient pas', async ({ page }) => {
    await page.goto('/');
    const texte = normaliser(await page.locator('section#bars .chapo').innerText());
    // Pas de chiffre, de prix, de partenaire cité ni de promesse de résultat : rien n’est encore mesuré. Seule la
    // condition du lancement, celle de la page des bars, dit « gratuit ».
    expect(texte).not.toMatch(/\d/);
    expect(texte.replace('Gratuit pendant le lancement, sans engagement.', '')).not.toMatch(/€|gratuit|garanti|toujours|n°\s?1|plein/i);
    expect(texte).not.toContain('!');
  });

  for (const largeur of [320, 360, 1280]) {
    test(`à ${largeur} px : le titre, le texte et le lien tiennent dans le moment, le lien se touche du doigt`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/');
      const r = await page.evaluate(() => {
        const moment = document.querySelector('section#bars');
        const cadre = moment.getBoundingClientRect();
        const lien = moment.querySelector('a.bouton-trait');
        const c = lien.getBoundingClientRect();
        return {
          lienDansLeMoment: c.left >= cadre.left && c.right <= cadre.right && c.bottom <= cadre.bottom,
          lienLigneUnique: lien.scrollHeight <= lien.clientHeight && lien.scrollWidth <= lien.clientWidth,
          defileDeCote: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          hauteur: c.height,
        };
      });
      expect(r.lienDansLeMoment).toBe(true);
      expect(r.lienLigneUnique).toBe(true);
      expect(r.defileDeCote).toBe(false);
      expect(r.hauteur).toBeGreaterThanOrEqual(44);
    });
  }
});

test.describe('les règles de l’appli', () => {
  test('un seul lien descriptif vers « Pour les bars », dans la partie sur le rôle des bars', async ({ page }) => {
    await page.goto('/cgu.html');
    const liens = await page.$$eval('main a[href="/pour-les-bars.html"]', (a) => a.map((l) => ({
      texte: l.textContent.replace(/\s+/g, ' ').trim(),
      // La partie du lien : le dernier h2 qui le précède dans la page.
      partie: [...document.querySelectorAll('main h2')]
        .filter((h) => h.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)
        .map((h) => h.id).pop(),
    })));
    expect(liens).toHaveLength(1);
    expect(liens[0].partie).toBe('roles');
    // Un texte qui dit où l’on va, jamais « ici » ni « cliquer ».
    expect(liens[0].texte.length).toBeGreaterThanOrEqual(15);
    expect(liens[0].texte).not.toMatch(/\b(ici|cliquer|clique|ce lien)\b/i);
    expect(liens[0].texte.toLowerCase()).toContain('bars');
  });
});
