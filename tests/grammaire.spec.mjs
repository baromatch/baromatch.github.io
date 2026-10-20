// Les noms qui commencent par un article (« Le Zinc des Amis », « Au Bon Coin », « Le Havre ») : le générateur ne les
// écrit jamais derrière « de » ou « à » (« L’affiche de Le Zinc des Amis », « de Au Bon Coin », « Le prochain match de
// Le Havre ») ; ses tournures n’ont besoin d’aucun article. Vérifié sur des bars nommés Le, La, Les, L’, Au et Aux, et
// sur la page d’un match passé du Havre.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { contenuDuScenario, SCENARIO } from './outils/site-genere.mjs';
import { construire } from '../generateur/construire.mjs';
import { construireEnMemoire } from '../generateur/site.mjs';
import { chargerLeQr } from '../generateur/qr.mjs';

const { qr } = chargerLeQr();
const contenu = contenuDuScenario();
const VENDREDI = Date.parse('2026-10-23T08:00:00Z');

// Les vrais bars du scénario, renommés : chacun commence par un article.
const NOMS = [
  { 'b-zinc': 'Le Zinc des Amis', 'b-gones': 'La Cave des Gones', 'b-coin': 'Au Bon Coin', 'b-comptoir': 'Les Copains du Canal', 'b-rennes': 'L’Écluse' },
  { 'b-zinc': 'Aux Trois Buts', 'b-gones': 'L\'Ancre', 'b-coin': 'Les Halles', 'b-comptoir': 'Le Canal', 'b-rennes': 'La Mi-Temps' },
];

const dossiers = [];
test.afterAll(() => { for (const d of dossiers) rmSync(d, { recursive: true, force: true }); });
const scenarioAvec = (noms) => {
  const s = JSON.parse(readFileSync(SCENARIO, 'utf8'));
  for (const bar of s.bars) if (noms[bar.id]) bar.name = noms[bar.id];
  const dossier = mkdtempSync(path.join(tmpdir(), 'grammaire-'));
  dossiers.push(dossier);
  const fichier = path.join(dossier, 'scenario.json');
  writeFileSync(fichier, JSON.stringify(s));
  return `scenario:${fichier}`;
};

// Le texte d’une page, balises ôtées, entités et espaces normalisés : ce qu’on lit (attributs aria-label, alt et
// title compris, et la tête : titre, description).
const lisible = (html) => html
  .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/g, ' ')
  .replace(/(?:aria-label|alt|title|content)="([^"]*)"/g, ' $1 ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '\'')
  .replace(/[\s ]+/g, ' ');

for (const [i, noms] of NOMS.entries()) {
  test(`aucun « de » ni « à » devant un nom de bar à article (série ${i + 1} : ${Object.values(noms).join(', ')})`, async () => {
    const { pages } = await construireEnMemoire({ source: scenarioAvec(noms), maintenant: VENDREDI, racine, contenu, qr });
    const francaises = pages.filter((p) => (p.langue ?? 'fr') === 'fr');
    expect(francaises.some((p) => p.type === 'affiche-bar')).toBe(true);
    const fautes = [];
    for (const p of francaises) {
      const texte = lisible(p.contenu);
      for (const nom of Object.values(noms)) {
        const trouve = texte.match(new RegExp(`(?:^|[\\s(«])(?:de|à|du) ${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
        if (trouve) fautes.push(`${p.chemin} : « ${trouve[0].trim()} »`);
      }
    }
    expect(fautes).toEqual([]);
  });
}

test('l’affiche d’un bar à article : son titre, sa description et son QR code se lisent sans « de »', async () => {
  const { pages } = await construireEnMemoire({ source: scenarioAvec(NOMS[0]), maintenant: VENDREDI, racine, contenu, qr });
  const affiche = pages.find((p) => p.chemin === '/bar/au-bon-coin-lyon-2/affiche/');
  expect(affiche.contenu).toContain('<h1 class="regarder-titre">Au Bon Coin : ton affiche</h1>');
  expect(affiche.contenu).toContain('<title>Affiche à imprimer : Au Bon Coin — Baromatch</title>');
  expect(affiche.contenu).toContain('aria-label="QR code vers la page du bar Au Bon Coin sur Baromatch"');
});

test('la page d’un match passé du Havre : « Le prochain match : », jamais « de Le Havre »', async () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'grammaire-site-'));
  dossiers.push(sortie);
  const passer = (maintenant) => construire({ source: `scenario:${SCENARIO}`, sortie, maintenant: Date.parse(maintenant), racine, contenu, rendu: null, qr: null });
  await passer('2026-10-21T08:00:00Z');
  await passer('2026-10-26T08:00:00Z');
  const page = readFileSync(path.join(sortie, 'matchs', 'le-havre-auxerre-2026-10-25', 'index.html'), 'utf8');
  expect(page).toContain('<h2 id="titre-passe">Ce match est passé</h2>');
  expect(page).toContain('<p>Le prochain match : <a href="/matchs/le-havre-psg-2026-10-30/">Le Havre – PSG</a>');
  expect(lisible(page)).not.toMatch(/\bde Le Havre\b/);
});
