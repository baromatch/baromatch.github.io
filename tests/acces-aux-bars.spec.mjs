// Les chemins qui mènent à « Pour les bars » depuis le reste du site : la bande ambre de l’accueil (en « tu », avec la
// capsule de nuit vers la page et l’e-mail en lien second) et le lien des règles de l’appli, au texte qui dit où l’on
// va (un lien interne descriptif aide aussi le référencement de la page).
import { test, expect } from '@playwright/test';
import { MARQUE } from './outils/marque.mjs';

const normaliser = (texte) => texte.replace(/\s+/g, ' ').trim();

test.describe('la bande « bars » de l’accueil', () => {
  test('elle garde son ancre #bars et parle « tu », sans « vous »', async ({ page }) => {
    await page.goto('/#bars');
    const bande = page.locator('section#bars');
    await expect(bande).toHaveCount(1);
    await expect(bande).toHaveAttribute('aria-labelledby', 'titre-bars');
    await expect(bande.locator('h2#titre-bars')).toHaveText('Ton bar diffuse les matchs ?');
    const texte = normaliser(await bande.innerText());
    expect(texte).not.toMatch(/\b(vous|vos|votre|nous)\b/i);
    // La phrase vraie de la page des bars, tant que l’appli n’est pas ouverte : aucun fan ne voit encore les soirées
    // d’un bar sur Baromatch.
    expect(MARQUE.appli.ouverte, 'l’appli est ouverte : relire la phrase de la bande des bars').toBe(false);
    expect(texte).toContain('Baromatch cherche ses premiers bars à Paris. Tu choisis combien de places tu ouvres.');
    // Les conditions de la page des bars, dans ses mots : un patron sait tout de suite ce que ça coûte.
    expect(texte).toContain('Gratuit pendant le lancement, sans engagement.');
    expect(texte).not.toMatch(/aux fans qui cherchent|qui a réservé/);
  });

  test('la capsule de nuit mène droit au formulaire de la page Pour les bars ; l’e-mail reste un lien second', async ({ page }) => {
    await page.goto('/');
    const bande = page.locator('section#bars');
    const capsule = bande.locator('a.bouton-nuit');
    await expect(capsule).toHaveCount(1);
    // Comme chaque « Proposer mon bar » du site : droit au formulaire (#proposer), pas en haut de la page.
    await expect(capsule).toHaveAttribute('href', '/pour-les-bars.html#proposer');
    await expect(capsule).toHaveText('Proposer mon bar');
    const liens = await bande.locator('a').evaluateAll((a) => a.map((l) => [l.getAttribute('href'), l.className]));
    expect(liens).toEqual([
      ['/pour-les-bars.html#proposer', 'bouton-nuit'],
      ['mailto:contact@baromatch.fr', ''],
    ]);
  });

  test('elle arrive juste après « Un soir de match, minute par minute », avant « Baromatch en bref » ; les questions ferment la page (la boutique est dans le pied de page)', async ({ page }) => {
    await page.goto('/');
    const ordre = await page.$$eval('main > section', (sections) => sections.map((s) => s.id || s.className.split(' ')[0]));
    expect(ordre).toEqual(['ouverture', 'soiree', 'bars', 'en-bref', 'testeurs-accueil', 'questions']);
  });

  test('aucune phrase de la bande ne promet ce que Baromatch ne tient pas', async ({ page }) => {
    await page.goto('/');
    const texte = normaliser(await page.locator('section#bars').innerText());
    // Pas de chiffre, de prix, de partenaire cité ni de promesse de résultat : rien n’est encore mesuré. Seule la
    // condition du lancement, celle de la page des bars, dit « gratuit ».
    expect(texte).not.toMatch(/\d/);
    expect(texte.replace('Gratuit pendant le lancement, sans engagement.', '')).not.toMatch(/€|gratuit|garanti|toujours|n°\s?1|plein/i);
    expect(texte).not.toContain('!');
  });

  for (const largeur of [320, 360, 1280]) {
    test(`à ${largeur} px : le titre, le texte et la capsule tiennent dans la bande`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto('/');
      const r = await page.evaluate(() => {
        const bande = document.querySelector('section#bars');
        const cadre = bande.getBoundingClientRect();
        const capsule = bande.querySelector('a.bouton-nuit');
        const c = capsule.getBoundingClientRect();
        return {
          capsuleDansLaBande: c.left >= cadre.left && c.right <= cadre.right && c.bottom <= cadre.bottom,
          capsuleLigneUnique: capsule.scrollHeight <= capsule.clientHeight && capsule.scrollWidth <= capsule.clientWidth,
          defileDeCote: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          hauteur: c.height,
        };
      });
      expect(r.capsuleDansLaBande).toBe(true);
      expect(r.capsuleLigneUnique).toBe(true);
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
