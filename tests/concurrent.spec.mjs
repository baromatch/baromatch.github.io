// Baromatch ne ressemble jamais au concurrent premier sur Google, et ne le nomme jamais : ni sur une page, ni dans un
// fichier publié (le dépôt est public, et GitHub Pages sert chacun de ses fichiers). Ce test lit le nom et le texte de
// chaque fichier que git suit, ou suivrait (un fichier nouveau, pas encore ajouté, compte aussi), sauf les binaires, et
// y cherche ce nom, en minuscules comme en capitales. Le nom est écrit ici en morceaux, pour que ce fichier ne le
// contienne pas ; un mot qui le prolonge (une « fanzone ») ne compte pas.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { racine } from './outils/environnement.mjs';

const BINAIRE = /\.(?:png|jpe?g|webp|gif|ico|mp4|webm|woff2?|pdf)$/i;
const NOM = new RegExp(`(?<![\\p{L}\\p{N}])${['fan', 'zo'].join('')}(?![\\p{L}\\p{N}])`, 'giu');

const FICHIERS = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: racine, encoding: 'utf8' }).split('\0'))]
  .filter((fichier) => fichier && existsSync(path.join(racine, fichier)))
  .sort();

const lignesAvecLeNom = (texte) => texte.split('\n').flatMap((ligne, i) => (ligne.match(NOM) ? [i + 1] : []));

test('la recherche trouve le nom, seul ou dans une adresse, et pas un mot qui le prolonge', () => {
  const nom = ['Fan', 'zo'].join('');
  expect(lignesAvecLeNom(`Avant.\n${nom}\nAprès.`)).toEqual([2]);
  expect(lignesAvecLeNom(`Vu sur ${nom.toLowerCase()}.com, et chez ${nom.toUpperCase()}.`)).toEqual([1]);
  expect(lignesAvecLeNom(`La ${nom.toLowerCase()}ne du stade, ou une ${nom}ne.`)).toEqual([]);
  expect(FICHIERS).toContain('index.html');
  expect(FICHIERS).toContain('tests/concurrent.spec.mjs');
});

test('aucun fichier publié ne nomme le concurrent, ni dans son nom ni dans son texte', () => {
  const trouves = FICHIERS.flatMap((fichier) => {
    const dansLeNom = fichier.match(NOM) ? [`${fichier} (son nom)`] : [];
    if (BINAIRE.test(fichier)) return dansLeNom;
    const lignes = lignesAvecLeNom(readFileSync(path.join(racine, fichier), 'utf8'));
    return lignes.length ? [...dansLeNom, `${fichier} (lignes ${lignes.join(', ')})`] : dansLeNom;
  });
  expect(trouves, 'Le site ne nomme jamais le concurrent : dis « le concurrent », ou rien.').toEqual([]);
});
