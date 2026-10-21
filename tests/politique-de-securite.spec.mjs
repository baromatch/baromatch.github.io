// La politique de sécurité (Content-Security-Policy, en balise meta : GitHub Pages ne permet pas d’en-tête) de chaque
// page autre que « Pour les bars », qui a la sienne et ses tests : elle n’admet que ce que la page utilise (ses fichiers,
// Formspree où un formulaire écrit, l’API où tablee.js lit, le compte GoatCounter quand la mesure d’audience de
// marque.json est active, l’empreinte de chaque script ou style en ligne), et rien ne la viole quand on parcourt la
// page, avec ou sans JavaScript. Chaque page est jugée telle qu’elle est, et telle que l’Action l’écrirait avec un code
// de mesure (generateur/mesure.mjs) ; tests/mesure.spec.mjs la parcourt alors dans le navigateur.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { appliquerAUnePage, lireLaMesure } from '../generateur/mesure.mjs';
import { simulerFormspree } from './outils/formspree.mjs';
import { API_TABLEE, enTetesCors, INVITATION } from './outils/invitation.mjs';
import { MARQUE } from './outils/marque.mjs';
import { fichierDe } from './outils/pages.mjs';

const API = 'https://api-production-8ce4.up.railway.app';
const FORMSPREE = 'https://formspree.io';
// Ce que chaque page doit admettre, au-delà de 'self' : où elle écrit (connect-src) et où un formulaire part sans
// JavaScript (form-action).
const PAGES = [
  { chemin: '/', connect: [FORMSPREE], formulaire: [FORMSPREE] },
  { chemin: '/boutique.html', connect: [FORMSPREE], formulaire: [] },
  { chemin: '/cgu.html', connect: [], formulaire: [] },
  { chemin: '/confidentialite.html', connect: [], formulaire: [] },
  { chemin: '/mentions-legales.html', connect: [], formulaire: [] },
  { chemin: '/supprimer-mon-compte.html', connect: [], formulaire: [] },
  { chemin: '/presse.html', connect: [], formulaire: [] },
  { chemin: '/a-propos.html', connect: [], formulaire: [] },
  { chemin: '/comment-on-choisit-les-bars.html', connect: [], formulaire: [] },
  { chemin: '/trouver-un-bar-qui-diffuse-le-match.html', connect: [], formulaire: [] },
  { chemin: '/404.html', connect: [API], formulaire: [] },
];

const lireLaPolitique = (html) => {
  const balises = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g)];
  const directives = Object.fromEntries((balises[0]?.[1] ?? '').split(';').map((d) => d.trim()).filter(Boolean)
    .map((d) => { const [nom, ...valeurs] = d.split(/\s+/); return [nom, valeurs]; }));
  return { nombre: balises.length, position: balises[0]?.index ?? -1, directives };
};
const empreinte = (texte) => `'sha256-${createHash('sha256').update(texte, 'utf8').digest('base64')}'`;

// La page telle qu’elle est, avec la mesure de marque.json (arrêtée tant que son code est vide) ; et la même page
// réécrite avec une mesure d’essai.
const ESSAI = lireLaMesure({ mesure: { outil: 'goatcounter', code: 'essai' } });
const CAS = [
  { nom: 'telle quelle', mesure: lireLaMesure(MARQUE), lire: (html) => html },
  { nom: 'avec un code de mesure', mesure: ESSAI, lire: (html) => appliquerAUnePage(html, ESSAI) },
];

for (const page of PAGES) {
  for (const { nom, mesure, lire } of CAS) test(`${page.chemin} ${nom} : une politique qui n’admet que ce que la page utilise`, () => {
    const html = lire(readFileSync(fichierDe(page.chemin), 'utf8'));
    const { nombre, position, directives } = lireLaPolitique(html);
    expect(nombre, 'une seule balise').toBe(1);
    // Avant toute ressource : ce qui est demandé avant la balise lui échappe.
    expect(position).toBeLessThan(html.search(/<link|<script|<style/));
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['base-uri']).toEqual(["'none'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['form-action']).toEqual(page.formulaire.length ? page.formulaire : ["'none'"]);
    expect(directives['connect-src'] ?? ["'self'"]).toEqual(["'self'", ...page.connect, ...(mesure.active ? [mesure.origine] : [])]);
    const toutes = Object.values(directives).flat();
    expect(toutes.filter((v) => /unsafe|^\*$|^https?:$|^data:$/.test(v))).toEqual([]);

    // Chaque script exécuté et chaque style écrits dans la page ont leur empreinte ; aucun attribut style=.
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => empreinte(m[1]));
    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => empreinte(m[1]));
    expect(directives['script-src']).toEqual(scripts.length || /<script src=/.test(html) ? ["'self'", ...scripts] : ["'none'"]);
    expect(directives['style-src'] ?? ["'self'"]).toEqual(["'self'", ...styles]);
    expect(html.match(/\sstyle="[^"]*"/g) ?? []).toEqual([]);
  });
}

// Chaque violation, dite par la page (avec JavaScript) ou par la console du navigateur (sans).
const ecouter = async (onglet) => {
  const console_ = [];
  onglet.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) console_.push(message.text()); });
  await onglet.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
  });
  return async () => [...console_, ...(await onglet.evaluate(() => window.__violations ?? []).catch(() => []))];
};

test.describe('rien ne viole la politique en parcourant les pages', () => {
  test('l’accueil : la liste d’attente (refus, inscription, correction) et le film', async ({ page }) => {
    const violations = await ecouter(page);
    await simulerFormspree(page);
    await page.goto('/');
    await page.locator('#attente-mail').fill('paul@gmail');
    await page.locator('#attente button[type="submit"]').click();
    await page.locator('#attente-mail').fill('paul@gmail.com');
    await page.locator('#attente button[type="submit"]').click();
    await page.locator('#attente-corriger').click();
    const film = page.waitForRequest(/baromatch-film-[^/]+\.mp4$/);
    await page.locator('#film').scrollIntoViewIfNeeded();
    await film;
    await page.locator('#film-son').click();
    await expect(page.locator('#film-son')).toHaveText('Couper le son');
    expect(await violations()).toEqual([]);
  });

  test('la boutique : choisir, ouvrir la sélection, une erreur, l’envoi, la correction', async ({ page }) => {
    const violations = await ecouter(page);
    await simulerFormspree(page);
    await page.goto('/boutique.html');
    const tshirt = page.locator('article', { has: page.locator('#nom-tshirt-le-verre') });
    await tshirt.locator('label', { hasText: 'Crème' }).click();
    await tshirt.locator('label', { hasText: /^M$/ }).click();
    await tshirt.locator('.boutique-produit__ajouter').click();
    await page.locator('#barre-ouvrir').click();
    await page.locator('#panier-form button[type="submit"]').click();
    await page.locator('#panier-mail').fill('paul@gmail.com');
    await page.locator('#panier-accord').check();
    await page.locator('#panier-form button[type="submit"]').click();
    await expect(page.locator('#panier-merci')).toBeVisible();
    await page.locator('#panier-corriger').click();
    expect(await violations()).toEqual([]);
  });

  test('la boutique sans boutique.js : la collection du <noscript> prend la place', async ({ page }) => {
    const violations = await ecouter(page);
    await page.route('**/boutique.js', (route) => route.abort());
    await page.goto('/boutique.html');
    await expect(page.locator('.boutique-produit')).toHaveCount(6);
    expect(await violations()).toEqual([]);
  });

  test('une tablée : l’invitation, puis la panne et « Réessayer »', async ({ page }) => {
    const violations = await ecouter(page);
    let statut = 200;
    await page.route(API_TABLEE, async (route) => route.fulfill({
      status: statut, contentType: 'application/json', body: JSON.stringify(INVITATION), headers: await enTetesCors(route.request()),
    }));
    await page.goto('/t/abcdefghjkmn');
    await expect(page.locator('#tablee-carte')).toBeVisible();
    statut = 500;
    await page.reload();
    await page.locator('#tablee-reessayer').click();
    await expect(page.locator('#tablee-reessayer')).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  for (const chemin of ['/nimporte-quoi.html', '/cgu.html', '/confidentialite.html', '/mentions-legales.html', '/supprimer-mon-compte.html', '/presse.html']) {
    test(`${chemin} : la page et ses ancres`, async ({ page }) => {
      const violations = await ecouter(page);
      await page.goto(chemin);
      const ancre = page.locator('main a[href^="#"]').first();
      if (await ancre.count()) await ancre.click();
      await page.waitForLoadState('networkidle');
      expect(await violations()).toEqual([]);
    });
  }

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    for (const chemin of ['/', '/boutique.html', '/t/abcdefghjkmn', '/cgu.html']) {
      test(`${chemin} : les styles du <noscript> s’appliquent, sans violation`, async ({ page }) => {
        const violations = await ecouter(page);
        await page.goto(chemin);
        await page.waitForLoadState('networkidle');
        expect(await violations()).toEqual([]);
        if (chemin === '/') await expect(page.locator('#film')).toBeHidden();
        if (chemin === '/boutique.html') expect((await page.locator('#boutique-grille').boundingBox()).height).toBe(0);
      });
    }

    test('l’accueil : la liste d’attente part encore vers Formspree, sans JavaScript', async ({ page }) => {
      const violations = await ecouter(page);
      const envois = [];
      await page.route(/formspree\.io/, (route) => {
        envois.push(route.request().method());
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' });
      });
      // Mouvement réduit : l’ouverture ne bouge pas. Sans JavaScript, un clic tenté pendant que la phrase d’ouverture
      // glisse encore restait bloqué sur « element is not stable » jusqu’à la fin du test (Chromium sous Windows).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await page.locator('#attente-mail').fill('paul@gmail.com');
      await page.locator('#attente button[type="submit"]').click();
      await page.waitForURL(/formspree\.io/, { waitUntil: 'commit' });
      expect(envois).toEqual(['POST']);
      expect(await violations()).toEqual([]);
    });
  });
});
