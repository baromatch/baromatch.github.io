// llms.txt, pour les outils de recherche par IA, au format de llmstxt.org : un titre « # Baromatch », le résumé en
// citation (la description de marque.json), des faits qui évitent les erreurs, puis des sections « ## » de liens
// « - [nom](adresse): note ». Les faits disent ce que Baromatch est et n’est pas (ni paris sportifs, ni diffuseur,
// ni vente d’alcool), où et comment il est disponible aujourd’hui, et qu’il est gratuit pour les fans.
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';
import { MARQUE, PROFILS } from './outils/marque.mjs';
import { fichierDe } from './outils/pages.mjs';

const ORIGINE = 'https://baromatch.fr';
const TEXTE = readFileSync(path.join(racine, 'llms.txt'), 'utf8').replace(/\r\n/g, '\n');
// Les pages que le générateur écrit (« Ce soir », matchs de la semaine, villes, pages en anglais) : elles arrivent avec
// lui, leur fichier n’est pas exigé ici. agenda/ et l’affiche de la semaine, déjà écrites, sont dans le dépôt.
const GENEREES = ['/ce-soir/', '/matchs/', '/regarder-le-match/', '/en/'];

test('le format de llmstxt.org : titre, résumé en citation, puis des sections de liens', () => {
  const lignes = TEXTE.split('\n');
  expect(lignes[0]).toBe(`# ${MARQUE.nom}`);
  expect(lignes[1]).toBe('');
  expect(lignes[2]).toBe(`> ${MARQUE.description}`);
  expect(TEXTE.match(/^# /gm), 'un seul titre de premier niveau').toHaveLength(1);
  expect(TEXTE.match(/^#{3,} /gm), 'pas de titre plus bas que ##').toBeNull();
  // Sous chaque section, rien que des liens « - [nom](adresse): note ».
  const sections = TEXTE.split(/^## /m).slice(1);
  expect(sections.map((s) => s.split('\n')[0])).toEqual(['Baromatch', 'Pour les fans', 'Pour les bars', 'Règles et données', 'Contact', 'Optional']);
  for (const section of sections) {
    const elements = section.split('\n').slice(1).filter((l) => l.trim());
    expect(elements.length, section.split('\n')[0]).toBeGreaterThan(0);
    for (const element of elements) expect(element).toMatch(/^- \[[^\]]+\]\((?:https:\/\/[^)\s]+|mailto:[^)\s]+)\): \S.*$/);
  }
});

test('les liens : les pages du site (chacune avec son fichier), le contact et les profils de marque.json', () => {
  const liens = [...TEXTE.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)].map(([, nom, adresse]) => ({ nom, adresse }));
  const adresses = liens.map((l) => l.adresse);
  for (const chemin of [
    '/', '/pour-les-bars.html', '/presse.html', '/a-propos.html', '/comment-on-choisit-les-bars.html', '/ce-soir/', '/matchs/', '/regarder-le-match/',
    '/agenda/', '/en/', '/matchs/affiche/', '/cgu.html', '/confidentialite.html', '/testeurs-android.html',
  ]) {
    expect(adresses, chemin).toContain(`${ORIGINE}${chemin}`);
  }
  expect(adresses).toContain(`mailto:${MARQUE.contact}`);
  for (const profil of PROFILS) expect(adresses).toContain(profil);
  for (const { adresse } of liens.filter((l) => l.adresse.startsWith(`${ORIGINE}/`))) {
    const chemin = new URL(adresse).pathname;
    if (GENEREES.includes(chemin)) continue;
    expect(existsSync(fichierDe(chemin)), `${adresse} : aucun fichier ${fichierDe(chemin)}`).toBe(true);
  }
  // Aucun lien ailleurs que sur le site, le contact et les profils.
  expect(adresses.filter((a) => !a.startsWith(`${ORIGINE}/`) && a !== `mailto:${MARQUE.contact}` && !PROFILS.includes(a))).toEqual([]);
});

test('les faits qui évitent les erreurs : ce que Baromatch est, ce qu’il n’est pas, où et pour qui', () => {
  const texte = TEXTE.replace(/\s+/g, ' ');
  expect(texte).toContain(MARQUE.slogan);
  expect(texte).toContain(MARQUE.uneLigne);
  expect(texte).toContain('Baromatch n’est pas un site de paris sportifs.');
  // Vrai aussi le jour où l’appli proposera des pronostics entre amis : ni pari, ni cote, ni argent, jamais.
  expect(texte).toContain('on n’y parie pas : ni mise, ni cote, ni argent en jeu.');
  expect(texte).not.toMatch(/pronostic/i);
  expect(texte).toContain('Baromatch n’est pas un diffuseur');
  expect(texte).toContain('Baromatch ne vend pas d’alcool.');
  expect(texte).toContain('L’appli est gratuite pour les fans.');
  expect(texte).toContain('en test sur Android, à Paris');
  if (!MARQUE.appli.ouverte) expect(texte).toContain('Elle n’est pas encore ouverte au public');
  expect(texte).toContain(MARQUE.contact);
});

test('le site le sert en texte, à /llms.txt', async ({ request }) => {
  const reponse = await request.get('/llms.txt');
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()['content-type']).toMatch(/^text\/plain/);
  expect((await reponse.text()).replace(/\r\n/g, '\n')).toBe(TEXTE);
});
