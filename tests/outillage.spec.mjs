// Les outils de vérification eux-mêmes (tests/outils, package.json) : le serveur local ne mesure jamais un autre site
// que ce dépôt, Lighthouse échoue sous 95 et ne rend jamais un résumé vide, et chaque commande npm mène à un fichier
// qui existe. Aucun navigateur ici : seulement Node.
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { racine } from './outils/environnement.mjs';
import { PAGES, pagesLighthouse } from './outils/pages.mjs';
import { demarrerServeur } from './outils/serveur.mjs';

const executer = promisify(execFile);

// Un port libre de la machine, choisi par le système.
const portLibre = () => new Promise((resoudre) => {
  const serveur = createServer();
  serveur.listen(0, '127.0.0.1', () => {
    const { port } = serveur.address();
    serveur.close(() => resoudre(port));
  });
});

test.describe('le serveur local', () => {
  test('un port déjà pris par un autre serveur : il refuse, au lieu de mesurer cet autre site', async () => {
    const autre = createServer((requete, reponse) => reponse.end('<p>autre site</p>'));
    await new Promise((resoudre) => autre.listen(0, '127.0.0.1', resoudre));
    const { port } = autre.address();
    try {
      await expect(demarrerServeur(port)).rejects.toThrow(/déjà pris/);
    } finally {
      autre.close();
    }
  });

  test('un serveur qui s’arrête au démarrage : il le dit, avec son code de sortie', async () => {
    const port = await portLibre();
    const commande = [process.execPath, '-e', 'process.stderr.write("panne simulée"); process.exit(3)'];
    await expect(demarrerServeur(port, -1, { commande })).rejects.toThrow(/arrêté.*3[\s\S]*panne simulée/);
  });

  test('il sert ce dépôt : la page d’accueil est celle du dépôt', async () => {
    const port = await portLibre();
    const { adresse, arreter } = await demarrerServeur(port);
    try {
      const servie = await (await fetch(`${adresse}/`)).text();
      expect(servie).toBe(readFileSync(path.join(racine, 'index.html'), 'utf8'));
    } finally {
      arreter();
    }
  });
});

// Les captures : un Chromium qui ne se lance pas arrête la commande, et le serveur local avec elle (son port est libre
// juste après), au lieu de le laisser tourner seul. Sous Linux et macOS, seul le correctif l’arrête (sans lui, ce test
// échoue : le port reste pris) ; sous Windows, le système arrête aussi le serveur avec la commande.
test('les captures : Chromium introuvable, la commande échoue et le serveur local s’arrête', async () => {
  const port = await portLibre();
  const dossier = mkdtempSync(path.join(tmpdir(), 'captures-'));
  const OUTIL = path.join(racine, 'tests', 'outils', 'captures.mjs');
  try {
    const sortie = await executer(process.execPath, [OUTIL, dossier, String(port)], {
      cwd: tmpdir(), env: { ...process.env, CHROME_PATH: path.join(dossier, 'pas-de-chromium') },
    }).then(() => ({ code: 0 }), (erreur) => ({ code: erreur.code }));
    expect(sortie.code).not.toBe(0);
    // Le port se reprend : plus rien n’y écoute (sans le correctif, le serveur local y répondait encore).
    const { arreter } = await demarrerServeur(port);
    arreter();
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test.describe('les pages que Lighthouse mesure', () => {
  test('chaque page de la liste a son fichier : toutes sont mesurées, sauf lighthouse: false', () => {
    expect(pagesLighthouse().map((page) => page.nom)).toEqual(PAGES.filter((page) => page.lighthouse !== false).map((page) => page.nom));
  });

  test('une page sans fichier : la commande échoue tout de suite en la nommant, au lieu de la sauter', () => {
    const pages = [{ chemin: '/', nom: 'accueil' }, { chemin: '/pour-les-bars.html', nom: 'pour-les-bars' }];
    const existe = (fichier) => !fichier.endsWith('pour-les-bars.html');
    expect(() => pagesLighthouse(pages, existe)).toThrow(/pour-les-bars.html/);
    expect(pagesLighthouse(pages, () => true)).toHaveLength(2);
  });
});

test.describe('le résumé Lighthouse', () => {
  const OUTIL = path.join(racine, 'tests', 'outils', 'lighthouse.mjs');
  const APPAREILS = ['mobile', 'ordinateur'];
  const MESUREES = PAGES.filter((page) => page.lighthouse !== false);
  const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

  // Un dossier de mesures factices (le JSON que Lighthouse écrit, réduit à ses notes), toutes à 100 sauf les exceptions
  // { 'boutique.mobile': { performance: 0.94 } }.
  const mesures = (exceptions = {}, absentes = []) => {
    const dossier = mkdtempSync(path.join(tmpdir(), 'lighthouse-'));
    for (const page of MESUREES) {
      for (const appareil of APPAREILS) {
        const cle = `${page.nom}.${appareil}`;
        if (absentes.includes(cle)) continue;
        const notes = { ...Object.fromEntries(CATEGORIES.map((c) => [c, 1])), ...exceptions[cle] };
        const rapport = { categories: Object.fromEntries(CATEGORIES.map((c) => [c, { score: notes[c] }])), audits: {} };
        writeFileSync(path.join(dossier, `${cle}.json`), JSON.stringify(rapport));
      }
    }
    return dossier;
  };

  // L’outil lancé depuis un autre dossier que le dépôt : ce qu’il lit ne dépend pas du dossier courant.
  const resumer = async (dossier) => {
    try {
      const { stdout } = await executer(process.execPath, [OUTIL, dossier, '--resume-seul'], { cwd: tmpdir() });
      return { code: 0, sortie: stdout };
    } catch (erreur) {
      return { code: erreur.code, sortie: `${erreur.stdout}${erreur.stderr}` };
    }
  };

  test('toutes les pages à 95 ou plus : il réussit, et le résumé a chaque page sur chaque appareil, lancé d’ailleurs', async () => {
    const dossier = mesures();
    try {
      const { code } = await resumer(dossier);
      expect(code).toBe(0);
      const resume = JSON.parse(readFileSync(path.join(dossier, 'resume.json'), 'utf8'));
      expect(resume).toHaveLength(MESUREES.length * APPAREILS.length);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('une note sous 95 : il échoue et nomme la page, l’appareil et la catégorie', async () => {
    const dossier = mesures({ 'boutique.mobile': { performance: 0.94 } });
    try {
      const { code, sortie } = await resumer(dossier);
      expect(code).not.toBe(0);
      expect(sortie).toMatch(/boutique.*mobile.*performance.*94/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('le SEO de la page 404 ne compte pas (noindex voulu), ses autres notes si', async () => {
    const seo = mesures({ '404.mobile': { seo: 0.6 }, '404.ordinateur': { seo: 0.6 } });
    const performance = mesures({ '404.ordinateur': { performance: 0.9 } });
    try {
      expect((await resumer(seo)).code).toBe(0);
      expect((await resumer(performance)).code).not.toBe(0);
    } finally {
      rmSync(seo, { recursive: true, force: true });
      rmSync(performance, { recursive: true, force: true });
    }
  });

  test('une mesure qui manque : il échoue au lieu de la laisser hors du résumé', async () => {
    const dossier = mesures({}, ['cgu.ordinateur']);
    try {
      const { code, sortie } = await resumer(dossier);
      expect(code).not.toBe(0);
      expect(sortie).toMatch(/cgu\.ordinateur/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

test('chaque commande npm mène à un fichier qui existe', () => {
  const { scripts } = JSON.parse(readFileSync(path.join(racine, 'package.json'), 'utf8'));
  // Les scripts des tests et du générateur, et les données qu’une commande donne au générateur (--source=capture:…).
  const manquants = Object.entries(scripts).flatMap(([nom, commande]) => [
    ...[...commande.matchAll(/(?:^|\s)((?:tests|generateur)\/[^\s]+\.m?js)/g)].map(([, fichier]) => fichier),
    ...[...commande.matchAll(/--source=(?:capture|scenario):([^\s]+)/g)].map(([, fichier]) => fichier),
  ].filter((fichier) => !existsSync(path.join(racine, fichier))).map((fichier) => `${nom} : ${fichier}`));
  expect(manquants).toEqual([]);
  expect(Object.keys(scripts)).toEqual(expect.arrayContaining(['generer', 'generer:capture']));
});
