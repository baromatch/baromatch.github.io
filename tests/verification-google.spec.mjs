// La balise de vérification Google Search Console demandée par le propriétaire : elle reste dans le <head>
// de la page d’accueil, à l’identique. La retirer fait perdre l’accès à la Search Console.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fichierDe } from './outils/pages.mjs';

const BALISE = '<meta name="google-site-verification" content="nBxxD8vbrngLKD1Te1fRcbC8tGC2-gwezW9NG9urIaw" />';

test('la page d’accueil garde la balise de vérification Google, telle quelle, dans son <head>', async ({ page }) => {
  const source = readFileSync(fichierDe('/'), 'utf8');
  const tete = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
  expect(tete).toContain(BALISE);

  await page.goto('/');
  await expect(page.locator('head meta[name="google-site-verification"]')).toHaveAttribute('content', 'nBxxD8vbrngLKD1Te1fRcbC8tGC2-gwezW9NG9urIaw');
  await expect(page.locator('meta[name="google-site-verification"]')).toHaveCount(1);
});
